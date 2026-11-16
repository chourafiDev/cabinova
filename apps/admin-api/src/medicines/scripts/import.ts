// `pnpm medicines:import <file.xlsx>`: imports the AMMPS export into the
// shared medicines database (MEDICINES_DATABASE_URL) once, migrating it
// first. Same rules as the Super Admin upload: all or nothing, refused when
// the file looks incomplete, nothing ever deleted.
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import * as schema from '@cabinova/medicines-db/schema';
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { migrate } from 'drizzle-orm/neon-serverless/migrator';
import { configureNeon } from '../../database/neon.js';
import { AmmpsFileError, readAmmpsFile } from '../ammps-file.js';
import { importAmmps } from '../ammps-import.js';
import { MEDICINES_MIGRATIONS } from '../medicines-db.module.js';

const path = process.argv[2];
const url = process.env.MEDICINES_DATABASE_URL;
if (!path || !url) {
  console.error(
    !path
      ? 'Usage: pnpm medicines:import <medicaments-ammps.xlsx>'
      : 'MEDICINES_DATABASE_URL is not set.',
  );
  process.exit(1);
}

configureNeon();
const pool = new Pool({ connectionString: url });
try {
  const db = drizzle({ client: pool, schema });
  await migrate(db, { migrationsFolder: MEDICINES_MIGRATIONS });
  const file = readAmmpsFile(await readFile(path));
  const run = await importAmmps(db, { file, fileName: basename(path) });
  console.log(
    JSON.stringify(
      {
        status: run.status,
        read: run.rowsRead,
        inserted: run.rowsInserted,
        updated: run.rowsUpdated,
        deactivated: run.rowsDeactivated,
        skippedLines: file.skipped.length,
        duplicates: file.duplicates,
        error: run.error,
      },
      null,
      2,
    ),
  );
  if (run.status !== 'success') process.exitCode = 1;
} catch (err) {
  console.error(err instanceof AmmpsFileError ? err.message : err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
