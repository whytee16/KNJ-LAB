import { Card, Container } from '@knj/ui';
import type { ReactNode } from 'react';
import { LanguageSwitcher } from '@/features/marketing/language-switcher';
import { BrandLink } from './brand-link';

/** Centered single-card layout for sign-in, registration and similar pages. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <>
      <header className="border-b border-border">
        <Container className="flex h-16 items-center justify-between">
          <BrandLink />
          <LanguageSwitcher />
        </Container>
      </header>
      <main id="main">
        <Container className="flex justify-center py-10 md:py-16">
          <Card className="w-full max-w-md">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {subtitle ? <p className="mt-2 text-sm text-text-muted">{subtitle}</p> : null}
            <div className="mt-6">{children}</div>
            {footer ? (
              <div className="mt-6 border-t border-border pt-4 text-sm">{footer}</div>
            ) : null}
          </Card>
        </Container>
      </main>
    </>
  );
}
