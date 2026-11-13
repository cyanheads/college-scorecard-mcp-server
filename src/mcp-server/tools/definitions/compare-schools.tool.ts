/**
 * @fileoverview School comparison tool. Returns normalized side-by-side comparison
 * of 2–5 schools with ordinal competition ranks within the result set.
 * @module mcp-server/tools/definitions/compare-schools.tool
 */

import { tool, z } from '@cyanheads/mcp-ts-core';
import { JsonRpcErrorCode } from '@cyanheads/mcp-ts-core/errors';
import { escapeMarkdownInline } from '@cyanheads/mcp-ts-core/utils';
import { LEGACY_REPAYMENT_3YR_NOTE } from '@/data/repayment-context.js';
import {
  formatOperatingCertification,
  InstitutionContextSchema,
  institutionContext,
  institutionCosts,
  OperatingCertificationSchema,
  operatingCertification,
  operatingCertificationNotice,
} from '@/mcp-server/institution-context.js';
import { normalizeSchoolId, SchoolIdSchema } from '@/services/scorecard/input-normalization.js';
import { MetricAvailabilitySchema, readMetric } from '@/services/scorecard/metric-availability.js';
import { getScorecardService } from '@/services/scorecard/scorecard-service.js';

/** Rank available values by the number of strictly better values; ties share a rank. */
function computeRanks(
  values: (number | null | undefined)[],
  higherIsBetter: boolean,
): (number | null)[] {
  return values.map((value) =>
    value == null
      ? null
      : 1 +
        values.filter((other) => other != null && (higherIsBetter ? other > value : other < value))
          .length,
  );
}

const ComparisonRowSchema = z.object({
  metric: z.string().describe('Metric name.'),
  values: z
    .array(
      z
        .object({
          school_id: z.number().describe('School unit ID.'),
          value: z.number().optional().describe('Raw metric value. Omitted when not available.'),
          rank: z
            .number()
            .optional()
            .describe(
              'Competition rank for eligible outcome or price rows with at least two distinct found schools (1=best).',
            ),
          suppressed: z.boolean().describe('True only for explicit provider privacy markers.'),
          availability: MetricAvailabilitySchema.describe(
            'Available number, unavailable with unknown cause, or confirmed privacy suppression.',
          ),
          basis: z
            .enum(['academic_year', 'program_year'])
            .optional()
            .describe('Period of an effective price.'),
        })
        .describe('Per-school data point for this metric.'),
    )
    .describe('Per-school values for this metric.'),
  unit: z.string().optional().describe('Unit of measurement (e.g. "$", "%", "students").'),
  note: z.string().optional().describe('Contextual note about this metric.'),
});

export const compareSchoolsTool = tool('scorecard_compare_schools', {
  title: 'Compare Schools',
  description:
    'Side-by-side comparison of the first five distinct normalized school IDs, accepting up to 1,000 raw IDs. Remaining IDs are unprocessed; request them separately. Prices, debt, completion, earnings, and repayment use competition ranks with shared ties when at least two distinct schools are found. Admissions and aid participation, shared OPEID6 outcomes, and mixed-period price rows are unranked. Topics: costs, admissions, outcomes, aid. Use scorecard_get_school for full profiles.',
  annotations: { readOnlyHint: true, openWorldHint: true },

  input: z.object({
    ids: z
      .array(SchoolIdSchema)
      .min(2)
      .max(1000)
      .describe('2–1,000 raw school IDs; first five distinct normalized IDs compared.'),
    topic: z
      .enum(['costs', 'admissions', 'outcomes', 'aid'])
      .describe('Comparison topic: costs, admissions, outcomes, or aid.'),
  }),

  output: z.object({
    schools: z
      .array(
        z
          .object({
            ...InstitutionContextSchema.shape,
            operating: OperatingCertificationSchema,
            id: z.number().describe('School unit ID.'),
            name: z.string().describe('Institution name.'),
          })
          .describe('School identity record.'),
      )
      .describe('Schools in the comparison set, in the same order as the ids input.'),
    missing_ids: z.array(z.number()).optional().describe('Processed IDs without records.'),
    unprocessed_ids: z
      .array(z.number())
      .optional()
      .describe('Distinct normalized IDs beyond the five-school serving cap.'),
    topic: z.string().describe('The comparison topic used.'),
    rows: z
      .array(ComparisonRowSchema.describe('Comparison row for one metric.'))
      .describe('Comparison rows — one per metric, with per-school values and ranks.'),
    summary: z
      .string()
      .optional()
      .describe('Brief interpretive summary highlighting the most notable relative differences.'),
  }),

  enrichment: {
    notice: z
      .string()
      .optional()
      .describe('Missing records, certification, or comparison notices.'),
  },

  errors: [
    {
      reason: 'api_conflict',
      code: JsonRpcErrorCode.Conflict,
      when: 'The provider reported a request conflict.',
      recovery: 'Correct conflicting selectors in the request before retrying.',
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
    {
      reason: 'schools_not_found',
      code: JsonRpcErrorCode.NotFound,
      when: 'None of the requested school IDs returned records.',
      recovery: 'Verify school IDs with scorecard_search_schools and retry with valid IDs.',
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
    const ids = [...new Set(input.ids.map(normalizeSchoolId))];
    const unprocessed_ids = ids.slice(5);
    input = { ...input, ids: ids.slice(0, 5) };
    ctx.log.info('Comparing schools', { ids: input.ids, topic: input.topic });
    const service = getScorecardService();

    const response = await service.getComparisonData(input.ids, input.topic, ctx);

    if (response.results.length === 0) {
      throw ctx.fail(
        'schools_not_found',
        `No records found for processed IDs ${input.ids.join(', ')}. Unprocessed IDs: ${unprocessed_ids.join(', ') || 'None'}.`,
        {
          ids: input.ids,
          missing_ids: input.ids,
          unprocessed_ids,
          recovery: { hint: 'Use scorecard_search_schools to find valid school IDs first.' },
        },
      );
    }

    // Build a lookup by ID for consistent ordering
    const byId = new Map<string, (typeof response.results)[0]>();
    for (const r of response.results) {
      if (r.id != null) byId.set(String(r.id), r);
    }

    const schools = input.ids.map((id) => {
      const r = byId.get(String(id));
      return {
        id: Number(id),
        name: r?.['school.name'] ?? '(Not found)',
        ...(r && institutionContext(r)),
        ...operatingCertification(r),
      };
    });

    const found = schools.filter((s) => byId.has(String(s.id)));
    const singleton = found.length === 1;
    const missing = schools.filter((s) => !byId.has(String(s.id)));
    const missing_ids = missing.map((school) => school.id);
    const knownOpeids = found.flatMap((school) =>
      school.ope6_id != null && school.ope6_id.trim().length > 0 ? [school.ope6_id] : [],
    );
    const sharedOpeid = new Set(knownOpeids).size < knownOpeids.length;
    const notices: string[] = [];

    if (missing.length > 0) {
      notices.push(
        `${missing.length} of ${input.ids.length} requested IDs returned no record: ${missing.map((s) => s.id).join(', ')}`,
      );
    }
    if (unprocessed_ids.length)
      notices.push(
        `Unprocessed IDs: ${unprocessed_ids.join(', ')}. Request these IDs separately; only the first five distinct IDs were queried.`,
      );

    const certificationNotice = operatingCertificationNotice(found);
    if (certificationNotice) notices.push(certificationNotice);

    // Build comparison rows per topic
    type MetricDef = {
      metric: string;
      key: string;
      /**
       * Ownership-keyed fallbacks read in order, first non-null wins (e.g. public
       * vs private net-price paths). When set, `key` is unused for value lookup.
       */
      keys?: string[];
      unit?: string;
      higherIsBetter: boolean | null;
      note?: string;
      price?: 'tuition' | 'attendance';
    };
    const metricsByTopic: Record<typeof input.topic, MetricDef[]> = {
      costs: [
        {
          metric: 'Effective Tuition',
          key: '',
          price: 'tuition',
          unit: '$',
          higherIsBetter: false,
        },
        {
          metric: 'Cost of Attendance',
          key: '',
          price: 'attendance',
          unit: '$',
          higherIsBetter: false,
        },
        {
          metric: 'Program-Year Tuition',
          key: 'latest.cost.tuition.program_year',
          unit: '$',
          higherIsBetter: false,
        },
        {
          metric: 'Program-Year Cost of Attendance',
          key: 'latest.cost.attendance.program_year',
          unit: '$',
          higherIsBetter: false,
        },
        {
          metric: 'In-State Tuition',
          key: 'latest.cost.tuition.in_state',
          unit: '$',
          higherIsBetter: false,
        },
        {
          metric: 'Out-of-State Tuition',
          key: 'latest.cost.tuition.out_of_state',
          unit: '$',
          higherIsBetter: false,
        },
        {
          metric: 'Avg Net Price (overall)',
          key: 'latest.cost.avg_net_price.overall',
          unit: '$',
          higherIsBetter: false,
        },
        {
          metric: 'Net Price ($0–30k income)',
          key: 'latest.cost.net_price.public.by_income_level.0-30000',
          keys: [
            'latest.cost.net_price.public.by_income_level.0-30000',
            'latest.cost.net_price.private.by_income_level.0-30000',
          ],
          unit: '$',
          higherIsBetter: false,
        },
        {
          metric: 'Net Price ($30k–48k income)',
          key: 'latest.cost.net_price.public.by_income_level.30001-48000',
          keys: [
            'latest.cost.net_price.public.by_income_level.30001-48000',
            'latest.cost.net_price.private.by_income_level.30001-48000',
          ],
          unit: '$',
          higherIsBetter: false,
        },
        {
          metric: 'Net Price ($48k–75k income)',
          key: 'latest.cost.net_price.public.by_income_level.48001-75000',
          keys: [
            'latest.cost.net_price.public.by_income_level.48001-75000',
            'latest.cost.net_price.private.by_income_level.48001-75000',
          ],
          unit: '$',
          higherIsBetter: false,
        },
        {
          metric: 'Net Price ($75k–110k income)',
          key: 'latest.cost.net_price.public.by_income_level.75001-110000',
          keys: [
            'latest.cost.net_price.public.by_income_level.75001-110000',
            'latest.cost.net_price.private.by_income_level.75001-110000',
          ],
          unit: '$',
          higherIsBetter: false,
        },
        {
          metric: 'Net Price ($110k+ income)',
          key: 'latest.cost.net_price.public.by_income_level.110001-plus',
          keys: [
            'latest.cost.net_price.public.by_income_level.110001-plus',
            'latest.cost.net_price.private.by_income_level.110001-plus',
          ],
          unit: '$',
          higherIsBetter: false,
        },
        {
          metric: 'Median Debt at Graduation',
          key: 'latest.aid.median_debt.completers.overall',
          unit: '$',
          higherIsBetter: false,
        },
      ],
      admissions: [
        {
          metric: 'Acceptance Rate',
          key: 'latest.admissions.admission_rate.overall',
          unit: '%',
          higherIsBetter: null,
          note: 'Lower may indicate more selectivity',
        },
        {
          metric: 'SAT Average',
          key: 'latest.admissions.sat_scores.average.overall',
          higherIsBetter: null,
        },
        {
          metric: 'SAT Math 25th Pct',
          key: 'latest.admissions.sat_scores.25th_percentile.math',
          higherIsBetter: null,
        },
        {
          metric: 'SAT Math 75th Pct',
          key: 'latest.admissions.sat_scores.75th_percentile.math',
          higherIsBetter: null,
        },
        {
          metric: 'ACT 25th Pct',
          key: 'latest.admissions.act_scores.25th_percentile.cumulative',
          higherIsBetter: null,
        },
        {
          metric: 'ACT 75th Pct',
          key: 'latest.admissions.act_scores.75th_percentile.cumulative',
          higherIsBetter: null,
        },
        {
          metric: 'Enrollment',
          key: 'latest.student.size',
          unit: 'students',
          higherIsBetter: null,
        },
      ],
      outcomes: [
        {
          metric: 'Completion Rate',
          key: 'latest.completion.rate_suppressed.overall',
          unit: '%',
          higherIsBetter: true,
        },
        {
          metric: 'Median Earnings (6yr)',
          key: 'latest.earnings.6_yrs_after_entry.median',
          unit: '$',
          higherIsBetter: true,
        },
        {
          metric: 'Median Earnings (10yr)',
          key: 'latest.earnings.10_yrs_after_entry.median',
          unit: '$',
          higherIsBetter: true,
        },
        {
          metric: '3-Year Repayment Progress',
          key: 'latest.repayment.repayment_cohort.3_year_declining_balance',
          unit: '%',
          higherIsBetter: true,
          note: LEGACY_REPAYMENT_3YR_NOTE,
        },
        {
          metric: 'Median Debt at Graduation',
          key: 'latest.aid.median_debt.completers.overall',
          unit: '$',
          higherIsBetter: false,
        },
      ],
      aid: [
        {
          metric: 'Pell Grant Rate',
          key: 'latest.aid.pell_grant_rate',
          unit: '%',
          higherIsBetter: null,
          note: 'Share of students receiving Pell grants',
        },
        {
          metric: 'Federal Loan Rate',
          key: 'latest.aid.federal_loan_rate',
          unit: '%',
          higherIsBetter: null,
        },
        {
          metric: 'Median Debt at Graduation',
          key: 'latest.aid.median_debt.completers.overall',
          unit: '$',
          higherIsBetter: false,
        },
        {
          metric: '3-Year Repayment Progress',
          key: 'latest.repayment.repayment_cohort.3_year_declining_balance',
          unit: '%',
          higherIsBetter: true,
          note: LEGACY_REPAYMENT_3YR_NOTE,
        },
        {
          metric: 'Avg Net Price (overall)',
          key: 'latest.cost.avg_net_price.overall',
          unit: '$',
          higherIsBetter: false,
        },
      ],
    };

    const metrics = metricsByTopic[input.topic];
    let hasUnrankedPooledRow = false;
    let hasMixedPriceRow = false;
    const rows: z.infer<typeof ComparisonRowSchema>[] = metrics.map((m) => {
      const lookupKeys = m.keys ?? [m.key];
      const rawValues = found.map((s) => {
        const r = byId.get(String(s.id));
        if (!r) return { school_id: s.id, ...readMetric(undefined) };
        if (m.price) {
          const costs = institutionCosts(r);
          return {
            school_id: s.id,
            ...readMetric(
              m.price === 'tuition' ? costs.effective_tuition : costs.cost_of_attendance,
            ),
            basis: m.price === 'tuition' ? costs.tuition_basis : costs.attendance_basis,
          };
        }
        for (const k of lookupKeys) {
          const raw = r[k];
          if (raw != null) return { school_id: s.id, ...readMetric(raw) };
        }
        return { school_id: s.id, ...readMetric(undefined) };
      });

      const pooled =
        m.key.startsWith('latest.earnings.') ||
        m.key.startsWith('latest.repayment.') ||
        m.key === 'latest.aid.median_debt.completers.overall';
      const mixedBasis =
        m.price != null &&
        new Set(
          rawValues.flatMap((value) =>
            'basis' in value && value.basis != null ? [value.basis] : [],
          ),
        ).size > 1;
      const { higherIsBetter } = m;
      const descriptive = higherIsBetter === null;
      hasUnrankedPooledRow ||= pooled && sharedOpeid;
      hasMixedPriceRow ||= mixedBasis;
      const contextNote = pooled
        ? `OPEID6-pooled outcome.${sharedOpeid ? ' Shared OPEID6 identifiers make this entire row unranked.' : ''}`
        : mixedBasis
          ? 'Academic-year and program-year prices use different periods; this entire row is unranked.'
          : undefined;
      const ranks =
        descriptive || singleton || (pooled && sharedOpeid) || mixedBasis
          ? undefined
          : computeRanks(
              rawValues.map((metric) => metric.value),
              higherIsBetter,
            );
      const note = [
        m.note,
        contextNote,
        descriptive
          ? 'Descriptive metric; no shared student preference defines a best value.'
          : undefined,
        singleton
          ? 'Only one distinct school was found; comparison ranks require at least two.'
          : undefined,
      ]
        .filter(Boolean)
        .join(' ');

      return {
        metric: m.metric,
        values: rawValues.map((rv, i) => {
          const rk = ranks?.[i];
          return {
            school_id: rv.school_id,
            ...('basis' in rv && rv.basis != null && { basis: rv.basis }),
            ...(rv.value != null ? { value: rv.value } : {}),
            ...(rk != null ? { rank: rk } : {}),
            suppressed: rv.availability === 'privacy_suppressed',
            availability: rv.availability,
          };
        }),
        ...(m.unit && { unit: m.unit }),
        ...(note && { note }),
      };
    });

    // Build a brief summary of the most notable differences
    const bestByMetric: string[] = [];
    for (const row of rows) {
      const leaders = row.values.filter((value) => value.rank === 1);
      if (leaders.length === 0) continue;
      const names = leaders.map(
        ({ school_id }) => byId.get(String(school_id))?.['school.name'] ?? '(Not found)',
      );
      bestByMetric.push(
        `${names.join(' and ')} ${leaders.length > 1 ? 'tie for best' : 'leads'} on ${row.metric}`,
      );
      if (bestByMetric.length === 3) break;
    }

    const rankingNotes: string[] = [];
    if (singleton)
      notices.push(
        'Only one distinct school was found; values are shown without ranks or a leader summary.',
      );
    if (metrics.some((metric) => metric.higherIsBetter === null))
      notices.push('Descriptive admissions and aid participation metrics are unranked.');
    if (hasUnrankedPooledRow)
      rankingNotes.push('Shared OPEID6 outcomes are unranked for the entire pooled metric row.');
    if (hasMixedPriceRow)
      rankingNotes.push('Mixed academic-year and program-year price rows are unranked.');
    notices.push(...rankingNotes);
    if (notices.length) ctx.enrich.notice(notices.join(' '));
    const summary = bestByMetric.length ? [...bestByMetric, ...rankingNotes].join('; ') : undefined;

    return {
      schools: found,
      missing_ids,
      unprocessed_ids,
      topic: input.topic,
      rows,
      ...(summary && { summary }),
    };
  },

  format: (result) => {
    // Build a lookup: school_id → school name for readable cell headers
    const schoolById = new Map(result.schools.map((s) => [s.id, s.name]));

    const lines = [
      `## School Comparison: ${result.topic}`,
      `**Schools:** ${result.schools.map((s) => `${escapeMarkdownInline(s.name)} (ID: ${s.id})`).join(', ')}`,
    ];
    if (result.summary) lines.push(`\n**Summary:** ${escapeMarkdownInline(result.summary)}`);
    if (result.missing_ids) lines.push(`Missing IDs: ${result.missing_ids.join(', ') || 'None'}`);
    if (result.unprocessed_ids)
      lines.push(`Unprocessed IDs: ${result.unprocessed_ids.join(', ') || 'None'}`);
    for (const school of result.schools) {
      if (school.operating != null)
        lines.push(`School ${school.id} ${formatOperatingCertification(school.operating)}`);
      if (school.ope6_id != null)
        lines.push(`School ${school.id} OPEID6: ${escapeMarkdownInline(school.ope6_id)}`);
      if (school.metric_scope)
        lines.push(`School ${school.id} metric scope: ${JSON.stringify(school.metric_scope)}`);
    }

    for (const row of result.rows) {
      const unitNote = row.unit ? ` (${row.unit})` : '';
      const noteText = row.note ? ` — ${row.note}` : '';
      lines.push(`\n**${row.metric}${unitNote}${noteText}**`);

      for (const v of row.values) {
        const schoolName = schoolById.get(v.school_id) ?? `School ${v.school_id}`;
        let valueDisplay: string;
        if (v.value != null) {
          const val = v.value;
          if (row.unit === '$') valueDisplay = `$${val.toLocaleString()}`;
          else if (row.unit === '%') valueDisplay = `${(val * 100).toFixed(1)}%`;
          else if (row.unit === 'students') valueDisplay = val.toLocaleString();
          else valueDisplay = String(val);
        } else {
          valueDisplay = 'N/A';
        }
        const rankDisplay = v.rank != null ? `#${v.rank}` : 'N/A';
        lines.push(
          `  ${escapeMarkdownInline(schoolName)}: ${valueDisplay} (${rankDisplay})${v.value != null ? ` | Reported value: ${v.value}` : ''} | Availability: ${v.availability} | Suppressed: ${v.suppressed}${v.basis != null ? ` | Basis: ${v.basis}` : ''}`,
        );
      }
    }
    return [{ type: 'text', text: lines.join('\n') }];
  },
});
