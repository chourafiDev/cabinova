import { Injectable } from '@nestjs/common';
import argon2 from 'argon2';
import { and, eq, gt } from 'drizzle-orm';
import {
  type Transaction,
  DatabaseService,
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
import { currentTenant } from '../tenancy/tenant-context.js';
import { SESSION_TTL_DEFAULT, SESSION_TTL_REMEMBER } from './auth.constants.js';
import type { AuthUser } from './auth.types.js';
import type { Permission } from './permissions.js';
import { hashToken, newToken } from './tokens.js';

// Verified when the e-mail is unknown, so both cases take the same time.
const DUMMY_HASH = await argon2.hash('cabinova-timing-guard');

@Injectable()
export class AuthService {
  constructor(private readonly database: DatabaseService) {}

  /** Checks e-mail + password within the current tenant. */
  async verifyCredentials(email: string, password: string) {
    const user = await this.database.tenant(async (tx) => {
      const [row] = await tx
        .select({
          id: users.id,
          passwordHash: users.passwordHash,
          active: users.active,
        })
        .from(users)
        .where(eq(users.email, email.trim().toLowerCase()))
        .limit(1);
      return row;
    });
    const valid = await argon2.verify(
      user?.passwordHash ?? DUMMY_HASH,
      password,
    );
    return valid && user?.active ? { id: user.id } : null;
  }

  /** New session; returns the raw token to put in the cookie. */
  async createSession(
    userId: string,
    opts: { remember: boolean; userAgent?: string; ip?: string },
  ) {
    const token = newToken();
    const expiresAt = new Date(
      Date.now() + (opts.remember ? SESSION_TTL_REMEMBER : SESSION_TTL_DEFAULT),
    );
    await this.database.tenant(async (tx) => {
      await tx.insert(sessions).values({
        tenantId: currentTenant().id,
        userId,
        tokenHash: hashToken(token),
        expiresAt,
        userAgent: opts.userAgent?.slice(0, 500),
        ip: opts.ip,
      });
      await tx
        .update(users)
        .set({ lastLoginAt: new Date() })
        .where(eq(users.id, userId));
    });
    return { token, expiresAt };
  }

  /** The session's user, or null if the token is unknown, expired or the user disabled. */
  async validateSession(token: string): Promise<AuthUser | null> {
    return this.database.tenant(async (tx) => {
      const [row] = await tx
        .select({
          sessionId: sessions.id,
          id: users.id,
          tenantId: users.tenantId,
          email: users.email,
          name: users.name,
        })
        .from(sessions)
        .innerJoin(users, eq(users.id, sessions.userId))
        .where(
          and(
            eq(sessions.tokenHash, hashToken(token)),
            gt(sessions.expiresAt, new Date()),
            eq(users.active, true),
          ),
        )
        .limit(1);
      if (!row) return null;
      return { ...row, ...(await this.loadAccess(tx, row.id)) };
    });
  }

  /** Who the invitation / reset link is for; null if unknown or expired. */
  async findInvitation(token: string) {
    return this.database.tenant(async (tx) => {
      const [row] = await tx
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          passwordHash: users.passwordHash,
        })
        .from(users)
        .where(
          and(
            eq(users.inviteTokenHash, hashToken(token)),
            gt(users.inviteExpiresAt, new Date()),
            eq(users.active, true),
          ),
        )
        .limit(1);
      if (!row) return null;
      const { passwordHash, ...rest } = row;
      return { ...rest, isReset: !!passwordHash };
    });
  }

  /** Sets the password from the link (single use) and signs out other sessions. */
  async acceptInvitation(token: string, password: string) {
    const invitation = await this.findInvitation(token);
    if (!invitation) return null;
    const passwordHash = await argon2.hash(password);
    await this.database.tenant(async (tx) => {
      await tx
        .update(users)
        .set({ passwordHash, inviteTokenHash: null, inviteExpiresAt: null })
        .where(eq(users.id, invitation.id));
      await tx.delete(sessions).where(eq(sessions.userId, invitation.id));
    });
    return { id: invitation.id };
  }

  async revokeSession(sessionId: string) {
    await this.database.tenant((tx) =>
      tx.delete(sessions).where(eq(sessions.id, sessionId)),
    );
  }

  /** Roles and effective permissions: role defaults + grants − denies. */
  private async loadAccess(tx: Transaction, userId: string) {
    const userRoleRows = await tx
      .select({ id: roles.id, key: roles.key, name: roles.name })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(eq(userRoles.userId, userId));

    const fromRoles = await tx
      .selectDistinct({ key: permissions.key })
      .from(userRoles)
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
      .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
      .where(eq(userRoles.userId, userId));

    const overrides = await tx
      .select({ key: permissions.key, effect: userPermissionOverrides.effect })
      .from(userPermissionOverrides)
      .innerJoin(
        permissions,
        eq(permissions.id, userPermissionOverrides.permissionId),
      )
      .where(eq(userPermissionOverrides.userId, userId));

    const effective = new Set(fromRoles.map((p) => p.key));
    for (const o of overrides) if (o.effect === 'grant') effective.add(o.key);
    for (const o of overrides) if (o.effect === 'deny') effective.delete(o.key);

    return {
      roles: userRoleRows.map(({ key, name }) => ({ key, name })),
      permissions: [...effective].sort() as Permission[],
    };
  }
}
