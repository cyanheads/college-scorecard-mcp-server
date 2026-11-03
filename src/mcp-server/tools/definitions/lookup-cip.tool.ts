/**
 * @fileoverview CIP code lookup tool. Searches the embedded CIP taxonomy by keyword.
 * No API call — served entirely from static embedded data.
 * @module mcp-server/tools/definitions/lookup-cip.tool
 */

import { tool, z } from '@cyanheads/mcp-ts-core';
import { escapeMarkdownInline, markdown } from '@cyanheads/mcp-ts-core/utils';
import { searchCipCodes } from '@/data/cip-codes.js';

export const lookupCipTool = tool('scorecard_lookup_cip', {
  title: 'Lookup CIP Code',
  description:
    'Search the Classification of Instructional Programs (CIP) taxonomy by keyword or partial name. Returns matching CIP codes with standard titles. Use this before passing cip_code filters to scorecard_search_programs or scorecard_get_programs when you know a program by name but not its code. Served entirely from embedded static data — no API call, no rate limit impact.',
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },

  input: z.object({
    query: z
      .string()
      .trim()
      .min(1)
      .describe(
        'Search term — program name keyword (e.g. "computer science", "nursing", "business"). Matches against CIP titles and family names.',
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(1000)
      .default(20)
      .describe('Requested limit; serving cap 50, hard ceiling 1,000.'),
    offset: z
      .number()
      .int()
      .min(0)
      .max(Number.MAX_SAFE_INTEGER)
      .default(0)
      .describe('Zero-based offset into the complete relevance-ordered matches.'),
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
    offset: z.number().describe('Zero-based offset of this result page.'),
    nextOffset: z
      .number()
      .optional()
      .describe('Offset to request next; absent when no matches remain.'),
  }),

  enrichment: {
    notice: z.string().optional().describe('No-match guidance.'),
    guidance: z.string().optional().describe('Concrete narrowing guidance when matches remain.'),
    queryContext: z
      .object({
        query: z.string().describe('Normalized query.'),
        limit: z.number().describe('Applied limit.'),
        offset: z.number().describe('Applied zero-based offset.'),
      })
      .describe('Effective selectors.'),
    truncated: z.boolean().describe('True when results were capped at the limit.'),
    shown: z.number().describe('Number of CIP codes returned.'),
    cap: z.number().describe('The limit that was applied.'),
  },
  enrichmentTrailer: {
    queryContext: {
      render: (value) => markdown().codeBlock(JSON.stringify(value), 'json').build(),
    },
  },

  handler(input, ctx) {
    input = {
      ...input,
      query: /^\d{4}$/.test(input.query)
        ? `${input.query.slice(0, 2)}.${input.query.slice(2)}`
        : input.query,
    };
    ctx.log.info('Searching CIP codes', { query: input.query });
    const matches = searchCipCodes(input.query, Number.POSITIVE_INFINITY);
    const cap = Math.min(input.limit, 50);
    const results = matches.slice(input.offset, input.offset + cap);
    const nextOffset =
      input.offset + results.length < matches.length ? input.offset + results.length : undefined;
    ctx.enrich({
      truncated: false,
      shown: results.length,
      cap,
      queryContext: { query: input.query, limit: cap, offset: input.offset },
    });
    if (!matches.length)
      ctx.enrich.notice('No CIP codes matched. Try computer, health, or business.');
    if (nextOffset !== undefined) {
      ctx.enrich.truncated({
        shown: results.length,
        cap,
        guidance: `Narrow to a discipline or request offset ${nextOffset} with the same query for the next page.`,
      });
    }

    return {
      query: input.query,
      results,
      totalMatches: matches.length,
      offset: input.offset,
      ...(nextOffset !== undefined && { nextOffset }),
    };
  },

  format: (result) => {
    const lines = [
      `CIP Code Lookup: "${escapeMarkdownInline(result.query)}"`,
      `**Matches:** ${result.totalMatches}`,
      `**Offset:** ${result.offset}`,
    ];
    if (result.nextOffset !== undefined) lines.push(`**Next offset:** ${result.nextOffset}`);
    for (const entry of result.results) {
      lines.push(
        `\n**${escapeMarkdownInline(entry.code)}** — ${escapeMarkdownInline(entry.title)}`,
      );
      lines.push(
        `Family: ${escapeMarkdownInline(entry.family)} ${escapeMarkdownInline(entry.familyTitle)}`,
      );
    }
    return [{ type: 'text', text: lines.join('\n') }];
  },
});
