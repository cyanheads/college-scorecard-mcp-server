/**
 * @fileoverview End-to-end repayment and family-income output contracts.
 * @module tests/services/repayment-contract.test
 */

import { createFetchMock, runToolContract } from '@cyanheads/mcp-ts-core/testing';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readBorrowerRate } from '@/mcp-server/repayment.js';
import { getSchoolTool } from '@/mcp-server/tools/definitions/get-school.tool.js';
import { valueAnalysisTool } from '@/mcp-server/tools/definitions/value-analysis.tool.js';
import { initScorecardService } from '@/services/scorecard/scorecard-service.js';

const record = {
  id: 236948,
  ope6_id: '003798',
  'school.name': 'University of Washington',
  'school.ownership': 1,
  'latest.cost.net_price.public.by_income_level.0-30000': 7610,
  'latest.repayment.repayment_cohort.3_year_declining_balance': 0.7903764139,
};

const api = createFetchMock();
let providerRow: Record<string, unknown>;

beforeEach(() => {
  vi.stubEnv('SCORECARD_API_KEY', 'test-key');
  initScorecardService({} as never, {} as never);
  providerRow = record;
  api.install();
  api.route({
    match: /^https:\/\/api\.data\.gov\/ed\/collegescorecard\/v1\/schools\?/,
    respond(request) {
      const url = new URL(request.url);
      const fields = url.searchParams.get('fields')?.split(',') ?? [];
      const row = Object.fromEntries(
        fields.filter((field) => field in providerRow).map((field) => [field, providerRow[field]]),
      );
      return Response.json({ results: [row], metadata: { total: 1, page: 0, per_page: 1 } });
    },
  });
});

afterEach(() => {
  api.restore();
  vi.unstubAllEnvs();
});

it('discloses the original negative income while using zero for the price bracket', async () => {
  const value = await runToolContract(valueAnalysisTool, { id: 236948, family_income: -5000 });
  expect(value.structuredContent).toMatchObject({ family_income: 0, net_price_for_income: 7610 });
  expect(textOf(value)).toContain('Family income: $0');
  expect(value.structuredContent).toMatchObject({ notice: expect.stringContaining('-5000') });
  expect(textOf(value)).toContain('-5000');
});

it('adds legacy vintage in both tools only when the repayment value is present', async () => {
  const context = {
    status: 'discontinued',
    data_file_year: 2016,
    data_file: '2016–17',
    repayment_entry_cohorts: 'FY2013–FY2014',
    measurement_period: 'FY2016–FY2017',
  };
  const profile = await runToolContract(getSchoolTool, { id: 236948 });
  const value = await runToolContract(valueAnalysisTool, { id: 236948 });
  expect(profile.structuredContent).toMatchObject({
    schools: [{ repayment_progress_3yr_context: context }],
  });
  expect(value.structuredContent).toMatchObject({ repayment_progress_3yr_context: context });
  for (const result of [profile, value]) {
    expect(textOf(result)).toContain('2016–17 file');
    expect(textOf(result)).toContain('FY2013–FY2014');
    expect(textOf(result)).toContain('FY2016–FY2017');
    expect(textOf(result)).toContain('discontinued');
  }
  providerRow = { ...record, 'latest.repayment.repayment_cohort.3_year_declining_balance': null };
  const sparseProfile = await runToolContract(getSchoolTool, { id: 236948 });
  expect(sparseProfile.structuredContent).toMatchObject({ schools: [{ id: 236948 }] });
  const { schools } = getSchoolTool.output.parse(sparseProfile.structuredContent);
  expect(schools[0]).not.toHaveProperty('repayment_progress_3yr_context');
  const sparseValue = await runToolContract(valueAnalysisTool, { id: 236948 });
  expect(sparseValue.structuredContent).not.toHaveProperty('repayment_progress_3yr_context');
  expect(textOf(sparseProfile)).not.toContain('2016–17 file');
  expect(textOf(sparseValue)).not.toContain('2016–17 file');
});

it('returns both borrower cohorts and degrades only the unsupported status', async () => {
  providerRow = {
    ...record,
    'latest.repayment.2_yr_bb_fed_repayment.ug.count': 11428,
    'latest.repayment.2_yr_bb_fed_repayment.ug.makingprogress': '0.15-0.19',
    'latest.repayment.2_yr_bb_fed_repayment.ug.default': '<=0.05',
    'latest.repayment.2_yr_bb_fed_repayment.ug.fullypaid': '0.00',
    'latest.repayment.4_yr_bb_fed_repayment.ug.count': 11830,
    'latest.repayment.4_yr_bb_fed_repayment.ug.makingprogress': 'PS',
    'latest.repayment.4_yr_bb_fed_repayment.ug.default': 'unexpected',
  };
  const profile = await runToolContract(getSchoolTool, { id: 236948 });
  const value = await runToolContract(valueAnalysisTool, { id: 236948 });
  const borrower_repayment = [
    {
      horizon_years: 2,
      data_file_year: 2019,
      data_file: '2019–20',
      repayment_entry_cohorts: ['AY2016–17', 'AY2017–18'],
      measurement_period: ['2018–19', '2019–20'],
      cohort_count: 11428,
      scope: 'opeid6',
      making_progress: { availability: 'available', reported: '0.15-0.19' },
      default: { availability: 'available', reported: '<=0.05' },
      paid_in_full: { availability: 'available', reported: '0.00', value: 0 },
    },
    {
      horizon_years: 4,
      data_file_year: 2020,
      data_file: '2020–21',
      repayment_entry_cohorts: ['AY2015–16', 'AY2016–17'],
      measurement_period: ['2019–20', '2020–21'],
      cohort_count: 11830,
      scope: 'opeid6',
      making_progress: { availability: 'privacy_suppressed' },
      default: { availability: 'unavailable' },
      paid_in_full: { availability: 'unavailable' },
    },
  ];
  expect(profile.structuredContent).toMatchObject({ schools: [{ borrower_repayment }] });
  expect(value.structuredContent).toMatchObject({ borrower_repayment });
  for (const result of [profile, value]) {
    expect(result.structuredContent).toMatchObject({
      notice: expect.stringContaining('4-year default'),
    });
    for (const fact of [
      '4-year default',
      '11428',
      '11830',
      '0.15-0.19',
      '<=0.05',
      '0.00',
      'privacy_suppressed',
      'unavailable',
      'AY2015–16',
      '2020–21',
    ]) {
      expect(textOf(result)).toContain(fact);
    }
  }
});

const textOf = (result: Awaited<ReturnType<typeof runToolContract>>) =>
  result.content.flatMap((block) => (block.type === 'text' ? [block.text] : [])).join('\n');

it('preserves published numeric repayment and zero/fractional income', async () => {
  const profile = await runToolContract(getSchoolTool, { id: 236948 });
  expect(profile.structuredContent).toMatchObject({
    schools: [{ repayment_progress_3yr: 0.7903764139 }],
  });
  expect(textOf(profile)).toContain('79.0%');
  expect(textOf(profile)).toContain('Reported value: 0.7903764139');
  for (const income of [0, 0.25]) {
    const value = await runToolContract(valueAnalysisTool, { id: 236948, family_income: income });
    expect(value.structuredContent).toMatchObject({
      family_income: income,
      net_price_for_income: 7610,
      repayment_progress_3yr: 0.7903764139,
    });
    expect(textOf(value)).toContain(`Family income: $${income}`);
    expect(textOf(value)).toContain('Reported value: 0.7903764139');
  }
});

it('preserves fractional family income on both surfaces', async () => {
  const result = await runToolContract(valueAnalysisTool, {
    id: 236948,
    family_income: 1.23456789,
  });
  expect(result.structuredContent).toMatchObject({ family_income: 1.23456789 });
  expect(textOf(result)).toContain('Family income: $1.235 | Reported value: 1.23456789');
});

it.each([
  ['0.00', { availability: 'available', reported: '0.00', value: 0 }],
  ['0.30', { availability: 'available', reported: '0.30', value: 0.3 }],
  ['0.123456', { availability: 'available', reported: '0.123456', value: 0.123456 }],
  ['1.00', { availability: 'available', reported: '1.00', value: 1 }],
  ['0.15-0.19', { availability: 'available', reported: '0.15-0.19' }],
  ['0.123-0.456', { availability: 'available', reported: '0.123-0.456' }],
  ['0.5000-0.5', { availability: 'available', reported: '0.5000-0.5' }],
  ['0.50000000000000001-0.5', undefined],
  ['<=0.05', { availability: 'available', reported: '<=0.05' }],
  ['PS', { availability: 'privacy_suppressed' }],
  ['PrivacySuppressed', { availability: 'privacy_suppressed' }],
  [null, { availability: 'unavailable' }],
  [undefined, { availability: 'unavailable' }],
  ['NA', { availability: 'unavailable' }],
  [0.3, undefined],
  [{ value: '0.30' }, undefined],
  ['<0.05', undefined],
  ['<=0.15-0.19', undefined],
  ['0.19-0.15', undefined],
  ['1.10', undefined],
  ['0.10-1.10', undefined],
  ['-0.15', undefined],
  ['0.30\n', undefined],
  ['0.03e1', undefined],
])('classifies the provider rate %j', (raw, expected) => {
  expect(readBorrowerRate(raw)).toStrictEqual(expected);
});

it('passes custom borrower rate fields through verbatim without curated statuses', async () => {
  const field = 'latest.repayment.2_yr_bb_fed_repayment.ug.makingprogress';
  providerRow = { ...record, [field]: '<=0.05' };
  const profile = await runToolContract(getSchoolTool, { id: 236948, fields: field });
  expect(profile.structuredContent).toMatchObject({
    schools: [{ selected_fields: { [field]: '<=0.05' } }],
  });
  const { schools } = getSchoolTool.output.parse(profile.structuredContent);
  expect(schools[0]).not.toHaveProperty('borrower_repayment');
  expect(textOf(profile)).toContain('<=0.05');
});

it('keeps borrower-rate parser timing bounded on malformed and long decimal values', {
  timeout: 0,
}, () => {
  const cpuUs = (raw: string, calls: number) => {
    const start = process.threadCpuUsage();
    for (let call = 0; call < calls; call++) readBorrowerRate(raw);
    const elapsed = process.threadCpuUsage(start);
    return (elapsed.user + elapsed.system) / calls;
  };

  for (const [shape, largest] of [
    [(size: number) => `0.${'0'.repeat(size)}1-0.${'0'.repeat(size)}2`, 320_000],
    [(size: number) => `0.1-${'0.1-'.repeat(size / 4)}\ny`, 80_000],
    [(size: number) => '  \r\n'.repeat(size / 4), 80_000],
  ] as const) {
    const baseline = shape(5000);
    for (let size = 10_000; size <= largest; size *= 2) {
      const raw = shape(size);
      let leastCpu = Infinity;
      let leastGrowth = Infinity;
      for (let attempt = 0; attempt < 5; attempt++) {
        const baselineCpu = cpuUs(baseline, 2000);
        const largeCpu = cpuUs(raw, Math.max(4, Math.floor(400_000 / size)));
        leastCpu = Math.min(leastCpu, largeCpu);
        leastGrowth = Math.min(leastGrowth, largeCpu / Math.max(0.01, baselineCpu));
      }
      expect(leastCpu).toBeLessThan(40_000);
      expect(leastGrowth).toBeLessThan(256);
    }
  }
});
