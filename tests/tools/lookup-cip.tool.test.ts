/**
 * @fileoverview Tests for the lookupCip tool.
 * @module tests/tools/lookup-cip.tool.test
 */

import { createMockContext, runToolContract } from '@cyanheads/mcp-ts-core/testing';
import { describe, expect, it } from 'vitest';
import { CIP_ALIASES, CIP_CODES, searchCipCodes } from '@/data/cip-codes.js';
import { lookupCipTool } from '@/mcp-server/tools/definitions/lookup-cip.tool.js';
import official from '../fixtures/cip-2020.json' with { type: 'json' };

describe('lookupCipTool', () => {
  it.each(['11.0701', '110701'])(
    'groups specialization %s and echoes the effective query',
    async (query) => {
      const result = await runToolContract(lookupCipTool, { query, limit: 1 });
      const notice = `CIP code ${query} was grouped under the four-digit code 11.07.`;
      expect(result.structuredContent).toMatchObject({
        query: '11.07',
        queryContext: { query: '11.07', limit: 1, offset: 0 },
        results: [{ code: '11.07', title: 'Computer Science.' }],
        totalMatches: 1,
        truncated: false,
        notice,
      });
      expect(
        result.content.map((block) => ('text' in block ? block.text : '')).join('\n'),
      ).toContain(notice);
    },
  );

  it.each([
    ['110701', '11.07', 1, 'This CIP offset is exhausted; use offset 0 to restart.'],
    ['999999', '99.99', 0, 'No CIP codes matched.'],
  ] as const)(
    'keeps grouping and recovery guidance for empty pages of %s',
    async (query, group, totalMatches, guidance) => {
      const result = await runToolContract(lookupCipTool, { query, offset: 3 });
      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toMatchObject({
        query: group,
        results: [],
        totalMatches,
        offset: 3,
      });
      for (const text of [
        (result.structuredContent as { notice?: string } | undefined)?.notice,
        result.content.map((block) => ('text' in block ? block.text : '')).join('\n'),
      ]) {
        expect(text).toContain(query);
        expect(text).toContain(guidance);
      }
    },
  );
  it('walks all capped pages in relevance order without duplicates', async () => {
    const expected = searchCipCodes('science', Infinity).map((entry) => entry.code);
    expect(expected.length).toBeGreaterThan(50);
    const codes: string[] = [];
    let offset = 0;
    for (;;) {
      const result = await runToolContract(lookupCipTool, {
        query: 'science',
        limit: 1000,
        offset,
      });
      expect(result.isError).toBeFalsy();
      const data = result.structuredContent as { results: { code: string }[]; nextOffset?: number };
      expect(result.structuredContent).toMatchObject({
        totalMatches: expected.length,
        offset,
        queryContext: { query: 'science', limit: 50, offset },
      });
      const text = result.content
        .map((block) => (block.type === 'text' ? block.text : ''))
        .join('\n');
      expect(text).toContain(`**Offset:** ${offset}`);
      codes.push(...data.results.map((row) => row.code));
      if (data.nextOffset === undefined) break;
      expect(data.nextOffset).toBe(offset + 50);
      expect(text).toContain(`**Next offset:** ${data.nextOffset}`);
      offset = data.nextOffset;
      if (offset > expected.length) throw new Error('Continuation exceeded total');
    }
    expect(codes).toEqual(expected);
    expect(new Set(codes).size).toBe(codes.length);
    for (const offset of [expected.length, expected.length + 1]) {
      const result = await runToolContract(lookupCipTool, { query: 'science', offset });
      expect(result.structuredContent).toMatchObject({
        results: [],
        totalMatches: expected.length,
        offset,
        truncated: false,
        shown: 0,
      });
      expect(result.structuredContent).not.toHaveProperty('nextOffset');
      const text = result.content
        .map((block) => (block.type === 'text' ? block.text : ''))
        .join('\n');
      expect(text).toContain(`**Offset:** ${offset}`);
      expect(text).not.toContain('**Next offset:**');
    }
  });

  it.each([
    { query: '' },
    { query: 'law', offset: -1 },
    { query: 'law', offset: 0.5 },
    { query: 'law', limit: 1001 },
  ])('rejects invalid selectors %j', async (input) => {
    const result = await runToolContract(lookupCipTool, input);
    expect(result.isError).toBe(true);
    expect(result.content.some((block) => block.type === 'text' && block.text.length > 0)).toBe(
      true,
    );
  });
  it('preserves verified descendant aliases and exact-match precedence', () => {
    expect(Object.values(CIP_ALIASES).flat().length).toBeGreaterThanOrEqual(15);
    for (const [code, aliases] of Object.entries(CIP_ALIASES))
      for (const alias of aliases)
        expect(searchCipCodes(alias.title.replace(/\.$/, ''))[0]?.code).toBe(code);
    expect(searchCipCodes('11.07')[0]?.code).toBe('11.07');
    expect(searchCipCodes('1107')[0]?.code).toBe('11.07');
    for (const [code, title] of Object.entries(official.descendants))
      expect(CIP_ALIASES[code.slice(0, 5)]).toContainEqual({ code, title });
  });

  it('omits continuation when matches end exactly at the cap', async () => {
    const result = await runToolContract(lookupCipTool, { query: '14.23', limit: 1 });
    expect(result.structuredContent).toMatchObject({
      totalMatches: 1,
      shown: 1,
      cap: 1,
      truncated: false,
      offset: 0,
    });
    expect(result.structuredContent).not.toHaveProperty('nextOffset');
    expect(
      result.content.some(
        (block) => block.type === 'text' && block.text.includes('**Next offset:**'),
      ),
    ).toBe(false);
  });

  it('keeps raw query data while escaping query and trailer presentation', async () => {
    const query = '*law*';
    const result = await runToolContract(lookupCipTool, { query });
    expect(result.structuredContent).toMatchObject({
      query,
      results: [],
      totalMatches: 0,
      queryContext: { query, offset: 0, limit: 20 },
      truncated: false,
    });
    const text = result.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('\n');
    expect(text).toContain('\\*law\\*');
    expect(text).toContain('No CIP codes matched.');
    expect(text).toContain('```json\n{"query":"*law*","limit":20,"offset":0}\n```');
    const formatted = lookupCipTool.format!({
      query: 'law',
      totalMatches: 1,
      offset: 0,
      results: [
        {
          code: '22.01',
          title: '*Law*',
          family: '22',
          familyTitle: '[Legal](https://example.com)',
        },
      ],
    });
    expect(formatted).toEqual([
      {
        type: 'text',
        text: 'CIP Code Lookup: "law"\n**Matches:** 1\n**Offset:** 0\n\n**22.01** — \\*Law\\*\nFamily: 22 \\[Legal\\](https://example.com)',
      },
    ]);
  });
  it('matches every retained four-digit group and family to NCES CIP 2020', () => {
    expect(CIP_CODES).toHaveLength(464);
    expect(CIP_CODES.map((entry) => entry.code).sort()).toEqual(
      Object.keys(official.groups).sort(),
    );
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
        const trades: Record<string, string> = {
          '46.0302': 'Electrician.',
          '48.0508': 'Welding Technology/Welder.',
          '49.0205': 'Truck and Bus Driver/Commercial Vehicle Operator and Instructor.',
        };
        expect(
          { ...official.descendants, ...trades }[alias.code as keyof typeof official.descendants],
        ).toBe(alias.title);
      }
    }
  });
  it.each([
    ['forensic psychology', '42.28', 'Clinical, Counseling and Applied Psychology.'],
    ['sociology', '45.11', 'Sociology.'],
    ['1107', '11.07', 'Computer Science.'],
    ['journalism', '09.04', 'Journalism.'],
    ['economics and computer science', '30.39', 'Economics and Computer Science.'],
    ['law', '22.01', 'Law.'],
    ['welding', '48.05', 'Precision Metal Working.'],
    ['electrician', '46.03', 'Electrical and Power Transmission Installers.'],
    ['truck driving', '49.02', 'Ground Transportation.'],
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
      const result = await runToolContract(lookupCipTool, { query: '14.23', limit: 50 });
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
      offset: 0,
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
