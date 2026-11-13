/**
 * @fileoverview Program presentation checks at the shared formatter seam.
 * @module tests/tools/program-format.test
 */
import { expect, it } from 'vitest';
import { PROGRAM_METRIC_SCOPE, PROGRAM_PROVENANCE } from '@/data/program-provenance.js';
import {
  programMetricLines,
  programNumber,
  programProvenanceLines,
  programText,
} from '@/mcp-server/program-format.js';
import { programOutcomes } from '@/services/scorecard/program-outcomes.js';

it.each([
  [0, '0'],
  [1234.56789012, '1,234.56789012'],
  [-0.123456789, '-0.123456789'],
  [1e-12, '1e-12'],
  [123456789012345680000, '123,456,789,012,345,680,000'],
])('renders %s without rounding', (value, expected) => {
  expect(programNumber(value)).toBe(expected);
});

it('renders source punctuation and line breaks as literal text', () => {
  expect(programText(' [A|B]\r\n**C**\n')).toBe('&#32;\\[A\\|B\\]&#13;&#10;\\*\\*C\\*\\*&#10;');
  expect(programText('&#10;')).toBe('\\&#10;');
});

it('renders a current-only row with independent median and count availability', () => {
  const row = programOutcomes({
    earnings: {
      '1_yr': { overall_median_earnings: 121837, working_not_enrolled: { overall_count: 23 } },
      '4_yr': { overall_median_earnings: 'PS', working_not_enrolled: { overall_count: 0 } },
    },
  });
  expect(programMetricLines(row)).toEqual([
    '- Completion-based 1-year earnings: $121,837 (available) | Population count: 23 (available)',
    '- Completion-based 4-year earnings: Not available (privacy_suppressed) | Population count: 0 (available)',
    '- Legacy highest-credential 1-year earnings: Not available (unavailable) | Population count: Not available (unavailable) | Suppressed: false',
  ]);
});

it('renders dictionary populations, map cells, variables, dollar basis and aggregation scope', () => {
  const text = programProvenanceLines(PROGRAM_PROVENANCE, PROGRAM_METRIC_SCOPE).join('\n');
  for (const part of [
    'Earnings: opeid6 | Debt: opeid6 | IPEDS awards: campus | Program identity: CIP code and credential level',
    '[College Scorecard data dictionary](<https://collegescorecard.ed.gov/files/CollegeScorecardDataDictionary.xlsx>)',
    'Federally aided graduates working and not enrolled one year after completion. Cohorts: 2020-21, 2021-22 | Measurement years: 2022, 2023 | Dollar year: 2024 | Median: EARN_MDN_1YR (K125) | Count: EARN_COUNT_WNE_1YR (K124)',
    'Federally aided graduates working and not enrolled four years after completion. Cohorts: 2017-18, 2018-19 | Measurement years: 2022, 2023 | Dollar year: 2024 | Median: EARN_MDN_4YR (K131) | Count: EARN_COUNT_WNE_4YR (K130)',
    'Federally aided graduates working and not enrolled one year after their highest credential. Cohorts: 2016-17, 2017-18 | Measurement years: 2018, 2019 | Dollar year: 2020 | Median: EARN_MDN_HI_1YR (K80) | Count: EARN_COUNT_WNE_HI_1YR (K79)',
    'Completers with Stafford/Grad PLUS borrowing across attended institutions at the same academic level. Cohorts: 2022-23, 2023-24 | Variable: DEBT_ALL_STGP_ANY_MDN (K15)',
    'Campus awards, not enrollment or unique students. Academic year: 2022-23 | Variable: IPEDSCOUNT1 (K11)',
    'Campus awards, not enrollment or unique students. Academic year: 2023-24 | Variable: IPEDSCOUNT2 (K12)',
  ])
    expect(text).toContain(part);
});
