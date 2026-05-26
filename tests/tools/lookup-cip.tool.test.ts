/**
 * @fileoverview Tests for the lookupCip tool.
 * @module tests/tools/lookup-cip.tool.test
 */

import { createMockContext } from '@cyanheads/mcp-ts-core/testing';
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
    expect(blocks[0].type).toBe('text');
    const text = (blocks[0] as { text: string }).text;
    expect(text).toContain('nursing');
    expect(text).toContain('51.38');
    expect(text).toContain('Registered Nursing');
    expect(text).toContain('Health Professions');
  });
});
