/**
 * @fileoverview Program outcomes tool. Returns all field-of-study programs at one school
 * with earnings, debt, and IPEDS award counts.
 * @module mcp-server/tools/definitions/get-programs.tool
 */

import { tool, z } from '@cyanheads/mcp-ts-core';
import { JsonRpcErrorCode } from '@cyanheads/mcp-ts-core/errors';
import {
  normalizeCip,
  normalizeSchoolId,
  SchoolIdSchema,
} from '@/services/scorecard/input-normalization.js';
import { getScorecardService } from '@/services/scorecard/scorecard-service.js';
import type { RawProgram } from '@/services/scorecard/types.js';

/** Short labels for the API's field-of-study credential levels (`credential.level`). */
const CREDENTIAL_LABELS: Record<number, string> = {
  1: 'Undergraduate certificate',
  2: "Associate's",
  3: "Bachelor's",
  4: 'Post-baccalaureate certificate',
  5: "Master's",
  6: 'Doctoral',
  7: 'First professional',
  8: 'Graduate/professional certificate',
  99: 'Non-credential',
};

/** Labels a program's credential; a level missing from the table uses the record's own title. */
const credentialLabel = (credential: RawProgram['credential']): string => {
  const level = credential?.level;
  if (level == null) return credential?.title ?? 'Unknown';
  return CREDENTIAL_LABELS[level] ?? credential?.title ?? String(level);
};

const ProgramSchema = z.object({
  code: z.string().describe('4-digit CIP program code.'),
  title: z.string().optional().describe('Program title.'),
  credential_level: z.string().describe('Degree/credential level.'),
  earnings_1yr_median: z
    .number()
    .optional()
    .describe(
      'Median earnings of graduates working and not enrolled 1 year after their highest credential.',
    ),
  earnings_count: z
    .number()
    .optional()
    .describe(
      'Graduates working and not enrolled 1 year after their highest credential, matching the earnings median population.',
    ),
  median_debt: z
    .number()
    .optional()
    .describe(
      'Median cumulative Stafford/Grad PLUS borrowing among completers across attended institutions at the same academic level.',
    ),
  ipeds_awards_year1: z
    .number()
    .optional()
    .describe(
      'IPEDS awards in year 1 of the pooled debt cohort; awards, not enrollment or unique students.',
    ),
  ipeds_awards_year2: z
    .number()
    .optional()
    .describe(
      'IPEDS awards in year 2 of the pooled debt cohort; awards, not enrollment or unique students.',
    ),
  suppressed: z
    .boolean()
    .describe('True when earnings data is suppressed due to small cohort (FERPA).'),
  suppression_note: z
    .string()
    .optional()
    .describe('Explains data suppression when suppressed=true.'),
});

export const getProgramsTool = tool('scorecard_get_programs', {
  title: 'Get School Programs',
  description:
    'All field-of-study programs at one school with median earnings 1 year after the highest credential, cumulative Stafford/Grad PLUS debt, and IPEDS award counts for each year of the pooled debt cohort. This is the primary source for program-level earnings — institution-level 6/8/10-year earnings are available via scorecard_get_earnings. Earnings may be suppressed (null) for programs with small cohorts due to FERPA privacy protection; suppressed=true flags this explicitly. Use scorecard_lookup_cip to find CIP codes by name.',
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },

  input: z.object({
    id: SchoolIdSchema,
    cip_code: z
      .string()
      .optional()
      .describe(
        'Filter to one 4-digit CIP code, dotted or undotted (e.g. "11.07" or "1107" for Computer Science). Returns one row per credential level the school offers in that program.',
      ),
    min_earnings: z
      .number()
      .optional()
      .describe('Minimum 1-year post-graduation median earnings filter.'),
    credential_level: z
      .number()
      .int()
      .optional()
      .describe(
        'Filter by credential level: 1=undergraduate certificate, 2=associate, 3=bachelor, 4=post-baccalaureate certificate, 5=master, 6=doctoral, 7=first professional, 8=graduate/professional certificate, 99=non-credential.',
      ),
  }),

  output: z.object({
    school_id: z.number().describe('School unit ID.'),
    school_name: z.string().describe('Institution name.'),
    programs: z
      .array(ProgramSchema.describe('Program outcome record.'))
      .describe(
        'All programs at this school matching the filters. Sorted by median earnings descending (suppressed programs at end).',
      ),
    total: z.number().describe('Total programs returned after filtering.'),
    suppressed_count: z
      .number()
      .describe('Number of programs with earnings suppressed due to small cohort.'),
  }),

  enrichment: {
    query: z
      .record(z.string(), z.unknown())
      .describe('Normalized effective school ID and program selectors.'),
    notice: z
      .string()
      .optional()
      .describe('Guidance when no programs match the filters or all data is suppressed.'),
  },
  enrichmentTrailer: { query: { render: (value) => JSON.stringify(value) } },

  errors: [
    {
      reason: 'api_conflict',
      code: JsonRpcErrorCode.Conflict,
      when: 'The provider reported a request conflict.',
      recovery: 'Review the provider detail and correct conflicting selectors before retrying.',
      thrownBy: 'service',
    },
    {
      reason: 'api_invalid_params',
      code: JsonRpcErrorCode.InvalidParams,
      when: 'Provider rejected a query parameter.',
      recovery:
        'Correct the reported parameter using scorecard_list_fields or scorecard_lookup_cip before retrying.',
      thrownBy: 'service',
    },
    {
      reason: 'api_validation',
      code: JsonRpcErrorCode.ValidationError,
      when: 'A meaningful selector or provider value is invalid.',
      recovery: 'Correct the reported selector or required ID before retrying the request.',
      thrownBy: 'service',
    },
    {
      reason: 'api_unauthorized',
      code: JsonRpcErrorCode.Unauthorized,
      when: 'The provider rejected the API credentials.',
      recovery: 'Verify SCORECARD_API_KEY is valid and retry with valid credentials.',
      thrownBy: 'service',
    },
    {
      reason: 'api_forbidden',
      code: JsonRpcErrorCode.Forbidden,
      when: 'The provider denied access.',
      recovery: 'Check SCORECARD_API_KEY permissions and provider access before retrying.',
      thrownBy: 'service',
    },
    {
      reason: 'api_rate_limited',
      code: JsonRpcErrorCode.RateLimited,
      when: 'The provider throttled the request.',
      recovery: 'Wait for the provider retry window before making another request.',
      thrownBy: 'service',
    },
    {
      reason: 'api_timeout',
      code: JsonRpcErrorCode.Timeout,
      when: 'The provider exchange exceeded its deadline.',
      recovery: 'Retry after a brief delay or narrow the requested data.',
      thrownBy: 'service',
    },
    {
      reason: 'api_not_found',
      code: JsonRpcErrorCode.NotFound,
      when: 'The provider endpoint returned HTTP 404.',
      recovery: 'Check provider availability and retry the request after a brief delay.',
      thrownBy: 'service',
    },
    {
      reason: 'api_invalid_request',
      code: JsonRpcErrorCode.InvalidRequest,
      when: 'The provider returned an unexpected redirect.',
      recovery: 'Check provider availability before retrying this request with the same selectors.',
      thrownBy: 'service',
    },
    {
      reason: 'api_internal',
      code: JsonRpcErrorCode.InternalError,
      when: 'The provider returned an unclassified HTTP response.',
      recovery: 'Retry after a brief delay and report persistent provider failures.',
      thrownBy: 'service',
    },
    {
      reason: 'school_not_found',
      code: JsonRpcErrorCode.NotFound,
      when: 'No school record found for the requested ID.',
      recovery: 'Verify the school ID using scorecard_search_schools and retry.',
    },
    {
      reason: 'api_error',
      code: JsonRpcErrorCode.ServiceUnavailable,
      when: 'The College Scorecard API returned an error.',
      recovery: 'Retry after a brief delay and report persistent provider failures.',
      thrownBy: 'service',
    },
  ],

  async handler(input, ctx) {
    input = { ...input, id: normalizeSchoolId(input.id), cip_code: normalizeCip(input.cip_code) };
    ctx.enrich({
      query: Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)),
    });
    ctx.log.info('Fetching school programs', { id: input.id, cip_code: input.cip_code });
    const service = getScorecardService();

    const response = await service.getSchoolPrograms(
      input.id,
      input.cip_code,
      input.min_earnings,
      input.credential_level,
      ctx,
    );

    const record = response.results[0];
    if (!record) {
      throw ctx.fail('school_not_found', `No school record found for ID ${input.id}.`, {
        id: input.id,
        recovery: { hint: 'Search for valid school IDs with scorecard_search_schools.' },
      });
    }

    const rawPrograms = record['latest.programs.cip_4_digit'] ?? [];

    // Filter programs by client-supplied criteria
    let filtered = rawPrograms;
    if (input.cip_code) {
      // Compare undotted: the API returns "1107", callers and scorecard_lookup_cip pass "11.07".
      const cip = input.cip_code.replaceAll('.', '');
      filtered = filtered.filter((p) => p.code?.replaceAll('.', '') === cip);
    }
    if (input.credential_level != null) {
      filtered = filtered.filter((p) => p.credential?.level === input.credential_level);
    }

    const programs = filtered.map((p): z.infer<typeof ProgramSchema> => {
      const rawEarnings = p.earnings?.highest?.['1_yr']?.overall_median_earnings;
      const earningsCount = p.earnings?.highest?.['1_yr']?.working_not_enrolled?.overall_count;
      const medianDebt = p.debt?.staff_grad_plus?.all?.all_inst?.median;
      const suppressed = rawEarnings == null;
      return {
        code: p.code ?? 'Unknown',
        ...(p.title && { title: p.title }),
        credential_level: credentialLabel(p.credential),
        ...(rawEarnings != null && { earnings_1yr_median: rawEarnings }),
        ...(earningsCount != null && { earnings_count: earningsCount }),
        ...(medianDebt != null && { median_debt: medianDebt }),
        ...(p.counts?.ipeds_awards1 != null && { ipeds_awards_year1: p.counts.ipeds_awards1 }),
        ...(p.counts?.ipeds_awards2 != null && { ipeds_awards_year2: p.counts.ipeds_awards2 }),
        suppressed,
        ...(suppressed && {
          suppression_note:
            'Earnings data suppressed — cohort too small to report under FERPA privacy rules.',
        }),
      };
    });

    // Apply min_earnings filter after normalization (post-fetch)
    const minEarnings = input.min_earnings;
    const earningsFiltered =
      minEarnings != null
        ? programs.filter((p) => !p.suppressed && (p.earnings_1yr_median ?? 0) >= minEarnings)
        : programs;

    if (earningsFiltered.length === 0) {
      const hint =
        filtered.length > 0
          ? 'Lower the min_earnings threshold or remove it to see all programs.'
          : 'Remove the cip_code or credential_level filter to see all available programs.';
      ctx.enrich.notice(
        rawPrograms.length
          ? `No programs matched at this existing school. ${hint}`
          : 'This institution has no reported programs; try another school ID from scorecard_search_schools.',
      );
    }

    // Sort: programs with earnings first, descending by earnings
    const sorted = earningsFiltered.sort((a, b) => {
      if (a.suppressed && !b.suppressed) return 1;
      if (!a.suppressed && b.suppressed) return -1;
      return (b.earnings_1yr_median ?? 0) - (a.earnings_1yr_median ?? 0);
    });

    const suppressed_count = sorted.filter((p) => p.suppressed).length;
    if (suppressed_count > 0) {
      ctx.enrich.notice(
        `${suppressed_count} of ${sorted.length} programs have suppressed earnings due to small cohorts (FERPA). These are listed last.`,
      );
    }

    return {
      school_id: record.id ?? Number(input.id),
      school_name: record['school.name'] ?? 'Unknown',
      programs: sorted,
      total: sorted.length,
      suppressed_count,
    };
  },

  format: (result) => {
    const lines = [
      `## Programs at ${result.school_name} (ID: ${result.school_id})`,
      `**Total:** ${result.total} | **Suppressed:** ${result.suppressed_count}`,
    ];
    for (const p of result.programs) {
      lines.push(`\n**${p.code}** — ${p.title ?? 'Unknown title'} (${p.credential_level})`);
      lines.push(
        `1-Year Earnings (median): ${p.earnings_1yr_median != null ? `$${p.earnings_1yr_median.toLocaleString()}` : p.suppressed ? 'Suppressed (small cohort, FERPA)' : 'Not available'}`,
      );
      if (p.suppression_note != null) lines.push(`Suppression note: ${p.suppression_note}`);
      if (p.median_debt != null)
        lines.push(
          `Median Cumulative Stafford/Grad PLUS Debt (all institutions, same academic level): $${p.median_debt.toLocaleString()}`,
        );
      if (p.ipeds_awards_year1 != null)
        lines.push(`IPEDS Awards (debt cohort year 1): ${p.ipeds_awards_year1.toLocaleString()}`);
      if (p.ipeds_awards_year2 != null)
        lines.push(`IPEDS Awards (debt cohort year 2): ${p.ipeds_awards_year2.toLocaleString()}`);
      if (p.earnings_count != null)
        lines.push(
          `Earnings Cohort (working, not enrolled; 1 year after highest credential): ${p.earnings_count} graduates`,
        );
    }
    return [{ type: 'text', text: lines.join('\n') }];
  },
});
