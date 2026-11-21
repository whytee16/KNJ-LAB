'use client';

import type { Locale } from '@knj/i18n';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { FormAlert } from '@/features/forms/form-alert';
import { idle } from '@/features/forms/form-state';
import { SubmitButton } from '@/features/forms/submit-button';
import { setFormulaStatus } from './formula-actions';

/** All status buttons share one state, so the result message survives the re-render. */
export function FormulaStatusPanel({
  locale,
  formulaId,
  status,
  canReview,
}: {
  locale: Locale;
  formulaId: string;
  status: 'draft' | 'in_review' | 'published';
  canReview: boolean;
}) {
  const t = useTranslations('studio.formula');
  const [state, action] = useActionState(setFormulaStatus, idle);
  const button = (target: string, label: string, primary = false) => (
    <form action={action}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="formulaId" value={formulaId} />
      <input type="hidden" name="status" value={target} />
      <SubmitButton size="sm" variant={primary ? 'primary' : 'secondary'}>
        {label}
      </SubmitButton>
    </form>
  );
  return (
    <div className="flex flex-col gap-3">
      <FormAlert state={state} />
      {status === 'draft' ? button('in_review', t('submit'), true) : null}
      {canReview && status !== 'published' ? button('published', t('publish'), true) : null}
      {canReview && status !== 'draft' ? button('draft', t('backToDraft')) : null}
    </div>
  );
}
