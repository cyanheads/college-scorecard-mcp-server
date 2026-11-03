/**
 * @fileoverview Embedded CIP (Classification of Instructional Programs) code taxonomy.
 * Derived from NCES CIP 2020 taxonomy. Static data — no API call required.
 * @module data/cip-codes
 */

import taxonomy from './cip-2020.json' with { type: 'json' };

export interface CipEntry {
  /** 4-digit CIP code (e.g. "11.07") */
  code: string;
  /** 2-digit family code (e.g. "11") */
  family: string;
  /** Family name (e.g. "Computer And Information Sciences And Support Services") */
  familyTitle: string;
  /** Standard title for the program (e.g. "Computer Science") */
  title: string;
}

/** Every official four-digit group and family from NCES CIP 2020. */
export const CIP_CODES: CipEntry[] = Object.entries(taxonomy.groups).map(([code, title]) => ({
  code,
  title,
  family: code.slice(0, 2),
  familyTitle: taxonomy.families[code.slice(0, 2) as keyof typeof taxonomy.families],
}));

/**
 * Search CIP codes by keyword — matches against code, title, family title.
 * Returns up to `limit` results (default 20).
 */
export function searchCipCodes(query: string, limit = 20): CipEntry[] {
  if (/^\d{4}$/.test(query)) query = `${query.slice(0, 2)}.${query.slice(2)}`;
  const normalizedQuery = query.toLowerCase();
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  if (terms.length === 0) return CIP_CODES.slice(0, limit);
  const matches: Array<{
    entry: CipEntry;
    exact: boolean;
    matchedTerms: number;
    titleTerms: number;
    codePrefix: boolean;
  }> = [];
  for (const entry of CIP_CODES) {
    const titles = [
      entry.title,
      ...(CIP_ALIASES[entry.code] ?? []).map((alias) => alias.title),
    ].map((title) => title.toLowerCase().replace(/\.$/, ''));
    const haystack = `${entry.code} ${titles.join(' ')} ${entry.familyTitle}`.toLowerCase();
    const matchedTerms = terms.filter((term) => haystack.includes(term)).length;
    if (matchedTerms > 0)
      matches.push({
        entry,
        matchedTerms,
        exact: entry.code === query || titles.includes(normalizedQuery),
        titleTerms: terms.filter((term) => titles.some((title) => title.includes(term))).length,
        codePrefix: entry.code.startsWith(query),
      });
  }
  return matches
    .sort(
      (a, b) =>
        Number(b.exact) - Number(a.exact) ||
        b.matchedTerms - a.matchedTerms ||
        Number(b.codePrefix) - Number(a.codePrefix) ||
        b.titleTerms - a.titleTerms,
    )
    .slice(0, limit)
    .map((s) => s.entry);
}

/** Verified six-digit descendants used only as keyword aliases for their four-digit group. */
export const CIP_ALIASES: Record<string, Array<{ code: string; title: string }>> = {
  '03.01': [{ code: '03.0103', title: 'Environmental Studies.' }],
  '03.02': [
    { code: '03.0201', title: 'Environmental/Natural Resources Management and Policy, General.' },
  ],
  '11.08': [{ code: '11.0804', title: 'Modeling, Virtual Environments and Simulation.' }],
  '13.06': [{ code: '13.0604', title: 'Educational Assessment, Testing, and Measurement.' }],
  '14.10': [{ code: '14.1001', title: 'Electrical and Electronics Engineering.' }],
  '23.13': [
    { code: '23.1303', title: 'Professional, Technical, Business, and Scientific Writing.' },
  ],
  '23.14': [
    { code: '23.1402', title: 'American Literature (United States).' },
    { code: '23.1403', title: 'American Literature (Canadian).' },
  ],
  '42.27': [
    { code: '42.2701', title: 'Cognitive Psychology and Psycholinguistics.' },
    { code: '42.2702', title: 'Comparative Psychology.' },
    { code: '42.2703', title: 'Developmental and Child Psychology.' },
  ],
  '42.28': [
    { code: '42.2802', title: 'Community Psychology.' },
    { code: '42.2810', title: 'Health/Medical Psychology.' },
    { code: '42.2812', title: 'Forensic Psychology.' },
  ],
  '43.04': [{ code: '43.0406', title: 'Forensic Science and Technology.' }],
  '46.03': [{ code: '46.0302', title: 'Electrician.' }],
  '48.05': [{ code: '48.0508', title: 'Welding Technology/Welder.' }],
  '49.02': [
    { code: '49.0205', title: 'Truck and Bus Driver/Commercial Vehicle Operator and Instructor.' },
  ],
};
