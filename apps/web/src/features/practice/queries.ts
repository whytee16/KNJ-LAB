import 'server-only';
import { DIFFICULTIES, type Difficulty } from '@knj/task-engine';
import { createUserClient } from '@/lib/supabase/server';

/** Published templates per level for a topic (public read through RLS). */
export async function levelCounts(topicId: string): Promise<Record<Difficulty, number>> {
  const supabase = await createUserClient();
  const { data } = await supabase
    .from('task_templates')
    .select('difficulty')
    .eq('topic_id', topicId)
    .eq('status', 'published');
  const counts = Object.fromEntries(DIFFICULTIES.map((d) => [d, 0])) as Record<Difficulty, number>;
  for (const row of data ?? []) counts[row.difficulty]++;
  return counts;
}
