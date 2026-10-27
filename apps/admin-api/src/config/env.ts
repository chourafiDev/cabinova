import { z } from 'zod';

const base64Key = z
  .string()
  .refine((v) => Buffer.from(v, 'base64').length === 32, {
    message: 'must be 32 bytes, base64-encoded (openssl rand -base64 32)',
  });

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),
    PORT: z.coerce.number().default(4000),
    /** Neon pooled connection string, catalog database (app role). */
    DATABASE_URL: z.url(),
    /** Origin of the Super Admin Next.js app, comma-separated (CORS with credentials). */
    WEB_ORIGIN: z.string().default('http://localhost:3000'),
    /** Express "trust proxy": the Next.js app proxies /api to this server. */
    TRUST_PROXY: z.string().default('loopback'),
    /**
     * Resend API key. Optional: without it, EmailService logs instead of
     * sending, and invite/reset links fall back to "copy the link" in the UI.
     */
    RESEND_API_KEY: z.string().optional(),
    /** "from" address for transactional email, e.g. "Cabinova <notifications@cabinova.ma>". */
    EMAIL_FROM: z.string().default('Cabinova <onboarding@resend.dev>'),

    // Module 4 — database per clinic. Provisioning is refused until these are set.
    /**
     * Master key for clinic database credentials: 32 random bytes, base64
     * (`openssl rand -base64 32`). Lose it and every clinic's credentials are
     * unreadable — keep it in a secret manager, never in git.
     */
    TENANT_SECRETS_KEY: base64Key.optional(),
    /** Version stored with each secret; bump it when rotating the key. */
    TENANT_SECRETS_KEY_VERSION: z.coerce.number().int().min(1).default(1),
    /** Old keys still readable during a rotation: "1:<base64>,2:<base64>". */
    TENANT_SECRETS_PREVIOUS_KEYS: z.string().optional(),
    /**
     * Owner connection used to create each clinic's database and role (needs
     * CREATEDB and CREATEROLE), e.g. the Neon project's neondb_owner URL.
     */
    TENANT_DB_ADMIN_URL: z.url().optional(),
    /** Clinics are served at <subdomain>.<TENANT_BASE_DOMAIN>. */
    TENANT_BASE_DOMAIN: z.string().default('cabinova.ma'),
    /**
     * Tests and CI only: "host:port" of Neon's wsproxy in front of a plain
     * Postgres (test/docker-compose.yml). Refused in production.
     */
    NEON_WS_PROXY: z.string().optional(),
  })
  .refine((env) => !(env.NODE_ENV === 'production' && env.NEON_WS_PROXY), {
    message: 'NEON_WS_PROXY is for tests only',
    path: ['NEON_WS_PROXY'],
  });

export type Env = z.infer<typeof envSchema>;

/** Used by ConfigModule: fails fast at boot on a missing/invalid variable. */
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment variables:\n${z.prettifyError(parsed.error)}`,
    );
  }
  return parsed.data;
}
