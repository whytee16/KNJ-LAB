import { Container } from '@knj/ui';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { getCurriculum, GRADES, isSubject } from '@/features/content/queries';
import { PublicShell } from '@/features/shell/public-shell';
import { pageLocale } from '@/features/shell/page-locale';
import { Link } from '@/i18n/navigation';

async function parse(params: Promise<{ locale: string; subject: string; grade: string }>) {
  const { subject, grade } = await params;
  const g = Number(grade);
  if (!isSubject(subject) || !(GRADES as readonly number[]).includes(g)) notFound();
  return { subject, grade: g };
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/learn/[subject]/[grade]'>): Promise<Metadata> {
  const { subject, grade } = await parse(params);
  const locale = (await params).locale as 'ru';
  const t = await getTranslations({ locale, namespace: 'learn' });
  const s = await getTranslations({ locale, namespace: 'studio.subjects' });
  return { title: `${s(subject)} · ${t('grade', { grade })}` };
}

export default async function SubjectGradePage({
  params,
}: PageProps<'/[locale]/learn/[subject]/[grade]'>) {
  const locale = await pageLocale(params);
  const { subject, grade } = await parse(params);
  const t = await getTranslations('learn');
  const s = await getTranslations('studio.subjects');
  const quarters = (await getCurriculum(subject, grade, locale)).map((q) => ({
    ...q,
    sections: q.sections
      .map((sec) => ({ ...sec, topics: sec.topics.filter((tp) => tp.published) }))
      .filter((sec) => sec.topics.length),
  }));
  const empty = quarters.every((q) => q.sections.length === 0);

  return (
    <PublicShell>
      <Container className="py-10 md:py-14">
        <nav aria-label={t('breadcrumbs')} className="text-sm text-text-muted">
          <Link href="/learn" className="underline underline-offset-4">
            {t('title')}
          </Link>
        </nav>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
          {s(subject)} · {t('grade', { grade })}
        </h1>
        {empty ? (
          <p className="mt-6 max-w-2xl text-text-muted">{t('empty')}</p>
        ) : (
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {quarters
              .filter((q) => q.sections.length)
              .map((q) => (
                <section
                  key={q.quarter}
                  aria-labelledby={`quarter-${q.quarter}`}
                  className="rounded-lg border border-border bg-surface p-5"
                >
                  <h2 id={`quarter-${q.quarter}`} className="text-lg font-semibold">
                    {t('quarter', { quarter: q.quarter })}
                  </h2>
                  {q.sections.map((sec) => (
                    <div key={sec.id} className="mt-4">
                      <h3 className="text-sm font-semibold text-text-muted">{sec.title}</h3>
                      <ul className="mt-2 flex flex-col gap-1">
                        {sec.topics.map((tp) => (
                          <li key={tp.id}>
                            <Link
                              href={`/topics/${tp.slug}`}
                              className="underline underline-offset-4"
                            >
                              {tp.title}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </section>
              ))}
          </div>
        )}
        <p className="mt-8 text-sm text-text-muted">{t('ktpNote')}</p>
      </Container>
    </PublicShell>
  );
}
