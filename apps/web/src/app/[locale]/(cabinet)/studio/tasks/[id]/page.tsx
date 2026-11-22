import {
  paramsToText,
  specToForm,
  taskSpecSchema,
  taskTextsSchema,
  textsToForm,
} from '@knj/task-engine';
import { Card, Container } from '@knj/ui';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { allTopicOptions, getTemplateForEditor } from '@/features/studio/queries';
import { StatusBadge } from '@/features/studio/status-badge';
import { checkStoredTemplate } from '@/features/studio/task-actions';
import { TaskTemplateEditor, ValidationReportView } from '@/features/studio/task-editor';
import { AiDraftNotice, AiReviewedNote } from '@/features/studio/ai-draft-notice';
import { TaskStatusPanel } from '@/features/studio/task-status';
import { pageLocale } from '@/features/shell/page-locale';
import { getCurrentUser, requireStaff } from '@/server/authz';
import { REVIEW_ROLES } from '@/server/redirects';

export default async function EditTaskPage({ params }: PageProps<'/[locale]/studio/tasks/[id]'>) {
  const locale = await pageLocale(params);
  const { id } = await params;
  await requireStaff(locale, `/${locale}/studio/tasks/${id}`);
  const tpl = await getTemplateForEditor(id);
  if (!tpl) notFound();
  const t = await getTranslations('studio.task');
  const user = await getCurrentUser();
  const canReview = user ? REVIEW_ROLES.includes(user.role) : false;

  const spec = taskSpecSchema.parse(tpl.spec);
  const initial: Record<string, string> = {
    ...specToForm(spec),
    params: paramsToText(spec.params),
    topicId: tpl.topic_id,
    difficulty: tpl.difficulty,
    type: tpl.type,
  };
  for (const row of tpl.task_template_texts) {
    const form = textsToForm(taskTextsSchema.parse(row.texts));
    for (const [k, v] of Object.entries(form)) initial[`${k}_${row.locale}`] = v;
  }
  const report = await checkStoredTemplate(id);
  const locked = tpl.status !== 'draft' && !canReview;

  return (
    <Container className="grid gap-8 py-10 lg:grid-cols-[1fr_320px]">
      <section className="min-w-0">
        <h1 className="mb-6 text-3xl font-semibold tracking-tight">{t('edit')}</h1>
        {locked ? <p className="mb-4 text-text-muted">{t('lockedNote')}</p> : null}
        <TaskTemplateEditor
          locale={locale}
          templateId={id}
          initial={initial}
          topics={await allTopicOptions()}
          locked={locked}
        />
      </section>
      <aside className="flex flex-col gap-4">
        <Card className="flex flex-col gap-3 p-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{t('status')}</span> <StatusBadge status={tpl.status} />
            <span className="text-xs text-text-muted">
              {t('version', { version: tpl.version })}
            </span>
          </div>
          {tpl.content_origin === 'ai_draft' ? (
            <AiDraftNotice locale={locale} kind="template" id={id} canReview={canReview} />
          ) : tpl.content_origin === 'ai_reviewed' ? (
            <AiReviewedNote />
          ) : null}
          <TaskStatusPanel
            locale={locale}
            templateId={id}
            status={tpl.status}
            canReview={canReview}
          />
        </Card>
        {report ? (
          <Card className="p-4">
            <h2 className="mb-3 font-semibold">{t('check')}</h2>
            <ValidationReportView report={report} />
          </Card>
        ) : null}
      </aside>
    </Container>
  );
}
