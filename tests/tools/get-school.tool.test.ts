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
      'latest.aid.median_debt.completers.overall': 17000,
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
