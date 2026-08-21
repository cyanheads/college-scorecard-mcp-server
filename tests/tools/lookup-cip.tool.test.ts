/**
 * @fileoverview Tests for the lookupCip tool.
 * @module tests/tools/lookup-cip.tool.test
 */

import { createMockContext, runToolContract } from '@cyanheads/mcp-ts-core/testing';
import { describe, expect, it } from 'vitest';
import { lookupCipTool } from '@/mcp-server/tools/definitions/lookup-cip.tool.js';

describe('lookupCipTool', () => {
  it('returns CIP entries for a known keyword', async () => {
    const ctx = createMockContext({ errors: lookupCipTool.errors });
    const input = lookupCipTool.input.parse({ query: 'computer science' });
    const result = await lookupCipTool.handler(input, ctx);
    expect(result.query).toBe('computer science');
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.totalMatches).toBeGreaterThan(0);
    for (const r of result.results) {
      expect(r).toHaveProperty('code');
      expect(r).toHaveProperty('title');
      expect(r).toHaveProperty('family');
      expect(r).toHaveProperty('familyTitle');
    }
  });

  it('respects the limit parameter', async () => {
    const ctx = createMockContext({ errors: lookupCipTool.errors });
    const input = lookupCipTool.input.parse({ query: 'business', limit: 3 });
    const result = await lookupCipTool.handler(input, ctx);
    expect(result.results.length).toBeLessThanOrEqual(3);
  });

  it('throws no_match for an unknown query', () => {
    const ctx = createMockContext({ errors: lookupCipTool.errors });
    const input = lookupCipTool.input.parse({ query: 'xyzzy_nonexistent_program_9999' });
    expect(() => lookupCipTool.handler(input, ctx)).toThrow();
  });

  describe('enrichment on every return path', () => {
    it('emits truncation fields as false on a sub-cap result', async () => {
      const result = await runToolContract(lookupCipTool, { query: 'nuclear', limit: 50 });
      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toMatchObject({
        totalMatches: 1,
        truncated: false,
        shown: 1,
        cap: 50,
      });
      const text = result.content.map((b) => (b as { text?: string }).text ?? '').join('\n');
      expect(text).toContain('**truncated:** false');
      expect(text).toContain('**shown:** 1');
      expect(text).toContain('**cap:** 50');
    });

    it('marks truncation when matches fill the limit exactly', async () => {
      const result = await runToolContract(lookupCipTool, { query: 'computer science', limit: 3 });
      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toMatchObject({ truncated: true, shown: 3, cap: 3 });
    });
  });

  it('formats output with code, title, and family', () => {
    const output = {
      query: 'nursing',
      results: [
        {
          code: '51.38',
          title: 'Registered Nursing',
          family: '51',
          familyTitle: 'Health Professions',
        },
      ],
      totalMatches: 1,
    };
    const blocks = lookupCipTool.format!(output);
    expect(blocks[0]!.type).toBe('text');
    const text = (blocks[0] as { text: string }).text;
    expect(text).toContain('nursing');
    expect(text).toContain('51.38');
    expect(text).toContain('Registered Nursing');
    expect(text).toContain('Health Professions');
  });
});
