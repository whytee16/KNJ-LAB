/** Supported UI locales. Adding a locale = add here + messages/<locale>.json (see I18N.md). */
export const locales = ['ru', 'kk'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'ru';

/** Native language names shown in the switcher; never translated. */
export const localeNames: Record<Locale, string> = {
  ru: 'Русский',
  kk: 'Қазақша',
};

/** BCP 47 tags for Intl formatting and the html lang attribute. */
export const localeTags: Record<Locale, string> = {
  ru: 'ru-KZ',
  kk: 'kk-KZ',
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
