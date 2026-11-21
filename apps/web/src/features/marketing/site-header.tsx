import { buttonVariants, cn, Container } from '@knj/ui';
import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { isSupabaseConfigured } from '@/lib/env';
import { getCurrentUser } from '@/server/authz';
import { dashboardPath } from '@/server/redirects';
import { LanguageSwitcher } from './language-switcher';
import { navItems } from './nav-items';

/** `landing` adds in-page section links; other public pages show only route links. */
export async function SiteHeader({ landing = false }: { landing?: boolean }) {
  const t = await getTranslations('nav');
  const locale = (await getLocale()) as 'ru' | 'kk';
  const user = isSupabaseConfigured() ? await getCurrentUser() : null;
  // Paths from dashboardPath include the locale; next-intl's Link adds it, so strip it here.
  const cabinet = user ? dashboardPath(user.role, locale).replace(`/${locale}`, '') : null;
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2"
      >
        {t('skipToContent')}
      </a>
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link href="/" aria-label={t('home')} className="text-lg font-bold tracking-tight">
          KNJ <span className="text-accent">LAB</span>
        </Link>

        <nav aria-label={t('menu')} className="hidden lg:block">
          <ul className="flex gap-6 text-sm text-text-muted">
            <li>
              <Link href="/learn" className="hover:text-text">
                {t('learn')}
              </Link>
            </li>
            <li>
              <Link href="/reference" className="hover:text-text">
                {t('reference')}
              </Link>
            </li>
            {(landing ? navItems : []).map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`} className="hover:text-text">
                  {t(item.key)}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          {isSupabaseConfigured() ? (
            <Link
              href={cabinet ?? '/login'}
              className={cn(
                buttonVariants({ variant: 'primary', size: 'sm' }),
                'hidden min-h-11 sm:inline-flex',
              )}
            >
              {cabinet ? t('cabinet') : t('login')}
            </Link>
          ) : null}
          <details className="group relative lg:hidden">
            <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-md border border-border px-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
              {t('menu')}
            </summary>
            <ul className="absolute right-0 mt-2 w-56 rounded-lg border border-border bg-surface p-2 shadow-card">
              {isSupabaseConfigured() ? (
                <li className="sm:hidden">
                  <Link
                    href={cabinet ?? '/login'}
                    className="flex min-h-11 items-center rounded-md px-3 font-medium text-accent hover:bg-surface-muted"
                  >
                    {cabinet ? t('cabinet') : t('login')}
                  </Link>
                </li>
              ) : null}
              {[
                { href: '/learn', label: t('learn') },
                { href: '/reference', label: t('reference') },
              ].map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="flex min-h-11 items-center rounded-md px-3 hover:bg-surface-muted"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
              {(landing ? navItems : []).map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className="flex min-h-11 items-center rounded-md px-3 hover:bg-surface-muted"
                  >
                    {t(item.key)}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        </div>
      </Container>
    </header>
  );
}
