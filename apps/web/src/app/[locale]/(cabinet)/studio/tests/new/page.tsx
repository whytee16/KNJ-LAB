import { Container } from '@knj/ui';
import { getTranslations } from 'next-intl/server';
import { allTopicOptions, sectionOptions } from '@/features/studio/queries';
import { subjectOptions } from '@/features/studio/subjects';
import { TestEditor } from '@/features/studio/test-editor';
import { pageLocale } from '@/features/shell/page-locale';
import { requireStaff } from '@/server/authz';

export default async function NewTestPage({ params }: PageProps<'/[locale]/studio/tests/new'>) {
  const locale = await pageLocale(params);
  await requireStaff(locale, `/${locale}/studio/tests/new`);
  const t = await getTranslations('studio.tests');
  return (
    <Container className="flex max-w-3xl flex-col gap-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">{t('new')}</h1>
      <TestEditor
        locale={locale}
        initial={{}}
        topics={await allTopicOptions()}
        sections={await sectionOptions()}
        subjects={await subjectOptions(locale)}
        locked={false}
      />
    </Container>
  );
}
