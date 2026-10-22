import {
  boolean,
  date,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { id, timestamps } from './columns.js';

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
  maxUsers: integer('max_users'),
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
 * Connection to the tenant's own database — populated by Module 4's
 * provisioning. The secret is never stored in clear: `secretRef` points at
 * an encrypted value (see tenant-secrets table), never a plain connection
 * string.
 */
export const tenantDatabases = pgTable('tenant_databases', {
  tenantId: uuid('tenant_id')
    .primaryKey()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull().default('neon'),
  /** Provider-side identifier (e.g. a Neon branch id) — not a secret. */
  providerRef: text('provider_ref'),
  host: text('host'),
  databaseName: text('database_name'),
  /** Opaque reference; the encrypted secret itself lives in tenant_secrets. */
  secretRef: uuid('secret_ref'),
  schemaVersion: text('schema_version'),
  lastMigratedAt: timestamp('last_migrated_at', { withTimezone: true }),
  lastHealthCheckAt: timestamp('last_health_check_at', { withTimezone: true }),
  healthy: boolean('healthy'),
  ...timestamps,
});

/** Envelope-encrypted secrets (tenant DB credentials). Never plaintext. */
export const tenantSecrets = pgTable('tenant_secrets', {
  id: id(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  /** AES-256-GCM ciphertext, base64. */
  ciphertext: text('ciphertext').notNull(),
  /** Which app-level key encrypted it (for rotation). */
  keyVersion: integer('key_version').notNull().default(1),
  ...timestamps,
});
