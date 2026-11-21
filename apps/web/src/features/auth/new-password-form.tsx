'use client';

import type { Locale } from '@knj/i18n';
import { TextField } from '@knj/ui';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { FormAlert } from '@/features/forms/form-alert';
import { idle } from '@/features/forms/form-state';
import { SubmitButton } from '@/features/forms/submit-button';
import { useMessage } from '@/features/forms/use-message';
import { updatePassword } from './actions';

export function NewPasswordForm({ locale }: { locale: Locale }) {
  const t = useTranslations('auth.reset');
  const m = useMessage();
  const [state, action] = useActionState(updatePassword, idle);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <FormAlert state={state} />
      <TextField
        name="password"
        type="password"
        label={t('password')}
        autoComplete="new-password"
        required
        error={m(state.fieldErrors?.password)}
      />
      <TextField
        name="confirm"
        type="password"
        label={t('confirm')}
        autoComplete="new-password"
        required
        error={m(state.fieldErrors?.confirm)}
      />
      <SubmitButton>{t('submit')}</SubmitButton>
    </form>
  );
}
