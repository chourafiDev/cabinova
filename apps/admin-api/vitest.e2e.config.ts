import { defineConfig } from 'vitest/config';

/**
 * End-to-end tests: the whole API (AppModule) over HTTP against a throwaway
 * Postgres 17 behind Neon's wsproxy (test/docker-compose.yml), so the same
 * Neon driver runs as in production. Provisioning creates real clinic
 * databases in it. Run with `pnpm test:e2e:db` (starts the containers) or
 * `pnpm test:e2e` when they are already up, as in CI.
 */
const PG = `postgres:postgres@${process.env.E2E_PG_HOST ?? 'localhost'}`;

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e.ts'],
    globalSetup: ['test/global-setup.ts'],
    // One shared database: files run one after the other.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: `postgresql://${PG}/cabinova_e2e`,
      TENANT_DB_ADMIN_URL: `postgresql://${PG}/postgres`,
      NEON_WS_PROXY: process.env.NEON_WS_PROXY ?? 'localhost:55433',
      // Test-only key (32 zero bytes); never used outside this database.
      TENANT_SECRETS_KEY: Buffer.alloc(32).toString('base64'),
      WEB_ORIGIN: 'http://localhost:3000',
      SEED_ADMIN_EMAIL: 'admin@e2e.test',
      SEED_ADMIN_PASSWORD: 'e2e-admin-password',
    },
  },
});
