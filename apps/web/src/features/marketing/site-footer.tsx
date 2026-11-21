import { Container } from '@knj/ui';
import { useTranslations } from 'next-intl';
import { env } from '@/lib/env';

export function SiteFooter() {
  const t = useTranslations('footer');
  const email = env().NEXT_PUBLIC_CONTACT_EMAIL;
  return (
    <footer id="contacts" className="border-t border-border py-12">
      <Container className="grid gap-8 md:grid-cols-[2fr_1fr]">
        <div>
          <p className="text-lg font-bold tracking-tight">
            KNJ <span className="text-accent">LAB</span>
          </p>
          <p className="mt-2 max-w-sm text-sm text-text-muted">{t('tagline')}</p>
          <p className="mt-6 text-sm text-text-muted">
            {t('rights', { year: new Date().getFullYear() })}
          </p>
        </div>
        {email ? (
          <div>
            <h2 className="text-sm font-semibold">{t('contacts')}</h2>
            <p className="mt-2 text-sm">
              <span className="text-text-muted">{t('email')}: </span>
              <a href={`mailto:${email}`} className="underline underline-offset-4">
                {email}
              </a>
            </p>
          </div>
        ) : null}
      </Container>
    </footer>
  );
}
