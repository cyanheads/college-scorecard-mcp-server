/**
 * @fileoverview Tests for the getPrograms tool.
 * @module tests/tools/get-programs.tool.test
 */

import { JsonRpcErrorCode } from '@cyanheads/mcp-ts-core/errors';
import { createMockContext } from '@cyanheads/mcp-ts-core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getProgramsTool } from '@/mcp-server/tools/definitions/get-programs.tool.js';

const mockGetSchoolPrograms = vi.fn();
vi.mock('@/services/scorecard/scorecard-service.js', () => ({
  getScorecardService: () => ({ getSchoolPrograms: mockGetSchoolPrograms }),
}));

const makeCsProgram = (overrides: Record<string, unknown> = {}) => ({
  code: '11.07',
  title: 'Computer Science',
  credential_level: 3,
  earnings: { highest: { '1_yr': { overall_median_earnings: 72000, overall_count_titleiv: 150 } } },
  debt: { median_debt: 18000 },
  counts: { ipeds_enrollment: 400 },
  ...overrides,
});

const makeProgramsResult = (programs = [makeCsProgram()]) => ({
  metadata: { total: 1, page: 0, per_page: 1 },
  results: [
    {
      id: 236948,
      'school.name': 'University of Washington',
      'latest.programs.cip_4_digit': programs,
    },
  ],
});

describe('getProgramsTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns programs for a valid school ID', async () => {
    mockGetSchoolPrograms.mockResolvedValue(makeProgramsResult());
    const ctx = createMockContext({ errors: getProgramsTool.errors });
    const input = getProgramsTool.input.parse({ id: 236948 });
    const result = await getProgramsTool.handler(input, ctx);
    expect(result.school_id).toBe(236948);
    expect(result.school_name).toBe('University of Washington');
    expect(result.programs.length).toBe(1);
    expect(result.programs[0].code).toBe('11.07');
    expect(result.programs[0].earnings_1yr_median).toBe(72000);
    expect(result.programs[0].suppressed).toBe(false);
  });

  it('marks program as suppressed when earnings are missing', async () => {
    mockGetSchoolPrograms.mockResolvedValue(
      makeProgramsResult([makeCsProgram({ earnings: null })]),
    );
    const ctx = createMockContext({ errors: getProgramsTool.errors });
    const input = getProgramsTool.input.parse({ id: 236948 });
    const result = await getProgramsTool.handler(input, ctx);
    expect(result.programs[0].suppressed).toBe(true);
    expect(result.programs[0].suppression_note).toBeDefined();
    expect(result.suppressed_count).toBe(1);
  });

  it('throws school_not_found when no records returned', async () => {
    mockGetSchoolPrograms.mockResolvedValue({
      metadata: { total: 0, page: 0, per_page: 1 },
      results: [],
    });
    const ctx = createMockContext({ errors: getProgramsTool.errors });
    const input = getProgramsTool.input.parse({ id: 999999 });
    await expect(getProgramsTool.handler(input, ctx)).rejects.toMatchObject({
      code: JsonRpcErrorCode.NotFound,
      data: { reason: 'school_not_found' },
    });
  });

  it('throws no_programs when min_earnings filter yields no results', async () => {
    mockGetSchoolPrograms.mockResolvedValue(makeProgramsResult());
    const ctx = createMockContext({ errors: getProgramsTool.errors });
    const input = getProgramsTool.input.parse({ id: 236948, min_earnings: 999999 });
    await expect(getProgramsTool.handler(input, ctx)).rejects.toMatchObject({
      code: JsonRpcErrorCode.NotFound,
      data: { reason: 'no_programs' },
    });
  });

  it('filters by cip_code', async () => {
    mockGetSchoolPrograms.mockResolvedValue(
      makeProgramsResult([makeCsProgram(), makeCsProgram({ code: '52.01', title: 'Business' })]),
    );
    const ctx = createMockContext({ errors: getProgramsTool.errors });
    const input = getProgramsTool.input.parse({ id: 236948, cip_code: '11.07' });
    const result = await getProgramsTool.handler(input, ctx);
    expect(result.programs.every((p) => p.code === '11.07')).toBe(true);
  });

  it('handles sparse upstream records with omitted earnings fields', async () => {
    mockGetSchoolPrograms.mockResolvedValue(
      makeProgramsResult([{ code: '11.07', title: 'Computer Science', credential_level: 3 }]),
    );
    const ctx = createMockContext({ errors: getProgramsTool.errors });
    const input = getProgramsTool.input.parse({ id: 236948 });
    const result = await getProgramsTool.handler(input, ctx);
    expect(result.programs[0].earnings_1yr_median).toBeUndefined();
    expect(result.programs[0].median_debt).toBeUndefined();
    expect(result.programs[0].suppressed).toBe(true);
  });

  it('formats output with earnings, debt, and suppression note', () => {
    const output = {
      school_id: 236948,
      school_name: 'University of Washington',
      programs: [
        {
          code: '11.07',
          title: 'Computer Science',
          credential_level: "Bachelor's",
          earnings_1yr_median: 72000,
          median_debt: 18000,
          enrollment: 400,
          suppressed: false,
        },
        {
          code: '51.38',
          title: 'Nursing',
          credential_level: "Bachelor's",
          suppressed: true,
          suppression_note:
            'Earnings data suppressed — cohort too small to report under FERPA privacy rules.',
        },
      ],
      total: 2,
      suppressed_count: 1,
    };
    const blocks = getProgramsTool.format!(output);
    expect(blocks[0].type).toBe('text');
    const text = (blocks[0] as { text: string }).text;
    expect(text).toContain('11.07');
    expect(text).toContain('72,000');
    expect(text).toContain('18,000');
    expect(text).toContain('Suppression note');
    expect(text).toContain('FERPA');
  });
});
