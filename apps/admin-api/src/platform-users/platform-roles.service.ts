import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { asc, count, eq, inArray } from 'drizzle-orm';
import { writeAudit } from '../audit/audit.js';
import type { AuthUser } from '../auth/auth.types.js';
import { PLATFORM_PERMISSIONS } from '../auth/permissions.js';
import {
  type Database,
  DatabaseService,
  type Transaction,
} from '../database/database.module.js';
import {
  platformPermissions,
  platformRolePermissions,
  platformRoles,
  platformUserRoles,
} from '../database/schema/index.js';
import type { UpdatePlatformRoleDto } from './dto.js';
import { assertWithin, SUPER_ADMIN_ROLE } from './access-rules.js';

type Actor = { user: AuthUser; ip?: string };

/**
 * Module 5 — the three central roles (Super Admin, Agent de Support, Agent
 * technique). The set is fixed — seeded by `pnpm db:seed` — but the agents'
 * permissions can be adjusted. That changes them for every holder at once,
 * so the editor must hold both the old and the new permissions. Super Admin
 * always has everything and can't be edited.
 */
@Injectable()
export class PlatformRolesService {
  constructor(private readonly database: DatabaseService) {}

  /** The permission catalog, for the role matrix. */
  catalog() {
    return Object.entries(PLATFORM_PERMISSIONS).map(([key, description]) => {
      const [resource, action] = key.split(':');
      return { key, resource, action, description };
    });
  }

  async list() {
    const db = this.database.db;
    const [roles, grants, holders] = await Promise.all([
      db.select().from(platformRoles).orderBy(asc(platformRoles.name)),
      db
        .select({
          roleId: platformRolePermissions.roleId,
          key: platformPermissions.key,
        })
        .from(platformRolePermissions)
        .innerJoin(
          platformPermissions,
          eq(platformPermissions.id, platformRolePermissions.permissionId),
        ),
      db
        .select({ roleId: platformUserRoles.roleId, n: count() })
        .from(platformUserRoles)
        .groupBy(platformUserRoles.roleId),
    ]);
    return roles
      .map((role) => ({
        ...role,
        locked: role.key === SUPER_ADMIN_ROLE,
        permissions: grants
          .filter((g) => g.roleId === role.id)
          .map((g) => g.key)
          .sort(),
        userCount: holders.find((h) => h.roleId === role.id)?.n ?? 0,
      }))
      .sort((a, b) => Number(b.locked) - Number(a.locked));
  }

  update(actor: Actor, id: string, dto: UpdatePlatformRoleDto) {
    return this.database.db.transaction(async (tx) => {
      const role = await this.find(tx, id);
      if (role.key === SUPER_ADMIN_ROLE) throw this.locked();
      const current = await this.permissionsOf(tx, [role.key]);
      const changes: Record<string, { from: unknown; to: unknown }> = {};

      assertWithin(
        actor.user.permissions,
        [...current, ...dto.permissions],
        'Rôle',
      );
      const next = [...new Set(dto.permissions)].sort();
      if (next.join() !== current.join()) {
        await this.setPermissions(tx, id, next);
        changes.permissions = { from: current, to: next };
      }
      if (Object.keys(changes).length) {
        await this.audit(tx, actor, 'platform_role.update', id, {
          key: role.key,
          changes,
        });
      }
      return this.find(tx, id);
    });
  }

  /** Union of the permissions of these roles. */
  async permissionsOf(tx: Database | Transaction, roleKeys: string[]) {
    if (!roleKeys.length) return [];
    const rows = await tx
      .selectDistinct({ key: platformPermissions.key })
      .from(platformRoles)
      .innerJoin(
        platformRolePermissions,
        eq(platformRolePermissions.roleId, platformRoles.id),
      )
      .innerJoin(
        platformPermissions,
        eq(platformPermissions.id, platformRolePermissions.permissionId),
      )
      .where(inArray(platformRoles.key, roleKeys));
    return rows.map((r) => r.key).sort();
  }

  private async setPermissions(
    tx: Transaction,
    roleId: string,
    keys: string[],
  ) {
    await tx
      .delete(platformRolePermissions)
      .where(eq(platformRolePermissions.roleId, roleId));
    if (!keys.length) return;
    const ids = await tx
      .select({ id: platformPermissions.id })
      .from(platformPermissions)
      .where(inArray(platformPermissions.key, keys));
    await tx
      .insert(platformRolePermissions)
      .values(ids.map(({ id }) => ({ roleId, permissionId: id })));
  }

  private async find(tx: Transaction, id: string) {
    const [role] = await tx
      .select()
      .from(platformRoles)
      .where(eq(platformRoles.id, id));
    if (!role) throw new NotFoundException('Rôle introuvable.');
    return role;
  }

  private audit(
    tx: Transaction,
    actor: Actor,
    action: string,
    roleId: string,
    metadata: Record<string, unknown>,
  ) {
    return writeAudit(
      tx,
      { userId: actor.user.id, ip: actor.ip },
      { action, entity: 'platform_role', entityId: roleId, metadata },
    );
  }

  private locked() {
    return new ForbiddenException({
      code: 'ROLE_LOCKED',
      message: 'Le rôle Super Admin a toujours toutes les permissions.',
    });
  }
}
