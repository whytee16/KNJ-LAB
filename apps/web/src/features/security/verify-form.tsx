'use client';

import type { Locale } from '@knj/i18n';
import { TextField } from '@knj/ui';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { FormAlert } from '@/features/forms/form-alert';
import { idle } from '@/features/forms/form-state';
import { SubmitButton } from '@/features/forms/submit-button';
import { useMessage } from '@/features/forms/use-message';
import { verifyMfa } from './actions';

export function VerifyForm({ locale, next }: { locale: Locale; next: string }) {
  const t = useTranslations('security.verify');
  const m = useMessage();
  const [state, action] = useActionState(verifyMfa, idle);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={next} />
      <FormAlert state={state} />
      <TextField
        name="code"
        label={t('code')}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        autoFocus
        error={m(state.fieldErrors?.code)}
      />
      <SubmitButton>{t('submit')}</SubmitButton>
    </form>
  );
}
