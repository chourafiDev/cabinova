import { strToU8, zipSync } from 'fflate';

/** The AMMPS export's header row. */
export const HEADER = [
  'ID AMMPS',
  'Nom commercial',
  'Substance active',
  'Dosage',
  'Forme',
  'Présentation',
  'Laboratoire (EPI)',
  'Statut commercialisation',
  'PPV (DH)',
  'PH (DH)',
];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const col = (i: number) => String.fromCharCode(65 + i);

/** A minimal .xlsx: cells as inline strings (like the AMMPS export) or shared strings (like Excel). */
export function xlsx(rows: (string | number | null)[][], style: 'inline' | 'shared' = 'inline') {
  const shared: string[] = [];
  const sheetRows = rows
    .map((row, r) => {
      const cells = row
        .map((v, c) => {
          if (v === null) return '';
          const ref = `${col(c)}${r + 1}`;
          if (typeof v === 'number') return `<c r="${ref}"><v>${v}</v></c>`;
          if (style === 'shared') {
            shared.push(v);
            return `<c r="${ref}" t="s"><v>${shared.length - 1}</v></c>`;
          }
          return `<c r="${ref}" t="inlineStr"><is><t>${esc(v)}</t></is></c>`;
        })
        .join('');
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join('');
  const ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
  const files: Record<string, Uint8Array> = {
    'xl/workbook.xml': strToU8(
      `<workbook ${ns} xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Medicaments" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `<Relationships><Relationship Id="rId1" Type="worksheet" Target="worksheets/data.xml"/></Relationships>`,
    ),
    'xl/worksheets/data.xml': strToU8(`<worksheet ${ns}><sheetData>${sheetRows}</sheetData></worksheet>`),
  };
  if (style === 'shared') {
    files['xl/sharedStrings.xml'] = strToU8(
      `<sst ${ns}>${shared.map((s) => `<si><t xml:space="preserve">${esc(s)}</t></si>`).join('')}</sst>`,
    );
  }
  return zipSync(files);
}
