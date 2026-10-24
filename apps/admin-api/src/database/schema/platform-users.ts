import {
  boolean,
  index,
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
