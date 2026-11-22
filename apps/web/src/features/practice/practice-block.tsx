import { DIFFICULTIES, FREE_DIFFICULTY } from '@knj/task-engine';
import type { Locale } from '@knj/i18n';
import { Badge, Button, Card } from '@knj/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { isSupabaseConfigured } from '@/lib/env';
import { getCurrentUser } from '@/server/authz';
import { activePass } from '@/server/entitlements';
import { startTrainer } from './actions';
import { levelCounts } from './queries';

/** Four difficulty levels of a topic: start the trainer, or see why a level is unavailable. */
export async function PracticeBlock({
  topicId,
  slug,
  locale,
}: {
  topicId: string;
  slug: string;
  locale: Locale;
}) {
  const t = await getTranslations('practice');
  const counts = await levelCounts(topicId);
  const user = isSupabaseConfigured() ? await getCurrentUser() : null;
  const student = user?.role === 'student' ? user : null;
  const pass = student ? await activePass(student.id) : null;

  return (
    <section aria-labelledby="practice" className="mt-10 max-w-3xl border-t border-border pt-8">
      <h2 id="practice" className="text-2xl font-semibold tracking-tight">
        {t('blockTitle')}
      </h2>
      <p className="mt-2 text-text-muted">{t('blockSubtitle')}</p>
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
