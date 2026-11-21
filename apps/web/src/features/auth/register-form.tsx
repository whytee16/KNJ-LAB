'use client';

import type { Locale } from '@knj/i18n';
import { CheckboxField, TextField } from '@knj/ui';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { FormAlert } from '@/features/forms/form-alert';
import { idle } from '@/features/forms/form-state';
import { SubmitButton } from '@/features/forms/submit-button';
import { useMessage } from '@/features/forms/use-message';
import { Link } from '@/i18n/navigation';
import { registerParent } from './actions';

export function RegisterForm({ locale }: { locale: Locale }) {
  const t = useTranslations('auth.register');
  const m = useMessage();
  const [state, action] = useActionState(registerParent, idle);

  if (state.status === 'success') return <FormAlert state={state} />;

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <FormAlert state={state} />
      <TextField
        name="displayName"
        label={t('displayName')}
        autoComplete="name"
        maxLength={60}
        required
        defaultValue={state.values?.displayName}
        error={m(state.fieldErrors?.displayName)}
      />
      <TextField
        name="email"
        type="email"
        label={t('email')}
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        error={m(state.fieldErrors?.email)}
      />
      <TextField
        name="password"
        type="password"
        label={t('password')}
        hint={t('passwordHint')}
        autoComplete="new-password"
        required
        error={m(state.fieldErrors?.password)}
      />
      <CheckboxField
        name="consent"
        required
        defaultChecked={state.values?.consent === 'on'}
        error={m(state.fieldErrors?.consent)}
        label={
          <>
            {t('consentPrefix')}{' '}
            <Link
              href="/legal/pd_processing"
              target="_blank"
              className="underline underline-offset-4"
            >
              {t('consentLink')}
            </Link>
          </>
        }
      />
      <SubmitButton>{t('submit')}</SubmitButton>
    </form>
  );
}
