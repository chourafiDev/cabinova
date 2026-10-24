import { Injectable } from '@nestjs/common';
import argon2 from 'argon2';
import { and, eq, gt } from 'drizzle-orm';
import {
  type Database,
  DatabaseService,
  type Transaction,
} from '../database/database.module.js';
import {
  platformPermissions,
  platformRolePermissions,
  platformRoles,
  platformSessions,
  platformUserPermissionOverrides,
  platformUserRoles,
  platformUsers,
} from '../database/schema/index.js';
import { SESSION_TTL_DEFAULT, SESSION_TTL_REMEMBER } from './auth.constants.js';
import type { AuthUser } from './auth.types.js';
import type { PlatformPermission } from './permissions.js';
import { hashToken, newToken } from './tokens.js';

// Verified when the e-mail is unknown, so both cases take the same time.
const DUMMY_HASH = await argon2.hash('cabinova-timing-guard');

@Injectable()
export class AuthService {
  constructor(private readonly database: DatabaseService) {}

  /** Checks e-mail + password among platform users. */
  async verifyCredentials(email: string, password: string) {
    const [user] = await this.database.db
      .select({
        id: platformUsers.id,
        passwordHash: platformUsers.passwordHash,
        active: platformUsers.active,
      })
      .from(platformUsers)
      .where(eq(platformUsers.email, email.trim().toLowerCase()))
      .limit(1);
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
    await this.database.db.transaction(async (tx) => {
      await tx.insert(platformSessions).values({
        userId,
        tokenHash: hashToken(token),
        expiresAt,
        userAgent: opts.userAgent?.slice(0, 500),
        ip: opts.ip,
      });
      await tx
        .update(platformUsers)
        .set({ lastLoginAt: new Date() })
        .where(eq(platformUsers.id, userId));
    });
    return { token, expiresAt };
  }

  /** The session's user, or null if the token is unknown, expired or the user disabled. */
  async validateSession(token: string): Promise<AuthUser | null> {
    const [row] = await this.database.db
      .select({
        sessionId: platformSessions.id,
        id: platformUsers.id,
        email: platformUsers.email,
        name: platformUsers.name,
      })
      .from(platformSessions)
      .innerJoin(platformUsers, eq(platformUsers.id, platformSessions.userId))
      .where(
        and(
          eq(platformSessions.tokenHash, hashToken(token)),
          gt(platformSessions.expiresAt, new Date()),
          eq(platformUsers.active, true),
        ),
      )
      .limit(1);
    if (!row) return null;
    const { roles, permissions } = await this.access(row.id);
    return { ...row, roles, permissions };
  }

  /** Who the invitation / reset link is for; null if unknown or expired. */
  async findInvitation(token: string) {
    const [row] = await this.database.db
      .select({
        id: platformUsers.id,
        name: platformUsers.name,
        email: platformUsers.email,
        passwordHash: platformUsers.passwordHash,
      })
      .from(platformUsers)
      .where(
        and(
          eq(platformUsers.inviteTokenHash, hashToken(token)),
          gt(platformUsers.inviteExpiresAt, new Date()),
          eq(platformUsers.active, true),
        ),
      )
      .limit(1);
    if (!row) return null;
    const { passwordHash, ...rest } = row;
    return { ...rest, isReset: !!passwordHash };
  }

  /** Sets the password from the link (single use) and signs out other sessions. */
  async acceptInvitation(token: string, password: string) {
    const invitation = await this.findInvitation(token);
    if (!invitation) return null;
    const passwordHash = await argon2.hash(password);
    await this.database.db.transaction(async (tx) => {
      await tx
        .update(platformUsers)
        .set({ passwordHash, inviteTokenHash: null, inviteExpiresAt: null })
        .where(eq(platformUsers.id, invitation.id));
      await tx
        .delete(platformSessions)
        .where(eq(platformSessions.userId, invitation.id));
    });
    return { id: invitation.id };
  }

  async revokeSession(sessionId: string) {
    await this.database.db
      .delete(platformSessions)
      .where(eq(platformSessions.id, sessionId));
  }

  /**
   * Roles, per-user overrides and effective permissions (role defaults +
   * grants − denies). Computed on every request, so a change applies at once.
   */
  async access(userId: string, tx: Database | Transaction = this.database.db) {
    const userRoleRows = await tx
      .select({
        id: platformRoles.id,
        key: platformRoles.key,
        name: platformRoles.name,
      })
      .from(platformUserRoles)
      .innerJoin(platformRoles, eq(platformRoles.id, platformUserRoles.roleId))
      .where(eq(platformUserRoles.userId, userId));

    const fromRoles = await tx
      .selectDistinct({ key: platformPermissions.key })
      .from(platformUserRoles)
      .innerJoin(
        platformRolePermissions,
        eq(platformRolePermissions.roleId, platformUserRoles.roleId),
      )
      .innerJoin(
        platformPermissions,
        eq(platformPermissions.id, platformRolePermissions.permissionId),
      )
      .where(eq(platformUserRoles.userId, userId));

    const overrides = await tx
      .select({
        key: platformPermissions.key,
        effect: platformUserPermissionOverrides.effect,
      })
      .from(platformUserPermissionOverrides)
      .innerJoin(
        platformPermissions,
        eq(
          platformPermissions.id,
          platformUserPermissionOverrides.permissionId,
        ),
      )
      .where(eq(platformUserPermissionOverrides.userId, userId));

    const effective = new Set(fromRoles.map((p) => p.key));
    for (const o of overrides) if (o.effect === 'grant') effective.add(o.key);
    for (const o of overrides) if (o.effect === 'deny') effective.delete(o.key);

    return {
      roles: userRoleRows.map(({ key, name }) => ({ key, name })),
      overrides: Object.fromEntries(overrides.map((o) => [o.key, o.effect])),
      permissions: [...effective].sort() as PlatformPermission[],
    };
  }
}
