import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { EnrollForm } from '@/features/security/enroll-form';
import { AuthShell } from '@/features/shell/auth-shell';
import { pageLocale } from '@/features/shell/page-locale';
import { requireUser } from '@/server/authz';
import { safeNext, STUDIO_ROLES } from '@/server/redirects';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/security/enroll'>): Promise<Metadata> {
  const t = await getTranslations({
    locale: (await params).locale as 'ru',
    namespace: 'security.enroll',
  });
  return { title: t('title'), robots: { index: false } };
}

export default async function EnrollPage({
  params,
  searchParams,
}: PageProps<'/[locale]/security/enroll'>) {
  const locale = await pageLocale(params);
  const next = safeNext((await searchParams).next, locale, `/${locale}/studio`);
  await requireUser(locale, { roles: STUDIO_ROLES, next: `/${locale}/security/enroll` });
  const t = await getTranslations('security.enroll');
  return (
    <AuthShell title={t('title')} subtitle={t('subtitle')}>
      <EnrollForm locale={locale} next={next} />
    </AuthShell>
  );
}
