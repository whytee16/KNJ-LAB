import type { Difficulty, TaskPrompt } from '@knj/task-engine';
import type { Locale } from '@knj/i18n';
import { Alert, Button, Card, Progress } from '@knj/ui';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { createUserClient } from '@/lib/supabase/server';
import { startTrainer } from './actions';
import { issueTask, NoTemplatesError } from './engine-server';
import { renderPrompt } from './render';
import { TaskView } from './task-view';

/**
 * The trainer for one topic and level: the active run, its progress and the current task.
 * Used on the trainer page and inside the topic page. The caller checks access to the level.
 * `from="topic"` makes the start button come back to the topic page instead of the trainer page.
 */
export async function TrainerPanel({
  studentId,
  topicId,
  slug,
  level,
  locale,
  from,
}: {
  studentId: string;
  topicId: string;
  slug: string;
  level: Difficulty;
  locale: Locale;
  from?: 'topic';
}) {
  const t = await getTranslations('practice');
  const supabase = await createUserClient();
  const { data: runs } = await supabase
    .from('trainer_runs')
    .select('id, status, solved, correct, target, finished_at, attempts(id)')
    .eq('student_id', studentId)
    .eq('topic_id', topicId)
    .eq('difficulty', level)
    .order('started_at', { ascending: false })
    .limit(1);
  const run = runs?.[0];

  const startForm = (label: string) => (
    <form action={startTrainer}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="level" value={level} />
      {from ? <input type="hidden" name="from" value={from} /> : null}
      <Button type="submit">{label}</Button>
    </form>
  );

  if (!run || run.status === 'finished') {
    return (
      <div className="flex flex-col gap-4">
        {run ? (
          <Card className="flex flex-col gap-2" data-testid="run-summary">
            <h3 className="text-lg font-semibold">{t('finishedTitle')}</h3>
            <p>
              {t('summary', {
                correct: run.correct,
                solved: run.solved,
                percent: run.solved ? Math.round((100 * run.correct) / run.solved) : 0,
              })}
            </p>
          </Card>
        ) : (
          <p className="text-text-muted">{t('intro', { target: 100 })}</p>
        )}
        <div>{startForm(run ? t('again') : t('start'))}</div>
      </div>
    );
  }

  const attemptId = run.attempts[0]?.id;
  if (!attemptId) notFound();
  const { data: instances } = await supabase
    .from('task_instances')
    .select('id, prompt, position, attempt_answers(id)')
    .eq('attempt_id', attemptId)
    .order('position', { ascending: false })
    .limit(1);
  // attempt_answers is one-to-one (unique instance_id): null means not answered yet.
  let current = instances?.[0] && !instances[0].attempt_answers ? instances[0] : null;

  let noTasks = false;
  if (!current) {
    try {
      const id = await issueTask({
        studentId,
        attemptId,
        topicIds: [topicId],
        difficulty: level,
        locale,
        position: (instances?.[0]?.position ?? 0) + 1,
      });
      const { data } = await supabase
        .from('task_instances')
        .select('id, prompt, position, attempt_answers(id)')
        .eq('id', id)
        .single();
      current = data;
    } catch (e) {
      if (!(e instanceof NoTemplatesError)) throw e;
      noTasks = true;
    }
  }

  const percent = run.solved ? Math.round((100 * run.correct) / run.solved) : 0;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap justify-between gap-2 text-sm text-text-muted">
          <span data-testid="run-progress">
            {t('progress', { solved: run.solved, target: run.target })}
          </span>
          <span>{t('accuracy', { percent })}</span>
        </div>
        <Progress label={t('progressLabel')} value={run.solved} max={run.target} />
      </div>
      {noTasks || !current ? (
        <Alert tone="info">{t('noTasks')}</Alert>
      ) : (
        <Card>
          <TaskView
            key={current.id}
            prompt={await renderPrompt(current.id, current.prompt as unknown as TaskPrompt)}
            locale={locale}
            nextLabel={run.solved + 1 >= run.target ? t('finish') : t('next')}
          />
        </Card>
      )}
    </div>
  );
}
