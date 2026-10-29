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
    PORT: z.coerce.number().default(4100),
    /**
     * Catalog database (read: which cabinet a subdomain is, its status,
     * offer and database credentials). In production, a role limited to
     * those tables.
     */
    DATABASE_URL: z.url(),
    /** Express "trust proxy": the clinic Next.js app proxies /api here. */
    TRUST_PROXY: z.string().default('loopback'),
    /**
     * Same master key as admin-api: decrypts each cabinet's database
     * password (tenant_secrets).
     */
    TENANT_SECRETS_KEY: base64Key,
    TENANT_SECRETS_KEY_VERSION: z.coerce.number().int().min(1).default(1),
    TENANT_SECRETS_PREVIOUS_KEYS: z.string().optional(),
    /** Cabinets answer at <subdomain>.<TENANT_BASE_DOMAIN> (and <subdomain>.localhost outside production). */
    TENANT_BASE_DOMAIN: z.string().default('cabinova.ma'),
    /**
     * Clinic app address in invitation links, "{subdomain}" replaced.
     * Defaults to https://<subdomain>.<TENANT_BASE_DOMAIN> in production and
     * http://<subdomain>.localhost:3002 otherwise.
     */
    CLINIC_APP_URL: z
      .string()
      .refine((v) => v.includes('{subdomain}'), {
        message: 'must contain {subdomain}',
      })
      .optional(),
    /**
     * Same Resend key as admin-api (Équipe invitations). Optional: without
     * it, e-mails are logged and the owner copies the link instead.
     */
    RESEND_API_KEY: z.string().optional(),
    /** "from" address when the platform configuration sets none. */
    EMAIL_FROM: z.string().default('Cabinova <onboarding@resend.dev>'),
    /**
     * Super Admin app origin (it serves the platform logo at
     * /api/branding/logo). Without it, e-mails show the letter mark.
     */
    PLATFORM_WEB_ORIGIN: z.url().optional(),
    /** Tests and CI only, see admin-api/test/docker-compose.yml. */
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
