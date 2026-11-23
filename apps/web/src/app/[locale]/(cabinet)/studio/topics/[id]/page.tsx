import { isLocale, localeNames } from '@knj/i18n';
import { Alert, Card, Container, cn } from '@knj/ui';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { TopicContent } from '@/features/content/topic-content';
import { AiDraftNotice, AiReviewedNote, TopicBundlePanel } from '@/features/studio/ai-draft-notice';
import { createUserClient } from '@/lib/supabase/server';
import { StatusBadge } from '@/features/studio/status-badge';
import { TopicEditor } from '@/features/studio/topic-editor';
import { TopicWorkflow } from '@/features/studio/topic-workflow';
import { getTopicForEditor } from '@/features/studio/queries';
import { pageLocale } from '@/features/shell/page-locale';
import { requireStaff } from '@/server/authz';
import { Link } from '@/i18n/navigation';
import { renderMarkdown } from '@/lib/content/markdown';
import { getCurrentUser } from '@/server/authz';
import { REVIEW_ROLES } from '@/server/redirects';

export default async function TopicEditorPage({
  params,
  searchParams,
}: PageProps<'/[locale]/studio/topics/[id]'>) {
  const locale = await pageLocale(params);
  // Pages render in parallel with the layout: check access here before any query.
  await requireStaff(locale, `/${locale}/studio/topics/${(await params).id}`);
  const { id } = await params;
  const langParam = (await searchParams).lang;
  const lang = typeof langParam === 'string' && isLocale(langParam) ? langParam : 'ru';
  const topic = await getTopicForEditor(id);
  if (!topic) notFound();

  const t = await getTranslations('studio.topic');
  const user = await getCurrentUser();
  const draft = topic.topic_drafts.find((d) => d.locale === lang);
  const published = topic.topic_contents.find((c) => c.locale === lang);
  const ruTitle = topic.topic_drafts.find((d) => d.locale === 'ru')?.title ?? topic.slug;
  const preview = draft ? await renderMarkdown(draft.theory) : null;
  const canReview = user ? REVIEW_ROLES.includes(user.role) : false;
  const { data: templates } = await (
    await createUserClient()
  )
    .from('task_templates')
    .select('status, content_origin')
    .eq('topic_id', id);
  const ruDraft = topic.topic_drafts.find((d) => d.locale === 'ru');
  const ruPublished = topic.topic_contents.some((c) => c.locale === 'ru');

  return (
    <Container className="flex flex-col gap-8 py-10">
      <div>
        <p className="font-mono text-sm text-text-muted">{topic.slug}</p>
        <h1 className="text-3xl font-semibold tracking-tight">{ruTitle}</h1>
      </div>

      <nav aria-label={t('languages')} className="flex gap-2">
        {(['ru', 'kk'] as const).map((l) => (
          <Link
            key={l}
            href={`/studio/topics/${id}?lang=${l}`}
            aria-current={l === lang ? 'page' : undefined}
            className={cn(
              'rounded-md border border-border px-3 py-2 text-sm',
              l === lang && 'bg-text text-bg',
            )}
          >
            {localeNames[l]}
          </Link>
        ))}
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <section aria-labelledby="draft" className="min-w-0">
          <h2 id="draft" className="mb-4 text-xl font-semibold">
            {t('draftHeading')}
          </h2>
          <TopicEditor
            locale={locale}
            topicId={id}
            lang={lang}
            initial={{
              title: draft?.title ?? (lang === 'ru' ? ruTitle : ''),
              summary: draft?.summary ?? '',
              objectives: (draft?.objectives ?? []).join('\n'),
              theory: draft?.theory ?? '',
              mistakes: (draft?.mistakes ?? []).join('\n'),
              isMachineTranslation: draft?.is_machine_translation ?? false,
            }}
          />
        </section>

        <aside className="flex flex-col gap-4">
          <Card className="flex flex-col gap-3 p-4">
            <h2 className="font-semibold">{t('statusHeading')}</h2>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {t('draftLabel')} <StatusBadge status={draft?.status ?? 'none'} />
            </div>
            <p className="text-sm text-text-muted">
              {published
                ? t('publishedVersion', { version: published.version })
                : t('notPublished')}
            </p>
            {draft?.content_origin === 'ai_draft' ? (
              <AiDraftNotice
                locale={locale}
                kind="topic"
                id={id}
                lang={lang}
                canReview={user ? REVIEW_ROLES.includes(user.role) : false}
              />
            ) : draft?.content_origin === 'ai_reviewed' ? (
              <AiReviewedNote />
            ) : null}
            {draft?.is_machine_translation ? (
              <Alert tone="warning">{t('machineWarning')}</Alert>
            ) : null}
            {draft?.review_note ? (
              <Alert tone="info">
                <span className="font-medium">{t('reviewNote')}:</span> {draft.review_note}
              </Alert>
            ) : null}
            {canReview &&
            (ruDraft?.content_origin !== 'human' ||
              (templates ?? []).some((x) => x.content_origin !== 'human')) ? (
              <TopicBundlePanel
                locale={locale}
                topicId={id}
                pendingReview={
                  (ruDraft?.content_origin === 'ai_draft' ? 1 : 0) +
                  (templates ?? []).filter((x) => x.content_origin === 'ai_draft').length
                }
                pendingPublish={
                  (templates ?? []).filter((x) => x.status !== 'published').length +
                  (ruDraft && (ruDraft.status !== 'approved' || !ruPublished) ? 1 : 0)
                }
              />
            ) : null}
            <TopicWorkflow
              locale={locale}
              topicId={id}
              lang={lang}
              status={draft?.status ?? null}
              isPublished={Boolean(published)}
              canReview={user ? REVIEW_ROLES.includes(user.role) : false}
              hasDraft={Boolean(draft?.theory.trim())}
            />
          </Card>
        </aside>
      </div>

      {draft && preview ? (
        <section aria-labelledby="preview" className="border-t border-border pt-8">
          <h2 id="preview" className="mb-4 text-xl font-semibold">
            {t('preview')}
          </h2>
          {preview.mathErrors.length ? (
            <Alert tone="error" className="mb-4">
              {t('mathErrors')}: {preview.mathErrors.join('; ')}
            </Alert>
          ) : null}
          <TopicContent
            lang={lang}
            title={draft.title}
            summary={draft.summary}
            objectives={draft.objectives}
            theoryHtml={preview.html}
            mistakes={draft.mistakes}
          />
        </section>
      ) : null}
    </Container>
  );
}
