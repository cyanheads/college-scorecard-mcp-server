/**
 * @fileoverview Value-analysis caller contracts through the real ScorecardService.
 * @module tests/services/value-analysis-contract.test
 */

import { JsonRpcErrorCode } from '@cyanheads/mcp-ts-core/errors';
import {
  createFetchMock,
  type FetchMockHarness,
  runToolContract,
} from '@cyanheads/mcp-ts-core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { valueAnalysisTool } from '@/mcp-server/tools/definitions/value-analysis.tool.js';
import { initScorecardService } from '@/services/scorecard/scorecard-service.js';

let api: FetchMockHarness;
let requests: URL[];
const textOf = (result: Awaited<ReturnType<typeof runToolContract>>) =>
  result.content.flatMap((block) => (block.type === 'text' ? [block.text] : [])).join('\n');

function serve(
  cost: Record<string, unknown> = {},
  earnings: Record<string, unknown> = {},
  missingCost = false,
) {
  api.route({
    match: /^https:\/\/api\.data\.gov\/ed\/collegescorecard\/v1\/schools\?/,
    respond: (request) => {
      const url = new URL(request.url);
      requests.push(url);
      const isEarnings = url.searchParams.get('fields')?.includes('earnings');
      const record = {
        id: 236948,
        'school.name': 'Ratio Fixture',
        ...(isEarnings
          ? {
              'latest.earnings.6_yrs_after_entry.median': 50000,
              'latest.earnings.10_yrs_after_entry.median': 60000,
              ...earnings,
            }
          : {
              'latest.cost.tuition.in_state': 12000,
              'latest.cost.avg_net_price.overall': 15000,
              'latest.cost.net_price.public.by_income_level.0-30000': 6000,
              'latest.aid.median_debt.completers.overall': 17000,
              'latest.repayment.repayment_cohort.3_year_declining_balance': 0.79,
              'latest.completion.rate_suppressed.overall': 0.82,
              ...cost,
            }),
      };
      const results = missingCost && !isEarnings ? [] : [record];
      return Response.json({ metadata: { total: results.length, page: 0, per_page: 1 }, results });
    },
  });
}

describe('value-analysis real-service contracts', () => {
  beforeEach(() => {
    vi.stubEnv('SCORECARD_API_KEY', 'test-key');
    initScorecardService({} as never, {} as never);
    requests = [];
    api = createFetchMock();
    api.install();
  });
  afterEach(() => {
    api.restore();
    vi.unstubAllEnvs();
  });

  describe('characterization', () => {
    it.each(['public', 'private'])(
      'discloses %s bracket basis at every income boundary including zero prices',
      async (ownership) => {
        const suffixes = ['0-30000', '30001-48000', '48001-75000', '75001-110000', '110001-plus'];
        serve(
          Object.fromEntries(
            suffixes.flatMap((suffix, index) => [
              [`latest.cost.net_price.${ownership}.by_income_level.${suffix}`, index * 1000],
              [
                `latest.cost.net_price.${ownership === 'public' ? 'private' : 'public'}.by_income_level.${suffix}`,
                null,
              ],
            ]),
          ),
        );
        for (const [income, expected] of [
          [0, 0],
          [30000, 0],
          [30001, 1000],
          [48000, 1000],
          [48001, 2000],
          [75000, 2000],
          [75001, 3000],
          [110000, 3000],
          [110001, 4000],
        ] as const) {
          const result = await runToolContract(valueAnalysisTool, {
            id: 236948,
            family_income: income,
          });
          expect(result.isError).toBeFalsy();
          expect(result.structuredContent).toMatchObject({
            family_income: income,
            effective_net_price: expected,
            net_price_basis: 'income_bracket',
            net_price_to_annual_earnings: expected / 50000,
          });
          expect(textOf(result)).toContain('basis: income_bracket');
        }
      },
    );
    it.each(['PS', 'PrivacySuppressed', null])(
      'describes earnings %s without inventing a privacy cause',
      async (raw) => {
        serve({}, { 'latest.earnings.6_yrs_after_entry.median': raw });
        const result = await runToolContract(valueAnalysisTool, { id: 236948 });
        expect(result.isError).toBeFalsy();
        expect(result.structuredContent).not.toHaveProperty('net_price_to_annual_earnings');
        expect(textOf(result)).toContain(
          raw == null ? 'unavailable; cause not supplied' : 'explicitly privacy-suppressed',
        );
        expect(textOf(result)).not.toMatch(/small cohort|FERPA/);
      },
    );
    it('discloses a missing income bracket and preserved overall fallback', async () => {
      serve({ 'latest.cost.net_price.public.by_income_level.0-30000': null });
      const result = await runToolContract(valueAnalysisTool, { id: 236948, family_income: 25000 });
      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toMatchObject({
        family_income: 25000,
        applicable_income_bracket: '$0–$30,000',
        effective_net_price: 15000,
        net_price_basis: 'overall',
        net_price_to_annual_earnings: 0.3,
        data_notes: [expect.stringContaining('using overall net price')],
      });
      expect(textOf(result)).toContain('$0–$30,000');
      expect(textOf(result)).toContain('Family income: $25,000');
      expect(textOf(result)).toContain('basis: overall');
      expect(requests).toHaveLength(2);
    });
    it('discloses no effective price when bracket and overall are absent', async () => {
      serve({
        'latest.cost.net_price.public.by_income_level.0-30000': null,
        'latest.cost.avg_net_price.overall': null,
      });
      const result = await runToolContract(valueAnalysisTool, { id: 236948, family_income: 25000 });
      expect(result.structuredContent).toMatchObject({
        net_price_basis: 'unavailable',
        applicable_income_bracket: '$0–$30,000',
      });
      expect(result.structuredContent).not.toHaveProperty('effective_net_price');
      expect(result.structuredContent).not.toHaveProperty('net_price_to_annual_earnings');
      expect(textOf(result)).toContain('basis: unavailable');
    });
    it('preserves source values, repayment units and debt ratio on both surfaces', async () => {
      serve();
      const result = await runToolContract(valueAnalysisTool, { id: 236948 });
      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toMatchObject({
        school_id: 236948,
        school_name: 'Ratio Fixture',
        list_price: 12000,
        net_price_overall: 15000,
        median_debt: 17000,
        repayment_progress_3yr: 0.79,
        earnings_6yr_median: 50000,
        debt_to_earnings_ratio: 0.34,
        data_notes: [],
      });
      expect(requests).toHaveLength(2);
      expect(requests.every((url) => url.searchParams.get('id') === '236948')).toBe(true);
      const text = textOf(result);
      expect(text).toContain('$15,000');
      expect(text).toContain('$50,000');
      expect(text).toContain('79.0%');
      expect(text).toContain('0.34x');
    });

    it.each(['public', 'private'])('preserves %s family-income selection', async (ownership) => {
      serve({
        'latest.cost.net_price.public.by_income_level.0-30000':
          ownership === 'public' ? 6000 : null,
        'latest.cost.net_price.private.by_income_level.0-30000':
          ownership === 'private' ? 6000 : null,
      });
      const result = await runToolContract(valueAnalysisTool, { id: 236948, family_income: 25000 });
      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toMatchObject({
        net_price_for_income: 6000,
        applicable_income_bracket: '$0–$30,000',
      });
      expect(textOf(result)).toContain('Net Price ($0–$30,000): $6,000');
    });

    it('retains school_not_found and recovery when the cost record is absent', async () => {
      serve({}, {}, true);
      const result = await runToolContract(valueAnalysisTool, { id: 999999 });
      expect(result.isError).toBe(true);
      expect(result.structuredContent).toMatchObject({
        error: {
          code: JsonRpcErrorCode.NotFound,
          data: {
            reason: 'school_not_found',
            recovery: { hint: expect.stringContaining('scorecard_search_schools') },
          },
        },
      });
      expect(textOf(result)).toContain('scorecard_search_schools');
    });
  });

  it.each([
    { label: 'overall', cost: {}, earnings: {}, income: undefined, ratio: 0.3 },
    { label: 'public income bracket', cost: {}, earnings: {}, income: 25000, ratio: 0.12 },
    {
      label: 'private income bracket',
      cost: {
        'latest.cost.net_price.public.by_income_level.0-30000': null,
        'latest.cost.net_price.private.by_income_level.0-30000': 8697,
      },
      earnings: {},
      income: 25000,
      ratio: 0.17,
    },
    {
      label: 'missing bracket fallback',
      cost: { 'latest.cost.net_price.public.by_income_level.0-30000': null },
      earnings: {},
      income: 25000,
      ratio: 0.3,
    },
    {
      label: 'zero overall price',
      cost: { 'latest.cost.avg_net_price.overall': 0 },
      earnings: {},
      income: undefined,
      ratio: 0,
    },
    {
      label: 'zero selected price',
      cost: { 'latest.cost.net_price.public.by_income_level.0-30000': 0 },
      earnings: {},
      income: 25000,
      ratio: 0,
    },
    {
      label: 'unavailable price',
      cost: { 'latest.cost.avg_net_price.overall': null },
      earnings: {},
      income: undefined,
      ratio: undefined,
    },
    {
      label: 'zero earnings',
      cost: {},
      earnings: { 'latest.earnings.6_yrs_after_entry.median': 0 },
      income: undefined,
      ratio: undefined,
    },
    {
      label: 'negative earnings',
      cost: {},
      earnings: { 'latest.earnings.6_yrs_after_entry.median': -1 },
      income: undefined,
      ratio: undefined,
    },
    {
      label: 'null earnings',
      cost: {},
      earnings: { 'latest.earnings.6_yrs_after_entry.median': null },
      income: undefined,
      ratio: undefined,
    },
    {
      label: 'omitted earnings',
      cost: {},
      earnings: { 'latest.earnings.6_yrs_after_entry.median': undefined },
      income: undefined,
      ratio: undefined,
    },
  ])(
    'uses annual earnings without another time divisor: $label',
    async ({ cost, earnings, income, ratio }) => {
      serve(cost, earnings);
      const result = await runToolContract(valueAnalysisTool, {
        id: 236948,
        ...(income != null && { family_income: income }),
      });
      expect(result.isError).toBeFalsy();
      expect(requests).toHaveLength(2);
      const text = textOf(result);
      if (ratio == null) {
        expect(result.structuredContent).not.toHaveProperty('net_price_to_annual_earnings');
        expect(text).not.toContain('Net Price / Annual Earnings:');
      } else {
        expect(result.structuredContent).toMatchObject({ net_price_to_annual_earnings: ratio });
        expect(text).toContain(`Net Price / Annual Earnings: ${ratio.toFixed(2)}x`);
      }
    },
  );

  it('classifies unauthorized credentials with key-repair recovery through both surfaces', async () => {
    api.route({
      match: /^https:\/\/api\.data\.gov\/ed\/collegescorecard\/v1\/schools\?/,
      respond: () => new Response('', { status: 401 }),
    });
    const result = await runToolContract(valueAnalysisTool, { id: 236948 });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      error: {
        code: JsonRpcErrorCode.Unauthorized,
        data: {
          reason: 'api_unauthorized',
          retryable: false,
          recovery: { hint: expect.stringContaining('SCORECARD_API_KEY') },
        },
      },
    });
    expect(textOf(result)).toContain('SCORECARD_API_KEY');
  });

  it('rejects invalid school input before fetching', async () => {
    // @ts-expect-error Deliberately exercise runtime validation of an invalid input shape.
    const result = await runToolContract(valueAnalysisTool, { id: [] });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      error: { code: JsonRpcErrorCode.InvalidParams },
    });
    expect(textOf(result)).toContain('Invalid arguments');
    expect(api.calls).toHaveLength(0);
  });
});
