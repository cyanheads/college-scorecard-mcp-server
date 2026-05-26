/**
 * @fileoverview Tests for the school resource.
 * @module tests/resources/school.resource.test
 */

import { McpError } from '@cyanheads/mcp-ts-core/errors';
import { createMockContext } from '@cyanheads/mcp-ts-core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { schoolResource } from '@/mcp-server/resources/definitions/school.resource.js';

const mockGetSchoolProfiles = vi.fn();
vi.mock('@/services/scorecard/scorecard-service.js', () => ({
  getScorecardService: () => ({ getSchoolProfiles: mockGetSchoolProfiles }),
}));

describe('schoolResource', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a school profile for a valid ID', async () => {
    mockGetSchoolProfiles.mockResolvedValue({
      metadata: { total: 1, page: 0, per_page: 1 },
      results: [
        {
          id: 236948,
          'school.name': 'University of Washington',
          'school.city': 'Seattle',
          'school.state': 'WA',
          'school.ownership': 1,
          'latest.cost.tuition.in_state': 11839,
          'latest.cost.tuition.out_of_state': 38614,
          'latest.cost.avg_net_price.overall': 15000,
          'latest.admissions.admission_rate.overall': 0.52,
          'latest.student.size': 47000,
          'latest.aid.median_debt.completers.overall': 17000,
          'latest.completion.rate_suppressed.overall': 0.82,
          'latest.earnings.6_yrs_after_entry.median': 50000,
          'latest.earnings.10_yrs_after_entry.median': 60000,
        },
      ],
    });
    const ctx = createMockContext({ tenantId: 'test-tenant' });
    const params = schoolResource.params.parse({ id: '236948' });
    const result = await schoolResource.handler(params, ctx);
    expect(result).toMatchObject({
      id: 236948,
      name: 'University of Washington',
      city: 'Seattle',
      tuition_in_state: 11839,
    });
  });

  it('throws when school not found', async () => {
    mockGetSchoolProfiles.mockResolvedValue({
      metadata: { total: 0, page: 0, per_page: 1 },
      results: [],
    });
    const ctx = createMockContext({ tenantId: 'test-tenant' });
    const params = schoolResource.params.parse({ id: '999999' });
    await expect(schoolResource.handler(params, ctx)).rejects.toThrow(McpError);
  });

  it('handles sparse upstream records without fabricating values', async () => {
    mockGetSchoolProfiles.mockResolvedValue({
      metadata: { total: 1, page: 0, per_page: 1 },
      results: [
        {
          id: 999,
          'school.name': 'Sparse College',
          'school.city': null,
          'school.state': null,
          'latest.cost.tuition.in_state': null,
          'latest.cost.avg_net_price.overall': null,
          'latest.admissions.admission_rate.overall': null,
          'latest.student.size': null,
          'latest.aid.median_debt.completers.overall': null,
          'latest.earnings.6_yrs_after_entry.median': null,
        },
      ],
    });
    const ctx = createMockContext({ tenantId: 'test-tenant' });
    const params = schoolResource.params.parse({ id: '999' });
    const result = await schoolResource.handler(params, ctx);
    expect(result).toMatchObject({ id: 999, name: 'Sparse College' });
    expect((result as Record<string, unknown>).tuition_in_state).toBeNull();
    expect((result as Record<string, unknown>).admission_rate).toBeNull();
  });
});
