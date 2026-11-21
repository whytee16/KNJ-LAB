import { Container } from '@knj/ui';
import { getTranslations } from 'next-intl/server';
import { NewTopicForm } from '@/features/studio/new-topic-form';
import { subjectOptions } from '@/features/studio/subjects';
import { pageLocale } from '@/features/shell/page-locale';
import { requireStaff } from '@/server/authz';

export default async function NewTopicPage({ params }: PageProps<'/[locale]/studio/topics/new'>) {
  const locale = await pageLocale(params);
  // Pages render in parallel with the layout: check access here before any query.
  await requireStaff(locale, `/${locale}/studio/topics/new`);
  const t = await getTranslations('studio.newTopic');
  return (
    <Container className="py-10">
      <h1 className="mb-6 text-3xl font-semibold tracking-tight">{t('heading')}</h1>
      <NewTopicForm locale={locale} subjects={await subjectOptions(locale)} />
    </Container>
  );
}
