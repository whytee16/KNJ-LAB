import { z } from 'zod';

const flag = z
  .enum(['true', 'false', ''])
  .optional()
  .transform((v) => v === 'true');

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined));

/**
 * Server environment schema. Values come only from process.env (see .env.example).
 * Supabase variables are optional at parse time so that static pages build without a database;
 * `supabaseEnv()` asserts them where they are actually needed.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: z.url().default('http://localhost:3000'),
  NEXT_PUBLIC_CONTACT_EMAIL: z
    .email()
    .optional()
    .or(z.literal('').transform(() => undefined)),

  NEXT_PUBLIC_SUPABASE_URL: z
    .url()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalString,
  SUPABASE_SERVICE_ROLE_KEY: optionalString,

  /** Salt for hashing IP addresses in consents and rate-limit keys (never store raw IPs). */
  IP_HASH_SALT: optionalString.refine((v) => v === undefined || v.length >= 16, {
    message: 'must be at least 16 characters',
  }),
  /** Self-registration of parents. Off unless explicitly enabled (pilot gating). */
  REGISTRATION_ENABLED: flag,
  /** Domain for technical student logins. Must never receive mail (RFC 2606 `.invalid`). */
  STUDENT_EMAIL_DOMAIN: z
    .string()
    .regex(/^[a-z0-9.-]+\.invalid$/, 'must end with .invalid')
    .default('student.knj.invalid'),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  return result.data;
}

let cached: Env | undefined;
export function env(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

export interface SupabaseEnv {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
  ipHashSalt: string;
}

/** Returns Supabase settings or throws a clear error if the app is not configured for auth. */
export function supabaseEnv(source: Env = env()): SupabaseEnv {
  const missing = (
    [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'IP_HASH_SALT',
    ] as const
  ).filter((k) => !source[k]);
  if (missing.length) {
    throw new Error(`Supabase is not configured: missing ${missing.join(', ')}`);
  }
  return {
    url: source.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: source.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    serviceRoleKey: source.SUPABASE_SERVICE_ROLE_KEY!,
    ipHashSalt: source.IP_HASH_SALT!,
  };
}

export function isSupabaseConfigured(source: Env = env()): boolean {
  return Boolean(source.NEXT_PUBLIC_SUPABASE_URL && source.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
