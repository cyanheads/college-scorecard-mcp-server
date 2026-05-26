/**
 * @fileoverview Tests for the programs resource.
 * @module tests/resources/programs.resource.test
 */

import { McpError } from '@cyanheads/mcp-ts-core/errors';
import { createMockContext } from '@cyanheads/mcp-ts-core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { programsResource } from '@/mcp-server/resources/definitions/programs.resource.js';

const mockGetSchoolPrograms = vi.fn();
vi.mock('@/services/scorecard/scorecard-service.js', () => ({
  getScorecardService: () => ({ getSchoolPrograms: mockGetSchoolPrograms }),
}));

const makeProgram = (overrides: Record<string, unknown> = {}) => ({
  code: '11.07',
  title: 'Computer Science',
  credential_level: 3,
  earnings: { highest: { '1_yr': { overall_median_earnings: 72000 } } },
  debt: { median_debt: 18000 },
  counts: { ipeds_enrollment: 400 },
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
    const ctx = createMockContext({ tenantId: 'test-tenant' });
    const params = programsResource.params.parse({ id: '236948' });
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
    const ctx = createMockContext({ tenantId: 'test-tenant' });
    const params = programsResource.params.parse({ id: '236948' });
    const result = (await programsResource.handler(params, ctx)) as Record<string, unknown>;
    const programs = result.programs as Array<Record<string, unknown>>;
    expect(programs[0].earnings_1yr_median).toBeNull();
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
    const ctx = createMockContext({ tenantId: 'test-tenant' });
    const params = programsResource.params.parse({ id: '236948' });
    const result = (await programsResource.handler(params, ctx)) as Record<string, unknown>;
    expect((result.programs as unknown[]).length).toBe(0);
    expect(result.total).toBe(0);
  });

  it('throws when school not found', async () => {
    mockGetSchoolPrograms.mockResolvedValue({
      metadata: { total: 0, page: 0, per_page: 1 },
      results: [],
    });
    const ctx = createMockContext({ tenantId: 'test-tenant' });
    const params = programsResource.params.parse({ id: '999999' });
    await expect(programsResource.handler(params, ctx)).rejects.toThrow(McpError);
  });
});
