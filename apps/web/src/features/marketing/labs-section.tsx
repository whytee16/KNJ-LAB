import { Card, Container, SectionHeading } from '@knj/ui';
import { useTranslations } from 'next-intl';
import { CircuitIllustration, CubeSectionIllustration } from './lab-illustrations';

export function LabsSection() {
  const t = useTranslations('labs');
  return (
    <section aria-labelledby="labs" className="bg-surface-muted/60 py-16 md:py-24">
      <Container>
        <SectionHeading id="labs" title={t('title')} subtitle={t('subtitle')} />
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="flex flex-col gap-4">
            <CubeSectionIllustration />
            <h3 className="text-xl font-semibold">{t('geometry.title')}</h3>
            <p className="text-text-muted">{t('geometry.description')}</p>
          </Card>
          <Card className="flex flex-col gap-4">
            <CircuitIllustration />
            <h3 className="text-xl font-semibold">{t('physics.title')}</h3>
            <p className="text-text-muted">{t('physics.description')}</p>
          </Card>
        </div>
        <p className="mt-6 text-sm text-text-muted">{t('soon')}</p>
      </Container>
    </section>
  );
}
