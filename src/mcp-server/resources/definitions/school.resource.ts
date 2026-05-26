/**
 * @fileoverview School profile resource. Provides institutional profile by unit ID
 * as injectable context for school-specific conversations.
 * @module mcp-server/resources/definitions/school.resource
 */

import { resource, z } from '@cyanheads/mcp-ts-core';
import { notFound } from '@cyanheads/mcp-ts-core/errors';
import { getScorecardService } from '@/services/scorecard/scorecard-service.js';

export const schoolResource = resource('scorecard://school/{id}', {
  name: 'scorecard-school',
  title: 'School Profile',
  description:
    'Institutional profile by unit ID — injectable context for school-specific conversations. Returns core identity, cost, admissions, and outcomes data.',
  mimeType: 'application/json',
  params: z.object({
    id: z.string().describe('School unit ID (integer as string).'),
  }),

  async handler(params, ctx) {
    ctx.log.info('Fetching school resource', { id: params.id });
    const service = getScorecardService();

    const response = await service.getSchoolProfiles([params.id], undefined, ctx);

    const record = response.results[0];
    if (!record) {
      throw notFound(`School ${params.id} not found.`, { id: params.id });
    }

    return {
      id: record.id,
      name: record['school.name'],
      city: record['school.city'],
      state: record['school.state'],
      ownership: record['school.ownership'],
      tuition_in_state: record['latest.cost.tuition.in_state'],
      tuition_out_of_state: record['latest.cost.tuition.out_of_state'],
      net_price_overall: record['latest.cost.avg_net_price.overall'],
      admission_rate: record['latest.admissions.admission_rate.overall'],
      enrollment: record['latest.student.size'],
      median_debt: record['latest.aid.median_debt.completers.overall'],
      completion_rate: record['latest.completion.rate_suppressed.overall'],
      earnings_6yr_median: record['latest.earnings.6_yrs_after_entry.median'],
      earnings_10yr_median: record['latest.earnings.10_yrs_after_entry.median'],
    };
  },
});
