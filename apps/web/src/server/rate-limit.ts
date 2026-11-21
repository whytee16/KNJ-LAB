import 'server-only';
import { createHash } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';

export interface Limit {
  max: number;
  windowSeconds: number;
}

/** Limits per action (API.md §1). */
export const limits = {
  login: { max: 10, windowSeconds: 600 },
  register: { max: 5, windowSeconds: 3600 },
  passwordReset: { max: 3, windowSeconds: 3600 },
  createChild: { max: 10, windowSeconds: 86_400 },
  childPassword: { max: 20, windowSeconds: 3600 },
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

/** Checks several keys (e.g. IP and account); all must pass. */
export async function hitAll(bucket: keyof typeof limits, keys: string[]): Promise<boolean> {
  const results = await Promise.all(keys.map((k) => hit(bucket, k)));
  return results.every(Boolean);
}
