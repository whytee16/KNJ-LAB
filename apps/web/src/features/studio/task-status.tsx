'use client';

import type { Locale } from '@knj/i18n';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { FormAlert } from '@/features/forms/form-alert';
import { idle } from '@/features/forms/form-state';
import { SubmitButton } from '@/features/forms/submit-button';
import { deleteTaskTemplate, setTaskTemplateStatus, type TaskEditorState } from './task-actions';
import { ValidationReportView } from './task-editor';

export function TaskStatusPanel({
  locale,
  templateId,
  status,
  canReview,
}: {
  locale: Locale;
  templateId: string;
  status: 'draft' | 'in_review' | 'published';
  canReview: boolean;
}) {
  const t = useTranslations('studio');
  const [state, action] = useActionState<TaskEditorState, FormData>(setTaskTemplateStatus, idle);
  const [delState, del] = useActionState<TaskEditorState, FormData>(deleteTaskTemplate, idle);
  const button = (target: string, label: string, primary = false) => (
    <form action={action}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="templateId" value={templateId} />
      <input type="hidden" name="status" value={target} />
      <SubmitButton size="sm" variant={primary ? 'primary' : 'secondary'}>
        {label}
      </SubmitButton>
    </form>
  );
  return (
    <div className="flex flex-col gap-3">
      <FormAlert state={state} />
      {state.report && !state.report.ok ? <ValidationReportView report={state.report} /> : null}
      {status === 'draft' ? button('in_review', t('formula.submit'), true) : null}
      {canReview && status !== 'published' ? button('published', t('formula.publish'), true) : null}
      {canReview && status !== 'draft' ? button('draft', t('formula.backToDraft')) : null}
      {status === 'draft' || canReview ? (
        <details>
          <summary className="cursor-pointer text-sm font-medium text-danger">
            {t('task.delete')}
          </summary>
          <form action={del} className="flex flex-col gap-2 pt-3">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="templateId" value={templateId} />
            <FormAlert state={delState} />
            <SubmitButton size="sm" variant="secondary">
              {t('formula.deleteConfirm')}
            </SubmitButton>
          </form>
        </details>
      ) : null}
    </div>
  );
}
