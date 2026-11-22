'use server';

import {
  DIFFICULTIES,
  EditorError,
  specFromForm,
  TASK_TYPES,
  textsFromForm,
  validateTemplate,
  type Difficulty,
  type EngineLocale,
  type SpecForm,
  type TaskTexts,
  type TaskType,
  type TextsForm,
  type ValidationReport,
} from '@knj/task-engine';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { renderMarkdown } from '@/lib/content/markdown';
import { createUserClient } from '@/lib/supabase/server';
import { errorState, readFields, type FormState } from '@/features/forms/form-state';
import { actingStaff, localeOf } from './guard';

/** The database refuses to publish unchecked automatic drafts (see mark_content_reviewed). */
const isAiDraftBlock = (e: { message?: string } | null) =>
  Boolean(e?.message?.includes('automatically prepared'));

const SPEC_FIELDS = [
  'type',
  'params',
  'constraints',
  'answer',
  'decimals',
  'toleranceAbs',
  'tolerancePercent',
  'unit',
  'variables',
  'rangeFrom',
  'rangeTo',
  'correct',
] as const;
const TEXT_FIELDS = ['statement', 'options', 'matches', 'accepted', 'hints', 'solution'] as const;

export interface TaskEditorState extends FormState {
  report?: {
    ok: boolean;
    problems: ValidationReport['problems'];
    samplesHtml: { locale: string; html: string }[];
  };
}

function readTexts(form: FormData, lang: EngineLocale): TextsForm {
  const raw = readFields(
    form,
    TEXT_FIELDS.map((f) => `${f}_${lang}`) as `${(typeof TEXT_FIELDS)[number]}_${EngineLocale}`[],
  );
  return Object.fromEntries(
    TEXT_FIELDS.map((f) => [f, raw[`${f}_${lang}`]]),
  ) as unknown as TextsForm;
}

function allValues(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === 'string') out[k] = v;
  return out;
}

async function withReport(
  spec: unknown,
  texts: Partial<Record<EngineLocale, TaskTexts>>,
): Promise<TaskEditorState['report']> {
  const r = validateTemplate(spec, texts, 50);
  const samplesHtml = await Promise.all(
    r.samples.map(async (s) => ({
      locale: s.locale,
      html: (await renderMarkdown(s.statement)).html,
    })),
  );
  return { ok: r.ok, problems: r.problems, samplesHtml };
}

/** Parses the editor form; returns field errors as i18n keys. */
function parseForm(form: FormData): {
  spec?: ReturnType<typeof specFromForm>;
  texts?: Partial<Record<EngineLocale, TaskTexts>>;
  error?: TaskEditorState;
} {
  const values = allValues(form);
  try {
    const spec = specFromForm(readFields(form, SPEC_FIELDS) as unknown as SpecForm);
    const texts: Partial<Record<EngineLocale, TaskTexts>> = {
      ru: textsFromForm(readTexts(form, 'ru')),
    };
    const kk = readTexts(form, 'kk');
    if (kk.statement.trim()) texts.kk = textsFromForm(kk);
    return { spec, texts };
  } catch (e) {
    if (e instanceof EditorError) {
      return {
        error: {
          ...errorState('validation.fixErrors', values),
          fieldErrors: {
            [e.field]: e.line ? `studio.task.errors.${e.code}Line` : `studio.task.errors.${e.code}`,
          },
          values: { ...values, errorLine: String(e.line ?? '') },
        },
      };
    }
    throw e;
  }
}

export async function saveTaskTemplate(
  _prev: TaskEditorState,
  form: FormData,
): Promise<TaskEditorState> {
  const locale = localeOf(form);
  const user = await actingStaff();
  if (!user) return errorState('auth.errors.forbidden');
  const values = allValues(form);
  const id = values.templateId;
  const topicId = values.topicId ?? '';
  const difficulty = values.difficulty as Difficulty;
  const type = values.type as TaskType;
  if (!DIFFICULTIES.includes(difficulty) || !TASK_TYPES.includes(type) || !topicId) {
    return {
      ...errorState('validation.fixErrors', values),
      fieldErrors: { topicId: 'validation.required' },
    };
  }
  const parsed = parseForm(form);
  if (parsed.error) return parsed.error;
  const { spec, texts } = parsed as Required<typeof parsed>;

  const supabase = await createUserClient();
  let templateId = id;
  if (!templateId) {
    const { data, error } = await supabase
      .from('task_templates')
      .insert({ topic_id: topicId, type, difficulty, spec: spec as never, created_by: user.id })
      .select('id')
      .single();
    if (error) return errorState('auth.errors.generic', values);
    templateId = data.id;
  } else {
    const { data, error } = await supabase
      .from('task_templates')
      .update({ topic_id: topicId, difficulty, spec: spec as never })
      .eq('id', templateId)
      .select('id');
    if (error) return errorState('auth.errors.generic', values);
    if (!data?.length) return errorState('studio.errors.locked', values);
  }
  for (const lang of ['ru', 'kk'] as const) {
    const t = texts[lang];
    const { error } = t
      ? await supabase
          .from('task_template_texts')
          .upsert({ template_id: templateId, locale: lang, texts: t as never })
      : await supabase
          .from('task_template_texts')
          .delete()
          .eq('template_id', templateId)
          .eq('locale', lang);
    if (error) return errorState('auth.errors.generic', values);
  }
  revalidatePath('/[locale]/studio/tasks', 'page');
  if (!id) redirect(`/${locale}/studio/tasks/${templateId}`);
  const report = await withReport(spec, texts);
  return {
    status: report?.ok ? 'success' : 'error',
    messageKey: report?.ok ? 'studio.task.saved' : 'studio.task.savedWithProblems',
    values,
    report,
  };
}

/** Runs the stored template over 50 seeds (studio "check" button and publishing gate). */
export async function checkStoredTemplate(templateId: string): Promise<TaskEditorState['report']> {
  const supabase = await createUserClient();
  const { data } = await supabase
    .from('task_templates')
    .select('spec, task_template_texts(locale, texts)')
    .eq('id', templateId)
    .single();
  if (!data) return { ok: false, problems: [{ code: 'not_found' }], samplesHtml: [] };
  const texts = Object.fromEntries(data.task_template_texts.map((t) => [t.locale, t.texts]));
  return withReport(data.spec, texts as Partial<Record<EngineLocale, TaskTexts>>);
}

export async function setTaskTemplateStatus(
  _prev: TaskEditorState,
  form: FormData,
): Promise<TaskEditorState> {
  const id = String(form.get('templateId') ?? '');
  const status = String(form.get('status') ?? '');
  if (!['draft', 'in_review', 'published'].includes(status))
    return errorState('auth.errors.forbidden');
  if (!(await actingStaff())) return errorState('auth.errors.forbidden');
  if (status !== 'draft') {
    const report = await checkStoredTemplate(id);
    if (!report?.ok) return { ...errorState('studio.task.blocked'), report };
  }
  const supabase = await createUserClient();
  const { error } = await supabase.rpc('set_task_template_status', {
    p_template: id,
    p_status: status as 'draft' | 'in_review' | 'published',
  });
  if (error)
    return errorState(
      error.code === '42501'
        ? 'auth.errors.forbidden'
        : isAiDraftBlock(error)
          ? 'studio.aiDraft.blocked'
          : 'studio.errors.workflow',
    );
  revalidatePath(`/[locale]/studio/tasks/${id}`, 'page');
  revalidatePath('/[locale]/studio/tasks', 'page');
  return { status: 'success', messageKey: `studio.formula.status.${status}` };
}

export async function deleteTaskTemplate(
  _prev: TaskEditorState,
  form: FormData,
): Promise<TaskEditorState> {
  const locale = localeOf(form);
  const id = String(form.get('templateId') ?? '');
  if (!(await actingStaff())) return errorState('auth.errors.forbidden');
  const supabase = await createUserClient();
  const { data, error } = await supabase.from('task_templates').delete().eq('id', id).select('id');
  if (error?.code === '23503') return errorState('studio.task.inUse');
  if (error || !data?.length) return errorState('studio.errors.locked');
  redirect(`/${locale}/studio/tasks`);
}
