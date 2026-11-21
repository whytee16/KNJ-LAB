'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createUserClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/server/authz';
import { errorState, type FormState } from '@/features/forms/form-state';

/** Adds or removes a formula from the signed-in user's favorites (RLS: own rows only). */
export async function toggleFavorite(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return errorState('reference.loginToSave');
  const id = z.uuid().safeParse(form.get('formulaId'));
  if (!id.success) return errorState('auth.errors.generic');
  const supabase = await createUserClient();
  const { data: existing } = await supabase
    .from('favorites')
    .select('formula_id')
    .eq('profile_id', user.id)
    .eq('formula_id', id.data)
    .maybeSingle();
  const { error } = existing
    ? await supabase.from('favorites').delete().eq('profile_id', user.id).eq('formula_id', id.data)
    : await supabase.from('favorites').insert({ profile_id: user.id, formula_id: id.data });
  if (error) return errorState('auth.errors.generic');
  revalidatePath('/[locale]/reference', 'page');
  return { status: 'idle' };
}
