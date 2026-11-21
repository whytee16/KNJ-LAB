import { Alert } from '@knj/ui';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/features/auth/login-form';
import { AuthShell } from '@/features/shell/auth-shell';
import { pageLocale } from '@/features/shell/page-locale';
import { Link } from '@/i18n/navigation';
import { env } from '@/lib/env';
import { getCurrentUser } from '@/server/authz';
import { dashboardPath, safeNext } from '@/server/redirects';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/login'>): Promise<Metadata> {
  const t = await getTranslations({
    locale: (await params).locale as 'ru',
    namespace: 'auth.login',
  });
  return { title: t('title'), robots: { index: false } };
}

export default async function LoginPage({ params, searchParams }: PageProps<'/[locale]/login'>) {
  const locale = await pageLocale(params);
  const query = await searchParams;
  const next = safeNext(query.next, locale, '');
  const user = await getCurrentUser();
  if (user) redirect(next || dashboardPath(user.role, locale));

  const t = await getTranslations('auth.login');
  return (
    <AuthShell
      title={t('title')}
      subtitle={t('subtitle')}
      footer={
        <div className="flex flex-col gap-2">
          <Link href="/forgot-password" className="underline underline-offset-4">
            {t('forgot')}
          </Link>
          {env().REGISTRATION_ENABLED ? (
            <p className="text-text-muted">
              {t('noAccount')}{' '}
              <Link href="/register" className="text-text underline underline-offset-4">
                {t('registerLink')}
              </Link>
            </p>
          ) : null}
        </div>
      }
    >
      {query.error === 'link' ? (
        <Alert tone="error" className="mb-4">
          {t('linkError')}
        </Alert>
      ) : null}
      <LoginForm locale={locale} next={next || undefined} />
    </AuthShell>
  );
}
