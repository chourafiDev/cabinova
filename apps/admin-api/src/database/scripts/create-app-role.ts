// One-off: creates (or resets the password of) the `cabinova_app` role the
// API connects with. Unlike Neon's owner role it has no BYPASSRLS, so the
// tenant policies apply. Run with the OWNER connection:
//   DATABASE_MIGRATION_URL=<owner url> pnpm db:create-app-role
// Prints the app connection string to put in DATABASE_URL.
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { neonConfig, Pool } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;
const ownerUrl = process.env.DATABASE_MIGRATION_URL;
if (!ownerUrl)
  throw new Error('DATABASE_MIGRATION_URL (owner role) is required');

const ROLE = 'cabinova_app';
const password = randomBytes(24).toString('base64url');
const pool = new Pool({ connectionString: ownerUrl });
const { rows } = await pool.query<{ owner: string }>(
  'select current_user as owner',
);
const owner = rows[0].owner;

const exists = (
  await pool.query('select 1 from pg_roles where rolname = $1', [ROLE])
).rowCount;
await pool.query(
  `${exists ? 'alter' : 'create'} role ${ROLE} with login nobypassrls password '${password}'`,
);
await pool.query(`grant usage on schema public to ${ROLE}`);
await pool.query(
  `grant select, insert, update, delete on all tables in schema public to ${ROLE}`,
);
// Tables created by future migrations (run as the owner) get the same grants.
await pool.query(
  `alter default privileges for role ${owner} in schema public grant select, insert, update, delete on tables to ${ROLE}`,
);
await pool.end();

const url = new URL(ownerUrl);
url.username = ROLE;
url.password = password;
console.log(`DATABASE_URL=${url.toString()}`);
