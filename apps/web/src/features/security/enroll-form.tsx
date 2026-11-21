'use client';

import type { Locale } from '@knj/i18n';
import { TextField } from '@knj/ui';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { FormAlert } from '@/features/forms/form-alert';
import { idle } from '@/features/forms/form-state';
import { SubmitButton } from '@/features/forms/submit-button';
import { useMessage } from '@/features/forms/use-message';
import { confirmEnrollment, startEnrollment, type EnrollmentState } from './actions';

export function EnrollForm({ locale, next }: { locale: Locale; next: string }) {
  const t = useTranslations('security.enroll');
  const m = useMessage();
  const [started, start] = useActionState<EnrollmentState, FormData>(startEnrollment, idle);
  const [state, confirm] = useActionState<EnrollmentState, FormData>(confirmEnrollment, started);
  const current = state.factorId ? state : started;

  if (!current.factorId) {
    return (
      <form action={start} className="flex flex-col gap-4">
        <input type="hidden" name="locale" value={locale} />
        <FormAlert state={started} />
        <SubmitButton>{t('start')}</SubmitButton>
      </form>
    );
  }

  return (
    <form action={confirm} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="factorId" value={current.factorId} />
      <input type="hidden" name="next" value={next} />
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">
        <li>{t('step1')}</li>
        <li>{t('step2')}</li>
      </ol>
      {/* QR is an SVG data URI returned by the auth server. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={current.qr}
        alt={t('qrAlt')}
        width={192}
        height={192}
        className="self-center rounded-md bg-white p-2"
      />
      <p className="text-sm text-text-muted">
        {t('manual')}{' '}
        <code className="font-mono break-all text-text" data-testid="totp-secret">
          {current.secret}
        </code>
      </p>
      <FormAlert state={state} />
      <TextField
        name="code"
        label={t('code')}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        error={m(state.fieldErrors?.code)}
      />
      <SubmitButton>{t('confirm')}</SubmitButton>
    </form>
  );
}
