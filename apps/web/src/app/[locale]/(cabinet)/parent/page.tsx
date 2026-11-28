import { Container, SectionHeading } from '@knj/ui';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AddChildForm } from '@/features/parent/add-child-form';
import { ChildCard } from '@/features/parent/child-card';
import { listChildren } from '@/features/parent/queries';
import { childStats } from '@/features/parent/stats';
import { pageLocale } from '@/features/shell/page-locale';
import { requireParent } from '@/server/authz';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/parent'>): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale as 'ru', namespace: 'parent' });
  return { title: t('title'), robots: { index: false } };
}

export default async function ParentPage({ params }: PageProps<'/[locale]/parent'>) {
  const locale = await pageLocale(params);
  const user = await requireParent(locale, `/${locale}/parent`);
  const t = await getTranslations('parent');
  const children = await listChildren(user.id);
  const stats = await Promise.all(children.map((c) => childStats(c.id, locale)));

  return (
    <Container className="py-10 md:py-14">
      <p className="text-sm text-text-muted">{t('title')}</p>
      <h1 className="mt-1 type-h1">{t('greeting', { name: user.displayName })}</h1>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_380px]">
        <section aria-labelledby="children" className="min-w-0">
          <SectionHeading id="children" title={t('children.title')} className="mb-6 md:mb-6" />
          {children.length === 0 ? (
            <p className="text-text-muted">{t('children.empty')}</p>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {children.map((child, i) => (
                <li key={child.id}>
                  <ChildCard child={child} locale={locale} stats={stats[i]} />
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="add-child" className="min-w-0">
          <h2 id="add-child" className="text-xl font-semibold">
            {t('add.title')}
          </h2>
          <p className="mt-2 mb-6 text-sm text-text-muted">{t('add.subtitle')}</p>
          <AddChildForm locale={locale} />
        </section>
      </div>
    </Container>
  );
}
