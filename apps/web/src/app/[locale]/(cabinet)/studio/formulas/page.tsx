import { Container } from '@knj/ui';
import { getTranslations } from 'next-intl/server';
import { Formula } from '@/features/marketing/formula';
import { NewFormulaForm } from '@/features/studio/formula-forms';
import { listStudioFormulas } from '@/features/studio/queries';
import { StatusBadge } from '@/features/studio/status-badge';
import { subjectOptions } from '@/features/studio/subjects';
import { pageLocale } from '@/features/shell/page-locale';
import { requireStaff } from '@/server/authz';
import { Link } from '@/i18n/navigation';

export default async function StudioFormulasPage({
  params,
}: PageProps<'/[locale]/studio/formulas'>) {
  const locale = await pageLocale(params);
  // Pages render in parallel with the layout: check access here before any query.
  await requireStaff(locale, `/${locale}/studio/formulas`);
  const t = await getTranslations('studio.formula');
  const formulas = await listStudioFormulas();
  return (
    <Container className="grid gap-10 py-10 lg:grid-cols-[1fr_360px]">
      <section aria-labelledby="formulas" className="min-w-0">
        <h1 id="formulas" className="mb-6 type-h1">
          {t('title')}
        </h1>
        {formulas.length ? (
          <ul className="flex flex-col divide-y divide-border">
            {formulas.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <Link
                    href={`/studio/formulas/${f.id}`}
                    className="font-medium underline underline-offset-4"
                  >
                    {f.formula_translations.find((x) => x.locale === 'ru')?.name ?? f.code}
                  </Link>
                  <div className="max-w-full overflow-x-auto text-sm">
                    <Formula latex={f.latex} />
                  </div>
                </div>
                <StatusBadge status={f.status} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-text-muted">{t('empty')}</p>
        )}
      </section>
      <section aria-labelledby="new-formula">
        <h2 id="new-formula" className="mb-4 text-xl font-semibold">
          {t('new')}
        </h2>
        <NewFormulaForm locale={locale} subjects={await subjectOptions(locale)} />
      </section>
    </Container>
  );
}
