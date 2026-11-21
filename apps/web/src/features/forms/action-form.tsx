'use client';

import type { ButtonProps } from '@knj/ui';
import { useActionState, type ReactNode } from 'react';
import { FormAlert } from './form-alert';
import { idle, type FormState } from './form-state';
import { SubmitButton } from './submit-button';

/** One-button form posting hidden fields to a Server Action, with its own status message. */
export function ActionForm({
  action,
  fields,
  label,
  variant = 'secondary',
  children,
  className,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  fields: Record<string, string>;
  label: string;
  variant?: ButtonProps['variant'];
  children?: ReactNode;
  className?: string;
}) {
  const [state, run] = useActionState(action, idle);
  return (
    <form action={run} className={className ?? 'flex flex-col gap-2'}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {children}
      <FormAlert state={state} />
      <SubmitButton variant={variant} size="sm">
        {label}
      </SubmitButton>
    </form>
  );
}
