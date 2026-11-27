/**
 * @fileoverview Tests for the programs resource.
 * @module tests/resources/programs.resource.test
 */

import { z } from '@cyanheads/mcp-ts-core';
import { McpError } from '@cyanheads/mcp-ts-core/errors';
import { createMockContext } from '@cyanheads/mcp-ts-core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { programsResource } from '@/mcp-server/resources/definitions/programs.resource.js';
import { programsPageResource } from '@/mcp-server/resources/definitions/programs-page.resource.js';

const mockGetSchoolPrograms = vi.fn();
vi.mock('@/services/scorecard/scorecard-service.js', () => ({
  getScorecardService: () => ({ getSchoolPrograms: mockGetSchoolPrograms }),
}));

const makeProgram = (overrides: Record<string, unknown> = {}) => ({
  code: '11.07',
  title: 'Computer Science',
  credential: { level: 3, title: "Bachelor's Degree" },
  earnings: { highest: { '1_yr': { overall_median_earnings: 72000 } } },
  debt: { staff_grad_plus: { all: { all_inst: { median: 18000 } } } },
  counts: { ipeds_awards1: 400, ipeds_awards2: 410 },
  ...overrides,
});

describe('programsResource', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns programs for a valid school ID', async () => {
    mockGetSchoolPrograms.mockResolvedValue({
      metadata: { total: 1, page: 0, per_page: 1 },
      results: [
        {
          id: 236948,
          'school.name': 'University of Washington',
          'latest.programs.cip_4_digit': [makeProgram()],
        },
      ],
    });
    const ctx = createMockContext({ tenantId: 'test-tenant', errors: programsResource.errors });
    const params = programsResource.params!.parse({ id: '236948' });
    const result = (await programsResource.handler(params, ctx)) as Record<string, unknown>;
    expect(result.school_id).toBe(236948);
    expect(result.school_name).toBe('University of Washington');
    expect((result.programs as unknown[]).length).toBe(1);
    expect(result.total).toBe(1);
  });

  it('returns null earnings for suppressed programs', async () => {
    mockGetSchoolPrograms.mockResolvedValue({
      metadata: { total: 1, page: 0, per_page: 1 },
      results: [
        {
          id: 236948,
          'school.name': 'University of Washington',
          'latest.programs.cip_4_digit': [makeProgram({ earnings: null })],
        },
      ],
    });
    const ctx = createMockContext({ tenantId: 'test-tenant', errors: programsResource.errors });
    const params = programsResource.params!.parse({ id: '236948' });
    const result = (await programsResource.handler(params, ctx)) as Record<string, unknown>;
    const programs = result.programs as Array<Record<string, unknown>>;
    expect(programs[0]!.earnings_1yr_median).toBeNull();
  });

  it('returns separate debt and benchmark values on the first and continuation pages', async () => {
    const program = makeProgram({
      credential: { level: 5 },
      debt: {
        staff_grad_plus: { all: { all_inst: { median: null }, eval_inst: { median: 41000 } } },
      },
      earnings: {
        '4_yr': { overall_median_earnings: 120000, overall_median_earnings_national: 107009 },
      },
    });
    mockGetSchoolPrograms.mockResolvedValue({
      metadata: { total: 1, page: 0, per_page: 1 },
      results: [
        {
          id: 236948,
          'school.name': 'University of Washington',
          'latest.programs.cip_4_digit': [
            program,
            ...Array.from({ length: 19 }, () => makeProgram()),
            program,
          ],
        },
      ],
    });
    const first = await programsResource.handler(
      programsResource.params!.parse({ id: '236948' }),
      createMockContext({ errors: programsResource.errors }),
    );
    const next = await programsPageResource.handler(
      programsPageResource.params!.parse({ id: '236948', offset: '20', limit: '20' }),
      createMockContext({ errors: programsPageResource.errors }),
    );
    expect(first).toMatchObject({ nextUri: 'scorecard://programs/236948/page/20/20' });
    expect(next).toMatchObject({
      nextUri: null,
      metric_scope: { national_earnings: 'national' },
      provenance: { debt_at_institution: { cell: 'K18' } },
      programs: [
        {
          credential_level: 5,
          median_debt: null,
          median_debt_at_institution: 41000,
          completion_4yr_median: 120000,
          completion_4yr_national: {
            median: 107009,
            availability: {
              median: 'available',
              p25: 'unavailable',
              p75: 'unavailable',
              count: 'unavailable',
            },
          },
        },
      ],
    });
    const page = z.object({ programs: z.array(z.unknown()) });
    expect(page.parse(first).programs[0]).toEqual(page.parse(next).programs[0]);
  });

  it('returns empty programs array when school has no programs', async () => {
    mockGetSchoolPrograms.mockResolvedValue({
      metadata: { total: 1, page: 0, per_page: 1 },
      results: [
        {
          id: 236948,
          'school.name': 'University of Washington',
          'latest.programs.cip_4_digit': [],
        },
      ],
    });
    const ctx = createMockContext({ tenantId: 'test-tenant', errors: programsResource.errors });
    const params = programsResource.params!.parse({ id: '236948' });
    const result = (await programsResource.handler(params, ctx)) as Record<string, unknown>;
    expect((result.programs as unknown[]).length).toBe(0);
    expect(result.total).toBe(0);
  });

  it('throws when school not found', async () => {
    mockGetSchoolPrograms.mockResolvedValue({
      metadata: { total: 0, page: 0, per_page: 1 },
      results: [],
    });
    const ctx = createMockContext({ tenantId: 'test-tenant', errors: programsResource.errors });
    const params = programsResource.params!.parse({ id: '999999' });
    await expect(programsResource.handler(params, ctx)).rejects.toThrow(McpError);
  });

  it('advertises representative entries through list()', async () => {
    expect(programsResource.list).toBeDefined();
    const result = await programsResource.list!({} as never);
    expect(result.resources.length).toBeGreaterThan(0);
    for (const entry of result.resources) {
      expect(String(entry.uri)).toMatch(/^scorecard:\/\/programs\/\d+$/);
      expect(entry.name).toBeTruthy();
      expect(entry.mimeType).toBe('application/json');
    }
  });

  it('resolves every advertised list entry through the handler', async () => {
    expect(programsResource.list).toBeDefined();
    const { resources } = await programsResource.list!({} as never);
    expect(resources.length).toBeGreaterThan(0);
    mockGetSchoolPrograms.mockResolvedValue({
      metadata: { total: 1, page: 0, per_page: 1 },
      results: [
        {
          id: Number(String(resources[0]!.uri).split('/').pop()),
          'school.name': 'Advertised School',
          'latest.programs.cip_4_digit': [makeProgram()],
        },
      ],
    });
    const ctx = createMockContext({ tenantId: 'test-tenant', errors: programsResource.errors });
    const params = programsResource.params!.parse({
      id: String(resources[0]!.uri).split('/').pop(),
    });
    await expect(programsResource.handler(params, ctx)).resolves.toMatchObject({
      school_name: 'Advertised School',
    });
  });
});
