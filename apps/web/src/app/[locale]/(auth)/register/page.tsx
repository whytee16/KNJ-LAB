import { Alert } from '@knj/ui';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { RegisterForm } from '@/features/auth/register-form';
import { AuthShell } from '@/features/shell/auth-shell';
import { pageLocale } from '@/features/shell/page-locale';
import { Link } from '@/i18n/navigation';
import { env } from '@/lib/env';
import { getCurrentUser } from '@/server/authz';
import { currentDocument } from '@/server/legal';
import { dashboardPath } from '@/server/redirects';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/register'>): Promise<Metadata> {
  const t = await getTranslations({
    locale: (await params).locale as 'ru',
    namespace: 'auth.register',
  });
  return { title: t('title'), robots: { index: false } };
}

export default async function RegisterPage({ params }: PageProps<'/[locale]/register'>) {
  const locale = await pageLocale(params);
  const user = await getCurrentUser();
  if (user) redirect(dashboardPath(user.role, locale));

  const t = await getTranslations('auth');
  const open = env().REGISTRATION_ENABLED;
  const policy = open ? await currentDocument('pd_processing', locale) : null;

  return (
    <AuthShell
      title={t('register.title')}
      subtitle={t('register.subtitle')}
      footer={
        <p className="text-text-muted">
          {t('register.haveAccount')}{' '}
          <Link href="/login" className="text-text underline underline-offset-4">
            {t('register.loginLink')}
          </Link>
        </p>
      }
    >
      {!open ? (
        <Alert tone="info">{t('register.closed')}</Alert>
      ) : !policy ? (
        <Alert tone="info">{t('errors.registrationUnavailable')}</Alert>
      ) : (
        <RegisterForm locale={locale} />
      )}
    </AuthShell>
  );
}
