import { Container, SectionHeading } from '@knj/ui';
import { useTranslations } from 'next-intl';

const features = ['levels', 'solutions', 'trainer', 'mastery', 'parents', 'bilingual'] as const;

export function FeaturesSection() {
  const t = useTranslations('features');
  return (
    <section aria-labelledby="features" className="py-16 md:py-24">
      <Container>
        <SectionHeading id="features" title={t('title')} />
        <ul className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((key, i) => (
            <li key={key} className="border-t border-border pt-6">
              <span className="text-sm font-medium text-accent">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="mt-2 text-lg font-semibold">{t(`${key}.title`)}</h3>
              <p className="mt-2 text-text-muted">{t(`${key}.description`)}</p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
