'use server';

import { newTopicSchema, topicDraftSchema } from '@knj/content-schema';
import { isLocale } from '@knj/i18n';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { renderMarkdown } from '@/lib/content/markdown';
import { createUserClient } from '@/lib/supabase/server';
import { audit } from '@/server/audit';
import { errorState, fromZodError, readFields, type FormState } from '@/features/forms/form-state';
import { actingReviewer, actingStaff, localeOf } from './guard';

/** The database refuses to publish unchecked automatic drafts (see mark_content_reviewed). */
const isAiDraftBlock = (e: { message?: string } | null) =>
  Boolean(e?.message?.includes('automatically prepared'));

const DRAFT_FIELDS = [
  'title',
  'summary',
  'objectives',
  'theory',
  'mistakes',
  'isMachineTranslation',
] as const;

function contentLocale(form: FormData) {
  const v = form.get('contentLocale');
  return typeof v === 'string' && isLocale(v) ? v : null;
}

export async function createTopic(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = localeOf(form);
  const values = readFields(form, ['slug', 'subject', 'title'] as const);
  const user = await actingStaff();
  if (!user) return errorState('auth.errors.forbidden');
  const parsed = newTopicSchema.safeParse(values);
  if (!parsed.success) return fromZodError(parsed.error, values);

  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from('topics')
    .insert({ slug: parsed.data.slug, subject_code: parsed.data.subject, created_by: user.id })
    .select('id')
    .single();
  if (error) {
    if (error.code === '23505')
      return {
        ...errorState('validation.fixErrors', values),
        fieldErrors: { slug: 'studio.errors.slugTaken' },
      };
    return errorState('auth.errors.generic', values);
  }
  const { error: draftError } = await supabase
    .from('topic_drafts')
    .insert({ topic_id: data.id, locale: 'ru', title: parsed.data.title });
  if (draftError) return errorState('auth.errors.generic', values);
  await audit(user.id, 'topic.created', 'topic', data.id, { slug: parsed.data.slug });
  redirect(`/${locale}/studio/topics/${data.id}?lang=ru`);
}

export async function saveTopicDraft(_prev: FormState, form: FormData): Promise<FormState> {
  const topicId = String(form.get('topicId') ?? '');
  const lang = contentLocale(form);
  const values = readFields(form, DRAFT_FIELDS);
  if (!(await actingStaff()) || !lang) return errorState('auth.errors.forbidden');
  const parsed = topicDraftSchema.safeParse(values);
  if (!parsed.success) return fromZodError(parsed.error, values);

  const supabase = await createUserClient();
  const row = {
    title: parsed.data.title,
    summary: parsed.data.summary,
    objectives: parsed.data.objectives,
    theory: parsed.data.theory,
    mistakes: parsed.data.mistakes,
    is_machine_translation: parsed.data.isMachineTranslation,
  };
  const { data: existing } = await supabase
    .from('topic_drafts')
    .select('topic_id')
    .eq('topic_id', topicId)
    .eq('locale', lang)
    .maybeSingle();
  const { error } = existing
    ? await supabase.from('topic_drafts').update(row).eq('topic_id', topicId).eq('locale', lang)
    : await supabase.from('topic_drafts').insert({ topic_id: topicId, locale: lang, ...row });
  if (error) return errorState('auth.errors.generic', values);

  revalidatePath(`/[locale]/studio/topics/${topicId}`, 'page');
  const { mathErrors } = await renderMarkdown(parsed.data.theory);
  return mathErrors.length
    ? { status: 'error', messageKey: 'studio.topic.savedWithMathErrors', values }
    : { status: 'success', messageKey: 'studio.topic.saved', values };
}

async function workflow(
  form: FormData,
  run: (topicId: string, lang: 'ru' | 'kk') => Promise<FormState>,
) {
  const topicId = String(form.get('topicId') ?? '');
  const lang = contentLocale(form);
  if (!lang) return errorState('auth.errors.forbidden');
  const result = await run(topicId, lang);
  revalidatePath(`/[locale]/studio/topics/${topicId}`, 'page');
  revalidatePath('/[locale]/studio', 'page');
  return result;
}

export async function submitTopic(_prev: FormState, form: FormData): Promise<FormState> {
  return workflow(form, async (topicId, lang) => {
    if (!(await actingStaff())) return errorState('auth.errors.forbidden');
    const supabase = await createUserClient();
    const { data: draft } = await supabase
      .from('topic_drafts')
      .select('theory')
      .eq('topic_id', topicId)
      .eq('locale', lang)
      .single();
    if (!draft?.theory.trim()) return errorState('studio.errors.emptyTheory');
    if ((await renderMarkdown(draft.theory)).mathErrors.length)
      return errorState('studio.errors.mathErrors');
    const { error } = await supabase.rpc('submit_topic_draft', {
      p_topic: topicId,
      p_locale: lang,
    });
    return error
      ? errorState('studio.errors.workflow')
      : { status: 'success', messageKey: 'studio.topic.submitted' };
  });
}

export async function publishTopic(_prev: FormState, form: FormData): Promise<FormState> {
  return workflow(form, async (topicId, lang) => {
    if (!(await actingReviewer())) return errorState('auth.errors.forbidden');
    const supabase = await createUserClient();
    const { data: draft } = await supabase
      .from('topic_drafts')
      .select('theory')
      .eq('topic_id', topicId)
      .eq('locale', lang)
      .single();
    if (!draft || (await renderMarkdown(draft.theory)).mathErrors.length)
      return errorState('studio.errors.mathErrors');
    const { error } = await supabase.rpc('publish_topic', { p_topic: topicId, p_locale: lang });
    if (error)
      return errorState(
        isAiDraftBlock(error) ? 'studio.aiDraft.blocked' : 'studio.errors.workflow',
      );
    revalidatePath('/[locale]/topics/[slug]', 'page');
    return { status: 'success', messageKey: 'studio.topic.published' };
  });
}

export async function requestChanges(_prev: FormState, form: FormData): Promise<FormState> {
  return workflow(form, async (topicId, lang) => {
    if (!(await actingReviewer())) return errorState('auth.errors.forbidden');
    const note = String(form.get('note') ?? '').trim();
    if (!note)
      return {
        ...errorState('validation.fixErrors'),
        fieldErrors: { note: 'validation.required' },
      };
    const supabase = await createUserClient();
    const { error } = await supabase.rpc('request_topic_changes', {
      p_topic: topicId,
      p_locale: lang,
      p_note: note,
    });
    return error
      ? errorState('studio.errors.workflow')
      : { status: 'success', messageKey: 'studio.topic.changesRequested' };
  });
}

export async function unpublishTopic(_prev: FormState, form: FormData): Promise<FormState> {
  return workflow(form, async (topicId, lang) => {
    if (!(await actingReviewer())) return errorState('auth.errors.forbidden');
    const supabase = await createUserClient();
    const { error } = await supabase.rpc('unpublish_topic', { p_topic: topicId, p_locale: lang });
    if (error)
      return errorState(
        isAiDraftBlock(error) ? 'studio.aiDraft.blocked' : 'studio.errors.workflow',
      );
    revalidatePath('/[locale]/topics/[slug]', 'page');
    return { status: 'success', messageKey: 'studio.topic.unpublished' };
  });
}

/** Single entry point for the workflow panel, so its status message survives re-rendering. */
export async function runTopicWorkflow(prev: FormState, form: FormData): Promise<FormState> {
  switch (form.get('intent')) {
    case 'submit':
      return submitTopic(prev, form);
    case 'publish':
      return publishTopic(prev, form);
    case 'requestChanges':
      return requestChanges(prev, form);
    case 'unpublish':
      return unpublishTopic(prev, form);
    default:
      return errorState('auth.errors.forbidden');
  }
}
