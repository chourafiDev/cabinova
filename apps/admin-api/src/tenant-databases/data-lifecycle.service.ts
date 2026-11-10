import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { gzip } from 'node:zlib';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { type AuditActor, writeAudit } from '../audit/audit.js';
import { DatabaseService } from '../database/database.module.js';
import {
  platformSettings,
  platformUsers,
  tenantDataExports,
  tenantDatabases,
  tenants,
  tenantSecrets,
  tenantStatusChanges,
} from '../database/schema/index.js';
import { TENANT_DB_PROVIDER, type TenantDatabaseProvider } from './provider.js';
import { TenantConnections } from './tenant-connections.js';

const gzipAsync = promisify(gzip);
const SETTINGS_KEY = 'compliance';
/** Conservative default: confirm the legal retention period for medical records. */
export const DEFAULT_RETENTION_YEARS = 20;
/** Columns never exported (credentials, tokens). */
const REDACTED = /password|token|secret/i;

const addYears = (date: Date, years: number) => {
  const d = new Date(date);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d;
};

/**
 * End of a clinic's life (Spec, Scenario D): export its data (proof kept:
 * who, when, SHA-256), then — only once the cabinet is closed, the
 * retention period has passed and an export exists — permanently delete its
 * database. Nothing is ever deleted automatically.
 */
@Injectable()
export class DataLifecycleService {
  constructor(
    private readonly database: DatabaseService,
    private readonly connections: TenantConnections,
    @Inject(TENANT_DB_PROVIDER)
    private readonly provider: TenantDatabaseProvider | null,
  ) {}

  async retentionYears() {
    const [row] = await this.database.db
      .select({ value: platformSettings.value })
      .from(platformSettings)
      .where(eq(platformSettings.key, SETTINGS_KEY));
    return (
      (row?.value as { retentionYears?: number } | undefined)?.retentionYears ??
      DEFAULT_RETENTION_YEARS
    );
  }

  async setRetentionYears(actor: AuditActor, years: number) {
    const before = await this.retentionYears();
    await this.database.db.transaction(async (tx) => {
      await tx
        .insert(platformSettings)
        .values({
          key: SETTINGS_KEY,
          value: { retentionYears: years },
          updatedBy: actor.userId,
        })
        .onConflictDoUpdate({
          target: platformSettings.key,
          set: {
            value: { retentionYears: years },
            updatedBy: actor.userId,
            updatedAt: new Date(),
          },
        });
      if (before !== years) {
        await writeAudit(tx, actor, {
          action: 'settings.compliance.update',
          entity: 'settings',
          entityId: null,
          metadata: { retentionYears: { from: before, to: years } },
        });
      }
    });
    return { retentionYears: years };
  }

  /** Where a cabinet stands: closure, retention end, exports, and what blocks deletion. */
  async status(tenantId: string) {
    const db = this.database.db;
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId));
    if (!tenant) throw new NotFoundException('Cabinet introuvable.');
    const [[closure], [record], exports, years] = await Promise.all([
      db
        .select({ at: tenantStatusChanges.appliedAt })
        .from(tenantStatusChanges)
        .where(
          and(
            eq(tenantStatusChanges.tenantId, tenantId),
            eq(tenantStatusChanges.toStatus, 'closed'),
            eq(tenantStatusChanges.state, 'applied'),
          ),
        )
        .orderBy(desc(tenantStatusChanges.appliedAt))
        .limit(1),
      db
        .select()
        .from(tenantDatabases)
        .where(eq(tenantDatabases.tenantId, tenantId)),
      db
        .select({
          id: tenantDataExports.id,
          sha256: tenantDataExports.sha256,
          sizeBytes: tenantDataExports.sizeBytes,
          tables: tenantDataExports.tables,
          schemaVersion: tenantDataExports.schemaVersion,
          createdAt: tenantDataExports.createdAt,
          requestedBy: platformUsers.name,
        })
        .from(tenantDataExports)
        .leftJoin(
          platformUsers,
          eq(platformUsers.id, tenantDataExports.requestedBy),
        )
        .where(eq(tenantDataExports.tenantId, tenantId))
        .orderBy(desc(tenantDataExports.createdAt)),
      this.retentionYears(),
    ]);
    const closedAt =
      tenant.status === 'closed' ? (closure?.at ?? tenant.updatedAt) : null;
    const retentionEndsAt = closedAt ? addYears(closedAt, years) : null;
    const exportAfterClosure = closedAt
      ? exports.find((e) => e.createdAt >= closedAt)
      : undefined;
    const blockers: string[] = [];
    if (!record?.databaseName || record.deletedAt)
      blockers.push(
        record?.deletedAt
          ? 'Base déjà supprimée.'
          : 'Aucune base pour ce cabinet.',
      );
    if (!closedAt) blockers.push('Le cabinet doit être fermé.');
    else if (retentionEndsAt! > new Date())
      blockers.push(
        `Délai de conservation en cours jusqu’au ${retentionEndsAt!.toISOString().slice(0, 10)}.`,
      );
    if (closedAt && !exportAfterClosure)
      blockers.push('Exportez les données après la fermeture.');
    return {
      tenantStatus: tenant.status,
      database: record
        ? { name: record.databaseName, deletedAt: record.deletedAt }
        : null,
      retentionYears: years,
      closedAt,
      retentionEndsAt,
      exports,
      canExport: !!record?.databaseName && !record.deletedAt,
      canDelete: blockers.length === 0,
      blockers,
    };
  }

  /**
   * Every table of the clinic database as gzipped JSON. Credentials and
   * tokens are blanked. The fingerprint is recorded as proof.
   */
  async export(tenantId: string, actor: AuditActor) {
    const db = this.database.db;
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId));
    const [record] = await db
      .select()
      .from(tenantDatabases)
      .where(eq(tenantDatabases.tenantId, tenantId));
    if (!tenant) throw new NotFoundException('Cabinet introuvable.');
    if (!record?.databaseName || record.deletedAt) {
      throw new ConflictException({
        code: 'NO_DATABASE',
        message: 'Aucune base à exporter pour ce cabinet.',
      });
    }
    const exportedAt = new Date();
    const tables = await this.connections.with(tenantId, async (pool) => {
      const { rows: names } = await pool.query<{ name: string }>(
        `select table_name as name from information_schema.tables
         where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`,
      );
      const out: Record<string, Record<string, unknown>[]> = {};
      for (const { name } of names) {
        if (!/^[a-z0-9_]+$/.test(name)) continue;
        const { rows } = await pool.query(`select * from "${name}"`);
        out[name] = rows.map((row: Record<string, unknown>) =>
          Object.fromEntries(
            Object.entries(row).map(([k, v]) => [
              k,
              REDACTED.test(k) ? null : v,
            ]),
          ),
        );
      }
      return out;
    });
    const counts = Object.fromEntries(
      Object.entries(tables).map(([k, rows]) => [k, rows.length]),
    );
    const document = {
      format: 'cabinova-clinic-export',
      version: 1,
      exportedAt: exportedAt.toISOString(),
      schemaVersion: record.schemaVersion,
      cabinet: {
        id: tenant.id,
        name: tenant.name,
        legalName: tenant.legalName,
        slug: tenant.slug,
        email: tenant.email,
        status: tenant.status,
      },
      redactedColumns: 'password, token, secret',
      tables,
    };
    const file = await gzipAsync(
      Buffer.from(JSON.stringify(document, null, 1)),
    );
    const sha256 = createHash('sha256').update(file).digest('hex');
    await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(tenantDataExports)
        .values({
          tenantId,
          requestedBy: actor.userId,
          sha256,
          sizeBytes: file.length,
          tables: counts,
          schemaVersion: record.schemaVersion,
          createdAt: exportedAt,
        })
        .returning({ id: tenantDataExports.id });
      await writeAudit(tx, actor, {
        action: 'tenant.data.export',
        entity: 'tenant',
        entityId: tenantId,
        tenantId,
        metadata: {
          exportId: row.id,
          sha256,
          sizeBytes: file.length,
          tables: counts,
        },
      });
    });
    return {
      file,
      sha256,
      filename: `cabinova-${tenant.slug}-${exportedAt.toISOString().slice(0, 10)}.json.gz`,
    };
  }

  /**
   * Permanent deletion of the clinic database. Requires: closed, retention
   * over, an export after closure, and the cabinet's exact name. The catalog
   * keeps the cabinet, its invoices and this proof.
   */
  async delete(tenantId: string, actor: AuditActor, confirmName: string) {
    if (!this.provider) {
      throw new ServiceUnavailableException({
        code: 'PROVIDER_NOT_CONFIGURED',
        message: 'TENANT_DB_ADMIN_URL manquante.',
      });
    }
    const status = await this.status(tenantId);
    if (!status.canDelete) {
      throw new ConflictException({
        code: 'NOT_DELETABLE',
        message: status.blockers.join(' '),
      });
    }
    const [tenant] = await this.database.db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId));
    if (confirmName.trim() !== tenant.name) {
      throw new BadRequestException({
        code: 'CONFIRMATION_MISMATCH',
        message: 'Le nom saisi ne correspond pas au cabinet.',
      });
    }
    const [record] = await this.database.db
      .select()
      .from(tenantDatabases)
      .where(eq(tenantDatabases.tenantId, tenantId));
    const proof = status.exports.find(
      (e) => status.closedAt && e.createdAt >= status.closedAt,
    )!;

    await this.provider.drop({
      databaseName: record.databaseName!,
      roleName: record.roleName!,
    });

    await this.database.db.transaction(async (tx) => {
      await tx
        .update(tenantDatabases)
        .set({ deletedAt: new Date(), secretRef: null, healthy: null })
        .where(eq(tenantDatabases.tenantId, tenantId));
      await tx
        .delete(tenantSecrets)
        .where(eq(tenantSecrets.tenantId, tenantId));
      await writeAudit(tx, actor, {
        action: 'tenant.data.delete',
        entity: 'tenant',
        entityId: tenantId,
        tenantId,
        metadata: {
          databaseName: record.databaseName,
          closedAt: status.closedAt,
          retentionEndsAt: status.retentionEndsAt,
          retentionYears: status.retentionYears,
          exportId: proof.id,
          exportSha256: proof.sha256,
        },
      });
    });
    return { ok: true };
  }
}
