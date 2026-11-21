import { Alert } from '@knj/ui';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ConsentForm } from '@/features/auth/consent-form';
import { AuthShell } from '@/features/shell/auth-shell';
import { pageLocale } from '@/features/shell/page-locale';
import { requireUser } from '@/server/authz';
import { currentDocument } from '@/server/legal';
import { safeNext } from '@/server/redirects';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/consent'>): Promise<Metadata> {
  const t = await getTranslations({
    locale: (await params).locale as 'ru',
    namespace: 'auth.consent',
  });
  return { title: t('title'), robots: { index: false } };
}

export default async function ConsentPage({
  params,
  searchParams,
}: PageProps<'/[locale]/consent'>) {
  const locale = await pageLocale(params);
  const next = safeNext((await searchParams).next, locale, `/${locale}/parent`);
  await requireUser(locale, { roles: ['parent'], next: `/${locale}/consent` });
  const t = await getTranslations('auth');
  const policy = await currentDocument('pd_processing', locale);
  return (
    <AuthShell title={t('consent.title')} subtitle={t('consent.subtitle')}>
      {policy ? (
        <ConsentForm locale={locale} next={next} />
      ) : (
        <Alert tone="info">{t('errors.registrationUnavailable')}</Alert>
      )}
    </AuthShell>
  );
}
