/**
 * @fileoverview Tests for the compareSchools tool.
 * @module tests/tools/compare-schools.tool.test
 */

import { JsonRpcErrorCode } from '@cyanheads/mcp-ts-core/errors';
import { createMockContext, getEnrichment } from '@cyanheads/mcp-ts-core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { compareSchoolsTool } from '@/mcp-server/tools/definitions/compare-schools.tool.js';

const mockGetComparisonData = vi.fn();
vi.mock('@/services/scorecard/scorecard-service.js', () => ({
  getScorecardService: () => ({ getComparisonData: mockGetComparisonData }),
}));

const makeComparisonResult = (records: Record<string, unknown>[] = []) => ({
  results: records,
});

const makeRecord = (id: number, name: string, overrides: Record<string, unknown> = {}) => ({
  id,
  'school.name': name,
  'latest.cost.tuition.in_state': 11839,
  'latest.cost.tuition.out_of_state': 38614,
  'latest.cost.avg_net_price.overall': 15000,
  'latest.cost.avg_net_price.by_income.0-30000': 6000,
  'latest.cost.avg_net_price.by_income.30001-48000': 9000,
  'latest.cost.avg_net_price.by_income.48001-75000': 12000,
  'latest.cost.avg_net_price.by_income.75001-110000': 16000,
  'latest.cost.avg_net_price.by_income.110001-plus': 20000,
  'latest.aid.median_debt.completers.overall': 17000,
  'latest.admissions.admission_rate.overall': 0.52,
  'latest.admissions.sat_scores.average.overall': 1220,
  'latest.admissions.sat_scores.25th_percentile.math': 590,
  'latest.admissions.sat_scores.75th_percentile.math': 720,
  'latest.admissions.act_scores.25th_percentile.cumulative': 26,
  'latest.admissions.act_scores.75th_percentile.cumulative': 32,
  'latest.student.size': 47000,
  'latest.completion.rate_suppressed.overall': 0.82,
  'latest.earnings.6_yrs_after_entry.median': 50000,
  'latest.earnings.10_yrs_after_entry.median': 60000,
  'latest.repayment.3_yr_repayment.overall': 0.67,
  'latest.aid.pell_grant_rate': 0.25,
  'latest.aid.federal_loan_rate': 0.44,
  ...overrides,
});

describe('compareSchoolsTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a comparison for 2 schools on costs topic', async () => {
    mockGetComparisonData.mockResolvedValue(
      makeComparisonResult([
        makeRecord(236948, 'University of Washington'),
        makeRecord(110635, 'University of Oregon'),
      ]),
    );
    const ctx = createMockContext({ errors: compareSchoolsTool.errors });
    const input = compareSchoolsTool.input.parse({ ids: [236948, 110635], topic: 'costs' });
    const result = await compareSchoolsTool.handler(input, ctx);
    expect(result.schools.length).toBe(2);
    expect(result.topic).toBe('costs');
    expect(result.rows.length).toBeGreaterThan(0);
    for (const row of result.rows) {
      expect(row.values.length).toBe(2);
    }
  });

  it('returns a comparison for admissions topic', async () => {
    mockGetComparisonData.mockResolvedValue(
      makeComparisonResult([
        makeRecord(236948, 'University of Washington'),
        makeRecord(110635, 'University of Oregon'),
      ]),
    );
    const ctx = createMockContext({ errors: compareSchoolsTool.errors });
    const input = compareSchoolsTool.input.parse({ ids: [236948, 110635], topic: 'admissions' });
    const result = await compareSchoolsTool.handler(input, ctx);
    expect(result.topic).toBe('admissions');
    expect(result.rows.some((r) => r.metric === 'Acceptance Rate')).toBe(true);
  });

  it('throws schools_not_found when no records returned', async () => {
    mockGetComparisonData.mockResolvedValue(makeComparisonResult([]));
    const ctx = createMockContext({ errors: compareSchoolsTool.errors });
    const input = compareSchoolsTool.input.parse({ ids: [999999, 888888], topic: 'costs' });
    await expect(compareSchoolsTool.handler(input, ctx)).rejects.toMatchObject({
      code: JsonRpcErrorCode.NotFound,
      data: { reason: 'schools_not_found' },
    });
  });

  it('enriches a notice when some IDs return no record', async () => {
    // Only 1 of the 2 IDs returns a record
    mockGetComparisonData.mockResolvedValue(
      makeComparisonResult([makeRecord(236948, 'University of Washington')]),
    );
    const ctx = createMockContext({ errors: compareSchoolsTool.errors });
    const input = compareSchoolsTool.input.parse({ ids: [236948, 999999], topic: 'costs' });
    await compareSchoolsTool.handler(input, ctx);
    const notice = getEnrichment(ctx).notice;
    expect(notice).toBeDefined();
    expect(notice).toContain('999999');
  });

  it('handles suppressed metric values (null data)', async () => {
    mockGetComparisonData.mockResolvedValue(
      makeComparisonResult([
        makeRecord(236948, 'University of Washington', { 'latest.cost.tuition.in_state': null }),
        makeRecord(110635, 'University of Oregon'),
      ]),
    );
    const ctx = createMockContext({ errors: compareSchoolsTool.errors });
    const input = compareSchoolsTool.input.parse({ ids: [236948, 110635], topic: 'costs' });
    const result = await compareSchoolsTool.handler(input, ctx);
    const inStateTuitionRow = result.rows.find((r) => r.metric === 'In-State Tuition');
    expect(inStateTuitionRow).toBeDefined();
    const suppressedValue = inStateTuitionRow!.values.find((v) => v.school_id === 236948);
    expect(suppressedValue!.suppressed).toBe(true);
  });

  it('formats output with value and rank for all data points', () => {
    const output = {
      schools: [
        { id: 236948, name: 'University of Washington' },
        { id: 110635, name: 'University of Oregon' },
      ],
      topic: 'costs',
      rows: [
        {
          metric: 'In-State Tuition',
          values: [
            { school_id: 236948, value: 11839, rank: 1, suppressed: false },
            { school_id: 110635, value: 13000, rank: 2, suppressed: false },
          ],
          unit: '$',
        },
        {
          metric: 'Out-of-State Tuition',
          values: [
            { school_id: 236948, suppressed: true },
            { school_id: 110635, value: 38000, rank: 1, suppressed: false },
          ],
          unit: '$',
        },
      ],
    };
    const blocks = compareSchoolsTool.format!(output);
    expect(blocks[0].type).toBe('text');
    const text = (blocks[0] as { text: string }).text;
    expect(text).toContain('University of Washington');
    expect(text).toContain('In-State Tuition');
    expect(text).toContain('(#1)');
    expect(text).toContain('11,839');
  });
});
