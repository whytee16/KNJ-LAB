import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { VerifyForm } from '@/features/security/verify-form';
import { AuthShell } from '@/features/shell/auth-shell';
import { pageLocale } from '@/features/shell/page-locale';
import { requireUser } from '@/server/authz';
import { safeNext } from '@/server/redirects';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/security/verify'>): Promise<Metadata> {
  const t = await getTranslations({
    locale: (await params).locale as 'ru',
    namespace: 'security.verify',
  });
  return { title: t('title'), robots: { index: false } };
}

export default async function VerifyPage({
  params,
  searchParams,
}: PageProps<'/[locale]/security/verify'>) {
  const locale = await pageLocale(params);
  const next = safeNext((await searchParams).next, locale, `/${locale}/studio`);
  await requireUser(locale, { next: `/${locale}/security/verify` });
  const t = await getTranslations('security.verify');
  return (
    <AuthShell title={t('title')} subtitle={t('subtitle')}>
      <VerifyForm locale={locale} next={next} />
    </AuthShell>
  );
}
