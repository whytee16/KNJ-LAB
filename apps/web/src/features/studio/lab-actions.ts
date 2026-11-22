'use server';

import { labModel, type ParamSpec } from '@knj/physics';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createUserClient } from '@/lib/supabase/server';
import { errorState, type FormState } from '@/features/forms/form-state';
import { actingStaff } from './guard';

const lines = (s: string) =>
  s
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

const textSchema = z.object({
  titleRu: z.string().trim().min(1, 'validation.required').max(150, 'validation.tooLong'),
  goalRu: z.string().trim().max(1000, 'validation.tooLong'),
  stepsRu: z.string().max(5000, 'validation.tooLong'),
  hintsRu: z.string().max(5000, 'validation.tooLong'),
  titleKk: z.string().trim().max(150, 'validation.tooLong'),
  goalKk: z.string().trim().max(1000, 'validation.tooLong'),
  stepsKk: z.string().max(5000, 'validation.tooLong'),
  hintsKk: z.string().max(5000, 'validation.tooLong'),
  kkStatus: z.enum(['draft', 'in_review', 'approved']),
  grade: z.coerce.number().int().min(7).max(11),
});

function values(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === 'string') out[k] = v;
  return out;
}

const revalidateLab = (id: string) => {
  revalidatePath(`/[locale]/studio/labs/${id}`, 'page');
  revalidatePath('/[locale]/studio/labs', 'page');
  revalidatePath('/[locale]/labs', 'layout');
};

/** Texts, default parameters (within the model ranges), demo flag and grade. */
export async function saveLab(_prev: FormState, form: FormData): Promise<FormState> {
  if (!(await actingStaff())) return errorState('auth.errors.forbidden');
  const v = values(form);
  const supabase = await createUserClient();
  const { data: lab } = await supabase
    .from('labs')
    .select('id, code')
    .eq('id', v.labId ?? '')
    .maybeSingle();
  const model = lab ? labModel(lab.code) : null;
  if (!lab || !model) return errorState('auth.errors.generic', v);

  const parsed = textSchema.safeParse(v);
  const fieldErrors: Record<string, string> = {};
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    fieldErrors[String(issue.path[0])] = issue.message;
  }
  const params: Record<string, number> = {};
  for (const [key, spec] of Object.entries(model.params) as [string, ParamSpec][]) {
    const n = Number(String(v[`param_${key}`] ?? '').replace(',', '.'));
    if (!Number.isFinite(n) || n < spec.min || n > spec.max)
      fieldErrors[`param_${key}`] = 'studio.labs.paramRange';
    else params[key] = n;
  }
  const steps = { ru: lines(v.stepsRu ?? ''), kk: lines(v.stepsKk ?? '') };
  const hints = { ru: lines(v.hintsRu ?? ''), kk: lines(v.hintsKk ?? '') };
  if (steps.ru.length > 12 || steps.kk.length > 12)
    fieldErrors.stepsRu = 'studio.labs.tooManySteps';
  if (hints.ru.length > 10 || hints.kk.length > 10)
    fieldErrors.hintsRu = 'studio.labs.tooManyHints';
  if (!parsed.success || Object.keys(fieldErrors).length)
    return { ...errorState('validation.fixErrors', v), fieldErrors };
  const p = parsed.data;

  const { data: updated, error } = await supabase
    .from('labs')
    .update({ default_params: params, is_free_demo: v.isFreeDemo === 'on', grade_from: p.grade })
    .eq('id', lab.id)
    .select('id');
  if (error) return errorState('auth.errors.generic', v);
  if (!updated?.length) return errorState('studio.errors.locked', v);

  const { error: ruErr } = await supabase.from('lab_translations').upsert({
    lab_id: lab.id,
    locale: 'ru',
    title: p.titleRu,
    goal: p.goalRu,
    steps: steps.ru,
    hints: hints.ru,
    translation_status: 'approved',
  });
  if (ruErr) return errorState('auth.errors.generic', v);
  if (p.titleKk) {
    const { error: kkErr } = await supabase.from('lab_translations').upsert({
      lab_id: lab.id,
      locale: 'kk',
      title: p.titleKk,
      goal: p.goalKk,
      steps: steps.kk,
      hints: hints.kk,
      translation_status: p.kkStatus,
    });
    if (kkErr) return errorState('auth.errors.generic', v);
  } else await supabase.from('lab_translations').delete().eq('lab_id', lab.id).eq('locale', 'kk');
  revalidateLab(lab.id);
  return { status: 'success', messageKey: 'studio.formula.saved', values: v };
}

export interface LabLinkState extends FormState {
  /** Which list the message belongs to. */
  list?: 'topics' | 'tasks';
}

/** Adds or removes a topic or a question template (RLS: drafts for staff, any for reviewers). */
export async function changeLabLink(_prev: LabLinkState, form: FormData): Promise<LabLinkState> {
  const list = form.get('list') === 'tasks' ? 'tasks' : 'topics';
  if (!(await actingStaff())) return { ...errorState('auth.errors.forbidden'), list };
  const labId = String(form.get('labId') ?? '');
  const target = String(form.get('target') ?? '');
  const op = form.get('op') === 'remove' ? 'remove' : 'add';
  if (!z.uuid().safeParse(labId).success || !z.uuid().safeParse(target).success)
    return { ...errorState('validation.required'), list };
  const supabase = await createUserClient();
  const { data: lab } = await supabase
    .from('labs')
    .select('id, status')
    .eq('id', labId)
    .maybeSingle();
  if (!lab) return { ...errorState('auth.errors.generic'), list };

  let error: { code?: string } | null = null;
  let changed = 0;
  if (list === 'topics') {
    if (op === 'add') {
      const res = await supabase
        .from('lab_topics')
        .insert({ lab_id: labId, topic_id: target })
        .select('lab_id');
      error = res.error;
      changed = res.data?.length ?? 0;
    } else {
      const res = await supabase
        .from('lab_topics')
        .delete()
        .eq('lab_id', labId)
        .eq('topic_id', target)
        .select('lab_id');
      error = res.error;
      changed = res.data?.length ?? 0;
    }
  } else if (op === 'add') {
    const { data: template } = await supabase
      .from('task_templates')
      .select('status')
      .eq('id', target)
      .maybeSingle();
    if (template?.status !== 'published')
      return { ...errorState('studio.labs.templateNotPublished'), list };
    const { count } = await supabase
      .from('lab_tasks')
      .select('template_id', { count: 'exact', head: true })
      .eq('lab_id', labId);
    const res = await supabase
      .from('lab_tasks')
      .insert({ lab_id: labId, template_id: target, position: (count ?? 0) + 1 })
      .select('lab_id');
    error = res.error;
    changed = res.data?.length ?? 0;
  } else {
    const res = await supabase
      .from('lab_tasks')
      .delete()
      .eq('lab_id', labId)
      .eq('template_id', target)
      .select('lab_id');
    error = res.error;
    changed = res.data?.length ?? 0;
  }
  if (error?.code === '23505') return { ...errorState('studio.labs.alreadyLinked'), list };
  if (error) return { ...errorState('auth.errors.generic'), list };
  if (!changed) return { ...errorState('studio.errors.locked'), list };
  revalidateLab(labId);
  return {
    status: 'success',
    messageKey: op === 'add' ? 'studio.labs.linked' : 'studio.labs.unlinked',
    list,
  };
}

export async function setLabStatus(_prev: FormState, form: FormData): Promise<FormState> {
  const id = String(form.get('labId') ?? '');
  const status = String(form.get('status') ?? '');
  if (!['draft', 'in_review', 'published'].includes(status) || !(await actingStaff()))
    return errorState('auth.errors.forbidden');
  const supabase = await createUserClient();
  const { error } = await supabase.rpc('set_lab_status', {
    p_lab: id,
    p_status: status as 'draft' | 'in_review' | 'published',
  });
  if (error)
    return errorState(
      error.code === '42501'
        ? 'auth.errors.forbidden'
        : error.code === '23514'
          ? 'studio.labs.goalRequired'
          : 'studio.errors.workflow',
    );
  revalidateLab(id);
  return { status: 'success', messageKey: `studio.formula.status.${status}` };
}
