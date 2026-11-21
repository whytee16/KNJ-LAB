import { Card, Container, SectionHeading, cn } from '@knj/ui';
import { useTranslations } from 'next-intl';

const items = ['f1', 'f2', 'f3', 'f4'] as const;

function Check({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={cn('mt-0.5 size-5 shrink-0', className)} aria-hidden="true">
      <path d="M5 10.5 8.5 14 15 6.5" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

/**
 * Prices are intentionally not shown: they live in the `plans` table (stage 7)
 * and the annual price is pending the owner's decision (see PRD §9).
 */
export function PricingSection() {
  const t = useTranslations('pricing');
  return (
    <section aria-labelledby="pricing" className="bg-surface-muted/60 py-16 md:py-24">
      <Container>
        <SectionHeading id="pricing" title={t('title')} subtitle={t('subtitle')} />
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <h3 className="text-xl font-semibold">{t('free.name')}</h3>
            <ul className="mt-6 space-y-3">
              {items.map((k) => (
                <li key={k} className="flex gap-3">
                  <Check className="text-text-muted" />
                  <span>{t(`free.${k}`)}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="border-accent">
            <h3 className="text-xl font-semibold">{t('paid.name')}</h3>
            <p className="mt-1 text-sm font-medium text-accent">{t('paid.periods')}</p>
            <ul className="mt-6 space-y-3">
              {items.map((k) => (
                <li key={k} className="flex gap-3">
                  <Check className="text-accent" />
                  <span>{t(`paid.${k}`)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <p className="mt-6 text-sm text-text-muted">{t('priceNote')}</p>
      </Container>
    </section>
  );
}
