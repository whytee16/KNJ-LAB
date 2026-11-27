import { Container } from '@knj/ui';
import { getTranslations } from 'next-intl/server';
import { allTopicOptions } from '@/features/studio/queries';
import { TaskTemplateEditor } from '@/features/studio/task-editor';
import { pageLocale } from '@/features/shell/page-locale';
import { requireStaff } from '@/server/authz';

export default async function NewTaskPage({
  params,
  searchParams,
}: PageProps<'/[locale]/studio/tasks/new'>) {
  const locale = await pageLocale(params);
  await requireStaff(locale, `/${locale}/studio/tasks/new`);
  const t = await getTranslations('studio.task');
  const topic = (await searchParams).topic;
  return (
    <Container className="flex max-w-4xl flex-col gap-6 py-10">
      <h1 className="type-h1">{t('new')}</h1>
      <TaskTemplateEditor
        locale={locale}
        topics={await allTopicOptions()}
        locked={false}
        initial={{
          type: 'number',
          difficulty: 'easy',
          topicId: typeof topic === 'string' ? topic : '',
        }}
      />
    </Container>
  );
}
