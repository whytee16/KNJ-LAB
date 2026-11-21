import type { z } from 'zod';

/**
 * Result of a form Server Action. Messages are i18n keys, never text (I18N.md).
 * `values` echoes non-secret fields so the form keeps them after an error.
 */
export interface FormState {
  status: 'idle' | 'error' | 'success';
  messageKey?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
}

export const idle: FormState = { status: 'idle' };

export function fromZodError(error: z.ZodError, values: Record<string, string>): FormState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? 'form');
    fieldErrors[field] ??= issue.message;
  }
  return { status: 'error', messageKey: 'validation.fixErrors', fieldErrors, values };
}

export function errorState(messageKey: string, values?: Record<string, string>): FormState {
  return { status: 'error', messageKey, values };
}

/** Reads string fields from FormData; files and missing fields become ''. */
export function readFields<K extends string>(
  form: FormData,
  keys: readonly K[],
): Record<K, string> {
  const out = {} as Record<K, string>;
  for (const k of keys) {
    const v = form.get(k);
    out[k] = typeof v === 'string' ? v : '';
  }
  return out;
}

/** Copy of values without secrets, for echoing back into the form. */
export function publicValues(values: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(values)) {
    if (!/password|confirm/i.test(k)) out[k] = v;
  }
  return out;
}
