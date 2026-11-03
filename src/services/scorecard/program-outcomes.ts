/**
 * @fileoverview Population-preserving program metric mapping and row pagination.
 * @module services/scorecard/program-outcomes
 */
import { z } from '@cyanheads/mcp-ts-core';
import { PROGRAM_METRIC_SCOPE, PROGRAM_PROVENANCE } from '@/data/program-provenance.js';
import { MetricAvailabilitySchema, readMetric } from '@/services/scorecard/metric-availability.js';
import type { RawProgram, RawSchoolRecord } from '@/services/scorecard/types.js';

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
});

/** Map each published population independently, retaining explicit suppression and zero. */
export function programOutcomes(program: RawProgram) {
  const legacy = readMetric(program.earnings?.highest?.['1_yr']?.overall_median_earnings);
  const legacyCount = readMetric(
    program.earnings?.highest?.['1_yr']?.working_not_enrolled?.overall_count,
  );
  const one = readMetric(program.earnings?.['1_yr']?.overall_median_earnings);
  const oneCount = readMetric(program.earnings?.['1_yr']?.working_not_enrolled?.overall_count);
  const four = readMetric(program.earnings?.['4_yr']?.overall_median_earnings);
  const fourCount = readMetric(program.earnings?.['4_yr']?.working_not_enrolled?.overall_count);
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
  const rows = (record['latest.programs.cip_4_digit'] ?? []).map((p) => ({
    ...programOutcomes(p),
    code: p.code,
    title: p.title,
    credential_level: p.credential?.level ?? null,
    earnings_1yr_median: p.earnings?.highest?.['1_yr']?.overall_median_earnings ?? null,
    median_debt: p.debt?.staff_grad_plus?.all?.all_inst?.median ?? null,
    ipeds_awards_year1: p.counts?.ipeds_awards1 ?? null,
    ipeds_awards_year2: p.counts?.ipeds_awards2 ?? null,
  }));
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
