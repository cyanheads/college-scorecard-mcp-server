/**
 * @fileoverview Cross-institution program search tool. Finds programs by CIP code or keyword
 * across all institutions, ranked by median earnings.
 * @module mcp-server/tools/definitions/search-programs.tool
 */

import { tool, z } from '@cyanheads/mcp-ts-core';
import { JsonRpcErrorCode } from '@cyanheads/mcp-ts-core/errors';
import { ownershipLabel } from '@/mcp-server/format-helpers.js';
import { getScorecardService } from '@/services/scorecard/scorecard-service.js';

const ProgramResultSchema = z.object({
  school_id: z.number().describe('School unit ID — use for follow-up calls.'),
  school_name: z.string().describe('Institution name.'),
  school_state: z.string().optional().describe('State code.'),
  school_ownership: z.string().describe('Control type: Public, Private nonprofit, or For-profit.'),
  net_price_overall: z.number().optional().describe('Average net price at this school.'),
  program_code: z.string().describe('4-digit CIP program code.'),
  program_title: z.string().optional().describe('Program title.'),
  earnings_1yr_median: z
    .number()
    .optional()
    .describe(
      'Median earnings of graduates working and not enrolled 1 year after their highest credential.',
    ),
  median_debt: z
    .number()
    .optional()
    .describe(
      'Median cumulative Stafford/Grad PLUS borrowing among completers across attended institutions at the same academic level.',
    ),
  ipeds_awards_year1: z
    .number()
    .optional()
    .describe(
      'IPEDS awards in year 1 of the pooled debt cohort; awards, not enrollment or unique students.',
    ),
  ipeds_awards_year2: z
    .number()
    .optional()
    .describe(
      'IPEDS awards in year 2 of the pooled debt cohort; awards, not enrollment or unique students.',
    ),
  suppressed: z.boolean().describe('True when earnings are suppressed due to small cohort.'),
});

export const searchProgramsTool = tool('scorecard_search_programs', {
  title: 'Search Programs',
  description:
    'Find programs by CIP code across institutions, ranked by median earnings within the fetched school page. Accepts school-side filters (state, ownership, max cost). Minimum earnings is applied locally; totals and pagination count schools before local program filtering. Use scorecard_lookup_cip to convert program names to CIP codes. Returns school names and IDs alongside program earnings, cumulative Stafford/Grad PLUS debt, and IPEDS awards for follow-up calls to scorecard_get_school or scorecard_get_programs.',
  annotations: { readOnlyHint: true, openWorldHint: true },

  input: z.object({
    cip_code: z
      .string()
      .optional()
      .describe(
        'CIP 4-digit code to search for (e.g. "11.07" for Computer Science). Use scorecard_lookup_cip to find codes.',
      ),
    program_name: z
      .string()
      .optional()
      .describe(
        'Case-insensitive title substring matched within the fetched school page. Ignored when cip_code is provided; use cip_code for upstream program matching.',
      ),
    state: z
      .string()
      .length(2)
      .optional()
      .describe('Restrict to schools in this state (two-letter code).'),
    ownership: z
      .number()
      .int()
      .min(1)
      .max(3)
      .optional()
      .describe('Restrict to school type: 1=public, 2=private nonprofit, 3=for-profit.'),
    max_net_price: z.number().optional().describe('Maximum average net price at the school.'),
    min_earnings: z
      .number()
      .optional()
      .describe(
        'Minimum 1-year median earnings, inclusive. Filters this school page locally and excludes unavailable earnings; school totals are unchanged.',
      ),
    max_debt: z
      .number()
      .optional()
      .describe(
        'Maximum median cumulative Stafford/Grad PLUS debt across institutions at the same academic level, inclusive; excludes unavailable debt.',
      ),
    per_page: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(20)
      .describe('Schools per page (max 100); program rows may exceed this count.'),
    page: z.number().int().min(0).default(0).describe('Zero-indexed page number.'),
  }),

  output: z.object({
    total: z
      .number()
      .describe(
        'Total schools matching upstream filters, before pagination and local program filtering.',
      ),
    page: z.number().describe('Current page (zero-indexed).'),
    per_page: z.number().describe('Results per page used.'),
    programs: z
      .array(ProgramResultSchema.describe('Program result with school context.'))
      .describe(
        'Program results — multiple programs per school if school matches multiple CIP codes. Sorted by earnings descending (suppressed last).',
      ),
    total_programs: z.number().describe('Total programs returned across all result schools.'),
    suppressed_count: z.number().describe('Programs with suppressed earnings.'),
  }),

  enrichment: {
    totalCount: z
      .number()
      .describe(
        'Total schools matching upstream filters, before pagination and local program filtering.',
      ),
    truncated: z
      .boolean()
      .describe('True when school pagination metadata indicates a later page exists.'),
    shown: z.number().describe('Schools returned on this page.'),
    cap: z.number().describe('The per_page limit that was applied.'),
    notice: z
      .string()
      .optional()
      .describe('Recovery hint when no programs match or earnings data is unavailable.'),
  },

  errors: [
    {
      reason: 'api_error',
      code: JsonRpcErrorCode.ServiceUnavailable,
      when: 'The College Scorecard API returned an error.',
      recovery: 'Check SCORECARD_API_KEY validity and retry after a brief delay.',
      thrownBy: 'service',
    },
  ],

  async handler(input, ctx) {
    ctx.log.info('Searching programs', {
      cip_code: input.cip_code,
      state: input.state,
      page: input.page,
    });
    const service = getScorecardService();

    const response = await service.searchPrograms(
      {
        ...(input.cip_code && { cipCode: input.cip_code }),
        ...(input.state && { state: input.state }),
        ...(input.ownership != null && { ownership: input.ownership }),
        ...(input.max_net_price != null && { maxNetPrice: input.max_net_price }),
        ...(input.max_debt != null && { maxDebt: input.max_debt }),
        perPage: input.per_page,
        page: input.page,
      },
      ctx,
    );

    // Flatten: each school record may have multiple matching programs in the nested array
    const allPrograms: z.infer<typeof ProgramResultSchema>[] = [];
    for (const record of response.results) {
      const rawPrograms = record['latest.programs.cip_4_digit'] ?? [];
      // When cip_code filter applied, API returns only matching programs
      for (const p of rawPrograms) {
        // Apply program_name soft filter if cip_code not provided
        if (input.program_name && !input.cip_code) {
          const nameMatch = (p.title ?? '')
            .toLowerCase()
            .includes(input.program_name.toLowerCase());
          if (!nameMatch) continue;
        }

        const rawEarnings = p.earnings?.highest?.['1_yr']?.overall_median_earnings;
        const medianDebt = p.debt?.staff_grad_plus?.all?.all_inst?.median;
        const suppressed = rawEarnings == null;

        // Post-fetch earnings filter
        if (input.min_earnings != null && (rawEarnings == null || rawEarnings < input.min_earnings))
          continue;
        // Post-fetch debt filter
        if (input.max_debt != null && (medianDebt == null || medianDebt > input.max_debt)) continue;

        allPrograms.push({
          school_id: record.id ?? 0,
          school_name: record['school.name'] ?? 'Unknown',
          ...(record['school.state'] && { school_state: record['school.state'] }),
          school_ownership: ownershipLabel(record['school.ownership']),
          ...(record['latest.cost.avg_net_price.overall'] != null && {
            net_price_overall: record['latest.cost.avg_net_price.overall'] as number,
          }),
          program_code: p.code ?? 'Unknown',
          ...(p.title && { program_title: p.title }),
          ...(rawEarnings != null && { earnings_1yr_median: rawEarnings }),
          ...(medianDebt != null && { median_debt: medianDebt }),
          ...(p.counts?.ipeds_awards1 != null && { ipeds_awards_year1: p.counts.ipeds_awards1 }),
          ...(p.counts?.ipeds_awards2 != null && { ipeds_awards_year2: p.counts.ipeds_awards2 }),
          suppressed,
        });
      }
    }

    // Sort: earnings descending, suppressed last
    allPrograms.sort((a, b) => {
      if (a.suppressed && !b.suppressed) return 1;
      if (!a.suppressed && b.suppressed) return -1;
      return (b.earnings_1yr_median ?? 0) - (a.earnings_1yr_median ?? 0);
    });

    const suppressed_count = allPrograms.filter((p) => p.suppressed).length;

    const { total, page, per_page } = response.metadata;
    const truncated = (page + 1) * per_page < total;
    ctx.enrich.total(total);
    ctx.enrich({ truncated, shown: response.results.length, cap: per_page });
    const notices: string[] = [];
    if (allPrograms.length === 0) {
      notices.push(
        'No programs matched the applied filters on this school page. Try removing min_earnings, max_debt, or max_net_price constraints, or use scorecard_lookup_cip to find the correct CIP code.',
      );
    } else if (suppressed_count === allPrograms.length) {
      notices.push(
        `All ${allPrograms.length} programs have suppressed earnings data. Try a broader CIP code or different state.`,
      );
    }
    if (truncated) {
      notices.push(
        `More schools match the upstream filters. Request page ${page + 1} or raise per_page (max 100) for more.`,
      );
    }
    if (notices.length > 0) ctx.enrich.notice(notices.join(' '));

    return {
      total: response.metadata.total,
      page: response.metadata.page,
      per_page: response.metadata.per_page,
      programs: allPrograms,
      total_programs: allPrograms.length,
      suppressed_count,
    };
  },

  format: (result) => {
    const lines = [
      `## Program Search Results`,
      `**Schools Matched:** ${result.total} | **Programs:** ${result.total_programs} | **Suppressed:** ${result.suppressed_count}`,
      `**Page:** ${result.page} | **Per Page:** ${result.per_page}`,
    ];
    for (const p of result.programs) {
      lines.push(`\n**${p.program_code}** — ${p.program_title ?? 'Unknown'}`);
      lines.push(
        `School: ${p.school_name} (ID: ${p.school_id}) | ${p.school_ownership}${p.school_state ? ` | ${p.school_state}` : ''}`,
      );
      if (p.net_price_overall != null)
        lines.push(`Net Price: $${p.net_price_overall.toLocaleString()}`);
      lines.push(
        `1-Year Earnings (median): ${p.earnings_1yr_median != null ? `$${p.earnings_1yr_median.toLocaleString()}` : p.suppressed ? 'Suppressed (small cohort)' : 'Not available'}`,
      );
      if (p.median_debt != null)
        lines.push(
          `Median Cumulative Stafford/Grad PLUS Debt (all institutions, same academic level): $${p.median_debt.toLocaleString()}`,
        );
      if (p.ipeds_awards_year1 != null)
        lines.push(`IPEDS Awards (debt cohort year 1): ${p.ipeds_awards_year1.toLocaleString()}`);
      if (p.ipeds_awards_year2 != null)
        lines.push(`IPEDS Awards (debt cohort year 2): ${p.ipeds_awards_year2.toLocaleString()}`);
    }
    return [{ type: 'text', text: lines.join('\n') }];
  },
});
