import { sql } from 'drizzle-orm';
import {
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { id, tenantId, tenantIsolation, timestamps } from './columns.js';
import { patients } from './patients.js';
import { tenants } from './tenants.js';
import { users } from './users.js';

export const appointmentStatus = pgEnum('appointment_status', [
  'scheduled', // planifié
  'confirmed', // confirmé par le patient
  'arrived', // en salle d'attente
  'completed', // vu
  'cancelled', // annulé
  'no_show', // absent
]);

export const appointments = pgTable(
  'appointments',
  {
    id: id(),
    tenantId: tenantId().references(() => tenants.id, { onDelete: 'cascade' }),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'restrict' }),
    /** The doctor seeing the patient. */
    practitionerId: uuid('practitioner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    status: appointmentStatus('status').notNull().default('scheduled'),
    /** Motif de consultation (short, visible on the agenda). */
    reason: text('reason'),
    /** Administrative note for the front desk. */
    notes: text('notes'),
    createdById: uuid('created_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    ...timestamps,
  },
  (t) => [
    check('appointments_time_order', sql`${t.endsAt} > ${t.startsAt}`),
    index('appointments_tenant_starts_idx').on(t.tenantId, t.startsAt),
    index('appointments_practitioner_starts_idx').on(
      t.practitionerId,
      t.startsAt,
    ),
    index('appointments_patient_idx').on(t.patientId),
    tenantIsolation(),
  ],
);
