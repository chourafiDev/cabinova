import { primaryKey, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { id, timestamps } from './columns.js';

// Control-plane tables: managed by the platform super-admin, shared by every
// tenant, no tenant_id and no RLS.

/** Permission catalog, synced from code (src/auth/permissions.ts). */
export const permissions = pgTable('permissions', {
  id: id(),
  /** "resource:action", e.g. "patients:write" */
  key: text('key').notNull().unique(),
  resource: text('resource').notNull(),
  action: text('action').notNull(),
  description: text('description'),
});

export const roles = pgTable('roles', {
  id: id(),
  /** Stable code identifier, e.g. "doctor" */
  key: text('key').notNull().unique(),
  /** Label shown in the UI, e.g. "Médecin" */
  name: text('name').notNull(),
  description: text('description'),
  ...timestamps,
});

/** Default permissions of each role. */
export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })],
);
