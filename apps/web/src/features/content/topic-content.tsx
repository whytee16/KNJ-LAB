import type { Locale } from '@knj/i18n';
import { useTranslations } from 'next-intl';

/**
 * Topic body shared by the public page and the studio preview. `theoryHtml` must come from
 * renderMarkdown() (sanitized, KaTeX applied); nothing else is rendered as HTML.
 */
export function TopicContent({
  lang,
  title,
  summary,
  objectives,
  theoryHtml,
  mistakes,
  headingLevel = 2,
}: {
  lang: Locale;
  title: string;
  summary: string;
  objectives: string[];
  theoryHtml: string;
  mistakes: string[];
  headingLevel?: 1 | 2;
}) {
  const t = useTranslations('topic');
  const Title = headingLevel === 1 ? 'h1' : 'h2';
  const Sub = headingLevel === 1 ? 'h2' : 'h3';
  return (
    <article lang={lang === 'kk' ? 'kk-KZ' : 'ru-KZ'} className="flex max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Title className="type-h1">
          {title}
        </Title>
        {summary ? <p className="text-lg text-text-muted">{summary}</p> : null}
      </header>
      {objectives.length ? (
        <section className="rounded-lg border border-border bg-surface p-5">
          <Sub className="mb-3 text-lg font-semibold">{t('objectives')}</Sub>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            {objectives.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        </section>
      ) : null}
      <section>
        <Sub className="sr-only">{t('theory')}</Sub>
        <div className="prose-topic" dangerouslySetInnerHTML={{ __html: theoryHtml }} />
      </section>
      {mistakes.length ? (
        <section className="rounded-lg border border-warning/40 bg-warning/5 p-5">
          <Sub className="mb-3 text-lg font-semibold">{t('mistakes')}</Sub>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            {mistakes.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
