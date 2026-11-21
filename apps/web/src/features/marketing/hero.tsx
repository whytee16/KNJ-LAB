import { Badge, buttonVariants, Container } from '@knj/ui';
import { useTranslations } from 'next-intl';
import { Formula } from './formula';

export function Hero() {
  const t = useTranslations('hero');
  return (
    <section aria-labelledby="hero-title" className="py-16 md:py-24">
      <Container className="grid items-center gap-12 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <Badge tone="accent">{t('eyebrow')}</Badge>
          <h1
            id="hero-title"
            className="mt-5 text-4xl font-semibold tracking-tight text-balance md:text-6xl"
          >
            {t('title')}
          </h1>
          <p className="mt-5 max-w-xl text-lg text-text-muted">{t('subtitle')}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#subjects" className={buttonVariants()}>
              {t('ctaPrimary')}
            </a>
            <a href="#pricing" className={buttonVariants({ variant: 'secondary' })}>
              {t('ctaSecondary')}
            </a>
          </div>
          <p className="mt-6 text-sm text-text-muted">{t('statusNote')}</p>
        </div>
        <div
          aria-hidden="true"
          className="grid gap-3 rounded-lg border border-border bg-surface p-6 text-xl shadow-card"
        >
          <div className="rounded-md bg-surface-muted p-4 text-algebra">
            <Formula latex="x_{1,2} = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}" />
          </div>
          <div className="rounded-md bg-surface-muted p-4 text-geometry">
            <Formula latex="V = \frac{1}{3} S h" />
          </div>
          <div className="rounded-md bg-surface-muted p-4 text-physics">
            <Formula latex="I = \frac{U}{R}" />
          </div>
        </div>
      </Container>
    </section>
  );
}
