import { buttonVariants, Container } from '@knj/ui';
import { getTranslations } from 'next-intl/server';
import { listStudioTests } from '@/features/studio/queries';
import { StatusBadge } from '@/features/studio/status-badge';
import { pageLocale } from '@/features/shell/page-locale';
import { Link } from '@/i18n/navigation';
import { requireStaff } from '@/server/authz';

export default async function StudioTestsPage({ params }: PageProps<'/[locale]/studio/tests'>) {
  const locale = await pageLocale(params);
  await requireStaff(locale, `/${locale}/studio/tests`);
  const t = await getTranslations('studio.tests');
  const tests = await listStudioTests();
  return (
    <Container className="flex flex-col gap-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="type-h1">{t('title')}</h1>
        <Link href="/studio/tests/new" className={buttonVariants()}>
          {t('new')}
        </Link>
      </div>
      {tests.length ? (
        <ul className="flex flex-col divide-y divide-border">
          {tests.map((test) => (
            <li key={test.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <Link href={`/studio/tests/${test.id}`} className="underline underline-offset-4">
                {test.test_texts.find((x) => x.locale === 'ru')?.title ?? '—'}
              </Link>
              <span className="flex items-center gap-2 text-sm text-text-muted">
                {t(`scopes.${test.scope}`)} · {t(`modes.${test.mode}`)}{' '}
                <StatusBadge status={test.status} />
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-text-muted">{t('empty')}</p>
      )}
    </Container>
  );
}
