import type { Locale } from '@knj/i18n';
import { getTranslations } from 'next-intl/server';
import { isSupabaseConfigured } from '@/lib/env';
import { getCurrentUser } from '@/server/authz';
import { activePass } from '@/server/entitlements';
import { listPublishedTests } from './queries';
import { TestList } from './test-list';

/** Tests scoped to this topic, shown under the practice block (nothing if there are none). */
export async function TopicTests({ topicId, locale }: { topicId: string; locale: Locale }) {
  const tests = await listPublishedTests(locale, { topicId });
  if (!tests.length) return null;
  const t = await getTranslations('tests');
  const user = isSupabaseConfigured() ? await getCurrentUser() : null;
  const student = user?.role === 'student' ? user : null;
  return (
    <section aria-labelledby="topic-tests" className="mt-10 max-w-3xl">
      <h2 id="topic-tests" className="mb-4 text-2xl font-semibold tracking-tight">
        {t('topicTitle')}
      </h2>
      <TestList
        tests={tests}
        locale={locale}
        canStart={Boolean(student)}
        hasPass={student ? (await activePass(student.id)) !== null : false}
      />
    </section>
  );
}
