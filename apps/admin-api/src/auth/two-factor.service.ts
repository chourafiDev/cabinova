import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { and, eq, gt } from 'drizzle-orm';
import { type AuditActor, writeAudit } from '../audit/audit.js';
import { SECRET_BOX } from '../crypto/crypto.module.js';
import {
  type Database,
  DatabaseService,
  type Transaction,
} from '../database/database.module.js';
import {
  platformMfaChallenges,
  platformSessions,
  platformUsers,
} from '../database/schema/index.js';
import type { SecretBox } from '../tenant-databases/secret-box.js';
import { hashToken, newToken } from './tokens.js';
import {
  newRecoveryCodes,
  newTotpSecret,
  otpauthUrl,
  verifyTotp,
} from './totp.js';

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

type User = typeof platformUsers.$inferSelect;

/**
 * Two-factor authentication for platform accounts (Sécurité et
 * conformité): TOTP from an authenticator app, ten single-use backup codes,
 * a short-lived challenge between the password and the code, and an admin
 * reset for a lost phone. The TOTP secret is encrypted with the master key.
 */
@Injectable()
export class TwoFactorService {
  constructor(
    private readonly database: DatabaseService,
    @Inject(SECRET_BOX) private readonly secrets: SecretBox | null,
  ) {}

  status(user: Pick<User, 'totpEnabledAt' | 'recoveryCodeHashes'>) {
    return {
      enabled: !!user.totpEnabledAt,
      enabledAt: user.totpEnabledAt,
      recoveryCodesLeft: user.recoveryCodeHashes.length,
    };
  }

  async statusFor(userId: string) {
    return this.status(await this.find(userId));
  }

  /** Password accepted for a 2FA account: issue the challenge, no session yet. */
  async createChallenge(userId: string, remember: boolean) {
    const token = newToken();
    await this.database.db.insert(platformMfaChallenges).values({
      userId,
      tokenHash: hashToken(token),
      remember,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    });
    return token;
  }

  /**
   * Second step: a TOTP code or a backup code. Returns the user to sign in,
   * or throws. Failed attempts are counted (5 max) and audited.
   */
  async completeChallenge(token: string, code: string, ip?: string) {
    // The failure is committed before the error is thrown: if it lived in the
    // same transaction it would roll back, and the 5-attempt limit (and its
    // audit entry) would never stick.
    const result = await this.database.db.transaction(async (tx) => {
      const [challenge] = await tx
        .select()
        .from(platformMfaChallenges)
        .where(
          and(
            eq(platformMfaChallenges.tokenHash, hashToken(token)),
            gt(platformMfaChallenges.expiresAt, new Date()),
          ),
        )
        .for('update');
      if (!challenge || challenge.attempts >= MAX_ATTEMPTS) {
        return { ok: false as const, expired: true as const };
      }
      const user = await this.find(challenge.userId, tx);
      const method = await this.check(tx, user, code);
      if (!method) {
        const attempt = challenge.attempts + 1;
        await tx
          .update(platformMfaChallenges)
          .set({ attempts: attempt })
          .where(eq(platformMfaChallenges.id, challenge.id));
        await this.audit(
          tx,
          { userId: user.id, ip },
          'auth.2fa_failed',
          user.id,
          { attempt },
        );
        return {
          ok: false as const,
          expired: false as const,
          attemptsLeft: MAX_ATTEMPTS - attempt,
        };
      }
      await tx
        .delete(platformMfaChallenges)
        .where(eq(platformMfaChallenges.id, challenge.id));
      if (method === 'recovery') {
        await this.audit(
          tx,
          { userId: user.id, ip },
          'auth.2fa.recovery_used',
          user.id,
          {
            left: user.recoveryCodeHashes.length - 1,
          },
        );
      }
      return {
        ok: true as const,
        userId: user.id,
        remember: challenge.remember,
        method,
      };
    });

    if (result.ok) return result;
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

  /** Enrolment step 1: a new secret (not active until confirmed with a code). */
  async setup(userId: string) {
    const user = await this.find(userId);
    if (user.totpEnabledAt) {
      throw new ConflictException({
        code: 'ALREADY_ENABLED',
        message: 'La double authentification est déjà active.',
      });
    }
    const secret = newTotpSecret();
    const sealed = this.box().encrypt(secret, `totp:${userId}`);
    await this.database.db
      .update(platformUsers)
      .set({ totpSecret: sealed.ciphertext, totpKeyVersion: sealed.keyVersion })
      .where(eq(platformUsers.id, userId));
    return { secret, otpauthUrl: otpauthUrl(secret, user.email) };
  }

  /** Enrolment step 2: the first code proves the app is set up; returns the backup codes (once). */
  async enable(actor: AuditActor & { userId: string }, code: string) {
    return this.database.db.transaction(async (tx) => {
      const user = await this.find(actor.userId, tx);
      if (user.totpEnabledAt) {
        throw new ConflictException({
          code: 'ALREADY_ENABLED',
          message: 'La double authentification est déjà active.',
        });
      }
      if (!user.totpSecret) {
        throw new BadRequestException({
          code: 'NO_SETUP',
          message: 'Recommencez la configuration.',
        });
      }
      const step = verifyTotp(this.secretOf(user), code);
      if (step === null) {
        throw new BadRequestException({
          code: 'INVALID_CODE',
          message: 'Code incorrect. Vérifiez l’heure de votre téléphone.',
        });
      }
      const codes = newRecoveryCodes();
      await tx
        .update(platformUsers)
        .set({
          totpEnabledAt: new Date(),
          totpLastStep: step,
          recoveryCodeHashes: codes.map(hashToken),
        })
        .where(eq(platformUsers.id, user.id));
      await this.audit(tx, actor, 'auth.2fa.enable', user.id);
      return { recoveryCodes: codes };
    });
  }

  /** Turning it off needs a valid code (or backup code). */
  async disable(actor: AuditActor & { userId: string }, code: string) {
    return this.database.db.transaction(async (tx) => {
      const user = await this.find(actor.userId, tx);
      if (!user.totpEnabledAt) return { ok: true };
      if (!(await this.check(tx, user, code))) {
        throw new BadRequestException({
          code: 'INVALID_CODE',
          message: 'Code incorrect.',
        });
      }
      await this.clear(tx, user.id);
      await this.audit(tx, actor, 'auth.2fa.disable', user.id);
      return { ok: true };
    });
  }

  async regenerateRecoveryCodes(
    actor: AuditActor & { userId: string },
    code: string,
  ) {
    return this.database.db.transaction(async (tx) => {
      const user = await this.find(actor.userId, tx);
      if (!user.totpEnabledAt) {
        throw new BadRequestException({
          code: 'NOT_ENABLED',
          message: 'La double authentification n’est pas active.',
        });
      }
      if (!(await this.check(tx, user, code))) {
        throw new BadRequestException({
          code: 'INVALID_CODE',
          message: 'Code incorrect.',
        });
      }
      const codes = newRecoveryCodes();
      await tx
        .update(platformUsers)
        .set({ recoveryCodeHashes: codes.map(hashToken) })
        .where(eq(platformUsers.id, user.id));
      await this.audit(tx, actor, 'auth.2fa.recovery_regenerate', user.id);
      return { recoveryCodes: codes };
    });
  }

  /** Lost phone: an admin turns 2FA off and signs the user out everywhere. */
  async adminReset(tx: Transaction, actor: AuditActor, userId: string) {
    await this.clear(tx, userId);
    await tx
      .delete(platformSessions)
      .where(eq(platformSessions.userId, userId));
    await this.audit(tx, actor, 'platform_user.2fa_reset', userId);
  }

  /** "totp" | "recovery" when the code is valid (and consumes it), else null. */
  private async check(tx: Transaction, user: User, code: string) {
    const clean = code.trim().toLowerCase();
    if (/^\d{6}$/.test(clean.replace(/\s/g, ''))) {
      const step = verifyTotp(this.secretOf(user), clean, {
        lastStep: user.totpLastStep,
      });
      if (step === null) return null;
      await tx
        .update(platformUsers)
        .set({ totpLastStep: step })
        .where(eq(platformUsers.id, user.id));
      return 'totp' as const;
    }
    const hash = hashToken(clean);
    if (!user.recoveryCodeHashes.includes(hash)) return null;
    await tx
      .update(platformUsers)
      .set({
        recoveryCodeHashes: user.recoveryCodeHashes.filter((h) => h !== hash),
      })
      .where(eq(platformUsers.id, user.id));
    return 'recovery' as const;
  }

  private clear(tx: Transaction, userId: string) {
    return tx
      .update(platformUsers)
      .set({
        totpSecret: null,
        totpKeyVersion: null,
        totpEnabledAt: null,
        totpLastStep: null,
        recoveryCodeHashes: [],
      })
      .where(eq(platformUsers.id, userId));
  }

  private secretOf(user: User) {
    return this.box().decrypt(
      user.totpSecret!,
      user.totpKeyVersion ?? 1,
      `totp:${user.id}`,
    );
  }

  private box() {
    if (!this.secrets) {
      throw new ServiceUnavailableException({
        code: 'SECRETS_NOT_CONFIGURED',
        message:
          'TENANT_SECRETS_KEY manquante : double authentification indisponible.',
      });
    }
    return this.secrets;
  }

  private async find(
    id: string,
    tx: Database | Transaction = this.database.db,
  ) {
    const [user] = await tx
      .select()
      .from(platformUsers)
      .where(eq(platformUsers.id, id));
    if (!user) throw new UnauthorizedException();
    return user;
  }

  private audit(
    tx: Transaction,
    actor: AuditActor,
    action: string,
    userId: string,
    metadata?: Record<string, unknown>,
  ) {
    return writeAudit(tx, actor, {
      action,
      entity: 'platform_user',
      entityId: userId,
      metadata,
    });
  }
}
