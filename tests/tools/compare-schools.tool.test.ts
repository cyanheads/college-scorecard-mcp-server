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

/**
 * Mirrors the live College Scorecard shape for a public school (ownership=1):
 * net price by income under `net_price.public.by_income_level.*`, and
 * `repayment_cohort.3_year_declining_balance` as a 0–1 decimal.
 */
const makeRecord = (id: number, name: string, overrides: Record<string, unknown> = {}) => ({
  id,
  'school.name': name,
  'latest.cost.tuition.in_state': 11839,
  'latest.cost.tuition.out_of_state': 38614,
  'latest.cost.avg_net_price.overall': 15000,
  'latest.cost.net_price.public.by_income_level.0-30000': 6384,
  'latest.cost.net_price.public.by_income_level.30001-48000': 7039,
  'latest.cost.net_price.public.by_income_level.48001-75000': 8110,
  'latest.cost.net_price.public.by_income_level.75001-110000': 14328,
  'latest.cost.net_price.public.by_income_level.110001-plus': 30019,
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
  'latest.repayment.repayment_cohort.3_year_declining_balance': 0.7903764139,
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

  // Regression (issue #7): the costs topic's net-price-by-income rows must read
  // the ownership-keyed net_price.public/private.* paths. With the old
  // avg_net_price.by_income.* paths the rows were always suppressed.
  it('populates net-price-by-income rows for a public school', async () => {
    mockGetComparisonData.mockResolvedValue(
      makeComparisonResult([
        makeRecord(236948, 'University of Washington'),
        makeRecord(110635, 'University of Oregon'),
      ]),
    );
    const ctx = createMockContext({ errors: compareSchoolsTool.errors });
    const input = compareSchoolsTool.input.parse({ ids: [236948, 110635], topic: 'costs' });
    const result = await compareSchoolsTool.handler(input, ctx);
    const bracketRow = result.rows.find((r) => r.metric === 'Net Price ($0–30k income)');
    expect(bracketRow).toBeDefined();
    const uw = bracketRow!.values.find((v) => v.school_id === 236948);
    expect(uw!.suppressed).toBe(false);
    expect(uw!.value).toBe(6384);
  });

  // Issue #7: a private school reports brackets under net_price.private.*; the
  // comparison must coalesce public → private and read the value either way.
  it('reads net-price-by-income from the private path for a private school', async () => {
    const privateRecord = {
      id: 166027,
      'school.name': 'Harvard University',
      'latest.cost.net_price.private.by_income_level.0-30000': 8697,
    };
    mockGetComparisonData.mockResolvedValue(
      makeComparisonResult([makeRecord(236948, 'University of Washington'), privateRecord]),
    );
    const ctx = createMockContext({ errors: compareSchoolsTool.errors });
    const input = compareSchoolsTool.input.parse({ ids: [236948, 166027], topic: 'costs' });
    const result = await compareSchoolsTool.handler(input, ctx);
    const bracketRow = result.rows.find((r) => r.metric === 'Net Price ($0–30k income)');
    const harvard = bracketRow!.values.find((v) => v.school_id === 166027);
    expect(harvard!.suppressed).toBe(false);
    expect(harvard!.value).toBe(8697);
  });

  // Regression (issue #6): the repayment row reads
  // repayment_cohort.3_year_declining_balance (a 0–1 decimal) with no scaling.
  // The old code read a count field and scaled by 1/1000, so the rendered
  // percentage was effectively zero (e.g. 0.79/1000 → 0.079%).
  it('surfaces 3-Year Repayment Progress as a 0–1 value in the outcomes topic', async () => {
    mockGetComparisonData.mockResolvedValue(
      makeComparisonResult([
        makeRecord(236948, 'University of Washington'),
        makeRecord(110635, 'University of Oregon'),
      ]),
    );
    const ctx = createMockContext({ errors: compareSchoolsTool.errors });
    const input = compareSchoolsTool.input.parse({ ids: [236948, 110635], topic: 'outcomes' });
    const result = await compareSchoolsTool.handler(input, ctx);
    const repaymentRow = result.rows.find((r) => r.metric === '3-Year Repayment Progress');
    expect(repaymentRow).toBeDefined();
    const uw = repaymentRow!.values.find((v) => v.school_id === 236948);
    expect(uw!.value).toBeCloseTo(0.7903764139, 5);
    expect(uw!.value!).toBeLessThanOrEqual(1);
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
