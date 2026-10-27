import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  isNotNull,
  isNull,
  ne,
  or,
} from 'drizzle-orm';
import { writeAudit } from '../audit/audit.js';
import { AuthService } from '../auth/auth.service.js';
import { TwoFactorService } from '../auth/two-factor.service.js';
import type { AuthUser } from '../auth/auth.types.js';
import { hashToken, newToken } from '../auth/tokens.js';
import type { Env } from '../config/env.js';
import {
  type Database,
  DatabaseService,
  type Transaction,
} from '../database/database.module.js';
import {
  platformAuditLogs,
  platformPermissions,
  platformRoles,
  platformSessions,
  platformUserPermissionOverrides,
  platformUserRoles,
  platformUsers,
} from '../database/schema/index.js';
import { EmailService } from '../email/email.service.js';
import {
  assertSuperAdminRemains,
  assertWithin,
  effectivePermissions,
  isPermission,
  SUPER_ADMIN_ROLE,
} from './access-rules.js';
import type {
  InvitePlatformUserDto,
  ListPlatformUsersQuery,
  UpdatePlatformUserDto,
} from './dto.js';
import { PlatformRolesService } from './platform-roles.service.js';

const LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type Actor = { user: AuthUser; ip?: string };

/** "invited" until the password is chosen; "disabled" wins over both. */
const statusOf = (u: { active: boolean; passwordHash: string | null }) =>
  !u.active ? 'disabled' : u.passwordHash ? 'active' : 'invited';

/**
 * Module 5 — central users (Super Admin, support agents, technical agents). Nobody can grant, or manage someone holding, a
 * permission they don't have; the last active Super Admin can't be removed;
 * nobody can lock themselves out. Every change is audited.
 */
@Injectable()
export class PlatformUsersService {
  constructor(
    private readonly database: DatabaseService,
    private readonly auth: AuthService,
    private readonly twoFactor: TwoFactorService,
    private readonly roles: PlatformRolesService,
    private readonly email: EmailService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async list(query: ListPlatformUsersQuery) {
    const db = this.database.db;
    const term = query.search?.trim();
    const where = and(
      term
        ? or(
            ilike(platformUsers.name, `%${escapeLike(term)}%`),
            ilike(platformUsers.email, `%${escapeLike(term)}%`),
          )
        : undefined,
      query.status === 'disabled' ? eq(platformUsers.active, false) : undefined,
      query.status === 'invited'
        ? and(
            eq(platformUsers.active, true),
            isNull(platformUsers.passwordHash),
          )
        : undefined,
      query.status === 'active'
        ? and(
            eq(platformUsers.active, true),
            isNotNull(platformUsers.passwordHash),
          )
        : undefined,
    );
    const users = await db
      .select()
      .from(platformUsers)
      .where(where)
      .orderBy(asc(platformUsers.name));
    const roleRows = users.length
      ? await db
          .select({
            userId: platformUserRoles.userId,
            key: platformRoles.key,
            name: platformRoles.name,
          })
          .from(platformUserRoles)
          .innerJoin(
            platformRoles,
            eq(platformRoles.id, platformUserRoles.roleId),
          )
          .where(
            inArray(
              platformUserRoles.userId,
              users.map((u) => u.id),
            ),
          )
      : [];
    return users.map((u) => ({
      ...this.publicUser(u),
      roles: roleRows
        .filter((r) => r.userId === u.id)
        .map(({ key, name }) => ({ key, name })),
    }));
  }

  async get(id: string) {
    const user = await this.find(id);
    const [access, sessions] = await Promise.all([
      this.auth.access(id),
      this.database.db
        .select({
          id: platformSessions.id,
          createdAt: platformSessions.createdAt,
          expiresAt: platformSessions.expiresAt,
          userAgent: platformSessions.userAgent,
          ip: platformSessions.ip,
        })
        .from(platformSessions)
        .where(
          and(
            eq(platformSessions.userId, id),
            gt(platformSessions.expiresAt, new Date()),
          ),
        )
        .orderBy(desc(platformSessions.createdAt)),
    ]);
    return { ...this.publicUser(user), ...access, sessions };
  }

  /** Administrative changes made to this account, newest first. */
  history(id: string) {
    return this.database.db
      .select({
        id: platformAuditLogs.id,
        action: platformAuditLogs.action,
        metadata: platformAuditLogs.metadata,
        createdAt: platformAuditLogs.createdAt,
        actor: { id: platformUsers.id, name: platformUsers.name },
      })
      .from(platformAuditLogs)
      .leftJoin(platformUsers, eq(platformUsers.id, platformAuditLogs.userId))
      .where(
        and(
          eq(platformAuditLogs.entity, 'platform_user'),
          eq(platformAuditLogs.entityId, id),
        ),
      )
      .orderBy(desc(platformAuditLogs.createdAt))
      .limit(50);
  }

  /** Creates the account and returns its one-time link (also e-mailed). */
  async invite(actor: Actor, dto: InvitePlatformUserDto) {
    const token = newToken();
    const user = await this.database.db.transaction(async (tx) => {
      const [taken] = await tx
        .select({ id: platformUsers.id })
        .from(platformUsers)
        .where(eq(platformUsers.email, dto.email));
      if (taken) {
        throw new ConflictException({
          code: 'EMAIL_TAKEN',
          message: 'Un utilisateur utilise déjà cette adresse e-mail.',
        });
      }
      const roleIds = await this.checkRoles(tx, actor, dto.roleKeys);
      const [user] = await tx
        .insert(platformUsers)
        .values({
          name: dto.name,
          email: dto.email,
          inviteTokenHash: hashToken(token),
          inviteExpiresAt: new Date(Date.now() + LINK_TTL_MS),
        })
        .returning();
      await tx
        .insert(platformUserRoles)
        .values(roleIds.map((roleId) => ({ userId: user.id, roleId })));
      await this.audit(tx, actor, 'platform_user.invite', user.id, {
        email: dto.email,
        roles: dto.roleKeys,
      });
      return user;
    });
    const url = this.linkUrl(token);
    await this.email.sendPlatformAccess({
      email: user.email,
      name: user.name,
      url,
      isReset: false,
    });
    return { ...this.publicUser(user), url };
  }

  async update(actor: Actor, id: string, dto: UpdatePlatformUserDto) {
    return this.database.db.transaction(async (tx) => {
      const user = await this.find(id, tx);
      const before = await this.auth.access(id, tx);
      // Whoever edits this account must already hold everything it holds.
      assertWithin(actor.user.permissions, before.permissions, 'Utilisateur');

      const changes: Record<string, { from: unknown; to: unknown }> = {};
      if (dto.name !== undefined && dto.name !== user.name) {
        await tx
          .update(platformUsers)
          .set({ name: dto.name })
          .where(eq(platformUsers.id, id));
        changes.name = { from: user.name, to: dto.name };
      }

      let roleKeys = before.roles.map((r) => r.key);
      if (dto.roleKeys) {
        const roleIds = await this.checkRoles(tx, actor, dto.roleKeys);
        const removesSuperAdmin =
          roleKeys.includes(SUPER_ADMIN_ROLE) &&
          !dto.roleKeys.includes(SUPER_ADMIN_ROLE);
        if (removesSuperAdmin && user.active && user.passwordHash) {
          assertSuperAdminRemains(await this.activeSuperAdmins(tx, id));
        }
        if (removesSuperAdmin && id === actor.user.id) {
          throw this.selfLockout();
        }
        await tx
          .delete(platformUserRoles)
          .where(eq(platformUserRoles.userId, id));
        await tx
          .insert(platformUserRoles)
          .values(roleIds.map((roleId) => ({ userId: id, roleId })));
        if ([...dto.roleKeys].sort().join() !== [...roleKeys].sort().join()) {
          changes.roles = { from: roleKeys, to: dto.roleKeys };
        }
        roleKeys = dto.roleKeys;
      }

      if (dto.overrides) {
        const entries = Object.entries(dto.overrides);
        for (const [key, effect] of entries) {
          if (!isPermission(key) || !['grant', 'deny'].includes(effect)) {
            throw new BadRequestException({
              code: 'INVALID_OVERRIDE',
              message: `Exception invalide : ${key}.`,
            });
          }
        }
        assertWithin(
          actor.user.permissions,
          entries.filter(([, e]) => e === 'grant').map(([k]) => k),
          'Exceptions',
        );
        const ids = await this.permissionIds(tx);
        await tx
          .delete(platformUserPermissionOverrides)
          .where(eq(platformUserPermissionOverrides.userId, id));
        if (entries.length) {
          await tx.insert(platformUserPermissionOverrides).values(
            entries.map(([key, effect]) => ({
              userId: id,
              permissionId: ids.get(key)!,
              effect,
            })),
          );
        }
        if (
          JSON.stringify(sortKeys(before.overrides)) !==
          JSON.stringify(sortKeys(dto.overrides))
        ) {
          changes.overrides = { from: before.overrides, to: dto.overrides };
        }
      }

      // Nobody removes their own right to manage users.
      if (id === actor.user.id) {
        const after = effectivePermissions(
          await this.roles.permissionsOf(tx, roleKeys),
          dto.overrides ?? before.overrides,
        );
        if (!after.includes('users:write')) throw this.selfLockout();
      }

      if (Object.keys(changes).length) {
        await this.audit(tx, actor, 'platform_user.update', id, { changes });
      }
      return this.publicUser(await this.find(id, tx));
    });
  }

  /** Disabling also signs the user out everywhere; data and history stay. */
  async setActive(actor: Actor, id: string, active: boolean) {
    return this.database.db.transaction(async (tx) => {
      const user = await this.find(id, tx);
      const { roles, permissions } = await this.auth.access(id, tx);
      assertWithin(actor.user.permissions, permissions, 'Utilisateur');
      if (user.active === active) return this.publicUser(user);
      if (!active) {
        if (id === actor.user.id) throw this.selfLockout();
        if (
          roles.some((r) => r.key === SUPER_ADMIN_ROLE) &&
          user.passwordHash
        ) {
          assertSuperAdminRemains(await this.activeSuperAdmins(tx, id));
        }
        await tx
          .delete(platformSessions)
          .where(eq(platformSessions.userId, id));
      }
      const [updated] = await tx
        .update(platformUsers)
        .set({ active })
        .where(eq(platformUsers.id, id))
        .returning();
      await this.audit(
        tx,
        actor,
        active ? 'platform_user.reactivate' : 'platform_user.deactivate',
        id,
      );
      return this.publicUser(updated);
    });
  }

  /**
   * New one-time link: a password reset for an active account, or a fresh
   * invitation if it was never accepted. Older links stop working.
   */
  async issueLink(actor: Actor, id: string) {
    const token = newToken();
    const user = await this.database.db.transaction(async (tx) => {
      const user = await this.find(id, tx);
      const { permissions } = await this.auth.access(id, tx);
      assertWithin(actor.user.permissions, permissions, 'Utilisateur');
      if (!user.active) {
        throw new ConflictException({
          code: 'USER_DISABLED',
          message: 'Réactivez le compte avant de lui envoyer un lien.',
        });
      }
      await tx
        .update(platformUsers)
        .set({
          inviteTokenHash: hashToken(token),
          inviteExpiresAt: new Date(Date.now() + LINK_TTL_MS),
        })
        .where(eq(platformUsers.id, id));
      await this.audit(tx, actor, 'platform_user.link', id, {
        isReset: !!user.passwordHash,
      });
      return user;
    });
    const url = this.linkUrl(token);
    await this.email.sendPlatformAccess({
      email: user.email,
      name: user.name,
      url,
      isReset: !!user.passwordHash,
    });
    return { url, isReset: !!user.passwordHash };
  }

  /** Lost phone: turns the user's 2FA off and signs them out everywhere. */
  async resetTwoFactor(actor: Actor, id: string) {
    return this.database.db.transaction(async (tx) => {
      const user = await this.find(id, tx);
      const { permissions } = await this.auth.access(id, tx);
      assertWithin(actor.user.permissions, permissions, 'Utilisateur');
      if (!user.totpEnabledAt) return { ok: true };
      await this.twoFactor.adminReset(
        tx,
        { userId: actor.user.id, ip: actor.ip },
        id,
      );
      return { ok: true };
    });
  }

  /** Signs the user out on every device (except the caller's own session). */
  async revokeSessions(actor: Actor, id: string) {
    return this.database.db.transaction(async (tx) => {
      await this.find(id, tx);
      const { permissions } = await this.auth.access(id, tx);
      assertWithin(actor.user.permissions, permissions, 'Utilisateur');
      const revoked = await tx
        .delete(platformSessions)
        .where(
          and(
            eq(platformSessions.userId, id),
            ne(platformSessions.id, actor.user.sessionId),
          ),
        )
        .returning({ id: platformSessions.id });
      await this.audit(tx, actor, 'platform_user.sessions_revoke', id, {
        count: revoked.length,
      });
      return { revoked: revoked.length };
    });
  }

  /** Active, password-set Super Admins other than `exceptId`. */
  private async activeSuperAdmins(tx: Transaction, exceptId: string) {
    const [{ n }] = await tx
      .select({ n: count() })
      .from(platformUserRoles)
      .innerJoin(platformRoles, eq(platformRoles.id, platformUserRoles.roleId))
      .innerJoin(platformUsers, eq(platformUsers.id, platformUserRoles.userId))
      .where(
        and(
          eq(platformRoles.key, SUPER_ADMIN_ROLE),
          eq(platformUsers.active, true),
          isNotNull(platformUsers.passwordHash),
          ne(platformUsers.id, exceptId),
        ),
      );
    return n;
  }

  /** Role keys → ids; at least one, all existing, none beyond the actor's rights. */
  private async checkRoles(tx: Transaction, actor: Actor, keys: string[]) {
    const unique = [...new Set(keys)];
    if (!unique.length) {
      throw new BadRequestException({
        code: 'ROLE_REQUIRED',
        message: 'Choisissez au moins un rôle.',
      });
    }
    const roles = await tx
      .select({ id: platformRoles.id, key: platformRoles.key })
      .from(platformRoles)
      .where(inArray(platformRoles.key, unique));
    if (roles.length !== unique.length) {
      throw new BadRequestException({
        code: 'UNKNOWN_ROLE',
        message: 'Rôle inconnu.',
      });
    }
    assertWithin(
      actor.user.permissions,
      await this.roles.permissionsOf(tx, unique),
      'Rôles',
    );
    return roles.map((r) => r.id);
  }

  private async permissionIds(tx: Transaction) {
    const rows = await tx
      .select({ id: platformPermissions.id, key: platformPermissions.key })
      .from(platformPermissions);
    return new Map(rows.map((r) => [r.key, r.id]));
  }

  private async find(
    id: string,
    tx: Database | Transaction = this.database.db,
  ) {
    const [user] = await tx
      .select()
      .from(platformUsers)
      .where(eq(platformUsers.id, id));
    if (!user) throw new NotFoundException('Utilisateur introuvable.');
    return user;
  }

  private publicUser(u: typeof platformUsers.$inferSelect) {
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      status: statusOf(u),
      inviteExpired:
        !u.passwordHash &&
        !!u.inviteExpiresAt &&
        u.inviteExpiresAt < new Date(),
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
      twoFactorEnabled: !!u.totpEnabledAt,
    };
  }

  private linkUrl(token: string) {
    const origin = this.config.get('WEB_ORIGIN').split(',')[0].trim();
    return `${origin}/invite/${token}`;
  }

  private audit(
    tx: Transaction,
    actor: Actor,
    action: string,
    userId: string,
    metadata?: Record<string, unknown>,
  ) {
    return writeAudit(
      tx,
      { userId: actor.user.id, ip: actor.ip },
      { action, entity: 'platform_user', entityId: userId, metadata },
    );
  }

  private selfLockout() {
    return new ForbiddenException({
      code: 'SELF_LOCKOUT',
      message: 'Vous ne pouvez pas retirer votre propre accès.',
    });
  }
}

const escapeLike = (term: string) => term.replace(/[\\%_]/g, '\\$&');

const sortKeys = (o: Record<string, string>) =>
  Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
