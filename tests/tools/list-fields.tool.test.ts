/**
 * @fileoverview Tests for the listFields tool.
 * @module tests/tools/list-fields.tool.test
 */

import { createMockContext, getEnrichment, runToolContract } from '@cyanheads/mcp-ts-core/testing';
import { describe, expect, it } from 'vitest';
import { listFieldsTool } from '@/mcp-server/tools/definitions/list-fields.tool.js';

describe('listFieldsTool', () => {
  it('reports sort support from the provider sweep and discovers pooled retention', async () => {
    const supported = await runToolContract(listFieldsTool, { query: 'unique unit id' });
    expect(supported.structuredContent).toMatchObject({
      results: expect.arrayContaining([expect.objectContaining({ path: 'id', sortable: true })]),
    });
    const bracket = await runToolContract(listFieldsTool, { query: 'by_income_level.0-30000' });
    expect(bracket.structuredContent).toMatchObject({
      results: [
        { path: 'latest.cost.net_price.public.by_income_level.0-30000', sortable: false },
        { path: 'latest.cost.net_price.private.by_income_level.0-30000', sortable: false },
      ],
      tip: expect.stringContaining('sort support'),
    });
    const retention = await runToolContract(listFieldsTool, { query: 'retention' });
    const paths = [
      'latest.student.retention_rate_suppressed.four_year.full_time_pooled',
      'latest.student.retention_rate_suppressed.lt_four_year.full_time_pooled',
    ];
    expect(retention.structuredContent).toMatchObject({
      totalMatches: 2,
      results: paths.map((path) => ({ path, type: 'float', sortable: false })),
    });
    const text = retention.content.map((block) => ('text' in block ? block.text : '')).join('\n');
    for (const path of paths) {
      const row = text.split(`**${path}**\n`)[1]?.split('\n\n')[0];
      expect(row).toContain('Type: float | Category: retention | Sortable: No');
    }
  });
  it('advertises the verified OPEID6 sort index', async () => {
    const result = await runToolContract(listFieldsTool, { query: 'ope6_id' });
    expect(result.structuredContent).toMatchObject({
      results: [{ path: 'ope6_id', sortable: true }],
    });
  });
  it('discovers program-year tuition and OPEID6 pooling identity', async () => {
    for (const [query, path] of [
      ['tuition.program_year', 'latest.cost.tuition.program_year'],
      ['ope6_id', 'ope6_id'],
      [
        'earnings.1_yr.overall_median_earnings',
        'latest.programs.cip_4_digit.earnings.1_yr.overall_median_earnings',
      ],
      [
        'earnings.4_yr.overall_median_earnings',
        'latest.programs.cip_4_digit.earnings.4_yr.overall_median_earnings',
      ],
      [
        'earnings.1_yr.working_not_enrolled.overall_count',
        'latest.programs.cip_4_digit.earnings.1_yr.working_not_enrolled.overall_count',
      ],
      [
        'earnings.4_yr.working_not_enrolled.overall_count',
        'latest.programs.cip_4_digit.earnings.4_yr.working_not_enrolled.overall_count',
      ],
    ] as const) {
      const result = await runToolContract(listFieldsTool, { query });
      expect(result.structuredContent).toMatchObject({
        results: expect.arrayContaining([expect.objectContaining({ path })]),
      });
      expect(result.content).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'text', text: expect.stringContaining(path) }),
        ]),
      );
    }
  });

  it('renders query syntax as literal text while preserving the structured query', async () => {
    const query = '<b>_[tuition](https://example.com)_</b>';
    const result = await runToolContract(listFieldsTool, { query });
    expect(result.structuredContent).toMatchObject({ query });
    const text = result.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('\n');
    expect(text).toContain('\\<b>');
    expect(text).toContain('\\_\\[tuition\\]');
    expect(text).toContain('```json');
  });
  it('returns matching fields for a known keyword', async () => {
    const ctx = createMockContext({ errors: listFieldsTool.errors });
    const input = listFieldsTool.input.parse({ query: 'tuition' });
    const result = await listFieldsTool.handler(input, ctx);
    expect(result.query).toBe('tuition');
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.totalMatches).toBeGreaterThan(0);
    for (const f of result.results) {
      expect(f).toHaveProperty('path');
      expect(f).toHaveProperty('description');
      expect(f).toHaveProperty('type');
      expect(f).toHaveProperty('sortable');
      expect(f).toHaveProperty('category');
    }
  });

  it('respects the limit parameter and enriches truncation when the cap is hit', async () => {
    const ctx = createMockContext({ errors: listFieldsTool.errors });
    const input = listFieldsTool.input.parse({ query: 'earnings', limit: 5 });
    const result = await listFieldsTool.handler(input, ctx);
    expect(result.results.length).toBeLessThanOrEqual(5);
    if (result.results.length >= 5) {
      const enrichment = getEnrichment(ctx);
      expect(enrichment.truncated).toBe(true);
      expect(enrichment.shown).toBe(result.results.length);
      expect(enrichment.cap).toBe(5);
    }
  });

  it('includes a tip when unsortable fields are present', async () => {
    const ctx = createMockContext({ errors: listFieldsTool.errors });
    const input = listFieldsTool.input.parse({ query: 'earnings' });
    const result = await listFieldsTool.handler(input, ctx);
    // If any results are unsortable, tip should be set
    const hasUnsortable = result.results.some((r) => !r.sortable);
    if (hasUnsortable) {
      expect(result.tip).toBeDefined();
      expect(result.tip).toContain('sortable=false');
    }
  });

  it('returns successful empty matches for an unknown query', async () => {
    const ctx = createMockContext({ errors: listFieldsTool.errors });
    const input = listFieldsTool.input.parse({ query: 'xyzzy_nonexistent_field_9999' });
    expect(await listFieldsTool.handler(input, ctx)).toMatchObject({
      results: [],
      totalMatches: 0,
    });
  });

  describe('enrichment on every return path', () => {
    it('emits truncation fields as false on a sub-cap result', async () => {
      const result = await runToolContract(listFieldsTool, { query: 'tuition', limit: 30 });
      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toMatchObject({
        totalMatches: 3,
        truncated: false,
        shown: 3,
        cap: 30,
      });
      const text = result.content.map((b) => (b as { text?: string }).text ?? '').join('\n');
      expect(text).toContain('**truncated:** false');
      expect(text).toContain('**shown:** 3');
      expect(text).toContain('**cap:** 30');
    });

    it('marks truncation when matches fill the limit exactly', async () => {
      const result = await runToolContract(listFieldsTool, { query: 'earnings', limit: 5 });
      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toMatchObject({
        truncated: true,
        shown: 5,
        cap: 5,
      });
    });
  });

  it('formats output with path, type, category, and sortable', () => {
    const output = {
      query: 'tuition',
      results: [
        {
          path: 'latest.cost.tuition.in_state',
          description: 'In-state tuition and fees',
          type: 'integer',
          sortable: true,
          category: 'cost',
        },
      ],
      totalMatches: 1,
      tip: undefined,
    };
    const blocks = listFieldsTool.format!(output);
    expect(blocks[0]!.type).toBe('text');
    const text = (blocks[0] as { text: string }).text;
    expect(text).toContain('latest.cost.tuition.in_state');
    expect(text).toContain('integer');
    expect(text).toContain('cost');
    expect(text).toContain('tuition');
  });
});
