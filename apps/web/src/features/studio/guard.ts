import 'server-only';
import { isLocale, type Locale } from '@knj/i18n';
import { createUserClient } from '@/lib/supabase/server';
import { getCurrentUser, type CurrentUser } from '@/server/authz';
import { REVIEW_ROLES, STUDIO_ROLES, type AppRole } from '@/server/redirects';

export function localeOf(form: FormData): Locale {
  const v = form.get('locale');
  return typeof v === 'string' && isLocale(v) ? v : 'ru';
}

/**
 * For Server Actions: staff user with an aal2 session, or null. Pages redirect via
 * requireStaff(); actions just refuse. RLS and SQL functions re-check both conditions.
 */
export async function actingStaff(roles: AppRole[] = STUDIO_ROLES): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  if (!user || !roles.includes(user.role)) return null;
  const supabase = await createUserClient();
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return data?.currentLevel === 'aal2' ? user : null;
}

export const actingReviewer = () => actingStaff(REVIEW_ROLES);
export const actingAdmin = () => actingStaff(['admin']);
