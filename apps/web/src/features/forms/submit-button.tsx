'use client';

import { Button, type ButtonProps } from '@knj/ui';
import { useTranslations } from 'next-intl';
import { useFormStatus } from 'react-dom';

/** Submit button that disables itself and shows progress while the action runs. */
export function SubmitButton({ children, ...props }: Omit<ButtonProps, 'type'>) {
  const { pending } = useFormStatus();
  const t = useTranslations('common');
  return (
    <Button type="submit" disabled={pending} aria-disabled={pending} {...props}>
      {pending ? t('pending') : children}
    </Button>
  );
}
