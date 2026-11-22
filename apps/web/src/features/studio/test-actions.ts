'use server';

import { DIFFICULTIES } from '@knj/task-engine';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createUserClient } from '@/lib/supabase/server';
import { missingLevels, parseCounts, scopeTopicIds } from '@/features/tests/scope';
import { errorState, type FormState } from '@/features/forms/form-state';
import { actingStaff, localeOf } from './guard';

const optionalInt = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === '' || v === undefined ? undefined : Number(v)),
    z.number().int().min(min).max(max).optional(),
  );

const testSchema = z
  .object({
    scope: z.enum(['topic', 'section', 'quarter', 'grade', 'subject']),
    topicId: z.string().optional(),
    sectionId: z.string().optional(),
    subject: z.string().optional(),
    grade: optionalInt(7, 11),
    quarter: optionalInt(1, 4),
    mode: z.enum(['practice', 'exam']),
    minutes: optionalInt(1, 240),
    titleRu: z.string().trim().min(1, 'validation.required').max(150, 'validation.tooLong'),
    descriptionRu: z.string().trim().max(1000, 'validation.tooLong'),
    titleKk: z.string().trim().max(150, 'validation.tooLong'),
    descriptionKk: z.string().trim().max(1000, 'validation.tooLong'),
  })
  .superRefine((v, ctx) => {
    const need = (ok: unknown, path: string) => {
      if (!ok) ctx.addIssue({ code: 'custom', message: 'validation.required', path: [path] });
    };
    if (v.scope === 'topic') need(v.topicId, 'topicId');
    if (v.scope === 'section') need(v.sectionId, 'sectionId');
    if (['quarter', 'grade', 'subject'].includes(v.scope)) need(v.subject, 'subject');
    if (['quarter', 'grade'].includes(v.scope)) need(v.grade, 'grade');
    if (v.scope === 'quarter') need(v.quarter, 'quarter');
    if (v.mode === 'exam') need(v.minutes, 'minutes');
  });

function values(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === 'string') out[k] = v;
  return out;
}

export async function saveTest(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = localeOf(form);
  const user = await actingStaff();
  if (!user) return errorState('auth.errors.forbidden');
  const v = values(form);
  const parsed = testSchema.safeParse(v);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    return {
      ...errorState('validation.fixErrors', v),
      fieldErrors: { [String(issue.path[0])]: issue.message },
    };
  }
  const counts = parseCounts(Object.fromEntries(DIFFICULTIES.map((d) => [d, v[`count_${d}`]])));
  if (!Object.keys(counts).length)
    return {
      ...errorState('validation.fixErrors', v),
      fieldErrors: { count_easy: 'studio.tests.noItems' },
    };
  const p = parsed.data;
  const row = {
    scope: p.scope,
    topic_id: p.scope === 'topic' ? p.topicId! : null,
    section_id: p.scope === 'section' ? p.sectionId! : null,
    subject_code: ['quarter', 'grade', 'subject'].includes(p.scope) ? p.subject! : null,
    grade: ['quarter', 'grade'].includes(p.scope) ? p.grade! : null,
    quarter: p.scope === 'quarter' ? p.quarter! : null,
    mode: p.mode,
    time_limit_s: p.mode === 'exam' ? p.minutes! * 60 : null,
    counts,
  };
  const supabase = await createUserClient();
  let id = v.testId;
  if (!id) {
    const { data, error } = await supabase
      .from('tests')
      .insert({ ...row, created_by: user.id })
      .select('id')
      .single();
    if (error) return errorState('auth.errors.generic', v);
    id = data.id;
  } else {
    const { data, error } = await supabase.from('tests').update(row).eq('id', id).select('id');
    if (error) return errorState('auth.errors.generic', v);
    if (!data?.length) return errorState('studio.errors.locked', v);
  }
  const texts = [
    { test_id: id, locale: 'ru' as const, title: p.titleRu, description: p.descriptionRu },
  ];
  const { error: tErr } = await supabase.from('test_texts').upsert(texts);
  if (tErr) return errorState('auth.errors.generic', v);
  if (p.titleKk)
    await supabase
      .from('test_texts')
      .upsert({ test_id: id, locale: 'kk', title: p.titleKk, description: p.descriptionKk });
  else await supabase.from('test_texts').delete().eq('test_id', id).eq('locale', 'kk');
  revalidatePath('/[locale]/studio/tests', 'page');
  if (!v.testId) redirect(`/${locale}/studio/tests/${id}`);
  return { status: 'success', messageKey: 'studio.formula.saved', values: v };
}

export async function setTestStatus(_prev: FormState, form: FormData): Promise<FormState> {
  const id = String(form.get('testId') ?? '');
  const status = String(form.get('status') ?? '');
  if (!['draft', 'in_review', 'published'].includes(status) || !(await actingStaff()))
    return errorState('auth.errors.forbidden');
  const supabase = await createUserClient();
  if (status !== 'draft') {
    const { data: test } = await supabase.from('tests').select('*').eq('id', id).single();
    if (!test) return errorState('auth.errors.generic');
    const missing = await missingLevels(await scopeTopicIds(test), parseCounts(test.counts));
    if (missing.length) return errorState('studio.tests.missingLevels');
  }
  const { error } = await supabase.rpc('set_test_status', {
    p_test: id,
    p_status: status as 'draft' | 'in_review' | 'published',
  });
  if (error)
    return errorState(error.code === '42501' ? 'auth.errors.forbidden' : 'studio.errors.workflow');
  revalidatePath(`/[locale]/studio/tests/${id}`, 'page');
  return { status: 'success', messageKey: `studio.formula.status.${status}` };
}
