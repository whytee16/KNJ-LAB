import { DIFFICULTIES, type Difficulty, type TaskPrompt } from '@knj/task-engine';
import { Alert, Button, Card, Container } from '@knj/ui';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { pickLocale } from '@/features/content/queries';
import { startTrainer } from '@/features/practice/actions';
import { issueTask, NoTemplatesError } from '@/features/practice/engine-server';
import { renderPrompt } from '@/features/practice/render';
import { TaskView } from '@/features/practice/task-view';
import { pageLocale } from '@/features/shell/page-locale';
import { Link } from '@/i18n/navigation';
import { createUserClient } from '@/lib/supabase/server';
import { requireUser } from '@/server/authz';
import { canUseLevel } from '@/server/entitlements';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/app/trainer/[slug]'>): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale as 'ru', namespace: 'practice' });
  return { title: t('trainerTitle'), robots: { index: false } };
}

export default async function TrainerPage({
  params,
  searchParams,
}: PageProps<'/[locale]/app/trainer/[slug]'>) {
  const locale = await pageLocale(params);
  const { slug } = await params;
  const levelParam = (await searchParams).level;
  const level = (DIFFICULTIES as readonly string[]).includes(String(levelParam))
    ? (levelParam as Difficulty)
    : 'easy';
  const user = await requireUser(locale, {
    roles: ['student'],
    next: `/${locale}/app/trainer/${slug}?level=${level}`,
  });
  const t = await getTranslations('practice');

  const supabase = await createUserClient();
  const { data: topic } = await supabase
    .from('topics')
    .select('id, slug, topic_contents(locale, title)')
    .eq('slug', slug)
    .maybeSingle();
  const title = pickLocale(topic?.topic_contents, locale)?.title;
  if (!topic || !title) notFound();

  const header = (
    <div className="flex flex-col gap-1">
      <Link
        href={`/topics/${slug}`}
        className="text-sm text-text-muted underline underline-offset-4"
      >
        {title}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
        {t('trainerTitle')} · {t(`levels.${level}`)}
      </h1>
    </div>
  );

  if (!(await canUseLevel(user.id, level))) {
    return (
      <Container className="flex max-w-3xl flex-col gap-6 py-10">
        {header}
        <Alert tone="info">{t('locked')}</Alert>
      </Container>
    );
  }

  const { data: runs } = await supabase
    .from('trainer_runs')
    .select('id, status, solved, correct, target, finished_at, attempts(id)')
    .eq('topic_id', topic.id)
    .eq('difficulty', level)
    .order('started_at', { ascending: false })
    .limit(1);
  const run = runs?.[0];

  const startForm = (label: string) => (
    <form action={startTrainer}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="level" value={level} />
      <Button type="submit">{label}</Button>
    </form>
  );

  if (!run || run.status === 'finished') {
    return (
      <Container className="flex max-w-3xl flex-col gap-6 py-10">
        {header}
        {run ? (
          <Card className="flex flex-col gap-2" data-testid="run-summary">
            <h2 className="text-lg font-semibold">{t('finishedTitle')}</h2>
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
      </Container>
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
        studentId: user.id,
        attemptId,
        topicIds: [topic.id],
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
    <Container className="flex max-w-3xl flex-col gap-6 py-10">
      {header}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap justify-between gap-2 text-sm text-text-muted">
          <span data-testid="run-progress">
            {t('progress', { solved: run.solved, target: run.target })}
          </span>
          <span>{t('accuracy', { percent })}</span>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-surface-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={run.target}
          aria-valuenow={run.solved}
          aria-label={t('progressLabel')}
        >
          <div
            className="h-full bg-accent"
            style={{ width: `${(100 * run.solved) / run.target}%` }}
          />
        </div>
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
    </Container>
  );
}
