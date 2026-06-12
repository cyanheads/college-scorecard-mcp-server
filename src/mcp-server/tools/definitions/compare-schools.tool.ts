/**
 * @fileoverview School comparison tool. Returns normalized side-by-side comparison
 * of 2–5 schools with percentile ranks and relative deltas within the result set.
 * @module mcp-server/tools/definitions/compare-schools.tool
 */

import { tool, z } from '@cyanheads/mcp-ts-core';
import { JsonRpcErrorCode } from '@cyanheads/mcp-ts-core/errors';
import { getScorecardService } from '@/services/scorecard/scorecard-service.js';

/** Compute rank within an array of values (0-indexed, higher is better for most metrics) */
function computeRanks(
  values: (number | null | undefined)[],
  higherIsBetter = true,
): (number | null)[] {
  const nonNull = values
    .map((v, i) => ({ v: v as number, i }))
    .filter((x) => x.v != null)
    .sort((a, b) => (higherIsBetter ? b.v - a.v : a.v - b.v));

  const rankMap = new Map<number, number>();
  for (const [rankIdx, { i }] of nonNull.entries()) {
    rankMap.set(i, rankIdx + 1);
  }

  return values.map((_, i) => rankMap.get(i) ?? null);
}

const ComparisonRowSchema = z.object({
  metric: z.string().describe('Metric name.'),
  values: z
    .array(
      z
        .object({
          school_id: z.number().describe('School unit ID.'),
          value: z.number().optional().describe('Raw metric value. Omitted when not available.'),
          rank: z.number().optional().describe('Rank within this comparison set (1=best).'),
          suppressed: z.boolean().describe('True when data is unavailable for this school/metric.'),
        })
        .describe('Per-school data point for this metric.'),
    )
    .describe('Per-school values for this metric.'),
  unit: z.string().optional().describe('Unit of measurement (e.g. "$", "%", "students").'),
  note: z.string().optional().describe('Contextual note about this metric.'),
});

export const compareSchoolsTool = tool('scorecard_compare_schools', {
  title: 'Compare Schools',
  description:
    'Normalized side-by-side comparison of 2–5 schools on a named topic. Returns percentile-ranked rows and relative deltas within the result set — structured output an agent cannot reconstruct from raw profiles. Topics: costs (tuition, net price by income bracket, debt), admissions (acceptance rate, SAT/ACT, enrollment), outcomes (graduation rate, earnings, repayment), aid (Pell grants, federal loans, debt, repayment). This is different from scorecard_get_school with multiple IDs — compare_schools adds within-set normalization.',
  annotations: { readOnlyHint: true, openWorldHint: true },

  input: z.object({
    ids: z
      .array(
        z
          .union([
            z.string().describe('School unit ID as string.'),
            z.number().describe('School unit ID as number.'),
          ])
          .describe('School unit ID (string or number).'),
      )
      .min(2)
      .max(5)
      .describe('Array of 2–5 school unit IDs to compare.'),
    topic: z
      .enum(['costs', 'admissions', 'outcomes', 'aid'])
      .describe('Comparison topic: costs, admissions, outcomes, or aid.'),
  }),

  output: z.object({
    schools: z
      .array(
        z
          .object({
            id: z.number().describe('School unit ID.'),
            name: z.string().describe('Institution name.'),
          })
          .describe('School identity record.'),
      )
      .describe('Schools in the comparison set, in the same order as the ids input.'),
    topic: z.string().describe('The comparison topic used.'),
    rows: z
      .array(ComparisonRowSchema.describe('Comparison row for one metric.'))
      .describe('Comparison rows — one per metric, with per-school values and ranks.'),
    summary: z
      .string()
      .optional()
      .describe('Brief interpretive summary highlighting the most notable relative differences.'),
  }),

  enrichment: {
    notice: z.string().optional().describe('Warning if some requested IDs returned no record.'),
  },

  errors: [
    {
      reason: 'schools_not_found',
      code: JsonRpcErrorCode.NotFound,
      when: 'None of the requested school IDs returned records.',
      recovery: 'Verify school IDs with scorecard_search_schools and retry with valid IDs.',
    },
    {
      reason: 'api_error',
      code: JsonRpcErrorCode.ServiceUnavailable,
      when: 'The College Scorecard API returned an error.',
      recovery: 'Check SCORECARD_API_KEY validity and retry after a brief delay.',
    },
  ],

  async handler(input, ctx) {
    ctx.log.info('Comparing schools', { ids: input.ids, topic: input.topic });
    const service = getScorecardService();

    const response = await service.getComparisonData(input.ids, input.topic, ctx);

    if (response.results.length === 0) {
      throw ctx.fail('schools_not_found', `No records found for the requested school IDs.`, {
        ids: input.ids,
        recovery: { hint: 'Use scorecard_search_schools to find valid school IDs first.' },
      });
    }

    // Build a lookup by ID for consistent ordering
    const byId = new Map<string, (typeof response.results)[0]>();
    for (const r of response.results) {
      if (r.id != null) byId.set(String(r.id), r);
    }

    const schools = input.ids.map((id) => {
      const r = byId.get(String(id));
      return { id: Number(id), name: r?.['school.name'] ?? '(Not found)' };
    });

    const found = schools.filter((s) => byId.has(String(s.id)));
    const missing = schools.filter((s) => !byId.has(String(s.id)));

    if (missing.length > 0) {
      ctx.enrich.notice(
        `${missing.length} of ${input.ids.length} requested IDs returned no record: ${missing.map((s) => s.id).join(', ')}`,
      );
    }

    // Build comparison rows per topic
    type MetricDef = {
      metric: string;
      key: string;
      unit?: string;
      higherIsBetter: boolean;
      note?: string;
      /** Multiply raw API value by this factor before use (e.g. 1/1000 for scaled integers) */
      scale?: number;
    };
    const metricsByTopic: Record<string, MetricDef[]> = {
      costs: [
        {
          metric: 'In-State Tuition',
          key: 'latest.cost.tuition.in_state',
          unit: '$',
          higherIsBetter: false,
        },
        {
          metric: 'Out-of-State Tuition',
          key: 'latest.cost.tuition.out_of_state',
          unit: '$',
          higherIsBetter: false,
        },
        {
          metric: 'Avg Net Price (overall)',
          key: 'latest.cost.avg_net_price.overall',
          unit: '$',
          higherIsBetter: false,
        },
        {
          metric: 'Net Price ($0–30k income)',
          key: 'latest.cost.avg_net_price.by_income.0-30000',
          unit: '$',
          higherIsBetter: false,
        },
        {
          metric: 'Net Price ($30k–48k income)',
          key: 'latest.cost.avg_net_price.by_income.30001-48000',
          unit: '$',
          higherIsBetter: false,
        },
        {
          metric: 'Net Price ($48k–75k income)',
          key: 'latest.cost.avg_net_price.by_income.48001-75000',
          unit: '$',
          higherIsBetter: false,
        },
        {
          metric: 'Net Price ($75k–110k income)',
          key: 'latest.cost.avg_net_price.by_income.75001-110000',
          unit: '$',
          higherIsBetter: false,
        },
        {
          metric: 'Net Price ($110k+ income)',
          key: 'latest.cost.avg_net_price.by_income.110001-plus',
          unit: '$',
          higherIsBetter: false,
        },
        {
          metric: 'Median Debt at Graduation',
          key: 'latest.aid.median_debt.completers.overall',
          unit: '$',
          higherIsBetter: false,
        },
      ],
      admissions: [
        {
          metric: 'Acceptance Rate',
          key: 'latest.admissions.admission_rate.overall',
          unit: '%',
          higherIsBetter: false,
          note: 'Lower may indicate more selectivity',
        },
        {
          metric: 'SAT Average',
          key: 'latest.admissions.sat_scores.average.overall',
          higherIsBetter: true,
        },
        {
          metric: 'SAT Math 25th Pct',
          key: 'latest.admissions.sat_scores.25th_percentile.math',
          higherIsBetter: true,
        },
        {
          metric: 'SAT Math 75th Pct',
          key: 'latest.admissions.sat_scores.75th_percentile.math',
          higherIsBetter: true,
        },
        {
          metric: 'ACT 25th Pct',
          key: 'latest.admissions.act_scores.25th_percentile.cumulative',
          higherIsBetter: true,
        },
        {
          metric: 'ACT 75th Pct',
          key: 'latest.admissions.act_scores.75th_percentile.cumulative',
          higherIsBetter: true,
        },
        {
          metric: 'Enrollment',
          key: 'latest.student.size',
          unit: 'students',
          higherIsBetter: true,
        },
      ],
      outcomes: [
        {
          metric: 'Completion Rate',
          key: 'latest.completion.rate_suppressed.overall',
          unit: '%',
          higherIsBetter: true,
        },
        {
          metric: 'Median Earnings (6yr)',
          key: 'latest.earnings.6_yrs_after_entry.median',
          unit: '$',
          higherIsBetter: true,
        },
        {
          metric: 'Median Earnings (10yr)',
          key: 'latest.earnings.10_yrs_after_entry.median',
          unit: '$',
          higherIsBetter: true,
        },
        {
          metric: '3-Year Repayment Rate',
          key: 'latest.repayment.3_yr_repayment.overall',
          unit: '%',
          higherIsBetter: true,
          scale: 1 / 1000,
        },
        {
          metric: 'Median Debt at Graduation',
          key: 'latest.aid.median_debt.completers.overall',
          unit: '$',
          higherIsBetter: false,
        },
      ],
      aid: [
        {
          metric: 'Pell Grant Rate',
          key: 'latest.aid.pell_grant_rate',
          unit: '%',
          higherIsBetter: true,
          note: 'Share of students receiving Pell grants',
        },
        {
          metric: 'Federal Loan Rate',
          key: 'latest.aid.federal_loan_rate',
          unit: '%',
          higherIsBetter: false,
        },
        {
          metric: 'Median Debt at Graduation',
          key: 'latest.aid.median_debt.completers.overall',
          unit: '$',
          higherIsBetter: false,
        },
        {
          metric: '3-Year Repayment Rate',
          key: 'latest.repayment.3_yr_repayment.overall',
          unit: '%',
          higherIsBetter: true,
          scale: 1 / 1000,
        },
        {
          metric: 'Avg Net Price (overall)',
          key: 'latest.cost.avg_net_price.overall',
          unit: '$',
          higherIsBetter: false,
        },
      ],
    };

    const metrics = metricsByTopic[input.topic] ?? [];
    const rows: z.infer<typeof ComparisonRowSchema>[] = metrics.map((m) => {
      const rawValues = found.map((s) => {
        const r = byId.get(String(s.id));
        if (!r) return null;
        const raw = r[m.key] as number | null | undefined;
        if (raw == null) return null;
        return m.scale != null ? raw * m.scale : raw;
      });

      const ranks = computeRanks(rawValues, m.higherIsBetter);

      return {
        metric: m.metric,
        values: found.map((s, i) => {
          const rv = rawValues[i];
          const rk = ranks[i];
          return {
            school_id: s.id,
            ...(rv != null ? { value: rv } : {}),
            ...(rk != null ? { rank: rk } : {}),
            suppressed: rv == null,
          };
        }),
        ...(m.unit && { unit: m.unit }),
        ...(m.note && { note: m.note }),
      };
    });

    // Build a brief summary of the most notable differences
    const bestByMetric = rows
      .filter((r) => r.values.some((v) => !v.suppressed))
      .slice(0, 3)
      .map((r) => {
        const best = r.values.find((v) => v.rank === 1 && !v.suppressed);
        if (!best) return null;
        const school = schools.find((s) => s.id === best.school_id);
        return `${school?.name ?? best.school_id} leads on ${r.metric}`;
      })
      .filter(Boolean);

    const summary = bestByMetric.length > 0 ? `${bestByMetric.join('; ')}.` : undefined;

    return {
      schools,
      topic: input.topic,
      rows,
      ...(summary && { summary }),
    };
  },

  format: (result) => {
    // Build a lookup: school_id → school name for readable cell headers
    const schoolById = new Map(result.schools.map((s) => [s.id, s.name]));

    const lines = [
      `## School Comparison: ${result.topic}`,
      `**Schools:** ${result.schools.map((s) => `${s.name} (ID: ${s.id})`).join(', ')}`,
    ];
    if (result.summary) lines.push(`\n> **Summary:** ${result.summary}`);

    for (const row of result.rows) {
      const unitNote = row.unit ? ` (${row.unit})` : '';
      const noteText = row.note ? ` — ${row.note}` : '';
      lines.push(`\n**${row.metric}${unitNote}${noteText}**`);

      for (const v of row.values) {
        const schoolName = schoolById.get(v.school_id) ?? `School ${v.school_id}`;
        let valueDisplay: string;
        if (v.value != null) {
          const val = v.value;
          if (row.unit === '$') valueDisplay = `$${val.toLocaleString()}`;
          else if (row.unit === '%') valueDisplay = `${(val * 100).toFixed(1)}%`;
          else if (row.unit === 'students') valueDisplay = val.toLocaleString();
          else valueDisplay = String(val);
        } else {
          valueDisplay = 'N/A';
        }
        const rankDisplay = v.rank != null ? `#${v.rank}` : 'N/A';
        const suppressedLabel = v.suppressed ? ' (suppressed)' : '';
        lines.push(`  ${schoolName}: ${valueDisplay} (${rankDisplay})${suppressedLabel}`);
      }
    }
    return [{ type: 'text', text: lines.join('\n') }];
  },
});
