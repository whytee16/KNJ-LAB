import 'server-only';
import { checkAnswer, type Answer, type Difficulty, type Expected } from '@knj/task-engine';
import type { Locale } from '@knj/i18n';
import { createAdminClient } from '@/lib/supabase/admin';
import { issueTask } from '@/features/practice/engine-server';
import { parseCounts, scopeTopicIds } from './scope';

/** Grace period after the deadline for the auto-submit request to arrive. */
const GRACE_MS = 60_000;

/** True when an exam's deadline (plus the grace period) has passed. */
export function isPastDeadline(deadline: string | null): boolean {
  return deadline !== null && Date.now() > new Date(deadline).getTime() + GRACE_MS;
}

/** Unfinished attempt of this test for the student, or a new one with all items issued. */
export async function startOrResumeTest(
  studentId: string,
  testId: string,
  locale: Locale,
): Promise<string> {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('attempts')
    .select('id')
    .eq('student_id', studentId)
    .eq('test_id', testId)
    .is('finished_at', null)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: test, error } = await admin
    .from('tests')
    .select('*')
    .eq('id', testId)
    .eq('status', 'published')
    .single();
  if (error || !test) throw new Error('test not available');
  const topicIds = await scopeTopicIds(test);
  const counts = parseCounts(test.counts);

  const deadline =
    test.mode === 'exam' && test.time_limit_s
      ? new Date(Date.now() + test.time_limit_s * 1000).toISOString()
      : null;
  const { data: attempt, error: aErr } = await admin
    .from('attempts')
    .insert({ student_id: studentId, kind: 'test', test_id: testId, deadline_at: deadline })
    .select('id')
    .single();
  if (aErr) throw new Error(`attempt create failed: ${aErr.message}`);

  let position = 0;
  try {
    for (const [difficulty, n] of Object.entries(counts) as [Difficulty, number][]) {
      for (let i = 0; i < n; i++) {
        position += 1;
        await issueTask({
          studentId,
          attemptId: attempt.id,
          topicIds,
          difficulty,
          locale,
          position,
        });
      }
    }
  } catch (e) {
    // Do not leave a half-built test behind (e.g. a paid level without a pass).
    await admin.from('attempts').delete().eq('id', attempt.id);
    throw e;
  }
  return attempt.id;
}

/**
 * Grades and closes an attempt exactly once. Answers arriving after the deadline (plus grace)
 * are ignored; missing or unreadable answers score zero.
 */
export async function finishTest(
  studentId: string,
  attemptId: string,
  answers: Record<string, Answer>,
): Promise<'finished' | 'already' | 'not_found'> {
  const admin = createAdminClient();
  const { data: attempt } = await admin
    .from('attempts')
    .select('id, student_id, deadline_at, finished_at, kind')
    .eq('id', attemptId)
    .maybeSingle();
  if (!attempt || attempt.student_id !== studentId || attempt.kind !== 'test') return 'not_found';
  if (attempt.finished_at) return 'already';
  const late = isPastDeadline(attempt.deadline_at);

  // Claim the attempt first so concurrent submissions cannot grade twice.
  const { data: claimed } = await admin
    .from('attempts')
    .update({ finished_at: new Date().toISOString() })
    .eq('id', attemptId)
    .is('finished_at', null)
    .select('id');
  if (!claimed?.length) return 'already';

  const { data: items } = await admin
    .from('task_instances')
    .select('id, task_instance_keys(expected), attempt_answers(id)')
    .eq('attempt_id', attemptId)
    .order('position');
  let score = 0;
  const rows = [];
  for (const item of items ?? []) {
    if (item.attempt_answers) continue;
    const expected = item.task_instance_keys?.expected as unknown as Expected | undefined;
    const given = late ? '' : (answers[item.id] ?? '');
    const result = expected
      ? checkAnswer(expected, given)
      : { status: 'invalid' as const, score: 0 };
    const correct = result.status === 'correct';
    const s = result.status === 'invalid' ? 0 : result.score;
    score += s;
    rows.push({
      attempt_id: attemptId,
      instance_id: item.id,
      answer: given as never,
      status: correct ? ('correct' as const) : ('wrong' as const),
      score: Math.round(s * 1000) / 1000,
      idempotency_key: crypto.randomUUID(),
    });
  }
  if (rows.length) {
    const { error } = await admin.from('attempt_answers').insert(rows);
    if (error) throw new Error(`grading failed: ${error.message}`);
  }
  await admin
    .from('attempts')
    .update({ score: Math.round(score * 100) / 100, max_score: (items ?? []).length })
    .eq('id', attemptId);
  return 'finished';
}
