import '@fontsource-variable/inter';
import './globals.css';

import NextLink from 'next/link';

// Fallback for requests outside a locale (e.g. unknown files). Bilingual by necessity:
// no locale is known here. Localized 404s live in app/[locale]/not-found.tsx.
export default function RootNotFound() {
  return (
    <html lang="ru">
      <body className="grid min-h-dvh place-items-center p-4 text-center">
        <main>
          <p className="text-sm font-medium text-accent">404</p>
          <h1 className="mt-2 text-2xl font-semibold">
            Страница не найдена · <span lang="kk">Бет табылмады</span>
          </h1>
          <p className="mt-4">
            <NextLink href="/ru" className="underline underline-offset-4">
              На главную
            </NextLink>
            {' · '}
            <NextLink href="/kk" lang="kk" className="underline underline-offset-4">
              Басты бетке
            </NextLink>
          </p>
        </main>
      </body>
    </html>
  );
}
