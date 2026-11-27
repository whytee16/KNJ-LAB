import { Alert, Container } from '@knj/ui';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { BrandLink } from '@/features/shell/brand-link';
import { pageLocale } from '@/features/shell/page-locale';
import { currentDocument, type LegalType } from '@/server/legal';

const TYPES: LegalType[] = ['pd_processing', 'child_pd_processing', 'offer', 'terms'];

function isLegalType(v: string): v is LegalType {
  return (TYPES as string[]).includes(v);
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/legal/[type]'>): Promise<Metadata> {
  const { locale, type } = await params;
  if (!isLegalType(type)) return {};
  const doc = await currentDocument(type, locale === 'kk' ? 'kk' : 'ru');
  return doc ? { title: doc.title } : {};
}

/** Published legal text. Plain paragraphs only: no HTML is rendered from the database. */
export default async function LegalPage({ params }: PageProps<'/[locale]/legal/[type]'>) {
  const locale = await pageLocale(params);
  const { type } = await params;
  if (!isLegalType(type)) notFound();
  const t = await getTranslations('legal');
  const doc = await currentDocument(type, locale);

  return (
    <>
      <header className="border-b border-border">
        <Container className="flex h-16 items-center">
          <BrandLink />
        </Container>
      </header>
      <main id="main">
        <Container className="max-w-3xl py-10 md:py-16">
          {!doc ? (
            <Alert tone="info">{t('notPublished')}</Alert>
          ) : (
            <article className="flex flex-col gap-4" lang={doc.locale === 'kk' ? 'kk-KZ' : 'ru-KZ'}>
              {doc.isDraft ? <Alert tone="warning">{t('draft')}</Alert> : null}
              {doc.locale !== locale ? <Alert tone="info">{t('fallback')}</Alert> : null}
              <h1 className="type-h2">
                {doc.title}
              </h1>
              <p className="text-sm text-text-muted">{t('version', { version: doc.version })}</p>
              {doc.body.split(/\n{2,}/).map((para, i) => (
                <p key={i} className="whitespace-pre-line">
                  {para}
                </p>
              ))}
            </article>
          )}
        </Container>
      </main>
    </>
  );
}
