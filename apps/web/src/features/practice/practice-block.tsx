import { DIFFICULTIES, FREE_DIFFICULTY, type Difficulty } from '@knj/task-engine';
import type { Locale } from '@knj/i18n';
import { Alert, Badge, Button, Card, cn } from '@knj/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { isSupabaseConfigured } from '@/lib/env';
import { getCurrentUser } from '@/server/authz';
import { activePass } from '@/server/entitlements';
import { startTrainer } from './actions';
import { levelCounts } from './queries';
import { TrainerPanel } from './trainer-panel';

/**
 * Practice on the topic page: four difficulty levels. A student who picked a level
 * (`?level=…`) solves the tasks right here; otherwise the level cards explain access.
 */
export async function PracticeBlock({
  topicId,
  slug,
  locale,
  level,
}: {
  topicId: string;
  slug: string;
  locale: Locale;
  level?: Difficulty;
}) {
  const t = await getTranslations('practice');
  const counts = await levelCounts(topicId);
  const user = isSupabaseConfigured() ? await getCurrentUser() : null;
  const student = user?.role === 'student' ? user : null;
  const pass = student ? await activePass(student.id) : null;

  const heading = (
    <>
      <h2 id="practice" className="type-h2">
        {t('blockTitle')}
      </h2>
      <p className="mt-2 text-text-muted">{t('blockSubtitle')}</p>
    </>
  );

  if (student && level) {
    const open = level === FREE_DIFFICULTY || pass !== null;
    return (
      <section aria-labelledby="practice" className="mt-10 max-w-3xl border-t border-border pt-8">
        {heading}
        <nav aria-label={t('levelsNav')} className="mt-5 flex flex-wrap gap-2">
          {DIFFICULTIES.map((l) => (
            <Link
              key={l}
              href={`/topics/${slug}?level=${l}#practice`}
              aria-current={l === level ? 'page' : undefined}
              className={cn(
                'inline-flex min-h-11 items-center rounded-full border px-4 text-sm',
                l === level
                  ? 'border-text bg-text text-surface'
                  : 'border-border bg-surface hover:bg-surface-muted',
              )}
            >
              {t(`levels.${l}`)}
            </Link>
          ))}
        </nav>
        <div className="mt-5" data-testid="topic-trainer">
          {!open ? (
            <Alert tone="info">{t('lockedShort')}</Alert>
          ) : counts[level] === 0 ? (
            <p className="text-text-muted">{t('levelEmpty')}</p>
          ) : (
            <TrainerPanel
              studentId={student.id}
              topicId={topicId}
              slug={slug}
              level={level}
              locale={locale}
              from="topic"
            />
          )}
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="practice" className="mt-10 max-w-3xl border-t border-border pt-8">
      {heading}
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {DIFFICULTIES.map((level) => {
          const free = level === FREE_DIFFICULTY;
          const hasTasks = counts[level] > 0;
          const open = free || pass !== null;
          return (
            <li key={level}>
              <Card className="flex h-full flex-col gap-3 p-4" data-testid={`level-${level}`}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold">{t(`levels.${level}`)}</h3>
                  <Badge tone={free ? 'geometry' : 'accent'}>{free ? t('free') : t('paid')}</Badge>
                </div>
                {!hasTasks ? (
                  <p className="text-sm text-text-muted">{t('levelEmpty')}</p>
                ) : !user ? (
                  <p className="text-sm">
                    <Link
                      href={`/login?next=${encodeURIComponent(`/${locale}/topics/${slug}`)}`}
                      className="underline underline-offset-4"
                    >
                      {t('loginToPractice')}
                    </Link>
                  </p>
                ) : !student ? (
                  <p className="text-sm text-text-muted">{t('studentsOnly')}</p>
                ) : !open ? (
                  <p className="text-sm text-text-muted">{t('lockedShort')}</p>
                ) : (
                  <form action={startTrainer} className="mt-auto">
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="level" value={level} />
                    <input type="hidden" name="from" value="topic" />
                    <Button type="submit" size="sm">
                      {t('startLevel')}
                    </Button>
                  </form>
                )}
              </Card>
            </li>
          );
        })}
      </ul>
      {student && pass ? (
        <p className="mt-3 text-sm text-text-muted">
          {t('passUntil', {
            date: new Date(pass.endsAt).toLocaleDateString(locale === 'kk' ? 'kk-KZ' : 'ru-KZ', {
              timeZone: 'Asia/Almaty',
            }),
          })}
        </p>
      ) : null}
    </section>
  );
}
