/**
 * @fileoverview Tests for the getPrograms tool, driven through the real ScorecardService
 * against a fake College Scorecard API that models the live response shape.
 * @module tests/tools/get-programs.tool.test
 */

import { JsonRpcErrorCode } from '@cyanheads/mcp-ts-core/errors';
import {
  createFetchMock,
  createMockContext,
  type FetchMockHarness,
  runToolContract,
} from '@cyanheads/mcp-ts-core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { searchFieldCatalog } from '@/data/field-catalog.js';
import { getProgramsTool } from '@/mcp-server/tools/definitions/get-programs.tool.js';
import { initScorecardService } from '@/services/scorecard/scorecard-service.js';

const SCHOOL_ID = 236948;
const SCHOOL_NAME = 'University of Washington-Seattle Campus';

/** Program records shaped like the live API — CIP codes come back undotted. */
const csBachelors = {
  code: '1107',
  title: 'Computer Science.',
  credential: { level: 3, title: "Bachelor's Degree" },
  earnings: { highest: { '1_yr': { overall_median_earnings: 101710 } } },
};
const csMasters = {
  code: '1107',
  title: 'Computer Science.',
  credential: { level: 5, title: "Master's Degree" },
  earnings: { highest: { '1_yr': { overall_median_earnings: null } } },
};
const csDoctoral = {
  code: '1107',
  title: 'Computer Science.',
  credential: { level: 6, title: 'Doctoral Degree' },
  earnings: { highest: { '1_yr': { overall_median_earnings: null } } },
};
const businessBachelors = {
  code: '5202',
  title: 'Business Administration, Management and Operations.',
  credential: { level: 3, title: "Bachelor's Degree" },
  earnings: { highest: { '1_yr': { overall_median_earnings: 70000 } } },
};

/**
 * Serves one school the way the live API does: a `latest.programs.cip_4_digit.code`
 * filter narrows the nested program list, and drops the school record entirely when
 * none of its programs match.
 */
const scorecardApi = (programs: Record<string, unknown>[]) => (request: Request) => {
  const url = new URL(request.url);
  const cip = url.searchParams.get('latest.programs.cip_4_digit.code');
  const matching = cip == null ? programs : programs.filter((p) => p.code === cip);
  const found =
    url.searchParams.get('id') === String(SCHOOL_ID) && (cip == null || matching.length > 0);
  return Response.json({
    metadata: { total: found ? 1 : 0, page: 0, per_page: 1 },
    results: found
      ? [{ id: SCHOOL_ID, 'school.name': SCHOOL_NAME, 'latest.programs.cip_4_digit': matching }]
      : [],
  });
};

let api: FetchMockHarness;

const serve = (programs: Record<string, unknown>[]) => {
  api.route({
    match: /^https:\/\/api\.data\.gov\/ed\/collegescorecard\/v1\/schools\?/,
    respond: scorecardApi(programs),
  });
};

const getPrograms = (input: Parameters<typeof getProgramsTool.input.parse>[0]) =>
  getProgramsTool.handler(
    getProgramsTool.input.parse(input),
    createMockContext({ errors: getProgramsTool.errors }),
  );

describe('getProgramsTool', () => {
  beforeEach(() => {
    vi.stubEnv('SCORECARD_API_KEY', 'test-key');
    initScorecardService({} as never, {} as never);
    api = createFetchMock();
    api.install();
  });

  afterEach(() => {
    api.restore();
    vi.unstubAllEnvs();
  });

  it('returns every program at the school, codes as the API sends them', async () => {
    serve([csBachelors, csMasters, businessBachelors]);
    const result = await getPrograms({ id: SCHOOL_ID });
    expect(result.school_id).toBe(SCHOOL_ID);
    expect(result.school_name).toBe(SCHOOL_NAME);
    expect(result.total).toBe(3);
    expect(result.programs.map((p) => p.code)).toEqual(['1107', '5202', '1107']);
    expect(result.programs[0]!.earnings_1yr_median).toBe(101710);
    expect(result.programs[0]!.suppressed).toBe(false);
    expect(result.suppressed_count).toBe(1);
  });

  it('marks program as suppressed when earnings are missing', async () => {
    serve([{ ...csBachelors, earnings: null }]);
    const result = await getPrograms({ id: SCHOOL_ID });
    expect(result.programs[0]!.suppressed).toBe(true);
    expect(result.programs[0]!.suppression_note).toBeDefined();
    expect(result.suppressed_count).toBe(1);
  });

  it('throws school_not_found when no record comes back for the ID', async () => {
    serve([csBachelors]);
    await expect(getPrograms({ id: 999999 })).rejects.toMatchObject({
      code: JsonRpcErrorCode.NotFound,
      data: { reason: 'school_not_found' },
    });
  });

  it('throws no_programs when min_earnings filter yields no results', async () => {
    serve([csBachelors]);
    await expect(getPrograms({ id: SCHOOL_ID, min_earnings: 999999 })).rejects.toMatchObject({
      code: JsonRpcErrorCode.NotFound,
      data: { reason: 'no_programs' },
    });
  });

  it('filters by an undotted cip_code', async () => {
    serve([csBachelors, csMasters, businessBachelors]);
    const result = await getPrograms({ id: SCHOOL_ID, cip_code: '1107' });
    expect(result.total).toBe(2);
    expect(result.programs.every((p) => p.code === '1107')).toBe(true);
  });

  it('matches a dotted cip_code against the undotted upstream code', async () => {
    serve([csBachelors, csMasters, businessBachelors]);
    const dotted = await runToolContract(getProgramsTool, { id: SCHOOL_ID, cip_code: '11.07' });
    const undotted = await runToolContract(getProgramsTool, { id: SCHOOL_ID, cip_code: '1107' });

    expect(dotted.isError).toBeFalsy();
    expect(dotted.structuredContent).toMatchObject({ school_id: SCHOOL_ID, total: 2 });
    const programs = (dotted.structuredContent as { programs: Array<{ code: string }> }).programs;
    expect(programs.map((p) => p.code)).toEqual(['1107', '1107']);
    const text = dotted.content.map((b) => (b as { text?: string }).text ?? '').join('\n');
    expect(text).toContain('**Total:** 2');
    expect(text).toContain('**1107** — Computer Science.');
    expect(text).not.toContain('5202');

    expect(dotted.structuredContent).toEqual(undotted.structuredContent);
    expect(dotted.content).toEqual(undotted.content);
  });

  it('reports no_programs, not school_not_found, for a cip_code the school does not offer', async () => {
    serve([csBachelors, csMasters, businessBachelors]);
    const result = await runToolContract(getProgramsTool, { id: SCHOOL_ID, cip_code: '99.99' });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      error: { code: JsonRpcErrorCode.NotFound, data: { reason: 'no_programs' } },
    });
    const text = result.content.map((b) => (b as { text?: string }).text ?? '').join('\n');
    expect(text).toContain(`No programs found at school ${SCHOOL_ID} matching the filters.`);
    expect(text).toContain('Remove the cip_code or credential_level filter');
    expect(text).not.toContain('No school record found');
  });

  it('handles sparse upstream records with omitted earnings fields', async () => {
    serve([{ code: '1107', title: 'Computer Science.' }]);
    const result = await getPrograms({ id: SCHOOL_ID });
    expect(result.programs[0]!.earnings_1yr_median).toBeUndefined();
    expect(result.programs[0]!.median_debt).toBeUndefined();
    expect(result.programs[0]!.suppressed).toBe(true);
  });

  it('formats output with earnings, debt, and suppression note', () => {
    const output = {
      school_id: SCHOOL_ID,
      school_name: SCHOOL_NAME,
      programs: [
        {
          code: '1107',
          title: 'Computer Science.',
          credential_level: "Bachelor's",
          earnings_1yr_median: 72000,
          median_debt: 18000,
          enrollment: 400,
          suppressed: false,
        },
        {
          code: '5138',
          title:
            'Registered Nursing, Nursing Administration, Nursing Research and Clinical Nursing.',
          credential_level: "Bachelor's",
          suppressed: true,
          suppression_note:
            'Earnings data suppressed — cohort too small to report under FERPA privacy rules.',
        },
      ],
      total: 2,
      suppressed_count: 1,
    };
    const blocks = getProgramsTool.format!(output);
    expect(blocks[0]!.type).toBe('text');
    const text = (blocks[0] as { text: string }).text;
    expect(text).toContain('1107');
    expect(text).toContain('72,000');
    expect(text).toContain('18,000');
    expect(text).toContain('Suppression note');
    expect(text).toContain('FERPA');
  });

  describe('credential levels', () => {
    /** Live `credential: { level, title }` pairs from the API, with the label the tool renders. */
    const LIVE_CREDENTIALS: Array<[number, string, string]> = [
      [1, 'Undergraduate Certificate or Diploma', 'Undergraduate certificate'],
      [2, "Associate's Degree", "Associate's"],
      [3, "Bachelor's Degree", "Bachelor's"],
      [4, 'Post-baccalaureate Certificate', 'Post-baccalaureate certificate'],
      [5, "Master's Degree", "Master's"],
      [6, 'Doctoral Degree', 'Doctoral'],
      [7, 'First Professional Degree', 'First professional'],
      [8, 'Graduate/Professional Certificate', 'Graduate/professional certificate'],
      [
        99,
        'Non-Credential Program (Preparatory Coursework/Teacher Certification)',
        'Non-credential',
      ],
    ];

    /** The documented code for each level, as it must read in every filter description. */
    const DOCUMENTED_CODES = [
      /\b1=undergraduate certificate\b/,
      /\b2=associate\b/,
      /\b3=bachelor\b/,
      /\b4=post-baccalaureate certificate\b/,
      /\b5=master\b/,
      /\b6=doctoral\b/,
      /\b7=first professional\b/,
      /\b8=graduate\/professional certificate\b/,
      /\b99=non-credential\b/,
    ];

    /** Runs one program with the given credential and returns its label from both surfaces. */
    const labelOf = async (credential: Record<string, unknown> | undefined) => {
      serve([{ ...csBachelors, credential }]);
      const result = await runToolContract(getProgramsTool, { id: SCHOOL_ID });
      expect(result.isError).toBeFalsy();
      const { programs } = result.structuredContent as {
        programs: Array<{ credential_level: string }>;
      };
      const text = result.content.map((b) => (b as { text?: string }).text ?? '').join('\n');
      expect(text).toContain(`**1107** — Computer Science. (${programs[0]!.credential_level})`);
      return programs[0]!.credential_level;
    };

    it.each(LIVE_CREDENTIALS)('labels level %i (%s) as %s', async (level, title, label) => {
      expect(await labelOf({ level, title })).toBe(label);
    });

    it('labels a record without a credential as Unknown', async () => {
      expect(await labelOf(undefined)).toBe('Unknown');
    });

    it('falls back to the bare level when the level is unknown and carries no title', async () => {
      expect(await labelOf({ level: 42 })).toBe('42');
    });

    it("falls back to the record's own title when the level is unknown", async () => {
      expect(await labelOf({ level: 42, title: 'Future Credential Type' })).toBe(
        'Future Credential Type',
      );
    });

    it('filters by credential_level', async () => {
      serve([csBachelors, csMasters, businessBachelors]);
      const result = await getPrograms({ id: SCHOOL_ID, credential_level: 3 });
      expect(result.programs.map((p) => p.code)).toEqual(['1107', '5202']);
    });

    it("selects master's programs with credential_level 5", async () => {
      serve([csBachelors, csMasters, csDoctoral, businessBachelors]);
      const result = await runToolContract(getProgramsTool, {
        id: SCHOOL_ID,
        credential_level: 5,
      });
      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toMatchObject({
        total: 1,
        programs: [{ code: '1107', credential_level: "Master's" }],
      });
      const text = result.content.map((b) => (b as { text?: string }).text ?? '').join('\n');
      expect(text).toContain("**1107** — Computer Science. (Master's)");
    });

    it("documents the API's level codes in the credential_level filter and the field catalog", () => {
      const filterDoc = getProgramsTool.input.shape.credential_level.description ?? '';
      const [catalogEntry] = searchFieldCatalog('latest.programs.cip_4_digit.credential_level', 1);
      expect(catalogEntry?.path).toBe('latest.programs.cip_4_digit.credential_level');
      for (const doc of [filterDoc, catalogEntry!.description]) {
        for (const code of DOCUMENTED_CODES) expect(doc).toMatch(code);
        expect(doc).not.toMatch(/\b17=/);
      }
    });
  });

  it('documents that cip_code accepts both forms and returns one row per credential level', () => {
    const doc = getProgramsTool.input.shape.cip_code.description ?? '';
    expect(doc).toContain('"11.07"');
    expect(doc).toContain('"1107"');
    expect(doc).toMatch(/one row per credential level/);
  });
});
