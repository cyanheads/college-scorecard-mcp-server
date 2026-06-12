/**
 * @fileoverview Tests for the searchSchools tool.
 * @module tests/tools/search-schools.tool.test
 */

import { createMockContext, getEnrichment } from '@cyanheads/mcp-ts-core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { searchSchoolsTool } from '@/mcp-server/tools/definitions/search-schools.tool.js';

const mockSearchSchools = vi.fn();
vi.mock('@/services/scorecard/scorecard-service.js', () => ({
  getScorecardService: () => ({ searchSchools: mockSearchSchools }),
}));

const makeResponse = (overrides: Record<string, unknown>[] = [{}]) => ({
  metadata: { total: overrides.length, page: 0, per_page: 20 },
  results: overrides.map((o) => ({
    id: 236948,
    'school.name': 'University of Washington',
    'school.city': 'Seattle',
    'school.state': 'WA',
    'school.ownership': 1,
    'school.degrees_awarded.predominant': 3,
    'latest.student.size': 47000,
    'latest.admissions.admission_rate.overall': 0.52,
    'latest.cost.tuition.in_state': 11839,
    'latest.cost.tuition.out_of_state': 38614,
    'latest.cost.avg_net_price.overall': 15000,
    'latest.aid.median_debt.completers.overall': 17000,
    'latest.earnings.6_yrs_after_entry.median': 50000,
    ...o,
  })),
});

describe('searchSchoolsTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a list of schools for a basic query', async () => {
    mockSearchSchools.mockResolvedValue(makeResponse());
    const ctx = createMockContext({ errors: searchSchoolsTool.errors });
    const input = searchSchoolsTool.input.parse({ query: 'University of Washington' });
    const result = await searchSchoolsTool.handler(input, ctx);
    expect(result.schools.length).toBe(1);
    expect(result.schools[0].name).toBe('University of Washington');
    expect(result.schools[0].ownership).toBe('Public');
    expect(result.schools[0].degree_level).toBe("Bachelor's");
    expect(result.total).toBe(1);
  });

  it('applies optional filters (state, ownership, degree_level)', async () => {
    mockSearchSchools.mockResolvedValue(makeResponse());
    const ctx = createMockContext({ errors: searchSchoolsTool.errors });
    const input = searchSchoolsTool.input.parse({
      state: 'WA',
      ownership: 1,
      degree_level: 3,
      per_page: 10,
      page: 0,
    });
    const result = await searchSchoolsTool.handler(input, ctx);
    expect(mockSearchSchools).toHaveBeenCalledOnce();
    expect(result.schools.length).toBeGreaterThanOrEqual(0);
  });

  it('uses default values for per_page and page', async () => {
    mockSearchSchools.mockResolvedValue(makeResponse());
    const ctx = createMockContext({ errors: searchSchoolsTool.errors });
    const input = searchSchoolsTool.input.parse({});
    expect(input.per_page).toBe(20);
    expect(input.page).toBe(0);
    await searchSchoolsTool.handler(input, ctx);
    expect(mockSearchSchools).toHaveBeenCalledOnce();
  });

  it('handles sparse upstream records with missing optional fields', async () => {
    mockSearchSchools.mockResolvedValue(
      makeResponse([
        {
          id: 999,
          'school.name': 'Sparse College',
          'school.city': undefined,
          'school.state': undefined,
          'school.ownership': 1,
          'school.degrees_awarded.predominant': 3,
          'latest.student.size': null,
          'latest.admissions.admission_rate.overall': null,
          'latest.cost.tuition.in_state': null,
          'latest.cost.tuition.out_of_state': null,
          'latest.cost.avg_net_price.overall': null,
          'latest.aid.median_debt.completers.overall': null,
          'latest.earnings.6_yrs_after_entry.median': null,
        },
      ]),
    );
    const ctx = createMockContext({ errors: searchSchoolsTool.errors });
    const input = searchSchoolsTool.input.parse({ query: 'Sparse College' });
    const result = await searchSchoolsTool.handler(input, ctx);
    expect(result.schools[0].enrollment).toBeUndefined();
    expect(result.schools[0].admission_rate).toBeUndefined();
    expect(result.schools[0].tuition_in_state).toBeUndefined();
  });

  it('enriches a notice when no schools are returned', async () => {
    mockSearchSchools.mockResolvedValue(makeResponse([]));
    const ctx = createMockContext({ errors: searchSchoolsTool.errors });
    const input = searchSchoolsTool.input.parse({ query: 'ZZZ nonexistent' });
    const result = await searchSchoolsTool.handler(input, ctx);
    expect(result.schools.length).toBe(0);
    expect(getEnrichment(ctx).notice).toBeDefined();
  });

  it('enriches total and truncation when a page fills to per_page', async () => {
    const response = makeResponse(Array.from({ length: 3 }, () => ({})));
    response.metadata.total = 42;
    mockSearchSchools.mockResolvedValue(response);
    const ctx = createMockContext({ errors: searchSchoolsTool.errors });
    const input = searchSchoolsTool.input.parse({ query: 'University', per_page: 3 });
    await searchSchoolsTool.handler(input, ctx);
    const enrichment = getEnrichment(ctx);
    expect(enrichment.totalCount).toBe(42);
    expect(enrichment.truncated).toBe(true);
    expect(enrichment.shown).toBe(3);
    expect(enrichment.cap).toBe(3);
  });

  it('throws api_error when the service rejects', async () => {
    mockSearchSchools.mockRejectedValue(Object.assign(new Error('API error'), { code: -32603 }));
    const ctx = createMockContext({ errors: searchSchoolsTool.errors });
    const input = searchSchoolsTool.input.parse({});
    await expect(searchSchoolsTool.handler(input, ctx)).rejects.toThrow();
  });

  it('formats output with school names and IDs', () => {
    const output = {
      total: 1,
      page: 0,
      per_page: 20,
      schools: [
        {
          id: 236948,
          name: 'University of Washington',
          city: 'Seattle',
          state: 'WA',
          ownership: 'Public',
          degree_level: "Bachelor's",
          enrollment: 47000,
          admission_rate: 0.52,
          tuition_in_state: 11839,
          tuition_out_of_state: 38614,
          net_price_overall: 15000,
          median_debt: 17000,
          earnings_6yr_median: 50000,
        },
      ],
    };
    const blocks = searchSchoolsTool.format!(output);
    expect(blocks[0].type).toBe('text');
    const text = (blocks[0] as { text: string }).text;
    expect(text).toContain('University of Washington');
    expect(text).toContain('236948');
    expect(text).toContain('Public');
    expect(text).toContain('47');
  });
});
