'use server';

import { revalidatePath } from 'next/cache';
import { createUserClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/server/authz';
import { errorState, type FormState } from '@/features/forms/form-state';
import { actingStaff } from './guard';

export async function setReportStatus(_prev: FormState, form: FormData): Promise<FormState> {
  const id = String(form.get('reportId') ?? '');
  const status = String(form.get('status') ?? '');
  if (!['resolved', 'rejected'].includes(status) || !(await actingStaff()))
    return errorState('auth.errors.forbidden');
  const user = await getCurrentUser();
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from('content_reports')
    .update({
      status: status as 'resolved' | 'rejected',
      resolved_by: user!.id,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id');
  if (error || !data?.length) return errorState('auth.errors.generic');
  revalidatePath('/[locale]/studio/reports', 'page');
  return { status: 'success', messageKey: `studio.reports.${status}` };
}
