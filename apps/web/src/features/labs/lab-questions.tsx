import type { Locale } from '@knj/i18n';
import { Alert, Button, Card } from '@knj/ui';
import { GameProgress, GameResults } from '@knj/ui/game';
import { getTranslations } from 'next-intl/server';
import { TaskView } from '@/features/practice/task-view';
import { Link } from '@/i18n/navigation';
import type { CurrentUser } from '@/server/authz';
import type { LabAccess } from './access';
import { startLabQuestions } from './actions';
import type { LabPageData } from './queries';
import { loadLabQuestions } from './server';

/** Questions about the experiment: published templates linked by a methodologist. */
export async function LabQuestionsBlock({
  lab,
  user,
  access,
  locale,
}: {
  lab: LabPageData;
  user: CurrentUser | null;
  access: LabAccess;
  locale: Locale;
}) {
  const t = await getTranslations('labs.questions');
  const startForm = (label: string) => (
    <form action={startLabQuestions}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="code" value={lab.code} />
      <Button type="submit">{label}</Button>
    </form>
  );

  let body: React.ReactNode;
  if (!lab.questions.length) {
    body = <p className="text-text-muted">{t('none')}</p>;
  } else if (!user) {
    body = (
      <p>
        <Link
          href={`/login?next=${encodeURIComponent(`/${locale}/labs/${lab.code}`)}`}
          className="underline underline-offset-4"
        >
          {t('login')}
        </Link>
      </p>
    );
  } else if (!access.student) {
    body = <p className="text-text-muted">{t('studentsOnly')}</p>;
  } else {
    const state = await loadLabQuestions({
      studentId: user.id,
      lab,
      hasPass: access.hasPass,
      locale,
    });
    const locked =
      state.locked > 0 ? (
        <p className="text-sm text-text-muted">{t('locked', { count: state.locked })}</p>
      ) : null;
    switch (state.kind) {
      case 'none':
        body = (
          <>
            <p className="text-text-muted">{t('none')}</p>
            {locked}
          </>
        );
        break;
      case 'start':
        body = (
          <>
            <p className="text-text-muted">{t('intro', { total: state.total })}</p>
            {locked}
            <div>{startForm(t('start'))}</div>
          </>
        );
        break;
      case 'current':
        body = (
          <>
            <GameProgress done={state.answered} total={state.total} label={t('progressLabel')} />
            <Card>
              <TaskView
                key={state.prompt.instanceId}
                prompt={state.prompt}
                locale={locale}
                nextLabel={state.last ? t('finish') : t('next')}
              />
            </Card>
            {locked}
          </>
        );
        break;
      case 'finished':
        body = (
          <GameResults title={t('finished')}>
            <p data-testid="lab-score">
              {t('score', { correct: state.correct, total: state.total })}
            </p>
            {state.correct < state.total ? <Alert tone="info">{t('review')}</Alert> : null}
            {locked}
            <div>{startForm(t('again'))}</div>
          </GameResults>
        );
        break;
    }
  }

  return (
    <section
      id="questions"
      aria-labelledby="lab-questions"
      className="flex max-w-3xl scroll-mt-4 flex-col gap-4"
    >
      <h2 id="lab-questions" className="text-2xl font-semibold tracking-tight">
        {t('title')}
      </h2>
      {body}
    </section>
  );
}
