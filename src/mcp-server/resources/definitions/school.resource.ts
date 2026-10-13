/**
 * @fileoverview School profile resource. Provides institutional profile by unit ID
 * as injectable context for school-specific conversations.
 * @module mcp-server/resources/definitions/school.resource
 */

import { resource, z } from '@cyanheads/mcp-ts-core';
import { JsonRpcErrorCode } from '@cyanheads/mcp-ts-core/errors';
import { EXAMPLE_SCHOOLS } from '@/mcp-server/resources/definitions/example-schools.js';
import { SchoolIdStringSchema } from '@/services/scorecard/input-normalization.js';
import { getScorecardService } from '@/services/scorecard/scorecard-service.js';

export const schoolResource = resource('scorecard://school/{id}', {
  name: 'scorecard-school',
  title: 'School Profile',
  description:
    'Institutional profile by unit ID — injectable context for school-specific conversations. Returns core identity, cost, admissions, and outcomes data.',
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
    ctx.log.info('Fetching school resource', { id: params.id });
    const service = getScorecardService();

    const response = await service.getSchoolProfiles([params.id], undefined, ctx);

    const record = response.results[0];
    if (!record) {
      throw ctx.fail('school_not_found', `School ${params.id} not found.`, { id: params.id });
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

  list: async () => ({
    resources: EXAMPLE_SCHOOLS.map((school) => ({
      uri: `scorecard://school/${school.id}`,
      name: school.name,
      description:
        'Example school profile — one of a few representative entries; discover other unit IDs with scorecard_search_schools.',
      mimeType: 'application/json',
    })),
  }),
});
