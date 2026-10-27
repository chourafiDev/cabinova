import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, desc, eq, lt, sql } from 'drizzle-orm';
import { type AuditActor, writeAudit } from '../audit/audit.js';
import { hashToken, newToken } from '../auth/tokens.js';
import type { Env } from '../config/env.js';
import { DatabaseService } from '../database/database.module.js';
import {
  type ProvisioningStep,
  tenantDatabases,
  tenantDomains,
  tenantProvisioningRuns,
  tenants,
  tenantSecrets,
} from '../database/schema/index.js';
import { EmailService } from '../email/email.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { canTransition } from '../tenants/lifecycle.js';
import { TenantLifecycleService } from '../tenants/tenant-lifecycle.service.js';
import { TENANT_DB_PROVIDER, type TenantDatabaseProvider } from './provider.js';
import { TenantConnections } from './tenant-connections.js';
import { TenantDatabasesService } from './tenant-databases.service.js';

type Tenant = typeof tenants.$inferSelect;

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** A running run with no heartbeat for this long was interrupted. */
const STALE_AFTER_MS = 5 * 60 * 1000;

/**
 * Module 2 Scenario A, system side — turns a pending cabinet into an active
 * one: its own database and role, encrypted credentials, schema migrations,
 * the clinic profile and the responsible doctor's account, a connection
 * test, the invitation, and only then `active`. Every step is idempotent,
 * so a failed run (cabinet back to `pending`) can simply be started again.
 */
@Injectable()
export class ProvisioningService {
  private readonly logger = new Logger(ProvisioningService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly connections: TenantConnections,
    private readonly databases: TenantDatabasesService,
    private readonly lifecycle: TenantLifecycleService,
    private readonly email: EmailService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService<Env, true>,
    @Inject(TENANT_DB_PROVIDER)
    private readonly provider: TenantDatabaseProvider | null,
  ) {
    if (!provider || !connections.configured) {
      this.logger.warn(
        'TENANT_DB_ADMIN_URL or TENANT_SECRETS_KEY is not set: clinic databases cannot be provisioned.',
      );
    }
  }

  /** Starts a run and returns it at once; the steps continue in background. */
  async start(
    tenantId: string,
    actor: AuditActor,
    options: { sendInvitation: boolean },
  ) {
    if (!this.provider || !this.connections.configured) {
      throw new ServiceUnavailableException({
        code: 'PROVISIONING_NOT_CONFIGURED',
        message:
          'Provisionnement indisponible : TENANT_DB_ADMIN_URL et TENANT_SECRETS_KEY doivent être définies.',
      });
    }
    const run = await this.database.db.transaction(async (tx) => {
      const [tenant] = await tx
        .select({ status: tenants.status })
        .from(tenants)
        .where(eq(tenants.id, tenantId));
      if (tenant && !canTransition(tenant.status, 'provision')) {
        throw new ConflictException({
          code: 'NOT_PENDING',
          message: 'Seul un cabinet en attente peut être provisionné.',
        });
      }
      await this.lifecycle.applySystem(
        tx,
        tenantId,
        'provision',
        actor,
        'Provisionnement lancé',
      );
      const [run] = await tx
        .insert(tenantProvisioningRuns)
        .values({
          tenantId,
          sendInvitation: options.sendInvitation,
          startedBy: actor.userId,
        })
        .returning();
      await writeAudit(tx, actor, {
        action: 'tenant.provision.start',
        entity: 'tenant',
        entityId: tenantId,
        tenantId,
        metadata: { runId: run.id },
      });
      return run;
    });

    void this.execute(run.id, actor);
    return run;
  }

  runs(tenantId: string, limit = 5) {
    return this.database.db
      .select()
      .from(tenantProvisioningRuns)
      .where(eq(tenantProvisioningRuns.tenantId, tenantId))
      .orderBy(desc(tenantProvisioningRuns.startedAt))
      .limit(limit);
  }

  /** Fails runs whose process died mid-way and puts their cabinet back to pending. */
  async recoverStale() {
    const stale = await this.database.db
      .select({ id: tenantProvisioningRuns.id })
      .from(tenantProvisioningRuns)
      .where(
        and(
          eq(tenantProvisioningRuns.state, 'running'),
          lt(
            tenantProvisioningRuns.heartbeatAt,
            new Date(Date.now() - STALE_AFTER_MS),
          ),
        ),
      );
    for (const { id } of stale) {
      await this.fail(
        id,
        { userId: null },
        'Interrompu (redémarrage du serveur ?)',
      );
    }
    return stale.length;
  }

  private async execute(runId: string, actor: AuditActor) {
    const [run] = await this.database.db
      .select()
      .from(tenantProvisioningRuns)
      .where(eq(tenantProvisioningRuns.id, runId));
    const tenant = await this.tenant(run.tenantId);
    let step = 'database';
    try {
      await this.step(runId, step, () => this.createDatabase(tenant));
      step = 'migrations';
      await this.step(runId, step, async () => {
        const result = await this.databases.migrate(tenant.id, actor);
        if (!result.ok) throw new Error(result.error);
        return result.schemaVersion ?? undefined;
      });
      step = 'seed';
      const invitation = await this.step(runId, step, () => this.seed(tenant));
      step = 'healthcheck';
      await this.step(runId, step, async () => {
        const health = await this.databases.check(tenant.id, actor);
        if (!health.healthy)
          throw new Error(health.error ?? 'Base injoignable');
        return `${health.latencyMs} ms`;
      });
      step = 'invitation';
      await this.step(runId, step, async () => {
        if (!run.sendInvitation || !invitation.token) return null;
        await this.email.sendInvitation({
          email: tenant.email,
          name: tenant.responsibleName,
          tenantName: tenant.name,
          url: await this.inviteUrl(tenant.id, invitation.token),
        });
        return tenant.email;
      });
      step = 'activate';
      await this.database.db.transaction(async (tx) => {
        await this.lifecycle.applySystem(
          tx,
          tenant.id,
          'activate',
          actor,
          'Provisionnement terminé',
        );
        await tx
          .update(tenantProvisioningRuns)
          .set({
            state: 'succeeded',
            finishedAt: new Date(),
            steps: this.appendStep({ key: 'activate', status: 'done' }),
          })
          .where(eq(tenantProvisioningRuns.id, runId));
        await writeAudit(tx, actor, {
          action: 'tenant.provision.succeed',
          entity: 'tenant',
          entityId: tenant.id,
          tenantId: tenant.id,
          metadata: { runId },
        });
      });
      await this.notifications.notify({
        kind: 'tenant.provision.succeeded',
        severity: 'success',
        title: 'Cabinet prêt',
        body: `${tenant.name} est actif : base créée et médecin invité.`,
        href: `/tenants/${tenant.id}`,
        tenantId: tenant.id,
        permission: 'tenants:read',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Provisioning ${tenant.id} failed at ${step}: ${message}`,
      );
      await this.fail(runId, actor, message, step);
    }
  }

  /**
   * Runs one step and records it. A callback returning null marks the step
   * skipped; a string becomes its detail.
   */
  private async step<T>(
    runId: string,
    key: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const result = await fn();
    const detail =
      typeof result === 'string'
        ? result
        : result && typeof result === 'object' && 'detail' in result
          ? String(result.detail)
          : undefined;
    await this.database.db
      .update(tenantProvisioningRuns)
      .set({
        steps: this.appendStep({
          key,
          status: result === null ? 'skipped' : 'done',
          detail,
        }),
        heartbeatAt: new Date(),
      })
      .where(eq(tenantProvisioningRuns.id, runId));
    return result;
  }

  private appendStep(step: Omit<ProvisioningStep, 'at'>) {
    const entry = { ...step, at: new Date().toISOString() };
    return sql`${tenantProvisioningRuns.steps} || ${JSON.stringify([entry])}::jsonb`;
  }

  private async fail(
    runId: string,
    actor: AuditActor,
    error: string,
    step?: string,
  ) {
    await this.database.db
      .transaction(async (tx) => {
        const [run] = await tx
          .update(tenantProvisioningRuns)
          .set({
            state: 'failed',
            error,
            finishedAt: new Date(),
            ...(step && {
              steps: this.appendStep({
                key: step,
                status: 'failed',
                detail: error,
              }),
            }),
          })
          .where(
            and(
              eq(tenantProvisioningRuns.id, runId),
              eq(tenantProvisioningRuns.state, 'running'),
            ),
          )
          .returning();
        if (!run) return;
        const [tenant] = await tx
          .select({ status: tenants.status })
          .from(tenants)
          .where(eq(tenants.id, run.tenantId));
        if (tenant && canTransition(tenant.status, 'provision_failed')) {
          await this.lifecycle.applySystem(
            tx,
            run.tenantId,
            'provision_failed',
            actor,
            `Échec du provisionnement${step ? ` (${step})` : ''} : ${error}`,
          );
        }
        await writeAudit(tx, actor, {
          action: 'tenant.provision.fail',
          entity: 'tenant',
          entityId: run.tenantId,
          tenantId: run.tenantId,
          metadata: { runId, step, error },
        });
        return run;
      })
      .then(async (run) => {
        if (!run) return;
        const [tenant] = await this.database.db
          .select({ name: tenants.name })
          .from(tenants)
          .where(eq(tenants.id, run.tenantId));
        await this.notifications.notify({
          kind: 'tenant.provision.failed',
          severity: 'critical',
          title: 'Provisionnement échoué',
          body: `${tenant?.name ?? run.tenantId}${step ? ` (étape ${step})` : ''} — ${error.slice(0, 200)}`,
          href: `/tenants/${run.tenantId}?tab=technical`,
          tenantId: run.tenantId,
          permission: 'technical:read',
        });
      });
  }

  /** Creates the database and role once; a later run reuses them. */
  private async createDatabase(tenant: Tenant) {
    const [existing] = await this.database.db
      .select({ databaseName: tenantDatabases.databaseName })
      .from(tenantDatabases)
      .where(eq(tenantDatabases.tenantId, tenant.id));
    if (existing?.databaseName)
      return { detail: `${existing.databaseName} (existante)` };

    const created = await this.provider!.create(tenant);
    const sealed = this.connections.seal(tenant.id, created.password);
    await this.database.db.transaction(async (tx) => {
      const [secret] = await tx
        .insert(tenantSecrets)
        .values({ tenantId: tenant.id, ...sealed })
        .returning({ id: tenantSecrets.id });
      await tx.insert(tenantDatabases).values({
        tenantId: tenant.id,
        provider: created.provider,
        mode: created.mode,
        providerRef: created.providerRef,
        host: created.host,
        databaseName: created.databaseName,
        roleName: created.roleName,
        secretRef: secret.id,
      });
    });
    return { detail: created.databaseName };
  }

  /**
   * Clinic profile from the catalog, and the responsible doctor as owner.
   * Returns an invitation token when one was (re)issued: a doctor who already
   * chose a password isn't invited again.
   */
  private seed(tenant: Tenant) {
    return this.connections.with(tenant.id, async (pool) => {
      await pool.query(
        `insert into clinic_settings (id, name, legal_name, specialty, address, city, phone, email, locale, timezone)
         values (1, $1, $2, $3, $4, $5, $6, $7, $8, $9)
         on conflict (id) do update set name = excluded.name, legal_name = excluded.legal_name,
           specialty = excluded.specialty, address = excluded.address, city = excluded.city,
           phone = excluded.phone, email = excluded.email, updated_at = now()`,
        [
          tenant.name,
          tenant.legalName,
          tenant.specialty,
          tenant.address,
          tenant.city,
          tenant.phone,
          tenant.email,
          tenant.locale,
          tenant.timezone,
        ],
      );
      const { rows } = await pool.query<{ password_hash: string | null }>(
        'select password_hash from users where email = $1',
        [tenant.email],
      );
      if (rows[0]?.password_hash)
        return { token: null, detail: 'compte existant' };

      const token = newToken();
      await pool.query(
        `insert into users (name, email, role, invite_token_hash, invite_expires_at)
         values ($1, $2, 'owner', $3, $4)
         on conflict (email) do update set invite_token_hash = excluded.invite_token_hash,
           invite_expires_at = excluded.invite_expires_at, updated_at = now()`,
        [
          tenant.responsibleName,
          tenant.email,
          hashToken(token),
          new Date(Date.now() + INVITE_TTL_MS),
        ],
      );
      return { token, detail: `${tenant.email} (propriétaire)` };
    });
  }

  private async inviteUrl(tenantId: string, token: string) {
    const [domain] = await this.database.db
      .select({ subdomain: tenantDomains.subdomain })
      .from(tenantDomains)
      .where(eq(tenantDomains.tenantId, tenantId));
    return `https://${domain.subdomain}.${this.config.get('TENANT_BASE_DOMAIN')}/invite/${token}`;
  }

  private async tenant(id: string) {
    const [tenant] = await this.database.db
      .select()
      .from(tenants)
      .where(eq(tenants.id, id));
    return tenant;
  }
}
