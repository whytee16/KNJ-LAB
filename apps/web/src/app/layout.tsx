import type { ReactNode } from 'react';

// The <html> element lives in app/[locale]/layout.tsx so that `lang` follows the locale.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
