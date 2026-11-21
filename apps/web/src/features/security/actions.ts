'use server';

import { isLocale, type Locale } from '@knj/i18n';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createUserClient } from '@/lib/supabase/server';
import { audit } from '@/server/audit';
import { getCurrentUser } from '@/server/authz';
import { hit } from '@/server/rate-limit';
import { dashboardPath, safeNext, STUDIO_ROLES } from '@/server/redirects';
import { errorState, fromZodError, readFields, type FormState } from '@/features/forms/form-state';

const codeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'validation.otp'),
});

function localeOf(form: FormData): Locale {
  const v = form.get('locale');
  return typeof v === 'string' && isLocale(v) ? v : 'ru';
}

export interface EnrollmentState extends FormState {
  factorId?: string;
  qr?: string;
  secret?: string;
}

/** Creates a fresh TOTP factor (removing unfinished ones) and returns its QR code and secret. */
export async function startEnrollment(
  _prev: EnrollmentState,
  form: FormData,
): Promise<EnrollmentState> {
  void localeOf(form);
  const user = await getCurrentUser();
  if (!user || !STUDIO_ROLES.includes(user.role)) return errorState('auth.errors.forbidden');

  const supabase = await createUserClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const f of factors?.all ?? []) {
    if (f.factor_type === 'totp' && f.status === 'unverified')
      await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: `KNJ LAB ${new Date().toISOString().slice(0, 16)}`,
  });
  if (error || !data) return errorState('auth.errors.generic');
  return { status: 'idle', factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

async function verify(factorId: string, code: string, userId: string): Promise<FormState | null> {
  if (!(await hit('mfa', `user:${userId}`))) return errorState('auth.errors.rateLimited');
  const supabase = await createUserClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error)
    return {
      ...errorState('validation.fixErrors'),
      fieldErrors: { code: 'security.errors.wrongCode' },
    };
  return null;
}

export async function confirmEnrollment(
  prev: EnrollmentState,
  form: FormData,
): Promise<EnrollmentState> {
  const locale = localeOf(form);
  const values = readFields(form, ['code', 'factorId', 'next'] as const);
  const keep = { factorId: prev.factorId, qr: prev.qr, secret: prev.secret };
  const parsed = codeSchema.safeParse(values);
  if (!parsed.success) return { ...fromZodError(parsed.error, {}), ...keep };

  const user = await getCurrentUser();
  if (!user || !STUDIO_ROLES.includes(user.role)) return errorState('auth.errors.forbidden');
  const failed = await verify(values.factorId, parsed.data.code, user.id);
  if (failed) return { ...failed, ...keep };

  await audit(user.id, 'auth.mfa_enrolled', 'profile', user.id);
  redirect(safeNext(values.next, locale, dashboardPath(user.role, locale)));
}

export async function verifyMfa(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = localeOf(form);
  const values = readFields(form, ['code', 'next'] as const);
  const parsed = codeSchema.safeParse(values);
  if (!parsed.success) return fromZodError(parsed.error, {});

  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const supabase = await createUserClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp.find((f) => f.status === 'verified');
  if (!factor) redirect(`/${locale}/security/enroll`);

  const failed = await verify(factor.id, parsed.data.code, user.id);
  if (failed) return failed;
  redirect(safeNext(values.next, locale, dashboardPath(user.role, locale)));
}
