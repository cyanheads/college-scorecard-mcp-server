/**
 * @fileoverview Tests for the listFields tool.
 * @module tests/tools/list-fields.tool.test
 */

import { createMockContext, getEnrichment, runToolContract } from '@cyanheads/mcp-ts-core/testing';
import { describe, expect, it } from 'vitest';
import { listFieldsTool } from '@/mcp-server/tools/definitions/list-fields.tool.js';

describe('listFieldsTool', () => {
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

  it('throws no_match for an unknown query', () => {
    const ctx = createMockContext({ errors: listFieldsTool.errors });
    const input = listFieldsTool.input.parse({ query: 'xyzzy_nonexistent_field_9999' });
    expect(() => listFieldsTool.handler(input, ctx)).toThrow();
  });

  describe('enrichment on every return path', () => {
    it('emits truncation fields as false on a sub-cap result', async () => {
      const result = await runToolContract(listFieldsTool, { query: 'tuition', limit: 30 });
      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toMatchObject({
        totalMatches: 2,
        truncated: false,
        shown: 2,
        cap: 30,
      });
      const text = result.content.map((b) => (b as { text?: string }).text ?? '').join('\n');
      expect(text).toContain('**truncated:** false');
      expect(text).toContain('**shown:** 2');
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
