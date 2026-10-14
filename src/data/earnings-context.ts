/**
 * @fileoverview Institution earnings provenance from the Scorecard data dictionary.
 * @module data/earnings-context
 */

/** Verified file vintage, academic entry cohorts, calendar measurements, and dollar basis. */
export interface EarningsContext {
  data_file_year: number;
  dollar_year?: number;
  entry_cohorts?: string[];
  measurement_years?: number[];
}

/** Supported institution metrics and their official API suffixes. */
export const EARNINGS_FIELDS = {
  earnings_6yr_median: '6_yrs_after_entry.median',
  earnings_6yr_p25: '6_yrs_after_entry.working_not_enrolled.earnings_percentile.25',
  earnings_6yr_p75: '6_yrs_after_entry.working_not_enrolled.earnings_percentile.75',
  earnings_8yr_median: '8_yrs_after_entry.median_earnings',
  earnings_10yr_median: '10_yrs_after_entry.median',
  earnings_10yr_p25: '10_yrs_after_entry.working_not_enrolled.earnings_percentile.25',
  earnings_10yr_p75: '10_yrs_after_entry.working_not_enrolled.earnings_percentile.75',
  earnings_6yr_non_male_median: '6_yrs_after_entry.median_earnings_non_male',
  earnings_6yr_male_median: '6_yrs_after_entry.median_earnings_male',
} as const;

/** Numeric keys exposed by scorecard_get_earnings. */
export type EarningsMetric = keyof typeof EARNINGS_FIELDS;

/**
 * Source: CollegeScorecardDataDictionary.xlsx, Institution_Cohort_Map and
 * Most_Recent_Inst_Cohort_Map, retrieved 2026-10-14.
 * https://collegescorecard.ed.gov/files/CollegeScorecardDataDictionary.xlsx
 * Every cell below is transcribed from the named metric's map; no year arithmetic
 * determines cohorts or inflation. NA cells retain the requested file year only.
 */
const SIX_YEAR_CONTEXTS: Record<number, EarningsContext> & { 2020: EarningsContext } = {
  2003: {
    data_file_year: 2003,
    entry_cohorts: ['1996-97', '1997-98'],
    measurement_years: [2003, 2004],
    dollar_year: 2014,
  },
  2005: {
    data_file_year: 2005,
    entry_cohorts: ['1998-99', '1999-00'],
    measurement_years: [2005, 2006],
    dollar_year: 2014,
  },
  2007: {
    data_file_year: 2007,
    entry_cohorts: ['2000-01', '2001-02'],
    measurement_years: [2007, 2008],
    dollar_year: 2014,
  },
  2009: {
    data_file_year: 2009,
    entry_cohorts: ['2002-03', '2003-04'],
    measurement_years: [2009, 2010],
    dollar_year: 2014,
  },
  2011: {
    data_file_year: 2011,
    entry_cohorts: ['2004-05', '2005-06'],
    measurement_years: [2011, 2012],
    dollar_year: 2014,
  },
  2012: {
    data_file_year: 2012,
    entry_cohorts: ['2005-06', '2006-07'],
    measurement_years: [2012, 2013],
    dollar_year: 2015,
  },
  2013: {
    data_file_year: 2013,
    entry_cohorts: ['2006-07', '2007-08'],
    measurement_years: [2013, 2014],
    dollar_year: 2016,
  },
  2014: {
    data_file_year: 2014,
    entry_cohorts: ['2007-08', '2008-09'],
    measurement_years: [2014, 2015],
    dollar_year: 2017,
  },
  2020: {
    data_file_year: 2020,
    entry_cohorts: ['2013-14', '2014-15'],
    measurement_years: [2020, 2021],
    dollar_year: 2022,
  },
};

const TEN_YEAR_CONTEXTS: Record<number, EarningsContext> & { 2020: EarningsContext } = {
  2007: {
    data_file_year: 2007,
    entry_cohorts: ['1996-97', '1997-98'],
    measurement_years: [2007, 2008],
    dollar_year: 2014,
  },
  2009: {
    data_file_year: 2009,
    entry_cohorts: ['1998-99', '1999-00'],
    measurement_years: [2009, 2010],
    dollar_year: 2014,
  },
  2011: {
    data_file_year: 2011,
    entry_cohorts: ['2000-01', '2001-02'],
    measurement_years: [2011, 2012],
    dollar_year: 2014,
  },
  2012: {
    data_file_year: 2012,
    entry_cohorts: ['2001-02', '2002-03'],
    measurement_years: [2012, 2013],
    dollar_year: 2015,
  },
  2013: {
    data_file_year: 2013,
    entry_cohorts: ['2002-03', '2003-04'],
    measurement_years: [2013, 2014],
    dollar_year: 2016,
  },
  2014: {
    data_file_year: 2014,
    entry_cohorts: ['2003-04', '2004-05'],
    measurement_years: [2014, 2015],
    dollar_year: 2017,
  },
  2020: {
    data_file_year: 2020,
    entry_cohorts: ['2009-10', '2010-11'],
    measurement_years: [2020, 2021],
    dollar_year: 2022,
  },
};

/** Official per-metric latest file provenance, independent of a school's returned values. */
export const LATEST_EARNINGS_CONTEXT: Record<EarningsMetric, EarningsContext> = {
  earnings_6yr_median: SIX_YEAR_CONTEXTS[2020],
  earnings_6yr_p25: SIX_YEAR_CONTEXTS[2020],
  earnings_6yr_p75: SIX_YEAR_CONTEXTS[2020],
  earnings_6yr_non_male_median: SIX_YEAR_CONTEXTS[2020],
  earnings_6yr_male_median: SIX_YEAR_CONTEXTS[2020],
  earnings_8yr_median: {
    data_file_year: 2020,
    entry_cohorts: ['2011-12', '2012-13'],
    measurement_years: [2020, 2021],
    dollar_year: 2022,
  },
  earnings_10yr_median: TEN_YEAR_CONTEXTS[2020],
  earnings_10yr_p25: TEN_YEAR_CONTEXTS[2020],
  earnings_10yr_p75: TEN_YEAR_CONTEXTS[2020],
};

/** Read verified historical metadata; unavailable metadata is never inferred. */
export function historicalEarningsContext(year: number) {
  return {
    earnings_6yr_median: SIX_YEAR_CONTEXTS[year] ?? { data_file_year: year },
    earnings_10yr_median: TEN_YEAR_CONTEXTS[year] ?? { data_file_year: year },
  };
}
