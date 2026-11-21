import { defaultLocale, locales } from '@knj/i18n';
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'always',
});
