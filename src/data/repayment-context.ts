/**
 * @fileoverview Institution repayment series and vintages from the College Scorecard data dictionary.
 * @module data/repayment-context
 */

/** Vintages of the discontinued declining-balance measures. */
export const LEGACY_REPAYMENT_CONTEXT = {
  1: {
    data_file_year: 2014,
    data_file: '2014–15',
    repayment_entry_cohorts: 'FY2013–FY2014',
    measurement_period: 'FY2014–FY2015',
    status: 'discontinued',
  },
  3: {
    data_file_year: 2016,
    data_file: '2016–17',
    repayment_entry_cohorts: 'FY2013–FY2014',
    measurement_period: 'FY2016–FY2017',
    status: 'discontinued',
  },
  5: {
    data_file_year: 2016,
    data_file: '2016–17',
    repayment_entry_cohorts: 'FY2011–FY2012',
    measurement_period: 'FY2016–FY2017',
    status: 'discontinued',
  },
} as const;

/** Describe the vintage of a discontinued declining-balance series. */
export function describeLegacyRepayment(context: {
  data_file_year: number;
  data_file: string;
  repayment_entry_cohorts: string;
  measurement_period: string;
  status: 'discontinued';
}) {
  return `${context.status} series from the ${context.data_file} file (data file year ${context.data_file_year}), repayment-entry cohorts ${context.repayment_entry_cohorts}, measured ${context.measurement_period}`;
}

/** Comparison-row note for the preserved numeric 3-year measure. */
export const LEGACY_REPAYMENT_3YR_NOTE = `3-year repayment progress measures the share paying down principal (declining balance), a ${describeLegacyRepayment(LEGACY_REPAYMENT_CONTEXT[3])}.`;

/** Labels and API suffixes for the three published borrower statuses returned by the tools. */
export const BORROWER_REPAYMENT_STATUSES = {
  making_progress: { suffix: 'makingprogress', label: 'making progress' },
  default: { suffix: 'default', label: 'default' },
  paid_in_full: { suffix: 'fullypaid', label: 'paid in full' },
} as const;

/** Matching denominators and metadata for the undergraduate federal Direct Loan cohorts. */
export const BORROWER_REPAYMENT_SERIES = [
  {
    horizon_years: 2,
    data_file_year: 2019,
    data_file: '2019–20',
    repayment_entry_cohorts: ['AY2016–17', 'AY2017–18'],
    measurement_period: ['2018–19', '2019–20'],
    scope: 'opeid6',
  },
  {
    horizon_years: 4,
    data_file_year: 2020,
    data_file: '2020–21',
    repayment_entry_cohorts: ['AY2015–16', 'AY2016–17'],
    measurement_period: ['2019–20', '2020–21'],
    scope: 'opeid6',
  },
] as const;

/** College Scorecard API key for one borrower rate or its cohort denominator. */
export function borrowerRepaymentField<
  const Horizon extends (typeof BORROWER_REPAYMENT_SERIES)[number]['horizon_years'],
  const Suffix extends
    | (typeof BORROWER_REPAYMENT_STATUSES)[keyof typeof BORROWER_REPAYMENT_STATUSES]['suffix']
    | 'count',
>(horizon: Horizon, suffix: Suffix) {
  return `latest.repayment.${horizon}_yr_bb_fed_repayment.ug.${suffix}` as const;
}

/** Flat projection keys shared by profile and value analysis. */
export const BORROWER_REPAYMENT_FIELDS = BORROWER_REPAYMENT_SERIES.flatMap(({ horizon_years }) => [
  borrowerRepaymentField(horizon_years, 'count'),
  ...Object.values(BORROWER_REPAYMENT_STATUSES).map(({ suffix }) =>
    borrowerRepaymentField(horizon_years, suffix),
  ),
]);
