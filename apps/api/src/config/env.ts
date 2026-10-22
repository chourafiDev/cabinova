import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().default(4000),
  /** Neon pooled connection string (app role, RLS enforced). */
  DATABASE_URL: z.url(),
  /** Origin(s) of the Next.js app, comma-separated (CORS with credentials). */
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
  /** Platform domain: tenants live on <slug>.<ROOT_DOMAIN>. */
  ROOT_DOMAIN: z.string().default('localhost'),
  /** Express "trust proxy": the Next.js app proxies /api to this server. */
  TRUST_PROXY: z.string().default('loopback'),
  /**
   * Resend API key. Optional: without it, EmailService logs instead of
   * sending, and invite/reset links fall back to "copy the link" in the UI.
   */
  RESEND_API_KEY: z.string().optional(),
  /** "from" address for transactional email, e.g. "Cabinova <notifications@cabinova.ma>". */
  EMAIL_FROM: z.string().default('Cabinova <onboarding@resend.dev>'),
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
