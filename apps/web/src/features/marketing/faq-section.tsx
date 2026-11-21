import { Container, SectionHeading } from '@knj/ui';
import { useTranslations } from 'next-intl';

const questions = ['q1', 'q2', 'q3', 'q4', 'q5'] as const;

export function FaqSection() {
  const t = useTranslations('faq');
  return (
    <section aria-labelledby="faq" className="py-16 md:py-24">
      <Container className="max-w-3xl">
        <SectionHeading id="faq" title={t('title')} />
        <div className="divide-y divide-border border-y border-border">
          {questions.map((q) => (
            <details key={q} className="group py-2">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                {t(`${q}.q`)}
                <span
                  aria-hidden="true"
                  className="text-xl text-text-muted transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="pb-4 text-text-muted">{t(`${q}.a`)}</p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}
