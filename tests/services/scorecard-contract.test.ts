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
import { EARNINGS_FIELDS } from '@/data/earnings-context.js';
import { FIELD_CATALOG } from '@/data/field-catalog.js';
import { programsResource } from '@/mcp-server/resources/definitions/programs.resource.js';
import { schoolResource } from '@/mcp-server/resources/definitions/school.resource.js';
import { compareSchoolsTool } from '@/mcp-server/tools/definitions/compare-schools.tool.js';
import { getEarningsTool } from '@/mcp-server/tools/definitions/get-earnings.tool.js';
import { getProgramsTool } from '@/mcp-server/tools/definitions/get-programs.tool.js';
import { getSchoolTool } from '@/mcp-server/tools/definitions/get-school.tool.js';
import { listFieldsTool } from '@/mcp-server/tools/definitions/list-fields.tool.js';
import { lookupCipTool } from '@/mcp-server/tools/definitions/lookup-cip.tool.js';
import { searchProgramsTool } from '@/mcp-server/tools/definitions/search-programs.tool.js';
import { searchSchoolsTool } from '@/mcp-server/tools/definitions/search-schools.tool.js';
import { valueAnalysisTool } from '@/mcp-server/tools/definitions/value-analysis.tool.js';
import {
  getScorecardService,
  initScorecardService,
} from '@/services/scorecard/scorecard-service.js';
import earningsReference from '../fixtures/earnings-reference.json' with { type: 'json' };

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

  describe('reconciled lookup and search regressions', () => {
    it('renders available P75 profile values even when P25 is absent', async () => {
      serve([
        {
          ...school(),
          'latest.earnings.6_yrs_after_entry.working_not_enrolled.earnings_percentile.75': 70000,
          'latest.earnings.10_yrs_after_entry.working_not_enrolled.earnings_percentile.75': 80000,
        },
      ]);
      const result = await runToolContract(getSchoolTool, { id: 236948 });
      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toMatchObject({
        schools: [{ earnings_6yr_p75: 70000, earnings_10yr_p75: 80000 }],
      });
      expect(textOf(result)).toContain('Earnings P25/P75 (6yr): N/A / $70,000');
      expect(textOf(result)).toContain('Earnings P25/P75 (10yr): N/A / $80,000');
    });
    it.each([0, 1, 2])(
      'applies provider CIP × credential conjunction before slicing school page %i',
      async (page) => {
        const records = [
          [
            { ...program(), credential: { level: 5, title: "Master's" } },
            { ...program(), code: '5202' },
          ],
          [program(), { ...program(), credential: { level: 5, title: "Master's" } }],
          [program(0)],
        ].map((programs, index) => ({
          ...school(),
          id: index + 1,
          'latest.programs.cip_4_digit': programs,
        }));
        api.route({
          match: endpoint,
          respond: (request) => {
            const url = new URL(request.url);
            requests.push(url);
            const matching = records.flatMap((record) => {
              const rows = record['latest.programs.cip_4_digit'].filter(
                (row) =>
                  row.code === url.searchParams.get('latest.programs.cip_4_digit.code') &&
                  row.credential.level ===
                    Number(url.searchParams.get('latest.programs.cip_4_digit.credential.level')),
              );
              return rows.length ? [{ ...record, 'latest.programs.cip_4_digit': rows }] : [];
            });
            const offset = Number(url.searchParams.get('page'));
            return Response.json({
              metadata: { total: matching.length, page: offset, per_page: 1 },
              results: matching.slice(offset, offset + 1),
            });
          },
        });
        const result = await runToolContract(searchProgramsTool, {
          cip_code: '11.07',
          credential_level: 3,
          per_page: 1,
          page,
        });
        expect(result.isError).toBeFalsy();
        expect(result.structuredContent).toMatchObject({
          total: 2,
          page,
          per_page: 1,
          total_programs: page < 2 ? 1 : 0,
          query: { cip_code: '1107', credential_level: 3 },
          truncated: page === 0,
        });
        const rows = (result.structuredContent as { programs: { school_id: number }[] }).programs;
        expect(rows.map((row) => row.school_id)).toEqual(page === 0 ? [2] : page === 1 ? [3] : []);
        expect(requests).toHaveLength(1);
        expect(textOf(result)).toContain('"credential_level":3');
        if (page === 2) expect(textOf(result)).toContain('page is exhausted');
      },
    );
    it('matches every embedded historical/latest provenance cell to the official dictionary fixture', async () => {
      serve(earningsReference.response.results);
      const years = Object.keys(earningsReference.trend_context).map(Number);
      const result = await runToolContract(getEarningsTool, { id: 236948, years });
      expect(result.isError).toBeFalsy();
      const data = result.structuredContent as {
        current_context: unknown;
        trend: { year: number; context: unknown }[];
      };
      expect(data.current_context).toEqual(earningsReference.current_context);
      for (const row of data.trend)
        expect(row.context).toEqual(
          earningsReference.trend_context[
            String(row.year) as keyof typeof earningsReference.trend_context
          ],
        );
      expect(requests).toHaveLength(1);
      expect(textOf(result)).toContain('Non-Male');
      const text = textOf(result);
      for (const [key, context] of Object.entries(earningsReference.current_context)) {
        const label = {
          earnings_6yr_median: '6-Year Median',
          earnings_6yr_p25: '6-Year P25',
          earnings_6yr_p75: '6-Year P75',
          earnings_8yr_median: '8-Year Median',
          earnings_10yr_median: '10-Year Median',
          earnings_10yr_p25: '10-Year P25',
          earnings_10yr_p75: '10-Year P75',
          earnings_6yr_non_male_median: '6-Year Non-Male Median',
          earnings_6yr_male_median: '6-Year Male Median',
        }[key as keyof typeof earningsReference.current_context];
        expect(text.split('\n')).toContain(
          `${label}: available | Data-file year: ${context.data_file_year} | Entry cohorts: ${context.entry_cohorts.join(', ')} | Measurement years: ${context.measurement_years.join(', ')} | Dollar year: ${context.dollar_year}`,
        );
      }
    });
    it.each(['PS', 'PrivacySuppressed'] as const)(
      'requires every current metric explicitly %s for aggregate suppression',
      async (marker) => {
        serve([
          {
            ...school(),
            ...Object.fromEntries(
              Object.values(EARNINGS_FIELDS).map((suffix) => [`latest.earnings.${suffix}`, marker]),
            ),
          },
        ]);
        const result = await runToolContract(getEarningsTool, { id: 236948 });
        expect(result.isError).toBeFalsy();
        expect(result.structuredContent).toMatchObject({
          current: {},
          suppressed: true,
          suppression_note: expect.stringContaining('explicitly privacy-suppressed'),
        });
        expect(textOf(result)).toContain('privacy_suppressed');
      },
    );
    it('preserves earnings availability independently of numeric values and provenance', async () => {
      serve([
        {
          ...school(),
          'latest.earnings.6_yrs_after_entry.median': 0,
          'latest.earnings.10_yrs_after_entry.median': 'PS',
          '2011.earnings.6_yrs_after_entry.median': 'PrivacySuppressed',
        },
      ]);
      const result = await runToolContract(getEarningsTool, { id: 236948, years: [2011] });
      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toMatchObject({
        suppressed: false,
        current: { earnings_6yr_median: 0 },
        current_availability: {
          earnings_6yr_median: 'available',
          earnings_10yr_median: 'privacy_suppressed',
          earnings_6yr_p25: 'unavailable',
        },
        current_context: {
          earnings_6yr_median: {
            data_file_year: 2020,
            entry_cohorts: ['2013-14', '2014-15'],
            dollar_year: 2022,
          },
          earnings_8yr_median: { entry_cohorts: ['2011-12', '2012-13'] },
          earnings_10yr_median: { entry_cohorts: ['2009-10', '2010-11'] },
        },
        trend: [
          {
            availability: {
              earnings_6yr_median: 'privacy_suppressed',
              earnings_10yr_median: 'unavailable',
            },
          },
        ],
      });
      expect(textOf(result)).toContain('privacy_suppressed');
      expect(textOf(result)).toContain('unavailable');
      expect(textOf(result)).not.toMatch(/FERPA|small cohort/);
      expect(requests).toHaveLength(1);
    });
    it('requests and maps provider earnings percentiles and non-male medians', async () => {
      const record = {
        ...school(),
        'latest.earnings.6_yrs_after_entry.median': 50000,
        'latest.earnings.6_yrs_after_entry.working_not_enrolled.earnings_percentile.25': 0,
        'latest.earnings.6_yrs_after_entry.working_not_enrolled.earnings_percentile.75': 70000,
        'latest.earnings.10_yrs_after_entry.working_not_enrolled.earnings_percentile.25': 40000,
        'latest.earnings.10_yrs_after_entry.working_not_enrolled.earnings_percentile.75': 80000,
        'latest.earnings.6_yrs_after_entry.median_earnings_non_male': 45000,
        'latest.earnings.6_yrs_after_entry.median_earnings_male': 55000,
      };
      api.route({
        match: endpoint,
        respond: (request) => {
          const url = new URL(request.url);
          requests.push(url);
          const fields = url.searchParams.get('fields')!.split(',');
          return Response.json({
            metadata: { total: 1, page: 0, per_page: 1 },
            results: [
              Object.fromEntries(Object.entries(record).filter(([key]) => fields.includes(key))),
            ],
          });
        },
      });
      for (const definition of [getEarningsTool, getSchoolTool]) {
        const result = await runToolContract(definition, { id: 236948 });
        expect(result.isError).toBeFalsy();
        const data = result.structuredContent as {
          current?: Record<string, unknown>;
          schools?: Record<string, unknown>[];
        };
        expect(data.current ?? data.schools?.[0]).toMatchObject({
          earnings_6yr_p25: 0,
          earnings_6yr_p75: 70000,
          earnings_10yr_p25: 40000,
          earnings_10yr_p75: 80000,
        });
        expect(textOf(result)).toContain('$0');
        expect(textOf(result)).toContain('70,000');
        if (definition === getEarningsTool)
          expect(data.current).toMatchObject({
            earnings_6yr_non_male_median: 45000,
            earnings_6yr_male_median: 55000,
          });
      }
      expect(requests).toHaveLength(2);
      for (const request of requests)
        expect(request.searchParams.get('fields')).not.toMatch(
          /percentile25|percentile75|female_students|male_students/,
        );
      expect(
        FIELD_CATALOG.some((field) =>
          /percent_greater_than_100000|mean_annual_increment/.test(field.path),
        ),
      ).toBe(false);
    });
    it('validates data-file years without losing valid old or unavailable observations', async () => {
      serve([
        {
          ...school(),
          '2003.earnings.6_yrs_after_entry.median': 30000,
          '2005.earnings.6_yrs_after_entry.median': 35000,
          '2011.earnings.6_yrs_after_entry.median': 41300,
          '2011.earnings.10_yrs_after_entry.median': 52100,
        },
      ]);
      const result = await runToolContract(getEarningsTool, {
        id: 236948,
        years: [1996, 2003, 2005, 2011, 2021, 2025],
      });
      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toMatchObject({
        trend: [
          { year: 1996, availability: { earnings_6yr_median: 'unavailable' } },
          { year: 2003, earnings_6yr_median: 30000 },
          { year: 2005, earnings_6yr_median: 35000 },
          {
            year: 2011,
            earnings_6yr_median: 41300,
            context: {
              earnings_6yr_median: {
                data_file_year: 2011,
                entry_cohorts: ['2004-05', '2005-06'],
                measurement_years: [2011, 2012],
                dollar_year: 2014,
              },
              earnings_10yr_median: { entry_cohorts: ['2000-01', '2001-02'] },
            },
          },
          { year: 2021, availability: { earnings_6yr_median: 'unavailable' } },
          { year: 2025 },
        ],
      });
      expect(textOf(result)).toContain('Data-file');
      expect(textOf(result)).toContain('2004-05');
      expect(textOf(result)).toContain('2014');
      for (const year of [-1, 1995, 2026, 9999]) {
        const invalid = await runToolContract(getEarningsTool, { id: 236948, years: [year] });
        expect(invalid.isError).toBe(true);
        expect(invalid.structuredContent).toMatchObject({
          error: { code: JsonRpcErrorCode.InvalidParams },
        });
      }
      expect(requests).toHaveLength(1);
    });
    it.each([
      { raw: 0, availability: 'available', suppressed: false, value: 0 },
      { raw: null, availability: 'unavailable', suppressed: false, value: undefined },
      { raw: undefined, availability: 'unavailable', suppressed: false, value: undefined },
      { raw: 'PS', availability: 'privacy_suppressed', suppressed: true, value: undefined },
      {
        raw: 'PrivacySuppressed',
        availability: 'privacy_suppressed',
        suppressed: true,
        value: undefined,
      },
    ])(
      'distinguishes program metric availability for $raw',
      async ({ raw, availability, suppressed, value }) => {
        serve([
          school([
            { ...program(), earnings: { highest: { '1_yr': { overall_median_earnings: raw } } } },
          ]),
        ]);
        for (const definition of [getProgramsTool, searchProgramsTool]) {
          const result = await runToolContract(
            definition,
            definition === getProgramsTool ? { id: 236948 } : {},
          );
          expect(result.isError).toBeFalsy();
          expect(result.structuredContent).toMatchObject({
            suppressed_count: Number(suppressed),
            unavailable_count: Number(availability === 'unavailable'),
            programs: [{ earnings_availability: availability, suppressed }],
          });
          const row = (result.structuredContent as { programs: Record<string, unknown>[] })
            .programs[0]!;
          expect(row.earnings_1yr_median).toBe(value);
          expect(textOf(result)).toContain(availability);
          expect(textOf(result)).not.toMatch(/FERPA|small cohort/);
        }
      },
    );
    it('rejects unknown metric strings through the availability contract', async () => {
      serve([
        school([
          {
            ...program(),
            earnings: { highest: { '1_yr': { overall_median_earnings: 'unknown-value' } } },
          },
        ]),
      ]);
      const result = await runToolContract(getProgramsTool, { id: 236948 });
      expect(result.isError).toBe(true);
      expect(result.structuredContent).toMatchObject({
        error: { code: JsonRpcErrorCode.ServiceUnavailable, data: { reason: 'api_error' } },
      });
      expect(textOf(result)).toContain('provider metric');
      expect(textOf(result)).toContain('report persistent provider failures');
    });
    const statusCases = [
      [400, JsonRpcErrorCode.InvalidParams, 'api_invalid_params', 1],
      [422, JsonRpcErrorCode.ValidationError, 'api_validation', 1],
      [401, JsonRpcErrorCode.Unauthorized, 'api_unauthorized', 1],
      [403, JsonRpcErrorCode.Forbidden, 'api_forbidden', 1],
      [409, JsonRpcErrorCode.Conflict, 'api_conflict', 1],
      [429, JsonRpcErrorCode.RateLimited, 'api_rate_limited', 4],
      [408, JsonRpcErrorCode.Timeout, 'api_timeout', 4],
      [504, JsonRpcErrorCode.Timeout, 'api_timeout', 4],
      [500, JsonRpcErrorCode.ServiceUnavailable, 'api_error', 4],
    ] as const;

    it.each(statusCases)(
      'maps provider HTTP %i through actual retry on tool and resource handlers',
      async (status, code, reason, attempts) => {
        vi.useFakeTimers();
        let calls = 0;
        api.route({
          match: endpoint,
          respond: () => {
            calls++;
            return Response.json(
              {
                message: `Provider detail https://api.data.gov/path?api_key=test-key token=test-key`,
              },
              { status },
            );
          },
        });
        const resultPending = runToolContract(getSchoolTool, { id: 236948 });
        await vi.runAllTimersAsync();
        const result = await resultPending;
        expect(result.structuredContent).toMatchObject({
          error: { code, data: { reason, status, recovery: { hint: expect.any(String) } } },
        });
        expect(calls).toBe(attempts);
        expect(textOf(result)).toContain('Provider detail');
        expect(JSON.stringify(result)).not.toContain('test-key');
        for (const definition of [schoolResource, programsResource]) {
          calls = 0;
          const pending = Promise.resolve(
            definition.handler({ id: '236948' }, createMockContext({ errors: definition.errors })),
          ).catch((error: unknown) => error);
          await vi.runAllTimersAsync();
          const error = await pending;
          expect(error).toMatchObject({
            code,
            data: { reason, status, recovery: { hint: expect.any(String) } },
          });
          expect(calls).toBe(attempts);
          expect(JSON.stringify(error)).not.toContain('test-key');
        }
      },
    );

    it.each([schoolResource, programsResource])(
      'returns resource recovery for missing $name',
      async (definition) => {
        serve([]);
        await expect(
          definition.handler({ id: '987654321' }, createMockContext({ errors: definition.errors })),
        ).rejects.toMatchObject({
          code: JsonRpcErrorCode.NotFound,
          data: { reason: 'school_not_found' },
        });
        expect(
          definition.errors?.find((entry) => entry.reason === 'school_not_found')?.recovery,
        ).toContain('scorecard_search_schools');
      },
    );

    it.each([schoolResource, programsResource])(
      'preserves sparse/null successful resource JSON for $name',
      async (definition) => {
        serve([
          {
            id: 236948,
            'school.name': 'Sparse school',
            'latest.cost.tuition.in_state': null,
            'latest.programs.cip_4_digit': [],
          },
        ]);
        const result = await definition.handler(
          { id: ' 0236948 ' },
          createMockContext({ errors: definition.errors }),
        );
        expect(JSON.parse(JSON.stringify(result))).toMatchObject(
          definition === schoolResource
            ? { id: 236948, tuition_in_state: null }
            : { school_id: 236948, programs: [], total: 0 },
        );
        expect(requests[0]!.searchParams.get('id')).toBe('236948');
      },
    );

    it.each([schoolResource, programsResource])(
      'rejects invalid resource IDs before fetch for $name',
      async (definition) => {
        serve([school()]);
        for (const id of [' ', '-1', '0', '1.5', 'abc', '9007199254740992'])
          expect(() => definition.params?.parse({ id })).toThrow();
        expect(requests).toHaveLength(0);
      },
    );

    it('keeps the deadline armed while reading the body, then retries and recovers', async () => {
      vi.useFakeTimers();
      let calls = 0;
      let cancelled = 0;
      api.route({
        match: endpoint,
        respond: (request) => {
          calls++;
          if (calls === 1)
            return new Response(
              new ReadableStream({
                start(stream) {
                  request.signal.addEventListener(
                    'abort',
                    () => {
                      cancelled++;
                      stream.error(request.signal.reason);
                    },
                    { once: true },
                  );
                },
              }),
            );
          return Response.json({
            metadata: { total: 1, page: 0, per_page: 1 },
            results: [school()],
          });
        },
      });
      const pending = runToolContract(getSchoolTool, { id: 236948 });
      await vi.runAllTimersAsync();
      const result = await pending;
      expect(result.isError).toBeFalsy();
      expect(calls).toBe(2);
      expect(cancelled).toBe(1);
      expect(result.structuredContent).toMatchObject({ total_found: 1 });
    });

    it('stops a pending body read on caller cancellation without retrying', async () => {
      const controller = new AbortController();
      let announceHeaders: (() => void) | undefined;
      const headers = new Promise<void>((resolve) => {
        announceHeaders = resolve;
      });
      let calls = 0;
      api.route({
        match: endpoint,
        respond: (request) => {
          calls++;
          announceHeaders?.();
          return new Response(
            new ReadableStream({
              start(stream) {
                request.signal.addEventListener(
                  'abort',
                  () => stream.error(request.signal.reason),
                  { once: true },
                );
              },
            }),
          );
        },
      });
      const pending = runToolContract(
        getSchoolTool,
        { id: 236948 },
        { context: { signal: controller.signal } },
      );
      await headers;
      await Promise.resolve();
      controller.abort();
      const result = await pending;
      expect(result.structuredContent).toMatchObject({
        error: { code: JsonRpcErrorCode.RequestCancelled },
      });
      expect(textOf(result).toLowerCase()).toMatch(/abort|cancel/);
      expect(calls).toBe(1);
    });

    it.each([
      '',
      '   ',
      'abc',
      '0',
      '-1',
      '1.5',
      '9007199254740992',
      '0x39d94',
      'Infinity',
      'NaN',
      0,
      -1,
      1.5,
      Number.MAX_SAFE_INTEGER + 1,
    ])('rejects invalid ID %s on every lookup surface without fetching', async (id) => {
      serve([school()]);
      for (const tool of [getSchoolTool, getProgramsTool, getEarningsTool, valueAnalysisTool]) {
        const result = await runToolContract(tool, { id });
        expect(result.isError).toBe(true);
        expect(result.structuredContent).toMatchObject({
          error: { code: JsonRpcErrorCode.InvalidParams },
        });
        expect(textOf(result)).toContain('Invalid arguments');
      }
      const comparison = await runToolContract(compareSchoolsTool, {
        ids: [236948, id],
        topic: 'costs',
      });
      expect(comparison.isError).toBe(true);
      expect(() =>
        getScorecardService().getSchoolProfiles([id], undefined, createMockContext()),
      ).toThrow();
      expect(() => getScorecardService().getSchoolEarnings(id, [], createMockContext())).toThrow();
      expect(() => getScorecardService().getValueAnalysisData(id, createMockContext())).toThrow();
      expect(() =>
        getScorecardService().getSchoolPrograms(
          id,
          undefined,
          undefined,
          undefined,
          createMockContext(),
        ),
      ).toThrow();
      expect(requests).toHaveLength(0);
    });

    it.each([236948, '236948', ' 0236948 ', '236948.0', '+236948', '2.36948e5'])(
      'normalizes valid ID %s for every service entry point',
      async (id) => {
        serve([school()]);
        const service = getScorecardService();
        const ctx = createMockContext();
        await service.getSchoolProfiles([id], undefined, ctx);
        await service.getSchoolPrograms(id, undefined, undefined, undefined, ctx);
        await service.getSchoolEarnings(id, [], ctx);
        await service.getValueAnalysisData(id, ctx);
        await service.getComparisonData([id, 123], 'costs', ctx);
        expect(requests.map((url) => url.searchParams.get('id'))).toEqual([
          '236948',
          '236948',
          '236948',
          '236948',
          '236948',
          '236948,123',
        ]);
      },
    );

    it.each([100, 101, 1000, 1001])(
      'serves or rejects %i raw IDs at the documented boundaries',
      async (count) => {
        const ids = Array.from({ length: count }, (_, index) => index + 1);
        api.route({
          match: endpoint,
          respond: (request) => {
            const url = new URL(request.url);
            requests.push(url);
            const processed = url.searchParams.get('id')!.split(',').map(Number);
            return Response.json({
              metadata: { total: processed.length, page: 0, per_page: processed.length },
              results: processed.map((id) => ({ id, 'school.name': `School ${id}` })),
            });
          },
        });
        const result = await runToolContract(getSchoolTool, { id: ids });
        if (count > 1000) {
          expect(result.isError).toBe(true);
          expect(requests).toHaveLength(0);
        } else {
          expect(result.isError).toBeFalsy();
          expect(result.structuredContent).toMatchObject({
            total_requested: count,
            total_found: Math.min(count, 100),
            missing_ids: [],
            unprocessed_ids: ids.slice(100),
          });
          expect(textOf(result)).toContain(`**Requested:** ${count}`);
          expect(textOf(result)).toContain('Unprocessed IDs');
        }
      },
    );

    it('does not truncate duplicate-heavy batches', async () => {
      serve([school()]);
      const result = await runToolContract(getSchoolTool, {
        id: Array.from({ length: 1000 }, (_, index) => (index % 2 ? '0236948' : 236948)),
      });
      expect(result.structuredContent).toMatchObject({
        total_requested: 1,
        total_found: 1,
        missing_ids: [],
        unprocessed_ids: [],
      });
      expect(requests[0]!.searchParams.get('id')).toBe('236948');
    });

    it('keeps missing processed and unchecked excess separate in error text', async () => {
      serve([]);
      const result = await runToolContract(getSchoolTool, {
        id: Array.from({ length: 101 }, (_, index) => index + 1),
      });
      expect(result.structuredContent).toMatchObject({
        error: { code: JsonRpcErrorCode.NotFound, data: { unprocessed_ids: [101] } },
      });
      expect(textOf(result)).toContain('100 processed IDs');
      expect(textOf(result)).toContain('Unprocessed IDs: 101');
      expect(textOf(result)).toContain('have not been checked');
    });

    it.each([
      {
        state: ' wa, ca ',
        zip: '98105-1234',
        distance: '5.5KM',
        sort: 'id:ASC',
        cip_code: ' 11.07 ',
        size_range: { min: 100, max: 10 },
      },
      { state: '', zip: '98105', distance: '', sort: 'id', cip_code: ' ' },
      { state: 'ZZ', zip: '98105', distance: '0mi', sort: 'id:desc', cip_code: '99.99' },
      { zip: '98105', distance: '.5' },
    ])('preserves supported selectors %j', async (input) => {
      serve([]);
      const result = await runToolContract(searchSchoolsTool, input);
      expect(result.isError).toBeFalsy();
      expect(requests).toHaveLength(1);
      const params = requests[0]!.searchParams;
      if (input.state?.includes(',')) expect(params.get('school.state')).toBe('WA,CA');
      if (input.size_range) expect(params.get('latest.student.size__range')).toBe('10..100');
      if (input.cip_code?.trim())
        expect(params.get('latest.programs.cip_4_digit.code')).toBe(
          input.cip_code.trim().replace('.', ''),
        );
      expect(textOf(result)).not.toContain('"state":""');
    });

    it.each([
      { zip: 'not-a-zip' },
      { distance: '-5mi', zip: '98105' },
      { distance: '5zz', zip: '98105' },
      { sort: 'id:sideways' },
      { sort: 'id:asc,school.name:desc' },
      { state: 'W' },
      { cip_code: '110701' },
    ])('rejects malformed meaningful selectors %j before fetch', async (input) => {
      serve([]);
      const result = await runToolContract(searchSchoolsTool, input);
      expect(result.isError).toBe(true);
      expect(result.structuredContent).toMatchObject({
        error: {
          code: JsonRpcErrorCode.ValidationError,
          data: { reason: 'api_validation', recovery: { hint: expect.any(String) } },
        },
      });
      expect(requests).toHaveLength(0);
    });

    it.each([getProgramsTool, searchProgramsTool])(
      'rejects malformed CIP locally for $name',
      async (tool) => {
        serve([school()]);
        const result = await runToolContract(tool, { id: 236948, cip_code: '11.0701' });
        expect(result.isError).toBe(true);
        expect(requests).toHaveLength(0);
      },
    );

    it.each([listFieldsTool, lookupCipTool])(
      'rejects required blank queries and reports catalog cap/total honestly for $name',
      async (tool) => {
        const invalid = await runToolContract(tool, { query: '   ', limit: 1 });
        expect(invalid.isError).toBe(true);
        const query = tool === listFieldsTool ? 'latest' : 'business';
        const short = await runToolContract(tool, { query, limit: 1 });
        const full = await runToolContract(tool, { query, limit: 1000 });
        const shortData = short.structuredContent as { totalMatches: number; truncated: boolean };
        const fullData = full.structuredContent as { totalMatches: number; cap: number };
        expect(shortData.totalMatches).toBe(fullData.totalMatches);
        expect(shortData.truncated).toBe(true);
        expect(textOf(short)).toMatch(/Narrow/);
        expect(fullData.cap).toBe(tool === listFieldsTool ? 100 : 50);
        const empty = await runToolContract(tool, { query: 'nonexistent-xyzzy', limit: 1 });
        expect(empty.isError).toBeFalsy();
        expect(empty.structuredContent).toMatchObject({
          results: [],
          totalMatches: 0,
          truncated: false,
        });
        expect(textOf(empty)).toContain('No ');
        const tooLarge = await runToolContract(tool, { query, limit: 1001 });
        expect(tooLarge.isError).toBe(true);
      },
    );

    it('omits ignored and blank selectors from program search echoes', async () => {
      serve([school([program()])]);
      const result = await runToolContract(searchProgramsTool, {
        cip_code: ' 11.07 ',
        program_name: 'ignored',
        state: 'wa',
      });
      expect(result.structuredContent).toMatchObject({
        query: { cip_code: '1107', state: 'WA', per_page: 20, page: 0 },
      });
      expect((result.structuredContent as { query: unknown }).query).not.toHaveProperty(
        'program_name',
      );
      expect(textOf(result)).not.toContain('ignored');
    });
    it('characterizes default identity and cost rendering', async () => {
      serve([{ ...school(), 'latest.cost.tuition.in_state': 1234 }]);
      const result = await runToolContract(getSchoolTool, { id: 236948 });
      expect(result.structuredContent).toMatchObject({
        schools: [{ id: 236948, tuition_in_state: 1234 }],
      });
      expect(textOf(result)).toContain('$1,234');
    });

    it('rejects blank lookup IDs before fetching', async () => {
      serve([school()]);
      const result = await runToolContract(getSchoolTool, { id: '' });
      expect(result.isError).toBe(true);
      expect(requests).toHaveLength(0);
    });

    it('preserves selected values and identifies absent paths without default metrics', async () => {
      serve([
        {
          ...school(),
          'custom.null': null,
          'custom.zero': 0,
          'custom.false': false,
          'custom.empty': '',
          'custom.tree': { rows: [{ values: [null, 0, false, ''] }] },
        },
      ]);
      const result = await runToolContract(getSchoolTool, {
        id: 236948,
        fields: 'custom.null,custom.zero,custom.false,custom.empty,custom.tree,custom.absent',
      });
      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toMatchObject({
        schools: [
          {
            id: 236948,
            name: 'Test University',
            selected_fields: {
              'custom.null': null,
              'custom.zero': 0,
              'custom.false': false,
              'custom.empty': '',
              'custom.tree': { rows: [{ values: [null, 0, false, ''] }] },
            },
            absent_fields: ['custom.absent'],
          },
        ],
      });
      expect(requests[0]!.searchParams.get('fields')).toContain('id,school.name');
      expect(textOf(result)).toContain('**custom.null:** null');
      expect(textOf(result)).toContain('**custom.zero:** 0');
      expect(textOf(result)).toContain('**custom.false:** false');
      expect(textOf(result)).toContain('**custom.empty:** ""');
      expect(textOf(result)).toContain('[null,0,false,""]');
      expect(textOf(result)).not.toContain('Not available');
    });

    it('preserves requested program leaves returned in the provider parent array', async () => {
      serve([
        school([
          { code: '1107', earnings: { highest: { '1_yr': { overall_median_earnings: 101710 } } } },
          { code: '1107', earnings: { highest: { '1_yr': { overall_median_earnings: null } } } },
          { code: '1108' },
        ]),
      ]);
      const codePath = 'latest.programs.cip_4_digit.code';
      const earningsPath =
        'latest.programs.cip_4_digit.earnings.highest.1_yr.overall_median_earnings';
      const absentPath = 'latest.programs.cip_4_digit.nonexistent';
      const result = await runToolContract(getSchoolTool, {
        id: 236948,
        fields: [codePath, earningsPath, absentPath].join(','),
      });
      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toMatchObject({
        schools: [
          {
            selected_fields: {
              'latest.programs.cip_4_digit': [
                {
                  code: '1107',
                  earnings: { highest: { '1_yr': { overall_median_earnings: 101710 } } },
                },
                {
                  code: '1107',
                  earnings: { highest: { '1_yr': { overall_median_earnings: null } } },
                },
                { code: '1108' },
              ],
            },
            absent_fields: [absentPath],
          },
        ],
      });
      const selected = (
        result.structuredContent as { schools: { selected_fields: Record<string, unknown> }[] }
      ).schools[0]!.selected_fields;
      expect(textOf(result)).toContain(
        `**latest.programs.cip_4_digit:** ${JSON.stringify(selected['latest.programs.cip_4_digit'])}`,
      );
      expect(Object.keys(selected)).toEqual(['latest.programs.cip_4_digit']);
    });

    it.each([1, 0, null, undefined])('maps the actual HBCU provider field (%s)', async (flag) => {
      serve([
        {
          ...school(),
          ...(flag === undefined ? {} : { 'school.minority_serving.historically_black': flag }),
        },
      ]);
      const result = await runToolContract(getSchoolTool, { id: 236948 });
      const row = (result.structuredContent as { schools: Record<string, unknown>[] }).schools[0]!;
      if (flag == null) expect(row).not.toHaveProperty('hbcu');
      else {
        expect(row.hbcu).toBe(flag === 1);
        expect(textOf(result)).toContain(`**HBCU:** ${flag === 1 ? 'Yes' : 'No'}`);
      }
      expect(requests[0]!.searchParams.get('fields')).toContain(
        'school.minority_serving.historically_black',
      );
    });
    it('preserves the captured Howard and Washington HBCU provider records', async () => {
      serve([
        {
          id: 131520,
          'school.name': 'Howard University',
          'school.minority_serving.historically_black': 1,
        },
        {
          id: 236948,
          'school.name': 'University of Washington-Seattle Campus',
          'school.minority_serving.historically_black': 0,
        },
      ]);
      const result = await runToolContract(getSchoolTool, { id: [131520, 236948] });
      expect(result.structuredContent).toMatchObject({
        schools: [
          { id: 131520, name: 'Howard University', hbcu: true },
          { id: 236948, name: 'University of Washington-Seattle Campus', hbcu: false },
        ],
      });
      expect(textOf(result)).toContain('**HBCU:** Yes');
      expect(textOf(result)).toContain('**HBCU:** No');
    });

    it('deduplicates normalized IDs before capping and separates unprocessed IDs', async () => {
      serve([school()]);
      const ids = [236948, ' 0236948 ', ...Array.from({ length: 100 }, (_, i) => 1000 + i)];
      const result = await runToolContract(getSchoolTool, { id: ids });
      expect(result.structuredContent).toMatchObject({
        total_requested: 101,
        total_found: 1,
        unprocessed_ids: [1099],
        missing_ids: Array.from({ length: 99 }, (_, i) => 1000 + i),
      });
      expect(requests[0]!.searchParams.get('id')!.split(',')).toHaveLength(100);
      expect(requests[0]!.searchParams.get('id')).not.toContain('1099');
      expect(textOf(result)).toContain('Unprocessed');
    });

    it.each([
      [listFieldsTool, 'school.name'],
      [lookupCipTool, '11.07'],
    ] as const)(
      'counts before slicing and preserves exact-limit guidance for $0.name',
      async (tool, query) => {
        const result = await runToolContract(tool, { query, limit: 1 });
        expect(result.structuredContent).toMatchObject({ totalMatches: 1, truncated: false });
      },
    );

    it('rejects invalid geographic relationships without fetching', async () => {
      serve([]);
      const result = await runToolContract(searchSchoolsTool, { distance: '5mi' });
      expect(result.isError).toBe(true);
      expect(requests).toHaveLength(0);
    });

    it('classifies permanent provider validation once with safe detail', async () => {
      vi.useFakeTimers();
      let calls = 0;
      api.route({
        match: endpoint,
        respond: () => {
          calls++;
          return Response.json({ errors: [{ message: 'Invalid ZIP' }] }, { status: 400 });
        },
      });
      const pending = runToolContract(searchSchoolsTool, {});
      await vi.runAllTimersAsync();
      const result = await pending;
      expect(result.structuredContent).toMatchObject({
        error: {
          code: JsonRpcErrorCode.InvalidParams,
          data: { reason: 'api_invalid_params', status: 400 },
        },
      });
      expect(textOf(result)).toContain('Invalid ZIP');
      expect(textOf(result)).not.toContain('SCORECARD_API_KEY');
      expect(calls).toBe(1);
    });

    it('echoes normalized filters and distinguishes exhausted school pages', async () => {
      serve([], { total: 2, page: 2, per_page: 1 });
      const result = await runToolContract(searchSchoolsTool, {
        state: 'wa',
        page: 2,
        per_page: 1,
      });
      expect(result.structuredContent).toMatchObject({
        query: { state: 'WA', page: 2, per_page: 1 },
        notice: expect.stringContaining('exhausted'),
      });
      expect(textOf(result)).toContain('WA');
      expect(textOf(result)).not.toContain('No schools matched');
    });
    it('echoes replayable normalized range bounds', async () => {
      serve([]);
      const result = await runToolContract(searchSchoolsTool, {
        size_range: { min: 100, max: 10 },
        acceptance_rate_range: { min: 0.9, max: 0.1 },
      });
      const query = (result.structuredContent as { query: Record<string, unknown> }).query;
      expect(query).toMatchObject({
        size_range: { min: 10, max: 100 },
        acceptance_rate_range: { min: 0.1, max: 0.9 },
      });
      expect(searchSchoolsTool.input.safeParse(query).success).toBe(true);
      const replay = await runToolContract(searchSchoolsTool, query);
      expect(replay.isError).toBeFalsy();
      expect(requests[1]!.searchParams.toString()).toBe(requests[0]!.searchParams.toString());
    });
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
        error: {
          code: -32007,
          message: 'No school IDs provided.',
          data: {
            reason: 'api_validation',
            recovery: {
              hint: 'Correct the reported selector or required ID before retrying the request.',
            },
          },
        },
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
        suppressed_count: 0,
        unavailable_count: 1,
        programs: [
          {
            code: '1107',
            credential_level: "Bachelor's",
            earnings_1yr_median: 70000,
            suppressed: false,
          },
          { earnings_1yr_median: 0, suppressed: false },
          { suppressed: false, earnings_availability: 'unavailable' },
        ],
      });
      expect(textOf(result)).toContain('$70,000');
      expect(textOf(result)).toContain('$0');
      expect(textOf(result)).toContain('Suppressed');
      const resource = await programsResource.handler(
        { id: '236948' },
        createMockContext({ errors: programsResource.errors }),
      );
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
        const resource = await programsResource.handler(
          { id: '236948' },
          createMockContext({ errors: programsResource.errors }),
        );
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
        const resource = await programsResource.handler(
          { id: '236948' },
          createMockContext({ errors: programsResource.errors }),
        );
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
          expect(text).toContain(total > 0 ? 'page is exhausted' : 'No schools matched');
      });
    }

    it.each([
      { mode: 'unavailable', rows: [program(null)], hint: 'unavailable with unknown cause' },
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
          code: status === 403 ? JsonRpcErrorCode.Forbidden : JsonRpcErrorCode.Unauthorized,
          data: {
            reason: status === 403 ? 'api_forbidden' : 'api_unauthorized',
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
          code: status === 429 ? JsonRpcErrorCode.RateLimited : JsonRpcErrorCode.ServiceUnavailable,
          data: { reason: status === 429 ? 'api_rate_limited' : 'api_error', retryAttempts: 4 },
        },
      });
      expect(calls).toBe(4);
      expect(textOf(result).toLowerCase()).toContain('retry');
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
            'school.minority_serving.historically_black': 1,
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
