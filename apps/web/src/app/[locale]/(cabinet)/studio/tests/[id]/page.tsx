import { Card, Container } from '@knj/ui';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { allTopicOptions, sectionOptions } from '@/features/studio/queries';
import { StatusBadge } from '@/features/studio/status-badge';
import { subjectOptions } from '@/features/studio/subjects';
import { TestEditor, TestStatusPanel } from '@/features/studio/test-editor';
import { parseCounts } from '@/features/tests/scope';
import { pageLocale } from '@/features/shell/page-locale';
import { createUserClient } from '@/lib/supabase/server';
import { getCurrentUser, requireStaff } from '@/server/authz';
import { REVIEW_ROLES } from '@/server/redirects';

export default async function EditTestPage({ params }: PageProps<'/[locale]/studio/tests/[id]'>) {
  const locale = await pageLocale(params);
  const { id } = await params;
  await requireStaff(locale, `/${locale}/studio/tests/${id}`);
  const supabase = await createUserClient();
  const { data: test } = await supabase
    .from('tests')
    .select('*, test_texts(locale, title, description)')
    .eq('id', id)
    .maybeSingle();
  if (!test) notFound();
  const t = await getTranslations('studio.tests');
  const user = await getCurrentUser();
  const canReview = user ? REVIEW_ROLES.includes(user.role) : false;
  const ru = test.test_texts.find((x) => x.locale === 'ru');
  const kk = test.test_texts.find((x) => x.locale === 'kk');
  const counts = parseCounts(test.counts);
  const initial: Record<string, string> = {
    titleRu: ru?.title ?? '',
    descriptionRu: ru?.description ?? '',
    titleKk: kk?.title ?? '',
    descriptionKk: kk?.description ?? '',
    scope: test.scope,
    topicId: test.topic_id ?? '',
    sectionId: test.section_id ?? '',
    subject: test.subject_code ?? '',
    grade: test.grade ? String(test.grade) : '',
    quarter: test.quarter ? String(test.quarter) : '',
    mode: test.mode,
    minutes: test.time_limit_s ? String(Math.round(test.time_limit_s / 60)) : '',
    count_easy: String(counts.easy ?? 0),
    count_medium: String(counts.medium ?? 0),
    count_sufficient: String(counts.sufficient ?? 0),
    count_hard: String(counts.hard ?? 0),
  };
  return (
    <Container className="grid gap-8 py-10 lg:grid-cols-[1fr_320px]">
      <section className="min-w-0">
        <h1 className="mb-6 text-3xl font-semibold tracking-tight">{ru?.title ?? t('new')}</h1>
        <TestEditor
          locale={locale}
          testId={id}
          initial={initial}
          topics={await allTopicOptions()}
          sections={await sectionOptions()}
          subjects={await subjectOptions(locale)}
          locked={test.status !== 'draft' && !canReview}
        />
      </section>
      <aside>
        <Card className="flex flex-col gap-3 p-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{t('status')}</span>{' '}
            <StatusBadge status={test.status} />
          </div>
          <TestStatusPanel locale={locale} testId={id} status={test.status} canReview={canReview} />
        </Card>
      </aside>
    </Container>
  );
}
