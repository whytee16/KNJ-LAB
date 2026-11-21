import 'server-only';
import { createHash } from 'node:crypto';
import { headers } from 'next/headers';

/** Client IP as seen by our reverse proxy (first X-Forwarded-For hop). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || h.get('x-real-ip') || 'unknown';
}

/** One-way hash so raw IP addresses are never stored (SECURITY.md §2). */
export function hashIp(ip: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}
