import { Badge, Card, Container, SectionHeading } from '@knj/ui';
import { useTranslations } from 'next-intl';
import { Formula } from './formula';

const subjects = [
  { key: 'algebra', tone: 'algebra', latex: 'a^2 - b^2 = (a - b)(a + b)' },
  { key: 'geometry', tone: 'geometry', latex: 'S = \\frac{1}{2} a h' },
  { key: 'physics', tone: 'physics', latex: 'S = v t' },
] as const;

export function SubjectsSection() {
  const t = useTranslations('subjects');
  return (
    <section aria-labelledby="subjects" className="py-16 md:py-24">
      <Container>
        <SectionHeading id="subjects" title={t('title')} subtitle={t('subtitle')} />
        <ul className="grid gap-4 md:grid-cols-3">
          {subjects.map((s) => (
            <li key={s.key}>
              <Card className="flex h-full flex-col gap-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xl font-semibold">{t(`${s.key}.name`)}</h3>
                  <Badge tone={s.tone}>{t('grades')}</Badge>
                </div>
                <p className="text-text-muted">{t(`${s.key}.description`)}</p>
                <div className="mt-auto rounded-md bg-surface-muted p-3 text-lg">
                  <span className="sr-only">{t('formulaLabel')}: </span>
                  <Formula latex={s.latex} />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
