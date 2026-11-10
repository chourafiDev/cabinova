import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { id, timestamps } from './columns.js';
import { platformPermissions, platformRoles } from './platform-access.js';

// Central (platform) accounts — Super Admin, support and technical agents.
// Not a clinic's staff.

export const platformUsers = pgTable(
  'platform_users',
  {
    id: id(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    passwordHash: text('password_hash'),
    active: boolean('active').notNull().default(true),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    inviteTokenHash: text('invite_token_hash').unique(),
    inviteExpiresAt: timestamp('invite_expires_at', { withTimezone: true }),
    // Two-factor authentication (TOTP, authenticator app). The secret is
    // AES-GCM encrypted with the master key, never stored in clear; it's
    // set at enrolment and only active once totpEnabledAt is set.
    totpSecret: text('totp_secret'),
    totpKeyVersion: integer('totp_key_version'),
    totpEnabledAt: timestamp('totp_enabled_at', { withTimezone: true }),
    /** Last 30-second step accepted: a code can't be replayed. */
    totpLastStep: integer('totp_last_step'),
    /** SHA-256 of the unused backup codes (each works once). */
    recoveryCodeHashes: jsonb('recovery_code_hashes')
      .$type<string[]>()
      .notNull()
      .default([]),
    ...timestamps,
  },
  (t) => [uniqueIndex('platform_users_email_idx').on(t.email)],
);

export const platformUserRoles = pgTable(
  'platform_user_roles',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => platformUsers.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => platformRoles.id, { onDelete: 'restrict' }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.roleId] })],
);

export const overrideEffect = pgEnum('platform_permission_override_effect', [
  'grant',
  'deny',
]);

export const platformUserPermissionOverrides = pgTable(
  'platform_user_permission_overrides',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => platformUsers.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => platformPermissions.id, { onDelete: 'cascade' }),
    effect: overrideEffect('effect').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.permissionId] })],
);

/** Login sessions. Only the SHA-256 of the cookie token is stored. */
export const platformSessions = pgTable(
  'platform_sessions',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => platformUsers.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    userAgent: text('user_agent'),
    ip: text('ip'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('platform_sessions_user_idx').on(t.userId)],
);

/**
 * Second sign-in step: the password was right and the account has 2FA, so
 * the browser holds this short-lived challenge until it sends a valid code.
 */
export const platformMfaChallenges = pgTable(
  'platform_mfa_challenges',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => platformUsers.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    remember: boolean('remember').notNull().default(true),
    attempts: integer('attempts').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('platform_mfa_challenges_user_idx').on(t.userId)],
);
