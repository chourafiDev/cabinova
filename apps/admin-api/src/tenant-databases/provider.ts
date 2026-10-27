import { randomBytes } from 'node:crypto';
import { Pool } from '@neondatabase/serverless';

/** What a provider hands back once a clinic database exists. */
export type ProvisionedDatabase = {
  provider: string;
  mode: string;
  providerRef: string | null;
  host: string;
  databaseName: string;
  roleName: string;
  /** Plaintext only in memory: encrypted before it touches the catalog. */
  password: string;
};

/**
 * Creates a clinic's database. Implementations must be idempotent: a run
 * interrupted halfway is simply started again.
 */
export interface TenantDatabaseProvider {
  readonly provider: string;
  readonly mode: string;
  create(tenant: { id: string; slug: string }): Promise<ProvisionedDatabase>;
  /** Permanently removes the database and its role (after the retention period). */
  drop(db: { databaseName: string; roleName: string }): Promise<void>;
}

export const TENANT_DB_PROVIDER = Symbol('TENANT_DB_PROVIDER');

/** "clinique-al-amal" → "clinic_clinique_al_amal" (≤ 63 chars, [a-z0-9_]). */
export const tenantDatabaseName = (slug: string) =>
  `clinic_${slug.replace(/[^a-z0-9]+/g, '_')}`.slice(0, 55);

/**
 * Neon, one database per clinic inside the platform's Neon project, created
 * over SQL with the project owner (CREATE ROLE + CREATE DATABASE). Each
 * clinic gets its own login role that owns its database; PUBLIC loses
 * CONNECT, so one clinic's role can't open another clinic's database.
 *
 * Isolation is per database and role; compute is shared by the project.
 * Branch-per-clinic or project-per-clinic (Neon API) would be other
 * implementations of TenantDatabaseProvider.
 */
export class NeonDatabaseProvider implements TenantDatabaseProvider {
  readonly provider = 'neon';
  readonly mode = 'database';
  private readonly adminUrl: URL;

  constructor(adminUrl: string) {
    this.adminUrl = new URL(adminUrl);
    // DDL like CREATE DATABASE goes to the compute directly, not the pooler.
    this.adminUrl.hostname = this.adminUrl.hostname.replace('-pooler', '');
  }

  async create(tenant: { slug: string }): Promise<ProvisionedDatabase> {
    const databaseName = tenantDatabaseName(tenant.slug);
    const roleName = `${databaseName}_owner`;
    // base64url: safe inside a SQL string literal (no quotes or backslashes).
    const password = randomBytes(24).toString('base64url');

    const pool = new Pool({ connectionString: this.adminUrl.toString() });
    try {
      const { rowCount: roleExists } = await pool.query(
        'select 1 from pg_roles where rolname = $1',
        [roleName],
      );
      // An existing role (interrupted run) gets a new password: the old one
      // was never stored.
      await pool.query(
        `${roleExists ? 'alter' : 'create'} role ${ident(roleName)} with login password '${password}'`,
      );
      // Postgres 16+: making the role the database owner requires being
      // able to SET ROLE to it. No INHERIT: the platform owner doesn't
      // silently gain the clinic role's privileges.
      await pool.query(
        `grant ${ident(roleName)} to current_user with set true, inherit false`,
      );
      const { rowCount: dbExists } = await pool.query(
        'select 1 from pg_database where datname = $1',
        [databaseName],
      );
      if (!dbExists) {
        await pool.query(
          `create database ${ident(databaseName)} owner ${ident(roleName)}`,
        );
      }
      // Only the owner can take CONNECT away from PUBLIC (a revoke by
      // anyone else is silently ignored), so run it as the clinic role.
      const client = await pool.connect();
      try {
        await client.query(`set role ${ident(roleName)}`);
        await client.query(
          `revoke all on database ${ident(databaseName)} from public`,
        );
      } finally {
        await client.query('reset role');
        client.release();
      }
    } finally {
      await pool.end();
    }

    return {
      provider: this.provider,
      mode: this.mode,
      providerRef: null,
      host: this.adminUrl.hostname,
      databaseName,
      roleName,
      password,
    };
  }

  /**
   * Drops the clinic database, then its role. The database is dropped as
   * the clinic role (its owner): the platform owner holds SET on it but no
   * inherited rights. Fails if someone is still connected.
   */
  async drop({
    databaseName,
    roleName,
  }: {
    databaseName: string;
    roleName: string;
  }) {
    const pool = new Pool({ connectionString: this.adminUrl.toString() });
    try {
      const client = await pool.connect();
      try {
        await client.query(`set role ${ident(roleName)}`);
        await client.query(`drop database if exists ${ident(databaseName)}`);
      } finally {
        await client.query('reset role');
        client.release();
      }
      await pool.query(`drop role if exists ${ident(roleName)}`);
    } finally {
      await pool.end();
    }
  }
}

/** Quotes an identifier we generated ([a-z0-9_] only); rejects anything else. */
function ident(name: string) {
  if (!/^[a-z0-9_]+$/.test(name)) throw new Error(`Unsafe identifier ${name}`);
  return `"${name}"`;
}
