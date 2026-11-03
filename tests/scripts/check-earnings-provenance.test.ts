/**
 * @fileoverview Dictionary drift detection and XLSX ingestion at the maintenance boundary.
 * @module tests/scripts/check-earnings-provenance.test
 */

import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import {
  checkEarningsProvenance,
  readEarningsDictionary,
} from '../../scripts/check-earnings-provenance.js';

const six =
  'Treasury AY2015-16, AY2016-17 pooled cohort measured in CY2022, CY2023, inflation adjusted to 2024 dollars';
const eight =
  'Treasury AY2013-14, AY2014-15 pooled cohort measured in CY2022, CY2023, inflation adjusted to 2024 dollars';
const ten =
  'Treasury AY2011-12, AY2012-13 pooled cohort measured in CY2022, CY2023, inflation adjusted to 2024 dollars';
const measures = {
  MD_EARN_WNE_P6: six,
  PCT25_EARN_WNE_P6: six,
  PCT75_EARN_WNE_P6: six,
  MD_EARN_WNE_MALE0_P6: six,
  MD_EARN_WNE_MALE1_P6: six,
  MD_EARN_WNE_P8: eight,
  MD_EARN_WNE_P10: ten,
  PCT25_EARN_WNE_P10: ten,
  PCT75_EARN_WNE_P10: ten,
};
const dictionary = () => ({
  latest: Object.fromEntries(
    Object.entries(measures).map(([name, measure]) => [name, { measure, file: '2022_23' }]),
  ),
  historical2022: { ...measures },
});

describe('earnings dictionary check', () => {
  it('accepts all independently transcribed official cells', () => {
    expect(() => checkEarningsProvenance(dictionary())).not.toThrow();
  });
  it.each(Object.keys(measures))('detects drift for %s independently', (variable) => {
    for (const [from, to] of [
      ['2015-16', '2014-15'],
      ['2013-14', '2012-13'],
      ['2011-12', '2010-11'],
      ['CY2023', 'CY2024'],
      ['2024 dollars', '2025 dollars'],
    ]) {
      const data = dictionary();
      const cell = data.latest[variable]!;
      if (!cell.measure.includes(from!)) continue;
      cell.measure = cell.measure.replace(from!, to!);
      expect(() => checkEarningsProvenance(data)).toThrow(variable);
    }
    const data = dictionary();
    data.latest[variable]!.file = '2023_24';
    expect(() => checkEarningsProvenance(data)).toThrow(variable);
    delete data.latest[variable];
    expect(() => checkEarningsProvenance(data)).toThrow(variable);
  });
  it('rejects historical cell drift and malformed input', () => {
    const data = dictionary();
    data.historical2022.MD_EARN_WNE_P6 = 'NA';
    expect(() => checkEarningsProvenance(data)).toThrow('Institution_Cohort_Map');
    expect(() => checkEarningsProvenance({})).toThrow();
  });
  it('reads named XLSX sheets through ZIP/XML, including rich and inline strings', () => {
    const program = `
import io,json,sys,zipfile,xml.etree.ElementTree as E
d=json.load(sys.stdin); b=io.BytesIO(); ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main'
def sheet(rows):
 root=E.Element('worksheet',xmlns=ns); table=E.SubElement(root,'sheetData')
 for i,values in enumerate(rows,1):
  row=E.SubElement(table,'row',r=str(i))
  for column,value in values.items():
   cell=E.SubElement(row,'c',r=column+str(i),t='s' if value=='MD_EARN_WNE_P6' else 'inlineStr')
   if value=='MD_EARN_WNE_P6': E.SubElement(cell,'v').text='0'
   else: E.SubElement(E.SubElement(cell,'is'),'t').text=value
 return E.tostring(root)
with zipfile.ZipFile(b,'w') as z:
 z.writestr('xl/sharedStrings.xml','<sst xmlns="'+ns+'"><si><r><t>MD_EARN_</t></r><r><t>WNE_P6</t></r></si></sst>')
 z.writestr('xl/workbook.xml','<workbook xmlns="'+ns+'" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Most_Recent_Inst_Cohort_Map" r:id="r2"/><sheet name="Institution_Cohort_Map" r:id="r1"/></sheets></workbook>')
 z.writestr('xl/_rels/workbook.xml.rels','<Relationships><Relationship Id="r1" Target="worksheets/history.xml"/><Relationship Id="r2" Target="worksheets/recent.xml"/></Relationships>')
 z.writestr('xl/worksheets/recent.xml',sheet([{'A':k,'B':v['measure'],'C':v['file']} for k,v in d['latest'].items()]))
 z.writestr('xl/worksheets/history.xml',sheet([{'A':'variable','D':'Merged2022_23'}]+[{'A':k,'D':v} for k,v in d['historical2022'].items()]))
sys.stdout.buffer.write(b.getvalue())
`;
    const workbook = execFileSync('python3', ['-c', program], {
      input: JSON.stringify(dictionary()),
    });
    const parsed = readEarningsDictionary(workbook);
    expect(parsed).toMatchObject(dictionary());
    expect(() => checkEarningsProvenance(parsed)).not.toThrow();
    expect(() => readEarningsDictionary(new Uint8Array([1, 2, 3]))).toThrow();
  });
});
