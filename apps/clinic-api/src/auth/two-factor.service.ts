import type { Pool, PoolClient } from '@neondatabase/serverless';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { SecretBox } from '@cabinova/secret-box';
import { CatalogService, SECRET_BOX } from '../database/catalog.module.js';
import type { ClinicContext } from '../tenancy/tenancy.service.js';
import { assertOwner } from './roles.js';
import { hashToken, newToken } from './tokens.js';
import {
  newRecoveryCodes,
  newTotpSecret,
  otpauthUrl,
  verifyTotp,
} from './totp.js';
import type { ClinicUser } from './auth.types.js';

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

type Row = {
  id: string;
  email: string;
  totp_secret: string | null;
  totp_key_version: number | null;
  totp_enabled_at: Date | null;
  totp_last_step: number | null;
  recovery_code_hashes: string[];
};

const COLUMNS = `id, email, totp_secret, totp_key_version, totp_enabled_at,
  totp_last_step, recovery_code_hashes`;

const invalidCode = () =>
  new BadRequestException({ code: 'INVALID_CODE', message: 'Code incorrect.' });

/**
 * Two-factor sign-in for the cabinet's staff, as for platform accounts
 * (admin-api auth/two-factor.service.ts): TOTP from an authenticator app,
 * ten single-use backup codes, and a short-lived challenge between the
 * password and the code. Secrets are encrypted with the master key, bound
 * to the cabinet and the person.
 */
@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);

  constructor(
    @Inject(SECRET_BOX) private readonly secrets: SecretBox,
    private readonly catalog: CatalogService,
  ) {}

  async status({ db }: ClinicContext, userId: string) {
    const { rows } = await db.query<{
      totp_enabled_at: Date | null;
      left: number;
      required: boolean;
    }>(
      `select totp_enabled_at, jsonb_array_length(recovery_code_hashes) as "left",
              (select require_two_factor from clinic_settings where id = 1) as required
         from users where id = $1`,
      [userId],
    );
    const r = rows[0];
    return {
      enabled: !!r.totp_enabled_at,
      enabledAt: r.totp_enabled_at,
      recoveryCodesLeft: r.left,
      /** The cabinet requires it: it can't be turned off. */
      required: r.required,
    };
  }

  /** Password accepted for a 2FA account: a challenge, no session yet. */
  async createChallenge(db: Pool, userId: string, remember: boolean) {
    const token = newToken();
    await db.query(
      `insert into two_factor_challenges (user_id, token_hash, remember, expires_at)
       values ($1, $2, $3, $4)`,
      [
        userId,
        hashToken(token),
        remember,
        new Date(Date.now() + CHALLENGE_TTL_MS),
      ],
    );
    return token;
  }

  /**
   * Second step: an app code or a backup code. Returns who to sign in, or
   * throws. The failure is committed before the error is thrown, so the
   * attempt limit sticks.
   */
  async completeChallenge(ctx: ClinicContext, token: string, code: string) {
    const result = await this.tx(ctx.db, async (client) => {
      const { rows } = await client.query<{
        id: string;
        user_id: string;
        remember: boolean;
        attempts: number;
      }>(
        `select id, user_id, remember, attempts from two_factor_challenges
          where token_hash = $1 and expires_at > now() for update`,
        [hashToken(token)],
      );
      const challenge = rows[0];
      if (!challenge || challenge.attempts >= MAX_ATTEMPTS) {
        return { ok: false as const, expired: true as const };
      }
      const user = await this.find(client, challenge.user_id);
      const method = await this.check(ctx, client, user, code);
      if (!method) {
        const attempt = challenge.attempts + 1;
        await client.query(
          'update two_factor_challenges set attempts = $2 where id = $1',
          [challenge.id, attempt],
        );
        return {
          ok: false as const,
          expired: false as const,
          attemptsLeft: MAX_ATTEMPTS - attempt,
        };
      }
      await client.query('delete from two_factor_challenges where id = $1', [
        challenge.id,
      ]);
      return {
        ok: true as const,
        userId: user.id,
        email: user.email,
        remember: challenge.remember,
        method,
      };
    });

    if (result.ok) {
      if (result.method === 'recovery') {
        await this.audit(ctx, 'clinic.2fa.recovery_used', result.email);
      }
      return result;
    }
    if (result.expired || result.attemptsLeft <= 0) {
      throw new UnauthorizedException({
        code: 'CHALLENGE_EXPIRED',
        message: result.expired
          ? 'Session de connexion expirée. Saisissez à nouveau votre mot de passe.'
          : 'Trop de codes incorrects. Saisissez à nouveau votre mot de passe.',
      });
    }
    throw new UnauthorizedException({
      code: 'INVALID_CODE',
      message: 'Code incorrect.',
      attemptsLeft: result.attemptsLeft,
    });
  }

  /** Enrolment step 1: a new secret, not active until confirmed with a code. */
  async setup({ db, tenant }: ClinicContext, userId: string) {
    const user = await this.find(db, userId);
    if (user.totp_enabled_at) throw this.alreadyEnabled();
    const secret = newTotpSecret();
    const sealed = this.secrets.encrypt(
      secret,
      this.context(tenant.id, userId),
    );
    await db.query(
      'update users set totp_secret = $2, totp_key_version = $3 where id = $1',
      [userId, sealed.ciphertext, sealed.keyVersion],
    );
    return { secret, otpauthUrl: otpauthUrl(secret, user.email) };
  }

  /** Enrolment step 2: the first code proves the app works; the backup codes, once. */
  async enable(ctx: ClinicContext, userId: string, code: string) {
    const result = await this.tx(ctx.db, async (client) => {
      const user = await this.find(client, userId);
      if (user.totp_enabled_at) throw this.alreadyEnabled();
      if (!user.totp_secret) {
        throw new BadRequestException({
          code: 'NO_SETUP',
          message: 'Recommencez la configuration.',
        });
      }
      const step = verifyTotp(this.secretOf(ctx, user), code);
      if (step === null) {
        throw new BadRequestException({
          code: 'INVALID_CODE',
          message: 'Code incorrect. Vérifiez l’heure de votre téléphone.',
        });
      }
      const codes = newRecoveryCodes();
      await client.query(
        `update users set totp_enabled_at = now(), totp_last_step = $2,
                recovery_code_hashes = $3 where id = $1`,
        [userId, step, JSON.stringify(codes.map(hashToken))],
      );
      return { recoveryCodes: codes, email: user.email };
    });
    await this.audit(ctx, 'clinic.2fa.enable', result.email);
    return { recoveryCodes: result.recoveryCodes };
  }

  /** Turning it off needs a valid code, and a cabinet that doesn't require it. */
  async disable(ctx: ClinicContext, userId: string, code: string) {
    const email = await this.tx(ctx.db, async (client) => {
      const user = await this.find(client, userId);
      if (!user.totp_enabled_at) return null;
      const { rows } = await client.query<{ required: boolean }>(
        'select require_two_factor as required from clinic_settings where id = 1',
      );
      if (rows[0].required) {
        throw new ConflictException({
          code: 'TWO_FACTOR_REQUIRED',
          message: 'Votre cabinet exige la double authentification.',
        });
      }
      if (!(await this.check(ctx, client, user, code))) throw invalidCode();
      await this.clear(client, userId);
      return user.email;
    });
    if (email) await this.audit(ctx, 'clinic.2fa.disable', email);
    return { ok: true };
  }

  async regenerateRecoveryCodes(
    ctx: ClinicContext,
    userId: string,
    code: string,
  ) {
    return this.tx(ctx.db, async (client) => {
      const user = await this.find(client, userId);
      if (!user.totp_enabled_at) {
        throw new BadRequestException({
          code: 'NOT_ENABLED',
          message: 'La double authentification n’est pas active.',
        });
      }
      if (!(await this.check(ctx, client, user, code))) throw invalidCode();
      const codes = newRecoveryCodes();
      await client.query(
        'update users set recovery_code_hashes = $2 where id = $1',
        [userId, JSON.stringify(codes.map(hashToken))],
      );
      return { recoveryCodes: codes };
    });
  }

  /** The owner requires it for everyone, once their own account has it. */
  async setRequired(ctx: ClinicContext, user: ClinicUser, required: boolean) {
    assertOwner(user);
    if (required) {
      const self = await this.find(ctx.db, user.id);
      if (!self.totp_enabled_at) {
        throw new ConflictException({
          code: 'OWN_TWO_FACTOR_FIRST',
          message:
            'Activez d’abord la double authentification sur votre propre compte.',
        });
      }
    }
    await ctx.db.query(
      'update clinic_settings set require_two_factor = $1 where id = 1',
      [required],
    );
    await this.audit(ctx, 'clinic.2fa.required', user.email, { required });
    return { required };
  }

  /** Lost phone: turns it off and signs the person out everywhere. */
  async reset(ctx: ClinicContext, actor: ClinicUser, memberId: string) {
    const member = await this.tx(ctx.db, async (client) => {
      const user = await this.find(client, memberId);
      await this.clear(client, memberId);
      await client.query('delete from sessions where user_id = $1', [memberId]);
      return user;
    });
    await this.audit(ctx, 'clinic.2fa.reset', actor.email, {
      member: member.email,
    });
  }

  async isEnabled(db: Pool, userId: string) {
    return !!(await this.find(db, userId)).totp_enabled_at;
  }

  /** "totp" | "recovery" when the code is valid (and consumes it), else null. */
  private async check(
    ctx: ClinicContext,
    client: PoolClient,
    user: Row,
    code: string,
  ) {
    const clean = code.trim().toLowerCase();
    if (/^\d{6}$/.test(clean.replace(/\s/g, ''))) {
      const step = verifyTotp(this.secretOf(ctx, user), clean, {
        lastStep: user.totp_last_step,
      });
      if (step === null) return null;
      await client.query('update users set totp_last_step = $2 where id = $1', [
        user.id,
        step,
      ]);
      return 'totp' as const;
    }
    const hash = hashToken(clean);
    if (!user.recovery_code_hashes.includes(hash)) return null;
    await client.query(
      'update users set recovery_code_hashes = $2 where id = $1',
      [
        user.id,
        JSON.stringify(user.recovery_code_hashes.filter((h) => h !== hash)),
      ],
    );
    return 'recovery' as const;
  }

  private clear(client: PoolClient, userId: string) {
    return client.query(
      `update users set totp_secret = null, totp_key_version = null,
              totp_enabled_at = null, totp_last_step = null,
              recovery_code_hashes = '[]'::jsonb
        where id = $1`,
      [userId],
    );
  }

  private context = (tenantId: string, userId: string) =>
    `totp:${tenantId}:${userId}`;

  private secretOf({ tenant }: ClinicContext, user: Row) {
    return this.secrets.decrypt(
      user.totp_secret!,
      user.totp_key_version ?? 1,
      this.context(tenant.id, user.id),
    );
  }

  private alreadyEnabled() {
    return new ConflictException({
      code: 'ALREADY_ENABLED',
      message: 'La double authentification est déjà active.',
    });
  }

  private async find(db: Pool | PoolClient, id: string) {
    const { rows } = await db.query<Row>(
      `select ${COLUMNS} from users where id = $1`,
      [id],
    );
    if (!rows[0]) throw new UnauthorizedException();
    return rows[0];
  }

  /** Same journal as a Super Admin action; no platform user, the e-mail says who. */
  private async audit(
    { tenant }: ClinicContext,
    action: string,
    email: string,
    metadata: Record<string, unknown> = {},
  ) {
    try {
      await this.catalog.pool.query(
        `insert into platform_audit_logs
           (user_id, tenant_id, entity, entity_id, action, metadata)
         values (null, $1, 'tenant', $1, $2, $3)`,
        [
          tenant.id,
          action,
          JSON.stringify({ source: 'clinic', by: email, ...metadata }),
        ],
      );
    } catch (err) {
      this.logger.error(`Audit ${action} failed`, err);
    }
  }

  private async tx<T>(db: Pool, fn: (client: PoolClient) => Promise<T>) {
    const client = await db.connect();
    try {
      await client.query('begin');
      const result = await fn(client);
      await client.query('commit');
      return result;
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  }
}
