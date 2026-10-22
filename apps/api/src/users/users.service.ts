import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { asc, eq, inArray } from 'drizzle-orm';
import { hashToken, newToken } from '../auth/tokens.js';
import type { Env } from '../config/env.js';
import {
  DatabaseService,
  type Transaction,
} from '../database/database.module.js';
import {
  permissions,
  rolePermissions,
  roles,
  sessions,
  userPermissionOverrides,
  userRoles,
  users,
} from '../database/schema/index.js';
import { EmailService } from '../email/email.service.js';
import { currentTenant } from '../tenancy/tenant-context.js';
import { tenantUrl } from '../tenancy/tenant-url.js';
import type { InviteUserDto, UpdateAccessDto } from './dto.js';

/** Invitation and password-reset links are valid 7 days. */
const INVITE_TTL = 7 * 24 * 60 * 60 * 1000;

const memberColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  active: users.active,
  hasPassword: users.passwordHash,
  lastLoginAt: users.lastLoginAt,
  createdAt: users.createdAt,
};

const toRole = (r: { id: string; key: string; name: string }) => ({
  id: r.id,
  key: r.key,
  name: r.name,
});

@Injectable()
export class UsersService {
  constructor(
    private readonly database: DatabaseService,
    private readonly email: EmailService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Tenant-subdomain URL for a link sent by email. */
  private linkUrl(path: string) {
    return tenantUrl(
      this.config.get('WEB_ORIGIN'),
      this.config.get('ROOT_DOMAIN'),
      currentTenant().slug,
      path,
    );
  }

  list() {
    return this.database.tenant(async (tx) => {
      const rows = await tx
        .select(memberColumns)
        .from(users)
        .orderBy(asc(users.name));
      const roleRows = await this.rolesOf(
        tx,
        rows.map((r) => r.id),
      );
      return rows.map(({ hasPassword, ...r }) => ({
        ...r,
        hasPassword: !!hasPassword,
        roles: roleRows.filter((x) => x.userId === r.id).map(toRole),
      }));
    });
  }

  get(id: string) {
    return this.database.tenant(async (tx) => {
      const [row] = await tx
        .select(memberColumns)
        .from(users)
        .where(eq(users.id, id));
      if (!row) throw new NotFoundException('Membre introuvable.');
      const roleRows = await this.rolesOf(tx, [id]);
      const overrides = await tx
        .select({
          permission: permissions.key,
          effect: userPermissionOverrides.effect,
        })
        .from(userPermissionOverrides)
        .innerJoin(
          permissions,
          eq(permissions.id, userPermissionOverrides.permissionId),
        )
        .where(eq(userPermissionOverrides.userId, id));
      const { hasPassword, ...rest } = row;
      return {
        ...rest,
        hasPassword: !!hasPassword,
        roles: roleRows.map(toRole),
        overrides,
      };
    });
  }

  /** Creates the account without password and e-mails the invitation link. */
  async invite(dto: InviteUserDto) {
    const email = dto.email.trim().toLowerCase();
    const name = dto.name.trim();
    const token = newToken();
    const id = await this.database.tenant(async (tx) => {
      const [taken] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email));
      if (taken) {
        throw new ConflictException({
          code: 'EMAIL_TAKEN',
          message: 'Un membre utilise déjà cette adresse e-mail.',
        });
      }
      await this.assertRolesExist(tx, dto.roleIds);
      const [user] = await tx
        .insert(users)
        .values({
          tenantId: currentTenant().id,
          name,
          email,
          inviteTokenHash: hashToken(token),
          inviteExpiresAt: new Date(Date.now() + INVITE_TTL),
        })
        .returning({ id: users.id });
      await this.setRoles(tx, user.id, dto.roleIds);
      return user.id;
    });
    const url = this.linkUrl(`/invite/${token}`);
    await this.email.sendInvitation({
      email,
      name,
      tenantName: currentTenant().name,
      url,
    });
    // The token (and the link built from it) is still returned: the admin
    // can copy it directly, e.g. if the member's inbox is unreachable.
    return { id, token, url };
  }

  /** New invitation link (no password yet) or password-reset link; e-mails it. */
  async newAccessLink(id: string) {
    const token = newToken();
    const member = await this.database.tenant(async (tx) => {
      const [user] = await tx
        .update(users)
        .set({
          inviteTokenHash: hashToken(token),
          inviteExpiresAt: new Date(Date.now() + INVITE_TTL),
        })
        .where(eq(users.id, id))
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
          hasPassword: users.passwordHash,
        });
      if (!user) throw new NotFoundException('Membre introuvable.');
      return user;
    });
    const url = this.linkUrl(`/invite/${token}`);
    const recipient = {
      email: member.email,
      name: member.name,
      tenantName: currentTenant().name,
      url,
    };
    if (member.hasPassword) await this.email.sendPasswordReset(recipient);
    else await this.email.sendInvitation(recipient);
    return { token, url };
  }

  async setActive(actorId: string, id: string, active: boolean) {
    this.assertNotSelf(actorId, id);
    await this.database.tenant(async (tx) => {
      const [user] = await tx
        .update(users)
        .set({ active })
        .where(eq(users.id, id))
        .returning({ id: users.id });
      if (!user) throw new NotFoundException('Membre introuvable.');
      // Deactivated: signed out everywhere, immediately.
      if (!active) await tx.delete(sessions).where(eq(sessions.userId, id));
    });
  }

  /** Replaces roles and overrides; applies from the member's next request. */
  async updateAccess(actorId: string, id: string, dto: UpdateAccessDto) {
    this.assertNotSelf(actorId, id);
    const perms = [...new Set(dto.overrides.map((o) => o.permission))];
    if (perms.length !== dto.overrides.length) {
      throw new BadRequestException('Une permission apparaît deux fois.');
    }
    await this.database.tenant(async (tx) => {
      const [user] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, id));
      if (!user) throw new NotFoundException('Membre introuvable.');
      await this.assertRolesExist(tx, dto.roleIds);
      await this.setRoles(tx, id, dto.roleIds);

      await tx
        .delete(userPermissionOverrides)
        .where(eq(userPermissionOverrides.userId, id));
      if (dto.overrides.length) {
        const ids = new Map(
          (
            await tx
              .select({ id: permissions.id, key: permissions.key })
              .from(permissions)
              .where(inArray(permissions.key, perms))
          ).map((p) => [p.key, p.id]),
        );
        await tx.insert(userPermissionOverrides).values(
          dto.overrides.map((o) => ({
            tenantId: currentTenant().id,
            userId: id,
            permissionId: ids.get(o.permission)!,
            effect: o.effect,
          })),
        );
      }
    });
    return this.get(id);
  }

  /** Roles (with their default permissions) a member can be given. */
  async listRoles() {
    const rows = await this.database.db
      .select({
        id: roles.id,
        key: roles.key,
        name: roles.name,
        description: roles.description,
        permission: permissions.key,
      })
      .from(roles)
      .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
      .leftJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
      .orderBy(asc(roles.name));
    const byId = new Map<
      string,
      {
        id: string;
        key: string;
        name: string;
        description: string | null;
        permissions: string[];
      }
    >();
    for (const { permission, ...role } of rows) {
      const entry = byId.get(role.id) ?? { ...role, permissions: [] };
      if (permission) entry.permissions.push(permission);
      byId.set(role.id, entry);
    }
    return [...byId.values()];
  }

  listPermissions() {
    return this.database.db
      .select({
        key: permissions.key,
        resource: permissions.resource,
        action: permissions.action,
        description: permissions.description,
      })
      .from(permissions)
      .orderBy(asc(permissions.key));
  }

  private rolesOf(tx: Transaction, userIds: string[]) {
    if (!userIds.length) return Promise.resolve([]);
    return tx
      .select({
        userId: userRoles.userId,
        id: roles.id,
        key: roles.key,
        name: roles.name,
      })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(inArray(userRoles.userId, userIds));
  }

  private async setRoles(tx: Transaction, userId: string, roleIds: string[]) {
    await tx.delete(userRoles).where(eq(userRoles.userId, userId));
    if (roleIds.length) {
      await tx.insert(userRoles).values(
        roleIds.map((roleId) => ({
          tenantId: currentTenant().id,
          userId,
          roleId,
        })),
      );
    }
  }

  private async assertRolesExist(tx: Transaction, roleIds: string[]) {
    if (!roleIds.length) return;
    const found = await tx
      .select({ id: roles.id })
      .from(roles)
      .where(inArray(roles.id, roleIds));
    if (found.length !== roleIds.length) {
      throw new BadRequestException('Rôle inconnu.');
    }
  }

  /** An admin can't lock themselves out (disable or strip their own access). */
  private assertNotSelf(actorId: string, id: string) {
    if (actorId === id) {
      throw new ForbiddenException({
        code: 'SELF_EDIT',
        message: 'Vous ne pouvez pas modifier votre propre accès.',
      });
    }
  }
}
