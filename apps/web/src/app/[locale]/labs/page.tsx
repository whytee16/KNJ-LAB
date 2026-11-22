import { Container } from '@knj/ui';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { SUBJECTS } from '@/features/content/queries';
import { LabCard } from '@/features/labs/lab-card';
import { listLabs } from '@/features/labs/queries';
import { PublicShell } from '@/features/shell/public-shell';
import { pageLocale } from '@/features/shell/page-locale';

export async function generateMetadata({ params }: PageProps<'/[locale]/labs'>): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale as 'ru', namespace: 'labs' });
  return { title: t('catalogTitle'), description: t('catalogSubtitle') };
}

export default async function LabsPage({ params }: PageProps<'/[locale]/labs'>) {
  const locale = await pageLocale(params);
  const t = await getTranslations('labs');
  const s = await getTranslations('studio.subjects');
  const labs = await listLabs(locale);
  const groups = SUBJECTS.map((subject) => ({
    subject,
    labs: labs.filter((l) => l.subject === subject),
  })).filter((g) => g.labs.length);
  return (
    <PublicShell>
      <Container className="py-10 md:py-14">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{t('catalogTitle')}</h1>
        <p className="mt-2 max-w-2xl text-text-muted">{t('catalogSubtitle')}</p>
        {groups.length ? (
          groups.map((g) => (
            <section key={g.subject} aria-labelledby={`labs-${g.subject}`} className="mt-10">
              <h2 id={`labs-${g.subject}`} className="mb-4 text-2xl font-semibold">
                {s(g.subject)}
              </h2>
              <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {g.labs.map((lab) => (
                  <li key={lab.id}>
                    <LabCard lab={lab} />
                  </li>
                ))}
              </ul>
            </section>
          ))
        ) : (
          <p className="mt-8 text-text-muted">{t('empty')}</p>
        )}
      </Container>
    </PublicShell>
  );
}
