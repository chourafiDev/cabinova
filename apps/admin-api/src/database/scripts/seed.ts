// `pnpm db:seed`: permissions, roles, features, default plans and the Super
// Admin account (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD). Idempotent: safe
// to run again. See ../seed-catalog.ts.
import 'dotenv/config';
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { configureNeon } from '../neon.js';
import * as schema from '../schema/index.js';
import { seedCatalog } from '../seed-catalog.js';

configureNeon();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
await seedCatalog(
  drizzle({ client: pool, schema }),
  {
    email: process.env.SEED_ADMIN_EMAIL,
    password: process.env.SEED_ADMIN_PASSWORD,
  },
  (line) => console.log(line),
);
await pool.end();
