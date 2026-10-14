/**
 * @fileoverview School profile tool. Fetches full institutional profiles for one or more
 * school IDs — costs, admissions, outcomes, aid, and completion rates.
 * @module mcp-server/tools/definitions/get-school.tool
 */

import { tool, z } from '@cyanheads/mcp-ts-core';
import { JsonRpcErrorCode } from '@cyanheads/mcp-ts-core/errors';
import { degreeLevelLabel, ownershipLabel } from '@/mcp-server/format-helpers.js';
import {
  meaningfulText,
  normalizeSchoolId,
  SchoolIdSchema,
  SchoolIdStringSchema,
} from '@/services/scorecard/input-normalization.js';
import { getScorecardService } from '@/services/scorecard/scorecard-service.js';
import type { RawSchoolRecord } from '@/services/scorecard/types.js';

function fmt(n: number | null | undefined, prefix = ''): string {
  if (n == null) return 'Not available';
  return `${prefix}${n.toLocaleString()}`;
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return 'Not available';
  return `${(n * 100).toFixed(1)}%`;
}

/** Resolve flattened provider keys and program leaves returned inside nested arrays. */
function selectedValue(value: unknown, path: string): { key: string; value: unknown } | undefined {
  if (Array.isArray(value)) {
    return value.length === 0 || value.some((item) => selectedValue(item, path))
      ? { key: path, value }
      : undefined;
  }
  if (value === null || typeof value !== 'object') return undefined;
  for (let end = path.length; end > 0; end = path.lastIndexOf('.', end - 1)) {
    const key = path.slice(0, end);
    if (Object.hasOwn(value, key)) {
      const child = (value as Record<string, unknown>)[key];
      return end === path.length || selectedValue(child, path.slice(end + 1))
        ? { key, value: child }
        : undefined;
    }
  }
  return undefined;
}

/**
 * Net price by income is reported under ownership-specific paths
 * (`net_price.public.*` for public schools, `net_price.private.*` for private).
 * Both sets are requested per school; the API returns null for the inapplicable
 * one, so coalesce public → private to get the bracket value for either type.
 */
function netPriceBracket(
  record: RawSchoolRecord,
  bracket: '0-30000' | '30001-48000' | '48001-75000' | '75001-110000' | '110001-plus',
): number | undefined {
  return (
    (record[`latest.cost.net_price.public.by_income_level.${bracket}`] as number | null) ??
    (record[`latest.cost.net_price.private.by_income_level.${bracket}`] as number | null) ??
    undefined
  );
}

const SchoolProfileSchema = z.object({
  id: z.number().describe('Unit ID.'),
  name: z.string().describe('Institution name.'),
  city: z.string().optional().describe('City.'),
  state: z.string().optional().describe('State code.'),
  zip: z.string().optional().describe('ZIP code.'),
  url: z.string().optional().describe('Institution website.'),
  ownership: z
    .string()
    .optional()
    .describe('Control type: Public, Private nonprofit, or For-profit.'),
  degree_level: z.string().optional().describe('Predominant degree awarded.'),
  selected_fields: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      'Requested JSON values, including null; nested program leaves retain the provider parent subtree and array positions.',
    ),
  absent_fields: z
    .array(z.string())
    .optional()
    .describe('Requested paths absent from this provider response; not proof of invalid syntax.'),
  hbcu: z.boolean().optional().describe('Historically Black College or University.'),
  men_only: z
    .boolean()
    .optional()
    .describe('Whether the institution is men-only. Absent when unknown.'),
  women_only: z
    .boolean()
    .optional()
    .describe('Whether the institution is women-only. Absent when unknown.'),
  enrollment: z.number().optional().describe('Undergraduate enrollment.'),
  // Admissions
  admission_rate: z.number().optional().describe('Overall admission rate (0–1).'),
  sat_average: z.number().optional().describe('Average SAT score.'),
  sat_reading_25: z.number().optional().describe('SAT Critical Reading 25th percentile.'),
  sat_reading_75: z.number().optional().describe('SAT Critical Reading 75th percentile.'),
  sat_math_25: z.number().optional().describe('SAT Math 25th percentile.'),
  sat_math_75: z.number().optional().describe('SAT Math 75th percentile.'),
  act_cumulative_25: z.number().optional().describe('ACT composite 25th percentile.'),
  act_cumulative_75: z.number().optional().describe('ACT composite 75th percentile.'),
  // Cost
  tuition_in_state: z.number().optional().describe('In-state tuition and fees.'),
  tuition_out_of_state: z.number().optional().describe('Out-of-state tuition and fees.'),
  net_price_overall: z.number().optional().describe('Average net price (all income levels).'),
  net_price_0_30k: z.number().optional().describe('Net price for family income $0–$30,000.'),
  net_price_30k_48k: z.number().optional().describe('Net price for family income $30,001–$48,000.'),
  net_price_48k_75k: z.number().optional().describe('Net price for family income $48,001–$75,000.'),
  net_price_75k_110k: z
    .number()
    .optional()
    .describe('Net price for family income $75,001–$110,000.'),
  net_price_110k_plus: z.number().optional().describe('Net price for family income $110,001+.'),
  cost_of_attendance: z.number().optional().describe('Total cost of attendance per year.'),
  // Aid
  median_debt: z.number().optional().describe('Median debt at graduation (completers).'),
  pell_grant_rate: z.number().optional().describe('Share of students receiving Pell grants (0–1).'),
  federal_loan_rate: z
    .number()
    .optional()
    .describe('Share of students receiving federal loans (0–1).'),
  repayment_progress_3yr: z
    .number()
    .optional()
    .describe(
      'Share of borrowers paying down principal (declining loan balance) 3 years after entering repayment (0–1).',
    ),
  // Completion
  completion_rate: z.number().optional().describe('Completion rate at 150% normal time.'),
  // Earnings
  earnings_6yr_median: z.number().optional().describe('Median earnings 6 years after entry.'),
  earnings_6yr_p25: z.number().optional().describe('25th percentile earnings 6 years after entry.'),
  earnings_6yr_p75: z.number().optional().describe('75th percentile earnings 6 years after entry.'),
  earnings_8yr_median: z.number().optional().describe('Median earnings 8 years after entry.'),
  earnings_10yr_median: z.number().optional().describe('Median earnings 10 years after entry.'),
  earnings_10yr_p25: z
    .number()
    .optional()
    .describe('25th percentile earnings 10 years after entry.'),
  earnings_10yr_p75: z
    .number()
    .optional()
    .describe('75th percentile earnings 10 years after entry.'),
});

export const getSchoolTool = tool('scorecard_get_school', {
  title: 'Get School Profile',
  description:
    'Institutional profiles for one or more school IDs. Accepts up to 1,000 elements, deduplicates normalized IDs, serves the first 100 distinct IDs, and reports missing and unprocessed IDs separately. Use scorecard_compare_schools for comparisons. Custom fields return requested paths and their JSON values in selected_fields, absent paths in absent_fields, and real identity; default profiles include costs, admissions, outcomes, aid, and completion rates.',
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },

  input: z.object({
    id: z
      .union([
        SchoolIdStringSchema,
        z
          .number()
          .int()
          .positive()
          .max(Number.MAX_SAFE_INTEGER)
          .describe('Positive safe integer school ID.'),
        z
          .array(SchoolIdSchema)
          .max(1000)
          .describe(
            'Up to 1,000 elements; first 100 distinct IDs served, excess reported separately.',
          ),
      ])
      .describe(
        'Positive safe integer school ID or up to 1,000 raw elements. First 100 distinct normalized IDs served; discover IDs with scorecard_search_schools.',
      ),
    fields: z
      .string()
      .optional()
      .describe(
        'Optional comma-separated list of custom field paths from scorecard_list_fields. Overrides the default field set.',
      ),
  }),

  output: z.object({
    schools: z
      .array(SchoolProfileSchema.describe('Full institutional profile.'))
      .describe('Full profiles for the requested school(s).'),
    total_requested: z.number().describe('Number of IDs requested.'),
    total_found: z.number().describe('Number of records returned.'),
    missing_ids: z
      .array(z.number())
      .optional()
      .describe('Processed distinct IDs with no returned record.'),
    unprocessed_ids: z
      .array(z.number())
      .optional()
      .describe('Distinct IDs beyond the 100-ID serving cap, in caller order.'),
  }),

  enrichment: {
    notice: z.string().optional().describe('Warning when some requested IDs returned no record.'),
  },

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
      reason: 'not_found',
      code: JsonRpcErrorCode.NotFound,
      when: 'None of the requested school IDs returned a record.',
      recovery: 'Verify the unit IDs using scorecard_search_schools and retry with valid IDs.',
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
    const ids = [
      ...new Set((Array.isArray(input.id) ? input.id : [input.id]).map(normalizeSchoolId)),
    ];
    const processed = ids.slice(0, 100);
    const unprocessed_ids = ids.slice(100);
    const selected = meaningfulText(input.fields)
      ?.split(',')
      .map((field) => field.trim())
      .filter(Boolean);
    ctx.log.info('Fetching school profiles', { ids: ids.slice(0, 5), count: ids.length });
    const service = getScorecardService();

    const response = await service.getSchoolProfiles(processed, input.fields, ctx);
    const found = new Set(response.results.map((record) => record.id));
    const missing_ids = processed.filter((id) => !found.has(id));

    if (response.results.length === 0) {
      throw ctx.fail(
        'not_found',
        `No records found for ${processed.length} processed IDs. Unprocessed IDs: ${unprocessed_ids.join(', ') || 'None'}.`,
        {
          ids,
          missing_ids,
          unprocessed_ids,
          recovery: {
            hint: `Search for valid school IDs using scorecard_search_schools first.${unprocessed_ids.length ? ' Request the unprocessed IDs separately; they have not been checked.' : ''}`,
          },
        },
      );
    }

    const schools = response.results.map(
      (r): z.infer<typeof SchoolProfileSchema> =>
        selected?.length
          ? {
              id: z.number().parse(r.id),
              name: z.string().parse(r['school.name']),
              selected_fields: Object.fromEntries(
                selected.flatMap((path) => {
                  const match = selectedValue(r, path);
                  return match ? [[match.key, match.value]] : [];
                }),
              ),
              absent_fields: selected.filter((path) => !selectedValue(r, path)),
            }
          : {
              id: r.id ?? 0,
              name: r['school.name'] ?? 'Unknown',
              ownership: ownershipLabel(r['school.ownership']),
              degree_level: degreeLevelLabel(r['school.degrees_awarded.predominant']),
              ...(r['school.city'] && { city: r['school.city'] }),
              ...(r['school.state'] && { state: r['school.state'] }),
              ...(r['school.zip'] && { zip: r['school.zip'] }),
              ...(r['school.school_url'] && { url: r['school.school_url'] }),
              ...(r['school.minority_serving.historically_black'] != null && {
                hbcu: r['school.minority_serving.historically_black'] === 1,
              }),
              ...(r['school.men_only'] != null && { men_only: r['school.men_only'] === 1 }),
              ...(r['school.women_only'] != null && { women_only: r['school.women_only'] === 1 }),
              ...(r['latest.student.size'] != null && { enrollment: r['latest.student.size'] }),
              ...(r['latest.admissions.admission_rate.overall'] != null && {
                admission_rate: r['latest.admissions.admission_rate.overall'],
              }),
              ...(r['latest.admissions.sat_scores.average.overall'] != null && {
                sat_average: r['latest.admissions.sat_scores.average.overall'],
              }),
              ...(r['latest.admissions.sat_scores.25th_percentile.critical_reading'] != null && {
                sat_reading_25: r['latest.admissions.sat_scores.25th_percentile.critical_reading'],
              }),
              ...(r['latest.admissions.sat_scores.75th_percentile.critical_reading'] != null && {
                sat_reading_75: r['latest.admissions.sat_scores.75th_percentile.critical_reading'],
              }),
              ...(r['latest.admissions.sat_scores.25th_percentile.math'] != null && {
                sat_math_25: r['latest.admissions.sat_scores.25th_percentile.math'],
              }),
              ...(r['latest.admissions.sat_scores.75th_percentile.math'] != null && {
                sat_math_75: r['latest.admissions.sat_scores.75th_percentile.math'],
              }),
              ...(r['latest.admissions.act_scores.25th_percentile.cumulative'] != null && {
                act_cumulative_25: r['latest.admissions.act_scores.25th_percentile.cumulative'],
              }),
              ...(r['latest.admissions.act_scores.75th_percentile.cumulative'] != null && {
                act_cumulative_75: r['latest.admissions.act_scores.75th_percentile.cumulative'],
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
              ...(netPriceBracket(r, '0-30000') != null && {
                net_price_0_30k: netPriceBracket(r, '0-30000'),
              }),
              ...(netPriceBracket(r, '30001-48000') != null && {
                net_price_30k_48k: netPriceBracket(r, '30001-48000'),
              }),
              ...(netPriceBracket(r, '48001-75000') != null && {
                net_price_48k_75k: netPriceBracket(r, '48001-75000'),
              }),
              ...(netPriceBracket(r, '75001-110000') != null && {
                net_price_75k_110k: netPriceBracket(r, '75001-110000'),
              }),
              ...(netPriceBracket(r, '110001-plus') != null && {
                net_price_110k_plus: netPriceBracket(r, '110001-plus'),
              }),
              ...(r['latest.cost.attendance.academic_year'] != null && {
                cost_of_attendance: r['latest.cost.attendance.academic_year'],
              }),
              ...(r['latest.aid.median_debt.completers.overall'] != null && {
                median_debt: r['latest.aid.median_debt.completers.overall'],
              }),
              ...(r['latest.aid.pell_grant_rate'] != null && {
                pell_grant_rate: r['latest.aid.pell_grant_rate'],
              }),
              ...(r['latest.aid.federal_loan_rate'] != null && {
                federal_loan_rate: r['latest.aid.federal_loan_rate'],
              }),
              ...(r['latest.repayment.repayment_cohort.3_year_declining_balance'] != null && {
                repayment_progress_3yr:
                  r['latest.repayment.repayment_cohort.3_year_declining_balance'],
              }),
              ...(r['latest.completion.rate_suppressed.overall'] != null && {
                completion_rate: r['latest.completion.rate_suppressed.overall'],
              }),
              ...(r['latest.earnings.6_yrs_after_entry.median'] != null && {
                earnings_6yr_median: r['latest.earnings.6_yrs_after_entry.median'],
              }),
              ...(r[
                'latest.earnings.6_yrs_after_entry.working_not_enrolled.earnings_percentile.25'
              ] != null && {
                earnings_6yr_p25:
                  r[
                    'latest.earnings.6_yrs_after_entry.working_not_enrolled.earnings_percentile.25'
                  ],
              }),
              ...(r[
                'latest.earnings.6_yrs_after_entry.working_not_enrolled.earnings_percentile.75'
              ] != null && {
                earnings_6yr_p75:
                  r[
                    'latest.earnings.6_yrs_after_entry.working_not_enrolled.earnings_percentile.75'
                  ],
              }),
              ...(r['latest.earnings.8_yrs_after_entry.median_earnings'] != null && {
                earnings_8yr_median: r['latest.earnings.8_yrs_after_entry.median_earnings'],
              }),
              ...(r['latest.earnings.10_yrs_after_entry.median'] != null && {
                earnings_10yr_median: r['latest.earnings.10_yrs_after_entry.median'],
              }),
              ...(r[
                'latest.earnings.10_yrs_after_entry.working_not_enrolled.earnings_percentile.25'
              ] != null && {
                earnings_10yr_p25:
                  r[
                    'latest.earnings.10_yrs_after_entry.working_not_enrolled.earnings_percentile.25'
                  ],
              }),
              ...(r[
                'latest.earnings.10_yrs_after_entry.working_not_enrolled.earnings_percentile.75'
              ] != null && {
                earnings_10yr_p75:
                  r[
                    'latest.earnings.10_yrs_after_entry.working_not_enrolled.earnings_percentile.75'
                  ],
              }),
            },
    );

    if (missing_ids.length || unprocessed_ids.length) {
      ctx.enrich.notice(
        `${missing_ids.length} processed IDs returned no record. ${unprocessed_ids.length} IDs were unprocessed; request those IDs in another batch of at most 100 distinct IDs.`,
      );
    }

    return {
      schools,
      total_requested: ids.length,
      total_found: schools.length,
      missing_ids,
      unprocessed_ids,
    };
  },

  format: (result) => {
    const lines = [
      `## School Profile${result.schools.length > 1 ? 's' : ''}`,
      `**Requested:** ${result.total_requested} | **Found:** ${result.total_found}`,
    ];
    if (result.missing_ids)
      lines.push(`**Missing IDs:** ${result.missing_ids.join(', ') || 'None'}`);
    if (result.unprocessed_ids)
      lines.push(`**Unprocessed IDs:** ${result.unprocessed_ids.join(', ') || 'None'}`);
    for (const s of result.schools) {
      lines.push(`\n---\n### ${s.name} (ID: ${s.id})`);
      if (s.selected_fields) {
        lines.push('**Selected fields:**');
        for (const [path, value] of Object.entries(s.selected_fields))
          lines.push(`**${path}:** ${JSON.stringify(value)}`);
        lines.push(
          `**Absent requested paths:** ${s.absent_fields?.join(', ') || 'None'} (absent from this response)`,
        );
      }
      if (s.ownership !== undefined) {
        const loc = [s.city, s.state].filter(Boolean).join(', ');
        if (loc) lines.push(`**Location:** ${loc}${s.zip ? ` ${s.zip}` : ''}`);
        if (s.url) lines.push(`**Website:** ${s.url}`);
        lines.push(`**Type:** ${s.ownership} | **Degree:** ${s.degree_level}`);
        lines.push(`**HBCU:** ${s.hbcu == null ? 'Unknown' : s.hbcu ? 'Yes' : 'No'}`);
        if (s.men_only != null) lines.push(`**Men-only:** ${s.men_only ? 'Yes' : 'No'}`);
        if (s.women_only != null) lines.push(`**Women-only:** ${s.women_only ? 'Yes' : 'No'}`);
        if (s.enrollment != null) lines.push(`**Enrollment:** ${s.enrollment.toLocaleString()}`);

        lines.push('\n**Admissions**');
        lines.push(`Acceptance Rate: ${fmtPct(s.admission_rate)}`);
        if (s.sat_average != null) lines.push(`SAT Average: ${s.sat_average}`);
        if (s.sat_reading_25 != null)
          lines.push(`SAT Reading: ${s.sat_reading_25}–${s.sat_reading_75 ?? 'N/A'}`);
        if (s.sat_math_25 != null) lines.push(`SAT Math: ${s.sat_math_25}–${s.sat_math_75}`);
        if (s.act_cumulative_25 != null)
          lines.push(`ACT: ${s.act_cumulative_25}–${s.act_cumulative_75}`);

        lines.push('\n**Cost**');
        lines.push(`In-State Tuition: ${fmt(s.tuition_in_state, '$')}`);
        lines.push(`Out-of-State Tuition: ${fmt(s.tuition_out_of_state, '$')}`);
        lines.push(`Avg Net Price (overall): ${fmt(s.net_price_overall, '$')}`);
        if (s.net_price_0_30k != null)
          lines.push(`Net Price ($0–30k income): $${s.net_price_0_30k.toLocaleString()}`);
        if (s.net_price_30k_48k != null)
          lines.push(`Net Price ($30k–48k income): $${s.net_price_30k_48k.toLocaleString()}`);
        if (s.net_price_48k_75k != null)
          lines.push(`Net Price ($48k–75k income): $${s.net_price_48k_75k.toLocaleString()}`);
        if (s.net_price_75k_110k != null)
          lines.push(`Net Price ($75k–110k income): $${s.net_price_75k_110k.toLocaleString()}`);
        if (s.net_price_110k_plus != null)
          lines.push(`Net Price ($110k+ income): $${s.net_price_110k_plus.toLocaleString()}`);
        if (s.cost_of_attendance != null)
          lines.push(`Total Cost of Attendance: $${s.cost_of_attendance.toLocaleString()}`);

        lines.push('\n**Financial Aid**');
        lines.push(`Median Debt at Graduation: ${fmt(s.median_debt, '$')}`);
        if (s.pell_grant_rate != null) lines.push(`Pell Grant Rate: ${fmtPct(s.pell_grant_rate)}`);
        if (s.federal_loan_rate != null)
          lines.push(`Federal Loan Rate: ${fmtPct(s.federal_loan_rate)}`);
        lines.push(
          `3-Year Repayment Progress (declining balance): ${fmtPct(s.repayment_progress_3yr)}`,
        );

        lines.push('\n**Outcomes**');
        lines.push(`Completion Rate (150%): ${fmtPct(s.completion_rate)}`);
        lines.push(`Median Earnings (6yr): ${fmt(s.earnings_6yr_median, '$')}`);
        if (s.earnings_6yr_p25 != null || s.earnings_6yr_p75 != null)
          lines.push(
            `Earnings P25/P75 (6yr): ${s.earnings_6yr_p25 != null ? `$${s.earnings_6yr_p25.toLocaleString()}` : 'N/A'} / ${s.earnings_6yr_p75 != null ? `$${s.earnings_6yr_p75.toLocaleString()}` : 'N/A'}`,
          );
        lines.push(`Median Earnings (8yr): ${fmt(s.earnings_8yr_median, '$')}`);
        lines.push(`Median Earnings (10yr): ${fmt(s.earnings_10yr_median, '$')}`);
        if (s.earnings_10yr_p25 != null || s.earnings_10yr_p75 != null)
          lines.push(
            `Earnings P25/P75 (10yr): ${s.earnings_10yr_p25 != null ? `$${s.earnings_10yr_p25.toLocaleString()}` : 'N/A'} / ${s.earnings_10yr_p75 != null ? `$${s.earnings_10yr_p75.toLocaleString()}` : 'N/A'}`,
          );
      }
    }
    return [{ type: 'text', text: lines.join('\n') }];
  },
});
