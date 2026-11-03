/**
 * @fileoverview Compare embedded earnings provenance with the official Scorecard XLSX dictionary.
 * @module scripts/check-earnings-provenance
 */

import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { z } from '@cyanheads/mcp-ts-core';
import {
  historicalEarningsContext,
  LATEST_EARNINGS_CONTEXT,
} from '../src/data/earnings-context.js';

const source = 'https://collegescorecard.ed.gov/files/CollegeScorecardDataDictionary.xlsx';
const variables = {
  earnings_6yr_median: 'MD_EARN_WNE_P6',
  earnings_6yr_p25: 'PCT25_EARN_WNE_P6',
  earnings_6yr_p75: 'PCT75_EARN_WNE_P6',
  earnings_8yr_median: 'MD_EARN_WNE_P8',
  earnings_10yr_median: 'MD_EARN_WNE_P10',
  earnings_10yr_p25: 'PCT25_EARN_WNE_P10',
  earnings_10yr_p75: 'PCT75_EARN_WNE_P10',
  earnings_6yr_non_male_median: 'MD_EARN_WNE_MALE0_P6',
  earnings_6yr_male_median: 'MD_EARN_WNE_MALE1_P6',
} as const;

const dictionarySchema = z.object({
  latest: z.record(z.string(), z.object({ measure: z.string(), file: z.string() })),
  historical2022: z.record(z.string(), z.string()),
});

/** Throws when any supported latest cell or historical 2022 cell differs or is missing. */
export function checkEarningsProvenance(input: unknown): void {
  const dictionary = dictionarySchema.parse(input);
  for (const [metric, variable] of Object.entries(variables)) {
    const context = LATEST_EARNINGS_CONTEXT[metric as keyof typeof variables];
    const expected = `Treasury AY${context.entry_cohorts?.join(', AY')} pooled cohort measured in CY${context.measurement_years?.join(', CY')}, inflation adjusted to ${context.dollar_year} dollars`;
    const cell = dictionary.latest[variable];
    if (
      !cell ||
      cell.file !== `${context.data_file_year}_${String(context.data_file_year + 1).slice(2)}` ||
      cell.measure !== expected
    )
      throw new Error(
        `Most_Recent_Inst_Cohort_Map: ${variable} differs from embedded provenance; review the official dictionary and refresh verified metadata.`,
      );
    if (dictionary.historical2022[variable] !== expected)
      throw new Error(
        `Institution_Cohort_Map: ${variable} in Merged2022_23 differs from verified provenance.`,
      );
    if (metric === 'earnings_6yr_median' || metric === 'earnings_10yr_median') {
      if (JSON.stringify(historicalEarningsContext(2022)[metric]) !== JSON.stringify(context))
        throw new Error(`Historical 2022 ${metric} differs from its verified latest context.`);
    }
  }
}

/** Read XLSX using Python's standard-library ZIP and XML parsers; no spreadsheet dependency. */
export function readEarningsDictionary(workbook: Uint8Array): unknown {
  const program = `
import io,json,posixpath,sys,zipfile,xml.etree.ElementTree as E
z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read()))
n={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
strings=[''.join(t.text or '' for t in s.iter('{'+n['m']+'}t')) for s in E.fromstring(z.read('xl/sharedStrings.xml'))]
rels={r.attrib['Id']:r.attrib['Target'] for r in E.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
sheets={s.attrib['name']:posixpath.normpath(posixpath.join('xl',rels[s.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']])) for s in E.fromstring(z.read('xl/workbook.xml')).findall('m:sheets/m:sheet',n)}
def rows(name):
 result=[]
 for row in E.fromstring(z.read(sheets[name])).findall('.//m:row',n):
  cells={}
  for c in row:
   value=c.find('m:v',n)
   column=''.join(x for x in c.attrib['r'] if x.isalpha())
   if value is not None: cells[column]=strings[int(value.text)] if c.attrib.get('t')=='s' else value.text
   elif c.attrib.get('t')=='inlineStr': cells[column]=''.join(t.text or '' for t in c.findall('.//m:t',n))
  result.append(cells)
 return result
latest={r['A']:{'measure':r.get('B',''),'file':r.get('C','')} for r in rows('Most_Recent_Inst_Cohort_Map') if 'A' in r}
historical=rows('Institution_Cohort_Map')
column=next(k for k,v in historical[0].items() if v=='Merged2022_23')
print(json.dumps({'latest':latest,'historical2022':{r['A']:r.get(column,'') for r in historical if 'A' in r}}))
`;
  return JSON.parse(
    execFileSync('python3', ['-c', program], {
      input: workbook,
      encoding: 'utf8',
      timeout: 15000,
      maxBuffer: 8 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    }),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2];
  let workbook: Uint8Array;
  if (file) workbook = await readFile(file);
  else {
    const response = await fetch(source, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`Dictionary download failed with HTTP ${response.status}.`);
    workbook = new Uint8Array(await response.arrayBuffer());
  }
  checkEarningsProvenance(readEarningsDictionary(workbook));
  console.log(
    'Verified all nine latest earnings metrics and their historical 2022 dictionary cells.',
  );
}
