/**
 * @fileoverview Independent population, availability, and provenance contracts.
 * @module tests/services/program-outcomes.test
 */
import { describe, expect, it } from 'vitest';
import { PROGRAM_PROVENANCE } from '@/data/program-provenance.js';
import { programOutcomes } from '@/services/scorecard/program-outcomes.js';
import reference from '../fixtures/program-provenance.json' with { type: 'json' };

describe('program populations', () => {
  it.each([
    [0, 'available', 0],
    [100, 'available', 100],
    [null, 'unavailable', undefined],
    [undefined, 'unavailable', undefined],
    ['PS', 'privacy_suppressed', undefined],
    ['PrivacySuppressed', 'privacy_suppressed', undefined],
  ] as const)('classifies each median and count independently: %s', (raw, availability, value) => {
    const metric =
      raw === undefined
        ? {}
        : { overall_median_earnings: raw, working_not_enrolled: { overall_count: raw } };
    const result = programOutcomes({
      earnings: { highest: { '1_yr': metric }, '1_yr': metric, '4_yr': metric },
    });
    expect(result).toMatchObject({
      earnings_availability: availability,
      earnings_count_availability: availability,
      completion_1yr_availability: availability,
      completion_1yr_count_availability: availability,
      completion_4yr_availability: availability,
      completion_4yr_count_availability: availability,
    });
    expect(result.earnings_1yr_median).toBe(value);
    expect(result.earnings_count).toBe(value);
    expect(result.completion_1yr_median).toBe(value);
    expect(result.completion_1yr_count).toBe(value);
    expect(result.completion_4yr_median).toBe(value);
    expect(result.completion_4yr_count).toBe(value);
  });
  it('does not fill absent current metrics from available legacy metrics', () => {
    expect(
      programOutcomes({
        earnings: {
          highest: { '1_yr': { overall_median_earnings: 99999 } },
          '1_yr': { overall_median_earnings: 'PS', working_not_enrolled: { overall_count: 0 } },
          '4_yr': { overall_median_earnings: 0, working_not_enrolled: { overall_count: 'PS' } },
        },
      }),
    ).toMatchObject({
      earnings_1yr_median: 99999,
      completion_1yr_availability: 'privacy_suppressed',
      completion_1yr_count: 0,
      completion_4yr_median: 0,
      completion_4yr_count_availability: 'privacy_suppressed',
    });
    expect(
      programOutcomes({ earnings: { highest: { '1_yr': { overall_median_earnings: 99999 } } } })
        .completion_1yr_median,
    ).toBeUndefined();
  });
  it('rejects an unexpected provider metric instead of fabricating availability', () => {
    expect(() =>
      programOutcomes({ earnings: { '1_yr': { overall_median_earnings: Number.NaN } } }),
    ).toThrow('Unexpected provider metric');
  });
  it('pins separate dictionary cohorts and current dollar years', () => {
    expect(PROGRAM_PROVENANCE.highest_credential_1yr).toMatchObject({
      cohort: ['2016-17', '2017-18'],
      measurement_years: [2018, 2019],
      dollar_year: 2020,
      median_cell: 'K80',
      count_cell: 'K79',
    });
    expect(PROGRAM_PROVENANCE.completion_1yr).toMatchObject({
      cohort: ['2020-21', '2021-22'],
      measurement_years: [2022, 2023],
      dollar_year: 2024,
      median_cell: 'K125',
      count_cell: 'K124',
    });
    expect(PROGRAM_PROVENANCE.completion_4yr).toMatchObject({
      cohort: ['2017-18', '2018-19'],
      measurement_years: [2022, 2023],
      dollar_year: 2024,
      median_cell: 'K131',
      count_cell: 'K130',
    });
    expect(PROGRAM_PROVENANCE.debt.cohort).toEqual(['2022-23', '2023-24']);
    expect(PROGRAM_PROVENANCE.ipeds_awards_year1.academic_year).toBe('2022-23');
    expect(PROGRAM_PROVENANCE.ipeds_awards_year2.academic_year).toBe('2023-24');
    expect(reference.cells.K125).toBe(
      'Treasury AY2020-21, AY2021-22 pooled earnings cohort measured in CY2022, CY2023, inflation adjusted to 2024 dollars',
    );
    expect(reference.cells.K15).toBe('NSLDS pooled AY2022-23, AY2023-24 cohort');
    expect(PROGRAM_PROVENANCE.debt_at_institution).toMatchObject({
      cohort: ['2022-23', '2023-24'],
      cell: 'K18',
      variable: 'DEBT_ALL_STGP_EVAL_MDN',
    });
    expect(reference.cells.K18).toBe('NSLDS pooled AY2022-23, AY2023-24 cohort');
  });

  it.each([
    ['completion_1yr_national', ['K204', 'K206', 'K208', 'K199'], [2024, null, null]],
    ['completion_4yr_national', ['K177', 'K178', 'K179', 'K176'], [2024, 2024, 2024]],
  ] as const)('uses independent dictionary provenance for %s', (key, cells, dollarYears) => {
    const { median, p25, p75, count } = PROGRAM_PROVENANCE[key];
    expect([median.cell, p25.cell, p75.cell, count.cell]).toEqual(cells);
    expect([median.dollar_year, p25.dollar_year, p75.dollar_year]).toEqual(dollarYears);
    expect(reference.cells[cells[3]]).toMatch(/measured in CY2022, CY2023$/);
    for (const [index, year] of dollarYears.entries()) {
      const source = reference.cells[cells[index]!];
      if (year == null) expect(source).not.toContain('inflation adjusted');
      else expect(source).toContain('inflation adjusted to 2024 dollars');
    }
  });

  it('keeps graduate zero and treats suppressed debt as unavailable for either series', () => {
    const result = programOutcomes({
      credential: { level: 8 },
      debt: { staff_grad_plus: { all: { all_inst: { median: 'PS' }, eval_inst: { median: 0 } } } },
    });
    expect(result).not.toHaveProperty('median_debt');
    expect(result.median_debt_at_institution).toBe(0);
    expect(
      programOutcomes({
        credential: { level: 7 },
        debt: {
          staff_grad_plus: {
            all: { all_inst: { median: 100 }, eval_inst: { median: 'PrivacySuppressed' } },
          },
        },
      }),
    ).toMatchObject({ median_debt: 100 });
    expect(
      programOutcomes({
        credential: { level: 7 },
        debt: { staff_grad_plus: { all: { eval_inst: { median: 'PrivacySuppressed' } } } },
      }),
    ).not.toHaveProperty('median_debt_at_institution');
  });
});
