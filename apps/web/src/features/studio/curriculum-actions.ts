'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createUserClient } from '@/lib/supabase/server';
import { audit } from '@/server/audit';
import { errorState, readFields, type FormState } from '@/features/forms/form-state';
import { actingReviewer } from './guard';

const done = (key: string): FormState => {
  revalidatePath('/[locale]/studio/curriculum', 'page');
  revalidatePath('/[locale]/learn/[subject]/[grade]', 'page');
  return { status: 'success', messageKey: key };
};

const sectionSchema = z.object({
  curriculumId: z.uuid(),
  subject: z.enum(['algebra', 'geometry', 'physics']),
  grade: z.coerce.number().int().min(7).max(11),
  quarter: z.coerce.number().int().min(1).max(4),
  titleRu: z.string().trim().min(1, 'validation.required').max(150, 'validation.tooLong'),
  titleKk: z.string().trim().max(150, 'validation.tooLong'),
});

export async function addSection(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await actingReviewer();
  if (!user) return errorState('auth.errors.forbidden');
  const values = readFields(form, [
    'curriculumId',
    'subject',
    'grade',
    'quarter',
    'titleRu',
    'titleKk',
  ] as const);
  const parsed = sectionSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ...errorState('validation.fixErrors', values),
      fieldErrors: { titleRu: parsed.error.issues[0]!.message },
    };
  }
  const p = parsed.data;
  const supabase = await createUserClient();
  const { count } = await supabase
    .from('curriculum_sections')
    .select('id', { count: 'exact', head: true })
    .eq('curriculum_id', p.curriculumId)
    .eq('subject_code', p.subject)
    .eq('grade', p.grade)
    .eq('quarter', p.quarter);
  const { data, error } = await supabase
    .from('curriculum_sections')
    .insert({
      curriculum_id: p.curriculumId,
      subject_code: p.subject,
      grade: p.grade,
      quarter: p.quarter,
      sort: count ?? 0,
    })
    .select('id')
    .single();
  if (error) return errorState('auth.errors.generic', values);
  const titles: { section_id: string; locale: 'ru' | 'kk'; title: string }[] = [
    { section_id: data.id, locale: 'ru', title: p.titleRu },
  ];
  if (p.titleKk) titles.push({ section_id: data.id, locale: 'kk', title: p.titleKk });
  const { error: tErr } = await supabase.from('curriculum_section_translations').insert(titles);
  if (tErr) return errorState('auth.errors.generic', values);
  await audit(user.id, 'curriculum.section_added', 'curriculum_section', data.id, {
    subject: p.subject,
    grade: p.grade,
    quarter: p.quarter,
  });
  return done('studio.curriculum.sectionAdded');
}

export async function renameSection(_prev: FormState, form: FormData): Promise<FormState> {
  if (!(await actingReviewer())) return errorState('auth.errors.forbidden');
  const { sectionId, titleRu, titleKk } = readFields(form, [
    'sectionId',
    'titleRu',
    'titleKk',
  ] as const);
  if (!titleRu.trim() || titleRu.length > 150 || titleKk.length > 150) {
    return {
      ...errorState('validation.fixErrors'),
      fieldErrors: { titleRu: 'validation.required' },
    };
  }
  const supabase = await createUserClient();
  const rows: { section_id: string; locale: 'ru' | 'kk'; title: string }[] = [
    { section_id: sectionId, locale: 'ru', title: titleRu.trim() },
  ];
  if (titleKk.trim()) rows.push({ section_id: sectionId, locale: 'kk', title: titleKk.trim() });
  const { error } = await supabase.from('curriculum_section_translations').upsert(rows);
  if (!titleKk.trim()) {
    await supabase
      .from('curriculum_section_translations')
      .delete()
      .eq('section_id', sectionId)
      .eq('locale', 'kk');
  }
  return error ? errorState('auth.errors.generic') : done('studio.curriculum.saved');
}

export async function deleteSection(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await actingReviewer();
  if (!user) return errorState('auth.errors.forbidden');
  const sectionId = String(form.get('sectionId') ?? '');
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from('curriculum_sections')
    .delete()
    .eq('id', sectionId)
    .select('id');
  if (error || !data?.length) return errorState('auth.errors.generic');
  await audit(user.id, 'curriculum.section_deleted', 'curriculum_section', sectionId);
  return done('studio.curriculum.saved');
}

/** Swaps sort with the neighbour above/below inside the same quarter. */
export async function moveSection(_prev: FormState, form: FormData): Promise<FormState> {
  if (!(await actingReviewer())) return errorState('auth.errors.forbidden');
  const { sectionId, direction } = readFields(form, ['sectionId', 'direction'] as const);
  const supabase = await createUserClient();
  const { data: s } = await supabase
    .from('curriculum_sections')
    .select('*')
    .eq('id', sectionId)
    .single();
  if (!s) return errorState('auth.errors.generic');
  const { data: siblings } = await supabase
    .from('curriculum_sections')
    .select('id, sort')
    .eq('curriculum_id', s.curriculum_id)
    .eq('subject_code', s.subject_code)
    .eq('grade', s.grade)
    .eq('quarter', s.quarter)
    .order('sort')
    .order('created_at');
  const list = siblings ?? [];
  const i = list.findIndex((x) => x.id === sectionId);
  const j = direction === 'up' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return { status: 'idle' };
  [list[i], list[j]] = [list[j]!, list[i]!];
  for (const [index, item] of list.entries()) {
    await supabase.from('curriculum_sections').update({ sort: index }).eq('id', item.id);
  }
  return done('studio.curriculum.saved');
}

export async function attachTopic(_prev: FormState, form: FormData): Promise<FormState> {
  if (!(await actingReviewer())) return errorState('auth.errors.forbidden');
  const { sectionId, topicId } = readFields(form, ['sectionId', 'topicId'] as const);
  if (!topicId)
    return {
      ...errorState('validation.fixErrors'),
      fieldErrors: { topicId: 'validation.required' },
    };
  const supabase = await createUserClient();
  const { count } = await supabase
    .from('curriculum_topics')
    .select('topic_id', { count: 'exact', head: true })
    .eq('section_id', sectionId);
  const { error } = await supabase
    .from('curriculum_topics')
    .insert({ section_id: sectionId, topic_id: topicId, sort: count ?? 0 });
  if (error)
    return errorState(
      error.code === '23505' ? 'studio.errors.alreadyAttached' : 'auth.errors.generic',
    );
  return done('studio.curriculum.saved');
}

export async function detachTopic(_prev: FormState, form: FormData): Promise<FormState> {
  if (!(await actingReviewer())) return errorState('auth.errors.forbidden');
  const { sectionId, topicId } = readFields(form, ['sectionId', 'topicId'] as const);
  const supabase = await createUserClient();
  const { error } = await supabase
    .from('curriculum_topics')
    .delete()
    .eq('section_id', sectionId)
    .eq('topic_id', topicId);
  return error ? errorState('auth.errors.generic') : done('studio.curriculum.saved');
}
