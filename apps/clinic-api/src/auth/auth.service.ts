import type { Pool } from '@neondatabase/serverless';
import { Injectable } from '@nestjs/common';
import argon2 from 'argon2';
import { SESSION_TTL_DEFAULT, SESSION_TTL_REMEMBER } from './auth.constants.js';
import type { ClinicUser } from './auth.types.js';
import { hashToken, newToken } from './tokens.js';

// Verified when the e-mail is unknown, so both cases take the same time.
const DUMMY_HASH = await argon2.hash('cabinova-timing-guard');

/**
 * Staff accounts and sessions, all in the cabinet's own database (the pool
 * passed in is the request's cabinet). Plain SQL on purpose: the tables are
 * those of @cabinova/tenant-db.
 */
@Injectable()
export class AuthService {
  /** E-mail + password of an active account that has chosen its password. */
  async verifyCredentials(db: Pool, email: string, password: string) {
    const { rows } = await db.query<{
      id: string;
      password_hash: string | null;
      active: boolean;
      totp_enabled_at: Date | null;
    }>(
      'select id, password_hash, active, totp_enabled_at from users where lower(email) = $1',
      [email.trim().toLowerCase()],
    );
    const user = rows[0];
    const valid = await argon2.verify(
      user?.password_hash ?? DUMMY_HASH,
      password,
    );
    return valid && user?.active && user.password_hash
      ? { id: user.id, twoFactor: !!user.totp_enabled_at }
      : null;
  }

  /** New session; returns the raw token for the cookie (only its hash is stored). */
  async createSession(
    db: Pool,
    userId: string,
    opts: { remember: boolean; userAgent?: string; ip?: string },
  ) {
    const token = newToken();
    const expiresAt = new Date(
      Date.now() + (opts.remember ? SESSION_TTL_REMEMBER : SESSION_TTL_DEFAULT),
    );
    await db.query(
      `insert into sessions (user_id, token_hash, expires_at, user_agent, ip)
       values ($1, $2, $3, $4, $5)`,
      [
        userId,
        hashToken(token),
        expiresAt,
        opts.userAgent?.slice(0, 500) ?? null,
        opts.ip ?? null,
      ],
    );
    await db.query('update users set last_login_at = now() where id = $1', [
      userId,
    ]);
    return { token, expiresAt };
  }

  /** The session's user, or null if unknown, expired or the account disabled. */
  async validateSession(db: Pool, token: string): Promise<ClinicUser | null> {
    const { rows } = await db.query<ClinicUser>(
      `select s.id as "sessionId", u.id, u.name, u.email, u.role,
              u.totp_enabled_at is null and coalesce(
                (select require_two_factor from clinic_settings where id = 1), false
              ) as "twoFactorSetupRequired"
         from sessions s join users u on u.id = s.user_id
        where s.token_hash = $1 and s.expires_at > now() and u.active`,
      [hashToken(token)],
    );
    return rows[0] ?? null;
  }

  async revokeSession(db: Pool, sessionId: string) {
    await db.query('delete from sessions where id = $1', [sessionId]);
  }

  /** This person's signed-in devices, the current one first. */
  async listSessions(db: Pool, user: ClinicUser) {
    const { rows } = await db.query<{
      id: string;
      userAgent: string | null;
      ip: string | null;
      createdAt: Date;
      expiresAt: Date;
    }>(
      `select id, user_agent as "userAgent", ip, created_at as "createdAt",
              expires_at as "expiresAt"
         from sessions where user_id = $1 and expires_at > now()
        order by id = $2 desc, created_at desc`,
      [user.id, user.sessionId],
    );
    return rows.map((s) => ({ ...s, current: s.id === user.sessionId }));
  }

  /** Signs out one of this person's other devices (false if not theirs). */
  async revokeOwnSession(db: Pool, user: ClinicUser, sessionId: string) {
    const { rowCount } = await db.query(
      'delete from sessions where id = $1 and user_id = $2 and id <> $3',
      [sessionId, user.id, user.sessionId],
    );
    return Boolean(rowCount);
  }

  /** Signs out every device of this person but the current one. */
  async revokeOtherSessions(db: Pool, user: ClinicUser) {
    const { rowCount } = await db.query(
      'delete from sessions where user_id = $1 and id <> $2',
      [user.id, user.sessionId],
    );
    return rowCount ?? 0;
  }

  /**
   * New password, after checking the current one; other devices are signed
   * out (a stolen session doesn't survive the change). False if the current
   * password is wrong.
   */
  async changePassword(
    db: Pool,
    user: ClinicUser,
    currentPassword: string,
    newPassword: string,
  ) {
    const { rows } = await db.query<{ password_hash: string | null }>(
      'select password_hash from users where id = $1',
      [user.id],
    );
    const hash = rows[0]?.password_hash;
    if (!hash || !(await argon2.verify(hash, currentPassword))) return false;
    await db.query(
      'update users set password_hash = $2, updated_at = now() where id = $1',
      [user.id, await argon2.hash(newPassword)],
    );
    await this.revokeOtherSessions(db, user);
    return true;
  }

  /** Who the invitation link is for; null if unknown, used or expired. */
  async findInvitation(db: Pool, token: string) {
    const { rows } = await db.query<{
      id: string;
      name: string;
      email: string;
      hasPassword: boolean;
    }>(
      `select id, name, email, password_hash is not null as "hasPassword" from users
        where invite_token_hash = $1 and invite_expires_at > now() and active`,
      [hashToken(token)],
    );
    return rows[0] ?? null;
  }

  /** Sets the password from the link (single use) and signs out other sessions. */
  async acceptInvitation(db: Pool, token: string, password: string) {
    const invitation = await this.findInvitation(db, token);
    if (!invitation) return null;
    const passwordHash = await argon2.hash(password);
    const client = await db.connect();
    try {
      await client.query('begin');
      // The token is cleared in the same statement that checks it: a link
      // used twice at the same time only works once.
      const { rowCount } = await client.query(
        `update users set password_hash = $1, invite_token_hash = null,
                invite_expires_at = null, updated_at = now()
          where id = $2 and invite_token_hash = $3`,
        [passwordHash, invitation.id, hashToken(token)],
      );
      if (!rowCount) {
        await client.query('rollback');
        return null;
      }
      await client.query('delete from sessions where user_id = $1', [
        invitation.id,
      ]);
      await client.query('commit');
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
    return { id: invitation.id, joined: !invitation.hasPassword };
  }
}
