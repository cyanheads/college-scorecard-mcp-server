/**
 * @fileoverview Population-preserving program metric mapping and row pagination.
 * @module services/scorecard/program-outcomes
 */
import { z } from '@cyanheads/mcp-ts-core';
import { PROGRAM_METRIC_SCOPE, PROGRAM_PROVENANCE } from '@/data/program-provenance.js';
import { MetricAvailabilitySchema, readMetric } from '@/services/scorecard/metric-availability.js';
import type { RawProgram, RawSchoolRecord } from '@/services/scorecard/types.js';

const NationalBenchmarkSchema = z.object({
  median: z.number().optional().describe('National median earnings.'),
  p25: z.number().optional().describe('National 25th-percentile earnings.'),
  p75: z.number().optional().describe('National 75th-percentile earnings.'),
  count: z.number().optional().describe('National working and not enrolled completer count.'),
  availability: z
    .object({
      median: MetricAvailabilitySchema.describe('National median availability.'),
      p25: MetricAvailabilitySchema.describe('National 25th-percentile availability.'),
      p75: MetricAvailabilitySchema.describe('National 75th-percentile availability.'),
      count: MetricAvailabilitySchema.describe('National count availability.'),
    })
    .describe('Independent availability of each national statistic.'),
});

/** Completion-based series; legacy highest-credential values remain separate. */
export const CompletionMetricsSchema = z.object({
  completion_1yr_median: z
    .number()
    .optional()
    .describe('Median earnings one year after completion, in the stated dollar year.'),
  completion_1yr_count: z
    .number()
    .optional()
    .describe('Working and not enrolled completers in the one-year earnings population.'),
  completion_1yr_availability: MetricAvailabilitySchema.describe(
    'Availability of completion-based one-year median earnings.',
  ),
  completion_1yr_count_availability: MetricAvailabilitySchema.describe(
    'Availability of the matching one-year population count.',
  ),
  completion_4yr_median: z
    .number()
    .optional()
    .describe('Median earnings four years after completion, in the stated dollar year.'),
  completion_4yr_count: z
    .number()
    .optional()
    .describe('Working and not enrolled completers in the four-year earnings population.'),
  completion_4yr_availability: MetricAvailabilitySchema.describe(
    'Availability of completion-based four-year median earnings.',
  ),
  completion_4yr_count_availability: MetricAvailabilitySchema.describe(
    'Availability of the matching four-year population count.',
  ),
  completion_1yr_national: NationalBenchmarkSchema.describe(
    'National CIP and credential earnings benchmark one year after completion.',
  ),
  completion_4yr_national: NationalBenchmarkSchema.describe(
    'National CIP and credential earnings benchmark four years after completion.',
  ),
});

/** Separate borrowing measures for the evaluated institution and all institutions. */
export const ProgramDebtMetricsSchema = z.object({
  median_debt: z
    .number()
    .optional()
    .describe(
      'Median cumulative Stafford/Grad PLUS borrowing among completers across attended institutions at the same academic level.',
    ),
  median_debt_at_institution: z
    .number()
    .optional()
    .describe(
      'Median cumulative Stafford/Grad PLUS borrowing disbursed at this institution among graduate-credential completers.',
    ),
});

/** Select the debt series used for the inclusive max_debt threshold. */
export function programDebtSeries(credentialLevel: number | null | undefined) {
  return credentialLevel === 5 ||
    credentialLevel === 6 ||
    credentialLevel === 7 ||
    credentialLevel === 8
    ? 'eval_inst'
    : 'all_inst';
}

function nationalBenchmark(series: NonNullable<RawProgram['earnings']>['1_yr']) {
  const median = readMetric(series?.overall_median_earnings_national);
  const p25 = readMetric(series?.overall_p25_earnings_national);
  const p75 = readMetric(series?.overall_p75_earnings_national);
  const count = readMetric(series?.working_not_enrolled?.overall_count_national);
  return {
    ...(median.value != null && { median: median.value }),
    ...(p25.value != null && { p25: p25.value }),
    ...(p75.value != null && { p75: p75.value }),
    ...(count.value != null && { count: count.value }),
    availability: {
      median: median.availability,
      p25: p25.availability,
      p75: p75.availability,
      count: count.availability,
    },
  };
}

/** Map each published population independently, retaining explicit suppression and zero. */
function sharedProgramOutcomes(program: RawProgram) {
  const legacySeries = program.earnings?.highest?.['1_yr'];
  const oneYearSeries = program.earnings?.['1_yr'];
  const fourYearSeries = program.earnings?.['4_yr'];
  const legacy = readMetric(legacySeries?.overall_median_earnings);
  const legacyCount = readMetric(legacySeries?.working_not_enrolled?.overall_count);
  const one = readMetric(oneYearSeries?.overall_median_earnings);
  const oneCount = readMetric(oneYearSeries?.working_not_enrolled?.overall_count);
  const four = readMetric(fourYearSeries?.overall_median_earnings);
  const fourCount = readMetric(fourYearSeries?.working_not_enrolled?.overall_count);
  const debt = program.debt?.staff_grad_plus?.all;
  const graduateDebt =
    programDebtSeries(program.credential?.level) === 'eval_inst'
      ? readMetric(debt?.eval_inst?.median).value
      : undefined;
  return {
    ...(legacy.value != null && { earnings_1yr_median: legacy.value }),
    ...(legacyCount.value != null && { earnings_count: legacyCount.value }),
    earnings_availability: legacy.availability,
    earnings_count_availability: legacyCount.availability,
    suppressed: legacy.availability === 'privacy_suppressed',
    ...(one.value != null && { completion_1yr_median: one.value }),
    ...(oneCount.value != null && { completion_1yr_count: oneCount.value }),
    completion_1yr_availability: one.availability,
    completion_1yr_count_availability: oneCount.availability,
    ...(four.value != null && { completion_4yr_median: four.value }),
    ...(fourCount.value != null && { completion_4yr_count: fourCount.value }),
    completion_4yr_availability: four.availability,
    completion_4yr_count_availability: fourCount.availability,
    completion_1yr_national: nationalBenchmark(oneYearSeries),
    completion_4yr_national: nationalBenchmark(fourYearSeries),
    ...(graduateDebt != null && { median_debt_at_institution: graduateDebt }),
  };
}

/** Tools expose numeric all-institutions debt. Program resources preserve the provider's legacy scalar. */
export function programOutcomes(program: RawProgram) {
  const medianDebt = readMetric(program.debt?.staff_grad_plus?.all?.all_inst?.median).value;
  return {
    ...sharedProgramOutcomes(program),
    ...(medianDebt != null && { median_debt: medianDebt }),
  };
}

/** Stable descending current-series ordering; ties preserve upstream identity order. */
export function compareProgramEarnings(
  a: { completion_1yr_median?: number | undefined },
  b: { completion_1yr_median?: number | undefined },
) {
  if (a.completion_1yr_median == null) return b.completion_1yr_median == null ? 0 : 1;
  if (b.completion_1yr_median == null) return -1;
  return b.completion_1yr_median - a.completion_1yr_median;
}

/** Row paging occurs only after selectors and stable ordering. */
export function programPage<T>(rows: T[], offset: number, limit: number) {
  const effectiveLimit = Math.min(limit, 100);
  const programs = rows.slice(offset, offset + effectiveLimit);
  const nextOffset = offset + programs.length < rows.length ? offset + programs.length : null;
  return {
    programs,
    total: rows.length,
    shown: programs.length,
    offset,
    limit: effectiveLimit,
    nextOffset,
    truncated: nextOffset != null,
  };
}

/** Resource rows preserve legacy nullable scalars while adding normalized current series. */
export function programResourcePage(record: RawSchoolRecord, offset: number, limit: number) {
  const rows = (record['latest.programs.cip_4_digit'] ?? []).map((p) => {
    const outcomes = sharedProgramOutcomes(p);
    return {
      ...outcomes,
      code: p.code,
      title: p.title,
      credential_level: p.credential?.level ?? null,
      earnings_1yr_median: p.earnings?.highest?.['1_yr']?.overall_median_earnings ?? null,
      median_debt: p.debt?.staff_grad_plus?.all?.all_inst?.median ?? null,
      ipeds_awards_year1: p.counts?.ipeds_awards1 ?? null,
      ipeds_awards_year2: p.counts?.ipeds_awards2 ?? null,
    };
  });
  const page = programPage(rows, offset, limit);
  return {
    school_id: record.id,
    school_name: record['school.name'],
    ope6_id: record.ope6_id ?? null,
    metric_scope: PROGRAM_METRIC_SCOPE,
    provenance: PROGRAM_PROVENANCE,
    ...page,
    nextUri:
      page.nextOffset == null
        ? null
        : `scorecard://programs/${record.id}/page/${page.nextOffset}/${page.limit}`,
    ...(limit > 100 && { notice: 'Program limit normalized to 100 rows.' }),
  };
}
