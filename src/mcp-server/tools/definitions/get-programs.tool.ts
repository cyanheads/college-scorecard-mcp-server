/**
 * @fileoverview Program outcomes tool. Returns all field-of-study programs at one school
 * with earnings, debt, and enrollment figures.
 * @module mcp-server/tools/definitions/get-programs.tool
 */

import { tool, z } from '@cyanheads/mcp-ts-core';
import { JsonRpcErrorCode } from '@cyanheads/mcp-ts-core/errors';
import { getScorecardService } from '@/services/scorecard/scorecard-service.js';

const credentialLabel = (v: number | null | undefined): string => {
  if (v == null) return 'Unknown';
  const map: Record<number, string> = {
    1: 'Certificate',
    2: "Associate's",
    3: "Bachelor's",
    6: 'Post-baccalaureate certificate',
    7: "Master's",
    8: 'Doctoral',
    17: 'Professional',
  };
  return map[v] ?? String(v);
};

const ProgramSchema = z.object({
  code: z.string().describe('4-digit CIP program code.'),
  title: z.string().optional().describe('Program title.'),
  credential_level: z.string().describe('Degree/credential level.'),
  earnings_1yr_median: z.number().optional().describe('Median earnings 1 year after graduation.'),
  earnings_count: z.number().optional().describe('Number of Title IV students in earnings cohort.'),
  median_debt: z.number().optional().describe('Median debt at graduation.'),
  enrollment: z.number().optional().describe('IPEDS enrollment count.'),
  suppressed: z
    .boolean()
    .describe('True when earnings data is suppressed due to small cohort (FERPA).'),
  suppression_note: z
    .string()
    .optional()
    .describe('Explains data suppression when suppressed=true.'),
});

export const getProgramsTool = tool('scorecard_get_programs', {
  title: 'Get School Programs',
  description:
    'All field-of-study programs at one school with 1-year post-graduation earnings (P25/median/P75), debt at graduation, and enrollment figures. This is the primary source for program-level earnings — institution-level 6/8/10-year earnings are available via scorecard_get_earnings. Earnings may be suppressed (null) for programs with small cohorts due to FERPA privacy protection; suppressed=true flags this explicitly. Use scorecard_lookup_cip to find CIP codes by name.',
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },

  input: z.object({
    id: z
      .union([
        z.string().describe('School unit ID as string.'),
        z.number().describe('School unit ID as number.'),
      ])
      .describe('School unit ID from scorecard_search_schools.'),
    cip_code: z
      .string()
      .optional()
      .describe(
        'Filter to a specific 4-digit CIP code (e.g. "11.07" for Computer Science). Returns only this program.',
      ),
    min_earnings: z
      .number()
      .optional()
      .describe('Minimum 1-year post-graduation median earnings filter.'),
    credential_level: z
      .number()
      .int()
      .optional()
      .describe(
        'Filter by credential level: 1=certificate, 2=associate, 3=bachelor, 6=post-bac cert, 7=master, 8=doctoral, 17=professional.',
      ),
  }),

  output: z.object({
    school_id: z.number().describe('School unit ID.'),
    school_name: z.string().describe('Institution name.'),
    programs: z
      .array(ProgramSchema.describe('Program outcome record.'))
      .describe(
        'All programs at this school matching the filters. Sorted by median earnings descending (suppressed programs at end).',
      ),
    total: z.number().describe('Total programs returned after filtering.'),
    suppressed_count: z
      .number()
      .describe('Number of programs with earnings suppressed due to small cohort.'),
    notice: z
      .string()
      .optional()
      .describe('Guidance when no programs match the filters or all data is suppressed.'),
  }),

  errors: [
    {
      reason: 'school_not_found',
      code: JsonRpcErrorCode.NotFound,
      when: 'No school record found for the requested ID.',
      recovery: 'Verify the school ID using scorecard_search_schools and retry.',
    },
    {
      reason: 'no_programs',
      code: JsonRpcErrorCode.NotFound,
      when: 'No programs matched the filters at this school.',
      recovery: 'Remove the cip_code or min_earnings filter and retry to see all programs.',
    },
    {
      reason: 'api_error',
      code: JsonRpcErrorCode.ServiceUnavailable,
      when: 'The College Scorecard API returned an error.',
      recovery: 'Check SCORECARD_API_KEY validity and retry after a brief delay.',
    },
  ],

  async handler(input, ctx) {
    ctx.log.info('Fetching school programs', { id: input.id, cip_code: input.cip_code });
    const service = getScorecardService();

    const response = await service.getSchoolPrograms(
      input.id,
      input.cip_code,
      input.min_earnings,
      input.credential_level,
      ctx,
    );

    const record = response.results[0];
    if (!record) {
      throw ctx.fail('school_not_found', `No school record found for ID ${input.id}.`, {
        id: input.id,
        recovery: { hint: 'Search for valid school IDs with scorecard_search_schools.' },
      });
    }

    const rawPrograms = record['latest.programs.cip_4_digit'] ?? [];

    // Filter programs by client-supplied criteria
    let filtered = rawPrograms;
    if (input.cip_code) {
      filtered = filtered.filter((p) => p.code === input.cip_code);
    }
    if (input.credential_level != null) {
      filtered = filtered.filter((p) => p.credential_level === input.credential_level);
    }

    const programs = filtered.map((p): z.infer<typeof ProgramSchema> => {
      const rawEarnings = p.earnings?.highest?.['1_yr']?.overall_median_earnings;
      const suppressed = rawEarnings == null;
      return {
        code: p.code ?? 'Unknown',
        ...(p.title && { title: p.title }),
        credential_level: credentialLabel(p.credential_level),
        ...(rawEarnings != null && { earnings_1yr_median: rawEarnings }),
        ...(p.earnings?.highest?.['1_yr']?.overall_count_titleiv != null && {
          earnings_count: p.earnings.highest['1_yr'].overall_count_titleiv as number,
        }),
        ...(p.debt?.median_debt != null && { median_debt: p.debt.median_debt }),
        ...(p.counts?.ipeds_enrollment != null && { enrollment: p.counts.ipeds_enrollment }),
        suppressed,
        ...(suppressed && {
          suppression_note:
            'Earnings data suppressed — cohort too small to report under FERPA privacy rules.',
        }),
      };
    });

    // Apply min_earnings filter after normalization (post-fetch)
    const minEarnings = input.min_earnings;
    const earningsFiltered =
      minEarnings != null
        ? programs.filter((p) => !p.suppressed && (p.earnings_1yr_median ?? 0) >= minEarnings)
        : programs;

    if (earningsFiltered.length === 0) {
      const hint =
        filtered.length > 0
          ? 'Lower the min_earnings threshold or remove it to see all programs.'
          : 'Remove the cip_code or credential_level filter to see all available programs.';
      throw ctx.fail(
        'no_programs',
        `No programs found at school ${input.id} matching the filters.`,
        {
          recovery: { hint },
        },
      );
    }

    // Sort: programs with earnings first, descending by earnings
    const sorted = earningsFiltered.sort((a, b) => {
      if (a.suppressed && !b.suppressed) return 1;
      if (!a.suppressed && b.suppressed) return -1;
      return (b.earnings_1yr_median ?? 0) - (a.earnings_1yr_median ?? 0);
    });

    const suppressed_count = sorted.filter((p) => p.suppressed).length;
    const notice =
      suppressed_count > 0
        ? `${suppressed_count} of ${sorted.length} programs have suppressed earnings due to small cohorts (FERPA). These are listed last.`
        : undefined;

    return {
      school_id: record.id ?? Number(input.id),
      school_name: record['school.name'] ?? 'Unknown',
      programs: sorted,
      total: sorted.length,
      suppressed_count,
      ...(notice && { notice }),
    };
  },

  format: (result) => {
    const lines = [
      `## Programs at ${result.school_name} (ID: ${result.school_id})`,
      `**Total:** ${result.total} | **Suppressed:** ${result.suppressed_count}`,
    ];
    if (result.notice) lines.push(`\n> ${result.notice}`);
    for (const p of result.programs) {
      lines.push(`\n**${p.code}** — ${p.title ?? 'Unknown title'} (${p.credential_level})`);
      lines.push(
        `1-Year Earnings (median): ${p.earnings_1yr_median != null ? `$${p.earnings_1yr_median.toLocaleString()}` : p.suppressed ? 'Suppressed (small cohort, FERPA)' : 'Not available'}`,
      );
      if (p.suppression_note != null) lines.push(`Suppression note: ${p.suppression_note}`);
      if (p.median_debt != null) lines.push(`Median Debt: $${p.median_debt.toLocaleString()}`);
      if (p.enrollment != null) lines.push(`Enrollment: ${p.enrollment.toLocaleString()}`);
      if (p.earnings_count != null) lines.push(`Earnings Cohort: ${p.earnings_count} students`);
    }
    return [{ type: 'text', text: lines.join('\n') }];
  },
});
