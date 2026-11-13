/**
 * @fileoverview Bounded continuation for school program inventories.
 * @module mcp-server/resources/definitions/programs-page.resource
 */
import { resource, z } from '@cyanheads/mcp-ts-core';
import { JsonRpcErrorCode } from '@cyanheads/mcp-ts-core/errors';
import { SchoolIdStringSchema } from '@/services/scorecard/input-normalization.js';
import { programResourcePage } from '@/services/scorecard/program-outcomes.js';
import { getScorecardService } from '@/services/scorecard/scorecard-service.js';

export const programsPageResource = resource('scorecard://programs/{id}/page/{offset}/{limit}', {
  name: 'scorecard-programs-page',
  title: 'School Programs Page',
  description:
    'Page through programs in provider order. Offset is zero-based; limit normalizes to at most 100. Follow nextUri until null. Earnings and debt are OPEID6-pooled within CIP and credential, while awards are campus-specific.',
  mimeType: 'application/json',
  params: z.object({
    id: SchoolIdStringSchema,
    offset: z
      .string()
      .regex(/^\d{1,10}$/)
      .describe('Nonnegative zero-based row offset as decimal digits.'),
    limit: z
      .string()
      .regex(/^\d{1,4}$/)
      .refine((value) => Number(value) >= 1 && Number(value) <= 1000)
      .describe('Requested row limit, 1–1000; values above 100 normalize to 100.'),
  }),
  errors: [
    {
      reason: 'school_not_found',
      code: JsonRpcErrorCode.NotFound,
      when: 'No institution record matches the ID.',
      recovery: 'Discover a valid ID with scorecard_search_schools before retrying.',
    },
    {
      reason: 'api_conflict',
      code: JsonRpcErrorCode.InvalidParams,
      when: 'Provider reported a request conflict.',
      recovery: 'Correct conflicting selectors in the request before retrying.',
      thrownBy: 'service',
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
      recovery: 'Check the requested field with scorecard_list_fields before retrying.',
      thrownBy: 'service',
    },
    {
      reason: 'api_validation',
      code: JsonRpcErrorCode.ValidationError,
      when: 'A selector or provider value is invalid.',
      recovery: 'Check the selector and required ID before retrying.',
      thrownBy: 'service',
    },
    {
      reason: 'api_unauthorized',
      code: JsonRpcErrorCode.Unauthorized,
      when: 'Provider rejected the API credentials.',
      recovery: 'Verify SCORECARD_API_KEY is valid before retrying the request.',
      thrownBy: 'service',
    },
    {
      reason: 'api_forbidden',
      code: JsonRpcErrorCode.Forbidden,
      when: 'Provider denied access.',
      recovery: 'Check SCORECARD_API_KEY permissions and provider access before retrying.',
      thrownBy: 'service',
    },
    {
      reason: 'api_rate_limited',
      code: JsonRpcErrorCode.RateLimited,
      when: 'Provider throttled the request.',
      recovery: 'Wait for the provider retry window before making another request.',
      thrownBy: 'service',
    },
    {
      reason: 'api_timeout',
      code: JsonRpcErrorCode.Timeout,
      when: 'Provider exchange exceeded its deadline.',
      recovery: 'Retry after a brief delay or narrow the requested data.',
      thrownBy: 'service',
    },
    {
      reason: 'api_not_found',
      code: JsonRpcErrorCode.NotFound,
      when: 'Provider endpoint returned HTTP 404.',
      recovery: 'Check provider availability and retry after a brief delay.',
      thrownBy: 'service',
    },
    {
      reason: 'api_invalid_request',
      code: JsonRpcErrorCode.InvalidRequest,
      when: 'Provider returned an unexpected redirect.',
      recovery: 'Check provider availability before retrying with the same selectors.',
      thrownBy: 'service',
    },
    {
      reason: 'api_internal',
      code: JsonRpcErrorCode.InternalError,
      when: 'Provider returned an unclassified response.',
      recovery: 'Retry after a brief delay and report persistent provider failures.',
      thrownBy: 'service',
    },
  ],
  async handler(params, ctx) {
    const response = await getScorecardService().getSchoolPrograms(
      params.id,
      undefined,
      undefined,
      undefined,
      ctx,
    );
    const record = response.results[0];
    if (!record)
      throw ctx.fail('school_not_found', `School ${params.id} not found.`, { id: params.id });
    return programResourcePage(record, Number(params.offset), Number(params.limit));
  },
});
