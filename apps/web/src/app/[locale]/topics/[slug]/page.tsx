import { Alert, Container } from '@knj/ui';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { getTopicPage } from '@/features/content/queries';
import { TopicContent } from '@/features/content/topic-content';
import { PublicShell } from '@/features/shell/public-shell';
import { pageLocale } from '@/features/shell/page-locale';
import { Link } from '@/i18n/navigation';
import { renderMarkdown } from '@/lib/content/markdown';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/topics/[slug]'>): Promise<Metadata> {
  const { locale, slug } = await params;
  const topic = await getTopicPage(slug, locale === 'kk' ? 'kk' : 'ru');
  return topic ? { title: topic.title, description: topic.summary || undefined } : {};
}

export default async function TopicPage({ params }: PageProps<'/[locale]/topics/[slug]'>) {
  const locale = await pageLocale(params);
  const { slug } = await params;
  const topic = await getTopicPage(slug, locale);
  if (!topic) notFound();
  const t = await getTranslations('topic');
  const learn = await getTranslations('learn');
  const s = await getTranslations('studio.subjects');
  const { html } = await renderMarkdown(topic.theory);

  return (
    <PublicShell>
      <Container className="py-10 md:py-14">
        <nav
          aria-label={learn('breadcrumbs')}
          className="mb-6 flex flex-wrap gap-x-2 text-sm text-text-muted"
        >
          <Link href="/learn" className="underline underline-offset-4">
            {learn('title')}
          </Link>
          <span aria-hidden="true">/</span>
          {topic.placement ? (
            <>
              <Link
                href={`/learn/${topic.subject}/${topic.placement.grade}`}
                className="underline underline-offset-4"
              >
                {s(topic.subject)} · {learn('grade', { grade: topic.placement.grade })}
              </Link>
              <span aria-hidden="true">/</span>
              <span>
                {learn('quarter', { quarter: topic.placement.quarter })} · {topic.placement.section}
              </span>
            </>
          ) : (
            <span>{s(topic.subject)}</span>
          )}
        </nav>
        {topic.locale !== locale ? (
          <Alert tone="info" className="mb-6 max-w-3xl">
            {t('fallback')}
          </Alert>
        ) : null}
        <TopicContent
          lang={topic.locale}
          title={topic.title}
          summary={topic.summary}
          objectives={topic.objectives}
          theoryHtml={html}
          mistakes={topic.mistakes}
          headingLevel={1}
        />
        <p className="mt-10 max-w-3xl border-t border-border pt-6 text-sm text-text-muted">
          {t('practiceSoon')}
        </p>
      </Container>
    </PublicShell>
  );
}
