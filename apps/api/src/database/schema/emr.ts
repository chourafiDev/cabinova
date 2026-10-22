import {
  index,
  integer,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { appointments } from './appointments.js';
import { id, tenantId, tenantIsolation, timestamps } from './columns.js';
import { patients } from './patients.js';
import { tenants } from './tenants.js';
import { users } from './users.js';

// Dossier médical électronique (DME). Behind the emr:* permissions.

const tenantRef = () =>
  tenantId().references(() => tenants.id, { onDelete: 'cascade' });

export const bloodGroup = pgEnum('blood_group', [
  'A+',
  'A-',
  'B+',
  'B-',
  'AB+',
  'AB-',
  'O+',
  'O-',
]);

/** Antécédents: one per patient, shown on every consultation. */
export const medicalProfiles = pgTable(
  'medical_profiles',
  {
    patientId: uuid('patient_id')
      .primaryKey()
      .references(() => patients.id, { onDelete: 'cascade' }),
    tenantId: tenantRef(),
    bloodGroup: bloodGroup('blood_group'),
    allergies: text('allergies'),
    chronicConditions: text('chronic_conditions'),
    medicalHistory: text('medical_history'),
    surgicalHistory: text('surgical_history'),
    familyHistory: text('family_history'),
    currentTreatments: text('current_treatments'),
    updatedById: uuid('updated_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    ...timestamps,
  },
  () => [tenantIsolation()],
);

export const consultationStatus = pgEnum('consultation_status', [
  'draft', // en cours, modifiable
  'completed', // clôturée, verrouillée
]);

export const consultations = pgTable(
  'consultations',
  {
    id: id(),
    tenantId: tenantRef(),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'restrict' }),
    /** Author: the practitioner of the appointment, or who started it. */
    practitionerId: uuid('practitioner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    appointmentId: uuid('appointment_id').references(() => appointments.id, {
      onDelete: 'set null',
    }),
    status: consultationStatus('status').notNull().default('draft'),
    startedAt: timestamp('started_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Clinical content
    reason: text('reason'),
    history: text('history'), // anamnèse
    examination: text('examination'), // examen clinique
    diagnosis: text('diagnosis'),
    plan: text('plan'), // conduite à tenir
    // Vital signs (constantes)
    weightKg: real('weight_kg'),
    heightCm: real('height_cm'),
    temperatureC: real('temperature_c'),
    systolic: integer('systolic'),
    diastolic: integer('diastolic'),
    heartRate: integer('heart_rate'),
    spo2: integer('spo2'),
    glycemia: real('glycemia'), // g/L
    completedAt: timestamp('completed_at', { withTimezone: true }),
    completedById: uuid('completed_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdById: uuid('created_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    ...timestamps,
  },
  (t) => [
    // One consultation per appointment.
    uniqueIndex('consultations_appointment_idx').on(t.appointmentId),
    index('consultations_tenant_started_idx').on(t.tenantId, t.startedAt),
    index('consultations_patient_idx').on(t.patientId),
    tenantIsolation(),
  ],
);
