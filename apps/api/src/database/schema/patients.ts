import { sql } from 'drizzle-orm';
import {
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { id, tenantId, tenantIsolation, timestamps } from './columns.js';
import { tenants } from './tenants.js';
import { users } from './users.js';

// Administrative patient record. Medical data (allergies, history, vitals…)
// lives in the EMR tables, behind the emr:* permissions.

export const sex = pgEnum('sex', ['male', 'female']);

/** Moroccan health coverage schemes. */
export const coverage = pgEnum('coverage', [
  'none',
  'cnss',
  'cnops',
  'amo_tadamon',
  'far',
  'private',
]);

export const patients = pgTable(
  'patients',
  {
    id: id(),
    tenantId: tenantId().references(() => tenants.id, { onDelete: 'cascade' }),
    /** N° de dossier, sequential per clinic (tenant_counters "patient"). */
    fileNumber: integer('file_number').notNull(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    sex: sex('sex').notNull(),
    birthDate: date('birth_date'),
    /** Carte d'identité nationale */
    cin: text('cin'),
    phone: text('phone'),
    email: text('email'),
    address: text('address'),
    city: text('city'),
    coverage: coverage('coverage').notNull().default('none'),
    /** N° d'immatriculation / d'affiliation */
    coverageNumber: text('coverage_number'),
    /** Insurer name when coverage = private */
    insurer: text('insurer'),
    emergencyContactName: text('emergency_contact_name'),
    emergencyContactPhone: text('emergency_contact_phone'),
    /** Administrative note (never medical). */
    notes: text('notes'),
    /** Health records are never deleted, only archived. */
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdById: uuid('created_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('patients_tenant_file_number_idx').on(t.tenantId, t.fileNumber),
    uniqueIndex('patients_tenant_cin_idx')
      .on(t.tenantId, t.cin)
      .where(sql`${t.cin} is not null`),
    index('patients_tenant_name_idx').on(t.tenantId, t.lastName, t.firstName),
    tenantIsolation(),
  ],
);
