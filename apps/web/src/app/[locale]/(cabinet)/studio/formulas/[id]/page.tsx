import { variablesToText, type FormulaVariable } from '@knj/content-schema';
import { Card, Container } from '@knj/ui';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ActionForm } from '@/features/forms/action-form';
import { Formula } from '@/features/marketing/formula';
import { deleteFormula } from '@/features/studio/formula-actions';
import { FormulaStatusPanel } from '@/features/studio/formula-status';
import { FormulaEditor } from '@/features/studio/formula-forms';
import { getFormulaForEditor } from '@/features/studio/queries';
import { StatusBadge } from '@/features/studio/status-badge';
import { subjectOptions } from '@/features/studio/subjects';
import { pageLocale } from '@/features/shell/page-locale';
import { requireStaff } from '@/server/authz';
import { getCurrentUser } from '@/server/authz';
import { REVIEW_ROLES } from '@/server/redirects';

export default async function StudioFormulaPage({
  params,
}: PageProps<'/[locale]/studio/formulas/[id]'>) {
  const locale = await pageLocale(params);
  // Pages render in parallel with the layout: check access here before any query.
  await requireStaff(locale, `/${locale}/studio/formulas/${(await params).id}`);
  const { id } = await params;
  const f = await getFormulaForEditor(id);
  if (!f) notFound();
  const t = await getTranslations('studio.formula');
  const user = await getCurrentUser();
  const canReview = user ? REVIEW_ROLES.includes(user.role) : false;
  const text = (l: 'ru' | 'kk') => f.formula_translations.find((x) => x.locale === l);
  const initial: Record<string, string> = {
    code: f.code,
    subject: f.subject_code,
    gradeFrom: String(f.grade_from),
    gradeTo: String(f.grade_to),
    latex: f.latex,
  };
  for (const l of ['ru', 'kk'] as const) {
    initial[`name_${l}`] = text(l)?.name ?? '';
    initial[`description_${l}`] = text(l)?.description ?? '';
    initial[`variables_${l}`] = variablesToText(
      (text(l)?.variables as FormulaVariable[] | undefined) ?? [],
    );
  }
  const fields = { locale, formulaId: id };
  const editable = f.status === 'draft' || canReview;

  return (
    <Container className="grid gap-10 py-10 lg:grid-cols-[1fr_320px]">
      <section className="min-w-0">
        <h1 className="mb-2 text-3xl font-semibold tracking-tight">{text('ru')?.name ?? f.code}</h1>
        <div className="mb-6 overflow-x-auto text-xl">
          <Formula latex={f.latex} display />
        </div>
        {editable ? (
          <FormulaEditor
            locale={locale}
            formulaId={id}
            initial={initial}
            subjects={await subjectOptions(locale)}
          />
        ) : (
          <p className="text-text-muted">{t('lockedNote')}</p>
        )}
      </section>
      <aside>
        <Card className="flex flex-col gap-3 p-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{t('statusHeading')}</span>{' '}
            <StatusBadge status={f.status} />
          </div>
          <FormulaStatusPanel
            locale={locale}
            formulaId={id}
            status={f.status}
            canReview={canReview}
          />
          {editable ? (
            <details>
              <summary className="cursor-pointer text-sm font-medium text-danger">
                {t('delete')}
              </summary>
              <div className="pt-3">
                <ActionForm action={deleteFormula} fields={fields} label={t('deleteConfirm')} />
              </div>
            </details>
          ) : null}
        </Card>
      </aside>
    </Container>
  );
}
