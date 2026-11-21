'use server';

import { isLocale, type Locale } from '@knj/i18n';
import { revalidatePath } from 'next/cache';
import { env, supabaseEnv } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { audit } from '@/server/audit';
import { assertParentOf, ForbiddenError, getCurrentUser, hasCurrentConsent } from '@/server/authz';
import { currentDocument } from '@/server/legal';
import { hit } from '@/server/rate-limit';
import { clientIp, hashIp } from '@/server/request';
import { usernameToEmail } from '@/server/students';
import { childSchema, newPasswordSchema } from '@/features/auth/schemas';
import {
  errorState,
  fromZodError,
  publicValues,
  readFields,
  type FormState,
} from '@/features/forms/form-state';

const MAX_CHILDREN = 10;

function localeOf(form: FormData): Locale {
  const value = form.get('locale');
  return typeof value === 'string' && isLocale(value) ? value : 'ru';
}

/** Parent with current consent, or null (the page guard redirects in that case). */
async function currentParent(locale: Locale) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'parent') return null;
  if (!(await hasCurrentConsent(user.id, 'pd_processing', locale))) return null;
  return user;
}

// ---------------------------------------------------------------------------------------------
export async function createChild(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = localeOf(form);
  const values = readFields(form, [
    'displayName',
    'username',
    'grade',
    'password',
    'consent',
  ] as const);
  const parent = await currentParent(locale);
  if (!parent) return errorState('auth.errors.forbidden');

  const parsed = childSchema.safeParse(values);
  if (!parsed.success) return fromZodError(parsed.error, publicValues(values));
  const { displayName, username, grade, password } = parsed.data;

  if (!(await hit('createChild', `parent:${parent.id}`))) {
    return errorState('auth.errors.rateLimited', publicValues(values));
  }

  const consentDoc = await currentDocument('child_pd_processing', locale);
  if (!consentDoc) return errorState('parent.errors.consentUnavailable', publicValues(values));

  const admin = createAdminClient();
  const { count, error: countError } = await admin
    .from('parent_student_links')
    .select('student_id', { count: 'exact', head: true })
    .eq('parent_id', parent.id)
    .eq('status', 'active');
  if (countError) return errorState('auth.errors.generic', publicValues(values));
  if ((count ?? 0) >= MAX_CHILDREN)
    return errorState('parent.errors.tooManyChildren', publicValues(values));

  const { data: taken } = await admin
    .from('student_profiles')
    .select('profile_id')
    .eq('username', username)
    .maybeSingle();
  if (taken)
    return {
      ...errorState('validation.fixErrors', publicValues(values)),
      fieldErrors: { username: 'parent.errors.usernameTaken' },
    };

  // 1) Create the login. New accounts always start as a bare parent profile (DB trigger).
  const { data, error } = await admin.auth.admin.createUser({
    email: usernameToEmail(username, env().STUDENT_EMAIL_DOMAIN),
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName, locale },
  });
  if (error || !data.user) {
    if (error?.code === 'email_exists') {
      return {
        ...errorState('validation.fixErrors', publicValues(values)),
        fieldErrors: { username: 'parent.errors.usernameTaken' },
      };
    }
    if (error?.code === 'weak_password')
      return errorState('validation.passwordWeak', publicValues(values));
    return errorState('auth.errors.generic', publicValues(values));
  }
  const studentId = data.user.id;

  // 2) Turn it into this parent's student in one transaction (role, profile, link, consent).
  const { error: registerError } = await admin.rpc('register_student', {
    p_student: studentId,
    p_parent: parent.id,
    p_username: username,
    p_grade: grade,
    p_display_name: displayName,
    p_consent_version: consentDoc.version,
    p_ip_hash: hashIp(await clientIp(), supabaseEnv().ipHashSalt),
  });
  if (registerError) {
    // Never leave a half-created login behind.
    await admin.auth.admin.deleteUser(studentId);
    if (registerError.code === '23505') {
      return {
        ...errorState('validation.fixErrors', publicValues(values)),
        fieldErrors: { username: 'parent.errors.usernameTaken' },
      };
    }
    return errorState('auth.errors.generic', publicValues(values));
  }
  await audit(parent.id, 'student.created', 'profile', studentId, {
    grade,
    consent: consentDoc.version,
  });

  revalidatePath(`/${locale}/parent`);
  return { status: 'success', messageKey: 'parent.children.created', values: { username } };
}

// ---------------------------------------------------------------------------------------------
export async function setChildPassword(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = localeOf(form);
  const values = readFields(form, ['studentId', 'password', 'confirm'] as const);
  const parent = await currentParent(locale);
  if (!parent) return errorState('auth.errors.forbidden');

  const parsed = newPasswordSchema.safeParse(values);
  if (!parsed.success) return fromZodError(parsed.error, {});
  if (!(await hit('childPassword', `parent:${parent.id}`)))
    return errorState('auth.errors.rateLimited');

  try {
    await assertParentOf(parent.id, values.studentId);
  } catch (e) {
    if (e instanceof ForbiddenError) return errorState('auth.errors.forbidden');
    throw e;
  }

  const { error } = await createAdminClient().auth.admin.updateUserById(values.studentId, {
    password: parsed.data.password,
  });
  if (error) {
    if (error.code === 'weak_password') return errorState('validation.passwordWeak');
    return errorState('auth.errors.generic');
  }
  await audit(parent.id, 'student.password_set', 'profile', values.studentId);
  return { status: 'success', messageKey: 'parent.children.passwordChanged' };
}

// ---------------------------------------------------------------------------------------------
export async function deleteChild(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = localeOf(form);
  const values = readFields(form, ['studentId', 'confirmUsername'] as const);
  const parent = await currentParent(locale);
  if (!parent) return errorState('auth.errors.forbidden');

  try {
    await assertParentOf(parent.id, values.studentId);
  } catch (e) {
    if (e instanceof ForbiddenError) return errorState('auth.errors.forbidden');
    throw e;
  }

  const admin = createAdminClient();
  const { data: student } = await admin
    .from('student_profiles')
    .select('username')
    .eq('profile_id', values.studentId)
    .single();
  if (!student || student.username !== values.confirmUsername.trim().toLowerCase()) {
    return {
      ...errorState('validation.fixErrors'),
      fieldErrors: { confirmUsername: 'parent.errors.confirmMismatch' },
    };
  }

  // Deleting the auth user cascades to profile, student profile, link and consents.
  const { error } = await admin.auth.admin.deleteUser(values.studentId);
  if (error) return errorState('auth.errors.generic');
  await audit(parent.id, 'student.deleted', 'profile', values.studentId);

  revalidatePath(`/${locale}/parent`);
  return { status: 'success', messageKey: 'parent.children.deleted' };
}
