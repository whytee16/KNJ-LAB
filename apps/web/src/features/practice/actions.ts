'use server';

import { DIFFICULTIES, type Answer, type Difficulty } from '@knj/task-engine';
import { isLocale, type Locale } from '@knj/i18n';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/server/authz';
import { canUseLevel } from '@/server/entitlements';
import { hit } from '@/server/rate-limit';
import { errorState, type FormState } from '@/features/forms/form-state';
import { recordLabAnswer } from '@/features/labs/server';
import { answerTask, type Feedback } from './engine-server';

function localeOf(form: FormData): Locale {
  const v = form.get('locale');
  return typeof v === 'string' && isLocale(v) ? v : 'ru';
}

const answerSchema = z.union([
  z.string().max(2000),
  z.array(z.string().max(20)).max(20),
  z.record(z.string().max(20), z.string().max(20)),
]);

/** Starts (or resumes) a trainer run for a topic and level, then opens the trainer. */
export async function startTrainer(form: FormData): Promise<void> {
  const locale = localeOf(form);
  const slug = String(form.get('slug') ?? '');
  const level = String(form.get('level') ?? '') as Difficulty;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/topics/${slug}`)}`);
  if (user.role !== 'student' || !DIFFICULTIES.includes(level))
    redirect(`/${locale}/topics/${slug}`);
  if (!(await canUseLevel(user.id, level))) redirect(`/${locale}/topics/${slug}`);

  const admin = createAdminClient();
  const { data: topic } = await admin.from('topics').select('id').eq('slug', slug).single();
  if (!topic) redirect(`/${locale}/learn`);
  const { data: active } = await admin
    .from('trainer_runs')
    .select('id')
    .eq('student_id', user.id)
    .eq('topic_id', topic.id)
    .eq('difficulty', level)
    .eq('status', 'active')
    .maybeSingle();
  if (!active) {
    const { data: run, error } = await admin
      .from('trainer_runs')
      .insert({ student_id: user.id, topic_id: topic.id, difficulty: level })
      .select('id')
      .single();
    if (error) throw new Error(`run create failed: ${error.message}`);
    const { error: aErr } = await admin
      .from('attempts')
      .insert({ student_id: user.id, kind: 'trainer', trainer_run_id: run.id });
    if (aErr) throw new Error(`attempt create failed: ${aErr.message}`);
  }
  redirect(`/${locale}/app/trainer/${slug}?level=${level}`);
}

export interface AnswerState extends FormState {
  feedback?: Feedback;
  instanceId?: string;
}

export async function submitAnswer(_prev: AnswerState, form: FormData): Promise<AnswerState> {
  const locale = localeOf(form);
  const instanceId = String(form.get('instanceId') ?? '');
  const user = await getCurrentUser();
  if (!user || user.role !== 'student') return errorState('auth.errors.forbidden');

  const idem = z.uuid().safeParse(form.get('idempotencyKey'));
  let answer: Answer;
  try {
    answer = answerSchema.parse(JSON.parse(String(form.get('answer') ?? '""')));
  } catch {
    return { ...errorState('practice.errors.unparseable'), instanceId };
  }
  if (!idem.success || !z.uuid().safeParse(instanceId).success)
    return errorState('auth.errors.generic');
  if (!(await hit('answer', `student:${user.id}`)))
    return { ...errorState('auth.errors.rateLimited'), instanceId };

  const outcome = await answerTask({
    studentId: user.id,
    instanceId,
    answer,
    timeMs: Number(form.get('timeMs') ?? 0) || 0,
    idempotencyKey: idem.data,
    locale,
  });
  switch (outcome.kind) {
    case 'invalid':
      return { ...errorState(`practice.errors.${outcome.reason}`), instanceId };
    case 'closed':
      return { ...errorState('practice.errors.closed'), instanceId };
    case 'not_found':
      return errorState('auth.errors.forbidden');
    case 'answered': {
      // The run comes from the task's own attempt, never from the form.
      if (outcome.firstTime && outcome.trainerRunId) {
        await createAdminClient().rpc('record_trainer_answer', {
          p_run: outcome.trainerRunId,
          p_correct: outcome.feedback.status === 'correct',
        });
      }
      if (outcome.firstTime && outcome.labAttemptId) await recordLabAnswer(outcome.labAttemptId);
      return { status: 'idle', feedback: outcome.feedback, instanceId };
    }
  }
}

const reportSchema = z.object({
  instanceId: z.uuid(),
  message: z.string().trim().min(3, 'validation.required').max(2000, 'validation.tooLong'),
});

/** "Report an error in this task": goes to the studio queue for reviewers. */
export async function reportTaskError(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return errorState('auth.errors.forbidden');
  const parsed = reportSchema.safeParse({
    instanceId: form.get('instanceId'),
    message: form.get('message'),
  });
  if (!parsed.success)
    return {
      ...errorState('validation.fixErrors'),
      fieldErrors: { message: parsed.error.issues[0]!.message },
    };
  if (!(await hit('report', `user:${user.id}`))) return errorState('auth.errors.rateLimited');
  const admin = createAdminClient();
  const { data: instance } = await admin
    .from('task_instances')
    .select('student_id, template_id')
    .eq('id', parsed.data.instanceId)
    .single();
  if (!instance || instance.student_id !== user.id) return errorState('auth.errors.forbidden');
  const { error } = await admin.from('content_reports').insert({
    reporter_id: user.id,
    instance_id: parsed.data.instanceId,
    template_id: instance.template_id,
    message: parsed.data.message,
  });
  if (error) return errorState('auth.errors.generic');
  revalidatePath('/[locale]/studio/reports', 'page');
  return { status: 'success', messageKey: 'practice.report.sent' };
}
