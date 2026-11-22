import 'server-only';
import type { Locale } from '@knj/i18n';
import { pickLocale } from '@/features/content/queries';
import { createUserClient } from '@/lib/supabase/server';
import { needsPass, parseCounts } from './scope';

export interface TestListItem {
  id: string;
  title: string;
  description: string;
  mode: 'practice' | 'exam';
  minutes: number | null;
  items: number;
  paid: boolean;
  scope: string;
  subject: string | null;
  grade: number | null;
}

/** Published tests (public read) with titles in the visitor's locale. */
export async function listPublishedTests(
  locale: Locale,
  filter?: { topicId?: string },
): Promise<TestListItem[]> {
  const supabase = await createUserClient();
  let q = supabase
    .from('tests')
    .select(
      'id, scope, topic_id, subject_code, grade, mode, time_limit_s, counts, test_texts(locale, title, description), topics(subject_code), curriculum_sections(subject_code, grade)',
    )
    .eq('status', 'published')
    .order('published_at', { ascending: false });
  if (filter?.topicId) q = q.eq('scope', 'topic').eq('topic_id', filter.topicId);
  const { data, error } = await q;
  if (error) throw new Error(`tests query failed: ${error.message}`);
  return (data ?? []).flatMap((t) => {
    const text = pickLocale(t.test_texts, locale);
    if (!text) return [];
    const counts = parseCounts(t.counts);
    return [
      {
        id: t.id,
        title: text.title,
        description: text.description,
        mode: t.mode,
        minutes: t.time_limit_s ? Math.round(t.time_limit_s / 60) : null,
        items: Object.values(counts).reduce((a, b) => a + (b ?? 0), 0),
        paid: needsPass(counts),
        scope: t.scope,
        subject:
          t.subject_code ?? t.topics?.subject_code ?? t.curriculum_sections?.subject_code ?? null,
        grade: t.grade ?? t.curriculum_sections?.grade ?? null,
      },
    ];
  });
}

/** Recent finished attempts of a student (RLS: the student or their parent). */
export async function recentResults(studentId: string, locale: Locale, limit = 5) {
  const supabase = await createUserClient();
  const { data } = await supabase
    .from('attempts')
    .select('id, finished_at, score, max_score, tests(test_texts(locale, title))')
    .eq('student_id', studentId)
    .eq('kind', 'test')
    .not('finished_at', 'is', null)
    .order('finished_at', { ascending: false })
    .limit(limit);
  return (data ?? []).map((a) => ({
    id: a.id,
    title: pickLocale(a.tests?.test_texts, locale)?.title ?? '—',
    finishedAt: a.finished_at!,
    score: Number(a.score ?? 0),
    max: Number(a.max_score ?? 0),
  }));
}
