// Runs after every `pnpm db:migrate`: FORCE row-level security on each table
// that has RLS enabled, so the table owner (the role the app connects with on
// Neon) is bound by the tenant policies too. Idempotent.
import 'dotenv/config';
import { Pool } from '@neondatabase/serverless';
import ws from 'ws';
import { neonConfig } from '@neondatabase/serverless';

neonConfig.webSocketConstructor = ws;

const pool = new Pool({
  connectionString:
    process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL,
});

const { rows } = await pool.query<{ table: string }>(`
  select c.relname as table
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and c.relrowsecurity and not c.relforcerowsecurity
`);
for (const { table } of rows) {
  await pool.query(`alter table "${table}" force row level security`);
  console.log(`RLS forced on ${table}`);
}
if (!rows.length) console.log('RLS already forced on every RLS table');
await pool.end();
