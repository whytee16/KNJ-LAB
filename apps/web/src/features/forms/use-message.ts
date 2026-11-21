'use client';

import { useTranslations } from 'next-intl';

/**
 * Translates i18n keys returned by Server Actions (FormState.messageKey, fieldErrors).
 * Keys come from our own code, so a cast from string is safe here.
 */
export function useMessage() {
  const t = useTranslations();
  return (key: string | undefined, values?: Record<string, string>) =>
    key ? t(key as Parameters<typeof t>[0], values as never) : undefined;
}
