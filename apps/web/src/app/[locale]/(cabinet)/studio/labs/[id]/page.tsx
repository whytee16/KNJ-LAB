import { labModel, parseParams, type ParamSpec } from '@knj/physics';
import { buttonVariants, Card, Container } from '@knj/ui';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { camelCode as camel, UNIT_KEY } from '@/features/labs/units';
import { AiDraftNotice, AiReviewedNote, LabBundlePanel } from '@/features/studio/ai-draft-notice';
import { LabEditor, LabLinks, LabStatusPanel } from '@/features/studio/lab-editor';
import { allTopicOptions } from '@/features/studio/queries';
import { StatusBadge } from '@/features/studio/status-badge';
import { pageLocale } from '@/features/shell/page-locale';
import { Link } from '@/i18n/navigation';
import { createUserClient } from '@/lib/supabase/server';
import { getCurrentUser, requireStaff } from '@/server/authz';
import { REVIEW_ROLES } from '@/server/redirects';

export default async function EditLabPage({ params }: PageProps<'/[locale]/studio/labs/[id]'>) {
  const locale = await pageLocale(params);
  const { id } = await params;
  await requireStaff(locale, `/${locale}/studio/labs/${id}`);
  const supabase = await createUserClient();
  const { data: lab } = await supabase
    .from('labs')
    .select(
      'id, code, status, is_free_demo, grade_from, default_params, lab_translations(*), lab_topics(topic_id), lab_tasks(template_id, position, task_templates(status, content_origin))',
    )
    .eq('id', id)
    .maybeSingle();
  const model = lab ? labModel(lab.code) : null;
  if (!lab || !model) notFound();
  const t = await getTranslations('studio.labs');
  const labs = await getTranslations('labs');
  const all = await getTranslations();
  const user = await getCurrentUser();
  const canReview = user ? REVIEW_ROLES.includes(user.role) : false;
  const locked = lab.status !== 'draft' && !canReview;

  const ru = lab.lab_translations.find((x) => x.locale === 'ru');
  const kk = lab.lab_translations.find((x) => x.locale === 'kk');
  const defaults = parseParams(model, lab.default_params);
  const initial: Record<string, string> = {
    titleRu: ru?.title ?? '',
    goalRu: ru?.goal ?? '',
    stepsRu: (ru?.steps ?? []).join('\n'),
    hintsRu: (ru?.hints ?? []).join('\n'),
    titleKk: kk?.title ?? '',
    goalKk: kk?.goal ?? '',
    stepsKk: (kk?.steps ?? []).join('\n'),
    hintsKk: (kk?.hints ?? []).join('\n'),
    kkStatus: kk?.translation_status ?? 'draft',
    grade: String(lab.grade_from),
    isFreeDemo: lab.is_free_demo ? 'on' : '',
    ...Object.fromEntries(Object.entries(defaults).map(([k, v]) => [`param_${k}`, String(v)])),
  };
  const params_ = (Object.entries(model.params) as [string, ParamSpec][]).map(([key, spec]) => {
    const unit = labs(`units.${UNIT_KEY[spec.unit]}`);
    return {
      key,
      label: `${all(`labs.models.${camel(lab.code)}.params.${key}` as 'labs.title')}, ${unit}`,
      hint: t('paramHint', { min: spec.min, max: spec.max, step: spec.step }),
    };
  });

  const topicOptions = await allTopicOptions();
  const linkedTopicIds = lab.lab_topics.map((x) => x.topic_id);
  const { data: templates } = linkedTopicIds.length
    ? await supabase
        .from('task_templates')
        .select('id, type, difficulty, status, task_template_texts(locale, texts), topics(slug)')
        .in('topic_id', linkedTopicIds)
        .eq('status', 'published')
    : { data: [] };
  const linkedTaskIds = [...lab.lab_tasks]
    .sort((a, b) => a.position - b.position)
    .map((x) => x.template_id);
  const { data: linkedTemplates } = linkedTaskIds.length
    ? await supabase
        .from('task_templates')
        .select('id, type, difficulty, status, task_template_texts(locale, texts), topics(slug)')
        .in('id', linkedTaskIds)
    : { data: [] };
  const levels = await getTranslations('practice.levels');
  const templateLabel = (tpl: NonNullable<typeof templates>[number]) => {
    const texts = tpl.task_template_texts.find((x) => x.locale === 'ru')?.texts as
      { statement?: string } | undefined;
    const statement = (texts?.statement ?? '').replace(/\s+/g, ' ').slice(0, 80);
    return `${statement || tpl.id.slice(0, 8)} · ${levels(tpl.difficulty)} · ${tpl.topics?.slug ?? ''}`;
  };

  return (
    <Container className="grid gap-8 py-10 lg:grid-cols-[1fr_320px]">
      <section className="flex min-w-0 flex-col gap-10">
        <div>
          <p className="text-sm text-text-muted">
            <code>{lab.code}</code>
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{ru?.title ?? lab.code}</h1>
        </div>
        <LabEditor
          locale={locale}
          labId={lab.id}
          initial={initial}
          params={params_}
          locked={locked}
        />
        <LabLinks
          locale={locale}
          labId={lab.id}
          list="topics"
          title={t('topics')}
          hint={t('topicsHint')}
          linked={topicOptions.filter((o) => linkedTopicIds.includes(o.value))}
          options={topicOptions}
          locked={locked}
        />
        <LabLinks
          locale={locale}
          labId={lab.id}
          list="tasks"
          title={t('tasks')}
          hint={t('tasksHint')}
          linked={linkedTaskIds
            .map((tid) => linkedTemplates?.find((x) => x.id === tid))
            .filter((x): x is NonNullable<typeof x> => Boolean(x))
            .map((x) => ({ value: x.id, label: templateLabel(x) }))}
          options={(templates ?? []).map((x) => ({ value: x.id, label: templateLabel(x) }))}
          locked={locked}
        />
      </section>
      <aside className="flex flex-col gap-4">
        <Card className="flex flex-col gap-3 p-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{t('status')}</span> <StatusBadge status={lab.status} />
          </div>
          {ru?.content_origin === 'ai_draft' ? (
            <AiDraftNotice locale={locale} kind="lab" id={lab.id} canReview={canReview} />
          ) : ru?.content_origin === 'ai_reviewed' ? (
            <AiReviewedNote />
          ) : null}
          {canReview &&
          (lab.lab_translations.some((x) => x.content_origin !== 'human') ||
            lab.lab_tasks.some((x) => x.task_templates?.content_origin !== 'human')) ? (
            <LabBundlePanel
              locale={locale}
              labId={lab.id}
              pendingReview={
                lab.lab_translations.filter((x) => x.content_origin === 'ai_draft').length +
                lab.lab_tasks.filter((x) => x.task_templates?.content_origin === 'ai_draft').length
              }
              pendingPublish={
                lab.lab_tasks.filter((x) => x.task_templates?.status !== 'published').length +
                (lab.status === 'published' ? 0 : 1)
              }
            />
          ) : null}
          <LabStatusPanel
            locale={locale}
            labId={lab.id}
            status={lab.status}
            canReview={canReview}
          />
        </Card>
        <Link
          href={`/labs/${lab.code}`}
          className={buttonVariants({ variant: 'secondary', size: 'sm' })}
        >
          {t('preview')}
        </Link>
      </aside>
    </Container>
  );
}
