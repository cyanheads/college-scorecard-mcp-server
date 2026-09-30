/**
 * @fileoverview Programs resource. Provides program-level outcomes for a school
 * as injectable context.
 * @module mcp-server/resources/definitions/programs.resource
 */

import { resource, z } from '@cyanheads/mcp-ts-core';
import { notFound } from '@cyanheads/mcp-ts-core/errors';
import { EXAMPLE_SCHOOLS } from '@/mcp-server/resources/definitions/example-schools.js';
import { getScorecardService } from '@/services/scorecard/scorecard-service.js';

export const programsResource = resource('scorecard://programs/{id}', {
  name: 'scorecard-programs',
  title: 'School Programs',
  description:
    'Program-level outcomes by CIP code: median earnings of graduates working and not enrolled 1 year after their highest credential, median cumulative Stafford/Grad PLUS borrowing across institutions at the same academic level, and IPEDS awards in each of the two pooled debt-cohort years (not enrollment or unique students).',
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
      median_debt: p.debt?.staff_grad_plus?.all?.all_inst?.median ?? null,
      ipeds_awards_year1: p.counts?.ipeds_awards1 ?? null,
      ipeds_awards_year2: p.counts?.ipeds_awards2 ?? null,
    }));

    return {
      school_id: record.id,
      school_name: record['school.name'],
      programs,
      total: programs.length,
    };
  },

  list: async () => ({
    resources: EXAMPLE_SCHOOLS.map((school) => ({
      uri: `scorecard://programs/${school.id}`,
      name: `${school.name} — programs`,
      description:
        'Example program-level outcomes feed — one of a few representative entries; discover other unit IDs with scorecard_search_schools.',
      mimeType: 'application/json',
    })),
  }),
});
