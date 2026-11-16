import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Pool } from '@neondatabase/serverless';
import { MedicinesDb } from '../database/medicines.module.js';
import type {
  CustomMedicationDto,
  OverrideDto,
  RenewalLineDto,
  UpdateCustomMedicationDto,
} from './dto.js';
import {
  type CatalogRow,
  changedByAmmps,
  type CustomRow,
  fold,
  fromCustom,
  mergeCatalog,
  type OverrideRow,
  rankSuggestions,
  type Suggestion,
} from './merge.js';

const LIMIT = 20;
/** AMMPS rows read per search: room for several boxes per medicine. */
const CATALOG_ROWS = 80;

const CATALOG = `ammps_id as "ammpsId", name, substances, dosage, form, presentation, lab,
  availability::text as availability, ppv::text as ppv, is_active as "isActive"`;
const OVERRIDE = `ammps_id as "ammpsId", custom_name as "customName",
  custom_dosage as "customDosage", default_posology as "defaultPosology",
  default_duration as "defaultDuration", is_favorite as "isFavorite",
  is_hidden as "isHidden", base_name as "baseName", base_dosage as "baseDosage"`;
const CUSTOM = `id, name, substances, dosage, form, presentation,
  default_posology as "defaultPosology", default_duration as "defaultDuration",
  is_favorite as "isFavorite"`;
const CUSTOM_FIELDS = [
  ['name', 'name'],
  ['substances', 'substances'],
  ['dosage', 'dosage'],
  ['form', 'form'],
  ['presentation', 'presentation'],
  ['defaultPosology', 'default_posology'],
  ['defaultDuration', 'default_duration'],
  ['isFavorite', 'is_favorite'],
] as const;

/** "50%" typed by the doctor is searched for, not a wildcard. */
const like = (text: string) => text.replace(/[\\%_]/g, '\\$&');

/** At most this many words of what the doctor typed are matched. */
const MAX_WORDS = 5;

/**
 * "doliprane 1g" → each word must be found somewhere: in the name, the
 * substances, the dosage ("1 G" and "1g" alike) or the form. Returns the
 * SQL condition and its parameters, numbered from `from`.
 */
export function wordsMatch(words: string[], columns: { text: string[]; compact: string[] }, from: number) {
  const params: string[] = [];
  const clauses = words.map((word) => {
    params.push(`%${like(word)}%`, `%${like(word.replace(/\s+/g, ''))}%`);
    const text = from + params.length - 2;
    const compact = text + 1;
    return `(${[
      ...columns.text.map((c) => `coalesce(${c}, '') ilike $${text}`),
      ...columns.compact.map((c) => `replace(coalesce(${c}, ''), ' ', '') ilike $${compact}`),
    ].join(' or ')})`;
  });
  return { sql: clauses.join(' and '), params };
}

const isUniqueViolation = (err: unknown) => (err as { code?: string })?.code === '23505';

/**
 * Medicines for the ordonnance: the shared AMMPS list (read only) merged
 * with each doctor's overrides and own medicines (cabinet database). No
 * query ever joins the two databases: they are merged here, by AMMPS id.
 */
@Injectable()
export class MedicationsService {
  constructor(private readonly medicines: MedicinesDb) {}

  private get catalog(): Pool {
    if (!this.medicines.pool) {
      throw new ServiceUnavailableException({
        code: 'MEDICINES_UNAVAILABLE',
        message: 'La liste des médicaments AMMPS n’est pas disponible.',
      });
    }
    return this.medicines.pool;
  }

  private async catalogRows(ids: number[]): Promise<CatalogRow[]> {
    if (!ids.length) return [];
    const { rows } = await this.catalog.query<CatalogRow>(
      `select ${CATALOG} from medications where ammps_id = any($1::int[])`,
      [ids],
    );
    return rows;
  }

  /**
   * As the doctor types (2 letters or more): their own medicines and the
   * AMMPS list, merged with their overrides, favorites first. Without the
   * medicines database, their own medicines only (`catalog: false`).
   */
  async search(db: Pool, userId: string, query: string) {
    const q = fold(query);
    const words = q.split(/\s+/).filter(Boolean).slice(0, MAX_WORDS);
    const custom = wordsMatch(words, { text: ['name', 'substances', 'form'], compact: ['dosage'] }, 2);
    const renamed = wordsMatch(words, { text: ['custom_name'], compact: ['custom_dosage'] }, 2);
    const [customs, overrides] = await Promise.all([
      db.query<CustomRow>(
        `select ${CUSTOM} from custom_medications
          where practitioner_id = $1 and ${custom.sql}
          order by is_favorite desc, name limit ${LIMIT}`,
        [userId, ...custom.params],
      ),
      // Their own wording is searched too ("Doliprane" for DOLIPRANE).
      db.query<{ ammpsId: number }>(
        `select ammps_id as "ammpsId" from medication_overrides
          where practitioner_id = $1 and not is_hidden
            and custom_name is not null and ${renamed.sql}
          limit 30`,
        [userId, ...renamed.params],
      ),
    ]);
    const suggestions: Suggestion[] = customs.rows.map(fromCustom);

    if (!this.medicines.pool) {
      return { items: rankSuggestions(suggestions, q, LIMIT), catalog: false };
    }
    const found = wordsMatch(words, { text: ['name', 'substances', 'form'], compact: ['dosage'] }, 3);
    const { rows } = await this.catalog.query<CatalogRow>(
      `select ${CATALOG} from medications
        where is_active and availability <> 'withdrawn'
          and ((${found.sql}) or ammps_id = any($1::int[]))
        order by (ammps_id = any($1::int[])) desc,
                 (name ilike $2) desc, (substances ilike $2) desc,
                 (availability = 'marketed') desc, name, dosage
        limit ${CATALOG_ROWS}`,
      [overrides.rows.map((r) => r.ammpsId), `${like(words[0] ?? q)}%`, ...found.params],
    );
    // Every box of the medicines found, so the group is complete.
    const groups = await this.withSiblings(rows);
    const own = await this.overridesFor(db, userId, groups.map((r) => r.ammpsId));
    suggestions.push(...mergeCatalog(groups, own));
    return { items: rankSuggestions(suggestions, q, LIMIT), catalog: true };
  }

  /** The other boxes of the medicines found (same name, dosage and form). */
  private async withSiblings(rows: CatalogRow[]) {
    if (!rows.length) return rows;
    const { rows: all } = await this.catalog.query<CatalogRow>(
      `select ${CATALOG} from medications m
        where m.is_active and m.availability <> 'withdrawn'
          and (m.name, coalesce(m.dosage, ''), coalesce(m.form, '')) in (
            select name, coalesce(dosage, ''), coalesce(form, '')
              from medications where ammps_id = any($1::int[]))`,
      [rows.map((r) => r.ammpsId)],
    );
    return all;
  }

  private async overridesFor(db: Pool, userId: string, ids: number[]) {
    if (!ids.length) return [];
    const { rows } = await db.query<OverrideRow>(
      `select ${OVERRIDE} from medication_overrides
        where practitioner_id = $1 and ammps_id = any($2::int[])`,
      [userId, ids],
    );
    return rows;
  }

  /** The doctor's favorites, AMMPS and their own, by name. */
  async favorites(db: Pool, userId: string) {
    const [overrides, customs] = await Promise.all([
      db.query<OverrideRow>(
        `select ${OVERRIDE} from medication_overrides
          where practitioner_id = $1 and is_favorite and not is_hidden`,
        [userId],
      ),
      db.query<CustomRow>(
        `select ${CUSTOM} from custom_medications
          where practitioner_id = $1 and is_favorite order by name`,
        [userId],
      ),
    ]);
    const catalog = this.medicines.pool
      ? mergeCatalog(await this.catalogRows(overrides.rows.map((o) => o.ammpsId)), overrides.rows)
      : [];
    return [...catalog, ...customs.rows.map(fromCustom)].sort((a, b) =>
      a.name.localeCompare(b.name, 'fr'),
    );
  }

  /**
   * Everything the doctor set on AMMPS medicines, with the AMMPS values
   * next to theirs (and whether the AMMPS changed since), for "Mes médicaments".
   */
  async overrides(db: Pool, userId: string) {
    const { rows } = await db.query<OverrideRow & { updatedAt: string }>(
      `select ${OVERRIDE}, updated_at as "updatedAt" from medication_overrides
        where practitioner_id = $1 order by updated_at desc`,
      [userId],
    );
    const catalog = this.medicines.pool
      ? new Map((await this.catalogRows(rows.map((r) => r.ammpsId))).map((c) => [c.ammpsId, c]))
      : new Map<number, CatalogRow>();
    return rows.map((o) => {
      const ammps = catalog.get(o.ammpsId) ?? null;
      return { ...o, ammps, updatedByAmmps: ammps ? changedByAmmps(o, ammps) : false };
    });
  }

  /** The AMMPS medicine an override is about, or 404. */
  private async catalogRow(ammpsId: number) {
    const [row] = await this.catalogRows([ammpsId]);
    if (!row) {
      throw new NotFoundException({ code: 'MEDICATION_NOT_FOUND', message: 'Médicament introuvable dans la liste AMMPS.' });
    }
    return row;
  }

  /**
   * Saves the doctor's take on an AMMPS medicine; fields left out keep
   * their value. The AMMPS name and dosage are recorded with it, to tell
   * them later when the AMMPS changes what they renamed.
   */
  async saveOverride(db: Pool, userId: string, ammpsId: number, dto: OverrideDto) {
    const ammps = await this.catalogRow(ammpsId);
    const has = (k: keyof OverrideDto) => dto[k] !== undefined;
    const { rows } = await db.query<OverrideRow>(
      `insert into medication_overrides as o
         (practitioner_id, ammps_id, custom_name, custom_dosage, default_posology,
          default_duration, is_favorite, is_hidden, base_name, base_dosage)
       values ($1, $2, $3, $4, $5, $6, coalesce($7, false), coalesce($8, false), $9, $10)
       on conflict (practitioner_id, ammps_id) do update set
         custom_name = case when $11 then excluded.custom_name else o.custom_name end,
         custom_dosage = case when $12 then excluded.custom_dosage else o.custom_dosage end,
         default_posology = case when $13 then excluded.default_posology else o.default_posology end,
         default_duration = case when $14 then excluded.default_duration else o.default_duration end,
         is_favorite = coalesce($7, o.is_favorite),
         is_hidden = coalesce($8, o.is_hidden),
         base_name = excluded.base_name, base_dosage = excluded.base_dosage,
         updated_at = now()
       returning ${OVERRIDE}`,
      [
        userId,
        ammpsId,
        dto.customName ?? null,
        dto.customDosage ?? null,
        dto.defaultPosology ?? null,
        dto.defaultDuration ?? null,
        dto.isFavorite ?? null,
        dto.isHidden ?? null,
        ammps.name,
        ammps.dosage,
        has('customName'),
        has('customDosage'),
        has('defaultPosology'),
        has('defaultDuration'),
      ],
    );
    return { ...rows[0], ammps, updatedByAmmps: false };
  }

  /**
   * The doctor takes the AMMPS's new name or dosage: their wording for what
   * changed is dropped, the rest (posology, favorite) stays.
   */
  async acceptAmmps(db: Pool, userId: string, ammpsId: number) {
    const ammps = await this.catalogRow(ammpsId);
    const { rows } = await db.query<OverrideRow>(
      `update medication_overrides set
         custom_name = case when base_name is distinct from $3 then null else custom_name end,
         custom_dosage = case when base_dosage is distinct from $4 then null else custom_dosage end,
         base_name = $3, base_dosage = $4, updated_at = now()
       where practitioner_id = $1 and ammps_id = $2
       returning ${OVERRIDE}`,
      [userId, ammpsId, ammps.name, ammps.dosage],
    );
    if (!rows[0]) throw new NotFoundException({ code: 'OVERRIDE_NOT_FOUND', message: 'Aucune personnalisation pour ce médicament.' });
    return { ...rows[0], ammps, updatedByAmmps: false };
  }

  /** Back to the AMMPS values (and out of favorites, visible again). */
  async deleteOverride(db: Pool, userId: string, ammpsId: number) {
    await db.query(
      'delete from medication_overrides where practitioner_id = $1 and ammps_id = $2',
      [userId, ammpsId],
    );
  }

  async customList(db: Pool, userId: string) {
    const { rows } = await db.query<CustomRow>(
      `select ${CUSTOM} from custom_medications where practitioner_id = $1
        order by is_favorite desc, lower(name), dosage`,
      [userId],
    );
    return rows;
  }

  async createCustom(db: Pool, userId: string, dto: CustomMedicationDto) {
    try {
      const { rows } = await db.query<CustomRow>(
        `insert into custom_medications (practitioner_id, name, substances, dosage, form,
           presentation, default_posology, default_duration, is_favorite)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         returning ${CUSTOM}`,
        [
          userId,
          dto.name,
          dto.substances ?? null,
          dto.dosage ?? null,
          dto.form ?? null,
          dto.presentation ?? null,
          dto.defaultPosology ?? null,
          dto.defaultDuration ?? null,
          dto.isFavorite ?? false,
        ],
      );
      return rows[0];
    } catch (err) {
      throw this.duplicate(err, dto.name);
    }
  }

  async updateCustom(db: Pool, userId: string, id: string, dto: UpdateCustomMedicationDto) {
    const sets: string[] = [];
    const values: unknown[] = [id, userId];
    for (const [key, column] of CUSTOM_FIELDS) {
      if (dto[key] === undefined) continue;
      values.push(dto[key]);
      sets.push(`${column} = $${values.length}`);
    }
    try {
      const { rows } = await db.query<CustomRow>(
        `update custom_medications set ${[...sets, 'updated_at = now()'].join(', ')}
          where id = $1 and practitioner_id = $2 returning ${CUSTOM}`,
        values,
      );
      if (!rows[0]) throw new NotFoundException({ code: 'MEDICATION_NOT_FOUND', message: 'Médicament introuvable.' });
      return rows[0];
    } catch (err) {
      throw this.duplicate(err, dto.name ?? '');
    }
  }

  async deleteCustom(db: Pool, userId: string, id: string) {
    const { rowCount } = await db.query(
      'delete from custom_medications where id = $1 and practitioner_id = $2',
      [id, userId],
    );
    if (!rowCount) throw new NotFoundException({ code: 'MEDICATION_NOT_FOUND', message: 'Médicament introuvable.' });
  }

  private duplicate(err: unknown, name: string) {
    return isUniqueViolation(err)
      ? new ConflictException({ code: 'MEDICATION_EXISTS', message: `« ${name} » existe déjà dans vos médicaments.` })
      : err;
  }

  /**
   * Before renewing an old ordonnance: lines whose AMMPS medicine has been
   * withdrawn or suspended, or left the list, and lines whose own medicine
   * the doctor deleted. Warnings only: the doctor decides.
   */
  async checkRenewal(db: Pool, userId: string, items: RenewalLineDto[]) {
    const ammpsIds = [...new Set(items.map((i) => i.ammpsId).filter((id): id is number => !!id))];
    const customIds = [...new Set(items.map((i) => i.customMedicationId).filter((id): id is string => !!id))];
    const [catalog, customs] = await Promise.all([
      this.medicines.pool && ammpsIds.length ? this.catalogRows(ammpsIds) : Promise.resolve(null),
      customIds.length
        ? db.query<{ id: string }>(
            'select id from custom_medications where practitioner_id = $1 and id = any($2::uuid[])',
            [userId, customIds],
          )
        : Promise.resolve({ rows: [] }),
    ]);
    const byId = new Map((catalog ?? []).map((c) => [c.ammpsId, c]));
    const kept = new Set(customs.rows.map((c) => c.id));
    const warnings: { index: number; medication: string; reason: 'withdrawn' | 'removed' | 'deleted' }[] = [];
    items.forEach((item, index) => {
      if (item.ammpsId && catalog) {
        const row = byId.get(item.ammpsId);
        if (!row || !row.isActive) warnings.push({ index, medication: item.medication, reason: 'removed' });
        else if (row.availability === 'withdrawn') warnings.push({ index, medication: item.medication, reason: 'withdrawn' });
      } else if (item.customMedicationId && !kept.has(item.customMedicationId)) {
        warnings.push({ index, medication: item.medication, reason: 'deleted' });
      }
    });
    return { warnings, catalog: catalog !== null || !ammpsIds.length };
  }
}
