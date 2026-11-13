/**
 * @fileoverview Programs resource. Provides program-level outcomes for a school
 * as injectable context.
 * @module mcp-server/resources/definitions/programs.resource
 */

import { resource, z } from '@cyanheads/mcp-ts-core';
import { JsonRpcErrorCode } from '@cyanheads/mcp-ts-core/errors';
import { EXAMPLE_SCHOOLS } from '@/mcp-server/resources/definitions/example-schools.js';
import { SchoolIdStringSchema } from '@/services/scorecard/input-normalization.js';
import { programResourcePage } from '@/services/scorecard/program-outcomes.js';
import { getScorecardService } from '@/services/scorecard/scorecard-service.js';

export const programsResource = resource('scorecard://programs/{id}', {
  name: 'scorecard-programs',
  title: 'School Programs',
  description:
    'First 20 program rows in provider order, with separate legacy highest-credential and current completion populations and dictionary provenance. Earnings/debt pool by OPEID6 within CIP and credential; awards are campus-specific. Follow nextUri to scorecard://programs/{id}/page/{offset}/{limit} for remaining rows.',
  mimeType: 'application/json',
  params: z.object({
    id: SchoolIdStringSchema,
  }),
  errors: [
    {
      reason: 'api_conflict',
      code: JsonRpcErrorCode.InvalidParams,
      when: 'Provider reported a conflict (HTTP 409).',
      recovery: 'Correct conflicting selectors in the request before retrying.',
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
        'Check field names with scorecard_list_fields or program codes with scorecard_lookup_cip before retrying.',
      thrownBy: 'service',
    },
    {
      reason: 'api_validation',
      code: JsonRpcErrorCode.ValidationError,
      when: 'A meaningful selector or provider value is invalid.',
      recovery: 'Check selectors and required IDs before retrying the request.',
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

    return programResourcePage(record, 0, 20);
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
