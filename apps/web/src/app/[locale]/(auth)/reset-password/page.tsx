import { Alert } from '@knj/ui';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { NewPasswordForm } from '@/features/auth/new-password-form';
import { AuthShell } from '@/features/shell/auth-shell';
import { pageLocale } from '@/features/shell/page-locale';
import { Link } from '@/i18n/navigation';
import { getCurrentUser } from '@/server/authz';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/reset-password'>): Promise<Metadata> {
  const t = await getTranslations({
    locale: (await params).locale as 'ru',
    namespace: 'auth.reset',
  });
  return { title: t('title'), robots: { index: false } };
}

/** Reached from the recovery e-mail (via /auth/callback, which signs the user in). */
export default async function ResetPasswordPage({ params }: PageProps<'/[locale]/reset-password'>) {
  const locale = await pageLocale(params);
  const t = await getTranslations('auth');
  const user = await getCurrentUser();
  return (
    <AuthShell title={t('reset.title')}>
      {user ? (
        <NewPasswordForm locale={locale} />
      ) : (
        <div className="flex flex-col gap-4">
          <Alert tone="error">{t('errors.resetLinkExpired')}</Alert>
          <Link href="/forgot-password" className="underline underline-offset-4">
            {t('forgot.title')}
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
