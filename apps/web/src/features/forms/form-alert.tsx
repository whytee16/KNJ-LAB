'use client';

import { Alert } from '@knj/ui';
import type { FormState } from './form-state';
import { useMessage } from './use-message';

export function FormAlert({
  state,
  values,
}: {
  state: FormState;
  values?: Record<string, string>;
}) {
  const m = useMessage();
  if (state.status === 'idle' || !state.messageKey) return null;
  return (
    <Alert tone={state.status === 'error' ? 'error' : 'success'}>
      {m(state.messageKey, values)}
    </Alert>
  );
}
