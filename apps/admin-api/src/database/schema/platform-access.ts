import { pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';
import { id } from './columns.js';

// Central roles/permissions (Module 5 — doc's 5 central roles: Super Admin,
// Administrateur, Agent de Support, Agent technique, Gestionnaire de
// facturation). Separate from anything a clinic will have in its own
// database later — these govern admin-web only.

export const platformPermissions = pgTable('platform_permissions', {
  id: id(),
  /** "resource:action", e.g. "tenants:write" */
  key: text('key').notNull().unique(),
  resource: text('resource').notNull(),
  action: text('action').notNull(),
  description: text('description'),
});

export const platformRoles = pgTable('platform_roles', {
  id: id(),
  /** Stable code identifier, e.g. "support_agent" */
  key: text('key').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
});

export const platformRolePermissions = pgTable(
  'platform_role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => platformRoles.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => platformPermissions.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })],
);
