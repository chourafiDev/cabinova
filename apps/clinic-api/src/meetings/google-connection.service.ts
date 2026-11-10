import { createHash } from 'node:crypto';
import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SecretBox } from '@cabinova/secret-box';
import { ActivityService } from '../activity/activity.service.js';
import type { ClinicUser } from '../auth/auth.types.js';
import { assertOwner } from '../auth/roles.js';
import type { Env } from '../config/env.js';
import { SECRET_BOX } from '../database/catalog.module.js';
import { clinicAppUrl } from '../tenancy/app-url.js';
import {
  type ClinicContext,
  TenancyService,
} from '../tenancy/tenancy.service.js';
import {
  authorizationUrl,
  exchangeCode,
  GoogleAuthError,
  type GoogleClient,
  GoogleError,
  refreshAccessToken,
  revoke,
  signState,
  verifyState,
} from './google.js';

type ConnectionRow = {
  email: string;
  refresh_token: string;
  key_version: number;
  connected_at: Date;
  connected_by_name: string | null;
};

/** Access tokens last an hour: kept until a minute before. */
const EARLY_MS = 60_000;

/**
 * The cabinet's Google account, connected by the responsible doctor: the
 * calendar where team meetings are created. One per cabinet.
 */
@Injectable()
export class GoogleConnectionService {
  private readonly logger = new Logger(GoogleConnectionService.name);
  private readonly client: GoogleClient | null;
  private readonly stateKey: Buffer;
  private readonly baseDomain: string;
  private readonly appUrl: (subdomain: string) => string;
  private readonly tokens = new Map<
    string,
    { refresh: string; accessToken: string; expiresAt: number }
  >();

  constructor(
    config: ConfigService<Env, true>,
    @Inject(SECRET_BOX) private readonly secrets: SecretBox,
    private readonly tenancy: TenancyService,
    private readonly activity: ActivityService,
  ) {
    const clientId = config.get('GOOGLE_CLIENT_ID', { infer: true });
    const clientSecret = config.get('GOOGLE_CLIENT_SECRET', { infer: true });
    this.client =
      clientId && clientSecret
        ? {
            clientId,
            clientSecret,
            redirectUri:
              config.get('GOOGLE_REDIRECT_URI', { infer: true }) ??
              `http://localhost:${config.get('PORT')}/integrations/google/callback`,
          }
        : null;
    // Its own key, derived from the master key: states can't be forged.
    this.stateKey = createHash('sha256')
      .update('google-connect-state')
      .update(Buffer.from(String(config.get('TENANT_SECRETS_KEY')), 'base64'))
      .digest();
    this.baseDomain = config.get('TENANT_BASE_DOMAIN');
    this.appUrl = clinicAppUrl(config);
  }

  /** Whether meetings can be created, and with which account. */
  async status({ db }: ClinicContext) {
    if (!this.client) return { configured: false, connected: false };
    const row = await this.row(db);
    return {
      configured: true,
      connected: !!row,
      email: row?.email ?? null,
      connectedAt: row?.connected_at ?? null,
      connectedBy: row?.connected_by_name ?? null,
    };
  }

  /** The address of Google's consent screen, for the responsible doctor. */
  connectUrl({ tenant }: ClinicContext, user: ClinicUser) {
    assertOwner(user);
    const client = this.requireClient();
    const state = signState(this.stateKey, {
      tenantId: tenant.id,
      subdomain: tenant.subdomain,
      userId: user.id,
    });
    return { url: authorizationUrl(client, state) };
  }

  /**
   * Google's return, on the one address shared by every cabinet: the
   * signed state says which. Returns where to send the browser: back to
   * Paramètres › Intégrations with the outcome, or null when the state
   * can't be trusted (nothing to go back to).
   */
  async callback(query: { code?: string; state?: string; error?: string }) {
    const client = this.requireClient();
    const state = query.state ? verifyState(this.stateKey, query.state) : null;
    if (!state) return null;
    const back = (outcome: string) =>
      `${this.appUrl(state.subdomain)}/settings/integrations?google=${outcome}`;

    let ctx: ClinicContext;
    try {
      ctx = await this.tenancy.resolve(`${state.subdomain}.${this.baseDomain}`);
    } catch {
      return null;
    }
    if (ctx.tenant.id !== state.tenantId) return null;
    if (query.error || !query.code) return back('denied');

    const { rows: owners } = await ctx.db.query<{ name: string }>(
      `select name from users where id = $1 and role = 'owner' and active`,
      [state.userId],
    );
    if (!owners[0]) return back('error');

    let granted: Awaited<ReturnType<typeof exchangeCode>>;
    try {
      granted = await exchangeCode(client, query.code);
    } catch (err) {
      this.logger.warn(`Google connect failed: ${String(err)}`);
      return back('error');
    }
    // The calendar box can be unticked on Google's screen: no meetings then.
    if (!granted.calendarGranted || !granted.refreshToken) {
      void revoke(granted.accessToken).catch(() => undefined);
      return back('scope');
    }

    const previous = await this.row(ctx.db);
    const sealed = this.secrets.encrypt(
      granted.refreshToken,
      this.context(ctx.tenant.id),
    );
    await ctx.db.query(
      `insert into google_connection (id, email, refresh_token, key_version, connected_by, connected_at)
       values (1, $1, $2, $3, $4, now())
       on conflict (id) do update
         set email = excluded.email, refresh_token = excluded.refresh_token,
             key_version = excluded.key_version, connected_by = excluded.connected_by,
             connected_at = excluded.connected_at`,
      [
        granted.email ?? 'Google',
        sealed.ciphertext,
        sealed.keyVersion,
        state.userId,
      ],
    );
    this.tokens.set(ctx.tenant.id, {
      refresh: sealed.ciphertext,
      accessToken: granted.accessToken,
      expiresAt: granted.expiresAt,
    });
    // A replaced account keeps no access. Not the same account: revoking
    // its old token would end the grant the new one belongs to.
    if (previous && previous.email !== granted.email) {
      void this.revokeRow(ctx, previous);
    }
    this.activity.later(() =>
      this.activity.record(ctx.db, {
        action: 'integrations.google_connect',
        actor: { id: state.userId, name: owners[0].name },
        target: granted.email,
      }),
    );
    return back('connected');
  }

  async disconnect(ctx: ClinicContext, user: ClinicUser) {
    assertOwner(user);
    const row = await this.row(ctx.db);
    if (!row) return;
    await ctx.db.query('delete from google_connection where id = 1');
    this.tokens.delete(ctx.tenant.id);
    void this.revokeRow(ctx, row);
  }

  /**
   * Runs Google calls with a valid access token. Google's refusal of the
   * account removes the connection and asks to connect again.
   */
  async withGoogle<T>(
    ctx: ClinicContext,
    work: (accessToken: string) => Promise<T>,
  ): Promise<T> {
    const client = this.requireClient();
    const row = await this.row(ctx.db);
    if (!row) {
      throw new ConflictException({
        code: 'GOOGLE_NOT_CONNECTED',
        message:
          'Connectez d’abord un compte Google (Paramètres › Intégrations).',
      });
    }
    try {
      let cached = this.tokens.get(ctx.tenant.id);
      if (
        !cached ||
        cached.refresh !== row.refresh_token ||
        cached.expiresAt - EARLY_MS < Date.now()
      ) {
        const fresh = await refreshAccessToken(
          client,
          this.secrets.decrypt(
            row.refresh_token,
            row.key_version,
            this.context(ctx.tenant.id),
          ),
        );
        cached = { refresh: row.refresh_token, ...fresh };
        this.tokens.set(ctx.tenant.id, cached);
      }
      return await work(cached.accessToken);
    } catch (err) {
      if (err instanceof GoogleAuthError) {
        this.tokens.delete(ctx.tenant.id);
        await ctx.db.query('delete from google_connection where id = 1');
        throw new ConflictException({
          code: 'GOOGLE_RECONNECT',
          message:
            'Google a retiré l’accès de Cabinova à ce compte. Reconnectez-le dans Paramètres › Intégrations.',
        });
      }
      if (err instanceof GoogleError) {
        this.logger.warn(`Google call failed: ${err.message}`);
        throw new ServiceUnavailableException({
          code: 'GOOGLE_UNAVAILABLE',
          message:
            'Google ne répond pas pour le moment. Réessayez dans un instant.',
        });
      }
      throw err;
    }
  }

  private async row(db: ClinicContext['db']) {
    const { rows } = await db.query<ConnectionRow>(
      `select g.email, g.refresh_token, g.key_version, g.connected_at,
              u.name as connected_by_name
         from google_connection g left join users u on u.id = g.connected_by
        where g.id = 1`,
    );
    return rows[0] ?? null;
  }

  private async revokeRow(ctx: ClinicContext, row: ConnectionRow) {
    try {
      await revoke(
        this.secrets.decrypt(
          row.refresh_token,
          row.key_version,
          this.context(ctx.tenant.id),
        ),
      );
    } catch (err) {
      this.logger.warn(`Google revoke failed: ${String(err)}`);
    }
  }

  private requireClient() {
    if (!this.client) {
      throw new ConflictException({
        code: 'GOOGLE_NOT_CONFIGURED',
        message: 'Les réunions Google Meet ne sont pas encore disponibles.',
      });
    }
    return this.client;
  }

  private context = (tenantId: string) => `google:${tenantId}`;
}
