/**
 * @fileoverview Field catalog search tool. Searches the embedded Scorecard field dictionary.
 * No API call — served entirely from static embedded data.
 * @module mcp-server/tools/definitions/list-fields.tool
 */

import { tool, z } from '@cyanheads/mcp-ts-core';
import { JsonRpcErrorCode } from '@cyanheads/mcp-ts-core/errors';
import { searchFieldCatalog } from '@/data/field-catalog.js';

export const listFieldsTool = tool('scorecard_list_fields', {
  title: 'List Scorecard Fields',
  description:
    'Search the College Scorecard field catalog by keyword. Returns matching field paths, descriptions, data types, and whether each field supports API-side sorting. Use before passing custom field paths to the fields parameter on scorecard_search_schools or scorecard_get_school to verify a path is valid. Served entirely from embedded static data — no API call, no rate limit impact.',
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },

  input: z.object({
    query: z
      .string()
      .min(1)
      .describe(
        'Keyword to search the field catalog (e.g. "tuition", "earnings", "admissions", "debt"). Matches against field paths, descriptions, and category names.',
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(30)
      .describe('Maximum number of matching fields to return.'),
  }),

  output: z.object({
    query: z.string().describe('The search query used.'),
    results: z
      .array(
        z
          .object({
            path: z.string().describe('Full API field path (e.g. "latest.cost.tuition.in_state").'),
            description: z.string().describe('Human-readable description of the field.'),
            type: z.string().describe('Data type: integer, float, string, or boolean.'),
            sortable: z.boolean().describe('Whether this field supports API-side sort parameter.'),
            category: z
              .string()
              .describe('Thematic category (e.g. cost, admissions, earnings, programs).'),
          })
          .describe('Field catalog entry.'),
      )
      .describe('Matching field entries ranked by relevance.'),
    totalMatches: z.number().describe('Number of matching fields found.'),
    tip: z.string().optional().describe('Usage tip for unsortable fields when relevant.'),
  }),

  enrichment: {
    truncated: z.boolean().describe('True when results were capped at the limit.'),
    shown: z.number().describe('Number of fields returned.'),
    cap: z.number().describe('The limit that was applied.'),
  },

  errors: [
    {
      reason: 'no_match',
      code: JsonRpcErrorCode.NotFound,
      when: 'No fields matched the search query.',
      recovery: 'Try a broader category keyword like "cost", "earnings", "admissions", or "aid".',
    },
  ],

  handler(input, ctx) {
    ctx.log.info('Searching field catalog', { query: input.query });
    const results = searchFieldCatalog(input.query, input.limit);

    if (results.length === 0) {
      throw ctx.fail('no_match', `No fields matched "${input.query}"`, {
        recovery: { hint: `Try broader terms like "cost", "earnings", "aid", or "admissions".` },
      });
    }

    if (results.length >= input.limit) {
      ctx.enrich.truncated({
        shown: results.length,
        cap: input.limit,
        guidance: `Field list capped at ${input.limit} — narrow the query or raise limit (max 100) to see more.`,
      });
    }

    const hasUnsortable = results.some((r) => !r.sortable);
    const tip = hasUnsortable
      ? 'Fields where sortable=false are not indexed by the API — pass them in the fields parameter for retrieval but do not use them in the sort parameter.'
      : undefined;

    return {
      query: input.query,
      results: results.map((r) => ({
        path: r.path,
        description: r.description,
        type: r.type,
        sortable: r.sortable,
        category: r.category,
      })),
      totalMatches: results.length,
      ...(tip && { tip }),
    };
  },

  format: (result) => {
    const lines = [
      `## Scorecard Field Catalog: "${result.query}"`,
      `**Matches:** ${result.totalMatches}`,
    ];
    if (result.tip) lines.push(`\n> **Tip:** ${result.tip}`);
    for (const f of result.results) {
      lines.push(`\n**${f.path}**`);
      lines.push(`${f.description}`);
      lines.push(
        `Type: ${f.type} | Category: ${f.category} | Sortable: ${f.sortable ? 'Yes' : 'No'}`,
      );
    }
    return [{ type: 'text', text: lines.join('\n') }];
  },
});
