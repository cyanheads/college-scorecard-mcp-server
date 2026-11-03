/** Institution metadata, price bases, comparison serving, and projection contracts. */
import { createMockContext, runToolContract } from '@cyanheads/mcp-ts-core/testing';
import { beforeEach, expect, it, vi } from 'vitest';
import { degreeLevelLabel } from '@/mcp-server/format-helpers.js';
import { institutionCosts } from '@/mcp-server/institution-context.js';
import { schoolResource } from '@/mcp-server/resources/definitions/school.resource.js';
import { compareSchoolsTool } from '@/mcp-server/tools/definitions/compare-schools.tool.js';
import { getEarningsTool } from '@/mcp-server/tools/definitions/get-earnings.tool.js';
import { getSchoolTool } from '@/mcp-server/tools/definitions/get-school.tool.js';
import { searchSchoolsTool } from '@/mcp-server/tools/definitions/search-schools.tool.js';
import { valueAnalysisTool } from '@/mcp-server/tools/definitions/value-analysis.tool.js';

const profiles = vi.fn();
const comparison = vi.fn();
const value = vi.fn();
const search = vi.fn();
const earnings = vi.fn();
vi.mock('@/services/scorecard/scorecard-service.js', () => ({
  getScorecardService: () => ({
    getSchoolProfiles: profiles,
    getComparisonData: comparison,
    getValueAnalysisData: value,
    searchSchools: search,
    getSchoolEarnings: earnings,
  }),
}));
beforeEach(() => vi.clearAllMocks());
const record = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  'school.name': `School ${id}`,
  ...extra,
});
const text = (r: Awaited<ReturnType<typeof runToolContract>>) =>
  r.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('\n');
it('characterizes zero and null raw custom values', async () => {
  profiles.mockResolvedValue({ results: [record(1, { a: 0, b: null })] });
  const r = await runToolContract(getSchoolTool, { id: 1, fields: 'a,b,c' });
  expect(r.structuredContent).toMatchObject({
    schools: [{ selected_fields: { a: 0, b: null }, absent_fields: ['c'] }],
  });
  expect(text(r)).toContain('null');
});
it('uses the provider predominant-degree labels', () => {
  expect([0, 1, 2, 3, 4, null, undefined, 99].map(degreeLevelLabel)).toEqual([
    'Not classified',
    'Certificate',
    "Associate's",
    "Bachelor's",
    'Entirely graduate-degree granting',
    'Unknown',
    'Unknown',
    '99',
  ]);
});
it('exposes program prices and OPEID6 without losing zero or independent attendance basis', async () => {
  profiles.mockResolvedValue({
    results: [
      record(1, {
        ope6_id: '003798',
        'latest.cost.tuition.program_year': 0,
        'latest.cost.attendance.academic_year': 100,
        'latest.cost.attendance.program_year': 200,
      }),
    ],
  });
  const r = await runToolContract(getSchoolTool, { id: 1 });
  expect(r.structuredContent).toMatchObject({
    schools: [
      {
        ope6_id: '003798',
        effective_tuition: 0,
        tuition_basis: 'program_year',
        cost_of_attendance: 100,
        attendance_basis: 'academic_year',
        attendance_program_year: 200,
        metric_scope: { earnings: 'opeid6' },
      },
    ],
  });
  expect(text(r)).toContain('003798');
  expect(text(r)).toContain('program_year');
});
it('pages raw program subtrees together without compacting sparse values', async () => {
  const rows = [{ code: 'a' }, null, { code: 0, nested: { value: false } }, {}, { code: 'e' }];
  profiles.mockResolvedValue({
    results: [record(1, { latest: { programs: { cip_4_digit: rows } } })],
  });
  const r = await runToolContract(getSchoolTool, {
    id: 1,
    fields: 'latest',
    program_limit: 2,
    program_offset: 1,
  });
  expect(r.structuredContent).toMatchObject({
    schools: [
      {
        selected_fields: { latest: { programs: { cip_4_digit: [null, rows[2]] } } },
        program_pages: [
          {
            parent_path: 'latest.programs.cip_4_digit',
            total: 5,
            offset: 1,
            shown: 2,
            nextOffset: 3,
          },
        ],
      },
    ],
  });
  expect(text(r)).toContain('nextOffset');
  expect(text(r)).toContain('false');
});
it('leaves pooled rows unranked but keeps campus completion ranks', async () => {
  comparison.mockResolvedValue({
    results: [1, 2, 3].map((id) =>
      record(id, {
        ope6_id: id < 3 ? '003798' : '004000',
        'latest.earnings.6_yrs_after_entry.median': 10,
        'latest.completion.rate_suppressed.overall': id / 10,
      }),
    ),
  });
  const r = await runToolContract(compareSchoolsTool, { ids: [1, 2, 3], topic: 'outcomes' });
  const data = r.structuredContent as {
    rows: { metric: string; values: { rank?: number }[] }[];
    summary: string;
  };
  expect(
    data.rows
      .find((x) => x.metric === 'Median Earnings (6yr)')!
      .values.every((x) => x.rank === undefined),
  ).toBe(true);
  expect(data.rows.find((x) => x.metric === 'Completion Rate')!.values.map((x) => x.rank)).toEqual([
    3, 2, 1,
  ]);
  expect(data.summary).toContain('OPEID6');
  expect(text(r)).toContain('OPEID6');
});
it('normalizes before serving five and separates missing from unprocessed IDs', async () => {
  comparison.mockResolvedValue({ results: [record(1), record(3)] });
  const r = await runToolContract(compareSchoolsTool, {
    ids: [1, '01', 2, 3, 4, 5, 6],
    topic: 'costs',
  });
  expect(r.isError).toBeFalsy();
  expect(comparison.mock.calls[0]![0]).toEqual([1, 2, 3, 4, 5]);
  expect(r.structuredContent).toMatchObject({
    schools: [{ id: 1 }, { id: 3 }],
    missing_ids: [2, 4, 5],
    unprocessed_ids: [6],
  });
  expect(text(r)).toContain('Unprocessed IDs: 6');
});
it.each([0, 0.49, 0.5, 0.51, 1, 2, 2.01, undefined])(
  'renders only the numeric debt ratio %s',
  async (ratio) => {
    value.mockResolvedValue([
      {
        results: [
          record(1, {
            'latest.aid.median_debt.completers.overall': ratio == null ? null : ratio * 100,
          }),
        ],
      },
      { results: [record(1, { 'latest.earnings.6_yrs_after_entry.median': 100 })] },
    ]);
    const r = await runToolContract(valueAnalysisTool, { id: 1 });
    expect(text(r)).not.toMatch(/manageable|Moderate|Very high|\(High\)/);
    if (ratio != null) expect(text(r)).toContain(`Debt-to-Earnings Ratio: ${ratio.toFixed(2)}x`);
  },
);
it.each([
  [{}, {}],
  [
    {
      'latest.cost.tuition.in_state': 0,
      'latest.cost.tuition.program_year': 10,
      'latest.cost.attendance.program_year': 20,
    },
    {
      effective_tuition: 0,
      tuition_basis: 'academic_year',
      cost_of_attendance: 20,
      attendance_basis: 'program_year',
      tuition_program_year: 10,
      attendance_program_year: 20,
    },
  ],
  [
    { 'latest.cost.tuition.out_of_state': 5, 'latest.cost.attendance.academic_year': 0 },
    {
      effective_tuition: 5,
      tuition_basis: 'academic_year',
      cost_of_attendance: 0,
      attendance_basis: 'academic_year',
    },
  ],
  [
    { 'latest.cost.tuition.program_year': 0 },
    { effective_tuition: 0, tuition_program_year: 0, tuition_basis: 'program_year' },
  ],
])('selects price bases independently: %j', (input, expected) =>
  expect(institutionCosts(input)).toEqual(expected),
);
it('leaves mixed-period prices unranked and ranks same-period program prices', async () => {
  comparison.mockResolvedValue({
    results: [
      record(1, { 'latest.cost.tuition.in_state': 10 }),
      record(2, { 'latest.cost.tuition.program_year': 0 }),
    ],
  });
  const r = await runToolContract(compareSchoolsTool, { ids: [1, 2], topic: 'costs' });
  const rows = (
    r.structuredContent as {
      rows: { metric: string; values: { rank?: number; basis?: string }[] }[];
    }
  ).rows;
  expect(rows.find((x) => x.metric === 'Effective Tuition')!.values).toEqual([
    {
      school_id: 1,
      value: 10,
      basis: 'academic_year',
      availability: 'available',
      suppressed: false,
    },
    { school_id: 2, value: 0, basis: 'program_year', availability: 'available', suppressed: false },
  ]);
  expect(text(r)).toContain('Mixed academic-year and program-year');
  comparison.mockResolvedValue({
    results: [
      record(1, { 'latest.cost.tuition.program_year': 10 }),
      record(2, { 'latest.cost.tuition.program_year': 0 }),
    ],
  });
  const same = await runToolContract(compareSchoolsTool, { ids: [1, 2], topic: 'costs' });
  expect(
    (same.structuredContent as typeof r.structuredContent & { rows: typeof rows }).rows
      .find((x) => x.metric === 'Effective Tuition')!
      .values.map((x) => x.rank),
  ).toEqual([2, 1]);
});
it.each([0, 2, 4, 5, 20])(
  'preserves raw provider positions across projection offset %s',
  async (offset) => {
    const codes = ['a', null, 0, false, 'e'];
    const earnings = [0, null, undefined, 10, 20];
    profiles.mockResolvedValue({
      results: [
        record(1, {
          'latest.programs.cip_4_digit.code': codes,
          'latest.programs.cip_4_digit.earnings': earnings,
        }),
        record(2, { 'latest.programs.cip_4_digit': [] }),
      ],
    });
    const r = await runToolContract(getSchoolTool, {
      id: [1, 2],
      fields: 'latest.programs.cip_4_digit.code,latest.programs.cip_4_digit.earnings',
      program_limit: 2,
      program_offset: offset,
    });
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent).toMatchObject({
      schools: [
        {
          selected_fields: {
            'latest.programs.cip_4_digit.code': codes.slice(offset, offset + 2),
            'latest.programs.cip_4_digit.earnings': earnings.slice(offset, offset + 2),
          },
          program_pages: [
            {
              total: 5,
              offset,
              shown: Math.min(2, Math.max(0, 5 - offset)),
              truncated: offset + 2 < 5,
            },
          ],
        },
        {
          selected_fields: { 'latest.programs.cip_4_digit': [] },
          program_pages: [{ total: 0, offset, shown: 0, truncated: false }],
        },
      ],
    });
    expect(text(r)).toContain('Program pages:');
  },
);
it('clamps program pages with a notice and keeps default profiles untouched', async () => {
  profiles.mockResolvedValue({
    results: [
      record(1, {
        'latest.programs.cip_4_digit': Array.from({ length: 101 }, (_, i) => ({ code: i })),
      }),
    ],
  });
  const r = await runToolContract(getSchoolTool, {
    id: 1,
    fields: 'latest.programs.cip_4_digit',
    program_limit: 1000,
  });
  expect(r.structuredContent).toMatchObject({
    truncated: true,
    schools: [{ program_pages: [{ shown: 100, nextOffset: 100 }] }],
  });
  expect(text(r)).toContain('program_limit 100');
  const defaults = await runToolContract(getSchoolTool, { id: 1 });
  expect((defaults.structuredContent as { schools: unknown[] }).schools[0]).not.toHaveProperty(
    'program_pages',
  );
});
it('reports missing processed and untouched remaining IDs in the not-found contract', async () => {
  comparison.mockResolvedValue({ results: [] });
  const r = await runToolContract(compareSchoolsTool, { ids: [1, 2, 3, 4, 5, 6], topic: 'costs' });
  expect(r.structuredContent).toMatchObject({
    error: {
      data: {
        reason: 'schools_not_found',
        missing_ids: [1, 2, 3, 4, 5],
        unprocessed_ids: [6],
        recovery: { hint: expect.stringContaining('scorecard_search_schools') },
      },
    },
  });
  expect(text(r)).toContain('scorecard_search_schools');
});
it('validates every raw comparison element and raw ceilings before serving', async () => {
  for (const ids of [[1], Array.from({ length: 1001 }, () => 1), [1, 2, 3, 4, 5, 'bad']]) {
    const r = await runToolContract(compareSchoolsTool, { ids, topic: 'costs' });
    expect(r.isError).toBe(true);
  }
  expect(comparison).not.toHaveBeenCalled();
  comparison.mockResolvedValue({ results: [record(1)] });
  const r = await runToolContract(compareSchoolsTool, {
    ids: Array.from({ length: 1000 }, () => 1),
    topic: 'costs',
  });
  expect(r.isError).toBeFalsy();
  expect(comparison.mock.calls[0]![0]).toEqual([1]);
});
it('rejects invalid projection offsets and limits', async () => {
  for (const params of [{ program_offset: -1 }, { program_limit: 0 }, { program_limit: 1001 }])
    expect((await runToolContract(getSchoolTool, { id: 1, ...params })).isError).toBe(true);
  expect(profiles).not.toHaveBeenCalled();
});
it('drains default-sized projected pages in provider order', async () => {
  const rows = Array.from({ length: 41 }, (_, index) =>
    index % 3 ? { nested: { value: index } } : null,
  );
  profiles.mockResolvedValue({ results: [record(1, { 'latest.programs.cip_4_digit': rows })] });
  const combined: unknown[] = [];
  for (const offset of [0, 20, 40]) {
    const result = await runToolContract(getSchoolTool, {
      id: 1,
      fields: 'latest.programs.cip_4_digit',
      program_offset: offset,
    });
    const school = (
      result.structuredContent as {
        schools: {
          selected_fields: Record<string, unknown[]>;
          program_pages: { shown: number; nextOffset?: number }[];
        }[];
      }
    ).schools[0]!;
    combined.push(...school.selected_fields['latest.programs.cip_4_digit']!);
    expect(school.program_pages[0]!.shown).toBe(offset === 40 ? 1 : 20);
    expect(school.program_pages[0]!.nextOffset).toBe(offset === 40 ? undefined : offset + 20);
    expect(text(result)).toContain('Program pages:');
  }
  expect(combined).toEqual(rows);
});
it('composes missing-school and projected-program continuation notices', async () => {
  profiles.mockResolvedValue({
    results: [
      record(1, {
        'latest.programs.cip_4_digit': Array.from({ length: 21 }, (_, code) => ({ code })),
      }),
    ],
  });
  const result = await runToolContract(getSchoolTool, {
    id: [1, 2],
    fields: 'latest.programs.cip_4_digit',
  });
  expect(text(result)).toContain('1 processed IDs returned no record');
  expect(text(result)).toContain('program_pages continuation');
});
it('discloses pooled outcomes even when the OPEID6 identifier is unavailable', async () => {
  value.mockResolvedValue([
    {
      results: [
        record(1, {
          'latest.cost.avg_net_price.overall': 10,
          'latest.aid.median_debt.completers.overall': 20,
        }),
      ],
    },
    { results: [record(1, { 'latest.earnings.6_yrs_after_entry.median': 100 })] },
  ]);
  const result = await runToolContract(valueAnalysisTool, { id: 1 });
  expect(result.structuredContent).toMatchObject({
    data_notes: expect.arrayContaining([expect.stringContaining('Campus prices')]),
  });
  expect(text(result)).toContain('OPEID6-pooled');
});
it('does not treat empty identifiers as a known shared OPEID6', async () => {
  comparison.mockResolvedValue({
    results: [
      record(1, { ope6_id: '', 'latest.earnings.6_yrs_after_entry.median': 100 }),
      record(2, { ope6_id: '', 'latest.earnings.6_yrs_after_entry.median': 50 }),
    ],
  });
  const result = await runToolContract(compareSchoolsTool, { ids: [1, 2], topic: 'outcomes' });
  const rows = (
    result.structuredContent as { rows: { metric: string; values: { rank?: number }[] }[] }
  ).rows;
  expect(
    rows.find((row) => row.metric === 'Median Earnings (6yr)')!.values.map((cell) => cell.rank),
  ).toEqual([1, 2]);
});
it('wires institution scope and prices through search, earnings, value analysis and resource JSON', async () => {
  const raw = record(1, {
    ope6_id: '000001',
    'latest.cost.tuition.program_year': 27500,
    'latest.cost.attendance.program_year': 43687,
  });
  search.mockResolvedValue({ results: [raw], metadata: { total: 1, page: 0, per_page: 20 } });
  earnings.mockResolvedValue({ results: [raw] });
  profiles.mockResolvedValue({ results: [raw] });
  value.mockResolvedValue([{ results: [raw] }, { results: [raw] }]);
  const s = await runToolContract(searchSchoolsTool, {});
  expect(s.structuredContent).toMatchObject({
    schools: [
      {
        ope6_id: '000001',
        effective_tuition: 27500,
        tuition_basis: 'program_year',
        attendance_basis: 'program_year',
      },
    ],
  });
  expect(text(s)).toContain('27,500');
  const e = await runToolContract(getEarningsTool, { id: 1 });
  expect(e.structuredContent).toMatchObject({
    ope6_id: '000001',
    metric_scope: { earnings: 'opeid6' },
  });
  expect(text(e)).toContain('000001');
  const v = await runToolContract(valueAnalysisTool, { id: 1 });
  expect(v.structuredContent).toMatchObject({
    list_price: 27500,
    net_price_basis: 'unavailable',
    data_notes: expect.arrayContaining([expect.stringContaining('Campus prices')]),
  });
  expect(text(v)).not.toContain('tuition-free');
  expect(text(v)).toContain('program_year');
  const resource = await schoolResource.handler(
    schoolResource.params!.parse({ id: '1' }),
    createMockContext({ errors: schoolResource.errors }),
  );
  expect(JSON.parse(JSON.stringify(resource))).toMatchObject({
    ope6_id: '000001',
    effective_tuition: 27500,
    cost_of_attendance: 43687,
    metric_scope: { debt: 'opeid6' },
  });
});
