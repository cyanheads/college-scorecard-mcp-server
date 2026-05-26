/**
 * @fileoverview School comparison prompt. Structures a multi-school comparison analysis
 * using Scorecard data.
 * @module mcp-server/prompts/definitions/compare.prompt
 */

import { prompt, z } from '@cyanheads/mcp-ts-core';

export const comparePrompt = prompt('scorecard_compare_prompt', {
  description:
    'Structures a multi-school comparison analysis using College Scorecard data. Provide comma-separated school names and a focus area (costs, outcomes, or programs) to generate a research-ready comparison framework.',
  args: z.object({
    school_names: z
      .string()
      .describe(
        'Comma-separated list of school names to compare (e.g. "University of Washington, University of Oregon, Oregon State University").',
      ),
    focus: z
      .enum(['costs', 'outcomes', 'programs'])
      .describe(
        'Comparison focus: costs (tuition, net price, debt), outcomes (earnings, completion, repayment), or programs (program-level earnings by field of study).',
      ),
  }),
  generate: (args) => {
    const schools = args.school_names.split(',').map((s) => s.trim());
    const focusGuide: Record<string, string> = {
      costs:
        'net price by income bracket, median debt, tuition (in-state and out-of-state), and total cost of attendance',
      outcomes:
        'graduation rates, median earnings at 6 and 10 years, 3-year loan repayment rate, and debt-to-earnings ratio',
      programs:
        'program-level 1-year post-graduation median earnings by CIP code, median debt per program, and enrollment',
    };
    const guide = focusGuide[args.focus] ?? args.focus;

    return [
      {
        role: 'user',
        content: {
          type: 'text',
          text: [
            `Compare the following schools on ${args.focus}: ${schools.join(', ')}.`,
            '',
            `Focus the analysis on: ${guide}.`,
            '',
            'Steps:',
            `1. Use scorecard_search_schools to find the unit IDs for each school.`,
            `2. Use scorecard_compare_schools with the topic "${args.focus}" to get a normalized side-by-side comparison.`,
            `3. For deeper context, use scorecard_get_school to retrieve full profiles.`,
            ...(args.focus === 'programs'
              ? [
                  `4. Use scorecard_get_programs for program-level earnings at each school.`,
                  `5. Use scorecard_lookup_cip if you need to find CIP codes for specific fields of study.`,
                ]
              : [
                  `4. Use scorecard_value_analysis for ROI metrics (debt-to-earnings ratio, net price by income bracket).`,
                ]),
            '',
            `Present a clear comparison table with ranks within this set, followed by a brief interpretation of the most meaningful differences.`,
          ].join('\n'),
        },
      },
    ];
  },
});
