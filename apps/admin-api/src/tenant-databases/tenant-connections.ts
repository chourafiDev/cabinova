import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { Pool } from '@neondatabase/serverless';
import {
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { migrate } from 'drizzle-orm/neon-serverless/migrator';
import { SECRET_BOX } from '../crypto/crypto.module.js';
import { DatabaseService } from '../database/database.module.js';
import { tenantDatabases, tenantSecrets } from '../database/schema/index.js';
import { SecretBox } from './secret-box.js';

/** Migrations of @cabinova/tenant-db, the schema every clinic database gets. */
const MIGRATIONS_FOLDER = join(
  dirname(
    createRequire(import.meta.url).resolve('@cabinova/tenant-db/package.json'),
  ),
  'migrations',
);

/** Tag of the newest tenant-db migration, e.g. "0000_baseline". */
export function latestSchemaVersion(): string | null {
  const journal = JSON.parse(
    readFileSync(join(MIGRATIONS_FOLDER, 'meta/_journal.json'), 'utf8'),
  ) as { entries: { tag: string }[] };
  return journal.entries.at(-1)?.tag ?? null;
}

/**
 * Opens a clinic's database for platform operations only — migrations,
 * seeding the first account, health checks. Never for reading medical data.
 * Each call opens and closes its own short-lived pool: these operations are
 * rare, and nothing keeps clinic credentials in memory between them.
 */
@Injectable()
export class TenantConnections {
  constructor(
    private readonly database: DatabaseService,
    @Inject(SECRET_BOX) private readonly secrets: SecretBox | null,
  ) {}

  get configured() {
    return this.secrets !== null;
  }

  /** Encrypts a clinic database password for tenant_secrets. */
  seal(tenantId: string, password: string) {
    return this.box().encrypt(password, tenantId);
  }

  async with<T>(tenantId: string, fn: (pool: Pool) => Promise<T>) {
    const pool = new Pool({
      connectionString: await this.connectionString(tenantId),
      max: 1,
      connectionTimeoutMillis: 10_000,
    });
    try {
      return await fn(pool);
    } finally {
      await pool.end();
    }
  }

  /** Applies pending tenant-db migrations; returns the schema version reached. */
  migrate(tenantId: string) {
    return this.with(tenantId, async (pool) => {
      await migrate(drizzle({ client: pool }), {
        migrationsFolder: MIGRATIONS_FOLDER,
      });
      return latestSchemaVersion();
    });
  }

  private async connectionString(tenantId: string) {
    const [row] = await this.database.db
      .select({
        host: tenantDatabases.host,
        databaseName: tenantDatabases.databaseName,
        roleName: tenantDatabases.roleName,
        ciphertext: tenantSecrets.ciphertext,
        keyVersion: tenantSecrets.keyVersion,
      })
      .from(tenantDatabases)
      .innerJoin(tenantSecrets, eq(tenantSecrets.id, tenantDatabases.secretRef))
      .where(eq(tenantDatabases.tenantId, tenantId));
    if (!row?.host || !row.databaseName || !row.roleName) {
      throw new NotFoundException("Ce cabinet n'a pas encore de base.");
    }
    const password = this.box().decrypt(
      row.ciphertext,
      row.keyVersion,
      tenantId,
    );
    const url = new URL(`postgresql://${row.host}/${row.databaseName}`);
    url.username = row.roleName;
    url.password = password;
    url.searchParams.set('sslmode', 'require');
    return url.toString();
  }

  private box() {
    if (!this.secrets) {
      throw new ServiceUnavailableException({
        code: 'TENANT_SECRETS_NOT_CONFIGURED',
        message: 'TENANT_SECRETS_KEY manquante : provisionnement indisponible.',
      });
    }
    return this.secrets;
  }
}
