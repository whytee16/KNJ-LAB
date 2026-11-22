import 'server-only';
import { DIFFICULTIES, type Difficulty } from '@knj/task-engine';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/supabase/database.types';

export type TestRow = Database['public']['Tables']['tests']['Row'];

/** Topics covered by a test's scope (default curriculum for quarter/grade scopes). */
export async function scopeTopicIds(
  test: Pick<TestRow, 'scope' | 'topic_id' | 'section_id' | 'subject_code' | 'grade' | 'quarter'>,
): Promise<string[]> {
  const admin = createAdminClient();
  if (test.scope === 'topic') return test.topic_id ? [test.topic_id] : [];
  if (test.scope === 'subject') {
    const { data } = await admin.from('topics').select('id').eq('subject_code', test.subject_code!);
    return (data ?? []).map((t) => t.id);
  }
  let sections = admin
    .from('curriculum_sections')
    .select('id, curricula!inner(is_default)')
    .eq('curricula.is_default', true);
  if (test.scope === 'section') sections = sections.eq('id', test.section_id!);
  else {
    sections = sections.eq('subject_code', test.subject_code!).eq('grade', test.grade!);
    if (test.scope === 'quarter') sections = sections.eq('quarter', test.quarter!);
  }
  const { data: secs } = await sections;
  const ids = (secs ?? []).map((s) => s.id);
  if (!ids.length) return [];
  const { data: links } = await admin
    .from('curriculum_topics')
    .select('topic_id')
    .in('section_id', ids);
  return [...new Set((links ?? []).map((l) => l.topic_id))];
}

export type Counts = Partial<Record<Difficulty, number>>;

export function parseCounts(raw: unknown): Counts {
  const out: Counts = {};
  if (raw && typeof raw === 'object') {
    for (const d of DIFFICULTIES) {
      const n = Number((raw as Record<string, unknown>)[d] ?? 0);
      if (Number.isInteger(n) && n > 0) out[d] = Math.min(n, 50);
    }
  }
  return out;
}

/** Levels the test asks for that have no published templates in its scope. */
export async function missingLevels(topicIds: string[], counts: Counts): Promise<Difficulty[]> {
  const wanted = (Object.keys(counts) as Difficulty[]).filter((d) => (counts[d] ?? 0) > 0);
  if (!topicIds.length) return wanted;
  const { data } = await createAdminClient()
    .from('task_templates')
    .select('difficulty')
    .in('topic_id', topicIds)
    .eq('status', 'published');
  const have = new Set((data ?? []).map((r) => r.difficulty));
  return wanted.filter((d) => !have.has(d));
}

export function needsPass(counts: Counts): boolean {
  return Object.entries(counts).some(([d, n]) => d !== 'easy' && (n ?? 0) > 0);
}
