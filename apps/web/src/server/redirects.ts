import type { Locale } from '@knj/i18n';
import type { Database } from '@/lib/supabase/database.types';

export type AppRole = Database['public']['Enums']['app_role'];

/** Home page of each role inside the given locale. */
export function dashboardPath(role: AppRole, locale: Locale): string {
  if (role === 'parent') return `/${locale}/parent`;
  if (role === 'student') return `/${locale}/app`;
  return `/${locale}/account`;
}

/**
 * Accepts only same-site paths inside the current locale; anything else (absolute URLs,
 * protocol-relative `//host`, backslashes, other locales) falls back to the default.
 */
export function safeNext(next: unknown, locale: Locale, fallback: string): string {
  if (typeof next !== 'string' || next.length > 512) return fallback;
  if (!next.startsWith(`/${locale}/`) && next !== `/${locale}`) return fallback;
  if (next.includes('//') || next.includes('\\') || /[\u0000-\u001f]/.test(next)) return fallback;
  return next;
}
