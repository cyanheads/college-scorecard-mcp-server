/**
 * @fileoverview Caller-facing contracts exercised through the real ScorecardService.
 * @module tests/services/scorecard-contract.test
 */

import { JsonRpcErrorCode } from '@cyanheads/mcp-ts-core/errors';
import {
  createFetchMock,
  createMockContext,
  type FetchMockHarness,
  runToolContract,
} from '@cyanheads/mcp-ts-core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FIELD_CATALOG } from '@/data/field-catalog.js';
import { programsResource } from '@/mcp-server/resources/definitions/programs.resource.js';
import { getProgramsTool } from '@/mcp-server/tools/definitions/get-programs.tool.js';
import { getSchoolTool } from '@/mcp-server/tools/definitions/get-school.tool.js';
import { searchProgramsTool } from '@/mcp-server/tools/definitions/search-programs.tool.js';
import { searchSchoolsTool } from '@/mcp-server/tools/definitions/search-schools.tool.js';
import {
  getScorecardService,
  initScorecardService,
} from '@/services/scorecard/scorecard-service.js';

const endpoint = /^https:\/\/api\.data\.gov\/ed\/collegescorecard\/v1\/schools\?/;
const textOf = (result: Awaited<ReturnType<typeof runToolContract>>) =>
  result.content.map((block) => (block.type === 'text' ? block.text : '')).join('\n');

let api: FetchMockHarness;
let requests: URL[];
function serve(
  results: Record<string, unknown>[],
  metadata = { total: results.length, page: 0, per_page: 20 },
) {
  api.route({
    match: endpoint,
    respond: (request) => {
      requests.push(new URL(request.url));
      return Response.json({ metadata, results });
    },
  });
}

const school = (programs: Record<string, unknown>[] = []) => ({
  id: 236948,
  'school.name': 'Test University',
  'school.state': 'WA',
  'school.ownership': 1,
  'latest.programs.cip_4_digit': programs,
});
const program = (earnings: number | null = 70000) => ({
  code: '1107',
  title: 'Computer Science',
  credential: { level: 3, title: "Bachelor's Degree" },
  earnings: { highest: { '1_yr': { overall_median_earnings: earnings } } },
});

describe('Scorecard caller contracts', () => {
  beforeEach(() => {
    vi.stubEnv('SCORECARD_API_KEY', 'test-key');
    initScorecardService({} as never, {} as never);
    requests = [];
    api = createFetchMock();
    api.install();
  });
  afterEach(() => {
    api.restore();
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  describe('characterization', () => {
    it('rejects empty IDs semantically without fetching, through service and tool', async () => {
      serve([]);
      expect(() =>
        getScorecardService().getSchoolProfiles([], undefined, createMockContext()),
      ).toThrow(expect.objectContaining({ code: JsonRpcErrorCode.ValidationError }));
      const result = await runToolContract(getSchoolTool, { id: [] });
      expect(result.isError).toBe(true);
      expect(result.structuredContent).toMatchObject({
        error: { code: -32007, message: 'No school IDs provided.' },
      });
      expect(textOf(result)).toContain('No school IDs provided.');
      expect(requests).toHaveLength(0);
    });

    it('keeps nonempty unmatched IDs on the not_found path', async () => {
      serve([]);
      const result = await runToolContract(getSchoolTool, { id: 999999 });
      expect(result.isError).toBe(true);
      expect(result.structuredContent).toMatchObject({
        error: { code: JsonRpcErrorCode.NotFound, data: { reason: 'not_found' } },
      });
      expect(textOf(result)).toContain('Search for valid school IDs');
      expect(requests).toHaveLength(1);
    });

    it('preserves program ordering and missing values on both tool surfaces and resource JSON', async () => {
      serve([school([program(null), program(70000), program(0)])]);
      const result = await runToolContract(getProgramsTool, { id: 236948 });
      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toMatchObject({
        total: 3,
        suppressed_count: 1,
        programs: [
          {
            code: '1107',
            credential_level: "Bachelor's",
            earnings_1yr_median: 70000,
            suppressed: false,
          },
          { earnings_1yr_median: 0, suppressed: false },
          { suppressed: true },
        ],
      });
      expect(textOf(result)).toContain('$70,000');
      expect(textOf(result)).toContain('$0');
      expect(textOf(result)).toContain('Suppressed');
      const resource = await programsResource.handler({ id: '236948' }, createMockContext());
      expect(resource).toMatchObject({
        total: 3,
        programs: [
          { earnings_1yr_median: null, median_debt: null },
          { earnings_1yr_median: 70000, median_debt: null },
          { earnings_1yr_median: 0, median_debt: null },
        ],
      });
    });

    it.each([429, 503])('retries HTTP %i and recovers on the next response', async (status) => {
      vi.useFakeTimers();
      let calls = 0;
      api.route({
        match: endpoint,
        respond: () =>
          ++calls === 1
            ? new Response('unavailable', { status })
            : Response.json({ metadata: { total: 1, page: 0, per_page: 1 }, results: [school()] }),
      });
      const pending = runToolContract(getSchoolTool, { id: 236948 });
      await vi.runAllTimersAsync();
      const result = await pending;
      expect(calls).toBe(2);
      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toMatchObject({ total_found: 1, schools: [{ id: 236948 }] });
      expect(textOf(result)).toContain('Test University');
    });

    it.each([searchSchoolsTool, searchProgramsTool])(
      'keeps school page metadata for $name',
      async (tool) => {
        serve([school([program(), program(null)])], { total: 8, page: 1, per_page: 2 });
        const result = await runToolContract(tool, { page: 1, per_page: 2 });
        expect(result.isError).toBeFalsy();
        expect(result.structuredContent).toMatchObject({
          total: 8,
          page: 1,
          per_page: 2,
          totalCount: 8,
          shown: 1,
          cap: 2,
        });
        expect(textOf(result)).toContain('**shown:** 1');
        expect(textOf(result)).toContain('**8 total**');
      },
    );
  });

  describe('program metrics', () => {
    it.each([0, 16118])(
      'maps real nested metrics including zero (%i) on every consumption path',
      async (value) => {
        serve([
          school([
            {
              ...program(),
              debt: {
                staff_grad_plus: {
                  all: { all_inst: { median: value }, eval_inst: { median: 999 } },
                },
              },
              counts: { ipeds_awards1: value, ipeds_awards2: value + 1 },
              earnings: {
                highest: {
                  '1_yr': {
                    overall_median_earnings: 70000,
                    working_not_enrolled: { overall_count: value },
                  },
                },
              },
            },
          ]),
        ]);
        const metrics = {
          median_debt: value,
          ipeds_awards_year1: value,
          ipeds_awards_year2: value + 1,
        };
        for (const [tool, input] of [
          [getProgramsTool, { id: 236948 }],
          [searchProgramsTool, {}],
        ] as const) {
          const result = await runToolContract(tool, input);
          expect(result.isError).toBeFalsy();
          expect(result.structuredContent).toMatchObject({ programs: [metrics] });
          const row = (result.structuredContent as { programs: Record<string, unknown>[] })
            .programs[0]!;
          expect(row).not.toHaveProperty('enrollment');
          const text = textOf(result);
          expect(text).toContain(`$${value.toLocaleString()}`);
          expect(text).toContain(`IPEDS Awards (debt cohort year 1): ${value.toLocaleString()}`);
          expect(text).toContain(
            `IPEDS Awards (debt cohort year 2): ${(value + 1).toLocaleString()}`,
          );
          expect(text).toContain('Stafford/Grad PLUS');
          expect(text).not.toContain('Enrollment:');
          if (tool === getProgramsTool) {
            expect(row.earnings_count).toBe(value);
            expect(text).toContain(
              `Earnings Cohort (working, not enrolled; 1 year after highest credential): ${value}`,
            );
          }
        }
        const resource = await programsResource.handler({ id: '236948' }, createMockContext());
        expect(resource).toMatchObject({ programs: [metrics] });
        expect(JSON.stringify(resource)).not.toContain('enrollment');
      },
    );

    it.each(['omitted', 'null'] as const)(
      'preserves %s program metrics as unknown',
      async (kind) => {
        serve([
          school([
            {
              ...program(null),
              ...(kind === 'null'
                ? {
                    debt: { staff_grad_plus: { all: { all_inst: { median: null } } } },
                    counts: { ipeds_awards1: null, ipeds_awards2: null },
                    earnings: {
                      highest: {
                        '1_yr': {
                          overall_median_earnings: null,
                          working_not_enrolled: { overall_count: null },
                        },
                      },
                    },
                  }
                : {}),
            },
          ]),
        ]);
        for (const [tool, input] of [
          [getProgramsTool, { id: 236948 }],
          [searchProgramsTool, {}],
        ] as const) {
          const result = await runToolContract(tool, input);
          expect(result.isError).toBeFalsy();
          const row = (result.structuredContent as { programs: Record<string, unknown>[] })
            .programs[0]!;
          for (const key of [
            'median_debt',
            'ipeds_awards_year1',
            'ipeds_awards_year2',
            'earnings_count',
            'enrollment',
          ]) {
            expect(row).not.toHaveProperty(key);
          }
          expect(textOf(result)).not.toContain('IPEDS Awards');
        }
        const resource = await programsResource.handler({ id: '236948' }, createMockContext());
        expect(resource).toMatchObject({
          programs: [{ median_debt: null, ipeds_awards_year1: null, ipeds_awards_year2: null }],
        });
      },
    );

    it.each([
      {
        min: undefined,
        max: undefined,
        expected: ['above', 'equal', 'below', 'zero', 'null', 'missing'],
      },
      { min: 50000, max: undefined, expected: ['above', 'equal'] },
      { min: 0, max: undefined, expected: ['above', 'equal', 'below', 'zero'] },
      { min: undefined, max: 20000, expected: ['equal', 'below', 'zero'] },
      { min: undefined, max: 0, expected: ['zero'] },
      { min: 50000, max: 20000, expected: ['equal'] },
      { min: 999999, max: undefined, expected: [] },
    ])(
      'filters local rows at inclusive boundaries: min=$min max=$max',
      async ({ min, max, expected }) => {
        const rows = [
          ['above', 60000, 20001],
          ['equal', 50000, 20000],
          ['below', 49999, 19999],
          ['zero', 0, 0],
          ['null', null, null],
          ['missing', undefined, undefined],
        ] as const;
        serve(
          [
            school(
              rows.map(([title, earnings, debt]) => ({
                ...program(),
                title,
                ...(earnings === undefined
                  ? { earnings: {} }
                  : {
                      earnings: { highest: { '1_yr': { overall_median_earnings: earnings } } },
                    }),
                ...(debt === undefined
                  ? {}
                  : { debt: { staff_grad_plus: { all: { all_inst: { median: debt } } } } }),
              })),
            ),
          ],
          { total: 4, page: 0, per_page: 1 },
        );
        const result = await runToolContract(searchProgramsTool, {
          cip_code: '11.07',
          min_earnings: min,
          max_debt: max,
          per_page: 1,
        });
        expect(result.isError).toBeFalsy();
        const data = result.structuredContent as {
          programs: { program_title: string }[];
          notice?: string;
        };
        expect(data.programs.map((p) => p.program_title)).toEqual(expected);
        expect(result.structuredContent).toMatchObject({
          total: 4,
          totalCount: 4,
          shown: 1,
          cap: 1,
          truncated: true,
        });
        const params = requests[0]!.searchParams;
        expect(params.get('latest.programs.cip_4_digit.code')).toBe('1107');
        expect(
          params.has(
            'latest.programs.cip_4_digit.earnings.highest.1_yr.overall_median_earnings__range',
          ),
        ).toBe(false);
        expect(
          params.get('latest.programs.cip_4_digit.debt.staff_grad_plus.all.all_inst.median__range'),
        ).toBe(max === undefined ? null : `..${max}`);
        expect(params.has('latest.programs.cip_4_digit.debt.median_debt__range')).toBe(false);
        for (const title of expected) expect(textOf(result)).toContain(`— ${title}`);
        if (expected.length === 0) expect(textOf(result)).toContain('No programs matched');
      },
    );

    it('publishes real program paths and supported sort flags', () => {
      const paths = FIELD_CATALOG.map((field) => field.path);
      for (const suffix of [
        'credential.level',
        'debt.staff_grad_plus.all.all_inst.median',
        'earnings.highest.1_yr.working_not_enrolled.overall_count',
        'counts.ipeds_awards1',
        'counts.ipeds_awards2',
      ]) {
        expect(paths).toContain(`latest.programs.cip_4_digit.${suffix}`);
      }
      expect(paths).not.toContain('latest.programs.cip_4_digit.counts.ipeds_enrollment');
      expect(
        FIELD_CATALOG.find((f) => f.path === 'latest.earnings.6_yrs_after_entry.median')?.sortable,
      ).toBe(false);
      expect(
        FIELD_CATALOG.find((f) => f.path === 'latest.cost.avg_net_price.overall')?.sortable,
      ).toBe(true);
    });
  });

  describe('pagination and notices', () => {
    const pages = [
      { label: 'first with more', total: 5, page: 0, per_page: 2, count: 2, more: true },
      { label: 'second with more', total: 5, page: 1, per_page: 2, count: 2, more: true },
      { label: 'full final', total: 4, page: 1, per_page: 2, count: 2, more: false },
      { label: 'short final', total: 5, page: 2, per_page: 2, count: 1, more: false },
      { label: 'empty', total: 0, page: 0, per_page: 2, count: 0, more: false },
      { label: 'past end', total: 4, page: 2, per_page: 2, count: 0, more: false },
      { label: 'full first final', total: 2, page: 0, per_page: 2, count: 2, more: false },
    ];
    for (const tool of [searchSchoolsTool, searchProgramsTool]) {
      it.each(pages)(`${tool.name}: $label`, async ({ total, page, per_page, count, more }) => {
        serve(
          Array.from({ length: count }, () => school([program(), program(null), program(0)])),
          { total, page, per_page },
        );
        const result = await runToolContract(tool, { page, per_page });
        expect(result.isError).toBeFalsy();
        expect(result.structuredContent).toMatchObject({
          total,
          page,
          per_page,
          totalCount: total,
          shown: count,
          cap: per_page,
          truncated: more,
        });
        const text = textOf(result);
        expect(text).toContain(`**truncated:** ${more}`);
        expect(text).toContain(`**shown:** ${count}`);
        expect(text).toContain(`**cap:** ${per_page}`);
        if (more) {
          expect(text).toContain(`Request page ${page + 1}`);
          expect(text.match(/Request page/g)).toHaveLength(1);
        } else {
          expect(text).not.toContain('Request page');
        }
        if (count === 0)
          expect(text).toContain(
            tool === searchSchoolsTool ? 'No schools matched' : 'No programs matched',
          );
      });
    }

    it.each([
      { mode: 'suppressed', rows: [program(null)], hint: 'suppressed earnings data' },
      { mode: 'empty', rows: [program()], hint: 'No programs matched' },
    ])(
      'composes $mode guidance once with continuation and keeps it at exhaustion',
      async ({ mode, rows, hint }) => {
        let page = 0;
        api.route({
          match: endpoint,
          respond: () =>
            Response.json({ metadata: { total: 2, page, per_page: 1 }, results: [school(rows)] }),
        });
        for (page = 0; page < 2; page++) {
          const result = await runToolContract(searchProgramsTool, {
            per_page: 1,
            page,
            ...(mode === 'empty' ? { program_name: 'does not match' } : {}),
          });
          expect(result.isError).toBeFalsy();
          const data = result.structuredContent as { notice: string };
          expect(data.notice).toContain(hint);
          const text = textOf(result);
          expect(text.split(hint)).toHaveLength(2);
          expect(result.structuredContent).toMatchObject({
            truncated: page === 0,
            shown: 1,
            cap: 1,
            totalCount: 2,
          });
          if (page === 0) {
            expect(data.notice).toContain('Request page 1');
            expect(text.match(/Request page 1/g)).toHaveLength(1);
          } else {
            expect(data.notice).not.toContain('Request page');
            expect(text).not.toContain('Request page');
          }
        }
      },
    );
  });

  describe('authentication retry boundary', () => {
    it.each([
      { status: 401, body: {} },
      { status: 403, body: {} },
      { status: 200, body: { error: { code: 'API_KEY_MISSING', message: 'Missing key' } } },
      { status: 200, body: { error: { code: 'API_KEY_INVALID', message: 'Invalid key' } } },
      { status: 200, body: { errors: [{ error: 'API_KEY_INVALID', message: 'Invalid key' }] } },
      { status: 200, body: { errors: [{ error: 'API_KEY_MISSING', message: 'Missing key' }] } },
    ])('fails once without delay for $status $body', async ({ status, body }) => {
      vi.useFakeTimers();
      const started = Date.now();
      let calls = 0;
      api.route({
        match: endpoint,
        respond: () => {
          calls++;
          return Response.json(body, { status });
        },
      });
      const pending = runToolContract(getSchoolTool, { id: 236948 });
      await vi.runAllTimersAsync();
      const result = await pending;
      expect(result.isError).toBe(true);
      expect(result.structuredContent).toMatchObject({
        error: {
          code: JsonRpcErrorCode.ServiceUnavailable,
          data: {
            reason: 'api_error',
            retryable: false,
            recovery: { hint: expect.stringContaining('SCORECARD_API_KEY') },
          },
        },
      });
      expect(textOf(result)).toContain('SCORECARD_API_KEY');
      expect(textOf(result)).toContain('not retryable');
      expect(calls).toBe(1);
      expect(Date.now()).toBe(started);
    });
    it.each([429, 503])('still exhausts transient HTTP %i retries', async (status) => {
      vi.useFakeTimers();
      let calls = 0;
      api.route({
        match: endpoint,
        respond: () => {
          calls++;
          return new Response('unavailable', { status });
        },
      });
      const pending = runToolContract(getSchoolTool, { id: 236948 });
      await vi.runAllTimersAsync();
      const result = await pending;
      expect(result.isError).toBe(true);
      expect(result.structuredContent).toMatchObject({
        error: {
          code: JsonRpcErrorCode.ServiceUnavailable,
          data: { reason: 'api_error', retryAttempts: 4 },
        },
      });
      expect(calls).toBe(4);
      expect(textOf(result)).toContain('retry');
    });
  });

  describe('school sorting and single-sex flags', () => {
    it.each(['asc', 'desc'])(
      'forwards a supported %s sort and preserves upstream order',
      async (direction) => {
        const prices = direction === 'asc' ? [1000, 2000] : [2000, 1000];
        serve(
          prices.map((price, i) => ({
            id: i + 1,
            'school.name': `School ${price}`,
            'latest.cost.avg_net_price.overall': price,
          })),
        );
        const sort = `latest.cost.avg_net_price.overall:${direction}`;
        const result = await runToolContract(searchSchoolsTool, { sort });
        expect(result.isError).toBeFalsy();
        expect(requests[0]!.searchParams.get('sort')).toBe(sort);
        expect(result.structuredContent).toMatchObject({
          schools: prices.map((price) => ({ net_price_overall: price })),
        });
        expect(textOf(result).indexOf(`School ${prices[0]}`)).toBeLessThan(
          textOf(result).indexOf(`School ${prices[1]}`),
        );
      },
    );
    it.each([
      ['men_only', true],
      ['men_only', false],
      ['men_only', undefined],
      ['women_only', true],
      ['women_only', false],
      ['women_only', undefined],
    ] as const)('forwards %s independently as tri-state (%s)', async (field, flag) => {
      serve([school()]);
      const result = await runToolContract(searchSchoolsTool, {
        [field]: flag,
      });
      expect(result.isError).toBeFalsy();
      expect(requests).toHaveLength(1);
      for (const key of ['school.men_only', 'school.women_only'])
        expect(requests[0]!.searchParams.get(key)).toBe(
          key !== `school.${field}` || flag === undefined ? null : flag ? '1' : '0',
        );
      expect(requests[0]!.searchParams.has('sort')).toBe(false);
    });
    it.each([1, 0, null, undefined])(
      'preserves known and unknown profile flags (%s)',
      async (flag) => {
        serve([
          {
            ...school(),
            'school.hbcu': 1,
            'latest.student.size': 42,
            ...(flag === undefined ? {} : { 'school.men_only': flag, 'school.women_only': flag }),
          },
        ]);
        const result = await runToolContract(getSchoolTool, { id: 236948 });
        expect(result.isError).toBeFalsy();
        expect(result.structuredContent).toMatchObject({
          schools: [{ hbcu: true, enrollment: 42 }],
        });
        const row = (result.structuredContent as { schools: Record<string, unknown>[] })
          .schools[0]!;
        const text = textOf(result);
        for (const [key, label] of [
          ['men_only', 'Men-only'],
          ['women_only', 'Women-only'],
        ]) {
          if (flag == null) {
            expect(row).not.toHaveProperty(key!);
            expect(text).not.toContain(`${label}:`);
          } else {
            expect(row[key!]).toBe(flag === 1);
            expect(text).toContain(`**${label}:** ${flag === 1 ? 'Yes' : 'No'}`);
          }
        }
      },
    );
    it.each([
      { sort: true },
      { men_only: 'perhaps' },
      { women_only: 2 },
      { per_page: 101 },
      { page: -1 },
    ])('rejects invalid search arguments without fetching: %j', async (input) => {
      serve([]);
      // Deliberately invalid wire values exercise runtime validation.
      // @ts-expect-error The contract helper otherwise requires schema-valid input types.
      const result = await runToolContract(searchSchoolsTool, input);
      expect(result.isError).toBe(true);
      expect(result.structuredContent).toMatchObject({
        error: { code: JsonRpcErrorCode.InvalidParams, data: { reason: 'invalid_arguments' } },
      });
      expect(textOf(result)).toContain('Invalid arguments');
      expect(requests).toHaveLength(0);
    });
  });
});
