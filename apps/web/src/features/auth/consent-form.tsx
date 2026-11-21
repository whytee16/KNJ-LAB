'use client';

import type { Locale } from '@knj/i18n';
import { CheckboxField } from '@knj/ui';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { FormAlert } from '@/features/forms/form-alert';
import { idle } from '@/features/forms/form-state';
import { SubmitButton } from '@/features/forms/submit-button';
import { useMessage } from '@/features/forms/use-message';
import { Link } from '@/i18n/navigation';
import { acceptPolicy } from './actions';

export function ConsentForm({ locale, next }: { locale: Locale; next: string }) {
  const t = useTranslations('auth');
  const m = useMessage();
  const [state, action] = useActionState(acceptPolicy, idle);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={next} />
      <FormAlert state={state} />
      <CheckboxField
        name="consent"
        required
        error={m(state.fieldErrors?.consent)}
        label={
          <>
            {t('register.consentPrefix')}{' '}
            <Link
              href="/legal/pd_processing"
              target="_blank"
              className="underline underline-offset-4"
            >
              {t('register.consentLink')}
            </Link>
          </>
        }
      />
      <SubmitButton>{t('consent.submit')}</SubmitButton>
    </form>
  );
}
