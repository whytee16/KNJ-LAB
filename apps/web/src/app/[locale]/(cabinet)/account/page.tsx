import { Card, Container } from '@knj/ui';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { pageLocale } from '@/features/shell/page-locale';
import { requireUser } from '@/server/authz';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/account'>): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale as 'ru', namespace: 'account' });
  return { title: t('title'), robots: { index: false } };
}

/** Landing page for staff roles until their tools exist (content: stage 3). */
export default async function AccountPage({ params }: PageProps<'/[locale]/account'>) {
  const locale = await pageLocale(params);
  const user = await requireUser(locale, {
    roles: ['admin', 'content_manager', 'reviewer', 'support'],
    next: `/${locale}/account`,
  });
  const t = await getTranslations('account');
  return (
    <Container className="py-10 md:py-14">
      <h1 className="type-h1">{t('title')}</h1>
      <Card className="mt-8 max-w-xl">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
          <dt className="text-text-muted">{t('role')}</dt>
          <dd>{t(`roles.${user.role}`)}</dd>
        </dl>
        <p className="mt-4 text-sm text-text-muted">{t('staffNote')}</p>
      </Card>
    </Container>
  );
}
