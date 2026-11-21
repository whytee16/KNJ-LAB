'use server';

import { isLocale, type Locale } from '@knj/i18n';
import { redirect } from 'next/navigation';
import { env, supabaseEnv } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { createUserClient } from '@/lib/supabase/server';
import { audit } from '@/server/audit';
import { getCurrentUser } from '@/server/authz';
import { currentDocument } from '@/server/legal';
import { hit, hitAll } from '@/server/rate-limit';
import { dashboardPath, safeNext } from '@/server/redirects';
import { clientIp, hashIp } from '@/server/request';
import { identifierToEmail, isStudentEmail } from '@/server/students';
import {
  errorState,
  fromZodError,
  publicValues,
  readFields,
  type FormState,
} from '@/features/forms/form-state';
import {
  consentFormSchema,
  loginSchema,
  newPasswordSchema,
  registerSchema,
  resetRequestSchema,
} from './schemas';

function localeOf(form: FormData): Locale {
  const value = form.get('locale');
  return typeof value === 'string' && isLocale(value) ? value : 'ru';
}

async function ipHash(): Promise<string> {
  return hashIp(await clientIp(), supabaseEnv().ipHashSalt);
}

// ---------------------------------------------------------------------------------------------
export async function signIn(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = localeOf(form);
  const values = readFields(form, ['identifier', 'password', 'next'] as const);
  const parsed = loginSchema.safeParse(values);
  if (!parsed.success) return fromZodError(parsed.error, publicValues(values));

  const email = identifierToEmail(parsed.data.identifier, env().STUDENT_EMAIL_DOMAIN);
  if (
    !(await hitAll([
      ['loginIp', await ipHash()],
      ['loginAccount', email],
    ]))
  ) {
    return errorState('auth.errors.rateLimited', publicValues(values));
  }

  const supabase = await createUserClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.password,
  });
  if (error) {
    const key =
      error.code === 'email_not_confirmed'
        ? 'auth.errors.emailNotConfirmed'
        : 'auth.errors.invalidCredentials';
    return errorState(key, publicValues(values));
  }

  const user = await getCurrentUser();
  if (!user) return errorState('auth.errors.generic', publicValues(values));
  if (user.role !== 'parent' && user.role !== 'student') {
    await audit(user.id, 'auth.staff_login', 'profile', user.id, { role: user.role });
  }
  const home = dashboardPath(user.role, locale);
  redirect(safeNext(values.next, locale, home));
}

// ---------------------------------------------------------------------------------------------
export async function registerParent(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = localeOf(form);
  const values = readFields(form, ['displayName', 'email', 'password', 'consent'] as const);
  if (!env().REGISTRATION_ENABLED) return errorState('auth.errors.registrationClosed');

  const parsed = registerSchema.safeParse(values);
  if (!parsed.success) return fromZodError(parsed.error, publicValues(values));

  const ip = await ipHash();
  if (!(await hit('register', `ip:${ip}`)))
    return errorState('auth.errors.rateLimited', publicValues(values));

  const policy = await currentDocument('pd_processing', locale);
  if (!policy) return errorState('auth.errors.registrationUnavailable', publicValues(values));

  const supabase = await createUserClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName, locale },
      emailRedirectTo: `${env().APP_URL}/${locale}/auth/callback?next=${encodeURIComponent(`/${locale}/parent`)}`,
    },
  });
  if (error) {
    if (error.code === 'weak_password')
      return errorState('validation.passwordWeak', publicValues(values));
    if (error.code === 'over_email_send_rate_limit' || error.status === 429) {
      return errorState('auth.errors.rateLimited', publicValues(values));
    }
    return errorState('auth.errors.generic', publicValues(values));
  }

  // With e-mail confirmation on, an existing address returns a user without identities
  // (no enumeration). Record consent only for a genuinely new account.
  const user = data.user;
  if (user && (user.identities?.length ?? 0) > 0) {
    const admin = createAdminClient();
    const { error: consentError } = await admin.from('consents').insert({
      subject_profile_id: user.id,
      given_by_profile_id: user.id,
      type: 'pd_processing',
      document_version: policy.version,
      ip_hash: ip,
    });
    // If this fails the account still works: /consent asks again before any parent page opens.
    if (!consentError)
      await audit(user.id, 'parent.registered', 'profile', user.id, { policy: policy.version });
  }

  if (data.session) redirect(`/${locale}/parent`);
  return { status: 'success', messageKey: 'auth.register.checkEmail' };
}

// ---------------------------------------------------------------------------------------------
export async function signOut(form: FormData): Promise<void> {
  const locale = localeOf(form);
  const supabase = await createUserClient();
  await supabase.auth.signOut();
  redirect(`/${locale}`);
}

// ---------------------------------------------------------------------------------------------
export async function requestPasswordReset(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = localeOf(form);
  const values = readFields(form, ['email'] as const);
  const parsed = resetRequestSchema.safeParse(values);
  if (!parsed.success) return fromZodError(parsed.error, values);

  const email = parsed.data.email;
  if (
    !(await hitAll([
      ['passwordResetIp', await ipHash()],
      ['passwordResetAccount', email],
    ]))
  ) {
    return errorState('auth.errors.rateLimited', values);
  }

  // Student logins are not real mailboxes: their password is reset by the parent.
  if (!isStudentEmail(email, env().STUDENT_EMAIL_DOMAIN)) {
    const supabase = await createUserClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${env().APP_URL}/${locale}/auth/callback?next=${encodeURIComponent(`/${locale}/reset-password`)}`,
    });
    if (error && error.status === 429) return errorState('auth.errors.rateLimited', values);
  }
  // Same answer whether or not the address exists.
  return { status: 'success', messageKey: 'auth.forgot.sent' };
}

// ---------------------------------------------------------------------------------------------
export async function updatePassword(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = localeOf(form);
  const values = readFields(form, ['password', 'confirm'] as const);
  const parsed = newPasswordSchema.safeParse(values);
  if (!parsed.success) return fromZodError(parsed.error, {});

  const user = await getCurrentUser();
  if (!user) return errorState('auth.errors.resetLinkExpired');

  const supabase = await createUserClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    const key = error.code === 'same_password' ? 'auth.errors.samePassword' : 'auth.errors.generic';
    return errorState(key);
  }
  await audit(user.id, 'auth.password_changed', 'profile', user.id);
  redirect(dashboardPath(user.role, locale));
}

// ---------------------------------------------------------------------------------------------
export async function acceptPolicy(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = localeOf(form);
  const values = readFields(form, ['consent', 'next'] as const);
  const parsed = consentFormSchema.safeParse(values);
  if (!parsed.success) return fromZodError(parsed.error, {});

  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== 'parent') redirect(dashboardPath(user.role, locale));

  const policy = await currentDocument('pd_processing', locale);
  if (!policy) return errorState('auth.errors.registrationUnavailable');

  const { error } = await createAdminClient()
    .from('consents')
    .insert({
      subject_profile_id: user.id,
      given_by_profile_id: user.id,
      type: 'pd_processing',
      document_version: policy.version,
      ip_hash: await ipHash(),
    });
  if (error) return errorState('auth.errors.generic');
  await audit(user.id, 'consent.given', 'profile', user.id, {
    type: 'pd_processing',
    version: policy.version,
  });
  redirect(safeNext(values.next, locale, `/${locale}/parent`));
}

// ---------------------------------------------------------------------------------------------
/** Remembers the interface language in the profile (I18N.md §2). Silent no-op when signed out. */
export async function rememberLocale(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  const user = await getCurrentUser();
  if (!user || user.locale === locale) return;
  const supabase = await createUserClient();
  await supabase.from('profiles').update({ locale }).eq('id', user.id);
}
