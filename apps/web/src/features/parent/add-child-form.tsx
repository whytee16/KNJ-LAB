'use client';

import type { Locale } from '@knj/i18n';
import { CheckboxField, SelectField, TextField } from '@knj/ui';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { FormAlert } from '@/features/forms/form-alert';
import { idle } from '@/features/forms/form-state';
import { SubmitButton } from '@/features/forms/submit-button';
import { useMessage } from '@/features/forms/use-message';
import { Link } from '@/i18n/navigation';
import { createChild } from './actions';

const GRADES = [7, 8, 9, 10, 11];

export function AddChildForm({ locale }: { locale: Locale }) {
  const t = useTranslations('parent');
  const m = useMessage();
  const [state, action] = useActionState(createChild, idle);
  // After success the form is re-mounted empty (key) and the message stays above it.
  const formKey = state.status === 'success' ? state.values?.username : 'form';
  return (
    <div className="flex flex-col gap-4">
      <FormAlert state={state} values={state.values} />
      <form key={formKey} action={action} className="flex flex-col gap-4" noValidate>
        <input type="hidden" name="locale" value={locale} />
        <TextField
          name="displayName"
          label={t('add.displayName')}
          hint={t('add.displayNameHint')}
          maxLength={60}
          required
          defaultValue={state.status === 'error' ? state.values?.displayName : undefined}
          error={m(state.fieldErrors?.displayName)}
        />
        <TextField
          name="username"
          label={t('add.username')}
          hint={t('add.usernameHint')}
          autoCapitalize="none"
          autoComplete="off"
          spellCheck={false}
          maxLength={32}
          required
          defaultValue={state.status === 'error' ? state.values?.username : undefined}
          error={m(state.fieldErrors?.username)}
        />
        <SelectField
          name="grade"
          label={t('add.grade')}
          defaultValue={state.status === 'error' ? state.values?.grade : '7'}
          error={m(state.fieldErrors?.grade)}
          options={GRADES.map((g) => ({
            value: String(g),
            label: t('children.gradeValue', { grade: g }),
          }))}
        />
        <TextField
          name="password"
          type="password"
          label={t('add.password')}
          hint={t('add.passwordHint')}
          autoComplete="new-password"
          required
          error={m(state.fieldErrors?.password)}
        />
        <CheckboxField
          name="consent"
          required
          error={m(state.fieldErrors?.consent)}
          label={
            <>
              {t('add.consentPrefix')}{' '}
              <Link
                href="/legal/child_pd_processing"
                target="_blank"
                className="underline underline-offset-4"
              >
                {t('add.consentLink')}
              </Link>
            </>
          }
        />
        <SubmitButton>{t('add.submit')}</SubmitButton>
      </form>
    </div>
  );
}
