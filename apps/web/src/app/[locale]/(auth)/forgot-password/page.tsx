import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ForgotForm } from '@/features/auth/forgot-form';
import { AuthShell } from '@/features/shell/auth-shell';
import { pageLocale } from '@/features/shell/page-locale';
import { Link } from '@/i18n/navigation';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/forgot-password'>): Promise<Metadata> {
  const t = await getTranslations({
    locale: (await params).locale as 'ru',
    namespace: 'auth.forgot',
  });
  return { title: t('title'), robots: { index: false } };
}

export default async function ForgotPasswordPage({
  params,
}: PageProps<'/[locale]/forgot-password'>) {
  const locale = await pageLocale(params);
  const t = await getTranslations('auth.forgot');
  return (
    <AuthShell
      title={t('title')}
      subtitle={t('subtitle')}
      footer={
        <Link href="/login" className="underline underline-offset-4">
          {t('backToLogin')}
        </Link>
      }
    >
      <ForgotForm locale={locale} />
    </AuthShell>
  );
}
