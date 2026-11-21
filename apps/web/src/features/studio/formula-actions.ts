'use server';

import { formulaSchema, formulaTextSchema } from '@knj/content-schema';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { renderLatex } from '@/lib/katex';
import { createUserClient } from '@/lib/supabase/server';
import { errorState, fromZodError, readFields, type FormState } from '@/features/forms/form-state';
import { actingStaff, localeOf } from './guard';

const NEUTRAL = ['code', 'subject', 'gradeFrom', 'gradeTo', 'latex'] as const;

function latexError(latex: string): boolean {
  try {
    renderLatex(latex);
    return false;
  } catch {
    return true;
  }
}

export async function createFormula(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = localeOf(form);
  const values = readFields(form, [...NEUTRAL, 'name'] as const);
  const user = await actingStaff();
  if (!user) return errorState('auth.errors.forbidden');
  const parsed = formulaSchema.safeParse(values);
  if (!parsed.success) return fromZodError(parsed.error, values);
  const name = formulaTextSchema.shape.name.safeParse(values.name);
  if (!name.success)
    return {
      ...errorState('validation.fixErrors', values),
      fieldErrors: { name: name.error.issues[0]!.message },
    };
  if (latexError(parsed.data.latex))
    return {
      ...errorState('validation.fixErrors', values),
      fieldErrors: { latex: 'studio.errors.latex' },
    };

  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from('formulas')
    .insert({
      code: parsed.data.code,
      subject_code: parsed.data.subject,
      grade_from: parsed.data.gradeFrom,
      grade_to: parsed.data.gradeTo,
      latex: parsed.data.latex,
      created_by: user.id,
    })
    .select('id')
    .single();
  if (error) {
    if (error.code === '23505')
      return {
        ...errorState('validation.fixErrors', values),
        fieldErrors: { code: 'studio.errors.slugTaken' },
      };
    return errorState('auth.errors.generic', values);
  }
  await supabase
    .from('formula_translations')
    .insert({ formula_id: data.id, locale: 'ru', name: name.data });
  redirect(`/${locale}/studio/formulas/${data.id}`);
}

export async function saveFormula(_prev: FormState, form: FormData): Promise<FormState> {
  const id = String(form.get('formulaId') ?? '');
  const values = readFields(form, [
    ...NEUTRAL,
    'name_ru',
    'description_ru',
    'variables_ru',
    'name_kk',
    'description_kk',
    'variables_kk',
  ] as const);
  if (!(await actingStaff())) return errorState('auth.errors.forbidden');

  const parsed = formulaSchema.safeParse(values);
  if (!parsed.success) return fromZodError(parsed.error, values);
  if (latexError(parsed.data.latex))
    return {
      ...errorState('validation.fixErrors', values),
      fieldErrors: { latex: 'studio.errors.latex' },
    };

  const texts: { locale: 'ru' | 'kk'; name: string; description: string; variables: unknown }[] =
    [];
  for (const lang of ['ru', 'kk'] as const) {
    const raw = {
      name: values[`name_${lang}`],
      description: values[`description_${lang}`],
      variables: values[`variables_${lang}`],
    };
    if (lang === 'kk' && !raw.name.trim() && !raw.description.trim() && !raw.variables.trim())
      continue;
    const t = formulaTextSchema.safeParse(raw);
    if (!t.success) {
      const issue = t.error.issues[0]!;
      return {
        ...errorState('validation.fixErrors', values),
        fieldErrors: { [`${String(issue.path[0])}_${lang}`]: issue.message },
      };
    }
    const badSymbol = t.data.variables.find((v) => latexError(v.symbol));
    if (badSymbol)
      return {
        ...errorState('validation.fixErrors', values),
        fieldErrors: { [`variables_${lang}`]: 'studio.errors.latex' },
      };
    texts.push({ locale: lang, ...t.data });
  }

  const supabase = await createUserClient();
  const { data: updated, error } = await supabase
    .from('formulas')
    .update({
      code: parsed.data.code,
      subject_code: parsed.data.subject,
      grade_from: parsed.data.gradeFrom,
      grade_to: parsed.data.gradeTo,
      latex: parsed.data.latex,
    })
    .eq('id', id)
    .select('id');
  if (error)
    return errorState(
      error.code === '23505' ? 'studio.errors.slugTaken' : 'auth.errors.generic',
      values,
    );
  // RLS silently filters rows the user may not change (e.g. a manager on a published formula).
  if (!updated?.length) return errorState('studio.errors.locked', values);

  for (const t of texts) {
    const { error: tErr } = await supabase.from('formula_translations').upsert({
      formula_id: id,
      locale: t.locale,
      name: t.name,
      description: t.description,
      variables: t.variables as never,
    });
    if (tErr) return errorState('auth.errors.generic', values);
  }
  revalidatePath(`/[locale]/studio/formulas/${id}`, 'page');
  revalidatePath('/[locale]/reference', 'page');
  return { status: 'success', messageKey: 'studio.formula.saved', values };
}

export async function setFormulaStatus(_prev: FormState, form: FormData): Promise<FormState> {
  const id = String(form.get('formulaId') ?? '');
  const status = String(form.get('status') ?? '');
  if (!['draft', 'in_review', 'published'].includes(status))
    return errorState('auth.errors.forbidden');
  if (!(await actingStaff())) return errorState('auth.errors.forbidden');
  const supabase = await createUserClient();
  const { error } = await supabase.rpc('set_formula_status', {
    p_formula: id,
    p_status: status as 'draft' | 'in_review' | 'published',
  });
  if (error)
    return errorState(error.code === '42501' ? 'auth.errors.forbidden' : 'studio.errors.workflow');
  revalidatePath(`/[locale]/studio/formulas/${id}`, 'page');
  revalidatePath('/[locale]/reference', 'page');
  return { status: 'success', messageKey: `studio.formula.status.${status}` };
}

export async function deleteFormula(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = localeOf(form);
  const id = String(form.get('formulaId') ?? '');
  if (!(await actingStaff())) return errorState('auth.errors.forbidden');
  const supabase = await createUserClient();
  const { data, error } = await supabase.from('formulas').delete().eq('id', id).select('id');
  if (error || !data?.length) return errorState('studio.errors.locked');
  redirect(`/${locale}/studio/formulas`);
}
