/**
 * @fileoverview Cross-institution program search tool. Finds programs by CIP code or keyword
 * across all institutions, ranked by median earnings.
 * @module mcp-server/tools/definitions/search-programs.tool
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
import { ownershipLabel } from '@/mcp-server/format-helpers.js';
import {
  programMetricLines,
  programNumber,
  programProvenanceLines,
  programText,
} from '@/mcp-server/program-format.js';
import {
  meaningfulText,
  normalizeCip,
  normalizeState,
} from '@/services/scorecard/input-normalization.js';
import { MetricAvailabilitySchema } from '@/services/scorecard/metric-availability.js';
import {
  CompletionMetricsSchema,
  compareProgramEarnings,
  programOutcomes,
  programPage,
} from '@/services/scorecard/program-outcomes.js';
import { getScorecardService } from '@/services/scorecard/scorecard-service.js';

const ProgramResultSchema = z.object({
  ...CompletionMetricsSchema.shape,
  ope6_id: z
    .string()
    .nullable()
    .describe('Provider OPEID6 group identifier, preserving leading zeros; null when absent.'),
  earnings_count: z
    .number()
    .optional()
    .describe('Legacy highest-credential working/not-enrolled population count.'),
  earnings_count_availability: MetricAvailabilitySchema.describe(
    'Availability of the legacy highest-credential count.',
  ),
  school_id: z.number().describe('School unit ID — use for follow-up calls.'),
  school_name: z.string().describe('Institution name.'),
  school_state: z.string().optional().describe('State code.'),
  school_ownership: z.string().describe('Control type: Public, Private nonprofit, or For-profit.'),
  net_price_overall: z.number().optional().describe('Average net price at this school.'),
  program_code: z.string().describe('4-digit CIP program code.'),
  program_title: z.string().optional().describe('Program title.'),
  credential_level: z
    .number()
    .int()
    .optional()
    .describe('Provider credential level; unknown future numeric levels are retained.'),
  credential_title: z.string().optional().describe('Provider credential title, when reported.'),
  earnings_1yr_median: z
    .number()
    .optional()
    .describe(
      'Median earnings of graduates working and not enrolled 1 year after their highest credential.',
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
  suppressed: z.boolean().describe('True only for explicit provider privacy markers.'),
  earnings_availability: MetricAvailabilitySchema.describe(
    'Available number, unavailable with unknown cause, or confirmed privacy suppression.',
  ),
});

export const searchProgramsTool = tool('scorecard_search_programs', {
  title: 'Search Programs',
  description:
    'Find programs across institutions, ranked and filtered by completion-based one-year median earnings within the fetched school page. Legacy highest-credential values remain separate with their own provenance. Earnings and debt pool across campuses sharing OPEID6 within CIP/credential; awards are campus-specific. School page/per_page/total count schools; limit/offset page the matching program rows. Follow next to drain this school page before advancing to the next school page. Use scorecard_lookup_cip to find CIP codes.',
  annotations: { readOnlyHint: true, openWorldHint: true },

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
      .describe('Zero-based row offset within the filtered and sorted school page.'),
    credential_level: z
      .number()
      .int()
      .optional()
      .describe(
        'Provider credential selector: 1=undergraduate certificate, 2=associate, 3=bachelor, 4=post-baccalaureate certificate, 5=master, 6=doctoral, 7=first professional, 8=graduate/professional certificate, 99=non-credential; other integer levels may return no matches.',
      ),
    cip_code: z
      .string()
      .optional()
      .describe(
        'CIP 4-digit code to search for (e.g. "11.07" for Computer Science). Use scorecard_lookup_cip to find codes.',
      ),
    program_name: z
      .string()
      .optional()
      .describe(
        'Case-insensitive title substring matched within the fetched school page. Ignored when cip_code is provided; use cip_code for upstream program matching.',
      ),
    state: z
      .string()
      .optional()
      .describe(
        'Comma-separated two-letter state codes; case and whitespace normalized, blanks unset.',
      ),
    ownership: z
      .number()
      .int()
      .min(1)
      .max(3)
      .optional()
      .describe('Restrict to school type: 1=public, 2=private nonprofit, 3=for-profit.'),
    max_net_price: z
      .number()
      .optional()
      .describe('Maximum average net price at the school; negative values normalize to $0.'),
    min_earnings: z
      .number()
      .optional()
      .describe(
        'Minimum completion-based one-year median earnings, inclusive, without legacy fallback; filters this school page locally while school totals remain unchanged.',
      ),
    max_debt: z
      .number()
      .optional()
      .describe(
        'Maximum median cumulative Stafford/Grad PLUS debt across institutions at the same academic level, inclusive; excludes unavailable debt. Negative values normalize to $0.',
      ),
    per_page: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(20)
      .describe('Schools per page (max 100); program rows may exceed this count.'),
    page: z.number().int().min(0).default(0).describe('Zero-indexed page number.'),
  }),

  output: z.object({
    metric_scope: ProgramMetricScopeSchema.describe(
      'Aggregation scope within CIP and credential identity.',
    ),
    provenance: ProgramProvenanceSchema.describe(
      'Dictionary provenance for each distinct program population.',
    ),
    shown: z.number().describe('Program rows returned in this response.'),
    offset: z.number().describe('Effective zero-based row offset within this school page.'),
    limit: z.number().describe('Effective program row limit, at most 100.'),
    nextOffset: z
      .number()
      .nullable()
      .describe('Next row offset on this school page, or null when drained.'),
    next: z
      .object({
        page: z.number().describe('School page to request.'),
        offset: z.number().describe('Row offset to request on that school page.'),
      })
      .nullable()
      .describe('Continuation using the same selectors and limits; null when exhausted.'),
    total: z
      .number()
      .describe(
        'Total schools matching upstream filters, before pagination and local program filtering.',
      ),
    page: z.number().describe('Current page (zero-indexed).'),
    per_page: z.number().describe('Results per page used.'),
    programs: z
      .array(ProgramResultSchema.describe('Program result with school context.'))
      .describe(
        'One page of program rows retaining credential identities, stably sorted by completion-based one-year earnings descending, with unavailable current earnings last.',
      ),
    total_programs: z
      .number()
      .describe('Matching program rows on the fetched school page before row pagination.'),
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
      .describe('Normalized effective selectors and pagination defaults.'),
    totalCount: z
      .number()
      .describe(
        'Total schools matching upstream filters, before pagination and local program filtering.',
      ),
    truncated: z.boolean().describe('True when more program rows or a later school page remain.'),
    schools_shown: z.number().describe('Schools returned on this school page.'),
    cap: z.number().describe('The effective program row limit that was applied.'),
    notice: z
      .string()
      .optional()
      .describe('Recovery hint when no programs match or earnings data is unavailable.'),
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
      reason: 'api_error',
      code: JsonRpcErrorCode.ServiceUnavailable,
      when: 'The College Scorecard API returned an error.',
      recovery: 'Retry after a brief delay and report persistent provider failures.',
      thrownBy: 'service',
    },
  ],

  async handler(input, ctx) {
    const notices: string[] = [];
    const normalizeBound = (key: 'max_net_price' | 'max_debt') => {
      const requested = input[key];
      if (requested == null || requested >= 0) return requested;
      notices.push(`${key} normalized to $0 (requested ${requested}).`);
      return 0;
    };
    const requestedLimit = input.limit;
    input = {
      ...input,
      limit: Math.min(input.limit, 100),
      cip_code: normalizeCip(input.cip_code),
      state: normalizeState(input.state),
      program_name: meaningfulText(input.program_name),
      max_net_price: normalizeBound('max_net_price'),
      max_debt: normalizeBound('max_debt'),
    };
    if (requestedLimit > 100) notices.push('Program limit normalized to 100 rows.');
    ctx.enrich({
      query: Object.fromEntries(
        Object.entries({
          ...input,
          program_name: input.cip_code ? undefined : input.program_name,
        }).filter(([, value]) => value !== undefined),
      ),
    });
    ctx.log.info('Searching programs', {
      cip_code: input.cip_code,
      state: input.state,
      page: input.page,
    });
    const service = getScorecardService();

    const response = await service.searchPrograms(
      {
        ...(input.cip_code && { cipCode: input.cip_code }),
        ...(input.credential_level != null && { credentialLevel: input.credential_level }),
        ...(input.state && { state: input.state }),
        ...(input.ownership != null && { ownership: input.ownership }),
        ...(input.max_net_price != null && { maxNetPrice: input.max_net_price }),
        ...(input.max_debt != null && { maxDebt: input.max_debt }),
        perPage: input.per_page,
        page: input.page,
      },
      ctx,
    );

    // Flatten: each school record may have multiple matching programs in the nested array
    const allPrograms: z.infer<typeof ProgramResultSchema>[] = [];
    for (const record of response.results) {
      const rawPrograms = record['latest.programs.cip_4_digit'] ?? [];
      // When cip_code filter applied, API returns only matching programs
      for (const p of rawPrograms) {
        if (input.cip_code && p.code?.replaceAll('.', '') !== input.cip_code) continue;
        if (input.credential_level != null && p.credential?.level !== input.credential_level)
          continue;
        // Apply program_name soft filter if cip_code not provided
        if (input.program_name && !input.cip_code) {
          const nameMatch = (p.title ?? '')
            .toLowerCase()
            .includes(input.program_name.toLowerCase());
          if (!nameMatch) continue;
        }

        const outcomes = programOutcomes(p);
        const rawEarnings = outcomes.completion_1yr_median;
        const medianDebt = p.debt?.staff_grad_plus?.all?.all_inst?.median;

        // Post-fetch earnings filter
        if (input.min_earnings != null && (rawEarnings == null || rawEarnings < input.min_earnings))
          continue;
        // Post-fetch debt filter
        if (input.max_debt != null && (medianDebt == null || medianDebt > input.max_debt)) continue;

        allPrograms.push({
          ...outcomes,
          ope6_id: record.ope6_id ?? null,
          school_id: record.id ?? 0,
          school_name: record['school.name'] ?? 'Unknown',
          ...(record['school.state'] && { school_state: record['school.state'] }),
          school_ownership: ownershipLabel(record['school.ownership']),
          ...(record['latest.cost.avg_net_price.overall'] != null && {
            net_price_overall: record['latest.cost.avg_net_price.overall'] as number,
          }),
          program_code: p.code ?? 'Unknown',
          ...(p.title && { program_title: p.title }),
          ...(p.credential?.level != null && { credential_level: p.credential.level }),
          ...(p.credential?.title != null && { credential_title: p.credential.title }),
          ...(medianDebt != null && { median_debt: medianDebt }),
          ...(p.counts?.ipeds_awards1 != null && { ipeds_awards_year1: p.counts.ipeds_awards1 }),
          ...(p.counts?.ipeds_awards2 != null && { ipeds_awards_year2: p.counts.ipeds_awards2 }),
        });
      }
    }

    // Available numbers sort ahead of missing or privacy-suppressed earnings.
    allPrograms.sort(compareProgramEarnings);
    const rows = programPage(allPrograms, input.offset, input.limit);

    const suppressed_count = allPrograms.filter((p) => p.suppressed).length;
    const unavailable_count = allPrograms.filter(
      (p) => p.earnings_availability === 'unavailable',
    ).length;

    const { total, page, per_page } = response.metadata;
    const moreSchools = (page + 1) * per_page < total;
    const next =
      rows.nextOffset != null
        ? { page, offset: rows.nextOffset }
        : moreSchools
          ? { page: page + 1, offset: 0 }
          : null;
    const truncated = next != null;
    ctx.enrich.total(total);
    ctx.enrich({ truncated, schools_shown: response.results.length, cap: rows.limit });
    if (allPrograms.length === 0) {
      notices.push(
        response.results.length === 0
          ? total > 0
            ? `This school page is exhausted. Valid page range: 0–${Math.ceil(total / per_page) - 1}.`
            : 'No schools matched the upstream filters. No programs matched; broaden state, CIP, or cost filters.'
          : 'No programs matched the local filters on this populated school page. Try removing min_earnings, max_debt, or program_name, or use scorecard_lookup_cip to find the correct CIP code.',
      );
    } else if (suppressed_count + unavailable_count === allPrograms.length) {
      notices.push(
        `All ${allPrograms.length} programs lack available legacy highest-credential earnings: ${suppressed_count} confirmed privacy-suppressed, ${unavailable_count} unavailable with unknown cause. Current completion-based earnings are reported separately.`,
      );
    }
    if (next) {
      notices.push(
        `More programs or schools remain. Request page ${next.page} with offset ${next.offset} and the same selectors and limits.`,
      );
    }
    if (input.offset > 0 && rows.shown === 0)
      notices.push('This program offset is exhausted on this school page.');
    if (notices.length > 0) ctx.enrich.notice(notices.join(' '));

    return {
      metric_scope: PROGRAM_METRIC_SCOPE,
      provenance: PROGRAM_PROVENANCE,
      shown: rows.shown,
      offset: rows.offset,
      limit: rows.limit,
      nextOffset: rows.nextOffset,
      next,
      total: response.metadata.total,
      page: response.metadata.page,
      per_page: response.metadata.per_page,
      programs: rows.programs,
      total_programs: allPrograms.length,
      suppressed_count,
      unavailable_count,
    };
  },

  format: (result) => {
    const lines = [
      `## Program Search Results`,
      `**Schools Matched:** ${result.total} | **Programs:** ${result.total_programs} | **Legacy earnings suppressed:** ${result.suppressed_count} | **Legacy earnings unavailable:** ${result.unavailable_count}`,
      `**Page:** ${result.page} | **Per Page:** ${result.per_page}`,
    ];
    for (const p of result.programs) {
      lines.push(
        `\n**${programText(p.program_code)}** — ${programText(p.program_title ?? 'Unknown')}`,
      );
      lines.push(...programMetricLines(p));
      if (p.credential_level != null || p.credential_title != null)
        lines.push(
          `- Credential: ${programText(p.credential_title ?? 'Title not reported')}${p.credential_level != null ? ` (level ${p.credential_level})` : ''}`,
        );
      lines.push(
        `- School: ${programText(p.school_name)} (ID: ${p.school_id}) | ${programText(p.school_ownership)}${p.school_state != null ? ` | ${programText(p.school_state)}` : ''}`,
        `- OPEID6: ${p.ope6_id == null ? 'null' : programText(p.ope6_id)}`,
      );
      if (p.net_price_overall != null)
        lines.push(`- Net price: $${programNumber(p.net_price_overall)}`);
    }
    lines.push(
      `\nProgram rows: ${result.shown} | Offset: ${result.offset} | Limit: ${result.limit} | Next offset: ${result.nextOffset}`,
      `Continuation: ${result.next == null ? 'null' : `page ${result.next.page}, offset ${result.next.offset}`}`,
      ...programProvenanceLines(result.provenance, result.metric_scope),
    );
    return [{ type: 'text', text: lines.join('\n') }];
  },
});
