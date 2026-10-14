/**
 * @fileoverview Tests for the lookupCip tool.
 * @module tests/tools/lookup-cip.tool.test
 */

import { createMockContext, runToolContract } from '@cyanheads/mcp-ts-core/testing';
import { describe, expect, it } from 'vitest';
import { CIP_ALIASES, CIP_CODES } from '@/data/cip-codes.js';
import { lookupCipTool } from '@/mcp-server/tools/definitions/lookup-cip.tool.js';
import official from '../fixtures/cip-2020.json' with { type: 'json' };

describe('lookupCipTool', () => {
  it('matches every retained four-digit group and family to NCES CIP 2020', () => {
    expect(new Set(CIP_CODES.map((entry) => entry.code)).size).toBe(CIP_CODES.length);
    for (const entry of CIP_CODES) {
      expect(entry.code).toMatch(/^\d{2}\.\d{2}$/);
      expect(entry.family).toBe(entry.code.slice(0, 2));
      expect(official.groups[entry.code as keyof typeof official.groups]).toBe(entry.title);
      expect(official.families[entry.family as keyof typeof official.families]).toBe(
        entry.familyTitle,
      );
    }
    for (const [group, aliases] of Object.entries(CIP_ALIASES)) {
      expect(CIP_CODES.some((entry) => entry.code === group)).toBe(true);
      for (const alias of aliases) {
        expect(alias.code.slice(0, 5)).toBe(group);
        expect(official.descendants[alias.code as keyof typeof official.descendants]).toBe(
          alias.title,
        );
      }
    }
  });
  it.each([
    ['forensic psychology', '42.28', 'Clinical, Counseling and Applied Psychology.'],
    ['sociology', '45.11', 'Sociology.'],
    ['1107', '11.07', 'Computer Science.'],
    ['journalism', '09.04', 'Journalism.'],
    ['economics and computer science', '30.39', 'Economics and Computer Science.'],
  ])('resolves %s to its canonical group', async (query, code, title) => {
    const result = await runToolContract(lookupCipTool, { query });
    expect(result.isError).toBeFalsy();
    const first = (result.structuredContent as { results: Record<string, unknown>[] }).results[0];
    expect(first).toMatchObject({ code, title });
    const text = result.content.map((block) => (block as { text?: string }).text ?? '').join('\n');
    expect(text).toContain(code);
    expect(text).toContain(title);
  });
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

  it('returns successful empty matches for an unknown query', async () => {
    const ctx = createMockContext({ errors: lookupCipTool.errors });
    const input = lookupCipTool.input.parse({ query: 'xyzzy_nonexistent_program_9999' });
    expect(await lookupCipTool.handler(input, ctx)).toMatchObject({ results: [], totalMatches: 0 });
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
