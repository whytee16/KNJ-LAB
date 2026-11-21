import type { Locale } from '@knj/i18n';
import { Container } from '@knj/ui';
import { SignOutButton } from '@/features/auth/sign-out-button';
import { LanguageSwitcher } from '@/features/marketing/language-switcher';
import { BrandLink } from './brand-link';

export function CabinetHeader({ locale, name }: { locale: Locale; name: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-3">
        <BrandLink />
        <div className="flex items-center gap-2">
          <span className="hidden max-w-40 truncate text-sm text-text-muted sm:inline">{name}</span>
          <LanguageSwitcher persist />
          <SignOutButton locale={locale} />
        </div>
      </Container>
    </header>
  );
}
