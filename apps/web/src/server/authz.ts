import 'server-only';
import type { Locale } from '@knj/i18n';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import { createUserClient } from '@/lib/supabase/server';
import { currentDocument } from './legal';
import { dashboardPath, STUDIO_ROLES, type AppRole } from './redirects';

export interface CurrentUser {
  id: string;
  email: string | null;
  role: AppRole;
  displayName: string;
  locale: Locale;
}

/**
 * The signed-in user with their profile, or null. `getUser()` validates the token with the
 * auth server, so a forged cookie cannot pass. Cached per request.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createUserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, display_name, locale')
    .eq('id', user.id)
    .single();
  if (!profile) return null;
  return {
    id: user.id,
    email: user.email ?? null,
    role: profile.role,
    displayName: profile.display_name,
    locale: profile.locale,
  };
});

interface RequireOptions {
  roles?: AppRole[];
  /** Path to return to after login (already localized). */
  next?: string;
}

/** Redirects to login if signed out, or to the user's own cabinet if the role does not match. */
export async function requireUser(
  locale: Locale,
  options: RequireOptions = {},
): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    const next = options.next ? `?next=${encodeURIComponent(options.next)}` : '';
    redirect(`/${locale}/login${next}`);
  }
  if (options.roles && !options.roles.includes(user.role)) {
    redirect(dashboardPath(user.role, locale));
  }
  return user;
}

/** True if the user has accepted the current version of the given document. */
export async function hasCurrentConsent(
  userId: string,
  type: 'pd_processing' | 'child_pd_processing',
  locale: Locale,
): Promise<boolean> {
  const doc = await currentDocument(type, locale);
  if (!doc) return false;
  const { data, error } = await createAdminClient()
    .from('consents')
    .select('id')
    .eq('subject_profile_id', userId)
    .eq('type', type)
    .eq('document_version', doc.version)
    .is('revoked_at', null)
    .limit(1);
  if (error) throw new Error(`consent query failed: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

/** Parent pages: signed in as parent and has accepted the current privacy policy. */
export async function requireParent(locale: Locale, next: string): Promise<CurrentUser> {
  const user = await requireUser(locale, { roles: ['parent'], next });
  if (!(await hasCurrentConsent(user.id, 'pd_processing', locale))) {
    redirect(`/${locale}/consent?next=${encodeURIComponent(next)}`);
  }
  return user;
}

/** Throws unless `parentId` has an active link to `studentId`. Use before any service-role write. */
export async function assertParentOf(parentId: string, studentId: string): Promise<void> {
  const { data, error } = await createAdminClient()
    .from('parent_student_links')
    .select('student_id')
    .eq('parent_id', parentId)
    .eq('student_id', studentId)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw new Error(`link query failed: ${error.message}`);
  if (!data) throw new ForbiddenError();
}

export class ForbiddenError extends Error {
  constructor() {
    super('forbidden');
    this.name = 'ForbiddenError';
  }
}

/**
 * Staff pages: role check plus a verified second factor (TOTP). Without a factor the user is
 * sent to set one up; with a factor but a one-factor session, to enter a code.
 * The database enforces the same rule (aal2) on every staff write.
 */
export async function requireStaff(
  locale: Locale,
  next: string,
  roles: AppRole[] = STUDIO_ROLES,
): Promise<CurrentUser> {
  const user = await requireUser(locale, { roles, next });
  const supabase = await createUserClient();
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw new Error(`MFA status failed: ${error.message}`);
  if (data.currentLevel !== 'aal2') {
    const step = data.nextLevel === 'aal2' ? 'verify' : 'enroll';
    redirect(`/${locale}/security/${step}?next=${encodeURIComponent(next)}`);
  }
  return user;
}
