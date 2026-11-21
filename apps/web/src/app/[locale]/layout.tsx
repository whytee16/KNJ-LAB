import '@fontsource-variable/inter';
import 'katex/dist/katex.min.css';
import '../globals.css';

import { localeTags } from '@knj/i18n';
import type { Metadata, Viewport } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { connection } from 'next/server';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { routing } from '@/i18n/routing';
import { env } from '@/lib/env';

export async function generateMetadata({ params }: LayoutProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'meta' });
  return {
    metadataBase: new URL(env().APP_URL),
    title: t('title'),
    description: t('description'),
    alternates: {
      languages: Object.fromEntries(routing.locales.map((l) => [localeTags[l], `/${l}`])),
    },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf6ef' },
    { media: '(prefers-color-scheme: dark)', color: '#14120f' },
  ],
};

export default async function LocaleLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  // Strict CSP uses a per-request nonce (proxy.ts), so every page must render per request:
  // a statically prerendered page would carry scripts without the nonce.
  await connection();

  return (
    <html lang={localeTags[locale]}>
      <body className="min-h-dvh antialiased">
        <NextIntlClientProvider>{children as ReactNode}</NextIntlClientProvider>
      </body>
    </html>
  );
}
