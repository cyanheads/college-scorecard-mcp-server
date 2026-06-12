/**
 * @fileoverview Tests for the searchPrograms tool.
 * @module tests/tools/search-programs.tool.test
 */

import { createMockContext, getEnrichment } from '@cyanheads/mcp-ts-core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { searchProgramsTool } from '@/mcp-server/tools/definitions/search-programs.tool.js';

const mockSearchPrograms = vi.fn();
vi.mock('@/services/scorecard/scorecard-service.js', () => ({
  getScorecardService: () => ({ searchPrograms: mockSearchPrograms }),
}));

const makeProgramRecord = (overrides: Record<string, unknown> = {}) => ({
  id: 236948,
  'school.name': 'University of Washington',
  'school.state': 'WA',
  'school.ownership': 1,
  'latest.cost.avg_net_price.overall': 15000,
  'latest.programs.cip_4_digit': [
    {
      code: '11.07',
      title: 'Computer Science',
      credential_level: 3,
      earnings: { highest: { '1_yr': { overall_median_earnings: 72000 } } },
      debt: { median_debt: 18000 },
      counts: { ipeds_enrollment: 400 },
    },
  ],
  ...overrides,
});

const makeResponse = (records = [makeProgramRecord()]) => ({
  metadata: { total: records.length, page: 0, per_page: 20 },
  results: records,
});

describe('searchProgramsTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns programs for a cip_code search', async () => {
    mockSearchPrograms.mockResolvedValue(makeResponse());
    const ctx = createMockContext({ errors: searchProgramsTool.errors });
    const input = searchProgramsTool.input.parse({ cip_code: '11.07' });
    const result = await searchProgramsTool.handler(input, ctx);
    expect(result.programs.length).toBe(1);
    expect(result.programs[0].school_id).toBe(236948);
    expect(result.programs[0].program_code).toBe('11.07');
    expect(result.programs[0].earnings_1yr_median).toBe(72000);
    expect(result.programs[0].suppressed).toBe(false);
  });

  it('marks programs as suppressed when earnings are null', async () => {
    mockSearchPrograms.mockResolvedValue(
      makeResponse([
        makeProgramRecord({
          'latest.programs.cip_4_digit': [
            {
              code: '51.38',
              title: 'Nursing',
              credential_level: 3,
              earnings: null,
            },
          ],
        }),
      ]),
    );
    const ctx = createMockContext({ errors: searchProgramsTool.errors });
    const input = searchProgramsTool.input.parse({ cip_code: '51.38' });
    const result = await searchProgramsTool.handler(input, ctx);
    expect(result.programs[0].suppressed).toBe(true);
    expect(result.suppressed_count).toBe(1);
  });

  it('enriches a notice when no programs match', async () => {
    mockSearchPrograms.mockResolvedValue(makeResponse([]));
    const ctx = createMockContext({ errors: searchProgramsTool.errors });
    const input = searchProgramsTool.input.parse({ cip_code: '99.99' });
    const result = await searchProgramsTool.handler(input, ctx);
    expect(getEnrichment(ctx).notice).toBeDefined();
    expect(result.programs.length).toBe(0);
  });

  it('sorts by earnings descending, suppressed last', async () => {
    mockSearchPrograms.mockResolvedValue(
      makeResponse([
        makeProgramRecord({
          'latest.programs.cip_4_digit': [
            {
              code: '52.01',
              title: 'Business',
              credential_level: 3,
              earnings: { highest: { '1_yr': { overall_median_earnings: 40000 } } },
            },
            {
              code: '11.07',
              title: 'Computer Science',
              credential_level: 3,
              earnings: { highest: { '1_yr': { overall_median_earnings: 72000 } } },
            },
          ],
        }),
      ]),
    );
    const ctx = createMockContext({ errors: searchProgramsTool.errors });
    const input = searchProgramsTool.input.parse({});
    const result = await searchProgramsTool.handler(input, ctx);
    expect(result.programs[0].earnings_1yr_median).toBeGreaterThan(
      result.programs[1].earnings_1yr_median!,
    );
  });

  it('uses default values for page and per_page', async () => {
    mockSearchPrograms.mockResolvedValue(makeResponse());
    const input = searchProgramsTool.input.parse({});
    expect(input.per_page).toBe(20);
    expect(input.page).toBe(0);
  });

  it('handles sparse upstream records with omitted program fields', async () => {
    mockSearchPrograms.mockResolvedValue(
      makeResponse([
        makeProgramRecord({
          'latest.programs.cip_4_digit': [{ code: '11.07', title: null }],
          'latest.cost.avg_net_price.overall': null,
        }),
      ]),
    );
    const ctx = createMockContext({ errors: searchProgramsTool.errors });
    const input = searchProgramsTool.input.parse({ cip_code: '11.07' });
    const result = await searchProgramsTool.handler(input, ctx);
    expect(result.programs[0].earnings_1yr_median).toBeUndefined();
    expect(result.programs[0].net_price_overall).toBeUndefined();
    expect(result.programs[0].suppressed).toBe(true);
  });

  it('formats output with school info and earnings', () => {
    const output = {
      total: 1,
      page: 0,
      per_page: 20,
      programs: [
        {
          school_id: 236948,
          school_name: 'University of Washington',
          school_state: 'WA',
          school_ownership: 'Public',
          net_price_overall: 15000,
          program_code: '11.07',
          program_title: 'Computer Science',
          earnings_1yr_median: 72000,
          median_debt: 18000,
          enrollment: 400,
          suppressed: false,
        },
      ],
      total_programs: 1,
      suppressed_count: 0,
    };
    const blocks = searchProgramsTool.format!(output);
    expect(blocks[0].type).toBe('text');
    const text = (blocks[0] as { text: string }).text;
    expect(text).toContain('11.07');
    expect(text).toContain('Computer Science');
    expect(text).toContain('University of Washington');
    expect(text).toContain('72,000');
  });
});
