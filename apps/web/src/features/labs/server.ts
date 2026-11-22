import 'server-only';
import type { Locale } from '@knj/i18n';
import type { TaskPrompt } from '@knj/task-engine';
import { issueTask, NoTemplatesError } from '@/features/practice/engine-server';
import { renderPrompt } from '@/features/practice/render';
import type { RenderedPrompt } from '@/features/practice/types';
import { createAdminClient } from '@/lib/supabase/admin';
import { usableQuestions } from './access';
import type { LabPageData } from './queries';

export type LabQuestions =
  | { kind: 'none'; locked: number }
  | { kind: 'start'; total: number; locked: number }
  | {
      kind: 'current';
      total: number;
      answered: number;
      locked: number;
      prompt: RenderedPrompt;
      last: boolean;
    }
  | { kind: 'finished'; total: number; correct: number; locked: number };

async function latestAttempt(studentId: string, labId: string) {
  const { data } = await createAdminClient()
    .from('attempts')
    .select('id, finished_at, score, max_score')
    .eq('student_id', studentId)
    .eq('lab_id', labId)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

/** Id of the student's unfinished question attempt for a lab, if any. */
export async function openLabAttemptId(studentId: string, labId: string): Promise<string | null> {
  const a = await latestAttempt(studentId, labId);
  return a && !a.finished_at ? a.id : null;
}

/**
 * Questions block state. The next question is issued here (as in the trainer): one task per
 * linked template, in the methodologist's order, generated and checked by the task engine.
 */
export async function loadLabQuestions(opts: {
  studentId: string;
  lab: LabPageData;
  hasPass: boolean;
  locale: Locale;
}): Promise<LabQuestions> {
  const { usable, locked } = usableQuestions(opts.lab, opts.hasPass);
  if (!usable.length) return { kind: 'none', locked };
  const attempt = await latestAttempt(opts.studentId, opts.lab.id);
  if (!attempt) return { kind: 'start', total: usable.length, locked };
  if (attempt.finished_at)
    return {
      kind: 'finished',
      total: Number(attempt.max_score ?? 0),
      correct: Number(attempt.score ?? 0),
      locked,
    };

  const admin = createAdminClient();
  const { data: instances } = await admin
    .from('task_instances')
    .select('id, template_id, position, prompt, attempt_answers(id)')
    .eq('attempt_id', attempt.id)
    .order('position');
  const rows = instances ?? [];
  const total = Number(attempt.max_score ?? usable.length);
  const answered = rows.filter((r) => r.attempt_answers).length;
  const pending = rows.find((r) => !r.attempt_answers);
  if (pending)
    return {
      kind: 'current',
      total,
      answered,
      locked,
      last: answered + 1 >= total,
      prompt: await renderPrompt(pending.id, pending.prompt as unknown as TaskPrompt),
    };

  const done = new Set(rows.map((r) => r.template_id));
  const next = usable.find((q) => !done.has(q.templateId));
  if (!next || answered >= total) {
    await finishLabAttempt(attempt.id);
    const fresh = await latestAttempt(opts.studentId, opts.lab.id);
    return { kind: 'finished', total, correct: Number(fresh?.score ?? 0), locked };
  }
  try {
    const id = await issueTask({
      studentId: opts.studentId,
      attemptId: attempt.id,
      templateIds: [next.templateId],
      locale: opts.locale,
      position: rows.length + 1,
    });
    const { data } = await admin.from('task_instances').select('id, prompt').eq('id', id).single();
    return {
      kind: 'current',
      total,
      answered,
      locked,
      last: answered + 1 >= total,
      prompt: await renderPrompt(data!.id, data!.prompt as unknown as TaskPrompt),
    };
  } catch (e) {
    if (e instanceof NoTemplatesError) return { kind: 'none', locked };
    throw e;
  }
}

async function finishLabAttempt(attemptId: string) {
  const admin = createAdminClient();
  const { data: answers } = await admin
    .from('attempt_answers')
    .select('status')
    .eq('attempt_id', attemptId);
  const correct = (answers ?? []).filter((a) => a.status === 'correct').length;
  await admin
    .from('attempts')
    .update({
      finished_at: new Date().toISOString(),
      score: correct,
      max_score: answers?.length ?? 0,
    })
    .eq('id', attemptId)
    .is('finished_at', null);
}

/**
 * After a first-time answer to a lab question: updates the session summary and finishes the
 * attempt when every question has been answered. Called by the server with a verified attempt.
 */
export async function recordLabAnswer(attemptId: string): Promise<void> {
  const admin = createAdminClient();
  const [{ data: attempt }, { data: answers }] = await Promise.all([
    admin.from('attempts').select('max_score').eq('id', attemptId).single(),
    admin.from('attempt_answers').select('status').eq('attempt_id', attemptId),
  ]);
  const total = (answers ?? []).length;
  const correct = (answers ?? []).filter((a) => a.status === 'correct').length;
  await admin
    .from('lab_sessions')
    .update({ answers: { correct, total } })
    .eq('attempt_id', attemptId);
  if (attempt && total >= Number(attempt.max_score ?? Infinity)) await finishLabAttempt(attemptId);
}
