/**
 * @fileoverview College Scorecard API service. Wraps the api.data.gov/ed/collegescorecard/v1
 * endpoint with retry, field selection, and pagination support.
 * @module services/scorecard/scorecard-service
 */

import type { Context } from '@cyanheads/mcp-ts-core';
import type { AppConfig } from '@cyanheads/mcp-ts-core/config';
import {
  JsonRpcErrorCode,
  McpError,
  serviceUnavailable,
  validationError,
} from '@cyanheads/mcp-ts-core/errors';
import type { StorageService } from '@cyanheads/mcp-ts-core/storage';
import { fetchWithTimeout, httpErrorFromResponse, withRetry } from '@cyanheads/mcp-ts-core/utils';
import { getServerConfig } from '@/config/server-config.js';
import {
  meaningfulText,
  normalizeCip,
  normalizeSchoolId,
  normalizeSearchOptions,
  normalizeState,
} from './input-normalization.js';
import type { ScorecardApiResponse, ScorecardSearchOptions } from './types.js';

const BASE_URL = 'https://api.data.gov/ed/collegescorecard/v1/schools';

/** Default curated fields for school search results */
const SEARCH_DEFAULT_FIELDS = [
  'id',
  'school.name',
  'school.city',
  'school.state',
  'school.ownership',
  'school.degrees_awarded.predominant',
  'latest.student.size',
  'latest.admissions.admission_rate.overall',
  'latest.cost.tuition.in_state',
  'latest.cost.tuition.out_of_state',
  'latest.cost.avg_net_price.overall',
  'latest.aid.median_debt.completers.overall',
  'latest.earnings.6_yrs_after_entry.median',
].join(',');

/** Default fields for full school profile */
const PROFILE_DEFAULT_FIELDS = [
  'id',
  'school.name',
  'school.city',
  'school.state',
  'school.zip',
  'school.school_url',
  'school.ownership',
  'school.carnegie_basic',
  'school.locale',
  'school.degrees_awarded.predominant',
  'school.minority_serving.historically_black',
  'school.men_only',
  'school.women_only',
  'latest.student.size',
  'latest.admissions.admission_rate.overall',
  'latest.admissions.sat_scores.average.overall',
  'latest.admissions.sat_scores.25th_percentile.critical_reading',
  'latest.admissions.sat_scores.75th_percentile.critical_reading',
  'latest.admissions.sat_scores.25th_percentile.math',
  'latest.admissions.sat_scores.75th_percentile.math',
  'latest.admissions.act_scores.25th_percentile.cumulative',
  'latest.admissions.act_scores.75th_percentile.cumulative',
  'latest.cost.tuition.in_state',
  'latest.cost.tuition.out_of_state',
  'latest.cost.avg_net_price.overall',
  'latest.cost.net_price.public.by_income_level.0-30000',
  'latest.cost.net_price.public.by_income_level.30001-48000',
  'latest.cost.net_price.public.by_income_level.48001-75000',
  'latest.cost.net_price.public.by_income_level.75001-110000',
  'latest.cost.net_price.public.by_income_level.110001-plus',
  'latest.cost.net_price.private.by_income_level.0-30000',
  'latest.cost.net_price.private.by_income_level.30001-48000',
  'latest.cost.net_price.private.by_income_level.48001-75000',
  'latest.cost.net_price.private.by_income_level.75001-110000',
  'latest.cost.net_price.private.by_income_level.110001-plus',
  'latest.cost.attendance.academic_year',
  'latest.aid.median_debt.completers.overall',
  'latest.aid.pell_grant_rate',
  'latest.aid.federal_loan_rate',
  'latest.repayment.repayment_cohort.3_year_declining_balance',
  'latest.completion.rate_suppressed.overall',
  'latest.earnings.6_yrs_after_entry.median',
  'latest.earnings.6_yrs_after_entry.percentile25',
  'latest.earnings.6_yrs_after_entry.percentile75',
  'latest.earnings.8_yrs_after_entry.median_earnings',
  'latest.earnings.10_yrs_after_entry.median',
  'latest.earnings.10_yrs_after_entry.percentile25',
  'latest.earnings.10_yrs_after_entry.percentile75',
].join(',');

/** Default fields for earnings time series */
const EARNINGS_DEFAULT_FIELDS = [
  'id',
  'school.name',
  'latest.earnings.6_yrs_after_entry.median',
  'latest.earnings.6_yrs_after_entry.percentile25',
  'latest.earnings.6_yrs_after_entry.percentile75',
  'latest.earnings.8_yrs_after_entry.median_earnings',
  'latest.earnings.10_yrs_after_entry.median',
  'latest.earnings.10_yrs_after_entry.percentile25',
  'latest.earnings.10_yrs_after_entry.percentile75',
  'latest.earnings.6_yrs_after_entry.female_students.median_earnings',
  'latest.earnings.6_yrs_after_entry.male_students.median_earnings',
].join(',');

/** Fields for program-level data */
const PROGRAMS_DEFAULT_FIELDS = ['id', 'school.name', 'latest.programs.cip_4_digit'].join(',');

export class ScorecardService {
  private readonly apiKey: string;

  constructor(_config: AppConfig, _storage: StorageService) {
    this.apiKey = getServerConfig().apiKey;
  }

  /** Build URL with query parameters */
  private buildUrl(params: Record<string, string | number | undefined>): string {
    const url = new URL(BASE_URL);
    url.searchParams.set('api_key', this.apiKey);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }

  /**
   * Fetch from the API with retry and error classification. Every upstream
   * failure carries a stable reason for its wire code and the caller's declared recovery.
   */
  private fetchApi(
    params: Record<string, string | number | undefined>,
    ctx: Context,
  ): Promise<ScorecardApiResponse> {
    const url = this.buildUrl(params);
    ctx.log.debug('Fetching Scorecard API', { endpoint: BASE_URL });
    const apiError = { reason: 'api_error', ...ctx.recoveryFor('api_error') };

    return withRetry(
      async () => {
        const response = await fetchWithTimeout(url, 30_000, ctx, { signal: ctx.signal });
        const text = await response.text();

        // Detect HTML error pages
        if (/^\s*<(!DOCTYPE\s+html|html[\s>])/i.test(text)) {
          throw serviceUnavailable(
            'Scorecard API returned HTML instead of JSON — likely rate-limited or unavailable.',
            apiError,
          );
        }

        let body: unknown;
        try {
          body = JSON.parse(text);
        } catch {
          throw serviceUnavailable('Scorecard API returned non-JSON response.', apiError);
        }

        if (body === null || typeof body !== 'object' || Array.isArray(body))
          throw serviceUnavailable('Scorecard API returned unexpected response shape.', apiError);
        const data = body as Record<string, unknown>;

        // Check for API-level errors
        if (data.error || (Array.isArray(data.errors) && data.errors.length > 0)) {
          const apiErr = data as {
            error?: { code?: string; message?: string };
            errors?: Array<{ error?: string; input?: string; message?: string }>;
          };
          const msg =
            apiErr.error?.message ??
            apiErr.errors?.[0]?.message ??
            'Scorecard API returned an error.';
          const code = apiErr.error?.code ?? apiErr.errors?.[0]?.error;
          if (code === 'API_KEY_MISSING' || code === 'API_KEY_INVALID') {
            throw await httpErrorFromResponse(new Response(this.safeDetail(msg), { status: 401 }), {
              service: 'Scorecard API',
            });
          }
          throw serviceUnavailable(`Scorecard API error: ${this.safeDetail(msg)}`, {
            ...apiError,
            code,
          });
        }

        if (!data.results || !data.metadata) {
          throw serviceUnavailable('Scorecard API returned unexpected response shape.', {
            ...apiError,
            keys: Object.keys(data),
          });
        }

        return data as unknown as ScorecardApiResponse;
      },
      {
        operation: 'ScorecardService.fetchApi',
        baseDelayMs: 1000,
        signal: ctx.signal,
      },
    ).catch((error: unknown) => {
      if (!(error instanceof McpError) || error.code === JsonRpcErrorCode.RequestCancelled)
        throw error;
      const reasons: Partial<Record<JsonRpcErrorCode, string>> = {
        [JsonRpcErrorCode.InvalidParams]: 'api_invalid_params',
        [JsonRpcErrorCode.ValidationError]: 'api_validation',
        [JsonRpcErrorCode.Unauthorized]: 'api_unauthorized',
        [JsonRpcErrorCode.Forbidden]: 'api_forbidden',
        [JsonRpcErrorCode.Conflict]: 'api_conflict',
        [JsonRpcErrorCode.RateLimited]: 'api_rate_limited',
        [JsonRpcErrorCode.Timeout]: 'api_timeout',
        [JsonRpcErrorCode.ServiceUnavailable]: 'api_error',
        [JsonRpcErrorCode.NotFound]: 'api_not_found',
        [JsonRpcErrorCode.InvalidRequest]: 'api_invalid_request',
        [JsonRpcErrorCode.InternalError]: 'api_internal',
      };
      const reason = reasons[error.code];
      const data: Record<string, unknown> = {
        ...error.data,
        ...(reason && { reason, ...ctx.recoveryFor(reason) }),
      };
      if (
        [
          JsonRpcErrorCode.InvalidParams,
          JsonRpcErrorCode.ValidationError,
          JsonRpcErrorCode.Unauthorized,
          JsonRpcErrorCode.Forbidden,
        ].includes(error.code)
      )
        data.retryable = false;
      for (const key of ['body', 'responseBody', 'code', 'statusText'])
        if (typeof data[key] === 'string') data[key] = this.safeDetail(data[key]);
      const message = data.status
        ? `Scorecard API returned HTTP ${data.status}.${data.body ? ` ${data.body}` : ''}`
        : this.safeDetail(error.message);
      throw new McpError(error.code, message, data);
    });
  }

  /** Provider diagnostics are useful; credentials and credential-bearing URLs are not. */
  private safeDetail(text: string): string {
    return text
      .replaceAll(this.apiKey, '[redacted]')
      .replaceAll(encodeURIComponent(this.apiKey), '[redacted]')
      .replace(/https?:\/\/[^\s"<>]+/gi, '[provider URL]')
      .replace(/(api[_-]?key|token|authorization)\s*[=:]\s*[^\s,;]+/gi, '$1=[redacted]')
      .slice(0, 500);
  }

  /** Search schools with filter params */
  searchSchools(options: ScorecardSearchOptions, ctx: Context): Promise<ScorecardApiResponse> {
    options = normalizeSearchOptions(options);
    const params: Record<string, string | number | undefined> = {
      fields: options.fields ?? SEARCH_DEFAULT_FIELDS,
      per_page: options.perPage ?? 20,
      page: options.page ?? 0,
    };

    if (options.name) params['school.name'] = options.name;
    if (options.state) params['school.state'] = options.state;
    if (options.ownership != null) params['school.ownership'] = options.ownership;
    if (options.degreeLevel != null)
      params['school.degrees_awarded.predominant'] = options.degreeLevel;
    if (options.sizeRange) {
      const [min, max] = options.sizeRange;
      params['latest.student.size__range'] = `${min}..${max}`;
    }
    if (options.acceptanceRateRange) {
      const [min, max] = options.acceptanceRateRange;
      params['latest.admissions.admission_rate.overall__range'] = `${min}..${max}`;
    }
    if (options.zip) params.zip = options.zip;
    if (options.distance) params.distance = options.distance;
    if (options.cipCode)
      params['latest.programs.cip_4_digit.code'] = options.cipCode.replace('.', '');
    if (options.sort) params.sort = options.sort;
    if (options.menOnly != null) params['school.men_only'] = options.menOnly ? 1 : 0;
    if (options.womenOnly != null) params['school.women_only'] = options.womenOnly ? 1 : 0;
    if (options.extraParams) {
      for (const [k, v] of Object.entries(options.extraParams)) {
        params[k] = v;
      }
    }

    return this.fetchApi(params, ctx);
  }

  /** Fetch one or more school profiles by ID */
  getSchoolProfiles(
    ids: Array<string | number>,
    fields: string | undefined,
    ctx: Context,
  ): Promise<ScorecardApiResponse> {
    if (ids.length === 0)
      throw validationError('No school IDs provided.', {
        reason: 'api_validation',
        ...ctx.recoveryFor('api_validation'),
      });
    if (ids.length > 1000)
      throw validationError('Provide at most 1,000 school IDs per request.', {
        reason: 'api_validation',
      });
    const processed = [...new Set(ids.map(normalizeSchoolId))].slice(0, 100);
    const selected = meaningfulText(fields)
      ?.split(',')
      .map((field) => field.trim())
      .filter(Boolean);

    const params: Record<string, string | number | undefined> = {
      id: processed.join(','),
      fields: selected?.length
        ? [...new Set(['id', 'school.name', ...selected])].join(',')
        : PROFILE_DEFAULT_FIELDS,
      per_page: processed.length,
    };

    return this.fetchApi(params, ctx);
  }

  /**
   * Fetch a school's full program list. Program filters are applied by the caller —
   * an upstream CIP filter drops the school record when no program matches, which
   * would read as a missing school.
   */
  getSchoolPrograms(
    id: string | number,
    _cipCode: string | undefined,
    _minEarnings: number | undefined,
    _credentialLevel: number | undefined,
    ctx: Context,
  ): Promise<ScorecardApiResponse> {
    id = normalizeSchoolId(id);
    normalizeCip(_cipCode);
    const params: Record<string, string | number | undefined> = {
      id: String(id),
      fields: PROGRAMS_DEFAULT_FIELDS,
      per_page: 1,
    };

    return this.fetchApi(params, ctx);
  }

  /** Fetch earnings time series for a school */
  getSchoolEarnings(
    id: string | number,
    years: number[],
    ctx: Context,
  ): Promise<ScorecardApiResponse> {
    id = normalizeSchoolId(id);
    const yearFields =
      years.length > 0
        ? years
            .flatMap((y) => [
              `${y}.earnings.6_yrs_after_entry.median`,
              `${y}.earnings.10_yrs_after_entry.median`,
            ])
            .join(',')
        : '';

    const params: Record<string, string | number | undefined> = {
      id: String(id),
      fields: yearFields ? `${EARNINGS_DEFAULT_FIELDS},${yearFields}` : EARNINGS_DEFAULT_FIELDS,
      per_page: 1,
    };

    return this.fetchApi(params, ctx);
  }

  /** Search programs across schools */
  searchPrograms(
    options: {
      cipCode?: string | undefined;
      programName?: string;
      state?: string | undefined;
      ownership?: number;
      maxNetPrice?: number;
      maxDebt?: number;
      perPage?: number;
      page?: number;
    },
    ctx: Context,
  ): Promise<ScorecardApiResponse> {
    options = {
      ...options,
      state: normalizeState(options.state),
      cipCode: normalizeCip(options.cipCode),
    };
    const params: Record<string, string | number | undefined> = {
      fields: [
        'id',
        'school.name',
        'school.state',
        'school.ownership',
        'latest.cost.avg_net_price.overall',
        'latest.programs.cip_4_digit',
      ].join(','),
      per_page: options.perPage ?? 20,
      page: options.page ?? 0,
    };

    if (options.cipCode)
      params['latest.programs.cip_4_digit.code'] = options.cipCode.replace('.', '');
    if (options.state) params['school.state'] = options.state;
    if (options.ownership != null) params['school.ownership'] = options.ownership;
    if (options.maxNetPrice != null)
      params['latest.cost.avg_net_price.overall__range'] = `..${options.maxNetPrice}`;
    if (options.maxDebt != null) {
      params['latest.programs.cip_4_digit.debt.staff_grad_plus.all.all_inst.median__range'] =
        `..${options.maxDebt}`;
    }

    return this.fetchApi(params, ctx);
  }

  /** Fetch fields for value analysis (cost + earnings in parallel) */
  getValueAnalysisData(
    id: string | number,
    ctx: Context,
  ): Promise<[ScorecardApiResponse, ScorecardApiResponse]> {
    id = normalizeSchoolId(id);
    const costFields = [
      'id',
      'school.name',
      'school.carnegie_basic',
      'school.ownership',
      'latest.cost.tuition.in_state',
      'latest.cost.tuition.out_of_state',
      'latest.cost.avg_net_price.overall',
      'latest.cost.net_price.public.by_income_level.0-30000',
      'latest.cost.net_price.public.by_income_level.30001-48000',
      'latest.cost.net_price.public.by_income_level.48001-75000',
      'latest.cost.net_price.public.by_income_level.75001-110000',
      'latest.cost.net_price.public.by_income_level.110001-plus',
      'latest.cost.net_price.private.by_income_level.0-30000',
      'latest.cost.net_price.private.by_income_level.30001-48000',
      'latest.cost.net_price.private.by_income_level.48001-75000',
      'latest.cost.net_price.private.by_income_level.75001-110000',
      'latest.cost.net_price.private.by_income_level.110001-plus',
      'latest.aid.median_debt.completers.overall',
      'latest.repayment.repayment_cohort.3_year_declining_balance',
      'latest.completion.rate_suppressed.overall',
    ].join(',');

    const earningsFields = [
      'id',
      'latest.earnings.6_yrs_after_entry.median',
      'latest.earnings.6_yrs_after_entry.percentile25',
      'latest.earnings.6_yrs_after_entry.percentile75',
      'latest.earnings.8_yrs_after_entry.median_earnings',
      'latest.earnings.10_yrs_after_entry.median',
    ].join(',');

    return Promise.all([
      this.fetchApi({ id: String(id), fields: costFields, per_page: 1 }, ctx),
      this.fetchApi({ id: String(id), fields: earningsFields, per_page: 1 }, ctx),
    ]);
  }

  /** Fetch comparison data for multiple schools on a specific topic */
  getComparisonData(
    ids: Array<string | number>,
    topic: 'costs' | 'admissions' | 'outcomes' | 'aid',
    ctx: Context,
  ): Promise<ScorecardApiResponse> {
    if (ids.length === 0)
      throw validationError('No school IDs provided.', {
        reason: 'api_validation',
        ...ctx.recoveryFor('api_validation'),
      });
    ids = [...new Set(ids.map(normalizeSchoolId))];
    const topicFields: Record<string, string> = {
      costs: [
        'id',
        'school.name',
        'latest.cost.tuition.in_state',
        'latest.cost.tuition.out_of_state',
        'latest.cost.avg_net_price.overall',
        'latest.cost.net_price.public.by_income_level.0-30000',
        'latest.cost.net_price.public.by_income_level.30001-48000',
        'latest.cost.net_price.public.by_income_level.48001-75000',
        'latest.cost.net_price.public.by_income_level.75001-110000',
        'latest.cost.net_price.public.by_income_level.110001-plus',
        'latest.cost.net_price.private.by_income_level.0-30000',
        'latest.cost.net_price.private.by_income_level.30001-48000',
        'latest.cost.net_price.private.by_income_level.48001-75000',
        'latest.cost.net_price.private.by_income_level.75001-110000',
        'latest.cost.net_price.private.by_income_level.110001-plus',
        'latest.aid.median_debt.completers.overall',
      ].join(','),
      admissions: [
        'id',
        'school.name',
        'latest.admissions.admission_rate.overall',
        'latest.admissions.sat_scores.average.overall',
        'latest.admissions.sat_scores.25th_percentile.math',
        'latest.admissions.sat_scores.75th_percentile.math',
        'latest.admissions.act_scores.25th_percentile.cumulative',
        'latest.admissions.act_scores.75th_percentile.cumulative',
        'latest.student.size',
      ].join(','),
      outcomes: [
        'id',
        'school.name',
        'latest.completion.rate_suppressed.overall',
        'latest.earnings.6_yrs_after_entry.median',
        'latest.earnings.10_yrs_after_entry.median',
        'latest.repayment.repayment_cohort.3_year_declining_balance',
        'latest.aid.median_debt.completers.overall',
      ].join(','),
      aid: [
        'id',
        'school.name',
        'latest.aid.pell_grant_rate',
        'latest.aid.federal_loan_rate',
        'latest.aid.median_debt.completers.overall',
        'latest.repayment.repayment_cohort.3_year_declining_balance',
        'latest.cost.avg_net_price.overall',
      ].join(','),
    };

    const params: Record<string, string | number | undefined> = {
      id: ids.join(','),
      fields: topicFields[topic],
      per_page: ids.length,
    };

    return this.fetchApi(params, ctx);
  }
}

// --- Init/accessor pattern ---

let _service: ScorecardService | undefined;

export function initScorecardService(config: AppConfig, storage: StorageService): void {
  _service = new ScorecardService(config, storage);
}

export function getScorecardService(): ScorecardService {
  if (!_service) {
    throw new Error('ScorecardService not initialized — call initScorecardService() in setup()');
  }
  return _service;
}
