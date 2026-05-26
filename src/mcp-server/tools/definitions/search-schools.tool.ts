/**
 * @fileoverview School search tool. Searches and filters institutions by name, location,
 * type, size, and acceptance rate range.
 * @module mcp-server/tools/definitions/search-schools.tool
 */

import { tool, z } from '@cyanheads/mcp-ts-core';
import { JsonRpcErrorCode } from '@cyanheads/mcp-ts-core/errors';
import { degreeLevelLabel, ownershipLabel } from '@/mcp-server/format-helpers.js';
import { getScorecardService } from '@/services/scorecard/scorecard-service.js';

export const searchSchoolsTool = tool('scorecard_search_schools', {
  title: 'Search Schools',
  description:
    'Search and filter U.S. colleges and universities by name, location, type, size, and acceptance rate. Returns a list with core identity and cost metrics for each match. For a full institutional profile use scorecard_get_school; for cross-institution program rankings use scorecard_search_programs. Geographic filtering requires a U.S. zip code and a distance string (e.g. "50mi"). State filter uses two-letter codes (e.g. "WA", "CA"). Ownership: 1=public, 2=private nonprofit, 3=for-profit. Degree level: 0=non-degree, 1=certificate, 2=associate, 3=bachelor, 4=graduate.',
  annotations: { readOnlyHint: true, openWorldHint: true },

  input: z.object({
    query: z
      .string()
      .optional()
      .describe('School name search — partial or full name; all words must appear.'),
    state: z
      .string()
      .length(2)
      .optional()
      .describe('Filter to schools in this state (two-letter code, e.g. "WA").'),
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
        'Predominant degree: 0=non-degree/certificate, 1=certificate, 2=associate, 3=bachelor, 4=graduate.',
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
      .describe('U.S. zip code for geographic center. Requires distance to be set.'),
    distance: z
      .string()
      .optional()
      .describe('Search radius around zip (e.g. "25mi", "50km"). Requires zip to be set.'),
    cip_code: z
      .string()
      .optional()
      .describe(
        'Filter to schools offering this CIP 4-digit program code (e.g. "11.07"). Use scorecard_lookup_cip to find codes.',
      ),
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
    notice: z
      .string()
      .optional()
      .describe(
        'Recovery hint when results are empty — echoes applied filters and suggests how to broaden. Absent when results exist.',
      ),
  }),

  errors: [
    {
      reason: 'no_results',
      code: JsonRpcErrorCode.NotFound,
      when: 'No institutions matched the provided filters.',
      recovery:
        'Broaden the search by removing filters or widening size and acceptance rate ranges.',
    },
    {
      reason: 'api_error',
      code: JsonRpcErrorCode.ServiceUnavailable,
      when: 'The College Scorecard API returned an error.',
      recovery: 'Check SCORECARD_API_KEY validity and retry after a brief delay.',
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

    const response = await service.searchSchools(
      {
        ...(input.query && { name: input.query }),
        ...(input.state && { state: input.state }),
        ...(input.ownership != null && { ownership: input.ownership }),
        ...(input.degree_level != null && { degreeLevel: input.degree_level }),
        ...(sizeRange && { sizeRange }),
        ...(acceptanceRateRange && { acceptanceRateRange }),
        ...(input.zip && { zip: input.zip }),
        ...(input.distance && { distance: input.distance }),
        ...(input.cip_code && { cipCode: input.cip_code }),
        perPage: input.per_page,
        page: input.page,
      },
      ctx,
    );

    const schools = response.results.map((r) => ({
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

    const notice =
      schools.length === 0
        ? `No schools matched the applied filters. Try removing state, size, or acceptance rate filters.`
        : undefined;

    ctx.log.info('School search complete', {
      total: response.metadata.total,
      returned: schools.length,
    });

    return {
      total: response.metadata.total,
      page: response.metadata.page,
      per_page: response.metadata.per_page,
      schools,
      ...(notice && { notice }),
    };
  },

  format: (result) => {
    const lines = [
      `## School Search Results`,
      `**Total Matches:** ${result.total} | **Page:** ${result.page} | **Per Page:** ${result.per_page}`,
    ];
    if (result.notice) lines.push(`\n> ${result.notice}`);
    for (const s of result.schools) {
      lines.push(`\n### ${s.name} (ID: ${s.id})`);
      const loc = [s.city, s.state].filter(Boolean).join(', ');
      if (loc) lines.push(`**Location:** ${loc}`);
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
