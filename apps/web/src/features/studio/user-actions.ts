'use server';

import { revalidatePath } from 'next/cache';
import { emailSchema } from '@/features/auth/schemas';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/supabase/database.types';
import { createUserClient } from '@/lib/supabase/server';
import { errorState, readFields, type FormState } from '@/features/forms/form-state';
import { actingAdmin } from './guard';

type Role = Database['public']['Enums']['app_role'];
const ASSIGNABLE: Role[] = ['parent', 'content_manager', 'reviewer', 'admin', 'support'];

export interface ChildPasses {
  id: string;
  displayName: string;
  username: string;
  passes: { id: string; endsAt: string; active: boolean }[];
}

export interface UserSearchState extends FormState {
  found?: { id: string; email: string; role: Role; displayName: string; children?: ChildPasses[] };
}

/** Children of a parent with their passes (service read after the admin check). */
async function childrenWithPasses(parentId: string): Promise<ChildPasses[]> {
  const admin = createAdminClient();
  const { data: links } = await admin
    .from('parent_student_links')
    .select('student_id')
    .eq('parent_id', parentId)
    .eq('status', 'active');
  const ids = (links ?? []).map((l) => l.student_id);
  if (!ids.length) return [];
  const [{ data: profiles }, { data: students }, { data: passes }] = await Promise.all([
    admin.from('profiles').select('id, display_name').in('id', ids),
    admin.from('student_profiles').select('profile_id, username').in('profile_id', ids),
    admin
      .from('entitlements')
      .select('id, student_id, ends_at, revoked_at')
      .in('student_id', ids)
      .order('ends_at', { ascending: false }),
  ]);
  const now = Date.now();
  return (profiles ?? []).map((p) => ({
    id: p.id,
    displayName: p.display_name,
    username: students?.find((s) => s.profile_id === p.id)?.username ?? '',
    passes: (passes ?? [])
      .filter((e) => e.student_id === p.id && !e.revoked_at)
      .map((e) => ({ id: e.id, endsAt: e.ends_at, active: new Date(e.ends_at).getTime() > now })),
  }));
}

export async function findUser(_prev: UserSearchState, form: FormData): Promise<UserSearchState> {
  if (!(await actingAdmin())) return errorState('auth.errors.forbidden');
  const values = readFields(form, ['email'] as const);
  const parsed = emailSchema.safeParse(values.email);
  if (!parsed.success)
    return {
      ...errorState('validation.fixErrors', values),
      fieldErrors: { email: 'validation.email' },
    };
  // E-mails live in auth.users; the lookup function is service-only and used after the admin check.
  const { data, error } = await createAdminClient().rpc('find_user_by_email', {
    p_email: parsed.data,
  });
  if (error) return errorState('auth.errors.generic', values);
  const row = data?.[0];
  if (!row) return { status: 'error', messageKey: 'studio.users.notFound', values };
  const children = row.role === 'parent' ? await childrenWithPasses(row.id) : undefined;
  return {
    status: 'idle',
    values,
    found: {
      id: row.id,
      email: row.email,
      role: row.role,
      displayName: row.display_name,
      children,
    },
  };
}

export async function changeRole(prev: UserSearchState, form: FormData): Promise<UserSearchState> {
  if (!(await actingAdmin())) return errorState('auth.errors.forbidden');
  const { userId, role } = readFields(form, ['userId', 'role'] as const);
  if (!ASSIGNABLE.includes(role as Role))
    return { ...prev, ...errorState('auth.errors.forbidden') };
  const supabase = await createUserClient();
  const { error } = await supabase.rpc('set_user_role', { p_user: userId, p_role: role as Role });
  if (error) {
    const key = error.code === '23514' ? 'studio.users.cannotChange' : 'auth.errors.forbidden';
    return { ...prev, status: 'error', messageKey: key };
  }
  revalidatePath('/[locale]/studio/users', 'page');
  return {
    status: 'success',
    messageKey: 'studio.users.roleChanged',
    found: prev.found ? { ...prev.found, role: role as Role } : undefined,
  };
}

/** Grants a pass to a child of the found parent (DB function checks admin + aal2 again). */
export async function grantPass(prev: UserSearchState, form: FormData): Promise<UserSearchState> {
  if (!(await actingAdmin()) || !prev.found)
    return { ...prev, ...errorState('auth.errors.forbidden') };
  const { studentId, days, reason } = readFields(form, ['studentId', 'days', 'reason'] as const);
  const n = Number(days);
  if (!Number.isInteger(n) || n < 1 || n > 400)
    return { ...prev, ...errorState('studio.users.daysInvalid') };
  if (!prev.found.children?.some((c) => c.id === studentId))
    return { ...prev, ...errorState('auth.errors.forbidden') };
  const supabase = await createUserClient();
  const { error } = await supabase.rpc('grant_entitlement', {
    p_student: studentId,
    p_days: n,
    p_reason: reason.trim() || 'manual',
  });
  if (error) return { ...prev, ...errorState('auth.errors.forbidden') };
  return {
    ...prev,
    status: 'success',
    messageKey: 'studio.users.passGranted',
    found: { ...prev.found, children: await childrenWithPasses(prev.found.id) },
  };
}

export async function revokePass(prev: UserSearchState, form: FormData): Promise<UserSearchState> {
  if (!(await actingAdmin()) || !prev.found)
    return { ...prev, ...errorState('auth.errors.forbidden') };
  const passId = String(form.get('passId') ?? '');
  const supabase = await createUserClient();
  const { error } = await supabase.rpc('revoke_entitlement', { p_id: passId });
  if (error) return { ...prev, ...errorState('auth.errors.generic') };
  return {
    ...prev,
    status: 'success',
    messageKey: 'studio.users.passRevoked',
    found: { ...prev.found, children: await childrenWithPasses(prev.found.id) },
  };
}
