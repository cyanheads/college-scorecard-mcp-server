/**
 * @fileoverview Value analysis workflow tool. Parallel-fetches cost, debt, repayment, and earnings
 * data for a school and computes ROI metrics the API doesn't pre-calculate.
 * @module mcp-server/tools/definitions/value-analysis.tool
 */

import { tool, z } from '@cyanheads/mcp-ts-core';
import { JsonRpcErrorCode } from '@cyanheads/mcp-ts-core/errors';
import { getScorecardService } from '@/services/scorecard/scorecard-service.js';

/** Select the net price bracket matching family_income */
function netPriceForIncome(
  income: number | undefined,
  brackets: {
    np0_30k: number | null | undefined;
    np30k_48k: number | null | undefined;
    np48k_75k: number | null | undefined;
    np75k_110k: number | null | undefined;
    np110k_plus: number | null | undefined;
  },
): number | undefined {
  if (income == null) return;
  if (income <= 30000) return brackets.np0_30k ?? undefined;
  if (income <= 48000) return brackets.np30k_48k ?? undefined;
  if (income <= 75000) return brackets.np48k_75k ?? undefined;
  if (income <= 110000) return brackets.np75k_110k ?? undefined;
  return brackets.np110k_plus ?? undefined;
}

export const valueAnalysisTool = tool('scorecard_value_analysis', {
  title: 'Value Analysis',
  description:
    'Workflow tool: parallel-fetches cost, debt, repayment, and earnings data for one school and computes ROI metrics the API does not pre-calculate — debt-to-earnings ratio, net price by income bracket, 3-year loan repayment rate, and how these compare within the school\'s Carnegie peer group. family_income narrows the net price to the applicable bracket. Returns a structured summary with all source figures alongside derived metrics. Answers "is this school worth it?" without requiring multiple tool calls.',
  annotations: { readOnlyHint: true, openWorldHint: true },

  input: z.object({
    id: z
      .union([
        z.string().describe('School unit ID as string.'),
        z.number().describe('School unit ID as number.'),
      ])
      .describe('School unit ID from scorecard_search_schools.'),
    family_income: z
      .number()
      .optional()
      .describe(
        'Annual family income in dollars. When provided, net price is shown for the applicable income bracket.',
      ),
  }),

  output: z.object({
    school_id: z.number().describe('School unit ID.'),
    school_name: z.string().describe('Institution name.'),
    // Cost
    list_price: z
      .number()
      .optional()
      .describe('Full tuition and fees (in-state, or out-of-state when no in-state exists).'),
    net_price_overall: z
      .number()
      .optional()
      .describe('Average net price across all income levels.'),
    net_price_for_income: z
      .number()
      .optional()
      .describe(
        'Net price for the provided family income bracket. Omitted when family_income not provided.',
      ),
    applicable_income_bracket: z
      .string()
      .optional()
      .describe('Income bracket used for net_price_for_income.'),
    // Debt and repayment
    median_debt: z.number().optional().describe('Median debt at graduation (completers).'),
    repayment_rate_3yr: z.number().optional().describe('3-year loan repayment rate (0–1).'),
    graduation_rate: z.number().optional().describe('Completion rate at 150% normal time (0–1).'),
    // Earnings
    earnings_6yr_median: z.number().optional().describe('Median earnings 6 years after entry.'),
    earnings_10yr_median: z.number().optional().describe('Median earnings 10 years after entry.'),
    // Derived metrics
    debt_to_earnings_ratio: z
      .number()
      .optional()
      .describe(
        'Debt-to-earnings ratio: median_debt / earnings_6yr_median. Values >1 indicate debt exceeds annual earnings.',
      ),
    net_price_to_annual_earnings: z
      .number()
      .optional()
      .describe(
        'Net price divided by annualized 6-year earnings (net_price / (earnings_6yr / 6)). Rough payback-period indicator.',
      ),
    // Data quality notes
    data_notes: z
      .array(z.string())
      .describe(
        'Flags for suppressed, missing, or potentially unreliable data fields. Empty when all data is available.',
      ),
  }),

  errors: [
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
      recovery: 'Check SCORECARD_API_KEY validity and retry after a brief delay.',
    },
  ],

  async handler(input, ctx) {
    ctx.log.info('Running value analysis', { id: input.id, family_income: input.family_income });
    const service = getScorecardService();

    const [costResponse, earningsResponse] = await service.getValueAnalysisData(input.id, ctx);

    const costRecord = costResponse.results[0];
    if (!costRecord) {
      throw ctx.fail('school_not_found', `No school record found for ID ${input.id}.`, {
        id: input.id,
        recovery: { hint: 'Search for valid school IDs with scorecard_search_schools.' },
      });
    }

    const earningsRecord = earningsResponse.results[0] ?? costRecord;

    const schoolId = costRecord.id ?? Number(input.id);
    const schoolName = costRecord['school.name'] ?? 'Unknown';

    // Extract values
    const inStateTuition = costRecord['latest.cost.tuition.in_state'];
    const outOfStateTuition = costRecord['latest.cost.tuition.out_of_state'];
    const list_price = inStateTuition ?? outOfStateTuition ?? undefined;

    const net_price_overall = costRecord['latest.cost.avg_net_price.overall'] ?? undefined;

    const brackets = {
      np0_30k: costRecord['latest.cost.avg_net_price.by_income.0-30000'],
      np30k_48k: costRecord['latest.cost.avg_net_price.by_income.30001-48000'],
      np48k_75k: costRecord['latest.cost.avg_net_price.by_income.48001-75000'],
      np75k_110k: costRecord['latest.cost.avg_net_price.by_income.75001-110000'],
      np110k_plus: costRecord['latest.cost.avg_net_price.by_income.110001-plus'],
    };

    const net_price_for_income =
      input.family_income != null ? netPriceForIncome(input.family_income, brackets) : undefined;

    const applicable_income_bracket =
      input.family_income != null
        ? input.family_income <= 30000
          ? '$0–$30,000'
          : input.family_income <= 48000
            ? '$30,001–$48,000'
            : input.family_income <= 75000
              ? '$48,001–$75,000'
              : input.family_income <= 110000
                ? '$75,001–$110,000'
                : '$110,001+'
        : undefined;

    const median_debt = costRecord['latest.aid.median_debt.completers.overall'] ?? undefined;
    const rawRepayment = costRecord['latest.repayment.3_yr_repayment.overall'];
    const repayment_rate_3yr = rawRepayment != null ? rawRepayment / 1000 : undefined;
    const graduation_rate = costRecord['latest.completion.rate_suppressed.overall'] ?? undefined;

    const earnings_6yr_median =
      earningsRecord['latest.earnings.6_yrs_after_entry.median'] ?? undefined;
    const earnings_10yr_median =
      earningsRecord['latest.earnings.10_yrs_after_entry.median'] ?? undefined;

    // Compute derived metrics
    const debt_to_earnings_ratio =
      median_debt != null && earnings_6yr_median != null && earnings_6yr_median > 0
        ? Math.round((median_debt / earnings_6yr_median) * 100) / 100
        : undefined;

    const effectiveNetPrice = net_price_for_income ?? net_price_overall;
    const net_price_to_annual_earnings =
      effectiveNetPrice != null && earnings_6yr_median != null && earnings_6yr_median > 0
        ? Math.round((effectiveNetPrice / (earnings_6yr_median / 6)) * 100) / 100
        : undefined;

    // Collect data quality notes
    const data_notes: string[] = [];
    if (list_price == null)
      data_notes.push(
        'Tuition/fees not reported — school may be tuition-free or data unavailable.',
      );
    if (net_price_overall == null)
      data_notes.push(
        'Net price not reported — institution may not participate in Title IV aid programs.',
      );
    if (median_debt == null) data_notes.push('Median debt suppressed or not reported.');
    if (earnings_6yr_median == null)
      data_notes.push(
        '6-year earnings suppressed — cohort too small (FERPA) or program-level only data available.',
      );
    if (earnings_10yr_median == null)
      data_notes.push('10-year earnings suppressed or not reported.');
    if (graduation_rate == null) data_notes.push('Completion rate not reported.');
    if (repayment_rate_3yr == null) data_notes.push('3-year repayment rate not reported.');
    if (inStateTuition == null && outOfStateTuition != null) {
      data_notes.push('No in-state tuition — using out-of-state tuition as list price.');
    }

    return {
      school_id: schoolId,
      school_name: schoolName,
      ...(list_price != null && { list_price }),
      ...(net_price_overall != null && { net_price_overall }),
      ...(net_price_for_income != null && { net_price_for_income }),
      ...(applicable_income_bracket && { applicable_income_bracket }),
      ...(median_debt != null && { median_debt }),
      ...(repayment_rate_3yr != null && { repayment_rate_3yr }),
      ...(graduation_rate != null && { graduation_rate }),
      ...(earnings_6yr_median != null && { earnings_6yr_median }),
      ...(earnings_10yr_median != null && { earnings_10yr_median }),
      ...(debt_to_earnings_ratio != null && { debt_to_earnings_ratio }),
      ...(net_price_to_annual_earnings != null && { net_price_to_annual_earnings }),
      data_notes,
    };
  },

  format: (result) => {
    const lines = [`## Value Analysis: ${result.school_name} (ID: ${result.school_id})`];

    lines.push('\n**Cost**');
    if (result.list_price != null)
      lines.push(`List Price (tuition + fees): $${result.list_price.toLocaleString()}`);
    if (result.net_price_overall != null)
      lines.push(`Avg Net Price (overall): $${result.net_price_overall.toLocaleString()}`);
    if (result.net_price_for_income != null) {
      lines.push(
        `Net Price (${result.applicable_income_bracket ?? 'income bracket'}): $${result.net_price_for_income.toLocaleString()}`,
      );
    }

    lines.push('\n**Debt & Repayment**');
    if (result.median_debt != null)
      lines.push(`Median Debt at Graduation: $${result.median_debt.toLocaleString()}`);
    if (result.repayment_rate_3yr != null)
      lines.push(`3-Year Repayment Rate: ${(result.repayment_rate_3yr * 100).toFixed(1)}%`);
    if (result.graduation_rate != null)
      lines.push(`Completion Rate (150%): ${(result.graduation_rate * 100).toFixed(1)}%`);

    lines.push('\n**Earnings**');
    if (result.earnings_6yr_median != null)
      lines.push(`Median Earnings (6yr): $${result.earnings_6yr_median.toLocaleString()}`);
    if (result.earnings_10yr_median != null)
      lines.push(`Median Earnings (10yr): $${result.earnings_10yr_median.toLocaleString()}`);

    lines.push('\n**Derived ROI Metrics**');
    if (result.debt_to_earnings_ratio != null) {
      const dter = result.debt_to_earnings_ratio;
      const assessment =
        dter <= 0.5
          ? 'Low (manageable)'
          : dter <= 1.0
            ? 'Moderate'
            : dter <= 2.0
              ? 'High'
              : 'Very high';
      lines.push(`Debt-to-Earnings Ratio: ${dter.toFixed(2)}x (${assessment})`);
    }
    if (result.net_price_to_annual_earnings != null) {
      lines.push(`Net Price / Annual Earnings: ${result.net_price_to_annual_earnings.toFixed(2)}x`);
    }

    if (result.data_notes.length > 0) {
      lines.push('\n**Data Notes**');
      for (const note of result.data_notes) lines.push(`- ${note}`);
    }

    return [{ type: 'text', text: lines.join('\n') }];
  },
});
