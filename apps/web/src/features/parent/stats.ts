import 'server-only';
import type { Locale } from '@knj/i18n';
import { createUserClient } from '@/lib/supabase/server';
import { recentResults } from '@/features/tests/queries';

export interface ChildStats {
  solved: number;
  correctPercent: number;
  lastWeek: number;
  results: { id: string; title: string; score: number; max: number }[];
  labSessions: number;
  labMinutes: number;
}

/** Practice summary of a child, read as the parent (RLS limits it to their own children). */
export async function childStats(studentId: string, locale: Locale): Promise<ChildStats> {
  const supabase = await createUserClient();
  const base = () =>
    supabase
      .from('attempt_answers')
      .select('id, attempts!inner(student_id)', { count: 'exact', head: true })
      .eq('attempts.student_id', studentId);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [{ count: solved }, { count: correct }, { count: lastWeek }, results, { data: labs }] =
    await Promise.all([
      base(),
      base().eq('status', 'correct'),
      base().gte('created_at', weekAgo),
      recentResults(studentId, locale, 3),
      supabase.from('lab_sessions').select('duration_s').eq('student_id', studentId).limit(1000),
    ]);
  return {
    solved: solved ?? 0,
    correctPercent: solved ? Math.round((100 * (correct ?? 0)) / solved) : 0,
    lastWeek: lastWeek ?? 0,
    results,
    labSessions: labs?.length ?? 0,
    labMinutes: Math.round((labs ?? []).reduce((sum, l) => sum + l.duration_s, 0) / 60),
  };
}
