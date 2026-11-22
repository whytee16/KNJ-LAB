'use client';

import type { Locale } from '@knj/i18n';
import { Alert } from '@knj/ui';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { FormAlert } from '@/features/forms/form-alert';
import { idle } from '@/features/forms/form-state';
import { SubmitButton } from '@/features/forms/submit-button';
import { markReviewed } from './review-actions';

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
