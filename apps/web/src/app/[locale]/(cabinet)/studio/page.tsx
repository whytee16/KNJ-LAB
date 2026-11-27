import { buttonVariants, Container } from '@knj/ui';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { StatusBadge } from '@/features/studio/status-badge';
import { listStudioTopics } from '@/features/studio/queries';
import { pageLocale } from '@/features/shell/page-locale';
import { requireStaff } from '@/server/authz';
import { Link } from '@/i18n/navigation';
import { getCurrentUser } from '@/server/authz';
import { REVIEW_ROLES } from '@/server/redirects';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/studio'>): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale as 'ru', namespace: 'studio' });
  return { title: t('title'), robots: { index: false } };
}

export default async function StudioHome({ params }: PageProps<'/[locale]/studio'>) {
  const locale = await pageLocale(params);
  // Pages render in parallel with the layout: check access here before any query.
  await requireStaff(locale, `/${locale}/studio`);
  const t = await getTranslations('studio');
  const user = await getCurrentUser();
  const topics = await listStudioTopics();
  const queue = topics.flatMap((tp) =>
    (['ru', 'kk'] as const)
      .filter((l) => tp.locales[l].draft === 'in_review')
      .map((l) => ({ ...tp, lang: l })),
  );
  const canReview = user ? REVIEW_ROLES.includes(user.role) : false;

  return (
    <Container className="flex flex-col gap-10 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="type-h1">{t('topics.title')}</h1>
        <Link href="/studio/topics/new" className={buttonVariants()}>
          {t('topics.new')}
        </Link>
      </div>

      {canReview ? (
        <section aria-labelledby="queue">
          <h2 id="queue" className="mb-3 text-xl font-semibold">
            {t('queue.title')}
          </h2>
          {queue.length ? (
            <ul className="flex flex-col gap-2">
              {queue.map((q) => (
                <li key={`${q.id}-${q.lang}`}>
                  <Link
                    href={`/studio/topics/${q.id}?lang=${q.lang}`}
                    className="underline underline-offset-4"
                  >
                    {q.title}
                  </Link>{' '}
                  <span className="text-sm text-text-muted">({q.lang.toUpperCase()})</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-text-muted">{t('queue.empty')}</p>
          )}
        </section>
      ) : null}

      <section aria-labelledby="all-topics">
        <h2 id="all-topics" className="sr-only">
          {t('topics.title')}
        </h2>
        {topics.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-border text-text-muted">
                <tr>
                  <th className="py-2 pr-4 font-medium">{t('topics.columns.title')}</th>
                  <th className="py-2 pr-4 font-medium">{t('topics.columns.subject')}</th>
                  <th className="py-2 pr-4 font-medium">RU</th>
                  <th className="py-2 pr-4 font-medium">KK</th>
                </tr>
              </thead>
              <tbody>
                {topics.map((tp) => (
                  <tr key={tp.id} className="border-b border-border">
                    <td className="py-3 pr-4">
                      <Link
                        href={`/studio/topics/${tp.id}?lang=ru`}
                        className="font-medium underline underline-offset-4"
                      >
                        {tp.title}
                      </Link>
                      <div className="font-mono text-xs text-text-muted">{tp.slug}</div>
                    </td>
                    <td className="py-3 pr-4">{t(`subjects.${tp.subject as 'algebra'}`)}</td>
                    {(['ru', 'kk'] as const).map((l) => (
                      <td key={l} className="py-3 pr-4">
                        <div className="flex flex-wrap items-center gap-1">
                          <StatusBadge status={tp.locales[l].draft ?? 'none'} />
                          {tp.locales[l].version ? (
                            <span className="text-xs text-text-muted">
                              {t('topics.version', { version: tp.locales[l].version! })}
                            </span>
                          ) : null}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-text-muted">{t('topics.empty')}</p>
        )}
      </section>
    </Container>
  );
}
