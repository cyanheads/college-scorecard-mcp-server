/**
 * @fileoverview Programs resource. Provides program-level outcomes for a school
 * as injectable context.
 * @module mcp-server/resources/definitions/programs.resource
 */

import { resource, z } from '@cyanheads/mcp-ts-core';
import { JsonRpcErrorCode } from '@cyanheads/mcp-ts-core/errors';
import { EXAMPLE_SCHOOLS } from '@/mcp-server/resources/definitions/example-schools.js';
import { SchoolIdStringSchema } from '@/services/scorecard/input-normalization.js';
import { getScorecardService } from '@/services/scorecard/scorecard-service.js';

export const programsResource = resource('scorecard://programs/{id}', {
  name: 'scorecard-programs',
  title: 'School Programs',
  description:
    'Program-level outcomes by CIP code: median earnings of graduates working and not enrolled 1 year after their highest credential, median cumulative Stafford/Grad PLUS borrowing across institutions at the same academic level, and IPEDS awards in each of the two pooled debt-cohort years (not enrollment or unique students).',
  mimeType: 'application/json',
  params: z.object({
    id: SchoolIdStringSchema,
  }),
  errors: [
    {
      reason: 'api_conflict',
      code: JsonRpcErrorCode.InvalidParams,
      when: 'Provider reported a conflict (HTTP 409).',
      recovery: 'Review the provider detail and correct conflicting selectors before retrying.',
      thrownBy: 'service',
    },
    {
      reason: 'school_not_found',
      code: JsonRpcErrorCode.NotFound,
      when: 'The school ID has no institution record.',
      recovery: 'Discover a valid school ID using scorecard_search_schools and retry.',
    },
    {
      reason: 'api_error',
      code: JsonRpcErrorCode.ServiceUnavailable,
      when: 'The provider is unavailable.',
      recovery: 'Retry after a brief delay and report persistent provider failures.',
      thrownBy: 'service',
    },
    {
      reason: 'api_invalid_params',
      code: JsonRpcErrorCode.InvalidParams,
      when: 'Provider rejected a query parameter.',
      recovery:
        'Correct the reported parameter using scorecard_list_fields or scorecard_lookup_cip before retrying.',
      thrownBy: 'service',
    },
    {
      reason: 'api_validation',
      code: JsonRpcErrorCode.ValidationError,
      when: 'A meaningful selector or provider value is invalid.',
      recovery: 'Correct the reported selector or required ID before retrying the request.',
      thrownBy: 'service',
    },
    {
      reason: 'api_unauthorized',
      code: JsonRpcErrorCode.Unauthorized,
      when: 'The provider rejected the API credentials.',
      recovery: 'Verify SCORECARD_API_KEY is valid and retry with valid credentials.',
      thrownBy: 'service',
    },
    {
      reason: 'api_forbidden',
      code: JsonRpcErrorCode.Forbidden,
      when: 'The provider denied access.',
      recovery: 'Check SCORECARD_API_KEY permissions and provider access before retrying.',
      thrownBy: 'service',
    },
    {
      reason: 'api_rate_limited',
      code: JsonRpcErrorCode.RateLimited,
      when: 'The provider throttled the request.',
      recovery: 'Wait for the provider retry window before making another request.',
      thrownBy: 'service',
    },
    {
      reason: 'api_timeout',
      code: JsonRpcErrorCode.Timeout,
      when: 'The provider exchange exceeded its deadline.',
      recovery: 'Retry after a brief delay or narrow the requested data.',
      thrownBy: 'service',
    },
    {
      reason: 'api_not_found',
      code: JsonRpcErrorCode.NotFound,
      when: 'The provider endpoint returned HTTP 404.',
      recovery: 'Check provider availability and retry the request after a brief delay.',
      thrownBy: 'service',
    },
    {
      reason: 'api_invalid_request',
      code: JsonRpcErrorCode.InvalidRequest,
      when: 'The provider returned an unexpected redirect.',
      recovery: 'Check provider availability before retrying this request with the same selectors.',
      thrownBy: 'service',
    },
    {
      reason: 'api_internal',
      code: JsonRpcErrorCode.InternalError,
      when: 'The provider returned an unclassified HTTP response.',
      recovery: 'Retry after a brief delay and report persistent provider failures.',
      thrownBy: 'service',
    },
  ],

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
      throw ctx.fail('school_not_found', `School ${params.id} not found.`, { id: params.id });
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
