/**
 * @fileoverview Tests for ScorecardService request building and upstream-failure classification.
 * @module tests/services/scorecard-service.test
 */

import { JsonRpcErrorCode } from '@cyanheads/mcp-ts-core/errors';
import { createMockContext } from '@cyanheads/mcp-ts-core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getProgramsTool } from '@/mcp-server/tools/definitions/get-programs.tool.js';
import { getSchoolTool } from '@/mcp-server/tools/definitions/get-school.tool.js';
import { ScorecardService } from '@/services/scorecard/scorecard-service.js';

const apiErrorRecovery = getSchoolTool.errors?.find((e) => e.reason === 'api_error')?.recovery;

describe('ScorecardService', () => {
  it('sends CIP and credential filters before provider school pagination', async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request) =>
      Response.json({ metadata: { total: 0, page: 2, per_page: 5 }, results: [] }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await new ScorecardService({} as never, {} as never).searchPrograms(
      { cipCode: '11.07', credentialLevel: 3, page: 2, perPage: 5 },
      createMockContext(),
    );
    const params = new URL(String(fetchMock.mock.calls[0]![0])).searchParams;
    expect(params.get('latest.programs.cip_4_digit.code')).toBe('1107');
    expect(params.get('latest.programs.cip_4_digit.credential.level')).toBe('3');
    expect(params.get('page')).toBe('2');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  beforeEach(() => {
    vi.stubEnv('SCORECARD_API_KEY', 'test-key');
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('tags an upstream failure with the api_error reason and its declared recovery', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('unavailable', { status: 503 })),
    );
    const ctx = createMockContext({ errors: getSchoolTool.errors });
    const service = new ScorecardService({} as never, {} as never);

    const assertion = expect(
      service.getSchoolProfiles([236948], undefined, ctx),
    ).rejects.toMatchObject({
      code: JsonRpcErrorCode.ServiceUnavailable,
      data: { reason: 'api_error', recovery: { hint: apiErrorRecovery } },
    });
    await vi.runAllTimersAsync();
    await assertion;
  });

  it('keeps the upstream error code alongside the reason for an API-level error body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ errors: [{ error: 'field_not_found', message: 'bad' }] }), {
            status: 200,
          }),
      ),
    );
    const ctx = createMockContext({ errors: getSchoolTool.errors });
    const service = new ScorecardService({} as never, {} as never);

    const assertion = expect(
      service.getSchoolProfiles([236948], undefined, ctx),
    ).rejects.toMatchObject({
      code: JsonRpcErrorCode.ServiceUnavailable,
      data: { reason: 'api_error', code: 'field_not_found' },
    });
    await vi.runAllTimersAsync();
    await assertion;
  });

  describe('getSchoolPrograms', () => {
    const fetchPrograms = async (cipCode: string | undefined) => {
      const fetchMock = vi.fn(async (_url: string | URL | Request) =>
        Response.json({
          metadata: { total: 1, page: 0, per_page: 1 },
          results: [{ id: 236948, 'school.name': 'Test', 'latest.programs.cip_4_digit': [] }],
        }),
      );
      vi.stubGlobal('fetch', fetchMock);
      const service = new ScorecardService({} as never, {} as never);
      await service.getSchoolPrograms(
        236948,
        cipCode,
        undefined,
        undefined,
        createMockContext({ errors: getProgramsTool.errors }),
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
      return new URL(String(fetchMock.mock.calls[0]![0])).searchParams;
    };

    it('requests one school by ID with the program fields', async () => {
      const params = await fetchPrograms(undefined);
      expect(params.get('id')).toBe('236948');
      expect(params.get('fields')).toBe('id,school.name,latest.programs.cip_4_digit');
      expect(params.get('per_page')).toBe('1');
    });

    it('leaves CIP filtering to the caller instead of sending it upstream', async () => {
      const params = await fetchPrograms('11.07');
      expect(params.has('latest.programs.cip_4_digit.code')).toBe(false);
    });
  });
});
