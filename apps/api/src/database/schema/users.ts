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
import { permissions, roles } from './access-control.js';
import { id, tenantId, tenantIsolation, timestamps } from './columns.js';
import { tenants } from './tenants.js';

// Tenant-scoped tables (RLS).

const tenantRef = () =>
  tenantId().references(() => tenants.id, { onDelete: 'cascade' });

/** Clinic staff accounts. */
export const users = pgTable(
  'users',
  {
    id: id(),
    tenantId: tenantRef(),
    email: text('email').notNull(),
    name: text('name').notNull(),
    passwordHash: text('password_hash'),
    active: boolean('active').notNull().default(true),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    /** Invitation / password-reset link (SHA-256 of the token in the URL). */
    inviteTokenHash: text('invite_token_hash').unique(),
    inviteExpiresAt: timestamp('invite_expires_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    // Emails are stored lowercased; unique per clinic, not platform-wide.
    uniqueIndex('users_tenant_email_idx').on(t.tenantId, t.email),
    tenantIsolation(),
  ],
);

export const userRoles = pgTable(
  'user_roles',
  {
    tenantId: tenantRef(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'restrict' }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.roleId] }), tenantIsolation()],
);

export const overrideEffect = pgEnum('permission_override_effect', [
  'grant',
  'deny',
]);

/** Per-user exceptions to the role defaults. Deny wins over any grant. */
export const userPermissionOverrides = pgTable(
  'user_permission_overrides',
  {
    tenantId: tenantRef(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
    effect: overrideEffect('effect').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.permissionId] }),
    tenantIsolation(),
  ],
);

/** Login sessions. Only the SHA-256 of the cookie token is stored. */
export const sessions = pgTable(
  'sessions',
  {
    id: id(),
    tenantId: tenantRef(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    userAgent: text('user_agent'),
    ip: text('ip'),
    ...timestamps,
  },
  (t) => [index('sessions_user_idx').on(t.userId), tenantIsolation()],
);
