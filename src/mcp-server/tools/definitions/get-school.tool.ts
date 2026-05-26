/**
 * @fileoverview School profile tool. Fetches full institutional profiles for one or more
 * school IDs — costs, admissions, outcomes, aid, and completion rates.
 * @module mcp-server/tools/definitions/get-school.tool
 */

import { tool, z } from '@cyanheads/mcp-ts-core';
import { JsonRpcErrorCode } from '@cyanheads/mcp-ts-core/errors';
import { degreeLevelLabel, ownershipLabel } from '@/mcp-server/format-helpers.js';
import { getScorecardService } from '@/services/scorecard/scorecard-service.js';

function fmt(n: number | null | undefined, prefix = ''): string {
  if (n == null) return 'Not available';
  return `${prefix}${n.toLocaleString()}`;
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return 'Not available';
  return `${(n * 100).toFixed(1)}%`;
}

const SchoolProfileSchema = z.object({
  id: z.number().describe('Unit ID.'),
  name: z.string().describe('Institution name.'),
  city: z.string().optional().describe('City.'),
  state: z.string().optional().describe('State code.'),
  zip: z.string().optional().describe('ZIP code.'),
  url: z.string().optional().describe('Institution website.'),
  ownership: z.string().describe('Control type: Public, Private nonprofit, or For-profit.'),
  degree_level: z.string().describe('Predominant degree awarded.'),
  hbcu: z.boolean().optional().describe('Historically Black College or University.'),
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
  net_price_0_30k: z
    .number()
    .optional()
    .describe('Average net price for family income $0–$30,000.'),
  net_price_30k_48k: z
    .number()
    .optional()
    .describe('Average net price for family income $30,001–$48,000.'),
  net_price_48k_75k: z
    .number()
    .optional()
    .describe('Average net price for family income $48,001–$75,000.'),
  net_price_75k_110k: z
    .number()
    .optional()
    .describe('Average net price for family income $75,001–$110,000.'),
  net_price_110k_plus: z
    .number()
    .optional()
    .describe('Average net price for family income $110,001+.'),
  cost_of_attendance: z.number().optional().describe('Total cost of attendance per year.'),
  // Aid
  median_debt: z.number().optional().describe('Median debt at graduation (completers).'),
  pell_grant_rate: z.number().optional().describe('Share of students receiving Pell grants (0–1).'),
  federal_loan_rate: z
    .number()
    .optional()
    .describe('Share of students receiving federal loans (0–1).'),
  repayment_rate_3yr: z
    .number()
    .optional()
    .describe('3-year loan repayment rate (share not in default, 0–1).'),
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
    'Full institutional profile for one or more school IDs — costs, admissions, outcomes, aid, demographics, and completion rates. Pass a single ID or an array of up to 100 IDs. For side-by-side comparison on a specific dimension (costs, admissions, outcomes, or aid) use scorecard_compare_schools. The fields parameter accepts a comma-separated list of field paths from scorecard_list_fields to override the default field set.',
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },

  input: z.object({
    id: z
      .union([
        z.string().describe('Single school unit ID as string.'),
        z.number().describe('Single school unit ID as number.'),
        z
          .array(
            z
              .union([
                z.string().describe('School unit ID as string.'),
                z.number().describe('School unit ID as number.'),
              ])
              .describe('School unit ID (string or number).'),
          )
          .describe('Array of school unit IDs (up to 100).'),
      ])
      .describe(
        'School unit ID or array of unit IDs (up to 100). IDs are integers from scorecard_search_schools.',
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
    notice: z.string().optional().describe('Warning when some requested IDs returned no record.'),
  }),

  errors: [
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
      recovery: 'Check SCORECARD_API_KEY validity and retry after a brief delay.',
    },
  ],

  async handler(input, ctx) {
    const ids = Array.isArray(input.id) ? input.id : [input.id];
    ctx.log.info('Fetching school profiles', { ids: ids.slice(0, 5), count: ids.length });
    const service = getScorecardService();

    const response = await service.getSchoolProfiles(ids, input.fields, ctx);

    if (response.results.length === 0) {
      throw ctx.fail('not_found', `No records found for ${ids.length} requested IDs.`, {
        ids,
        recovery: { hint: 'Search for valid school IDs using scorecard_search_schools first.' },
      });
    }

    const schools = response.results.map(
      (r): z.infer<typeof SchoolProfileSchema> => ({
        id: r.id ?? 0,
        name: r['school.name'] ?? 'Unknown',
        ownership: ownershipLabel(r['school.ownership']),
        degree_level: degreeLevelLabel(r['school.degrees_awarded.predominant']),
        ...(r['school.city'] && { city: r['school.city'] }),
        ...(r['school.state'] && { state: r['school.state'] }),
        ...(r['school.zip'] && { zip: r['school.zip'] }),
        ...(r['school.school_url'] && { url: r['school.school_url'] }),
        ...(r['school.hbcu'] === 1 && { hbcu: true }),
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
        ...(r['latest.cost.avg_net_price.by_income.0-30000'] != null && {
          net_price_0_30k: r['latest.cost.avg_net_price.by_income.0-30000'],
        }),
        ...(r['latest.cost.avg_net_price.by_income.30001-48000'] != null && {
          net_price_30k_48k: r['latest.cost.avg_net_price.by_income.30001-48000'],
        }),
        ...(r['latest.cost.avg_net_price.by_income.48001-75000'] != null && {
          net_price_48k_75k: r['latest.cost.avg_net_price.by_income.48001-75000'],
        }),
        ...(r['latest.cost.avg_net_price.by_income.75001-110000'] != null && {
          net_price_75k_110k: r['latest.cost.avg_net_price.by_income.75001-110000'],
        }),
        ...(r['latest.cost.avg_net_price.by_income.110001-plus'] != null && {
          net_price_110k_plus: r['latest.cost.avg_net_price.by_income.110001-plus'],
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
        ...(r['latest.repayment.3_yr_repayment.overall'] != null && {
          repayment_rate_3yr: (r['latest.repayment.3_yr_repayment.overall'] as number) / 1000,
        }),
        ...(r['latest.completion.rate_suppressed.overall'] != null && {
          completion_rate: r['latest.completion.rate_suppressed.overall'],
        }),
        ...(r['latest.earnings.6_yrs_after_entry.median'] != null && {
          earnings_6yr_median: r['latest.earnings.6_yrs_after_entry.median'],
        }),
        ...(r['latest.earnings.6_yrs_after_entry.percentile25'] != null && {
          earnings_6yr_p25: r['latest.earnings.6_yrs_after_entry.percentile25'],
        }),
        ...(r['latest.earnings.6_yrs_after_entry.percentile75'] != null && {
          earnings_6yr_p75: r['latest.earnings.6_yrs_after_entry.percentile75'],
        }),
        ...(r['latest.earnings.8_yrs_after_entry.median_earnings'] != null && {
          earnings_8yr_median: r['latest.earnings.8_yrs_after_entry.median_earnings'],
        }),
        ...(r['latest.earnings.10_yrs_after_entry.median'] != null && {
          earnings_10yr_median: r['latest.earnings.10_yrs_after_entry.median'],
        }),
        ...(r['latest.earnings.10_yrs_after_entry.percentile25'] != null && {
          earnings_10yr_p25: r['latest.earnings.10_yrs_after_entry.percentile25'],
        }),
        ...(r['latest.earnings.10_yrs_after_entry.percentile75'] != null && {
          earnings_10yr_p75: r['latest.earnings.10_yrs_after_entry.percentile75'],
        }),
      }),
    );

    const notice =
      schools.length < ids.length
        ? `${ids.length - schools.length} of ${ids.length} requested IDs returned no record — they may be invalid or no longer in the database.`
        : undefined;

    return {
      schools,
      total_requested: ids.length,
      total_found: schools.length,
      ...(notice && { notice }),
    };
  },

  format: (result) => {
    const lines = [
      `## School Profile${result.schools.length > 1 ? 's' : ''}`,
      `**Requested:** ${result.total_requested} | **Found:** ${result.total_found}`,
    ];
    if (result.notice) lines.push(`\n> **Note:** ${result.notice}`);
    for (const s of result.schools) {
      lines.push(`\n---\n### ${s.name} (ID: ${s.id})`);
      const loc = [s.city, s.state].filter(Boolean).join(', ');
      if (loc) lines.push(`**Location:** ${loc}${s.zip ? ` ${s.zip}` : ''}`);
      if (s.url) lines.push(`**Website:** ${s.url}`);
      lines.push(`**Type:** ${s.ownership} | **Degree:** ${s.degree_level}`);
      if (s.hbcu) lines.push(`**HBCU:** Yes`);
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
      lines.push(`3-Year Repayment Rate: ${fmtPct(s.repayment_rate_3yr)}`);

      lines.push('\n**Outcomes**');
      lines.push(`Completion Rate (150%): ${fmtPct(s.completion_rate)}`);
      lines.push(`Median Earnings (6yr): ${fmt(s.earnings_6yr_median, '$')}`);
      if (s.earnings_6yr_p25 != null)
        lines.push(
          `Earnings P25/P75 (6yr): $${s.earnings_6yr_p25.toLocaleString()} / $${s.earnings_6yr_p75?.toLocaleString() ?? 'N/A'}`,
        );
      lines.push(`Median Earnings (8yr): ${fmt(s.earnings_8yr_median, '$')}`);
      lines.push(`Median Earnings (10yr): ${fmt(s.earnings_10yr_median, '$')}`);
      if (s.earnings_10yr_p25 != null)
        lines.push(
          `Earnings P25/P75 (10yr): $${s.earnings_10yr_p25.toLocaleString()} / $${s.earnings_10yr_p75?.toLocaleString() ?? 'N/A'}`,
        );
    }
    return [{ type: 'text', text: lines.join('\n') }];
  },
});
