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

export interface BundleState extends FormState {
  /** How many texts were confirmed or published by this action. */
  count?: number;
}

async function labBundle(labId: string) {
  const supabase = await createUserClient();
  const { data: lab } = await supabase
    .from('labs')
    .select(
      'id, status, lab_translations(locale, content_origin), lab_tasks(template_id, task_templates(id, status, content_origin))',
    )
    .eq('id', labId)
    .maybeSingle();
  return { supabase, lab };
}

/**
 * Confirms the teacher's check for the lab texts and every question template of the lab in one go.
 * Each confirmation goes through mark_content_reviewed (reviewer + aal2, audited one by one).
 */
export async function markLabBundleReviewed(
  _prev: BundleState,
  form: FormData,
): Promise<BundleState> {
  if (!(await actingReviewer())) return errorState('auth.errors.forbidden');
  const labId = String(form.get('labId') ?? '');
  if (!z.uuid().safeParse(labId).success) return errorState('auth.errors.generic');
  const { supabase, lab } = await labBundle(labId);
  if (!lab) return errorState('auth.errors.generic');
  let count = 0;
  for (const t of lab.lab_translations.filter((x) => x.content_origin === 'ai_draft')) {
    const { error } = await supabase.rpc('mark_content_reviewed', {
      p_kind: 'lab',
      p_id: lab.id,
      p_locale: t.locale,
    });
    if (error)
      return errorState(error.code === '42501' ? 'auth.errors.forbidden' : 'auth.errors.generic');
    count++;
  }
  for (const task of lab.lab_tasks) {
    if (task.task_templates?.content_origin !== 'ai_draft') continue;
    const { error } = await supabase.rpc('mark_content_reviewed', {
      p_kind: 'template',
      p_id: task.template_id,
    });
    if (error)
      return errorState(error.code === '42501' ? 'auth.errors.forbidden' : 'auth.errors.generic');
    count++;
  }
  revalidatePath('/[locale]/studio', 'layout');
  return { status: 'success', messageKey: 'studio.aiDraft.bundleConfirmed', count };
}

/** Publishes the lab's question templates, then the lab. The database refuses anything unchecked. */
export async function publishLabBundle(_prev: BundleState, form: FormData): Promise<BundleState> {
  if (!(await actingReviewer())) return errorState('auth.errors.forbidden');
  const labId = String(form.get('labId') ?? '');
  if (!z.uuid().safeParse(labId).success) return errorState('auth.errors.generic');
  const { supabase, lab } = await labBundle(labId);
  if (!lab) return errorState('auth.errors.generic');
  let count = 0;
  for (const task of lab.lab_tasks) {
    if (task.task_templates?.status === 'published') continue;
    const { error } = await supabase.rpc('set_task_template_status', {
      p_template: task.template_id,
      p_status: 'published',
    });
    if (error)
      return errorState(
        error.message?.includes('automatically prepared')
          ? 'studio.aiDraft.blocked'
          : 'studio.errors.workflow',
      );
    count++;
  }
  if (lab.status !== 'published') {
    const { error } = await supabase.rpc('set_lab_status', {
      p_lab: lab.id,
      p_status: 'published',
    });
    if (error)
      return errorState(
        error.message?.includes('automatically prepared')
          ? 'studio.aiDraft.blocked'
          : 'studio.labs.goalRequired',
      );
    count++;
  }
  revalidatePath('/[locale]/studio', 'layout');
  revalidatePath('/[locale]/labs', 'layout');
  return { status: 'success', messageKey: 'studio.aiDraft.bundlePublished', count };
}

async function topicBundle(topicId: string) {
  const supabase = await createUserClient();
  const [{ data: draft }, { data: templates }] = await Promise.all([
    supabase
      .from('topic_drafts')
      .select('status, content_origin')
      .eq('topic_id', topicId)
      .eq('locale', 'ru')
      .maybeSingle(),
    supabase.from('task_templates').select('id, status, content_origin').eq('topic_id', topicId),
  ]);
  return { supabase, draft, templates: templates ?? [] };
}

/** Confirms the teacher's check for the topic text (RU) and every task template of the topic. */
export async function markTopicBundleReviewed(
  _prev: BundleState,
  form: FormData,
): Promise<BundleState> {
  if (!(await actingReviewer())) return errorState('auth.errors.forbidden');
  const topicId = String(form.get('topicId') ?? '');
  if (!z.uuid().safeParse(topicId).success) return errorState('auth.errors.generic');
  const { supabase, draft, templates } = await topicBundle(topicId);
  let count = 0;
  if (draft?.content_origin === 'ai_draft') {
    const { error } = await supabase.rpc('mark_content_reviewed', {
      p_kind: 'topic',
      p_id: topicId,
      p_locale: 'ru',
    });
    if (error)
      return errorState(error.code === '42501' ? 'auth.errors.forbidden' : 'auth.errors.generic');
    count++;
  }
  for (const t of templates.filter((x) => x.content_origin === 'ai_draft')) {
    const { error } = await supabase.rpc('mark_content_reviewed', {
      p_kind: 'template',
      p_id: t.id,
    });
    if (error)
      return errorState(error.code === '42501' ? 'auth.errors.forbidden' : 'auth.errors.generic');
    count++;
  }
  revalidatePath('/[locale]/studio', 'layout');
  return { status: 'success', messageKey: 'studio.aiDraft.bundleConfirmed', count };
}

/** Publishes the topic (RU: submit → publish) and all its task templates; unchecked drafts are refused. */
export async function publishTopicBundle(_prev: BundleState, form: FormData): Promise<BundleState> {
  if (!(await actingReviewer())) return errorState('auth.errors.forbidden');
  const topicId = String(form.get('topicId') ?? '');
  if (!z.uuid().safeParse(topicId).success) return errorState('auth.errors.generic');
  const { supabase, draft, templates } = await topicBundle(topicId);
  const blocked = (e: { message?: string }) =>
    errorState(
      e.message?.includes('automatically prepared')
        ? 'studio.aiDraft.blocked'
        : 'studio.errors.workflow',
    );
  let count = 0;
  for (const t of templates.filter((x) => x.status !== 'published')) {
    const { error } = await supabase.rpc('set_task_template_status', {
      p_template: t.id,
      p_status: 'published',
    });
    if (error) return blocked(error);
    count++;
  }
  if (draft && draft.status !== 'approved') {
    if (draft.status === 'draft') {
      const { error } = await supabase.rpc('submit_topic_draft', {
        p_topic: topicId,
        p_locale: 'ru',
      });
      if (error) return blocked(error);
    }
    const { error } = await supabase.rpc('publish_topic', { p_topic: topicId, p_locale: 'ru' });
    if (error) return blocked(error);
    count++;
  }
  revalidatePath('/[locale]/studio', 'layout');
  revalidatePath('/[locale]/topics/[slug]', 'page');
  return { status: 'success', messageKey: 'studio.aiDraft.topicBundlePublished', count };
}
