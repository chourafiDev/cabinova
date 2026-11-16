// What a doctor sees when looking for a medicine: the AMMPS list (shared
// medicines database) merged with their own take on it (overrides) and
// their own products (custom medicines). Pure functions: the service reads
// both databases, this decides — so the rules are tested on their own.

export type Availability = 'marketed' | 'not_marketed' | 'withdrawn';

/** A row of the shared AMMPS list. */
export type CatalogRow = {
  ammpsId: number;
  name: string;
  substances: string;
  dosage: string | null;
  form: string | null;
  presentation: string | null;
  lab: string | null;
  availability: Availability;
  ppv: string | null;
  isActive: boolean;
};

/** A doctor's override of one AMMPS medicine (cabinet database). */
export type OverrideRow = {
  ammpsId: number;
  customName: string | null;
  customDosage: string | null;
  defaultPosology: string | null;
  defaultDuration: string | null;
  isFavorite: boolean;
  isHidden: boolean;
  baseName: string | null;
  baseDosage: string | null;
};

/** A doctor's own medicine, outside the AMMPS list. */
export type CustomRow = {
  id: string;
  name: string;
  substances: string | null;
  dosage: string | null;
  form: string | null;
  presentation: string | null;
  defaultPosology: string | null;
  defaultDuration: string | null;
  isFavorite: boolean;
};

/** One box of a medicine (the AMMPS lists each box size apart). */
export type Presentation = {
  ammpsId: number;
  presentation: string | null;
  lab: string | null;
  ppv: string | null;
  availability: Availability;
};

/** What the ordonnance suggests. */
export type Suggestion = {
  source: 'ammps' | 'custom';
  /** Stable for the list ("ammps:563", "custom:<uuid>"). */
  key: string;
  ammpsId: number | null;
  customMedicationId: string | null;
  name: string;
  dosage: string | null;
  form: string | null;
  substances: string | null;
  /** What the ordonnance line prints: "Doliprane 1 G, comprimé sécable". */
  label: string;
  availability: Availability | null;
  /** The cheapest public price among the boxes, DH. */
  ppv: string | null;
  /** Every box of this medicine (same name, dosage and form). */
  presentations: Presentation[];
  defaultPosology: string | null;
  defaultDuration: string | null;
  isFavorite: boolean;
  /** The doctor renamed it, and the AMMPS has since changed its name or dosage. */
  updatedByAmmps: boolean;
};

/** The form as the AMMPS writes it, lower-cased for the printed label. */
const lower = (text: string | null) => (text ? text.toLowerCase() : null);

/** "DOLIPRANE" + "1 G" + "COMPRIME SECABLE" → "DOLIPRANE 1 G, comprime secable". */
export const labelOf = (name: string, dosage: string | null, form: string | null) =>
  [name, dosage].filter(Boolean).join(' ') + (form ? `, ${lower(form)}` : '');

/** Accents and case aside, for matching what the doctor types. */
export const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

/** Whether the AMMPS changed what the doctor had renamed. */
export function changedByAmmps(override: OverrideRow, row: Pick<CatalogRow, 'name' | 'dosage'>) {
  if (!override.customName && !override.customDosage) return false;
  if (override.baseName === null && override.baseDosage === null) return false;
  return (
    (override.customName !== null && override.baseName !== row.name) ||
    (override.customDosage !== null && override.baseDosage !== row.dosage)
  );
}

const AVAILABILITY_ORDER: Record<Availability, number> = { marketed: 0, not_marketed: 1, withdrawn: 2 };

/** The box the line points at by default: marketed first, then with a price, then the cheapest. */
const byPreference = (a: Presentation, b: Presentation) =>
  AVAILABILITY_ORDER[a.availability] - AVAILABILITY_ORDER[b.availability] ||
  Number(a.ppv === null) - Number(b.ppv === null) ||
  Number(a.ppv ?? 0) - Number(b.ppv ?? 0) ||
  a.ammpsId - b.ammpsId;

/**
 * The AMMPS rows grouped as a doctor thinks of them — one "DOLIPRANE 1 G,
 * comprimé sécable", whatever the box size — with their overrides applied:
 * their name and dosage win, hidden ones are left out, withdrawn and
 * inactive ones never offered. `order` is the catalog's relevance order.
 */
export function mergeCatalog(rows: CatalogRow[], overrides: OverrideRow[]): Suggestion[] {
  const byId = new Map(overrides.map((o) => [o.ammpsId, o]));
  const groups = new Map<string, CatalogRow[]>();
  for (const row of rows) {
    if (!row.isActive || row.availability === 'withdrawn') continue;
    const key = [row.name, row.dosage ?? '', row.form ?? ''].join('\u0000');
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  const out: Suggestion[] = [];
  for (const members of groups.values()) {
    const presentations = members
      .map((m) => ({
        ammpsId: m.ammpsId,
        presentation: m.presentation,
        lab: m.lab,
        ppv: m.ppv,
        availability: m.availability,
      }))
      .sort(byPreference);
    // The doctor's override, on whichever box they saved it.
    const override = presentations.map((p) => byId.get(p.ammpsId)).find(Boolean);
    if (override?.isHidden) continue;
    const main =
      members.find((m) => m.ammpsId === override?.ammpsId) ??
      members.find((m) => m.ammpsId === presentations[0].ammpsId)!;
    const name = override?.customName ?? main.name;
    const dosage = override?.customDosage ?? main.dosage;
    const prices = presentations.map((p) => p.ppv).filter((p): p is string => p !== null);
    out.push({
      source: 'ammps',
      key: `ammps:${main.ammpsId}`,
      ammpsId: main.ammpsId,
      customMedicationId: null,
      name,
      dosage,
      form: main.form,
      substances: main.substances,
      label: labelOf(name, dosage, main.form),
      availability: presentations.some((p) => p.availability === 'marketed') ? 'marketed' : main.availability,
      ppv: prices.length ? prices.reduce((a, b) => (Number(b) < Number(a) ? b : a)) : null,
      presentations,
      defaultPosology: override?.defaultPosology ?? null,
      defaultDuration: override?.defaultDuration ?? null,
      isFavorite: override?.isFavorite ?? false,
      updatedByAmmps: override ? changedByAmmps(override, main) : false,
    });
  }
  return out;
}

/** A doctor's own medicine, as a suggestion. */
export function fromCustom(row: CustomRow): Suggestion {
  return {
    source: 'custom',
    key: `custom:${row.id}`,
    ammpsId: null,
    customMedicationId: row.id,
    name: row.name,
    dosage: row.dosage,
    form: row.form,
    substances: row.substances,
    label: labelOf(row.name, row.dosage, row.form),
    availability: null,
    ppv: null,
    presentations: [],
    defaultPosology: row.defaultPosology,
    defaultDuration: row.defaultDuration,
    isFavorite: row.isFavorite,
    updatedByAmmps: false,
  };
}

/**
 * How well a suggestion matches, on the first word typed (the others are
 * usually the dosage): its name starts with it, a word of it does, a
 * substance does, or it's further in.
 */
function rank(s: Suggestion, query: string) {
  const q = query.split(/\s+/)[0] ?? '';
  const name = fold(s.name);
  if (name.startsWith(q)) return 0;
  if (name.split(/[\s\-/]+/).some((w) => w.startsWith(q))) return 1;
  const substances = fold(s.substances ?? '');
  if (substances.split(/\s*\/\/\s*|\s+/).some((w) => w.startsWith(q))) return 2;
  return 3;
}

/**
 * The final list: favorites first, then the best matches, the doctor's own
 * medicines before the AMMPS at the same level, then by name.
 */
export function rankSuggestions(items: Suggestion[], query: string, limit: number) {
  const q = fold(query);
  return items
    .map((s) => ({ s, r: rank(s, q) }))
    .sort(
      (a, b) =>
        Number(b.s.isFavorite) - Number(a.s.isFavorite) ||
        a.r - b.r ||
        Number(a.s.source === 'ammps') - Number(b.s.source === 'ammps') ||
        AVAILABILITY_ORDER[a.s.availability ?? 'marketed'] - AVAILABILITY_ORDER[b.s.availability ?? 'marketed'] ||
        a.s.name.localeCompare(b.s.name, 'fr') ||
        (a.s.dosage ?? '').localeCompare(b.s.dosage ?? '', 'fr', { numeric: true }),
    )
    .slice(0, limit)
    .map(({ s }) => s);
}
