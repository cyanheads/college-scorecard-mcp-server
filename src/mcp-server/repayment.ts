/**
 * @fileoverview Borrower repayment output shared by school profiles and value analysis.
 * @module mcp-server/repayment
 */

import { z } from '@cyanheads/mcp-ts-core';
import {
  BORROWER_REPAYMENT_SERIES,
  BORROWER_REPAYMENT_STATUSES,
  borrowerRepaymentField,
} from '@/data/repayment-context.js';
import type { RawSchoolRecord } from '@/services/scorecard/types.js';

/** Historical provenance of the discontinued declining-balance metric. */
export const legacyRepaymentContextSchema = z.object({
  data_file_year: z.number().int().describe('First year of the Scorecard data file.'),
  data_file: z.string().describe('Scorecard data file vintage.'),
  repayment_entry_cohorts: z.string().describe('Fiscal years when the cohort entered repayment.'),
  measurement_period: z.string().describe('Fiscal years when outcomes were measured.'),
  status: z.literal('discontinued').describe('Publication status of this series.'),
});

const borrowerRateSchema = z.discriminatedUnion('availability', [
  z
    .object({
      availability: z.literal('available').describe('Scorecard published a decimal or bin.'),
      reported: z.string().describe('Original published decimal or bin, preserved verbatim.'),
      value: z
        .number()
        .optional()
        .describe('Numeric value of a published decimal; absent for bins.'),
    })
    .describe('Published borrower rate.'),
  z
    .object({
      availability: z
        .literal('privacy_suppressed')
        .describe('Scorecard explicitly marked the rate as privacy suppressed.'),
    })
    .describe('Explicitly privacy-suppressed borrower rate.'),
  z
    .object({
      availability: z.literal('unavailable').describe('Scorecard did not supply a supported rate.'),
    })
    .describe('Unavailable borrower rate.'),
]);

/** Published statuses and cohort metadata in horizon order. */
export const borrowerRepaymentSchema = z
  .array(
    z
      .object({
        horizon_years: z
          .union([z.literal(2), z.literal(4)])
          .describe('Years after entering repayment.'),
        data_file_year: z.number().int().describe('First year of the Scorecard data file.'),
        data_file: z.string().describe('Scorecard data file vintage.'),
        repayment_entry_cohorts: z
          .array(z.string())
          .describe('Award years when borrowers entered repayment.'),
        measurement_period: z.array(z.string()).describe('Years when outcomes were measured.'),
        scope: z
          .literal('opeid6')
          .describe('Borrowers are pooled across campuses sharing an OPEID6.'),
        cohort_count: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .describe(
            'Undergraduate federal Direct Loan borrowers in this horizon’s repayment-entry cohort.',
          ),
        making_progress: borrowerRateSchema.describe('Share assigned the making-progress status.'),
        default: borrowerRateSchema.describe('Share assigned the default status.'),
        paid_in_full: borrowerRateSchema.describe('Share assigned the paid-in-full status.'),
      })
      .describe('Repayment cohort and statuses at a single horizon.'),
  )
  .describe(
    'Three of eight mutually exclusive repayment statuses for undergraduate federal Direct Loan borrowers, pooled at OPEID6.',
  );

type BorrowerRate = z.infer<typeof borrowerRateSchema>;

// The public Scorecard fields publish decimal shares, decimal ranges, or upper-bound bins.
const ratePattern = /^(<=)?(0(?:\.[0-9]+)?|1(?:\.0+)?)(?:-(0(?:\.[0-9]+)?|1(?:\.0+)?))?$/;

function trimFractionalZeros(value: string): string {
  let end = value.length;
  while (end > 1 && value[end - 1] === '0') end--;
  if (value[end - 1] === '.') end--;
  return value.slice(0, end);
}

/** Read a reported share. Undefined signals an unsupported provider value. */
export function readBorrowerRate(raw: unknown): BorrowerRate | undefined {
  if (raw == null || raw === 'NA') return { availability: 'unavailable' };
  if (raw === 'PS' || raw === 'PrivacySuppressed') return { availability: 'privacy_suppressed' };
  if (typeof raw !== 'string') return undefined;

  const match = ratePattern.exec(raw);
  if (!match || match[0] !== raw) return undefined;
  const [, atMost, first = '', second] = match;
  if (second != null && (atMost || trimFractionalZeros(first) > trimFractionalZeros(second))) {
    return undefined;
  }
  return {
    availability: 'available',
    reported: raw,
    ...(!atMost && second == null && { value: Number(first) }),
  };
}

/** Read each series independently so a malformed rate never erases a valid peer or profile. */
export function readBorrowerRepayment(record: RawSchoolRecord) {
  const notices: string[] = [];
  const series: z.infer<typeof borrowerRepaymentSchema> = BORROWER_REPAYMENT_SERIES.map(
    (context) => {
      const { horizon_years, repayment_entry_cohorts, measurement_period } = context;
      const count = record[borrowerRepaymentField(horizon_years, 'count')];
      const readStatus = (key: keyof typeof BORROWER_REPAYMENT_STATUSES): BorrowerRate => {
        const { label, suffix } = BORROWER_REPAYMENT_STATUSES[key];
        const rate = readBorrowerRate(record[borrowerRepaymentField(horizon_years, suffix)]);
        if (rate) return rate;
        notices.push(
          `Scorecard returned an unsupported ${horizon_years}-year ${label} repayment value.`,
        );
        return { availability: 'unavailable' };
      };
      return {
        ...context,
        repayment_entry_cohorts: [...repayment_entry_cohorts],
        measurement_period: [...measurement_period],
        ...(typeof count === 'number' &&
          Number.isSafeInteger(count) &&
          count >= 0 && { cohort_count: count }),
        making_progress: readStatus('making_progress'),
        default: readStatus('default'),
        paid_in_full: readStatus('paid_in_full'),
      };
    },
  );
  return { series, notices };
}

function formatRate(rate: BorrowerRate): string {
  switch (rate.availability) {
    case 'available':
      return `available, reported \`${rate.reported}\`${rate.value == null ? '' : ` (numeric share ${rate.value})`}`;
    case 'privacy_suppressed':
      return '`privacy_suppressed`';
    case 'unavailable':
      return 'unavailable';
  }
}

/** Render cohort metadata and the exact reported shares or bins. */
export function formatBorrowerRepayment(series: z.infer<typeof borrowerRepaymentSchema>): string[] {
  return [
    'Borrower repayment statuses (three of eight mutually exclusive statuses for undergraduate federal Direct Loan borrowers):',
    ...series.map((cohort) => {
      const count = cohort.cohort_count == null ? 'unavailable' : cohort.cohort_count;
      return `- ${cohort.horizon_years}-year (${cohort.scope.toUpperCase()} pooled, ${cohort.data_file} file, data file year ${cohort.data_file_year}, repayment-entry cohorts ${cohort.repayment_entry_cohorts.join(', ')}, measured ${cohort.measurement_period.join(', ')}, cohort count ${count}): making progress ${formatRate(cohort.making_progress)}, default ${formatRate(cohort.default)}, paid in full ${formatRate(cohort.paid_in_full)}.`;
    }),
  ];
}
