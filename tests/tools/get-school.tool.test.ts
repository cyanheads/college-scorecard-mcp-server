/**
 * @fileoverview Tests for the getSchool tool.
 * @module tests/tools/get-school.tool.test
 */

import { JsonRpcErrorCode } from '@cyanheads/mcp-ts-core/errors';
import { createMockContext, getEnrichment } from '@cyanheads/mcp-ts-core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSchoolTool } from '@/mcp-server/tools/definitions/get-school.tool.js';

const mockGetSchoolProfiles = vi.fn();
vi.mock('@/services/scorecard/scorecard-service.js', () => ({
  getScorecardService: () => ({ getSchoolProfiles: mockGetSchoolProfiles }),
}));

const makeProfileResult = (overrides: Record<string, unknown> = {}) => ({
  metadata: { total: 1, page: 0, per_page: 1 },
  results: [
    {
      id: 236948,
      'school.name': 'University of Washington',
      'school.city': 'Seattle',
      'school.state': 'WA',
      'school.zip': '98195',
      'school.school_url': 'www.washington.edu',
      'school.ownership': 1,
      'school.degrees_awarded.predominant': 3,
      'school.hbcu': 0,
      'latest.student.size': 47000,
      'latest.admissions.admission_rate.overall': 0.52,
      'latest.cost.tuition.in_state': 11839,
      'latest.cost.tuition.out_of_state': 38614,
      'latest.cost.avg_net_price.overall': 15000,
      'latest.cost.net_price.public.by_income_level.0-30000': 6384,
      'latest.cost.net_price.public.by_income_level.30001-48000': 7039,
      'latest.cost.net_price.public.by_income_level.48001-75000': 8110,
      'latest.cost.net_price.public.by_income_level.75001-110000': 14328,
      'latest.cost.net_price.public.by_income_level.110001-plus': 30019,
      'latest.aid.median_debt.completers.overall': 17000,
      'latest.repayment.repayment_cohort.3_year_declining_balance': 0.7903764139,
      'latest.earnings.6_yrs_after_entry.median': 50000,
      'latest.earnings.10_yrs_after_entry.median': 60000,
      ...overrides,
    },
  ],
});

describe('getSchoolTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a full profile for a single school ID', async () => {
    mockGetSchoolProfiles.mockResolvedValue(makeProfileResult());
    const ctx = createMockContext({ errors: getSchoolTool.errors });
    const input = getSchoolTool.input.parse({ id: 236948 });
    const result = await getSchoolTool.handler(input, ctx);
    expect(result.schools.length).toBe(1);
    expect(result.schools[0].name).toBe('University of Washington');
    expect(result.schools[0].ownership).toBe('Public');
    expect(result.total_requested).toBe(1);
    expect(result.total_found).toBe(1);
  });

  it('accepts an array of IDs', async () => {
    mockGetSchoolProfiles.mockResolvedValue(makeProfileResult());
    const ctx = createMockContext({ errors: getSchoolTool.errors });
    const input = getSchoolTool.input.parse({ id: [236948] });
    const result = await getSchoolTool.handler(input, ctx);
    expect(result.total_requested).toBe(1);
  });

  it('accepts a string ID', async () => {
    mockGetSchoolProfiles.mockResolvedValue(makeProfileResult());
    const ctx = createMockContext({ errors: getSchoolTool.errors });
    const input = getSchoolTool.input.parse({ id: '236948' });
    const result = await getSchoolTool.handler(input, ctx);
    expect(result.schools.length).toBe(1);
  });

  it('enriches a notice when fewer schools returned than requested', async () => {
    // Request 2 IDs but only 1 returns
    mockGetSchoolProfiles.mockResolvedValue(makeProfileResult());
    const ctx = createMockContext({ errors: getSchoolTool.errors });
    const input = getSchoolTool.input.parse({ id: [236948, 999999] });
    const result = await getSchoolTool.handler(input, ctx);
    expect(getEnrichment(ctx).notice).toBeDefined();
    expect(result.total_requested).toBe(2);
    expect(result.total_found).toBe(1);
  });

  it('throws not_found when no schools returned', async () => {
    mockGetSchoolProfiles.mockResolvedValue({
      metadata: { total: 0, page: 0, per_page: 1 },
      results: [],
    });
    const ctx = createMockContext({ errors: getSchoolTool.errors });
    const input = getSchoolTool.input.parse({ id: 999999 });
    await expect(getSchoolTool.handler(input, ctx)).rejects.toMatchObject({
      code: JsonRpcErrorCode.NotFound,
      data: { reason: 'not_found' },
    });
  });

  it('handles sparse upstream records gracefully', async () => {
    mockGetSchoolProfiles.mockResolvedValue(
      makeProfileResult({
        'school.city': null,
        'school.state': null,
        'latest.student.size': null,
        'latest.admissions.admission_rate.overall': null,
        'latest.cost.tuition.in_state': null,
      }),
    );
    const ctx = createMockContext({ errors: getSchoolTool.errors });
    const input = getSchoolTool.input.parse({ id: 236948 });
    const result = await getSchoolTool.handler(input, ctx);
    expect(result.schools[0].city).toBeUndefined();
    expect(result.schools[0].enrollment).toBeUndefined();
    expect(result.schools[0].admission_rate).toBeUndefined();
  });

  // Regression (issue #6): repayment_progress_3yr reads
  // repayment_cohort.3_year_declining_balance (a 0–1 decimal) with no scaling.
  // The old code read a borrower-count field and divided by 1000, producing
  // absurd values like 10.786 (rendered as 1078.6%).
  it('surfaces repayment_progress_3yr as a 0–1 decimal without scaling', async () => {
    mockGetSchoolProfiles.mockResolvedValue(makeProfileResult());
    const ctx = createMockContext({ errors: getSchoolTool.errors });
    const input = getSchoolTool.input.parse({ id: 236948 });
    const result = await getSchoolTool.handler(input, ctx);
    expect(result.schools[0].repayment_progress_3yr).toBeCloseTo(0.7903764139, 5);
    expect(result.schools[0].repayment_progress_3yr!).toBeLessThanOrEqual(1);
  });

  // Regression (issue #7): net price by income reads the ownership-keyed
  // net_price.public/private.by_income_level.* paths. A public school populates
  // every bracket; the old avg_net_price.by_income.* paths returned null.
  it('populates net-price-by-income brackets for a public school', async () => {
    mockGetSchoolProfiles.mockResolvedValue(makeProfileResult());
    const ctx = createMockContext({ errors: getSchoolTool.errors });
    const input = getSchoolTool.input.parse({ id: 236948 });
    const result = await getSchoolTool.handler(input, ctx);
    expect(result.schools[0].net_price_0_30k).toBe(6384);
    expect(result.schools[0].net_price_110k_plus).toBe(30019);
  });

  // Issue #7: a private school reports brackets under net_price.private.*; the
  // normalizer coalesces public → private and surfaces the value either way.
  it('reads net-price-by-income from the private path for a private school', async () => {
    mockGetSchoolProfiles.mockResolvedValue(
      makeProfileResult({
        'school.ownership': 2,
        'latest.cost.net_price.public.by_income_level.0-30000': null,
        'latest.cost.net_price.public.by_income_level.30001-48000': null,
        'latest.cost.net_price.public.by_income_level.48001-75000': null,
        'latest.cost.net_price.public.by_income_level.75001-110000': null,
        'latest.cost.net_price.public.by_income_level.110001-plus': null,
        'latest.cost.net_price.private.by_income_level.0-30000': 8697,
      }),
    );
    const ctx = createMockContext({ errors: getSchoolTool.errors });
    const input = getSchoolTool.input.parse({ id: 236948 });
    const result = await getSchoolTool.handler(input, ctx);
    expect(result.schools[0].ownership).toBe('Private nonprofit');
    expect(result.schools[0].net_price_0_30k).toBe(8697);
  });

  it('formats output with school name, ID, and metrics', () => {
    const output = {
      schools: [
        {
          id: 236948,
          name: 'University of Washington',
          city: 'Seattle',
          state: 'WA',
          ownership: 'Public',
          degree_level: "Bachelor's",
          enrollment: 47000,
          admission_rate: 0.52,
          tuition_in_state: 11839,
          tuition_out_of_state: 38614,
          net_price_overall: 15000,
          median_debt: 17000,
          earnings_6yr_median: 50000,
          earnings_10yr_median: 60000,
        },
      ],
      total_requested: 1,
      total_found: 1,
    };
    const blocks = getSchoolTool.format!(output);
    expect(blocks[0].type).toBe('text');
    const text = (blocks[0] as { text: string }).text;
    expect(text).toContain('University of Washington');
    expect(text).toContain('236948');
    expect(text).toContain('11,839');
    expect(text).toContain('50,000');
  });
});
