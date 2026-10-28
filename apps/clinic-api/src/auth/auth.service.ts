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
    }>('select id, password_hash, active from users where lower(email) = $1', [
      email.trim().toLowerCase(),
    ]);
    const user = rows[0];
    const valid = await argon2.verify(
      user?.password_hash ?? DUMMY_HASH,
      password,
    );
    return valid && user?.active && user.password_hash ? { id: user.id } : null;
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
      `select s.id as "sessionId", u.id, u.name, u.email, u.role
         from sessions s join users u on u.id = s.user_id
        where s.token_hash = $1 and s.expires_at > now() and u.active`,
      [hashToken(token)],
    );
    return rows[0] ?? null;
  }

  async revokeSession(db: Pool, sessionId: string) {
    await db.query('delete from sessions where id = $1', [sessionId]);
  }

  /** Who the invitation link is for; null if unknown, used or expired. */
  async findInvitation(db: Pool, token: string) {
    const { rows } = await db.query<{
      id: string;
      name: string;
      email: string;
    }>(
      `select id, name, email from users
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
    return { id: invitation.id };
  }
}
