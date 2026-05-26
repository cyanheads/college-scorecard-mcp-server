/**
 * @fileoverview Tests for the getEarnings tool.
 * @module tests/tools/get-earnings.tool.test
 */

import { JsonRpcErrorCode } from '@cyanheads/mcp-ts-core/errors';
import { createMockContext } from '@cyanheads/mcp-ts-core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
      'latest.earnings.6_yrs_after_entry.percentile25': 35000,
      'latest.earnings.6_yrs_after_entry.percentile75': 70000,
      'latest.earnings.8_yrs_after_entry.median_earnings': 55000,
      'latest.earnings.10_yrs_after_entry.median': 60000,
      'latest.earnings.10_yrs_after_entry.percentile25': 42000,
      'latest.earnings.10_yrs_after_entry.percentile75': 80000,
      'latest.earnings.6_yrs_after_entry.female_students.median_earnings': 45000,
      'latest.earnings.6_yrs_after_entry.male_students.median_earnings': 55000,
      ...overrides,
    },
  ],
});

describe('getEarningsTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('marks suppressed when all earnings fields are null', async () => {
    mockGetSchoolEarnings.mockResolvedValue(
      makeEarningsResult({
        'latest.earnings.6_yrs_after_entry.median': null,
        'latest.earnings.6_yrs_after_entry.percentile25': null,
        'latest.earnings.6_yrs_after_entry.percentile75': null,
        'latest.earnings.8_yrs_after_entry.median_earnings': null,
        'latest.earnings.10_yrs_after_entry.median': null,
        'latest.earnings.10_yrs_after_entry.percentile25': null,
        'latest.earnings.10_yrs_after_entry.percentile75': null,
        'latest.earnings.6_yrs_after_entry.female_students.median_earnings': null,
        'latest.earnings.6_yrs_after_entry.male_students.median_earnings': null,
      }),
    );
    const ctx = createMockContext({ errors: getEarningsTool.errors });
    const input = getEarningsTool.input.parse({ id: 236948 });
    const result = await getEarningsTool.handler(input, ctx);
    expect(result.suppressed).toBe(true);
    expect(result.suppression_note).toBeDefined();
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
    expect(result.trend![0].year).toBe(2011);
  });

  it('omits trend when years not supplied', async () => {
    mockGetSchoolEarnings.mockResolvedValue(makeEarningsResult());
    const ctx = createMockContext({ errors: getEarningsTool.errors });
    const input = getEarningsTool.input.parse({ id: 236948 });
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
        earnings_6yr_female_median: 45000,
        earnings_6yr_male_median: 55000,
      },
      suppressed: false,
    };
    const blocks = getEarningsTool.format!(output);
    expect(blocks[0].type).toBe('text');
    const text = (blocks[0] as { text: string }).text;
    expect(text).toContain('University of Washington');
    expect(text).toContain('50,000');
    expect(text).toContain('6-Year Median');
    expect(text).toContain('10-Year Median');
  });
});
