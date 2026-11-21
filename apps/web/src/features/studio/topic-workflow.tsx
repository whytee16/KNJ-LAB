'use client';

import type { Locale } from '@knj/i18n';
import { useTranslations } from 'next-intl';
import { useActionState, useId } from 'react';
import { FormAlert } from '@/features/forms/form-alert';
import { idle } from '@/features/forms/form-state';
import { SubmitButton } from '@/features/forms/submit-button';
import { useMessage } from '@/features/forms/use-message';
import { runTopicWorkflow } from './topic-actions';

export function TopicWorkflow({
  locale,
  topicId,
  lang,
  status,
  isPublished,
  canReview,
  hasDraft,
}: {
  locale: Locale;
  topicId: string;
  lang: Locale;
  status: 'draft' | 'in_review' | 'approved' | null;
  isPublished: boolean;
  canReview: boolean;
  hasDraft: boolean;
}) {
  const t = useTranslations('studio.topic');
  const m = useMessage();
  const noteId = useId();
  const [state, action] = useActionState(runTopicWorkflow, idle);
  const hidden = (intent: string) => (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="topicId" value={topicId} />
      <input type="hidden" name="contentLocale" value={lang} />
      <input type="hidden" name="intent" value={intent} />
    </>
  );
  return (
    <div className="flex flex-col gap-4">
      <FormAlert state={state} />
      {hasDraft && status === 'draft' ? (
        <form action={action}>
          {hidden('submit')}
          <SubmitButton size="sm">{t('submit')}</SubmitButton>
        </form>
      ) : null}
      {canReview && status === 'in_review' ? (
        <>
          <form action={action}>
            {hidden('publish')}
            <SubmitButton size="sm">{t('publish')}</SubmitButton>
          </form>
          <form action={action} className="flex flex-col gap-2">
            {hidden('requestChanges')}
            <label htmlFor={noteId} className="text-sm font-medium">
              {t('note')}
            </label>
            <textarea
              id={noteId}
              name="note"
              rows={3}
              className="rounded-md border border-border bg-surface p-2 text-sm"
            />
            {state.fieldErrors?.note ? (
              <p className="text-sm text-danger">{m(state.fieldErrors.note)}</p>
            ) : null}
            <SubmitButton size="sm" variant="secondary">
              {t('requestChanges')}
            </SubmitButton>
          </form>
        </>
      ) : null}
      {canReview && isPublished ? (
        <form action={action}>
          {hidden('unpublish')}
          <SubmitButton size="sm" variant="secondary">
            {t('unpublish')}
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}
