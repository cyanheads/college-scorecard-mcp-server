/**
 * @fileoverview Comparison ranking eligibility and repayment provenance contracts.
 * @module tests/tools/comparison-ranking
 */

import { runToolContract } from '@cyanheads/mcp-ts-core/testing';
import { beforeEach, expect, it, vi } from 'vitest';
import { compareSchoolsTool } from '@/mcp-server/tools/definitions/compare-schools.tool.js';

const getComparisonData = vi.fn();
vi.mock('@/services/scorecard/scorecard-service.js', () => ({
  getScorecardService: () => ({ getComparisonData }),
}));

const record = (id: number) => ({
  id,
  'school.name': `School ${id}`,
  'latest.admissions.admission_rate.overall': id / 10,
  'latest.admissions.sat_scores.average.overall': 1000 + id,
  'latest.admissions.sat_scores.25th_percentile.math': 500 + id,
  'latest.admissions.sat_scores.75th_percentile.math': 700 + id,
  'latest.admissions.act_scores.25th_percentile.cumulative': 20 + id,
  'latest.admissions.act_scores.75th_percentile.cumulative': 30 + id,
  'latest.student.size': id * 1000,
  'latest.aid.pell_grant_rate': id / 10,
  'latest.aid.federal_loan_rate': id / 10,
  'latest.aid.median_debt.completers.overall': id * 1000,
  'latest.cost.avg_net_price.overall': id * 2000,
  'latest.cost.tuition.in_state': id * 3000,
  'latest.repayment.repayment_cohort.3_year_declining_balance': 0.7903764139,
});

beforeEach(() => {
  getComparisonData.mockReset();
  getComparisonData.mockResolvedValue({ results: [record(1), record(2)] });
});

it('preserves descriptive values and eligible debt ranks', async () => {
  const result = await runToolContract(compareSchoolsTool, { ids: [1, 2], topic: 'aid' });
  expect(result.isError).toBeFalsy();
  const data = compareSchoolsTool.output.parse(result.structuredContent);
  expect(
    data.rows.find((row) => row.metric === 'Pell Grant Rate')?.values.map((v) => v.value),
  ).toEqual([0.1, 0.2]);
  expect(
    data.rows.find((row) => row.metric === 'Median Debt at Graduation')?.values.map((v) => v.rank),
  ).toEqual([1, 2]);
  expect(
    data.rows.find((row) => row.metric === '3-Year Repayment Progress')?.values.map((v) => v.value),
  ).toEqual([0.7903764139, 0.7903764139]);
});

it('leaves all admissions rows unranked on both surfaces', async () => {
  const result = await runToolContract(compareSchoolsTool, { ids: [1, 2], topic: 'admissions' });
  const data = compareSchoolsTool.output.parse(result.structuredContent);
  expect(data.rows).toHaveLength(7);
  expect(
    data.rows.every((row) =>
      row.values.every((value) => value.value !== undefined && value.rank === undefined),
    ),
  ).toBe(true);
  expect(data.rows.every((row) => row.note?.includes('Descriptive'))).toBe(true);
  expect(data.summary).toBeUndefined();
  const text = result.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
  expect(text).toContain('Descriptive');
  expect(text).not.toContain('(#1)');
  expect(text).not.toContain('**Summary:**');
});

it('skips aid participation rows before selecting three ranked leaders', async () => {
  const result = await runToolContract(compareSchoolsTool, { ids: [1, 2], topic: 'aid' });
  const data = compareSchoolsTool.output.parse(result.structuredContent);
  expect(
    data.rows.slice(0, 2).every((row) => row.values.every((value) => value.rank === undefined)),
  ).toBe(true);
  expect(data.summary).toBe(
    'School 1 leads on Median Debt at Graduation; School 1 and School 2 tie for best on 3-Year Repayment Progress; School 1 leads on Avg Net Price (overall)',
  );
  const text = result.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
  expect(text).toContain(data.summary!);
  expect(text).toContain('Pell Grant Rate');
  expect(text).toContain('Federal Loan Rate');
});

it.each([
  [1, 1],
  [1, 2],
])('does not rank one distinct found school for IDs %j', async (first, second) => {
  getComparisonData.mockResolvedValue({ results: [record(1)] });
  const result = await runToolContract(compareSchoolsTool, {
    ids: [first, second],
    topic: 'costs',
  });
  const data = compareSchoolsTool.output.parse(result.structuredContent);
  expect(data.schools).toEqual([
    {
      id: 1,
      name: 'School 1',
      metric_scope: {
        completion: 'campus',
        earnings: 'opeid6',
        debt: 'opeid6',
        repayment: 'opeid6',
      },
    },
  ]);
  expect(data.rows.every((row) => row.values.every((value) => value.rank === undefined))).toBe(
    true,
  );
  expect(data.rows.find((row) => row.metric === 'In-State Tuition')?.values[0]?.value).toBe(3000);
  expect(data.summary).toBeUndefined();
  const text = result.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
  expect(text).toContain('Only one distinct school');
  expect(text).not.toContain('(#1)');
  if (second === 2) expect(data.missing_ids).toEqual([2]);
});

it.each(['outcomes', 'aid'] as const)(
  'gives the discontinued repayment vintage in %s',
  async (topic) => {
    const result = await runToolContract(compareSchoolsTool, { ids: [1, 2], topic });
    const data = compareSchoolsTool.output.parse(result.structuredContent);
    const row = data.rows.find((entry) => entry.metric === '3-Year Repayment Progress')!;
    expect(row.note).toContain('2016–17');
    expect(row.note).toContain('FY2013–FY2014');
    expect(row.note).toContain('FY2016–FY2017');
    expect(row.note).toContain('discontinued');
    expect(row.note).toContain('OPEID6');
    expect(row.values.map((value) => value.rank)).toEqual([1, 1]);
    const text = result.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n');
    expect(text).toContain(row.note!);
  },
);

it('preserves reported numeric precision in readable comparison cells', async () => {
  getComparisonData.mockResolvedValue({
    results: [{ ...record(1), 'latest.cost.tuition.in_state': 1234.56789012 }, record(2)],
  });
  for (const topic of ['costs', 'outcomes'] as const) {
    const result = await runToolContract(compareSchoolsTool, { ids: [1, 2], topic });
    const text = result.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n');
    const reported = topic === 'costs' ? 1234.56789012 : 0.7903764139;
    const data = compareSchoolsTool.output.parse(result.structuredContent);
    expect(data.rows.some((row) => row.values.some((value) => value.value === reported))).toBe(
      true,
    );
    expect(text).toContain(`Reported value: ${reported}`);
  }
});
