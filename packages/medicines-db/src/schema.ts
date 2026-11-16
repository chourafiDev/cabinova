import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// The shared medicines database: the national list of the AMMPS (Agence
// Marocaine du Médicament et des Produits de Santé), one copy for every
// cabinet. Only admin-api writes here (a Super Admin imports the AMMPS
// export); clinics only read. No patient data, no clinic data: a clinic's
// own wording, favorites and custom medicines live in its own database,
// linked by `ammps_id` (no cross-database keys).

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/**
 * Where a medicine stands, from the AMMPS "Statut commercialisation":
 * marketed (incl. tenders and export), authorised but not marketed (or no
 * price yet), or withdrawn / suspended — never offered for a new ordonnance.
 */
export const medicationAvailability = pgEnum('medication_availability', [
  'marketed',
  'not_marketed',
  'withdrawn',
]);

/** One AMMPS medicine: a brand, dosage, form and box (presentation). */
export const medications = pgTable(
  'medications',
  {
    /** The AMMPS id (`#medicamentModal{id}` on ammps.gov.ma), the link to every clinic's data. */
    ammpsId: integer('ammps_id').primaryKey(),
    /** Nom commercial, as the AMMPS writes it ("DOLIPRANE"). */
    name: text('name').notNull(),
    /** Substance(s) active(s), several separated by " // ". */
    substances: text('substances').notNull(),
    dosage: text('dosage'),
    form: text('form'),
    presentation: text('presentation'),
    /** Laboratoire (EPI). */
    lab: text('lab'),
    /** The AMMPS status, verbatim ("Commercialisé AO", "Retiré du Marché"…). */
    status: text('status'),
    availability: medicationAvailability('availability').notNull(),
    /** Prix public de vente, DH; null when the AMMPS gives none. */
    ppv: numeric('ppv', { precision: 10, scale: 2 }),
    /** Prix hôpital, DH. */
    ph: numeric('ph', { precision: 10, scale: 2 }),
    /** In the latest import. Rows are never deleted: an old ordonnance may still point at one. */
    isActive: boolean('is_active').notNull().default(true),
    /** The import that last saw this medicine. */
    importId: uuid('import_id'),
    ...timestamps,
  },
  (t) => [
    // Autocomplete: prefix and anywhere-in-the-word, on the brand and the substances.
    index('medications_name_trgm_idx').using('gin', sql`${t.name} gin_trgm_ops`),
    index('medications_substances_trgm_idx').using(
      'gin',
      sql`${t.substances} gin_trgm_ops`,
    ),
  ],
);

export const medicationImportStatus = pgEnum('medication_import_status', [
  'running',
  'success',
  'failed',
]);

/** One import of the AMMPS export by a Super Admin, with what it changed. */
export const medicationImports = pgTable('medication_imports', {
  id: uuid('id').primaryKey().defaultRandom(),
  fileName: text('file_name').notNull(),
  status: medicationImportStatus('status').notNull().default('running'),
  /** Rows read from the file (after removing duplicates). */
  rowsRead: integer('rows_read').notNull().default(0),
  rowsInserted: integer('rows_inserted').notNull().default(0),
  rowsUpdated: integer('rows_updated').notNull().default(0),
  /** Medicines no longer in the file, marked inactive (never deleted). */
  rowsDeactivated: integer('rows_deactivated').notNull().default(0),
  /** Why it failed (unreadable file, safety threshold…). */
  error: text('error'),
  /** The Super Admin (platform user id; no key across databases) and their name at the time. */
  importedBy: uuid('imported_by'),
  importedByName: text('imported_by_name'),
  startedAt: timestamp('started_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
}, (t) => [
  // One import at a time: a second "running" row is refused by the database itself.
  uniqueIndex('medication_imports_one_running_idx')
    .on(t.status)
    .where(sql`${t.status} = 'running'`),
  index('medication_imports_started_idx').on(t.startedAt),
]);

export type Medication = typeof medications.$inferSelect;
export type MedicationImport = typeof medicationImports.$inferSelect;
