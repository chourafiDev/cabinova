// `pnpm db:seed`: syncs the platform permission catalog and the 5 central
// roles, creates the default subscription plans, then the Super Admin
// account (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD). Idempotent: safe to run
// again.
import 'dotenv/config';
import { neonConfig, Pool } from '@neondatabase/serverless';
import argon2 from 'argon2';
import { eq, notInArray, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import {
  DEFAULT_PLATFORM_ROLES,
  PLATFORM_PERMISSIONS,
} from '../../auth/permissions.js';
import { DEFAULT_FEATURES, DEFAULT_PLANS } from '../../plans/catalog.js';
import * as schema from '../schema/index.js';

const {
  platformPermissions,
  platformRolePermissions,
  platformRoles,
  platformUserRoles,
  platformUsers,
  subscriptionPlans,
  features,
} = schema;

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool, schema });

// 1. Permission catalog
await db
  .insert(platformPermissions)
  .values(
    Object.entries(PLATFORM_PERMISSIONS).map(([key, description]) => {
      const [resource, action] = key.split(':');
      return { key, resource, action, description };
    }),
  )
  .onConflictDoUpdate({
    target: platformPermissions.key,
    set: { description: sql`excluded.description` },
  });
const permissionIds = new Map(
  (await db.select().from(platformPermissions)).map((p) => [p.key, p.id]),
);
console.log(`✓ ${permissionIds.size} permissions`);

// 2. Central roles. Existing roles keep their permissions (the Super Admin
//    may have changed them); new roles get the defaults.
for (const role of DEFAULT_PLATFORM_ROLES) {
  const [created] = await db
    .insert(platformRoles)
    .values({ key: role.key, name: role.name, description: role.description })
    .onConflictDoNothing({ target: platformRoles.key })
    .returning({ id: platformRoles.id });
  if (created) {
    await db.insert(platformRolePermissions).values(
      role.permissions.map((key) => ({
        roleId: created.id,
        permissionId: permissionIds.get(key)!,
      })),
    );
  }
}
// Super Admin always holds the whole catalog, including permissions added
// since it was created (it can't be edited from the UI).
const [superAdmin] = await db
  .select({ id: platformRoles.id })
  .from(platformRoles)
  .where(eq(platformRoles.key, 'super_admin'));
await db
  .insert(platformRolePermissions)
  .values(
    [...permissionIds.values()].map((permissionId) => ({
      roleId: superAdmin.id,
      permissionId,
    })),
  )
  .onConflictDoNothing();
// Only the default roles exist: others are removed once nobody holds them.
const keep = DEFAULT_PLATFORM_ROLES.map((r) => r.key);
const obsolete = await db
  .select({ id: platformRoles.id, key: platformRoles.key })
  .from(platformRoles)
  .where(notInArray(platformRoles.key, keep));
for (const role of obsolete) {
  const [held] = await db
    .select({ userId: platformUserRoles.userId })
    .from(platformUserRoles)
    .where(eq(platformUserRoles.roleId, role.id))
    .limit(1);
  if (held) {
    console.warn(`! role ${role.key} kept: still assigned to users`);
  } else {
    await db.delete(platformRoles).where(eq(platformRoles.id, role.id));
    console.log(`✓ removed role ${role.key}`);
  }
}
console.log(`✓ ${DEFAULT_PLATFORM_ROLES.length} roles`);

// 3a. Feature catalog. Existing features keep what was edited in the UI.
const createdFeatures = await db
  .insert(features)
  .values(DEFAULT_FEATURES.map((f) => ({ ...f })))
  .onConflictDoNothing({ target: features.key })
  .returning({ key: features.key });
console.log(
  `✓ ${DEFAULT_FEATURES.length} features (${createdFeatures.length} created)`,
);

// 3b. Default plans. Existing plans keep their prices and limits (edited from
//    the Offres page); only missing ones are created.
const createdPlans = await db
  .insert(subscriptionPlans)
  .values(DEFAULT_PLANS)
  .onConflictDoNothing({ target: subscriptionPlans.key })
  .returning({ key: subscriptionPlans.key });
console.log(`✓ ${DEFAULT_PLANS.length} plans (${createdPlans.length} created)`);

// 4. Super Admin account
const email = process.env.SEED_ADMIN_EMAIL?.toLowerCase();
const password = process.env.SEED_ADMIN_PASSWORD;
if (!email || !password) {
  console.log(
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set: no account created',
  );
} else {
  const [superAdminRole] = await db
    .select()
    .from(platformRoles)
    .where(eq(platformRoles.key, 'super_admin'));

  const [existing] = await db
    .select({ id: platformUsers.id })
    .from(platformUsers)
    .where(eq(platformUsers.email, email));
  const userId =
    existing?.id ??
    (
      await db
        .insert(platformUsers)
        .values({
          name: 'Super Admin',
          email,
          passwordHash: await argon2.hash(password),
        })
        .returning({ id: platformUsers.id })
    )[0].id;
  await db
    .insert(platformUserRoles)
    .values({ userId, roleId: superAdminRole.id })
    .onConflictDoNothing();
  console.log(`✓ Super Admin account ${email}`);
}

await pool.end();
