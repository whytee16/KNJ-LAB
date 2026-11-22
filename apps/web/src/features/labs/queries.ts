import 'server-only';
import type { Locale } from '@knj/i18n';
import { labModel, parseParams, type Values } from '@knj/physics';
import type { Difficulty } from '@knj/task-engine';
import { pickLocale } from '@/features/content/queries';
import { createUserClient } from '@/lib/supabase/server';

export interface LabListItem {
  id: string;
  code: string;
  subject: string;
  grade: number;
  isFreeDemo: boolean;
  title: string;
  goal: string;
}

const LIST_COLUMNS =
  'id, code, subject_code, grade_from, is_free_demo, sort, lab_translations(locale, title, goal)';

type ListRow = {
  id: string;
  code: string;
  subject_code: string;
  grade_from: number;
  is_free_demo: boolean;
  lab_translations: { locale: string; title: string; goal: string }[];
};

function toItem(row: ListRow, locale: Locale): LabListItem | null {
  const text = pickLocale(row.lab_translations, locale);
  // A lab is listed only when it has texts and a model in code.
  if (!text || !labModel(row.code)) return null;
  return {
    id: row.id,
    code: row.code,
    subject: row.subject_code,
    grade: row.grade_from,
    isFreeDemo: row.is_free_demo,
    title: text.title,
    goal: text.goal,
  };
}

/** Published labs (RLS hides drafts from everyone but staff; drafts are filtered here too). */
export async function listLabs(
  locale: Locale,
  opts: { topicId?: string } = {},
): Promise<LabListItem[]> {
  const supabase = await createUserClient();
  let ids: string[] | null = null;
  if (opts.topicId) {
    const { data } = await supabase
      .from('lab_topics')
      .select('lab_id')
      .eq('topic_id', opts.topicId);
    ids = (data ?? []).map((r) => r.lab_id);
    if (!ids.length) return [];
  }
  let query = supabase.from('labs').select(LIST_COLUMNS).eq('status', 'published');
  if (ids) query = query.in('id', ids);
  const { data, error } = await query.order('sort').order('code');
  if (error) throw new Error(`labs query failed: ${error.message}`);
  return (data ?? [])
    .map((r) => toItem(r as ListRow, locale))
    .filter((x): x is LabListItem => x !== null);
}

export interface LabPageData {
  id: string;
  code: string;
  subject: string;
  grade: number;
  status: 'draft' | 'in_review' | 'published';
  isFreeDemo: boolean;
  /** Locale of the texts actually shown (falls back to Russian). */
  locale: Locale;
  title: string;
  goal: string;
  steps: string[];
  hints: string[];
  defaultParams: Values;
  topics: { slug: string; title: string }[];
  questions: { templateId: string; difficulty: Difficulty }[];
}

export async function getLab(code: string, locale: Locale): Promise<LabPageData | null> {
  const model = labModel(code);
  if (!model) return null;
  const supabase = await createUserClient();
  const { data } = await supabase
    .from('labs')
    .select(
      'id, code, subject_code, grade_from, status, is_free_demo, default_params, lab_translations(locale, title, goal, steps, hints), lab_topics(topics(slug, topic_contents(locale, title))), lab_tasks(template_id, position, task_templates(difficulty, status))',
    )
    .eq('code', code)
    .maybeSingle();
  if (!data) return null;
  const text = pickLocale(data.lab_translations, locale);
  if (!text) return null;
  return {
    id: data.id,
    code: data.code,
    subject: data.subject_code,
    grade: data.grade_from,
    status: data.status,
    isFreeDemo: data.is_free_demo,
    locale: text.locale as Locale,
    title: text.title,
    goal: text.goal,
    steps: text.steps,
    hints: text.hints,
    defaultParams: parseParams(model, data.default_params),
    topics: data.lab_topics
      .map((lt) => {
        const title = pickLocale(lt.topics?.topic_contents, locale)?.title;
        return lt.topics && title ? { slug: lt.topics.slug, title } : null;
      })
      .filter((x): x is { slug: string; title: string } => x !== null),
    questions: [...data.lab_tasks]
      .sort((a, b) => a.position - b.position)
      .filter((q) => q.task_templates?.status === 'published')
      .map((q) => ({ templateId: q.template_id, difficulty: q.task_templates!.difficulty })),
  };
}
