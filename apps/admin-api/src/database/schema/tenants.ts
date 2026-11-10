import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { id, timestamps } from './columns.js';
import { platformUsers } from './platform-users.js';

// Catalog: cabinets (tenants). Never any medical/patient data — see Module 2
// of "Partie super admin". Each row here is a clinic; its own medical data
// lives in its own database, provisioned later (Module 4) and never
// reachable from admin-api.

/**
 * pending        — catalog record created, nothing provisioned yet
 * provisioning   — database/migrations/first-admin in progress
 * active         — usable
 * suspended      — blocked (unpaid, fraud, security, support request…)
 * closure_pending — closing, export/retention window running
 * closed         — terminated
 */
export const tenantStatus = pgEnum('tenant_status', [
  'pending',
  'provisioning',
  'active',
  'suspended',
  'closure_pending',
  'closed',
]);

export const sslStatus = pgEnum('ssl_status', [
  'none',
  'pending',
  'active',
  'error',
]);

export const tenants = pgTable('tenants', {
  id: id(),
  /** Nom du cabinet */
  name: text('name').notNull(),
  /** Raison sociale */
  legalName: text('legal_name'),
  /** Stable technical identifier, set once at creation. */
  slug: text('slug').notNull().unique(),
  /** Spécialité médicale */
  specialty: text('specialty'),
  /** Nom du médecin responsable */
  responsibleName: text('responsible_name').notNull(),
  address: text('address'),
  city: text('city'),
  phone: text('phone'),
  email: text('email').notNull(),
  status: tenantStatus('status').notNull().default('pending'),
  trialStartsAt: date('trial_starts_at'),
  trialEndsAt: date('trial_ends_at'),
  /** NULL = no limit (e.g. Enterprise). */
  maxDoctors: integer('max_doctors'),
  maxSecretaries: integer('max_secretaries'),
  maxUsers: integer('max_users'),
  storageQuotaMb: integer('storage_quota_mb'),
  country: text('country').notNull().default('MA'),
  locale: text('locale').notNull().default('fr'),
  timezone: text('timezone').notNull().default('Africa/Casablanca'),
  ...timestamps,
});

/** Domain/subdomain for a tenant; one row per tenant for now. */
export const tenantDomains = pgTable(
  'tenant_domains',
  {
    tenantId: uuid('tenant_id')
      .primaryKey()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    /** "<subdomain>.cabinova.ma" */
    subdomain: text('subdomain').notNull().unique(),
    customDomain: text('custom_domain').unique(),
    sslStatus: sslStatus('ssl_status').notNull().default('none'),
    sslExpiresAt: timestamp('ssl_expires_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex('tenant_domains_custom_domain_idx').on(t.customDomain)],
);

/**
 * The tenant's own database (Module 4). Connection details only — the
 * password lives encrypted in tenant_secrets (`secretRef`), never here.
 */
export const tenantDatabases = pgTable('tenant_databases', {
  tenantId: uuid('tenant_id')
    .primaryKey()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull().default('neon'),
  /** How it was created, e.g. "database" (CREATE DATABASE in the platform project). */
  mode: text('mode').notNull().default('database'),
  /** Provider-side identifier (e.g. a Neon branch id) — not a secret. */
  providerRef: text('provider_ref'),
  host: text('host'),
  databaseName: text('database_name'),
  roleName: text('role_name'),
  secretRef: uuid('secret_ref').references(() => tenantSecrets.id, {
    onDelete: 'restrict',
  }),
  /** Tag of the last tenant-db migration applied, e.g. "0000_baseline". */
  schemaVersion: text('schema_version'),
  lastMigratedAt: timestamp('last_migrated_at', { withTimezone: true }),
  /** Set when the last migration failed; the tenant is skipped until fixed. */
  lastMigrationError: text('last_migration_error'),
  lastHealthCheckAt: timestamp('last_health_check_at', { withTimezone: true }),
  healthy: boolean('healthy'),
  lastHealthError: text('last_health_error'),
  /** Response time of the last health check. */
  latencyMs: integer('latency_ms'),
  /** pg_database_size at the last check, compared to the storage quota. */
  sizeBytes: bigint('size_bytes', { mode: 'number' }),
  sizeCheckedAt: timestamp('size_checked_at', { withTimezone: true }),
  /** Set when the database was permanently deleted after the retention period. */
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  ...timestamps,
});

/**
 * Proof of each export of a clinic's data (Scenario D: "préparer une
 * exportation… conserver une preuve"). The archive itself is downloaded by
 * the admin; the catalog keeps who, when, what and its SHA-256 fingerprint.
 */
export const tenantDataExports = pgTable(
  'tenant_data_exports',
  {
    id: id(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    requestedBy: uuid('requested_by').references(() => platformUsers.id, {
      onDelete: 'set null',
    }),
    sha256: text('sha256').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    /** Rows per table, e.g. { users: 3, clinic_settings: 1 }. */
    tables: jsonb('tables').$type<Record<string, number>>().notNull(),
    schemaVersion: text('schema_version'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('tenant_data_exports_tenant_idx').on(t.tenantId, t.createdAt)],
);

/** Envelope-encrypted secrets (tenant DB credentials). Never plaintext. */
export const tenantSecrets = pgTable('tenant_secrets', {
  id: id(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  /** AES-256-GCM, base64 of iv ‖ tag ‖ ciphertext; AAD = tenant id. */
  ciphertext: text('ciphertext').notNull(),
  /** Which master key encrypted it (for rotation). */
  keyVersion: integer('key_version').notNull().default(1),
  ...timestamps,
});

export const provisioningRunState = pgEnum('provisioning_run_state', [
  'running',
  'succeeded',
  'failed',
]);

export type ProvisioningStep = {
  /** "database" | "secret" | "migrations" | "seed" | "healthcheck" | "invitation" | "activate" */
  key: string;
  status: 'done' | 'skipped' | 'failed';
  at: string;
  detail?: string;
};

/**
 * One attempt at provisioning a cabinet (Scenario A, system side). Steps are
 * appended as they finish, so a failed run shows exactly where it stopped;
 * a new run resumes safely (every step is idempotent).
 */
export const tenantProvisioningRuns = pgTable(
  'tenant_provisioning_runs',
  {
    id: id(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    state: provisioningRunState('state').notNull().default('running'),
    steps: jsonb('steps').$type<ProvisioningStep[]>().notNull().default([]),
    error: text('error'),
    sendInvitation: boolean('send_invitation').notNull().default(true),
    startedBy: uuid('started_by').references(() => platformUsers.id, {
      onDelete: 'set null',
    }),
    startedAt: timestamp('started_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Bumped after each step; a stale running run was interrupted. */
    heartbeatAt: timestamp('heartbeat_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => [
    index('tenant_provisioning_runs_tenant_idx').on(t.tenantId, t.startedAt),
    uniqueIndex('tenant_provisioning_runs_one_running_idx')
      .on(t.tenantId)
      .where(sql`${t.state} = 'running'`),
  ],
);

export const tenantStatusChangeState = pgEnum('tenant_status_change_state', [
  'scheduled',
  'applied',
  'cancelled',
  'failed',
]);

/**
 * Every status transition of a cabinet (suspend, reactivate, closure…), with
 * its motive, comment and effective date. A change dated in the future stays
 * `scheduled` until the lifecycle sweep applies it; at most one can be
 * scheduled per cabinet. Kept forever as the proof of the procedure.
 */
export const tenantStatusChanges = pgTable(
  'tenant_status_changes',
  {
    id: id(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    /** Transition key, see src/tenants/lifecycle.ts. */
    action: text('action').notNull(),
    fromStatus: tenantStatus('from_status').notNull(),
    toStatus: tenantStatus('to_status').notNull(),
    reason: text('reason'),
    comment: text('comment'),
    effectiveAt: timestamp('effective_at', { withTimezone: true }).notNull(),
    state: tenantStatusChangeState('state').notNull(),
    appliedAt: timestamp('applied_at', { withTimezone: true }),
    /** Why a scheduled change could not be applied. */
    failureReason: text('failure_reason'),
    notifyResponsible: boolean('notify_responsible').notNull().default(true),
    requestedBy: uuid('requested_by').references(() => platformUsers.id, {
      onDelete: 'set null',
    }),
    ...timestamps,
  },
  (t) => [
    index('tenant_status_changes_tenant_idx').on(t.tenantId, t.createdAt),
    index('tenant_status_changes_due_idx')
      .on(t.effectiveAt)
      .where(sql`${t.state} = 'scheduled'`),
    uniqueIndex('tenant_status_changes_one_scheduled_idx')
      .on(t.tenantId)
      .where(sql`${t.state} = 'scheduled'`),
  ],
);
