'use client';

import type { Locale } from '@knj/i18n';
import { TextField } from '@knj/ui';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { FormAlert } from '@/features/forms/form-alert';
import { idle } from '@/features/forms/form-state';
import { SubmitButton } from '@/features/forms/submit-button';
import { useMessage } from '@/features/forms/use-message';
import { requestPasswordReset } from './actions';

export function ForgotForm({ locale }: { locale: Locale }) {
  const t = useTranslations('auth.forgot');
  const m = useMessage();
  const [state, action] = useActionState(requestPasswordReset, idle);
  if (state.status === 'success') return <FormAlert state={state} />;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <FormAlert state={state} />
      <TextField
        name="email"
        type="email"
        label={t('email')}
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        error={m(state.fieldErrors?.email)}
      />
      <SubmitButton>{t('submit')}</SubmitButton>
    </form>
  );
}
