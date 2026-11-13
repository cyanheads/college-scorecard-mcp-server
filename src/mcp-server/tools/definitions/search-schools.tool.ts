/**
 * @fileoverview School search tool. Searches and filters institutions by name, location,
 * type, size, and acceptance rate range.
 * @module mcp-server/tools/definitions/search-schools.tool
 */

import { tool, z } from '@cyanheads/mcp-ts-core';
import { JsonRpcErrorCode } from '@cyanheads/mcp-ts-core/errors';
import { escapeMarkdownInline, markdown } from '@cyanheads/mcp-ts-core/utils';
import { degreeLevelLabel, ownershipLabel } from '@/mcp-server/format-helpers.js';
import {
  formatOperatingCertification,
  InstitutionContextSchema,
  InstitutionCostsSchema,
  institutionContext,
  institutionCosts,
  OperatingCertificationSchema,
  operatingCertification,
  operatingCertificationNotice,
} from '@/mcp-server/institution-context.js';
import { normalizeSearchOptions } from '@/services/scorecard/input-normalization.js';
import { getScorecardService } from '@/services/scorecard/scorecard-service.js';
import { SCHOOL_LOCALE_RANGES } from '@/services/scorecard/types.js';

export const searchSchoolsTool = tool('scorecard_search_schools', {
  title: 'Search Schools',
  description:
    'Search and filter U.S. colleges and universities by name, location, type, size, and acceptance rate. Returns core identity and cost metrics. Use scorecard_get_school for profiles or scorecard_search_programs for programs. Geographic distance requires a U.S. ZIP; ZIP alone uses the provider default radius. State accepts comma-separated two-letter codes (e.g. WA,CA). Ownership: 1=public, 2=private nonprofit, 3=for-profit. Degree level: 0=Not classified, 1=certificate, 2=associate, 3=bachelor, 4=Entirely graduate-degree granting.',
  annotations: { readOnlyHint: true, openWorldHint: true },

  input: z.object({
    query: z
      .string()
      .optional()
      .describe('School name search — partial or full name; all words must appear.'),
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
      .describe('Control type: 1=public, 2=private nonprofit, 3=private for-profit.'),
    degree_level: z
      .number()
      .int()
      .min(0)
      .max(4)
      .optional()
      .describe(
        'Predominant degree: 0=Not classified, 1=certificate, 2=associate, 3=bachelor, 4=Entirely graduate-degree granting.',
      ),
    size_range: z
      .object({
        min: z.number().int().min(0).describe('Minimum enrollment size.'),
        max: z.number().int().min(0).describe('Maximum enrollment size.'),
      })
      .optional()
      .describe('Undergraduate enrollment size range. Omit for no size filter.'),
    acceptance_rate_range: z
      .object({
        min: z
          .number()
          .min(0)
          .max(1)
          .describe('Minimum acceptance rate as a decimal (e.g. 0.1 for 10%).'),
        max: z
          .number()
          .min(0)
          .max(1)
          .describe('Maximum acceptance rate as a decimal (e.g. 0.9 for 90%).'),
      })
      .optional()
      .describe('Acceptance rate range as decimals (0–1). Omit for no filter.'),
    zip: z
      .string()
      .optional()
      .describe(
        'Five-digit U.S. ZIP or ZIP+4. Alone uses the provider default radius; blank is unset.',
      ),
    distance: z
      .string()
      .optional()
      .describe(
        'Nonnegative radius: bare miles, mi, or km, including decimals. Requires meaningful zip.',
      ),
    cip_code: z
      .string()
      .optional()
      .describe(
        'Filter to schools offering this CIP 4-digit program code (e.g. "11.07"). Use scorecard_lookup_cip to find codes.',
      ),
    sort: z
      .string()
      .optional()
      .describe(
        'Upstream sort expression such as "latest.cost.avg_net_price.overall:asc" or "latest.cost.avg_net_price.overall:desc". Use scorecard_list_fields to find fields with API sort support. Omission keeps provider ordering.',
      ),
    men_only: z
      .boolean()
      .optional()
      .describe(
        'True selects men-only institutions; false selects institutions explicitly marked not men-only. Omit to include unknown values.',
      ),
    women_only: z
      .boolean()
      .optional()
      .describe(
        'True selects women-only institutions; false selects institutions explicitly marked not women-only. Omit to include unknown values.',
      ),
    operating: OperatingCertificationSchema.describe(
      'True selects currently certified institutions. False selects institutions reported as lacking current operating certification. Omit to include all statuses.',
    ),
    max_net_price: z
      .number()
      .optional()
      .describe(
        'Inclusive ceiling on reported average net price in dollars. Negative values use zero. Excludes schools with unreported net price.',
      ),
    min_completion_rate: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe(
        'Inclusive floor on reported overall completion rate as a decimal (0–1). Excludes schools with unreported rates.',
      ),
    hbcu: z
      .boolean()
      .optional()
      .describe(
        'True selects historically Black colleges and universities. False selects institutions explicitly marked as non-HBCU. Omit to include unknown values.',
      ),
    locale: z
      .enum(Object.keys(SCHOOL_LOCALE_RANGES) as (keyof typeof SCHOOL_LOCALE_RANGES)[])
      .optional()
      .describe('Provider locale group. Excludes schools with unreported locale.'),
    per_page: z.number().int().min(1).max(100).default(20).describe('Results per page (max 100).'),
    page: z.number().int().min(0).default(0).describe('Zero-indexed page number for pagination.'),
  }),

  output: z.object({
    total: z.number().describe('Total institutions matching the filters (before pagination).'),
    page: z.number().describe('Current page (zero-indexed).'),
    per_page: z.number().describe('Results per page used.'),
    schools: z
      .array(
        z
          .object({
            ...InstitutionContextSchema.shape,
            operating: OperatingCertificationSchema,
            ...InstitutionCostsSchema.shape,
            id: z.number().describe('Unit ID — use for scorecard_get_school lookups.'),
            name: z.string().describe('Institution name.'),
            city: z.string().optional().describe('City.'),
            state: z.string().optional().describe('State code.'),
            ownership: z
              .string()
              .describe('Control type: Public, Private nonprofit, or For-profit.'),
            degree_level: z.string().describe('Predominant degree awarded.'),
            enrollment: z.number().optional().describe('Undergraduate enrollment.'),
            admission_rate: z
              .number()
              .optional()
              .describe('Overall admission rate (0–1). Null if not reported.'),
            tuition_in_state: z.number().optional().describe('In-state tuition and fees.'),
            tuition_out_of_state: z.number().optional().describe('Out-of-state tuition and fees.'),
            net_price_overall: z
              .number()
              .optional()
              .describe('Average net price (all income levels).'),
            median_debt: z.number().optional().describe('Median debt at graduation.'),
            earnings_6yr_median: z
              .number()
              .optional()
              .describe('Median earnings 6 years after entry.'),
          })
          .describe('School summary record.'),
      )
      .describe('Matching institutions.'),
  }),

  enrichment: {
    query: z
      .record(z.string(), z.unknown())
      .describe('Normalized effective selectors and pagination defaults.'),
    totalCount: z.number().describe('Total institutions matching the filters, before pagination.'),
    truncated: z
      .boolean()
      .describe('True when school pagination metadata indicates a later page exists.'),
    shown: z.number().describe('Institutions returned on this page.'),
    cap: z.number().describe('The per_page limit that was applied.'),
    notice: z
      .string()
      .optional()
      .describe(
        'Filter normalization, operating certification, pagination, or empty-result guidance.',
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
        'Check ZIP and distance filters, field names with scorecard_list_fields, or program codes with scorecard_lookup_cip before retrying.',
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
    ctx.log.info('Searching schools', { query: input.query, state: input.state, page: input.page });
    const service = getScorecardService();

    const sizeRange =
      input.size_range?.min != null && input.size_range?.max != null
        ? ([input.size_range.min, input.size_range.max] as [number, number])
        : undefined;

    const acceptanceRateRange =
      input.acceptance_rate_range?.min != null && input.acceptance_rate_range?.max != null
        ? ([input.acceptance_rate_range.min, input.acceptance_rate_range.max] as [number, number])
        : undefined;

    const options = normalizeSearchOptions({
      ...(input.query && { name: input.query }),
      ...(input.state && { state: input.state }),
      ...(input.ownership != null && { ownership: input.ownership }),
      ...(input.degree_level != null && { degreeLevel: input.degree_level }),
      ...(sizeRange && { sizeRange }),
      ...(acceptanceRateRange && { acceptanceRateRange }),
      ...(input.zip && { zip: input.zip }),
      ...(input.distance && { distance: input.distance }),
      ...(input.cip_code && { cipCode: input.cip_code }),
      ...(input.sort && { sort: input.sort }),
      ...(input.men_only != null && { menOnly: input.men_only }),
      ...(input.women_only != null && { womenOnly: input.women_only }),
      ...(input.operating != null && { operating: input.operating }),
      ...(input.hbcu != null && { hbcu: input.hbcu }),
      ...(input.locale != null && { locale: input.locale }),
      ...(input.max_net_price != null && { maxNetPrice: input.max_net_price }),
      ...(input.min_completion_rate != null && { minCompletionRate: input.min_completion_rate }),
      perPage: input.per_page,
      page: input.page,
    });
    ctx.enrich({
      query: Object.fromEntries(
        Object.entries({
          query: options.name,
          state: options.state,
          ownership: options.ownership,
          degree_level: options.degreeLevel,
          size_range: options.sizeRange && { min: options.sizeRange[0], max: options.sizeRange[1] },
          acceptance_rate_range: options.acceptanceRateRange && {
            min: options.acceptanceRateRange[0],
            max: options.acceptanceRateRange[1],
          },
          zip: options.zip,
          distance: options.distance,
          cip_code: options.cipCode,
          sort: options.sort,
          men_only: options.menOnly,
          women_only: options.womenOnly,
          operating: options.operating,
          hbcu: options.hbcu,
          locale: options.locale,
          max_net_price: options.maxNetPrice,
          min_completion_rate: options.minCompletionRate,
          page: options.page,
          per_page: options.perPage,
        }).filter(([, value]) => value !== undefined),
      ),
    });
    const response = await service.searchSchools(options, ctx);

    const schools = response.results.map((r) => ({
      ...institutionContext(r),
      ...operatingCertification(r),
      ...institutionCosts(r),
      id: r.id ?? 0,
      name: r['school.name'] ?? 'Unknown',
      ...(r['school.city'] && { city: r['school.city'] }),
      ...(r['school.state'] && { state: r['school.state'] }),
      ownership: ownershipLabel(r['school.ownership']),
      degree_level: degreeLevelLabel(r['school.degrees_awarded.predominant']),
      ...(r['latest.student.size'] != null && { enrollment: r['latest.student.size'] }),
      ...(r['latest.admissions.admission_rate.overall'] != null && {
        admission_rate: r['latest.admissions.admission_rate.overall'],
      }),
      ...(r['latest.cost.tuition.in_state'] != null && {
        tuition_in_state: r['latest.cost.tuition.in_state'],
      }),
      ...(r['latest.cost.tuition.out_of_state'] != null && {
        tuition_out_of_state: r['latest.cost.tuition.out_of_state'],
      }),
      ...(r['latest.cost.avg_net_price.overall'] != null && {
        net_price_overall: r['latest.cost.avg_net_price.overall'],
      }),
      ...(r['latest.aid.median_debt.completers.overall'] != null && {
        median_debt: r['latest.aid.median_debt.completers.overall'],
      }),
      ...(r['latest.earnings.6_yrs_after_entry.median'] != null && {
        earnings_6yr_median: r['latest.earnings.6_yrs_after_entry.median'],
      }),
    }));

    const { total, page, per_page } = response.metadata;
    const truncated = (page + 1) * per_page < total;
    ctx.enrich.total(total);
    ctx.enrich({ truncated, shown: schools.length, cap: per_page });
    const notices: string[] = [];
    if (input.max_net_price != null && input.max_net_price < 0)
      notices.push('max_net_price was negative and was normalized to 0.');
    const certificationNotice = operatingCertificationNotice(schools);
    if (certificationNotice) notices.push(certificationNotice);
    if (schools.length === 0) {
      notices.push(
        total > 0
          ? `This school page is exhausted. Valid page range: 0–${Math.ceil(total / per_page) - 1}.`
          : 'No schools matched the applied filters. Try removing a selector or widening a range.',
      );
    } else if (truncated) {
      notices.push(
        `More schools match the filters. Request page ${page + 1} or raise per_page (max 100) for more.`,
      );
    }
    if (notices.length) ctx.enrich.notice(notices.join(' '));

    ctx.log.info('School search complete', {
      total: response.metadata.total,
      returned: schools.length,
    });

    return {
      total: response.metadata.total,
      page: response.metadata.page,
      per_page: response.metadata.per_page,
      schools,
    };
  },

  format: (result) => {
    const lines = [
      `## School Search Results`,
      `**Total Matches:** ${result.total} | **Page:** ${result.page} | **Per Page:** ${result.per_page}`,
    ];
    for (const s of result.schools) {
      lines.push(`\n### School ${s.id}\n${escapeMarkdownInline(s.name)}`);
      if (s.operating != null) lines.push(formatOperatingCertification(s.operating));
      if (s.ope6_id != null) lines.push(`OPEID6: ${escapeMarkdownInline(s.ope6_id)}`);
      if (s.metric_scope) lines.push(`Metric scope: ${JSON.stringify(s.metric_scope)}`);
      if (s.effective_tuition != null)
        lines.push(
          `Effective tuition: $${s.effective_tuition.toLocaleString()} (basis: ${s.tuition_basis})`,
        );
      if (s.tuition_program_year != null)
        lines.push(`Program-year tuition: $${s.tuition_program_year.toLocaleString()}`);
      if (s.cost_of_attendance != null)
        lines.push(
          `Cost of attendance: $${s.cost_of_attendance.toLocaleString()} (basis: ${s.attendance_basis})`,
        );
      if (s.attendance_program_year != null)
        lines.push(`Program-year attendance: $${s.attendance_program_year.toLocaleString()}`);
      const loc = [s.city, s.state].filter(Boolean).join(', ');
      if (loc) lines.push(`**Location:** ${escapeMarkdownInline(loc)}`);
      lines.push(`**Type:** ${s.ownership} | **Degree:** ${s.degree_level}`);
      if (s.enrollment != null) lines.push(`**Enrollment:** ${s.enrollment.toLocaleString()}`);
      if (s.admission_rate != null)
        lines.push(`**Acceptance Rate:** ${(s.admission_rate * 100).toFixed(1)}%`);
      if (s.tuition_in_state != null)
        lines.push(`**In-State Tuition:** $${s.tuition_in_state.toLocaleString()}`);
      if (s.tuition_out_of_state != null)
        lines.push(`**Out-of-State Tuition:** $${s.tuition_out_of_state.toLocaleString()}`);
      if (s.net_price_overall != null)
        lines.push(`**Avg Net Price:** $${s.net_price_overall.toLocaleString()}`);
      if (s.median_debt != null) lines.push(`**Median Debt:** $${s.median_debt.toLocaleString()}`);
      if (s.earnings_6yr_median != null)
        lines.push(`**6-Yr Median Earnings:** $${s.earnings_6yr_median.toLocaleString()}`);
    }
    return [{ type: 'text', text: lines.join('\n') }];
  },
});
