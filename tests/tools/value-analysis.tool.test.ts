/**
 * @fileoverview Tests for the valueAnalysis tool.
 * @module tests/tools/value-analysis.tool.test
 */

import { JsonRpcErrorCode } from '@cyanheads/mcp-ts-core/errors';
import { createMockContext } from '@cyanheads/mcp-ts-core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { valueAnalysisTool } from '@/mcp-server/tools/definitions/value-analysis.tool.js';

const mockGetValueAnalysisData = vi.fn();
vi.mock('@/services/scorecard/scorecard-service.js', () => ({
  getScorecardService: () => ({ getValueAnalysisData: mockGetValueAnalysisData }),
}));

/**
 * Mirrors the live College Scorecard shape for a public school (UW, ownership=1):
 * net price by income lives under `net_price.public.by_income_level.*`, and
 * `repayment_cohort.3_year_declining_balance` is a 0–1 decimal (not a count).
 */
const makeCostRecord = (overrides: Record<string, unknown> = {}) => ({
  id: 236948,
  'school.name': 'University of Washington',
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
  'latest.completion.rate_suppressed.overall': 0.82,
  ...overrides,
});

const makeEarningsRecord = (overrides: Record<string, unknown> = {}) => ({
  id: 236948,
  'school.name': 'University of Washington',
  'latest.earnings.6_yrs_after_entry.median': 50000,
  'latest.earnings.10_yrs_after_entry.median': 60000,
  ...overrides,
});

describe('valueAnalysisTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns complete value analysis for a valid school', async () => {
    mockGetValueAnalysisData.mockResolvedValue([
      { results: [makeCostRecord()] },
      { results: [makeEarningsRecord()] },
    ]);
    const ctx = createMockContext({ errors: valueAnalysisTool.errors });
    const input = valueAnalysisTool.input.parse({ id: 236948 });
    const result = await valueAnalysisTool.handler(input, ctx);
    expect(result.school_id).toBe(236948);
    expect(result.school_name).toBe('University of Washington');
    expect(result.list_price).toBe(11839);
    expect(result.net_price_overall).toBe(15000);
    expect(result.median_debt).toBe(17000);
    expect(result.earnings_6yr_median).toBe(50000);
    expect(result.debt_to_earnings_ratio).toBeCloseTo(0.34, 1);
    expect(result.data_notes).toBeInstanceOf(Array);
  });

  it('computes net_price_for_income when family_income is provided', async () => {
    mockGetValueAnalysisData.mockResolvedValue([
      { results: [makeCostRecord()] },
      { results: [makeEarningsRecord()] },
    ]);
    const ctx = createMockContext({ errors: valueAnalysisTool.errors });
    const input = valueAnalysisTool.input.parse({ id: 236948, family_income: 25000 });
    const result = await valueAnalysisTool.handler(input, ctx);
    expect(result.net_price_for_income).toBe(6384);
    expect(result.applicable_income_bracket).toBe('$0–$30,000');
  });

  it('adds data_notes for missing fields', async () => {
    mockGetValueAnalysisData.mockResolvedValue([
      {
        results: [
          makeCostRecord({
            'latest.cost.tuition.in_state': null,
            'latest.cost.tuition.out_of_state': null,
            'latest.aid.median_debt.completers.overall': null,
            'latest.repayment.repayment_cohort.3_year_declining_balance': null,
            'latest.completion.rate_suppressed.overall': null,
          }),
        ],
      },
      {
        results: [
          makeEarningsRecord({
            'latest.earnings.6_yrs_after_entry.median': null,
            'latest.earnings.10_yrs_after_entry.median': null,
          }),
        ],
      },
    ]);
    const ctx = createMockContext({ errors: valueAnalysisTool.errors });
    const input = valueAnalysisTool.input.parse({ id: 236948 });
    const result = await valueAnalysisTool.handler(input, ctx);
    expect(result.data_notes.length).toBeGreaterThan(0);
    expect(result.debt_to_earnings_ratio).toBeUndefined();
  });

  it('throws school_not_found when no cost record returned', async () => {
    mockGetValueAnalysisData.mockResolvedValue([{ results: [] }, { results: [] }]);
    const ctx = createMockContext({ errors: valueAnalysisTool.errors });
    const input = valueAnalysisTool.input.parse({ id: 999999 });
    await expect(valueAnalysisTool.handler(input, ctx)).rejects.toMatchObject({
      code: JsonRpcErrorCode.NotFound,
      data: { reason: 'school_not_found' },
    });
  });

  it('formats output with derived metrics', () => {
    const output = {
      school_id: 236948,
      school_name: 'University of Washington',
      list_price: 11839,
      net_price_overall: 15000,
      net_price_for_income: 6000,
      applicable_income_bracket: '$0–$30,000',
      median_debt: 17000,
      repayment_progress_3yr: 0.79,
      graduation_rate: 0.82,
      earnings_6yr_median: 50000,
      earnings_10yr_median: 60000,
      debt_to_earnings_ratio: 0.34,
      net_price_to_annual_earnings: 1.8,
      data_notes: [],
    };
    const blocks = valueAnalysisTool.format!(output);
    expect(blocks[0].type).toBe('text');
    const text = (blocks[0] as { text: string }).text;
    expect(text).toContain('University of Washington');
    expect(text).toContain('11,839');
    expect(text).toContain('0.34');
    expect(text).toContain('50,000');
    // repayment_progress_3yr (0–1) renders as a plausible percentage, not >100%
    expect(text).toContain('79.0%');
  });

  // Regression (issue #6): 3-year repayment progress comes from
  // repayment_cohort.3_year_declining_balance — already a 0–1 decimal. The old
  // code read a borrower-count field and divided by 1000, producing absurd
  // values like 1078.6%. Assert the value passes through unscaled.
  it('surfaces repayment_progress_3yr as a 0–1 decimal without scaling', async () => {
    mockGetValueAnalysisData.mockResolvedValue([
      { results: [makeCostRecord()] },
      { results: [makeEarningsRecord()] },
    ]);
    const ctx = createMockContext({ errors: valueAnalysisTool.errors });
    const input = valueAnalysisTool.input.parse({ id: 236948 });
    const result = await valueAnalysisTool.handler(input, ctx);
    expect(result.repayment_progress_3yr).toBeCloseTo(0.7903764139, 5);
    expect(result.repayment_progress_3yr).toBeLessThanOrEqual(1);
  });

  // Regression (issue #7): net price by income must read the ownership-keyed
  // net_price.public/private.by_income_level.* paths. The old avg_net_price.by_income.*
  // paths don't exist in the API, so a record carrying only those returns null.
  it('returns null net_price_for_income when only the dead avg_net_price paths are present', async () => {
    const deadRecord = {
      id: 236948,
      'school.name': 'University of Washington',
      'latest.cost.avg_net_price.overall': 15000,
      'latest.cost.avg_net_price.by_income.0-30000': 6000,
      'latest.cost.avg_net_price.by_income.30001-48000': 9000,
    };
    mockGetValueAnalysisData.mockResolvedValue([
      { results: [deadRecord] },
      { results: [makeEarningsRecord()] },
    ]);
    const ctx = createMockContext({ errors: valueAnalysisTool.errors });
    const input = valueAnalysisTool.input.parse({ id: 236948, family_income: 25000 });
    const result = await valueAnalysisTool.handler(input, ctx);
    expect(result.net_price_for_income).toBeUndefined();
  });

  // Issue #7: a private school reports brackets under net_price.private.*; the
  // handler must coalesce public → private and surface the value either way.
  it('reads net_price_for_income from the private path for a private school', async () => {
    const privateRecord = {
      id: 166027,
      'school.name': 'Harvard University',
      'latest.cost.avg_net_price.overall': 14000,
      'latest.cost.net_price.private.by_income_level.0-30000': 8697,
      'latest.cost.net_price.private.by_income_level.30001-48000': 2991,
    };
    mockGetValueAnalysisData.mockResolvedValue([
      { results: [privateRecord] },
      { results: [makeEarningsRecord({ id: 166027 })] },
    ]);
    const ctx = createMockContext({ errors: valueAnalysisTool.errors });
    const input = valueAnalysisTool.input.parse({ id: 166027, family_income: 25000 });
    const result = await valueAnalysisTool.handler(input, ctx);
    expect(result.net_price_for_income).toBe(8697);
    expect(result.applicable_income_bracket).toBe('$0–$30,000');
  });
});
