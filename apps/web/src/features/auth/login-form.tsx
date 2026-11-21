'use client';

import type { Locale } from '@knj/i18n';
import { TextField } from '@knj/ui';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { FormAlert } from '@/features/forms/form-alert';
import { idle } from '@/features/forms/form-state';
import { SubmitButton } from '@/features/forms/submit-button';
import { useMessage } from '@/features/forms/use-message';
import { signIn } from './actions';

export function LoginForm({ locale, next }: { locale: Locale; next?: string }) {
  const t = useTranslations('auth.login');
  const m = useMessage();
  const [state, action] = useActionState(signIn, idle);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={next ?? ''} />
      <FormAlert state={state} />
      <TextField
        name="identifier"
        label={t('identifier')}
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        required
        defaultValue={state.values?.identifier}
        error={m(state.fieldErrors?.identifier)}
      />
      <TextField
        name="password"
        type="password"
        label={t('password')}
        autoComplete="current-password"
        required
        error={m(state.fieldErrors?.password)}
      />
      <SubmitButton>{t('submit')}</SubmitButton>
    </form>
  );
}
