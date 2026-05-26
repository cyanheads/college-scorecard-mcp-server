/**
 * @fileoverview CIP code lookup tool. Searches the embedded CIP taxonomy by keyword.
 * No API call — served entirely from static embedded data.
 * @module mcp-server/tools/definitions/lookup-cip.tool
 */

import { tool, z } from '@cyanheads/mcp-ts-core';
import { JsonRpcErrorCode } from '@cyanheads/mcp-ts-core/errors';
import { searchCipCodes } from '@/data/cip-codes.js';

export const lookupCipTool = tool('scorecard_lookup_cip', {
  title: 'Lookup CIP Code',
  description:
    'Search the Classification of Instructional Programs (CIP) taxonomy by keyword or partial name. Returns matching CIP codes with standard titles. Use this before passing cip_code filters to scorecard_search_programs or scorecard_get_programs when you know a program by name but not its code. Served entirely from embedded static data — no API call, no rate limit impact.',
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },

  input: z.object({
    query: z
      .string()
      .min(1)
      .describe(
        'Search term — program name keyword (e.g. "computer science", "nursing", "business"). Matches against CIP titles and family names.',
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(20)
      .describe('Maximum number of matching codes to return.'),
  }),

  output: z.object({
    query: z.string().describe('The search query used.'),
    results: z
      .array(
        z
          .object({
            code: z.string().describe('4-digit CIP code (e.g. "11.07").'),
            title: z.string().describe('Standard program title.'),
            family: z.string().describe('2-digit CIP family code.'),
            familyTitle: z.string().describe('Name of the CIP family/discipline.'),
          })
          .describe('CIP taxonomy entry.'),
      )
      .describe('Matching CIP entries ranked by relevance.'),
    totalMatches: z.number().describe('Number of matches found.'),
  }),

  errors: [
    {
      reason: 'no_match',
      code: JsonRpcErrorCode.NotFound,
      when: 'No CIP codes matched the search query.',
      recovery:
        'Try a broader keyword — use the discipline name rather than a specific subdiscipline.',
    },
  ],

  handler(input, ctx) {
    ctx.log.info('Searching CIP codes', { query: input.query });
    const results = searchCipCodes(input.query, input.limit);

    if (results.length === 0) {
      throw ctx.fail('no_match', `No CIP codes matched "${input.query}"`, {
        recovery: { hint: `Try a broader term like "computer", "health", or "business".` },
      });
    }

    return {
      query: input.query,
      results,
      totalMatches: results.length,
    };
  },

  format: (result) => {
    const lines = [`## CIP Code Lookup: "${result.query}"`, `**Matches:** ${result.totalMatches}`];
    for (const entry of result.results) {
      lines.push(`\n**${entry.code}** — ${entry.title}`);
      lines.push(`Family: ${entry.family} ${entry.familyTitle}`);
    }
    return [{ type: 'text', text: lines.join('\n') }];
  },
});
