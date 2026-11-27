/**
 * @fileoverview Dictionary-derived most-recent field-of-study provenance.
 * @module data/program-provenance
 */
import { z } from '@cyanheads/mcp-ts-core';

/** Source cells are in FieldOfStudy_Cohort_Map, column K (most recent), with names from FieldOfStudy_Data_Dictionary. */
export const PROGRAM_PROVENANCE = {
  source: 'https://collegescorecard.ed.gov/files/CollegeScorecardDataDictionary.xlsx',
  highest_credential_1yr: {
    cohort: ['2016-17', '2017-18'],
    measurement_years: [2018, 2019],
    dollar_year: 2020,
    median_variable: 'EARN_MDN_HI_1YR',
    count_variable: 'EARN_COUNT_WNE_HI_1YR',
    median_cell: 'K80',
    count_cell: 'K79',
    population:
      'Federally aided graduates working and not enrolled one year after their highest credential',
  },
  completion_1yr: {
    cohort: ['2020-21', '2021-22'],
    measurement_years: [2022, 2023],
    dollar_year: 2024,
    median_variable: 'EARN_MDN_1YR',
    count_variable: 'EARN_COUNT_WNE_1YR',
    median_cell: 'K125',
    count_cell: 'K124',
    population: 'Federally aided graduates working and not enrolled one year after completion',
  },
  completion_4yr: {
    cohort: ['2017-18', '2018-19'],
    measurement_years: [2022, 2023],
    dollar_year: 2024,
    median_variable: 'EARN_MDN_4YR',
    count_variable: 'EARN_COUNT_WNE_4YR',
    median_cell: 'K131',
    count_cell: 'K130',
    population: 'Federally aided graduates working and not enrolled four years after completion',
  },
  completion_1yr_national: {
    cohort: ['2020-21', '2021-22'],
    measurement_years: [2022, 2023],
    population:
      'Federally aided graduates nationwide working and not enrolled one year after completion',
    median: { variable: 'EARN_MDN_1YR_NAT', cell: 'K204', dollar_year: 2024 },
    p25: { variable: 'EARN_P25_1YR_NAT', cell: 'K206', dollar_year: null },
    p75: { variable: 'EARN_P75_1YR_NAT', cell: 'K208', dollar_year: null },
    count: { variable: 'EARN_COUNT_WNE_1YR_NAT', cell: 'K199' },
  },
  completion_4yr_national: {
    cohort: ['2017-18', '2018-19'],
    measurement_years: [2022, 2023],
    population:
      'Federally aided graduates nationwide working and not enrolled four years after completion',
    median: { variable: 'EARN_MDN_4YR_NAT', cell: 'K177', dollar_year: 2024 },
    p25: { variable: 'EARN_P25_4YR_NAT', cell: 'K178', dollar_year: 2024 },
    p75: { variable: 'EARN_P75_4YR_NAT', cell: 'K179', dollar_year: 2024 },
    count: { variable: 'EARN_COUNT_WNE_4YR_NAT', cell: 'K176' },
  },
  debt: {
    cohort: ['2022-23', '2023-24'],
    variable: 'DEBT_ALL_STGP_ANY_MDN',
    cell: 'K15',
    population:
      'Completers with Stafford/Grad PLUS borrowing across attended institutions at the same academic level',
  },
  debt_at_institution: {
    cohort: ['2022-23', '2023-24'],
    variable: 'DEBT_ALL_STGP_EVAL_MDN',
    cell: 'K18',
    population:
      'Graduate-credential completers with Stafford/Grad PLUS borrowing disbursed at this institution at the same academic level',
  },
  ipeds_awards_year1: {
    academic_year: '2022-23',
    variable: 'IPEDSCOUNT1',
    cell: 'K11',
    population: 'Campus awards, not enrollment or unique students',
  },
  ipeds_awards_year2: {
    academic_year: '2023-24',
    variable: 'IPEDSCOUNT2',
    cell: 'K12',
    population: 'Campus awards, not enrollment or unique students',
  },
};

const EarningsCohortSchema = z.object({
  cohort: z
    .array(z.string().describe('Academic year.'))
    .describe('Pooled completion academic years.'),
  measurement_years: z
    .array(z.number().describe('Calendar year.'))
    .describe('Earnings measurement calendar years.'),
  population: z.string().describe('Population represented.'),
});
const SeriesSchema = EarningsCohortSchema.extend({
  dollar_year: z.number().describe('Inflation-adjusted dollar year.'),
  median_variable: z.string().describe('Dictionary median variable.'),
  count_variable: z.string().describe('Dictionary count variable.'),
  median_cell: z.string().describe('Most-recent median map cell.'),
  count_cell: z.string().describe('Most-recent count map cell.'),
});
const DictionaryMetricSchema = z.object({
  variable: z.string().describe('Dictionary variable.'),
  cell: z.string().describe('Most-recent map cell.'),
});
const NationalDollarMetricSchema = DictionaryMetricSchema.extend({
  dollar_year: z.number().nullable().describe('Inflation-adjusted dollar year when recorded.'),
});
const NationalSeriesSchema = EarningsCohortSchema.extend({
  median: NationalDollarMetricSchema.describe('National median earnings provenance.'),
  p25: NationalDollarMetricSchema.describe('National 25th-percentile earnings provenance.'),
  p75: NationalDollarMetricSchema.describe('National 75th-percentile earnings provenance.'),
  count: DictionaryMetricSchema.describe('National population count provenance.'),
});
const DebtSchema = DictionaryMetricSchema.extend({
  cohort: z.array(z.string().describe('Academic year.')).describe('Pooled debt academic years.'),
  population: z.string().describe('Borrower population.'),
});
const AwardSchema = z.object({
  academic_year: z.string().describe('Academic year of awards.'),
  variable: z.string().describe('Dictionary variable.'),
  cell: z.string().describe('Most-recent map cell.'),
  population: z.string().describe('Awards population.'),
});
/** Public provenance shape shared by program tools. */
export const ProgramProvenanceSchema = z.object({
  source: z.string().describe('Official dictionary URL.'),
  highest_credential_1yr: SeriesSchema.describe('Legacy highest-credential series.'),
  completion_1yr: SeriesSchema.describe('Current completion-based one-year series.'),
  completion_4yr: SeriesSchema.describe('Current completion-based four-year series.'),
  completion_1yr_national: NationalSeriesSchema.describe('National one-year completion benchmark.'),
  completion_4yr_national: NationalSeriesSchema.describe(
    'National four-year completion benchmark.',
  ),
  debt: DebtSchema.describe('All-institutions debt provenance.'),
  debt_at_institution: DebtSchema.describe('Graduate at-institution debt provenance.'),
  ipeds_awards_year1: AwardSchema.describe('First debt-cohort year awards.'),
  ipeds_awards_year2: AwardSchema.describe('Second debt-cohort year awards.'),
});

/** Institutional outcomes pool by OPEID6; national benchmarks pool by CIP and credential. */
export const PROGRAM_METRIC_SCOPE = {
  earnings: 'opeid6',
  national_earnings: 'national',
  debt: 'opeid6',
  ipeds_awards: 'campus',
  program_identity: 'CIP code and credential level',
} as const;
/** Program scope metadata without inferred group identifiers. */
export const ProgramMetricScopeSchema = z.object({
  earnings: z.literal('opeid6').describe('Earnings pool across campuses sharing OPEID6.'),
  national_earnings: z
    .literal('national')
    .describe('Benchmarks pool nationwide by CIP and credential.'),
  debt: z.literal('opeid6').describe('Debt pools across campuses sharing OPEID6.'),
  ipeds_awards: z.literal('campus').describe('Awards belong to the campus.'),
  program_identity: z.string().describe('Program dimensions retained within each pooled group.'),
});
