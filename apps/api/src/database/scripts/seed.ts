// `pnpm db:seed`: syncs the permission catalog and default roles, then
// creates a demo clinic with its admin (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD).
// Idempotent: safe to run again.
import 'dotenv/config';
import { neonConfig, Pool } from '@neondatabase/serverless';
import argon2 from 'argon2';
import { and, eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import { DEFAULT_ROLES, PERMISSIONS } from '../../auth/permissions.js';
import * as schema from '../schema/index.js';

const { permissions, rolePermissions, roles, tenants, userRoles, users } =
  schema;

neonConfig.webSocketConstructor = ws;
const pool = new Pool({
  connectionString:
    process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL,
});
const db = drizzle({ client: pool, schema });

// 1. Permission catalog
const existingKeys = new Set(
  (await db.select({ key: permissions.key }).from(permissions)).map(
    (p) => p.key,
  ),
);
await db
  .insert(permissions)
  .values(
    Object.entries(PERMISSIONS).map(([key, description]) => {
      const [resource, action] = key.split(':');
      return { key, resource, action, description };
    }),
  )
  .onConflictDoUpdate({
    target: permissions.key,
    set: { description: sql`excluded.description` },
  });
const permissionIds = new Map(
  (await db.select().from(permissions)).map((p) => [p.key, p.id]),
);
console.log(`✓ ${permissionIds.size} permissions`);

// 2. Default roles. Existing roles keep their permissions (the super-admin
//    may have changed them) and only receive the permissions added to the
//    catalog by this run; new roles get all their defaults.
for (const role of DEFAULT_ROLES) {
  const [created] = await db
    .insert(roles)
    .values({ key: role.key, name: role.name, description: role.description })
    .onConflictDoNothing({ target: roles.key })
    .returning({ id: roles.id });
  const [{ id: roleId }] = created
    ? [created]
    : await db
        .select({ id: roles.id })
        .from(roles)
        .where(eq(roles.key, role.key));
  const keys = created
    ? role.permissions
    : role.permissions.filter((key) => !existingKeys.has(key));
  if (keys.length) {
    await db
      .insert(rolePermissions)
      .values(
        keys.map((key) => ({ roleId, permissionId: permissionIds.get(key)! })),
      )
      .onConflictDoNothing();
    if (!created) console.log(`  + ${role.key}: ${keys.join(', ')}`);
  }
}
console.log(`✓ ${DEFAULT_ROLES.length} roles`);

// 3. Demo clinic + admin
const email = process.env.SEED_ADMIN_EMAIL?.toLowerCase();
const password = process.env.SEED_ADMIN_PASSWORD;
if (!email || !password) {
  console.log('SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set: no demo clinic');
} else {
  await db
    .insert(tenants)
    .values({ name: 'Clinique Démo', slug: 'demo', status: 'active' })
    .onConflictDoNothing({ target: tenants.slug });
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, 'demo'));
  const [adminRole] = await db
    .select()
    .from(roles)
    .where(eq(roles.key, 'clinic_admin'));

  // Tenant tables are behind RLS: write inside the tenant's context.
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.tenant_id', ${tenant.id}, true)`,
    );
    const [existing] = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.tenantId, tenant.id), eq(users.email, email)));
    const userId =
      existing?.id ??
      (
        await tx
          .insert(users)
          .values({
            tenantId: tenant.id,
            email,
            name: 'Admin Démo',
            passwordHash: await argon2.hash(password),
          })
          .returning({ id: users.id })
      )[0].id;
    await tx
      .insert(userRoles)
      .values({ tenantId: tenant.id, userId, roleId: adminRole.id })
      .onConflictDoNothing();
  });
  console.log(`✓ demo clinic "demo" with admin ${email}`);
}

await pool.end();
