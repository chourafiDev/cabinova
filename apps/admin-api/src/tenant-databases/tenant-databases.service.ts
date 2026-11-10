import { Injectable, Logger } from '@nestjs/common';
import { and, asc, eq, inArray, isNotNull } from 'drizzle-orm';
import { type AuditActor, writeAudit } from '../audit/audit.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { TeamAlertsService } from '../settings/team-alerts.service.js';
import { DatabaseService } from '../database/database.module.js';
import { tenantDatabases, tenants } from '../database/schema/index.js';
import {
  latestSchemaVersion,
  TenantConnections,
} from './tenant-connections.js';

/** Cabinets whose database is maintained: not closed, not mid-provisioning. */
const MAINTAINED = ['active', 'suspended', 'closure_pending'] as const;

/** Columns safe to show: no secret reference. */
const publicColumns = {
  tenantId: tenantDatabases.tenantId,
  provider: tenantDatabases.provider,
  mode: tenantDatabases.mode,
  host: tenantDatabases.host,
  databaseName: tenantDatabases.databaseName,
  roleName: tenantDatabases.roleName,
  schemaVersion: tenantDatabases.schemaVersion,
  lastMigratedAt: tenantDatabases.lastMigratedAt,
  lastMigrationError: tenantDatabases.lastMigrationError,
  lastHealthCheckAt: tenantDatabases.lastHealthCheckAt,
  healthy: tenantDatabases.healthy,
  lastHealthError: tenantDatabases.lastHealthError,
  latencyMs: tenantDatabases.latencyMs,
  sizeBytes: tenantDatabases.sizeBytes,
  sizeCheckedAt: tenantDatabases.sizeCheckedAt,
  createdAt: tenantDatabases.createdAt,
};

/**
 * Module 4 — the technical side of each clinic database: migrations (one
 * clinic, or every clinic behind the latest version), connection tests, and
 * the fleet view. A failure is recorded on that clinic and audited; it never
 * stops the others.
 */
@Injectable()
export class TenantDatabasesService {
  private readonly logger = new Logger(TenantDatabasesService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly connections: TenantConnections,
    private readonly alerts: TeamAlertsService,
    private readonly notifications: NotificationsService,
  ) {}

  async get(tenantId: string) {
    const [row] = await this.database.db
      .select(publicColumns)
      .from(tenantDatabases)
      .where(eq(tenantDatabases.tenantId, tenantId));
    return {
      database: row ?? null,
      latestSchemaVersion: latestSchemaVersion(),
      configured: this.connections.configured,
    };
  }

  /** Fleet view: every clinic database, lagging and unhealthy ones first. */
  async overview() {
    const latest = latestSchemaVersion();
    const rows = await this.database.db
      .select({
        ...publicColumns,
        tenantName: tenants.name,
        tenantStatus: tenants.status,
      })
      .from(tenantDatabases)
      .innerJoin(tenants, eq(tenants.id, tenantDatabases.tenantId))
      .orderBy(asc(tenants.name));
    const behind = (r: (typeof rows)[number]) => r.schemaVersion !== latest;
    rows.sort(
      (a, b) =>
        Number(b.healthy === false) - Number(a.healthy === false) ||
        Number(behind(b)) - Number(behind(a)),
    );
    return {
      latestSchemaVersion: latest,
      total: rows.length,
      behind: rows.filter(behind).length,
      unhealthy: rows.filter((r) => r.healthy === false).length,
      failedMigrations: rows.filter((r) => r.lastMigrationError).length,
      data: rows,
    };
  }

  /**
   * Lost phone of the responsible doctor (their team goes through them, in
   * Équipe): turns off 2FA and signs them out everywhere.
   */
  async resetOwnerTwoFactor(tenantId: string, actor: AuditActor) {
    const owners = await this.connections.with(tenantId, async (pool) => {
      const { rows } = await pool.query<{ id: string; email: string }>(
        `update users set totp_secret = null, totp_key_version = null,
                totp_enabled_at = null, totp_last_step = null,
                recovery_code_hashes = '[]'::jsonb
          where role = 'owner' returning id, email`,
      );
      await pool.query('delete from sessions where user_id = any($1)', [
        rows.map((r) => r.id),
      ]);
      return rows;
    });
    await writeAudit(this.database.db, actor, {
      action: 'tenant.owner_2fa_reset',
      entity: 'tenant',
      entityId: tenantId,
      tenantId,
      metadata: { owners: owners.map((o) => o.email) },
    });
    return { ok: true };
  }

  async migrate(tenantId: string, actor: AuditActor) {
    const [before] = await this.database.db
      .select({ schemaVersion: tenantDatabases.schemaVersion })
      .from(tenantDatabases)
      .where(eq(tenantDatabases.tenantId, tenantId));
    try {
      const schemaVersion = await this.connections.migrate(tenantId);
      await this.database.db.transaction(async (tx) => {
        await tx
          .update(tenantDatabases)
          .set({
            schemaVersion,
            lastMigratedAt: new Date(),
            lastMigrationError: null,
          })
          .where(eq(tenantDatabases.tenantId, tenantId));
        if (before?.schemaVersion !== schemaVersion) {
          await writeAudit(tx, actor, {
            action: 'tenant.database.migrate',
            entity: 'tenant',
            entityId: tenantId,
            tenantId,
            metadata: {
              from: before?.schemaVersion ?? null,
              to: schemaVersion,
            },
          });
        }
      });
      return { tenantId, ok: true as const, schemaVersion };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.logger.error(`Migration of ${tenantId} failed: ${error}`);
      await this.database.db.transaction(async (tx) => {
        await tx
          .update(tenantDatabases)
          .set({ lastMigrationError: error })
          .where(eq(tenantDatabases.tenantId, tenantId));
        await writeAudit(tx, actor, {
          action: 'tenant.database.migrate_failed',
          entity: 'tenant',
          entityId: tenantId,
          tenantId,
          metadata: { from: before?.schemaVersion ?? null, error },
        });
      });
      const [tenant] = await this.database.db
        .select({ name: tenants.name })
        .from(tenants)
        .where(eq(tenants.id, tenantId));
      await this.notifications.notify({
        kind: 'technical.migration.failed',
        severity: 'critical',
        title: 'Migration échouée',
        body: `${tenant?.name ?? tenantId} — ${error.slice(0, 200)}`,
        href: `/tenants/${tenantId}?tab=technical`,
        tenantId,
        permission: 'technical:read',
      });
      return { tenantId, ok: false as const, error };
    }
  }

  /** Global migration: every maintained clinic not on the latest version. */
  async migrateBehind(actor: AuditActor) {
    const latest = latestSchemaVersion();
    const targets = await this.maintained();
    const results = [];
    for (const { tenantId, schemaVersion } of targets) {
      if (schemaVersion === latest) continue;
      results.push(await this.migrate(tenantId, actor));
    }
    return {
      latestSchemaVersion: latest,
      migrated: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok),
    };
  }

  /** Connection test: connects, runs a query, records health and latency. */
  async check(tenantId: string, actor: AuditActor) {
    const started = Date.now();
    let error: string | null = null;
    let sizeBytes: number | null = null;
    try {
      // The connection test doubles as the storage measure (quota, Module 4).
      const { rows } = await this.connections.with(tenantId, (pool) =>
        pool.query<{ size: string }>(
          'select pg_database_size(current_database()) as size',
        ),
      );
      sizeBytes = Number(rows[0]?.size ?? 0);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
    const healthy = error === null;
    const latencyMs = Date.now() - started;

    const wentDown = await this.database.db.transaction(async (tx) => {
      const [before] = await tx
        .select({ healthy: tenantDatabases.healthy })
        .from(tenantDatabases)
        .where(eq(tenantDatabases.tenantId, tenantId));
      await tx
        .update(tenantDatabases)
        .set({
          healthy,
          latencyMs: healthy ? latencyMs : null,
          lastHealthError: error,
          lastHealthCheckAt: new Date(),
          ...(sizeBytes !== null && {
            sizeBytes,
            sizeCheckedAt: new Date(),
          }),
        })
        .where(eq(tenantDatabases.tenantId, tenantId));
      // Audit transitions only, so a periodic check doesn't flood the log;
      // a first successful check isn't a "recovery".
      const known = before?.healthy ?? null;
      if (before && known !== healthy && !(known === null && healthy)) {
        await writeAudit(tx, actor, {
          action: healthy
            ? 'tenant.database.recovered'
            : 'tenant.database.unreachable',
          entity: 'tenant',
          entityId: tenantId,
          tenantId,
          metadata: error ? { error } : undefined,
        });
      }
      return !healthy && known !== false;
    });
    if (wentDown) {
      const [tenant] = await this.database.db
        .select({ name: tenants.name })
        .from(tenants)
        .where(eq(tenants.id, tenantId));
      await this.notifications.notify({
        kind: 'technical.database.unreachable',
        severity: 'critical',
        title: 'Base de cabinet injoignable',
        body: `${tenant?.name ?? tenantId} — ${error ?? 'erreur inconnue'}`,
        href: `/tenants/${tenantId}?tab=technical`,
        tenantId,
        permission: 'technical:read',
      });
      await this.alerts.send('databaseUnreachable', {
        subject: `Base injoignable — ${tenant?.name ?? tenantId}`,
        lines: [error ?? 'Erreur inconnue'],
        path: `/tenants/${tenantId}?tab=technical`,
      });
    }
    return { tenantId, healthy, latencyMs, error, sizeBytes };
  }

  /** Periodic sweep over every maintained clinic. */
  async checkAll() {
    const results = [];
    for (const { tenantId } of await this.maintained()) {
      results.push(await this.check(tenantId, { userId: null }));
    }
    return results;
  }

  private maintained() {
    return this.database.db
      .select({
        tenantId: tenantDatabases.tenantId,
        schemaVersion: tenantDatabases.schemaVersion,
      })
      .from(tenantDatabases)
      .innerJoin(tenants, eq(tenants.id, tenantDatabases.tenantId))
      .where(
        and(
          inArray(tenants.status, [...MAINTAINED]),
          isNotNull(tenantDatabases.secretRef),
        ),
      );
  }
}
