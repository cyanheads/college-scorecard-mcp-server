/**
 * @fileoverview Program outcomes tool. Pages field-of-study programs at one school
 * with earnings, debt, and IPEDS award counts.
 * @module mcp-server/tools/definitions/get-programs.tool
 */

import { tool, z } from '@cyanheads/mcp-ts-core';
import { JsonRpcErrorCode } from '@cyanheads/mcp-ts-core/errors';
import { markdown } from '@cyanheads/mcp-ts-core/utils';
import {
  PROGRAM_METRIC_SCOPE,
  PROGRAM_PROVENANCE,
  ProgramMetricScopeSchema,
  ProgramProvenanceSchema,
} from '@/data/program-provenance.js';
import {
  programMetricLines,
  programProvenanceLines,
  programText,
} from '@/mcp-server/program-format.js';
import {
  normalizeCip,
  normalizeSchoolId,
  SchoolIdSchema,
} from '@/services/scorecard/input-normalization.js';
import { MetricAvailabilitySchema } from '@/services/scorecard/metric-availability.js';
import {
  CompletionMetricsSchema,
  compareProgramEarnings,
  programOutcomes,
  programPage,
} from '@/services/scorecard/program-outcomes.js';
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
  ...CompletionMetricsSchema.shape,
  earnings_count_availability: MetricAvailabilitySchema.describe(
    'Availability of the legacy highest-credential population count.',
  ),
  code: z.string().describe('4-digit CIP program code.'),
  title: z.string().optional().describe('Program title.'),
  credential_level: z.string().describe('Degree/credential level.'),
  credential_level_code: z
    .number()
    .int()
    .optional()
    .describe(
      'Provider numeric credential identity; the legacy credential_level field remains a display label.',
    ),
  credential_title: z.string().optional().describe('Provider credential title when reported.'),
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
    .describe('True only when the provider explicitly marks earnings as privacy-suppressed.'),
  earnings_availability: MetricAvailabilitySchema.describe(
    'Available number, unavailable with unknown cause, or confirmed privacy suppression.',
  ),
  suppression_note: z
    .string()
    .optional()
    .describe('Explains data suppression when suppressed=true.'),
});

export const getProgramsTool = tool('scorecard_get_programs', {
  title: 'Get School Programs',
  description:
    'Page through field-of-study programs at one school, ranked and filtered by completion-based one-year earnings. Legacy highest-credential earnings remain separate from current one- and four-year completion series, with dictionary provenance. Earnings and debt pool across campuses sharing OPEID6 within CIP/credential; awards are campus-specific. Use scorecard_lookup_cip to find CIP codes by name.',
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },

  input: z.object({
    limit: z
      .number()
      .int()
      .min(1)
      .max(1000)
      .default(20)
      .describe('Program rows per response; values above 100 normalize to 100.'),
    offset: z
      .number()
      .int()
      .min(0)
      .default(0)
      .describe('Zero-based program row offset after filtering and stable earnings ordering.'),
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
      .describe('Minimum completion-based one-year median earnings; no legacy fallback.'),
    credential_level: z
      .number()
      .int()
      .optional()
      .describe(
        'Filter by credential level: 1=undergraduate certificate, 2=associate, 3=bachelor, 4=post-baccalaureate certificate, 5=master, 6=doctoral, 7=first professional, 8=graduate/professional certificate, 99=non-credential.',
      ),
  }),

  output: z.object({
    ope6_id: z
      .string()
      .nullable()
      .describe('Provider OPEID6 group identifier, preserving leading zeros; null when absent.'),
    metric_scope: ProgramMetricScopeSchema.describe(
      'Metric aggregation scope within CIP and credential.',
    ),
    provenance: ProgramProvenanceSchema.describe(
      'Dictionary cohort, measurement, and dollar provenance for each population.',
    ),
    shown: z.number().describe('Program rows returned on this page.'),
    offset: z.number().describe('Effective zero-based program offset.'),
    limit: z.number().describe('Effective program row limit, at most 100.'),
    nextOffset: z.number().nullable().describe('Next program row offset, or null when exhausted.'),
    truncated: z.boolean().describe('More matching program rows remain.'),
    school_id: z.number().describe('School unit ID.'),
    school_name: z.string().describe('Institution name.'),
    programs: z
      .array(ProgramSchema.describe('Program outcome record.'))
      .describe(
        'One page of matching programs, stably sorted by completion-based one-year earnings descending, with unavailable current earnings last.',
      ),
    total: z.number().describe('Total matching programs before row pagination.'),
    suppressed_count: z
      .number()
      .describe(
        'Matching programs with confirmed privacy-suppressed legacy highest-credential earnings, before row paging.',
      ),
    unavailable_count: z
      .number()
      .describe(
        'Matching programs with unavailable legacy highest-credential earnings of unknown cause, before row paging.',
      ),
  }),

  enrichment: {
    query: z
      .record(z.string(), z.unknown())
      .describe('Normalized effective school ID and program selectors.'),
    notice: z
      .string()
      .optional()
      .describe(
        'Guidance when no programs match or some earnings are unavailable or privacy-suppressed.',
      ),
  },
  enrichmentTrailer: {
    query: { render: (value) => markdown().inlineCode(JSON.stringify(value)).build() },
  },

  errors: [
    {
      reason: 'api_conflict',
      code: JsonRpcErrorCode.Conflict,
      when: 'The provider reported a request conflict.',
      recovery: 'Correct conflicting selectors in the request before retrying.',
      thrownBy: 'service',
    },
    {
      reason: 'api_invalid_params',
      code: JsonRpcErrorCode.InvalidParams,
      when: 'Provider rejected a query parameter.',
      recovery:
        'Check field names with scorecard_list_fields or program codes with scorecard_lookup_cip before retrying.',
      thrownBy: 'service',
    },
    {
      reason: 'api_validation',
      code: JsonRpcErrorCode.ValidationError,
      when: 'A meaningful selector or provider value is invalid.',
      recovery: 'Check selectors and required IDs before retrying the request.',
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
    const notices: string[] = [];
    const requestedLimit = input.limit;
    input = {
      ...input,
      limit: Math.min(input.limit, 100),
      id: normalizeSchoolId(input.id),
      cip_code: normalizeCip(input.cip_code),
    };
    if (requestedLimit > 100) notices.push('Program limit normalized to 100 rows.');
    ctx.enrich({
      query: Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)),
    });
    ctx.log.info('Fetching school programs', { id: input.id, cip_code: input.cip_code });
    const service = getScorecardService();

    const response = await service.getSchoolPrograms(
      input.id,
      input.cip_code,
      undefined,
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
      const outcomes = programOutcomes(p);
      const medianDebt = p.debt?.staff_grad_plus?.all?.all_inst?.median;
      const suppressed = outcomes.suppressed;
      return {
        code: p.code ?? 'Unknown',
        ...(p.title && { title: p.title }),
        credential_level: credentialLabel(p.credential),
        ...(p.credential?.level != null && { credential_level_code: p.credential.level }),
        ...(p.credential?.title != null && { credential_title: p.credential.title }),
        ...outcomes,
        ...(medianDebt != null && { median_debt: medianDebt }),
        ...(p.counts?.ipeds_awards1 != null && { ipeds_awards_year1: p.counts.ipeds_awards1 }),
        ...(p.counts?.ipeds_awards2 != null && { ipeds_awards_year2: p.counts.ipeds_awards2 }),
        ...(suppressed && {
          suppression_note:
            'The provider explicitly marks earnings as privacy-suppressed; the particular cause is not supplied.',
        }),
      };
    });

    // Apply min_earnings filter after normalization (post-fetch)
    const minEarnings = input.min_earnings;
    const earningsFiltered =
      minEarnings != null
        ? programs.filter(
            (p) => p.completion_1yr_median != null && p.completion_1yr_median >= minEarnings,
          )
        : programs;

    if (earningsFiltered.length === 0) {
      const hint =
        filtered.length > 0
          ? 'Lower the min_earnings threshold or remove it to see all programs.'
          : 'Remove the cip_code or credential_level filter to see all available programs.';
      notices.push(
        rawPrograms.length
          ? `No programs matched at this existing school. ${hint}`
          : 'This institution has no reported programs; try another school ID from scorecard_search_schools.',
      );
    }

    // Sort: programs with earnings first, descending by earnings
    const sorted = earningsFiltered.sort(compareProgramEarnings);
    const page = programPage(sorted, input.offset, input.limit);
    if (page.truncated)
      notices.push(
        `More program rows remain. Request offset ${page.nextOffset} with the same selectors.`,
      );
    else if (input.offset > 0 && page.shown === 0)
      notices.push('This program offset is exhausted; use offset 0 to restart.');

    const suppressed_count = sorted.filter((p) => p.suppressed).length;
    const unavailable_count = sorted.filter(
      (p) => p.earnings_availability === 'unavailable',
    ).length;
    if (suppressed_count > 0 || unavailable_count > 0) {
      notices.push(
        `${suppressed_count} programs have confirmed privacy-suppressed earnings; ${unavailable_count} have unavailable earnings of unknown cause in the legacy highest-credential series. Ordering uses current completion-based one-year earnings.`,
      );
    }
    if (notices.length > 0) ctx.enrich.notice(notices.join(' '));

    return {
      ...page,
      ope6_id: record.ope6_id ?? null,
      metric_scope: PROGRAM_METRIC_SCOPE,
      provenance: PROGRAM_PROVENANCE,
      school_id: record.id ?? Number(input.id),
      school_name: record['school.name'] ?? 'Unknown',
      suppressed_count,
      unavailable_count,
    };
  },

  format: (result) => {
    const lines = [
      `## Programs at ${programText(result.school_name)} (ID: ${result.school_id})`,
      `OPEID6: ${result.ope6_id == null ? 'null' : programText(result.ope6_id)}`,
      `**Total:** ${result.total} | **Legacy earnings suppressed:** ${result.suppressed_count} | **Legacy earnings unavailable:** ${result.unavailable_count}`,
    ];
    for (const p of result.programs) {
      lines.push(
        `\n**${programText(p.code)}** — ${programText(p.title ?? 'Unknown title')} (${programText(p.credential_level)})`,
      );
      lines.push(...programMetricLines(p));
      if (p.credential_level_code != null)
        lines.push(`- Provider credential level: ${p.credential_level_code}`);
      if (p.credential_title != null)
        lines.push(`- Provider credential title: ${programText(p.credential_title)}`);
    }
    lines.push(
      `\nProgram rows: ${result.shown} | Offset: ${result.offset} | Limit: ${result.limit} | Next offset: ${result.nextOffset} | Truncated: ${result.truncated}`,
      ...programProvenanceLines(result.provenance, result.metric_scope),
    );
    return [{ type: 'text', text: lines.join('\n') }];
  },
});
