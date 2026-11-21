import { Container } from '@knj/ui';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { UserRoles } from '@/features/studio/user-roles';
import { pageLocale } from '@/features/shell/page-locale';
import { requireStaff } from '@/server/authz';
import { getCurrentUser } from '@/server/authz';

export default async function UsersPage({ params }: PageProps<'/[locale]/studio/users'>) {
  const locale = await pageLocale(params);
  // Pages render in parallel with the layout: check access here before any query.
  await requireStaff(locale, `/${locale}/studio/users`);
  const user = await getCurrentUser();
  if (user?.role !== 'admin') redirect(`/${locale}/studio`);
  const t = await getTranslations('studio.users');
  return (
    <Container className="py-10">
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">{t('title')}</h1>
      <p className="mb-6 max-w-2xl text-text-muted">{t('subtitle')}</p>
      <UserRoles locale={locale} />
    </Container>
  );
}
