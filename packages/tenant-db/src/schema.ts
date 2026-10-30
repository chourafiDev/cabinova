import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgSequence,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// A clinic's own database — one per cabinet (Module 4). This is the
// baseline admin-api provisions: the clinic's profile and its first user,
// the responsible doctor. The clinic dashboard extends it (patients,
// agenda, consultations…) with new migrations in this package; admin-api
// rolls them out to every clinic. No tenant_id anywhere: the database
// itself is the tenant boundary.

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/** Single row: the clinic's identity, copied from the catalog at provisioning. */
export const clinicSettings = pgTable(
  'clinic_settings',
  {
    id: smallint('id').primaryKey().default(1),
    name: text('name').notNull(),
    legalName: text('legal_name'),
    specialty: text('specialty'),
    address: text('address'),
    city: text('city'),
    phone: text('phone'),
    email: text('email').notNull(),
    locale: text('locale').notNull().default('fr'),
    timezone: text('timezone').notNull().default('Africa/Casablanca'),
    /** Pre-selected duration when booking (Paramètres › Horaires & agenda). */
    defaultAppointmentMinutes: smallint('default_appointment_minutes')
      .notNull()
      .default(30),
    /** Opening hours saved or accepted (getting-started checklist). */
    hoursConfirmedAt: timestamp('hours_confirmed_at', { withTimezone: true }),
    /** Staff must use two-factor sign-in (Équipe). */
    requireTwoFactor: boolean('require_two_factor').notNull().default(false),
    /** The responsible doctor hid the getting-started checklist. */
    checklistDismissedAt: timestamp('checklist_dismissed_at', {
      withTimezone: true,
    }),
    ...timestamps,
  },
  (t) => [check('clinic_settings_single_row', sql`${t.id} = 1`)],
);

/** Clinic staff accounts. The first one is the responsible doctor (owner). */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    passwordHash: text('password_hash'),
    /** "owner" for the responsible doctor; staff roles come with the clinic app. */
    role: text('role').notNull(),
    active: boolean('active').notNull().default(true),
    /** SHA-256 of the invitation token; cleared once the password is set. */
    inviteTokenHash: text('invite_token_hash').unique(),
    inviteExpiresAt: timestamp('invite_expires_at', { withTimezone: true }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    /** First-sign-in product tour finished or skipped (clinic app). */
    tourCompletedAt: timestamp('tour_completed_at', { withTimezone: true }),
    /**
     * Two-factor sign-in: the TOTP secret is encrypted with the master key,
     * set at enrolment and active only once totpEnabledAt is set.
     */
    totpSecret: text('totp_secret'),
    totpKeyVersion: integer('totp_key_version'),
    totpEnabledAt: timestamp('totp_enabled_at', { withTimezone: true }),
    /** Last step accepted: a code can't be used twice. */
    totpLastStep: integer('totp_last_step'),
    /** SHA-256 of the unused backup codes. */
    recoveryCodeHashes: jsonb('recovery_code_hashes')
      .$type<string[]>()
      .notNull()
      .default([]),
    /** The space this person last worked in (reopened at sign-in). */
    lastSpaceId: uuid('last_space_id').references((): AnyPgColumn => spaces.id, {
      onDelete: 'set null',
    }),
    ...timestamps,
  },
  (t) => [uniqueIndex('users_email_idx').on(t.email)],
);

/**
 * Signed-in clinic staff. Only the SHA-256 of the cookie token is stored;
 * the session lives in the clinic's own database, so a cookie can never
 * open another cabinet.
 */
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  userAgent: text('user_agent'),
  ip: text('ip'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Weekly opening hours, keyed by day (Date.getDay(): "0" = Sunday). Each
 * day lists its opening periods ("HH:MM", local time), e.g. a lunch break
 * splits it in two; an empty list means closed.
 */
export type OpeningHours = Record<
  '0' | '1' | '2' | '3' | '4' | '5' | '6',
  { from: string; to: string }[]
>;

const DEFAULT_OPENING_HOURS: OpeningHours = {
  '0': [],
  '1': [{ from: '08:00', to: '18:00' }],
  '2': [{ from: '08:00', to: '18:00' }],
  '3': [{ from: '08:00', to: '18:00' }],
  '4': [{ from: '08:00', to: '18:00' }],
  '5': [{ from: '08:00', to: '18:00' }],
  '6': [{ from: '08:00', to: '13:00' }],
};

// ── Spaces ────────────────────────────────────────────────────────────────

/**
 * A cabinet's spaces (branches: Fès, Marrakech…). Fully isolated: patients,
 * appointments and staff of one space are invisible from another. The
 * responsible doctor (owner) can enter every space. Every cabinet has at
 * least one ("Espace principal", created by migration 0004).
 */
export const spaces = pgTable('spaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  city: text('city'),
  address: text('address'),
  phone: text('phone'),
  /** Shown on the agenda; booking outside them only gets a warning. */
  openingHours: jsonb('opening_hours')
    .$type<OpeningHours>()
    .notNull()
    .default(DEFAULT_OPENING_HOURS),
  /** Closed spaces keep their data, read by nobody but the owner. */
  active: boolean('active').notNull().default(true),
  ...timestamps,
});

/** Who works in which space (the owner works in all of them). */
export const spaceMembers = pgTable(
  'space_members',
  {
    spaceId: uuid('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.spaceId, t.userId] })],
);

// ── Patients ──────────────────────────────────────────────────────────────

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

/**
 * Administrative patient record. Medical background lives in
 * medical_profiles, readable by doctors only. Records are never deleted,
 * only archived.
 */
export const patients = pgTable(
  'patients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** The space the file belongs to: invisible from the others. */
    spaceId: uuid('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'restrict' }),
    /** N° de dossier: sequential, generated by the database (no duplicates under load). */
    fileNumber: integer('file_number').generatedAlwaysAsIdentity().unique(),
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
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    ...timestamps,
  },
  (t) => [
    // The same person may have a file in each space they visit.
    uniqueIndex('patients_space_cin_idx')
      .on(t.spaceId, t.cin)
      .where(sql`${t.cin} is not null`),
    index('patients_space_name_idx').on(t.spaceId, t.lastName, t.firstName),
  ],
);

/** Antécédents: one per patient, doctors only. */
export const medicalProfiles = pgTable('medical_profiles', {
  patientId: uuid('patient_id')
    .primaryKey()
    .references(() => patients.id, { onDelete: 'cascade' }),
  bloodGroup: bloodGroup('blood_group'),
  allergies: text('allergies'),
  chronicConditions: text('chronic_conditions'),
  medicalHistory: text('medical_history'),
  surgicalHistory: text('surgical_history'),
  familyHistory: text('family_history'),
  currentTreatments: text('current_treatments'),
  updatedBy: uuid('updated_by').references(() => users.id, {
    onDelete: 'set null',
  }),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── Agenda ────────────────────────────────────────────────────────────────

export const appointmentStatus = pgEnum('appointment_status', [
  'scheduled', // planifié
  'confirmed', // confirmé par le patient
  'arrived', // en salle d'attente
  'in_consultation', // avec le médecin
  'completed', // vu
  'no_show', // absent
  'cancelled', // annulé
]);

/**
 * Appointments of a space's agenda. The patient belongs to the same space;
 * a practitioner can't be booked twice at the same time, in any space.
 */
export const appointments = pgTable(
  'appointments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    spaceId: uuid('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'restrict' }),
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
    /** Motif (short, shown on the agenda). */
    reason: text('reason'),
    /** Front-desk note (never medical). */
    notes: text('notes'),
    /** Checked in at the front desk (waiting room order). */
    arrivedAt: timestamp('arrived_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    ...timestamps,
  },
  (t) => [
    check('appointments_time_order', sql`${t.endsAt} > ${t.startsAt}`),
    index('appointments_space_starts_idx').on(t.spaceId, t.startsAt),
    index('appointments_practitioner_starts_idx').on(
      t.practitionerId,
      t.startsAt,
    ),
    index('appointments_patient_idx').on(t.patientId),
  ],
);

// ── Encaissements ─────────────────────────────────────────────────────────
// Amounts are integers in centimes of MAD, like the platform's invoices.

/** The cabinet's price list (Paramètres › Tarifs), used when checking out a visit. */
export const acts = pgTable(
  'acts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    price: integer('price').notNull(),
    /** Archived acts stay on past visits but are no longer offered. */
    active: boolean('active').notNull().default(true),
    ...timestamps,
  },
  (t) => [
    check('acts_price_positive', sql`${t.price} >= 0`),
    uniqueIndex('acts_name_idx').on(sql`lower(${t.name})`),
  ],
);

/**
 * What a visit costs (honoraires): one per appointment, its acts in
 * charge_items. The balance is the total minus what was paid.
 */
export const charges = pgTable(
  'charges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    spaceId: uuid('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'restrict' }),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'restrict' }),
    appointmentId: uuid('appointment_id')
      .notNull()
      .unique()
      .references(() => appointments.id, { onDelete: 'restrict' }),
    /** The doctor of the visit (revenue per doctor). */
    practitionerId: uuid('practitioner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    total: integer('total').notNull(),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    ...timestamps,
  },
  (t) => [
    check('charges_total_positive', sql`${t.total} >= 0`),
    index('charges_patient_idx').on(t.patientId),
    index('charges_space_idx').on(t.spaceId),
  ],
);

/** The acts of a visit, label and price copied so later price changes don't rewrite history. */
export const chargeItems = pgTable(
  'charge_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    chargeId: uuid('charge_id')
      .notNull()
      .references(() => charges.id, { onDelete: 'cascade' }),
    actId: uuid('act_id').references(() => acts.id, { onDelete: 'set null' }),
    label: text('label').notNull(),
    unitPrice: integer('unit_price').notNull(),
    quantity: smallint('quantity').notNull().default(1),
    position: smallint('position').notNull().default(0),
  },
  (t) => [
    check('charge_items_price_positive', sql`${t.unitPrice} >= 0`),
    check('charge_items_quantity_positive', sql`${t.quantity} > 0`),
    index('charge_items_charge_idx').on(t.chargeId),
  ],
);

export const paymentMethod = pgEnum('payment_method', [
  'cash', // espèces
  'card', // carte bancaire
  'cheque',
  'transfer', // virement
]);

export const paymentKind = pgEnum('payment_kind', ['payment', 'refund']);

/** Receipt numbers ("R-2026-000042"), one series for the cabinet. */
export const receiptNumberSeq = pgSequence('receipt_number_seq');

/**
 * Money received for a visit, or given back (refund). Never deleted: a
 * mistake is cancelled with a reason; a closed day can't change.
 */
export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    spaceId: uuid('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'restrict' }),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'restrict' }),
    chargeId: uuid('charge_id')
      .notNull()
      .references(() => charges.id, { onDelete: 'restrict' }),
    kind: paymentKind('kind').notNull().default('payment'),
    method: paymentMethod('method').notNull(),
    /** Always positive; a refund takes money out. */
    amount: integer('amount').notNull(),
    /** Cheque number, transfer reference… */
    reference: text('reference'),
    /** Payments only (refunds have none). */
    receiptNumber: text('receipt_number').unique(),
    /** Refunds: why. */
    reason: text('reason'),
    receivedAt: timestamp('received_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    receivedBy: uuid('received_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelledBy: uuid('cancelled_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    cancelReason: text('cancel_reason'),
  },
  (t) => [
    check('payments_amount_positive', sql`${t.amount} > 0`),
    index('payments_space_received_idx').on(t.spaceId, t.receivedAt),
    index('payments_charge_idx').on(t.chargeId),
    index('payments_patient_idx').on(t.patientId),
  ],
);

/**
 * Clôture de caisse: a space's day, closed once. The desk counts the cash
 * without seeing what's expected; the owner sees the difference.
 */
export const cashCloses = pgTable(
  'cash_closes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    spaceId: uuid('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'restrict' }),
    /** The Moroccan day closed. */
    day: date('day').notNull(),
    /** Net received per method that day (payments minus refunds). */
    expected: jsonb('expected')
      .$type<Record<'cash' | 'card' | 'cheque' | 'transfer', number>>()
      .notNull(),
    countedCash: integer('counted_cash').notNull(),
    note: text('note'),
    closedBy: uuid('closed_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    closedAt: timestamp('closed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex('cash_closes_space_day_idx').on(t.spaceId, t.day)],
);

// ── Notifications ─────────────────────────────────────────────────────────

/**
 * The bell: one row per recipient. `dedupeKey` keeps one event from arriving
 * twice ("appointment:<id>:arrived", "quote:<id>"…).
 */
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** "arrived" | "no_show" | "cancelled" | "team" | "billing" */
    kind: text('kind').notNull(),
    title: text('title').notNull(),
    body: text('body'),
    /** Where the notification leads in the app. */
    href: text('href'),
    dedupeKey: text('dedupe_key').notNull(),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('notifications_user_key_idx').on(t.userId, t.dedupeKey),
    index('notifications_user_idx').on(t.userId, t.createdAt),
  ],
);

/** Between the password and the second-factor code; no session exists yet. */
export const twoFactorChallenges = pgTable('two_factor_challenges', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  remember: boolean('remember').notNull().default(true),
  attempts: integer('attempts').notNull().default(0),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
