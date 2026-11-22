import { Badge, Card, Container } from '@knj/ui';
import { pickLocale, SUBJECTS } from '@/features/content/queries';
import { recentResults } from '@/features/tests/queries';
import { Link } from '@/i18n/navigation';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { pageLocale } from '@/features/shell/page-locale';
import { createUserClient } from '@/lib/supabase/server';
import { requireUser } from '@/server/authz';

export async function generateMetadata({ params }: PageProps<'/[locale]/app'>): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale as 'ru', namespace: 'student' });
  return { title: t('title'), robots: { index: false } };
}

export default async function StudentPage({ params }: PageProps<'/[locale]/app'>) {
  const locale = await pageLocale(params);
  const user = await requireUser(locale, { roles: ['student'], next: `/${locale}/app` });
  const t = await getTranslations('student');
  const s = await getTranslations('studio.subjects');
  const supabase = await createUserClient();
  const [{ data: runRows }, results] = await Promise.all([
    supabase
      .from('trainer_runs')
      .select('id, difficulty, solved, target, topics(slug, topic_contents(locale, title))')
      .eq('student_id', user.id)
      .eq('status', 'active')
      .order('last_activity_at', { ascending: false })
      .limit(5),
    recentResults(user.id, locale),
  ]);
  const runs = (runRows ?? []).flatMap((r) =>
    r.topics
      ? [
          {
            id: r.id,
            slug: r.topics.slug,
            level: r.difficulty,
            solved: r.solved,
            target: r.target,
            title: pickLocale(r.topics.topic_contents, locale)?.title ?? r.topics.slug,
          },
        ]
      : [],
  );
  const { data: student } = await supabase
    .from('student_profiles')
    .select('username, grade')
    .eq('profile_id', user.id)
    .single();

  return (
    <Container className="py-10 md:py-14">
      <p className="text-sm text-text-muted">{t('title')}</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">
        {t('greeting', { name: user.displayName })}
      </h1>
      {student ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Badge tone="accent">{t('grade', { grade: student.grade })}</Badge>
          <span className="text-sm text-text-muted">
            {t('username', { username: student.username })}
          </span>
        </div>
      ) : null}
      {student ? (
        <section aria-labelledby="my-subjects" className="mt-10">
          <h2 id="my-subjects" className="text-xl font-semibold">
            {t('subjects')}
          </h2>
          <p className="mt-1 text-sm text-text-muted">{t('next')}</p>
          <ul className="mt-4 grid gap-4 sm:grid-cols-3">
            {SUBJECTS.map((subject) => (
              <li key={subject}>
                <Link href={`/learn/${subject}/${student.grade}`} className="block">
                  <Card className="hover:border-accent">
                    <span className="text-lg font-semibold">{s(subject)}</span>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <section aria-labelledby="my-runs">
          <h2 id="my-runs" className="text-xl font-semibold">
            {t('runs')}
          </h2>
          {runs.length ? (
            <ul className="mt-3 flex flex-col gap-2">
              {runs.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/app/trainer/${r.slug}?level=${r.level}`}
                    className="underline underline-offset-4"
                  >
                    {r.title}
                  </Link>{' '}
                  <span className="text-sm text-text-muted">
                    {t('runProgress', { solved: r.solved, target: r.target })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-text-muted">{t('noRuns')}</p>
          )}
        </section>
        <section aria-labelledby="my-results">
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="my-results" className="text-xl font-semibold">
              {t('results')}
            </h2>
            <Link href="/app/tests" className="text-sm underline underline-offset-4">
              {t('allTests')}
            </Link>
          </div>
          {results.length ? (
            <ul className="mt-3 flex flex-col gap-2">
              {results.map((r) => (
                <li key={r.id}>
                  <Link href={`/app/results/${r.id}`} className="underline underline-offset-4">
                    {r.title}
                  </Link>{' '}
                  <span className="text-sm text-text-muted">
                    {Math.round(r.max ? (100 * r.score) / r.max : 0)}%
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-text-muted">{t('noResults')}</p>
          )}
        </section>
      </div>
    </Container>
  );
}
