'use client';

import type { Locale } from '@knj/i18n';
import { Alert } from '@knj/ui';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { FormAlert } from '@/features/forms/form-alert';
import { idle } from '@/features/forms/form-state';
import { SubmitButton } from '@/features/forms/submit-button';
import {
  markLabBundleReviewed,
  markReviewed,
  markTopicBundleReviewed,
  publishLabBundle,
  publishTopicBundle,
  type BundleState,
} from './review-actions';

/**
 * Shown on automatically prepared drafts: they cannot be published until a reviewer confirms
 * that a teacher checked the text (enforced by the database).
 */
export function AiDraftNotice({
  locale,
  kind,
  id,
  lang = 'ru',
  canReview,
}: {
  locale: Locale;
  kind: 'topic' | 'lab' | 'template';
  id: string;
  lang?: Locale;
  canReview: boolean;
}) {
  const t = useTranslations('studio.aiDraft');
  const [state, action] = useActionState(markReviewed, idle);
  if (state.status === 'success') return <FormAlert state={state} />;
  return (
    <div className="flex flex-col gap-2" data-testid="ai-draft">
      <Alert tone="warning">
        <p className="font-semibold">{t('title')}</p>
        <p className="mt-1">{t(canReview ? 'textReviewer' : 'textManager')}</p>
        {kind === 'topic' && canReview ? <p className="mt-1">{t('topicPublishHint')}</p> : null}
      </Alert>
      {canReview ? (
        <form action={action}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="lang" value={lang} />
          <FormAlert state={state} />
          <SubmitButton size="sm" variant="secondary">
            {t('confirm')}
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}

/** Trace of an automatically prepared text that a teacher has checked. */
export function AiReviewedNote() {
  const t = useTranslations('studio.aiDraft');
  return (
    <p className="text-sm text-success" data-testid="ai-reviewed">
      {`✓ ${t('reviewed')}`}
    </p>
  );
}

/** Lab bundle: confirm the teacher's check for the texts and all questions, then publish together. */
export function LabBundlePanel({
  locale,
  labId,
  pendingReview,
  pendingPublish,
}: {
  locale: Locale;
  labId: string;
  pendingReview: number;
  pendingPublish: number;
}) {
  const t = useTranslations('studio.aiDraft');
  const [reviewState, review] = useActionState<BundleState, FormData>(markLabBundleReviewed, idle);
  const [publishState, publish] = useActionState<BundleState, FormData>(publishLabBundle, idle);
  if (!pendingReview && !pendingPublish && publishState.status !== 'success') return null;
  return (
    <div
      className="flex flex-col gap-2 rounded-md border border-border p-3"
      data-testid="lab-bundle"
    >
      <p className="text-sm font-medium">{t('bundleTitle')}</p>
      {reviewState.status === 'success' && publishState.status !== 'success' ? (
        <FormAlert state={reviewState} />
      ) : null}
      {publishState.status === 'success' ? <FormAlert state={publishState} /> : null}
      {pendingReview ? (
        <form action={review} className="flex flex-col gap-2">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="labId" value={labId} />
          <p className="text-sm text-text-muted">{t('bundleReviewHint')}</p>
          <FormAlert state={reviewState} />
          <SubmitButton size="sm" variant="secondary">
            {t('bundleReview', { count: pendingReview })}
          </SubmitButton>
        </form>
      ) : null}
      {!pendingReview && pendingPublish ? (
        <form action={publish} className="flex flex-col gap-2">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="labId" value={labId} />
          <FormAlert state={publishState} />
          <SubmitButton size="sm">{t('bundlePublish', { count: pendingPublish })}</SubmitButton>
        </form>
      ) : null}
    </div>
  );
}

/** Topic bundle: the topic text and all its task templates — confirm, then publish together. */
export function TopicBundlePanel({
  locale,
  topicId,
  pendingReview,
  pendingPublish,
}: {
  locale: Locale;
  topicId: string;
  pendingReview: number;
  pendingPublish: number;
}) {
  const t = useTranslations('studio.aiDraft');
  const [reviewState, review] = useActionState<BundleState, FormData>(
    markTopicBundleReviewed,
    idle,
  );
  const [publishState, publish] = useActionState<BundleState, FormData>(publishTopicBundle, idle);
  if (!pendingReview && !pendingPublish && publishState.status !== 'success') return null;
  return (
    <div
      className="flex flex-col gap-2 rounded-md border border-border p-3"
      data-testid="topic-bundle"
    >
      <p className="text-sm font-medium">{t('topicBundleTitle')}</p>
      {reviewState.status === 'success' && publishState.status !== 'success' ? (
        <FormAlert state={reviewState} />
      ) : null}
      {publishState.status === 'success' ? <FormAlert state={publishState} /> : null}
      {pendingReview ? (
        <form action={review} className="flex flex-col gap-2">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="topicId" value={topicId} />
          <FormAlert state={reviewState} />
          <SubmitButton size="sm" variant="secondary">
            {t('bundleReview', { count: pendingReview })}
          </SubmitButton>
        </form>
      ) : null}
      {!pendingReview && pendingPublish ? (
        <form action={publish} className="flex flex-col gap-2">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="topicId" value={topicId} />
          <FormAlert state={publishState} />
          <SubmitButton size="sm">
            {t('topicBundlePublish', { count: pendingPublish })}
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}
