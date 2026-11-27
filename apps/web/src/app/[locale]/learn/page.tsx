import { Card, Container } from '@knj/ui';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { GRADES, SUBJECTS } from '@/features/content/queries';
import { PublicShell } from '@/features/shell/public-shell';
import { pageLocale } from '@/features/shell/page-locale';
import { Link } from '@/i18n/navigation';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/learn'>): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale as 'ru', namespace: 'learn' });
  return { title: t('title') };
}

export default async function LearnPage({ params }: PageProps<'/[locale]/learn'>) {
  await pageLocale(params);
  const t = await getTranslations('learn');
  const s = await getTranslations('studio.subjects');
  return (
    <PublicShell>
      <Container className="py-10 md:py-14">
        <h1 className="type-h1">{t('title')}</h1>
        <p className="mt-2 max-w-2xl text-text-muted">{t('subtitle')}</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {SUBJECTS.map((subject) => (
            <Card key={subject} className="flex flex-col gap-4">
              <h2 className="text-xl font-semibold">{s(subject)}</h2>
              <ul className="flex flex-wrap gap-2">
                {GRADES.map((g) => (
                  <li key={g}>
                    <Link
                      href={`/learn/${subject}/${g}`}
                      className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm hover:bg-surface-muted"
                    >
                      {t('grade', { grade: g })}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </Container>
    </PublicShell>
  );
}
