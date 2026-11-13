/**
 * @fileoverview Shared readable rendering for Scorecard program outcomes and their provenance.
 * @module mcp-server/program-format
 */
import type { z } from '@cyanheads/mcp-ts-core';
import { escapeMarkdownInline, markdownLink } from '@cyanheads/mcp-ts-core/utils';
import type {
  ProgramMetricScopeSchema,
  ProgramProvenanceSchema,
} from '@/data/program-provenance.js';
import type {
  CompletionMetricsSchema,
  programOutcomes,
} from '@/services/scorecard/program-outcomes.js';

/** Keep line breaks inside the value, including when it appears in a heading. */
export function programText(value: string): string {
  return value
    .split(/([\r\n])/)
    .map((part) => {
      if (part === '\r') return '&#13;';
      if (part === '\n') return '&#10;';
      return escapeMarkdownInline(part);
    })
    .join('');
}

/** Group the integer part without rounding the reported precision. */
export function programNumber(value: number): string {
  const decimal = String(value);
  if (decimal.includes('e')) return decimal;
  const dot = decimal.indexOf('.');
  if (dot < 0) return value.toLocaleString('en-US');
  return `${Number(decimal.slice(0, dot)).toLocaleString('en-US')}${decimal.slice(dot)}`;
}

type ProgramMetrics = z.infer<typeof CompletionMetricsSchema> &
  Pick<
    ReturnType<typeof programOutcomes>,
    'earnings_availability' | 'earnings_count_availability' | 'suppressed'
  > & {
    earnings_1yr_median?: number | undefined;
    earnings_count?: number | undefined;
    median_debt?: number | undefined;
    ipeds_awards_year1?: number | undefined;
    ipeds_awards_year2?: number | undefined;
    suppression_note?: string | undefined;
  };

/** Render independent populations, including availability for each median and count. */
export function programMetricLines(row: ProgramMetrics): string[] {
  const metric = (value: number | undefined, availability: string, unit = '') =>
    `${value == null ? 'Not available' : `${unit}${programNumber(value)}`} (${availability})`;
  const lines = [
    `- Completion-based 1-year earnings: ${metric(row.completion_1yr_median, row.completion_1yr_availability, '$')} | Population count: ${metric(row.completion_1yr_count, row.completion_1yr_count_availability)}`,
    `- Completion-based 4-year earnings: ${metric(row.completion_4yr_median, row.completion_4yr_availability, '$')} | Population count: ${metric(row.completion_4yr_count, row.completion_4yr_count_availability)}`,
    `- Legacy highest-credential 1-year earnings: ${metric(row.earnings_1yr_median, row.earnings_availability, '$')} | Population count: ${metric(row.earnings_count, row.earnings_count_availability)} | Suppressed: ${row.suppressed}`,
  ];
  if (row.suppression_note != null)
    lines.push(`- Suppression note: ${programText(row.suppression_note)}`);
  if (row.median_debt != null)
    lines.push(`- Median cumulative Stafford/Grad PLUS debt: $${programNumber(row.median_debt)}`);
  if (row.ipeds_awards_year1 != null)
    lines.push(`- IPEDS Awards (debt cohort year 1): ${programNumber(row.ipeds_awards_year1)}`);
  if (row.ipeds_awards_year2 != null)
    lines.push(`- IPEDS Awards (debt cohort year 2): ${programNumber(row.ipeds_awards_year2)}`);
  return lines;
}

/** Render every dictionary series and its distinct aggregation scope. */
export function programProvenanceLines(
  provenance: z.infer<typeof ProgramProvenanceSchema>,
  scope: z.infer<typeof ProgramMetricScopeSchema>,
): string[] {
  const lines = [
    '',
    '### Metric scope and provenance',
    '',
    `Earnings: ${scope.earnings} | Debt: ${scope.debt} | IPEDS awards: ${scope.ipeds_awards} | Program identity: ${programText(scope.program_identity)}`,
    '',
    `Source: ${markdownLink('College Scorecard data dictionary', provenance.source)}`,
    '',
  ];
  for (const [label, series] of [
    ['Completion-based 1-year earnings', provenance.completion_1yr],
    ['Completion-based 4-year earnings', provenance.completion_4yr],
    ['Legacy highest-credential 1-year earnings', provenance.highest_credential_1yr],
  ] as const) {
    lines.push(
      `- **${label}:** ${programText(series.population)}. Cohorts: ${series.cohort.map(programText).join(', ')} | Measurement years: ${series.measurement_years.join(', ')} | Dollar year: ${series.dollar_year} | Median: ${programText(series.median_variable)} (${programText(series.median_cell)}) | Count: ${programText(series.count_variable)} (${programText(series.count_cell)})`,
    );
  }
  const { debt, ipeds_awards_year1, ipeds_awards_year2 } = provenance;
  lines.push(
    `- **Debt:** ${programText(debt.population)}. Cohorts: ${debt.cohort.map(programText).join(', ')} | Variable: ${programText(debt.variable)} (${programText(debt.cell)})`,
  );
  for (const [year, award] of [
    [1, ipeds_awards_year1],
    [2, ipeds_awards_year2],
  ] as const) {
    lines.push(
      `- **IPEDS awards, debt-cohort year ${year}:** ${programText(award.population)}. Academic year: ${programText(award.academic_year)} | Variable: ${programText(award.variable)} (${programText(award.cell)})`,
    );
  }
  return lines;
}
