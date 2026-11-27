import { Badge, buttonVariants, Container, SubjectTile } from '@knj/ui';
import { useTranslations } from 'next-intl';

const SUBJECTS = ['physics', 'algebra', 'geometry'] as const;

export function Hero() {
  const t = useTranslations('hero');
  const s = useTranslations('subjects');
  return (
    <section aria-labelledby="hero-title" className="py-16 md:py-24">
      <Container className="grid items-center gap-12 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <Badge tone="accent">{t('eyebrow')}</Badge>
          <h1 id="hero-title" className="mt-5 type-display">
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
        <ul className="grid gap-3">
          {SUBJECTS.map((key) => (
            <li key={key}>
              <SubjectTile
                subject={key}
                title={s(`${key}.name`)}
                meta={t(`tiles.${key}`)}
                href="#subjects"
              />
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
