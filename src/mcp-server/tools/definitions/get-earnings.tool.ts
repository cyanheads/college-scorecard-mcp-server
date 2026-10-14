/**
 * @fileoverview Earnings tool. Returns institution-level earnings of federally aided entrants
 * for one school at 6, 8, and 10 years after entry, with optional gender breakdown.
 * @module mcp-server/tools/definitions/get-earnings.tool
 */

import { tool, z } from '@cyanheads/mcp-ts-core';
import { JsonRpcErrorCode } from '@cyanheads/mcp-ts-core/errors';
import {
  EARNINGS_FIELDS,
  historicalEarningsContext,
  LATEST_EARNINGS_CONTEXT,
} from '@/data/earnings-context.js';
import { SchoolIdSchema } from '@/services/scorecard/input-normalization.js';
import { MetricAvailabilitySchema, readMetric } from '@/services/scorecard/metric-availability.js';
import { getScorecardService } from '@/services/scorecard/scorecard-service.js';

const ContextMapSchema = z.record(
  z.string(),
  z
    .object({
      data_file_year: z
        .number()
        .int()
        .describe('Start year of the API data file; not a cohort entry year.'),
      entry_cohorts: z
        .array(z.string())
        .optional()
        .describe('Verified academic-year entry cohorts.'),
      measurement_years: z
        .array(z.number().int())
        .optional()
        .describe('Verified calendar years when earnings were measured.'),
      dollar_year: z
        .number()
        .int()
        .optional()
        .describe('Verified inflation dollar basis; returned values are not re-inflated.'),
    })
    .describe('Official provenance for one metric.'),
);
const AvailabilityMapSchema = z.record(
  z.string(),
  MetricAvailabilitySchema.describe('Provider availability for one supported metric.'),
);

export const getEarningsTool = tool('scorecard_get_earnings', {
  title: 'Get School Earnings',
  description:
    'Institution-level earnings of federally aided undergraduate entrants working and not enrolled, regardless of completion. Reports medians at 6/8/10 years after entry, 6/10-year percentiles, and non-male/male 6-year medians. For graduate program earnings use scorecard_get_programs. years selects API data-file start years (1996–2025), including files without earnings observations. Per-metric availability and official cohort/measurement/dollar context accompany values; unknown metadata stays absent. No re-inflation is performed.',
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },

  input: z.object({
    id: SchoolIdSchema,
    years: z
      .array(
        z
          .number()
          .int()
          .min(1996)
          .max(2025)
          .describe('Published API data-file start year (1996–2025).'),
      )
      .optional()
      .describe(
        'Optional API data-file start years from 1996–2025 (e.g. [2003, 2011, 2020]); valid files may lack observations. Omit or pass [] for snapshot only.',
      ),
  }),

  output: z.object({
    school_id: z.number().describe('School unit ID.'),
    school_name: z.string().describe('Institution name.'),
    current_availability: AvailabilityMapSchema.describe(
      'Availability keyed by every supported current earnings metric.',
    ),
    current_context: ContextMapSchema.describe(
      'Official latest provenance keyed by metric, independent of returned values.',
    ),
    current: z
      .object({
        earnings_6yr_median: z.number().optional().describe('Median earnings 6 years after entry.'),
        earnings_6yr_p25: z
          .number()
          .optional()
          .describe('25th percentile earnings 6 years after entry.'),
        earnings_6yr_p75: z
          .number()
          .optional()
          .describe('75th percentile earnings 6 years after entry.'),
        earnings_8yr_median: z.number().optional().describe('Median earnings 8 years after entry.'),
        earnings_10yr_median: z
          .number()
          .optional()
          .describe('Median earnings 10 years after entry.'),
        earnings_10yr_p25: z
          .number()
          .optional()
          .describe('25th percentile earnings 10 years after entry.'),
        earnings_10yr_p75: z
          .number()
          .optional()
          .describe('75th percentile earnings 10 years after entry.'),
        earnings_6yr_non_male_median: z
          .number()
          .optional()
          .describe('Median earnings 6 years after entry for non-male students.'),
        earnings_6yr_male_median: z
          .number()
          .optional()
          .describe('Median earnings 6 years after entry for male students.'),
      })
      .describe('Most recent available earnings snapshot.'),
    trend: z
      .array(
        z
          .object({
            year: z.number().describe('API data-file start year.'),
            availability: AvailabilityMapSchema.describe(
              'Availability of the supported historical medians.',
            ),
            context: ContextMapSchema.describe(
              'Verified per-metric provenance; unknown metadata omitted.',
            ),
            earnings_6yr_median: z
              .number()
              .optional()
              .describe('Median earnings 6 years after entry reported in this data file.'),
            earnings_10yr_median: z
              .number()
              .optional()
              .describe('Median earnings 10 years after entry reported in this data file.'),
          })
          .describe('Earnings observations for one API data file.'),
      )
      .optional()
      .describe(
        'Historical rows by API data-file start year. Present only when nonempty years were supplied.',
      ),
    suppressed: z
      .boolean()
      .describe('True only when every supported current metric has an explicit privacy marker.'),
    suppression_note: z.string().optional().describe('Explains suppression when suppressed=true.'),
  }),

  errors: [
    {
      reason: 'api_conflict',
      code: JsonRpcErrorCode.Conflict,
      when: 'The provider reported a request conflict.',
      recovery: 'Review the provider detail and correct conflicting selectors before retrying.',
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
    {
      reason: 'school_not_found',
      code: JsonRpcErrorCode.NotFound,
      when: 'No school record found for the requested ID.',
      recovery: 'Verify the school ID using scorecard_search_schools and retry.',
    },
    {
      reason: 'api_error',
      code: JsonRpcErrorCode.ServiceUnavailable,
      when: 'The College Scorecard API returned an error.',
      recovery: 'Retry after a brief delay and report persistent provider failures.',
      thrownBy: 'service',
    },
  ],

  async handler(input, ctx) {
    ctx.log.info('Fetching school earnings', { id: input.id, years: input.years });
    const service = getScorecardService();

    const response = await service.getSchoolEarnings(input.id, input.years ?? [], ctx);

    const r = response.results[0];
    if (!r) {
      throw ctx.fail('school_not_found', `No school record found for ID ${input.id}.`, {
        id: input.id,
        recovery: { hint: 'Search for valid school IDs with scorecard_search_schools.' },
      });
    }

    const metrics = Object.entries(EARNINGS_FIELDS).map(
      ([key, suffix]) => [key, readMetric(r[`latest.earnings.${suffix}`])] as const,
    );
    const current = Object.fromEntries(
      metrics.flatMap(([key, metric]) => (metric.value != null ? [[key, metric.value]] : [])),
    );
    const current_availability = Object.fromEntries(
      metrics.map(([key, metric]) => [key, metric.availability]),
    );
    const suppressed = metrics.every(([, metric]) => metric.availability === 'privacy_suppressed');
    const suppression_note = suppressed
      ? 'Every supported current earnings metric is explicitly privacy-suppressed by the provider; the particular cause is not supplied.'
      : undefined;

    // Build trend rows for requested years
    const trend =
      input.years && input.years.length > 0
        ? input.years.map((year) => {
            const six = readMetric(r[`${year}.earnings.6_yrs_after_entry.median`]);
            const ten = readMetric(r[`${year}.earnings.10_yrs_after_entry.median`]);
            return {
              year,
              ...(six.value != null && { earnings_6yr_median: six.value }),
              ...(ten.value != null && { earnings_10yr_median: ten.value }),
              availability: {
                earnings_6yr_median: six.availability,
                earnings_10yr_median: ten.availability,
              },
              context: historicalEarningsContext(year),
            };
          })
        : undefined;

    return {
      school_id: r.id ?? Number(input.id),
      school_name: r['school.name'] ?? 'Unknown',
      current,
      current_availability,
      current_context: LATEST_EARNINGS_CONTEXT,
      ...(trend && { trend }),
      suppressed,
      ...(suppression_note && { suppression_note }),
    };
  },

  format: (result) => {
    const fmt = (n: number | undefined) => (n != null ? `$${n.toLocaleString()}` : 'Not available');
    const lines = [`## Earnings: ${result.school_name} (ID: ${result.school_id})`];
    lines.push('\n**Current Earnings Snapshot**');
    const c = result.current;
    if (result.suppressed) {
      lines.push(`> **Suppressed:** ${result.suppression_note ?? 'Earnings data not available.'}`);
    }
    lines.push(`6-Year Median: ${fmt(c.earnings_6yr_median)}`);
    lines.push(`6-Year P25/P75: ${fmt(c.earnings_6yr_p25)} / ${fmt(c.earnings_6yr_p75)}`);
    lines.push(`8-Year Median: ${fmt(c.earnings_8yr_median)}`);
    lines.push(`10-Year Median: ${fmt(c.earnings_10yr_median)}`);
    lines.push(`10-Year P25/P75: ${fmt(c.earnings_10yr_p25)} / ${fmt(c.earnings_10yr_p75)}`);
    lines.push(`6-Year Non-Male Median: ${fmt(c.earnings_6yr_non_male_median)}`);
    lines.push(`6-Year Male Median: ${fmt(c.earnings_6yr_male_median)}`);
    const labels: Record<string, string> = {
      earnings_6yr_median: '6-Year Median',
      earnings_6yr_p25: '6-Year P25',
      earnings_6yr_p75: '6-Year P75',
      earnings_8yr_median: '8-Year Median',
      earnings_10yr_median: '10-Year Median',
      earnings_10yr_p25: '10-Year P25',
      earnings_10yr_p75: '10-Year P75',
      earnings_6yr_non_male_median: '6-Year Non-Male Median',
      earnings_6yr_male_median: '6-Year Male Median',
    };
    const contextLine = (
      key: string,
      availability: string,
      context: z.infer<typeof ContextMapSchema>[string],
    ) =>
      `${labels[key]}: ${availability} | Data-file year: ${context.data_file_year} | Entry cohorts: ${context.entry_cohorts?.join(', ') ?? 'Unknown'} | Measurement years: ${context.measurement_years?.join(', ') ?? 'Unknown'} | Dollar year: ${context.dollar_year ?? 'Unknown'}`;
    lines.push('\n**Current Availability and Provenance**');
    for (const [key, availability] of Object.entries(result.current_availability)) {
      const context = result.current_context[key];
      if (context) lines.push(contextLine(key, availability, context));
    }
    if (result.trend && result.trend.length > 0) {
      lines.push('\n**Historical Trend (by Data-file Start Year)**');
      for (const row of result.trend) {
        const parts = [`Year: ${row.year}`];
        if (row.earnings_6yr_median != null)
          parts.push(`6yr: $${row.earnings_6yr_median.toLocaleString()}`);
        if (row.earnings_10yr_median != null)
          parts.push(`10yr: $${row.earnings_10yr_median.toLocaleString()}`);
        lines.push(parts.join(' | '));
        for (const [key, availability] of Object.entries(row.availability)) {
          const context = row.context[key];
          if (context) lines.push(contextLine(key, availability, context));
        }
      }
    }
    return [{ type: 'text', text: lines.join('\n') }];
  },
});
