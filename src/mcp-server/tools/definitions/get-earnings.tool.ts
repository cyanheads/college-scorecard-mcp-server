/**
 * @fileoverview Earnings tool. Returns institution-level post-graduation earnings
 * for one school at 6, 8, and 10 years after entry, with optional gender breakdown.
 * @module mcp-server/tools/definitions/get-earnings.tool
 */

import { tool, z } from '@cyanheads/mcp-ts-core';
import { JsonRpcErrorCode } from '@cyanheads/mcp-ts-core/errors';
import { getScorecardService } from '@/services/scorecard/scorecard-service.js';

export const getEarningsTool = tool('scorecard_get_earnings', {
  title: 'Get School Earnings',
  description:
    'Institution-level post-graduation earnings for one school — median and percentiles at 6, 8, and 10 years after entry, with optional gender breakdown. This reflects outcomes across all graduates, not broken down by program. For program-specific earnings use scorecard_get_programs. For ROI analysis combining cost and debt data use scorecard_value_analysis. The years parameter accepts a list of cohort entry years for historical trend queries — omit for current snapshot only.',
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },

  input: z.object({
    id: z
      .union([
        z.string().describe('School unit ID as string.'),
        z.number().describe('School unit ID as number.'),
      ])
      .describe('School unit ID from scorecard_search_schools.'),
    years: z
      .array(z.number().int())
      .optional()
      .describe(
        'Optional list of cohort entry years for historical trend data (e.g. [2011, 2012, 2013]). Omit for current snapshot.',
      ),
  }),

  output: z.object({
    school_id: z.number().describe('School unit ID.'),
    school_name: z.string().describe('Institution name.'),
    current: z
      .object({
        earnings_6yr_median: z.number().optional().describe('Median earnings 6 years after entry.'),
        earnings_6yr_p25: z
          .number()
          .optional()
          .describe('25th percentile earnings 6 years after entry.'),
        earnings_6yr_p75: z
          .number()
          .optional()
          .describe('75th percentile earnings 6 years after entry.'),
        earnings_8yr_median: z.number().optional().describe('Median earnings 8 years after entry.'),
        earnings_10yr_median: z
          .number()
          .optional()
          .describe('Median earnings 10 years after entry.'),
        earnings_10yr_p25: z
          .number()
          .optional()
          .describe('25th percentile earnings 10 years after entry.'),
        earnings_10yr_p75: z
          .number()
          .optional()
          .describe('75th percentile earnings 10 years after entry.'),
        earnings_6yr_female_median: z
          .number()
          .optional()
          .describe('Median earnings 6 years after entry for female students.'),
        earnings_6yr_male_median: z
          .number()
          .optional()
          .describe('Median earnings 6 years after entry for male students.'),
      })
      .describe('Most recent available earnings snapshot.'),
    trend: z
      .array(
        z
          .object({
            year: z.number().describe('Cohort entry year.'),
            earnings_6yr_median: z
              .number()
              .optional()
              .describe('Median earnings 6 years after entry for this cohort.'),
            earnings_10yr_median: z
              .number()
              .optional()
              .describe('Median earnings 10 years after entry for this cohort.'),
          })
          .describe('Earnings data point for one cohort entry year.'),
      )
      .optional()
      .describe(
        'Historical trend rows by cohort entry year. Present only when years parameter was supplied.',
      ),
    suppressed: z
      .boolean()
      .describe('True when earnings data is suppressed across all time points.'),
    suppression_note: z.string().optional().describe('Explains suppression when suppressed=true.'),
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
    ctx.log.info('Fetching school earnings', { id: input.id, years: input.years });
    const service = getScorecardService();

    const response = await service.getSchoolEarnings(input.id, input.years ?? [], ctx);

    const r = response.results[0];
    if (!r) {
      throw ctx.fail('school_not_found', `No school record found for ID ${input.id}.`, {
        id: input.id,
        recovery: { hint: 'Search for valid school IDs with scorecard_search_schools.' },
      });
    }

    const v6med = r['latest.earnings.6_yrs_after_entry.median'];
    const v6p25 = r['latest.earnings.6_yrs_after_entry.percentile25'];
    const v6p75 = r['latest.earnings.6_yrs_after_entry.percentile75'];
    const v8med = r['latest.earnings.8_yrs_after_entry.median_earnings'];
    const v10med = r['latest.earnings.10_yrs_after_entry.median'];
    const v10p25 = r['latest.earnings.10_yrs_after_entry.percentile25'];
    const v10p75 = r['latest.earnings.10_yrs_after_entry.percentile75'];
    const v6fem = r['latest.earnings.6_yrs_after_entry.female_students.median_earnings'];
    const v6mal = r['latest.earnings.6_yrs_after_entry.male_students.median_earnings'];

    const current = {
      ...(v6med != null && { earnings_6yr_median: v6med }),
      ...(v6p25 != null && { earnings_6yr_p25: v6p25 }),
      ...(v6p75 != null && { earnings_6yr_p75: v6p75 }),
      ...(v8med != null && { earnings_8yr_median: v8med }),
      ...(v10med != null && { earnings_10yr_median: v10med }),
      ...(v10p25 != null && { earnings_10yr_p25: v10p25 }),
      ...(v10p75 != null && { earnings_10yr_p75: v10p75 }),
      ...(v6fem != null && { earnings_6yr_female_median: v6fem }),
      ...(v6mal != null && { earnings_6yr_male_median: v6mal }),
    };

    const suppressed = Object.keys(current).length === 0;
    const suppression_note = suppressed
      ? 'Earnings data not available — likely suppressed due to small cohort size (FERPA).'
      : undefined;

    // Build trend rows for requested years
    const trend =
      input.years && input.years.length > 0
        ? input.years.map((year) => {
            const row: {
              year: number;
              earnings_6yr_median?: number;
              earnings_10yr_median?: number;
            } = { year };
            const k6 = `${year}.earnings.6_yrs_after_entry.median`;
            const k10 = `${year}.earnings.10_yrs_after_entry.median`;
            if (r[k6] != null) row.earnings_6yr_median = r[k6] as number;
            if (r[k10] != null) row.earnings_10yr_median = r[k10] as number;
            return row;
          })
        : undefined;

    return {
      school_id: r.id ?? Number(input.id),
      school_name: r['school.name'] ?? 'Unknown',
      current,
      ...(trend && { trend }),
      suppressed,
      ...(suppression_note && { suppression_note }),
    };
  },

  format: (result) => {
    const fmt = (n: number | undefined) => (n != null ? `$${n.toLocaleString()}` : 'Not available');
    const lines = [`## Earnings: ${result.school_name} (ID: ${result.school_id})`];
    lines.push('\n**Current Earnings Snapshot**');
    const c = result.current;
    if (result.suppressed) {
      lines.push(`> **Suppressed:** ${result.suppression_note ?? 'Earnings data not available.'}`);
    }
    lines.push(`6-Year Median (earnings_6yr_median): ${fmt(c.earnings_6yr_median)}`);
    lines.push(
      `6-Year P25 (earnings_6yr_p25): ${fmt(c.earnings_6yr_p25)} / P75 (earnings_6yr_p75): ${fmt(c.earnings_6yr_p75)}`,
    );
    lines.push(`8-Year Median (earnings_8yr_median): ${fmt(c.earnings_8yr_median)}`);
    lines.push(`10-Year Median (earnings_10yr_median): ${fmt(c.earnings_10yr_median)}`);
    lines.push(
      `10-Year P25 (earnings_10yr_p25): ${fmt(c.earnings_10yr_p25)} / P75 (earnings_10yr_p75): ${fmt(c.earnings_10yr_p75)}`,
    );
    lines.push(
      `6-Year Female Median (earnings_6yr_female_median): ${fmt(c.earnings_6yr_female_median)}`,
    );
    lines.push(`6-Year Male Median (earnings_6yr_male_median): ${fmt(c.earnings_6yr_male_median)}`);
    if (result.trend && result.trend.length > 0) {
      lines.push('\n**Historical Trend (by Entry Year)**');
      for (const row of result.trend) {
        const parts = [`Year: ${row.year}`];
        if (row.earnings_6yr_median != null)
          parts.push(`6yr: $${row.earnings_6yr_median.toLocaleString()}`);
        if (row.earnings_10yr_median != null)
          parts.push(`10yr: $${row.earnings_10yr_median.toLocaleString()}`);
        lines.push(parts.join(' | '));
      }
    }
    return [{ type: 'text', text: lines.join('\n') }];
  },
});
