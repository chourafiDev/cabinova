import { strFromU8, unzipSync } from 'fflate';

// Reads the AMMPS export (.xlsx) a Super Admin uploads: one sheet, a header
// row ("ID AMMPS", "Nom commercial", "Substance active"…), one medicine per
// row. Pure (bytes in, rows out) so it is tested without a database.

export type Availability = 'marketed' | 'not_marketed' | 'withdrawn';

/** One medicine as the file gives it, cleaned. */
export type AmmpsRow = {
  ammpsId: number;
  name: string;
  substances: string;
  dosage: string | null;
  form: string | null;
  presentation: string | null;
  lab: string | null;
  status: string | null;
  availability: Availability;
  /** DH, 2 decimals, as a string for the numeric column ("13.10"). */
  ppv: string | null;
  ph: string | null;
};

export type AmmpsFile = {
  rows: AmmpsRow[];
  /** Lines (1-based, as in Excel) left out, and why. */
  skipped: { line: number; reason: string }[];
  /** Lines repeating an AMMPS id already read (the first one is kept). */
  duplicates: number;
};

/** A file the reader refuses, with a message for the Super Admin. */
export class AmmpsFileError extends Error {}

/** Upload ceiling, and how big the unzipped sheet may get (zip bombs). */
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_XML_BYTES = 150 * 1024 * 1024;

type Field = Exclude<keyof AmmpsRow, 'availability'>;

/** Each column by its header, accents, case and "(DH)" aside. */
const HEADERS: Record<string, Field> = {
  'id ammps': 'ammpsId',
  id: 'ammpsId',
  'nom commercial': 'name',
  nom: 'name',
  'substance active': 'substances',
  'substances actives': 'substances',
  dci: 'substances',
  dosage: 'dosage',
  forme: 'form',
  presentation: 'presentation',
  'laboratoire (epi)': 'lab',
  laboratoire: 'lab',
  epi: 'lab',
  'statut commercialisation': 'status',
  statut: 'status',
  ppv: 'ppv',
  ph: 'ph',
};
const REQUIRED: { field: Field; label: string }[] = [
  { field: 'ammpsId', label: 'ID AMMPS' },
  { field: 'name', label: 'Nom commercial' },
  { field: 'substances', label: 'Substance active' },
];

const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\(dh\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Collapses spaces and line breaks; empty → null. */
const clean = (value: string | undefined) => {
  const text = (value ?? '').replace(/\s+/g, ' ').trim();
  return text || null;
};

/**
 * A price as the AMMPS writes it, to a numeric string with 2 decimals:
 * 4303 / "4303" → "4303.00"; "4.303.00 DH" → "4303.00"; "10,70 DH" → "10.70";
 * "1.200,50 DH" → "1200.50"; "SANS PPV DH" or empty → null.
 */
export function parsePrice(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  let text = String(value).replace(/dh/gi, '').replace(/\s+/g, '');
  if (!/\d/.test(text)) return null;
  if (text.includes(',')) {
    // "1.200,50": dots group thousands, the comma is the decimal mark.
    text = text.replace(/\./g, '').replace(',', '.');
  } else if ((text.match(/\./g) ?? []).length > 1) {
    // "4.303.00": only the last dot is the decimal mark.
    const last = text.lastIndexOf('.');
    text = text.slice(0, last).replace(/\./g, '') + text.slice(last);
  }
  text = text.replace(/[^\d.-]/g, '');
  const n = Number(text);
  return Number.isFinite(n) && n >= 0 ? n.toFixed(2) : null;
}

/**
 * Where a medicine stands, from the AMMPS status: withdrawn or suspended,
 * marketed (also for tenders, "AO", and export), or authorised but not on
 * the market (no price yet, price being set, unknown status).
 */
export function availabilityOf(status: string | null): Availability {
  const s = fold(status ?? '');
  if (s.includes('retire') || s.includes('suspendu')) return 'withdrawn';
  if (s.startsWith('commercialise')) return 'marketed';
  return 'not_marketed';
}

const decodeXml = (text: string) =>
  text.replace(
    /&(?:#x([0-9a-f]+)|#(\d+)|(amp|lt|gt|quot|apos));/gi,
    (_, hex: string, dec: string, name: string) =>
      hex
        ? String.fromCodePoint(parseInt(hex, 16))
        : dec
          ? String.fromCodePoint(Number(dec))
          : ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" } as const)[
              name.toLowerCase() as 'amp'
            ],
  );

/** The text of every <t> inside an XML fragment (rich text has several runs). */
const textOf = (xml: string) =>
  [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
    .map((m) => decodeXml(m[1]))
    .join('');

/** "BC12" → 54 (A = 0). */
const columnIndex = (ref: string) => {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? 'A';
  let n = 0;
  for (let i = 0; i < letters.length; i++) n = n * 26 + letters.charCodeAt(i) - 64;
  return n - 1;
};

/** The workbook's first sheet, as rows of cell texts (by column). */
function readFirstSheet(bytes: Uint8Array): string[][] {
  let files: Record<string, Uint8Array>;
  let tooBig = false;
  try {
    files = unzipSync(bytes, {
      filter: (file) => {
        if (file.originalSize > MAX_XML_BYTES) tooBig = true;
        return (
          !tooBig &&
          (file.name === 'xl/workbook.xml' ||
            file.name === 'xl/_rels/workbook.xml.rels' ||
            file.name === 'xl/sharedStrings.xml' ||
            file.name.startsWith('xl/worksheets/'))
        );
      },
    });
  } catch {
    throw new AmmpsFileError('Fichier illisible : ce n’est pas un fichier Excel (.xlsx).');
  }
  if (tooBig) throw new AmmpsFileError('Fichier trop volumineux une fois décompressé.');
  const xml = (name: string) => (files[name] ? strFromU8(files[name]) : null);

  // The first <sheet> of the workbook, through its relationship.
  const workbook = xml('xl/workbook.xml');
  if (!workbook) throw new AmmpsFileError('Fichier illisible : ce n’est pas un fichier Excel (.xlsx).');
  const rid = /<sheet\b[^>]*\br:id="([^"]+)"/.exec(workbook)?.[1];
  const target = rid
    ? new RegExp(`<Relationship\\b[^>]*Id="${rid}"[^>]*Target="([^"]+)"`).exec(
        xml('xl/_rels/workbook.xml.rels') ?? '',
      )?.[1] ??
      new RegExp(`<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="${rid}"`).exec(
        xml('xl/_rels/workbook.xml.rels') ?? '',
      )?.[1]
    : undefined;
  const path = target
    ? target.startsWith('/')
      ? target.slice(1)
      : `xl/${target.replace(/^\.\//, '')}`
    : 'xl/worksheets/sheet1.xml';
  const sheet = xml(path);
  if (!sheet) throw new AmmpsFileError('Le fichier ne contient aucune feuille.');

  // Shared strings (most Excel exports), else inline strings (generated files).
  const shared = [...(xml('xl/sharedStrings.xml') ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(
    (m) => textOf(m[1]),
  );

  const rows: string[][] = [];
  for (const row of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = [];
    let next = 0;
    for (const cell of row[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cell[1];
      const body = cell[2] ?? '';
      const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1];
      const at = ref ? columnIndex(ref) : next;
      next = at + 1;
      const type = /\bt="([^"]+)"/.exec(attrs)?.[1];
      const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      cells[at] =
        type === 'inlineStr'
          ? textOf(body)
          : type === 's'
            ? (shared[Number(v)] ?? '')
            : decodeXml(v ?? '');
    }
    rows.push(Array.from(cells, (c) => c ?? ''));
  }
  return rows;
}

/** Reads the AMMPS export; throws AmmpsFileError when it can't be used. */
export function readAmmpsFile(bytes: Uint8Array): AmmpsFile {
  if (bytes.byteLength > MAX_FILE_BYTES) {
    throw new AmmpsFileError('Fichier trop volumineux (20 Mo au maximum).');
  }
  const [header, ...lines] = readFirstSheet(bytes);
  if (!header) throw new AmmpsFileError('La feuille est vide.');

  const columns = new Map<Field, number>();
  header.forEach((title, i) => {
    const field = HEADERS[fold(title)];
    if (field && !columns.has(field)) columns.set(field, i);
  });
  const missing = REQUIRED.filter((r) => !columns.has(r.field)).map((r) => r.label);
  if (missing.length) {
    throw new AmmpsFileError(`Colonnes manquantes : ${missing.join(', ')}.`);
  }
  const get = (line: string[], field: Field) => {
    const i = columns.get(field);
    return i === undefined ? undefined : line[i];
  };

  const rows: AmmpsRow[] = [];
  const skipped: AmmpsFile['skipped'] = [];
  const seen = new Set<number>();
  let duplicates = 0;
  lines.forEach((line, i) => {
    const lineNumber = i + 2;
    if (line.every((c) => !c.trim())) return;
    const rawId = clean(get(line, 'ammpsId')) ?? '';
    const ammpsId = Number(rawId);
    if (!/^\d+$/.test(rawId) || !Number.isSafeInteger(ammpsId) || ammpsId <= 0) {
      skipped.push({ line: lineNumber, reason: `ID AMMPS invalide (« ${rawId} »)` });
      return;
    }
    const name = clean(get(line, 'name'));
    const substances = clean(get(line, 'substances'));
    if (!name || !substances) {
      skipped.push({
        line: lineNumber,
        reason: !name ? 'Nom commercial manquant' : 'Substance active manquante',
      });
      return;
    }
    if (seen.has(ammpsId)) {
      duplicates++;
      return;
    }
    seen.add(ammpsId);
    const status = clean(get(line, 'status'));
    rows.push({
      ammpsId,
      name,
      substances,
      dosage: clean(get(line, 'dosage')),
      form: clean(get(line, 'form')),
      presentation: clean(get(line, 'presentation')),
      lab: clean(get(line, 'lab')),
      status,
      availability: availabilityOf(status),
      ppv: parsePrice(get(line, 'ppv')),
      ph: parsePrice(get(line, 'ph')),
    });
  });

  if (!rows.length) throw new AmmpsFileError('Aucun médicament lisible dans le fichier.');
  return { rows, skipped, duplicates };
}
