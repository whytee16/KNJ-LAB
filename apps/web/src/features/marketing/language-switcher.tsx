'use client';

import { localeNames, type Locale } from '@knj/i18n';
import { cn } from '@knj/ui';
import { useLocale, useTranslations } from 'next-intl';
import type { MouseEvent } from 'react';
import { getPathname, usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

/**
 * Plain links to the same path in another locale (work without JS). With JS the current
 * #hash is read at click time so the reader stays on the same section.
 */
export function LanguageSwitcher() {
  const t = useTranslations('nav');
  const active = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  function switchTo(event: MouseEvent<HTMLAnchorElement>, locale: Locale) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    router.replace(`${pathname}${window.location.hash}`, { locale });
  }

  return (
    <nav aria-label={t('language')} className="flex rounded-md border border-border p-0.5">
      {routing.locales.map((locale) => (
        <a
          key={locale}
          href={getPathname({ href: pathname, locale })}
          hrefLang={locale}
          lang={locale}
          onClick={(e) => switchTo(e, locale)}
          aria-current={locale === active ? 'true' : undefined}
          className={cn(
            'inline-flex min-h-9 items-center rounded-sm px-2.5 text-sm font-medium transition-colors',
            locale === active
              ? 'bg-text text-bg'
              : 'text-text-muted hover:bg-surface-muted hover:text-text',
          )}
        >
          {localeNames[locale]}
        </a>
      ))}
    </nav>
  );
}
