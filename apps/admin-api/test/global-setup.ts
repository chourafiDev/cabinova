import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { migrate } from 'drizzle-orm/neon-serverless/migrator';
import type { TestProject } from 'vitest/node';
import { configureNeon } from '../src/database/neon.js';
import * as schema from '../src/database/schema/index.js';
import { seedCatalog } from '../src/database/seed-catalog.js';

/**
 * Once per run: a fresh catalog database (migrated and seeded exactly like
 * production), and no clinic database or role left from a previous run.
 */
export default async function setup(project: TestProject) {
  const env = project.config.env as Record<string, string>;
  configureNeon(env.NEON_WS_PROXY);

  const admin = new Pool({ connectionString: env.TENANT_DB_ADMIN_URL });
  try {
    const catalog = new URL(env.DATABASE_URL).pathname.slice(1);
    await admin.query(`drop database if exists "${catalog}" with (force)`);
    const { rows: clinics } = await admin.query<{ datname: string }>(
      "select datname from pg_database where datname like 'clinic\\_%'",
    );
    for (const { datname } of clinics) {
      await admin.query(`drop database "${datname}" with (force)`);
    }
    const { rows: roles } = await admin.query<{ rolname: string }>(
      "select rolname from pg_roles where rolname like 'clinic\\_%'",
    );
    for (const { rolname } of roles) {
      await admin.query(`drop role "${rolname}"`);
    }
    await admin.query(`create database "${catalog}"`);
  } finally {
    await admin.end();
  }

  const pool = new Pool({ connectionString: env.DATABASE_URL });
  try {
    const db = drizzle({ client: pool, schema });
    await migrate(db, { migrationsFolder: 'drizzle' });
    await seedCatalog(db, {
      email: env.SEED_ADMIN_EMAIL,
      password: env.SEED_ADMIN_PASSWORD,
    });
  } finally {
    await pool.end();
  }
}
