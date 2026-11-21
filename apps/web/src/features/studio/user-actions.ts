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

export interface UserSearchState extends FormState {
  found?: { id: string; email: string; role: Role; displayName: string };
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
  return {
    status: 'idle',
    values,
    found: { id: row.id, email: row.email, role: row.role, displayName: row.display_name },
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
