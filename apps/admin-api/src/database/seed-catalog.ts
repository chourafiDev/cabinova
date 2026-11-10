// The catalog seed behind `pnpm db:seed` (and the end-to-end tests): syncs
// the platform permission catalog and the 5 central roles, creates the
// default subscription plans, then the Super Admin account. Idempotent:
// safe to run again.
import argon2 from 'argon2';
import { eq, notInArray, sql } from 'drizzle-orm';
import {
  DEFAULT_PLATFORM_ROLES,
  PLATFORM_PERMISSIONS,
} from '../auth/permissions.js';
import { syncFeatureCatalog } from '../features/sync.js';
import { DEFAULT_PLANS } from '../plans/catalog.js';
import type { Database } from './database.module.js';
import {
  platformPermissions,
  platformRolePermissions,
  platformRoles,
  platformUserRoles,
  platformUsers,
  subscriptionPlans,
} from './schema/index.js';

export async function seedCatalog(
  db: Database,
  admin: { email?: string; password?: string },
  log: (line: string) => void = () => {},
) {
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
  log(`✓ ${permissionIds.size} permissions`);

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
      log(`! role ${role.key} kept: still assigned to users`);
    } else {
      await db.delete(platformRoles).where(eq(platformRoles.id, role.id));
      log(`✓ removed role ${role.key}`);
    }
  }
  log(`✓ ${DEFAULT_PLATFORM_ROLES.length} roles`);

  // 3a. Feature catalog, from the code registry (@cabinova/features) — the
  //     same sync the API runs at every start.
  const synced = await syncFeatureCatalog(db);
  log(
    `✓ ${synced.total} features (${synced.added.length} added)${
      synced.notInCode.length
        ? ` — absentes du code : ${synced.notInCode.join(', ')}`
        : ''
    }`,
  );

  // 3b. Default plans. Existing plans keep their prices and limits (edited from
  //    the Offres page); only missing ones are created.
  const createdPlans = await db
    .insert(subscriptionPlans)
    .values(DEFAULT_PLANS)
    .onConflictDoNothing({ target: subscriptionPlans.key })
    .returning({ key: subscriptionPlans.key });
  log(`✓ ${DEFAULT_PLANS.length} plans (${createdPlans.length} created)`);

  // 4. Super Admin account
  const email = admin.email?.toLowerCase();
  const password = admin.password;
  if (!email || !password) {
    log('SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set: no account created');
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
    log(`✓ Super Admin account ${email}`);
  }
}
