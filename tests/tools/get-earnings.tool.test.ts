/**
 * @fileoverview Tests for the getEarnings tool.
 * @module tests/tools/get-earnings.tool.test
 */

import { JsonRpcErrorCode } from '@cyanheads/mcp-ts-core/errors';
import { createMockContext, runToolContract } from '@cyanheads/mcp-ts-core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EARNINGS_FIELDS, LATEST_EARNINGS_CONTEXT } from '@/data/earnings-context.js';
import { getEarningsTool } from '@/mcp-server/tools/definitions/get-earnings.tool.js';

const mockGetSchoolEarnings = vi.fn();
vi.mock('@/services/scorecard/scorecard-service.js', () => ({
  getScorecardService: () => ({ getSchoolEarnings: mockGetSchoolEarnings }),
}));

const makeEarningsResult = (overrides: Record<string, unknown> = {}) => ({
  metadata: { total: 1, page: 0, per_page: 1 },
  results: [
    {
      id: 236948,
      'school.name': 'University of Washington',
      'latest.earnings.6_yrs_after_entry.median': 50000,
      'latest.earnings.6_yrs_after_entry.working_not_enrolled.earnings_percentile.25': 35000,
      'latest.earnings.6_yrs_after_entry.working_not_enrolled.earnings_percentile.75': 70000,
      'latest.earnings.8_yrs_after_entry.median_earnings': 55000,
      'latest.earnings.10_yrs_after_entry.median': 60000,
      'latest.earnings.10_yrs_after_entry.working_not_enrolled.earnings_percentile.25': 42000,
      'latest.earnings.10_yrs_after_entry.working_not_enrolled.earnings_percentile.75': 80000,
      'latest.earnings.6_yrs_after_entry.median_earnings_non_male': 45000,
      'latest.earnings.6_yrs_after_entry.median_earnings_male': 55000,
      ...overrides,
    },
  ],
});

describe('getEarningsTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders independently verified 2022 provenance for latest and historical metrics', async () => {
    mockGetSchoolEarnings.mockResolvedValue(makeEarningsResult());
    const result = await runToolContract(getEarningsTool, {
      id: 236948,
      years: [2020, 2021, 2022],
    });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({
      current_context: {
        earnings_6yr_median: {
          data_file_year: 2022,
          entry_cohorts: ['2015-16', '2016-17'],
          measurement_years: [2022, 2023],
          dollar_year: 2024,
        },
        earnings_8yr_median: { data_file_year: 2022, entry_cohorts: ['2013-14', '2014-15'] },
        earnings_10yr_median: { data_file_year: 2022, entry_cohorts: ['2011-12', '2012-13'] },
      },
      trend: [
        {
          year: 2020,
          context: { earnings_6yr_median: { data_file_year: 2020, dollar_year: 2022 } },
        },
        { year: 2021, context: { earnings_6yr_median: { data_file_year: 2021 } } },
        {
          year: 2022,
          context: { earnings_6yr_median: { data_file_year: 2022, dollar_year: 2024 } },
        },
      ],
    });
    const text = result.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('\n');
    expect(text).toContain(
      'Data-file year: 2022 | Entry cohorts: 2015-16, 2016-17 | Measurement years: 2022, 2023 | Dollar year: 2024',
    );
  });

  it('returns earnings for a valid school ID', async () => {
    mockGetSchoolEarnings.mockResolvedValue(makeEarningsResult());
    const ctx = createMockContext({ errors: getEarningsTool.errors });
    const input = getEarningsTool.input.parse({ id: 236948 });
    const result = await getEarningsTool.handler(input, ctx);
    expect(result.school_id).toBe(236948);
    expect(result.school_name).toBe('University of Washington');
    expect(result.current.earnings_6yr_median).toBe(50000);
    expect(result.suppressed).toBe(false);
  });

  it('requests and renders distinct historical years in caller order', async () => {
    mockGetSchoolEarnings.mockResolvedValue(makeEarningsResult());
    const result = await runToolContract(getEarningsTool, {
      id: 236948,
      years: [2022, 2020, 2022, 2021, 2020],
    });
    expect(mockGetSchoolEarnings.mock.calls[0]?.[1]).toEqual([2022, 2020, 2021]);
    expect(result.structuredContent).toMatchObject({
      trend: [{ year: 2022 }, { year: 2020 }, { year: 2021 }],
    });
    const text = result.content.map((block) => ('text' in block ? block.text : '')).join('\n');
    expect(text.match(/^Year: \d+$/gm)).toEqual(['Year: 2022', 'Year: 2020', 'Year: 2021']);
  });

  it('marks null earnings unavailable without asserting suppression', async () => {
    mockGetSchoolEarnings.mockResolvedValue(
      makeEarningsResult({
        'latest.earnings.6_yrs_after_entry.median': null,
        'latest.earnings.6_yrs_after_entry.working_not_enrolled.earnings_percentile.25': null,
        'latest.earnings.6_yrs_after_entry.working_not_enrolled.earnings_percentile.75': null,
        'latest.earnings.8_yrs_after_entry.median_earnings': null,
        'latest.earnings.10_yrs_after_entry.median': null,
        'latest.earnings.10_yrs_after_entry.working_not_enrolled.earnings_percentile.25': null,
        'latest.earnings.10_yrs_after_entry.working_not_enrolled.earnings_percentile.75': null,
        'latest.earnings.6_yrs_after_entry.median_earnings_non_male': null,
        'latest.earnings.6_yrs_after_entry.median_earnings_male': null,
      }),
    );
    const ctx = createMockContext({ errors: getEarningsTool.errors });
    const input = getEarningsTool.input.parse({ id: 236948 });
    const result = await getEarningsTool.handler(input, ctx);
    expect(result.suppressed).toBe(false);
    expect(result.suppression_note).toBeUndefined();
    expect(Object.values(result.current_availability)).toEqual(Array(9).fill('unavailable'));
  });

  it('returns trend rows when years parameter is supplied', async () => {
    const base = makeEarningsResult({
      '2011.earnings.6_yrs_after_entry.median': 45000,
      '2012.earnings.6_yrs_after_entry.median': 47000,
    });
    mockGetSchoolEarnings.mockResolvedValue(base);
    const ctx = createMockContext({ errors: getEarningsTool.errors });
    const input = getEarningsTool.input.parse({ id: 236948, years: [2011, 2012] });
    const result = await getEarningsTool.handler(input, ctx);
    expect(result.trend).toBeDefined();
    expect(result.trend!.length).toBe(2);
    expect(result.trend![0]!.year).toBe(2011);
  });

  it.each([undefined, []])('omits trend for snapshot-only years %j', async (years) => {
    mockGetSchoolEarnings.mockResolvedValue(makeEarningsResult());
    const ctx = createMockContext({ errors: getEarningsTool.errors });
    const input = getEarningsTool.input.parse({ id: 236948, years });
    const result = await getEarningsTool.handler(input, ctx);
    expect(result.trend).toBeUndefined();
  });

  it('throws school_not_found when no results returned', async () => {
    mockGetSchoolEarnings.mockResolvedValue({
      metadata: { total: 0, page: 0, per_page: 1 },
      results: [],
    });
    const ctx = createMockContext({ errors: getEarningsTool.errors });
    const input = getEarningsTool.input.parse({ id: 999999 });
    await expect(getEarningsTool.handler(input, ctx)).rejects.toMatchObject({
      code: JsonRpcErrorCode.NotFound,
      data: { reason: 'school_not_found' },
    });
  });

  it('formats output with earnings fields labeled', () => {
    const output = {
      school_id: 236948,
      school_name: 'University of Washington',
      current: {
        earnings_6yr_median: 50000,
        earnings_6yr_p25: 35000,
        earnings_6yr_p75: 70000,
        earnings_8yr_median: 55000,
        earnings_10yr_median: 60000,
        earnings_10yr_p25: 42000,
        earnings_10yr_p75: 80000,
        earnings_6yr_non_male_median: 45000,
        earnings_6yr_male_median: 55000,
      },
      suppressed: false,
      current_availability: Object.fromEntries(
        Object.keys(EARNINGS_FIELDS).map((key) => [key, 'available' as const]),
      ),
      current_context: LATEST_EARNINGS_CONTEXT,
    };
    const blocks = getEarningsTool.format!(output);
    expect(blocks[0]!.type).toBe('text');
    const text = (blocks[0] as { text: string }).text;
    expect(text).toContain('University of Washington');
    expect(text).toContain('50,000');
    expect(text).toContain('6-Year Median');
    expect(text).toContain('10-Year Median');
    expect(text).toContain(
      '6-Year Median: available | Data-file year: 2022 | Entry cohorts: 2015-16, 2016-17 | Measurement years: 2022, 2023 | Dollar year: 2024',
    );
    expect(text).toContain(
      '8-Year Median: available | Data-file year: 2022 | Entry cohorts: 2013-14, 2014-15',
    );
    expect(text).not.toContain('{"earnings_');
  });
});
