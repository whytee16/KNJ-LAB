import type { Expected, TaskPrompt } from '@knj/task-engine';
import { Badge, Card, Container, cn } from '@knj/ui';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { TaskFigure } from '@/features/practice/figure';
import { notFound } from 'next/navigation';
import { pickLocale } from '@/features/content/queries';
import { expectedHtml, givenAnswerHtml } from '@/features/practice/engine-server';
import { pageLocale } from '@/features/shell/page-locale';
import { Link } from '@/i18n/navigation';
import { renderMarkdown } from '@/lib/content/markdown';
import { createAdminClient } from '@/lib/supabase/admin';
import { createUserClient } from '@/lib/supabase/server';
import { requireUser } from '@/server/authz';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/app/results/[attemptId]'>): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale as 'ru', namespace: 'results' });
  return { title: t('title'), robots: { index: false } };
}

/** Result of a test. Visible to the student and their parent (RLS read decides access). */
export default async function ResultPage({
  params,
}: PageProps<'/[locale]/app/results/[attemptId]'>) {
  const locale = await pageLocale(params);
  const { attemptId } = await params;
  await requireUser(locale, {
    roles: ['student', 'parent'],
    next: `/${locale}/app/results/${attemptId}`,
  });
  const supabase = await createUserClient();
  const { data: attempt } = await supabase
    .from('attempts')
    .select('id, finished_at, score, max_score, tests(test_texts(locale, title))')
    .eq('id', attemptId)
    .eq('kind', 'test')
    .maybeSingle();
  if (!attempt?.finished_at) notFound();

  // Access confirmed by RLS above; keys and topics are read with the service role.
  const { data: items } = await createAdminClient()
    .from('task_instances')
    .select(
      'id, prompt, position, task_instance_keys(expected, solution), attempt_answers(answer, status, score), task_templates(topic_id, topics(slug, topic_contents(locale, title)))',
    )
    .eq('attempt_id', attemptId)
    .order('position');
  const t = await getTranslations('results');
  const title = pickLocale(attempt.tests?.test_texts, locale)?.title ?? '';
  const score = Number(attempt.score ?? 0);
  const max = Number(attempt.max_score ?? 0);
  const percent = max ? Math.round((100 * score) / max) : 0;

  const rows = await Promise.all(
    (items ?? []).map(async (item) => {
      const prompt = item.prompt as unknown as TaskPrompt;
      const answer = item.attempt_answers;
      return {
        id: item.id,
        statementHtml: (await renderMarkdown(prompt.statement)).html,
        figure: prompt.figure,
        givenHtml: await givenAnswerHtml(answer?.answer, prompt),
        correct: answer?.status === 'correct',
        score: Number(answer?.score ?? 0),
        expectedHtml: item.task_instance_keys
          ? await expectedHtml(
              item.task_instance_keys.expected as unknown as Expected,
              prompt,
              locale,
            )
          : '',
        solutionHtml: item.task_instance_keys?.solution
          ? (await renderMarkdown(item.task_instance_keys.solution)).html
          : '',
        topic: item.task_templates?.topics
          ? {
              slug: item.task_templates.topics.slug,
              title:
                pickLocale(item.task_templates.topics.topic_contents, locale)?.title ??
                item.task_templates.topics.slug,
            }
          : null,
      };
    }),
  );
  const weak = [
    ...new Map(
      rows.filter((r) => !r.correct && r.topic).map((r) => [r.topic!.slug, r.topic!]),
    ).values(),
  ];

  return (
    <Container className="flex max-w-3xl flex-col gap-8 py-10">
      <div>
        <p className="text-sm text-text-muted">{t('title')}</p>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
      </div>
      <Card className="flex flex-wrap items-baseline gap-x-6 gap-y-2" data-testid="result-score">
        <span className="text-4xl font-semibold tabular-nums">{percent}%</span>
        <span className="text-text-muted">
          {t('score', { score: Math.round(score * 100) / 100, max })}
        </span>
        <span className="text-text-muted">
          {t('correctCount', { correct: rows.filter((r) => r.correct).length, total: rows.length })}
        </span>
      </Card>

      {weak.length ? (
        <section aria-labelledby="recommend">
          <h2 id="recommend" className="text-lg font-semibold">
            {t('recommendTitle')}
          </h2>
          <ul className="mt-2 flex flex-col gap-1">
            {weak.map((topic) => (
              <li key={topic.slug}>
                <Link href={`/topics/${topic.slug}`} className="underline underline-offset-4">
                  {topic.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="text-success">{t('allGood')}</p>
      )}

      <section aria-labelledby="review" className="flex flex-col gap-4">
        <h2 id="review" className="text-lg font-semibold">
          {t('reviewTitle')}
        </h2>
        {rows.map((r, i) => (
          <Card
            key={r.id}
            className={cn(
              'flex flex-col gap-3 border-l-4',
              r.correct ? 'border-l-success' : 'border-l-danger',
            )}
            data-testid={`result-item-${i + 1}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-text-muted">{t('item', { n: i + 1 })}</span>
              <Badge tone={r.correct ? 'geometry' : 'accent'}>
                {r.correct
                  ? `✓ ${t('right')}`
                  : r.score > 0
                    ? `≈ ${t('partial')}`
                    : `✗ ${t('wrong')}`}
              </Badge>
            </div>
            <div className="prose-topic" dangerouslySetInnerHTML={{ __html: r.statementHtml }} />
            {r.figure ? <TaskFigure figure={r.figure} label={t('figure')} /> : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium">{t('yourAnswer')}</p>
                {r.givenHtml ? (
                  <div className="prose-topic" dangerouslySetInnerHTML={{ __html: r.givenHtml }} />
                ) : (
                  <p className="text-text-muted">{t('noAnswer')}</p>
                )}
              </div>
              {!r.correct ? (
                <div>
                  <p className="text-sm font-medium">{t('rightAnswer')}</p>
                  <div
                    className="prose-topic"
                    dangerouslySetInnerHTML={{ __html: r.expectedHtml }}
                  />
                </div>
              ) : null}
            </div>
            {r.solutionHtml ? (
              <details>
                <summary className="cursor-pointer text-sm font-medium">{t('solution')}</summary>
                <div
                  className="prose-topic mt-2"
                  dangerouslySetInnerHTML={{ __html: r.solutionHtml }}
                />
              </details>
            ) : null}
          </Card>
        ))}
      </section>
    </Container>
  );
}
