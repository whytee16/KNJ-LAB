'use server';

import { isLocale } from '@knj/i18n';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createUserClient } from '@/lib/supabase/server';
import { errorState, type FormState } from '@/features/forms/form-state';
import { actingReviewer } from './guard';

const KINDS = ['topic', 'lab', 'template'] as const;

/** Reviewer confirms that a teacher checked an automatically prepared text (DB re-checks role + aal2). */
export async function markReviewed(_prev: FormState, form: FormData): Promise<FormState> {
  if (!(await actingReviewer())) return errorState('auth.errors.forbidden');
  const kind = String(form.get('kind') ?? '');
  const id = String(form.get('id') ?? '');
  const lang = String(form.get('lang') ?? 'ru');
  if (
    !(KINDS as readonly string[]).includes(kind) ||
    !z.uuid().safeParse(id).success ||
    !isLocale(lang)
  )
    return errorState('auth.errors.generic');
  const supabase = await createUserClient();
  const { error } = await supabase.rpc('mark_content_reviewed', {
    p_kind: kind,
    p_id: id,
    p_locale: lang,
  });
  if (error)
    return errorState(error.code === '42501' ? 'auth.errors.forbidden' : 'auth.errors.generic');
  revalidatePath('/[locale]/studio', 'layout');
  return { status: 'success', messageKey: 'studio.aiDraft.confirmed' };
}
