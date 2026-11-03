/**
 * @fileoverview Program population and row continuation contracts.
 * @module tests/tools/program-pages.test
 */
import { createMockContext, runToolContract } from '@cyanheads/mcp-ts-core/testing';
import { beforeEach, expect, it, vi } from 'vitest';
import { programsResource } from '@/mcp-server/resources/definitions/programs.resource.js';
import { programsPageResource } from '@/mcp-server/resources/definitions/programs-page.resource.js';
import { getProgramsTool } from '@/mcp-server/tools/definitions/get-programs.tool.js';
import { searchProgramsTool } from '@/mcp-server/tools/definitions/search-programs.tool.js';

const fetchPrograms = vi.fn();
vi.mock('@/services/scorecard/scorecard-service.js', () => ({
  getScorecardService: () => ({ getSchoolPrograms: fetchPrograms, searchPrograms: fetchPrograms }),
}));
const record = {
  id: 236948,
  ope6_id: '003798',
  'school.name': 'University',
  'latest.programs.cip_4_digit': [
    {
      code: '1107',
      credential: { level: 3 },
      earnings: {
        highest: {
          '1_yr': { overall_median_earnings: 101710, working_not_enrolled: { overall_count: 236 } },
        },
        '1_yr': { overall_median_earnings: 128218, working_not_enrolled: { overall_count: 300 } },
        '4_yr': { overall_median_earnings: 175616 },
      },
    },
    {
      code: '5202',
      earnings: {
        highest: { '1_yr': { overall_median_earnings: 200000 } },
        '1_yr': { overall_median_earnings: 0 },
      },
    },
    { code: '5138', earnings: { '1_yr': { overall_median_earnings: 'PS' } } },
  ],
};
beforeEach(() => {
  fetchPrograms.mockReset();
  fetchPrograms.mockResolvedValue({
    metadata: { total: 21, page: 0, per_page: 20 },
    results: [record],
  });
});
it('characterizes legacy highest-credential values and identity', async () => {
  const result = await runToolContract(getProgramsTool, { id: 236948, cip_code: '1107' });
  expect(result.isError).toBeFalsy();
  expect(result.structuredContent).toMatchObject({
    programs: [{ code: '1107', earnings_1yr_median: 101710, earnings_count: 236 }],
  });
});
it('pages after current earnings ranking and preserves distinct populations', async () => {
  const result = await runToolContract(getProgramsTool, { id: 236948, limit: 1 });
  expect(result.structuredContent).toMatchObject({
    ope6_id: '003798',
    total: 3,
    shown: 1,
    nextOffset: 1,
    truncated: true,
    programs: [
      {
        code: '1107',
        earnings_1yr_median: 101710,
        completion_1yr_median: 128218,
        completion_4yr_median: 175616,
      },
    ],
  });
  expect(result.content.map((b) => ('text' in b ? b.text : '')).join('\n')).toContain('128218');
});
it('drains this school page before continuing to another school page', async () => {
  const first = await runToolContract(searchProgramsTool, { limit: 2 });
  expect(first.structuredContent).toMatchObject({
    total: 21,
    total_programs: 3,
    shown: 2,
    next: { page: 0, offset: 2 },
  });
  const last = await runToolContract(searchProgramsTool, { limit: 2, offset: 2 });
  expect(last.structuredContent).toMatchObject({ shown: 1, next: { page: 1, offset: 0 } });
});
it('concatenates nested school/credential pages in a stable sequence including ties and unavailable values', async () => {
  fetchPrograms.mockResolvedValue({
    metadata: { total: 2, page: 0, per_page: 2 },
    results: [
      record,
      {
        ...record,
        id: 377555,
        'latest.programs.cip_4_digit': [
          {
            code: '1107',
            credential: { level: 5 },
            earnings: { '1_yr': { overall_median_earnings: 128218 } },
          },
          { code: '9999' },
        ],
      },
    ],
  });
  const sequence: Array<[number, string, number | undefined]> = [];
  for (const offset of [0, 2, 4, 6]) {
    const result = await runToolContract(searchProgramsTool, { per_page: 2, limit: 2, offset });
    expect(result.isError).toBeFalsy();
    const page = result.structuredContent as {
      programs: Array<{ school_id: number; program_code: string; credential_level?: number }>;
      total_programs: number;
    };
    expect(page.total_programs).toBe(5);
    sequence.push(
      ...page.programs.map(
        (p) =>
          [p.school_id, p.program_code, p.credential_level] as [number, string, number | undefined],
      ),
    );
    const text = result.content.map((b) => ('text' in b ? b.text : '')).join('\n');
    for (const p of page.programs) expect(text).toContain(p.program_code);
  }
  expect(sequence).toEqual([
    [236948, '1107', 3],
    [377555, '1107', 5],
    [236948, '5202', undefined],
    [236948, '5138', undefined],
    [377555, '9999', undefined],
  ]);
});
it('counts before paging and handles exact-final and exhausted offsets', async () => {
  const exact = await runToolContract(getProgramsTool, { id: 236948, limit: 3 });
  expect(exact.structuredContent).toMatchObject({
    total: 3,
    shown: 3,
    nextOffset: null,
    truncated: false,
  });
  const past = await runToolContract(getProgramsTool, { id: 236948, offset: 5, limit: 2 });
  expect(past.structuredContent).toMatchObject({
    total: 3,
    shown: 0,
    programs: [],
    nextOffset: null,
    truncated: false,
  });
  expect(past.content.map((b) => ('text' in b ? b.text : '')).join('\n')).toContain(
    'offset is exhausted',
  );
});
it('filters on current values without a legacy fallback and includes current zero', async () => {
  const zero = await runToolContract(getProgramsTool, { id: 236948, min_earnings: 0 });
  expect(zero.structuredContent).toMatchObject({
    total: 2,
    programs: [{ code: '1107' }, { code: '5202', completion_1yr_median: 0 }],
  });
  const filtered = await runToolContract(searchProgramsTool, { min_earnings: 150000 });
  expect(filtered.structuredContent).toMatchObject({
    total: 21,
    total_programs: 0,
    shown: 0,
    next: { page: 1, offset: 0 },
  });
  expect(filtered.content.map((b) => ('text' in b ? b.text : '')).join('\n')).toContain(
    'page 1 with offset 0',
  );
});
it('normalizes the row cap and echoes effective inputs on both surfaces', async () => {
  const programs = Array.from({ length: 105 }, (_, index) => ({ code: String(index) }));
  fetchPrograms.mockResolvedValue({
    metadata: { total: 1, page: 0, per_page: 20 },
    results: [{ ...record, 'latest.programs.cip_4_digit': programs }],
  });
  for (const tool of [getProgramsTool, searchProgramsTool]) {
    const result = await runToolContract(
      tool,
      tool === getProgramsTool ? { id: 236948, limit: 1000 } : { limit: 1000 },
    );
    expect(result.structuredContent).toMatchObject({
      limit: 100,
      shown: 100,
      nextOffset: 100,
      query: { limit: 100 },
    });
    expect(result.content.map((b) => ('text' in b ? b.text : '')).join('\n')).toContain(
      'limit normalized to 100',
    );
  }
});
it.each([{ limit: 0 }, { limit: 1001 }, { offset: -1 }, { offset: 0.5 }])(
  'rejects invalid paging before I/O: %j',
  async (input) => {
    const result = await runToolContract(getProgramsTool, { id: 236948, ...input });
    expect(result.isError).toBe(true);
    expect(fetchPrograms).not.toHaveBeenCalled();
    expect(result.structuredContent).toMatchObject({
      error: { data: { reason: 'invalid_arguments' } },
    });
  },
);
it('keeps resource legacy scalar types and provider ordering across the exact continuation path', async () => {
  const context = createMockContext({ errors: programsResource.errors });
  const initial = await programsResource.handler(
    programsResource.params!.parse({ id: '236948' }),
    context,
  );
  expect(initial).toMatchObject({
    ope6_id: '003798',
    total: 3,
    shown: 3,
    nextUri: null,
    metric_scope: { earnings: 'opeid6', ipeds_awards: 'campus' },
  });
  const first = await programsPageResource.handler(
    programsPageResource.params!.parse({ id: '236948', offset: '0', limit: '2' }),
    createMockContext({ errors: programsPageResource.errors }),
  );
  expect(first).toMatchObject({
    nextUri: 'scorecard://programs/236948/page/2/2',
    programs: [
      {
        code: '1107',
        credential_level: 3,
        earnings_1yr_median: 101710,
        completion_1yr_median: 128218,
      },
      { code: '5202', credential_level: null, earnings_1yr_median: 200000 },
    ],
  });
  const second = await programsPageResource.handler(
    programsPageResource.params!.parse({ id: '236948', offset: '2', limit: '2' }),
    createMockContext({ errors: programsPageResource.errors }),
  );
  expect(second).toMatchObject({
    total: 3,
    shown: 1,
    nextUri: null,
    programs: [
      {
        code: '5138',
        earnings_1yr_median: null,
        completion_1yr_availability: 'privacy_suppressed',
      },
    ],
  });
  const past = await programsPageResource.handler(
    programsPageResource.params!.parse({ id: '236948', offset: '9', limit: '2' }),
    createMockContext({ errors: programsPageResource.errors }),
  );
  expect(past).toMatchObject({ total: 3, shown: 0, nextUri: null });
  expect(
    programsPageResource.params!.safeParse({ id: '236948', offset: '-1', limit: '2' }).success,
  ).toBe(false);
});
it('returns the declared not-found reason and usable recovery on both tool surfaces', async () => {
  fetchPrograms.mockResolvedValue({ metadata: { total: 0, page: 0, per_page: 1 }, results: [] });
  const result = await runToolContract(getProgramsTool, { id: 999999 });
  expect(result.structuredContent).toMatchObject({
    error: {
      data: {
        reason: 'school_not_found',
        recovery: { hint: 'Search for valid school IDs with scorecard_search_schools.' },
      },
    },
  });
  expect(result.content.map((b) => ('text' in b ? b.text : '')).join('\n')).toContain(
    'scorecard_search_schools',
  );
  await expect(
    programsPageResource.handler(
      programsPageResource.params!.parse({ id: '999999', offset: '0', limit: '2' }),
      createMockContext({ errors: programsPageResource.errors }),
    ),
  ).rejects.toMatchObject({ data: { reason: 'school_not_found' } });
});
