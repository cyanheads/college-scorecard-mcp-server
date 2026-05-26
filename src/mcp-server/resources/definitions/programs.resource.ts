/**
 * @fileoverview Programs resource. Provides program-level outcomes for a school
 * as injectable context.
 * @module mcp-server/resources/definitions/programs.resource
 */

import { resource, z } from '@cyanheads/mcp-ts-core';
import { notFound } from '@cyanheads/mcp-ts-core/errors';
import { getScorecardService } from '@/services/scorecard/scorecard-service.js';

export const programsResource = resource('scorecard://programs/{id}', {
  name: 'scorecard-programs',
  title: 'School Programs',
  description:
    'Program-level outcomes for a school — 1-year post-graduation earnings, debt, and enrollment by CIP code. Injectable context for program-focused conversations.',
  mimeType: 'application/json',
  params: z.object({
    id: z.string().describe('School unit ID (integer as string).'),
  }),

  async handler(params, ctx) {
    ctx.log.info('Fetching programs resource', { id: params.id });
    const service = getScorecardService();

    const response = await service.getSchoolPrograms(
      params.id,
      undefined,
      undefined,
      undefined,
      ctx,
    );

    const record = response.results[0];
    if (!record) {
      throw notFound(`School ${params.id} not found.`, { id: params.id });
    }

    const rawPrograms = record['latest.programs.cip_4_digit'] ?? [];

    const programs = rawPrograms.map((p) => ({
      code: p.code,
      title: p.title,
      credential_level: p.credential?.level ?? null,
      earnings_1yr_median: p.earnings?.highest?.['1_yr']?.overall_median_earnings ?? null,
      median_debt: p.debt?.median_debt ?? null,
      enrollment: p.counts?.ipeds_enrollment ?? null,
    }));

    return {
      school_id: record.id,
      school_name: record['school.name'],
      programs,
      total: programs.length,
    };
  },
});
