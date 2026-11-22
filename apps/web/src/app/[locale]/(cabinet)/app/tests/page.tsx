import { Alert, Container } from '@knj/ui';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { listPublishedTests } from '@/features/tests/queries';
import { TestList } from '@/features/tests/test-list';
import { pageLocale } from '@/features/shell/page-locale';
import { requireUser } from '@/server/authz';
import { activePass } from '@/server/entitlements';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/app/tests'>): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale as 'ru', namespace: 'tests' });
  return { title: t('title'), robots: { index: false } };
}

export default async function TestsPage({
  params,
  searchParams,
}: PageProps<'/[locale]/app/tests'>) {
  const locale = await pageLocale(params);
  const user = await requireUser(locale, { roles: ['student'], next: `/${locale}/app/tests` });
  const t = await getTranslations('tests');
  const locked = (await searchParams).locked === '1';
  return (
    <Container className="flex flex-col gap-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
      {locked ? <Alert tone="info">{t('locked')}</Alert> : null}
      <TestList
        tests={await listPublishedTests(locale)}
        locale={locale}
        canStart
        hasPass={(await activePass(user.id)) !== null}
      />
    </Container>
  );
}
