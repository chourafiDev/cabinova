import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  pgTable,
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
