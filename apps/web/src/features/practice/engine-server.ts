import 'server-only';
import type { Locale } from '@knj/i18n';
import {
  checkAnswer,
  expressionToTex,
  formatNumber,
  generateTask,
  newSeed,
  taskSpecSchema,
  taskTextsSchema,
  type Answer,
  type Difficulty,
  type Expected,
  type TaskPrompt,
} from '@knj/task-engine';
import { renderMarkdown } from '@/lib/content/markdown';
import { renderLatex } from '@/lib/katex';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Json } from '@/lib/supabase/database.types';

export class NoTemplatesError extends Error {}

/** Where the next task comes from: a topic level (trainer, tests) or explicit templates (labs). */
export type TemplateSource =
  { topicIds: string[]; difficulty: Difficulty } | { templateIds: string[] };

interface TemplateRow {
  id: string;
  version: number;
  spec: Json;
  task_template_texts: { locale: string; texts: Json }[];
}

/**
 * Chooses the next template: half the time a template the student got wrong in this attempt
 * (spaced repetition of mistakes), never the same template twice in a row if there is a choice.
 */
async function pickTemplate(source: TemplateSource, attemptId: string, rand = Math.random) {
  const admin = createAdminClient();
  const base = admin
    .from('task_templates')
    .select('id, version, spec, task_template_texts(locale, texts)')
    .eq('status', 'published');
  const { data: templates, error } = await ('templateIds' in source
    ? base.in('id', source.templateIds)
    : base.in('topic_id', source.topicIds).eq('difficulty', source.difficulty));
  if (error) throw new Error(`templates query failed: ${error.message}`);
  if (!templates?.length) throw new NoTemplatesError();

  const { data: history } = await admin
    .from('task_instances')
    .select('template_id, created_at, attempt_answers(status)')
    .eq('attempt_id', attemptId)
    .order('created_at', { ascending: false })
    .limit(50);
  const last = history?.[0]?.template_id;
  const wrongIds = new Set(
    (history ?? []).filter((h) => h.attempt_answers?.status === 'wrong').map((h) => h.template_id),
  );
  const pool = templates.length > 1 ? templates.filter((t) => t.id !== last) : templates;
  const retry = pool.filter((t) => wrongIds.has(t.id));
  const from = retry.length && rand() < 0.5 ? retry : pool;
  return from[Math.floor(rand() * from.length)]! as TemplateRow;
}

/** Creates a task instance (prompt for the student, key for the server) and returns its id. */
export async function issueTask(
  opts: {
    studentId: string;
    attemptId: string;
    locale: Locale;
    position: number;
  } & TemplateSource,
): Promise<string> {
  const template = await pickTemplate(opts, opts.attemptId);
  const texts =
    template.task_template_texts.find((t) => t.locale === opts.locale) ??
    template.task_template_texts.find((t) => t.locale === 'ru');
  if (!texts) throw new NoTemplatesError();
  const locale = texts.locale as Locale;
  const spec = taskSpecSchema.parse(template.spec);
  const seed = newSeed();
  const task = generateTask(spec, taskTextsSchema.parse(texts.texts), seed, locale);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('task_instances')
    .insert({
      template_id: template.id,
      template_version: template.version,
      student_id: opts.studentId,
      attempt_id: opts.attemptId,
      position: opts.position,
      seed,
      locale,
      params: task.params as never,
      prompt: task.prompt as never,
    })
    .select('id')
    .single();
  if (error) throw new Error(`issue failed: ${error.message}`);
  const { error: keyError } = await admin
    .from('task_instance_keys')
    .insert({ instance_id: data.id, expected: task.expected as never, solution: task.solution });
  if (keyError) throw new Error(`key insert failed: ${keyError.message}`);
  return data.id;
}

export interface Feedback {
  status: 'correct' | 'wrong';
  score: number;
  /** Correct answer, rendered (HTML, safe: from our renderers only). */
  expectedHtml: string;
  solutionHtml: string;
}

/** Correct answer for display, from the key and the prompt the student saw. */
export async function expectedHtml(
  expected: Expected,
  prompt: TaskPrompt,
  locale: Locale,
): Promise<string> {
  const option = (id: string) => prompt.options?.find((o) => o.id === id)?.text ?? id;
  const md = async (s: string) => (await renderMarkdown(s)).html;
  switch (expected.type) {
    case 'number':
      return md(
        `${formatNumber(expected.value, locale)}${expected.unit ? ` ${expected.unit}` : ''}`,
      );
    case 'formula':
      return renderLatex(expressionToTex(expected.expression), true);
    case 'single_choice':
      return md(option(expected.correct));
    case 'multi_choice':
      return md(expected.correct.map((id) => `- ${option(id)}`).join('\n'));
    case 'ordering':
      return md(expected.order.map((id, i) => `${i + 1}. ${option(id)}`).join('\n'));
    case 'matching': {
      const right = (id: string) => prompt.right?.find((r) => r.id === id)?.text ?? id;
      return md(
        (prompt.left ?? [])
          .map((l) => `- ${l.text} — ${right(expected.pairs[l.id] ?? '')}`)
          .join('\n'),
      );
    }
    case 'cloze_word':
      return md(expected.accepted[0] ?? '');
  }
}

export type AnswerOutcome =
  | { kind: 'invalid'; reason: string }
  | { kind: 'closed' }
  | { kind: 'not_found' }
  | {
      kind: 'answered';
      feedback: Feedback;
      firstTime: boolean;
      trainerRunId: string | null;
      /** Set when the task is a lab question (the attempt belongs to a lab). */
      labAttemptId: string | null;
    };

/**
 * Checks and records an answer. Idempotent: a repeated key (or a second answer to the same task)
 * returns the stored result instead of recording again.
 */
export async function answerTask(opts: {
  studentId: string;
  instanceId: string;
  answer: Answer;
  timeMs: number;
  idempotencyKey: string;
  locale: Locale;
}): Promise<AnswerOutcome> {
  const admin = createAdminClient();
  const { data: instance } = await admin
    .from('task_instances')
    .select(
      'id, student_id, attempt_id, prompt, attempts(finished_at, deadline_at, trainer_run_id, lab_id), task_instance_keys(expected, solution), attempt_answers(status, score)',
    )
    .eq('id', opts.instanceId)
    .maybeSingle();
  if (!instance || instance.student_id !== opts.studentId) return { kind: 'not_found' };
  const key = instance.task_instance_keys;
  if (!key) return { kind: 'not_found' };
  const expected = key.expected as unknown as Expected;
  const prompt = instance.prompt as unknown as TaskPrompt;
  const feedbackFor = async (status: 'correct' | 'wrong', score: number): Promise<Feedback> => ({
    status,
    score,
    expectedHtml: await expectedHtml(expected, prompt, opts.locale),
    solutionHtml: key.solution ? (await renderMarkdown(key.solution)).html : '',
  });

  const trainerRunId = instance.attempts?.trainer_run_id ?? null;
  const labAttemptId = instance.attempts?.lab_id ? instance.attempt_id : null;
  const previous = instance.attempt_answers;
  if (previous)
    return {
      kind: 'answered',
      feedback: await feedbackFor(previous.status, Number(previous.score)),
      firstTime: false,
      trainerRunId,
      labAttemptId,
    };

  const attempt = instance.attempts;
  if (attempt?.finished_at || (attempt?.deadline_at && new Date(attempt.deadline_at) < new Date()))
    return { kind: 'closed' };

  const result = checkAnswer(expected, opts.answer);
  if (result.status === 'invalid')
    return { kind: 'invalid', reason: result.reason ?? 'unparseable' };

  const { error } = await admin.from('attempt_answers').insert({
    attempt_id: instance.attempt_id,
    instance_id: instance.id,
    answer: opts.answer as never,
    status: result.status,
    score: Math.round(result.score * 1000) / 1000,
    time_ms: Math.min(Math.max(0, Math.round(opts.timeMs)), 86_400_000),
    idempotency_key: opts.idempotencyKey,
  });
  if (error) {
    // Lost a race with a duplicate submission: report the stored answer.
    if (error.code === '23505') {
      const { data: stored } = await admin
        .from('attempt_answers')
        .select('status, score')
        .eq('instance_id', instance.id)
        .single();
      if (stored)
        return {
          kind: 'answered',
          feedback: await feedbackFor(stored.status, Number(stored.score)),
          firstTime: false,
          trainerRunId,
          labAttemptId,
        };
    }
    throw new Error(`answer insert failed: ${error.message}`);
  }
  return {
    kind: 'answered',
    feedback: await feedbackFor(result.status, result.score),
    firstTime: true,
    trainerRunId,
    labAttemptId,
  };
}

/** The student's own answer, rendered for result pages (no HTML from the student passes through). */
export async function givenAnswerHtml(answer: unknown, prompt: TaskPrompt): Promise<string> {
  const md = async (s: string) => (await renderMarkdown(s)).html;
  const escape = (s: string) => s.replace(/[\\`*_{}[\]()#+\-.!|<>$]/g, '\\$&');
  const option = (id: string) => prompt.options?.find((o) => o.id === id)?.text ?? '?';
  if (
    answer === '' ||
    answer === null ||
    answer === undefined ||
    (Array.isArray(answer) && !answer.length)
  )
    return '';
  switch (prompt.type) {
    case 'formula':
      try {
        return renderLatex(String(answer));
      } catch {
        return md(escape(String(answer)));
      }
    case 'single_choice':
      return md(option(String(answer)));
    case 'multi_choice':
    case 'ordering':
      return md(
        (answer as string[])
          .map((id, i) => `${prompt.type === 'ordering' ? `${i + 1}.` : '-'} ${option(id)}`)
          .join('\n'),
      );
    case 'matching': {
      const pairs = answer as Record<string, string>;
      const right = (id: string) => prompt.right?.find((r) => r.id === id)?.text ?? '?';
      return md(
        (prompt.left ?? [])
          .map((l) => `- ${l.text} — ${pairs[l.id] ? right(pairs[l.id]!) : '?'}`)
          .join('\n'),
      );
    }
    default:
      return md(escape(String(answer)));
  }
}
