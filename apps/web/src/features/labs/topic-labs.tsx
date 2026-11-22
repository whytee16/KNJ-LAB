import type { Locale } from '@knj/i18n';
import { getTranslations } from 'next-intl/server';
import { LabCard } from './lab-card';
import { listLabs } from './queries';

/** Labs linked to a topic (nothing if there are none). */
export async function TopicLabs({ topicId, locale }: { topicId: string; locale: Locale }) {
  const labs = await listLabs(locale, { topicId });
  if (!labs.length) return null;
  const t = await getTranslations('labs');
  return (
    <section aria-labelledby="topic-labs" className="mt-10 max-w-3xl border-t border-border pt-8">
      <h2 id="topic-labs" className="mb-4 text-2xl font-semibold tracking-tight">
        {t('blockTitle')}
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {labs.map((lab) => (
          <li key={lab.id}>
            <LabCard lab={lab} />
          </li>
        ))}
      </ul>
    </section>
  );
}
