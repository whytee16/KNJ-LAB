import 'server-only';
import { createHash } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';

export interface Limit {
  max: number;
  windowSeconds: number;
}

/**
 * Limits per action (API.md §1). Per-account limits stop password guessing; per-IP limits are
 * generous because a whole school class can share one NAT address.
 */
export const limits = {
  loginAccount: { max: 10, windowSeconds: 600 },
  loginIp: { max: 300, windowSeconds: 600 },
  register: { max: 30, windowSeconds: 3600 },
  passwordResetAccount: { max: 3, windowSeconds: 3600 },
  passwordResetIp: { max: 30, windowSeconds: 3600 },
  createChild: { max: 10, windowSeconds: 86_400 },
  childPassword: { max: 20, windowSeconds: 3600 },
  mfa: { max: 10, windowSeconds: 600 },
  answer: { max: 60, windowSeconds: 60 },
  report: { max: 10, windowSeconds: 3600 },
} satisfies Record<string, Limit>;

/**
 * Registers a hit and returns false when the limit is exceeded. Keys are hashed so that
 * identifiers (e-mails, logins) do not end up in the rate-limit table.
 */
export async function hit(bucket: keyof typeof limits, key: string): Promise<boolean> {
  const { max, windowSeconds } = limits[bucket];
  const hashed = createHash('sha256').update(key.toLowerCase()).digest('hex').slice(0, 40);
  const { data, error } = await createAdminClient().rpc('rate_limit_hit', {
    p_key: `${bucket}:${hashed}`,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) throw new Error(`rate limiter failed: ${error.message}`);
  return data === true;
}

/** Checks several (bucket, key) pairs, e.g. per account and per IP; all must pass. */
export async function hitAll(checks: [keyof typeof limits, string][]): Promise<boolean> {
  const results = await Promise.all(checks.map(([bucket, key]) => hit(bucket, key)));
  return results.every(Boolean);
}
