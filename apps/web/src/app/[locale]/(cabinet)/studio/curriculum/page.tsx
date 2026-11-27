import { Container, cn } from '@knj/ui';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import {
  defaultCurriculumId,
  getCurriculum,
  GRADES,
  isSubject,
  SUBJECTS,
} from '@/features/content/queries';
import { AddSectionForm, SectionCard } from '@/features/studio/curriculum-editor';
import { topicOptions } from '@/features/studio/queries';
import { pageLocale } from '@/features/shell/page-locale';
import { requireStaff } from '@/server/authz';
import { Link } from '@/i18n/navigation';
import { getCurrentUser } from '@/server/authz';
import { REVIEW_ROLES } from '@/server/redirects';

export default async function CurriculumEditorPage({
  params,
  searchParams,
}: PageProps<'/[locale]/studio/curriculum'>) {
  const locale = await pageLocale(params);
  // Pages render in parallel with the layout: check access here before any query.
  await requireStaff(locale, `/${locale}/studio/curriculum`);
  const user = await getCurrentUser();
  if (!user || !REVIEW_ROLES.includes(user.role)) redirect(`/${locale}/studio`);
  const q = await searchParams;
  const subject = typeof q.subject === 'string' && isSubject(q.subject) ? q.subject : 'algebra';
  const gradeNum = Number(q.grade);
  const grade = (GRADES as readonly number[]).includes(gradeNum) ? gradeNum : 7;

  const t = await getTranslations('studio.curriculum');
  const subjects = await getTranslations('studio.subjects');
  const [quarters, options, curriculumId] = await Promise.all([
    getCurriculum(subject, grade, locale, { staff: true }),
    topicOptions(subject),
    defaultCurriculumId(),
  ]);

  return (
    <Container className="flex flex-col gap-8 py-10">
      <div>
        <h1 className="type-h1">{t('title')}</h1>
        <p className="mt-2 max-w-2xl text-text-muted">{t('subtitle')}</p>
      </div>
      <div className="flex flex-col gap-3">
        <nav aria-label={t('subjectNav')} className="flex flex-wrap gap-2">
          {SUBJECTS.map((s) => (
            <Link
              key={s}
              href={`/studio/curriculum?subject=${s}&grade=${grade}`}
              aria-current={s === subject ? 'page' : undefined}
              className={cn(
                'rounded-md border border-border px-3 py-2 text-sm',
                s === subject && 'bg-text text-bg',
              )}
            >
              {subjects(s)}
            </Link>
          ))}
        </nav>
        <nav aria-label={t('gradeNav')} className="flex flex-wrap gap-2">
          {GRADES.map((g) => (
            <Link
              key={g}
              href={`/studio/curriculum?subject=${subject}&grade=${g}`}
              aria-current={g === grade ? 'page' : undefined}
              className={cn(
                'rounded-md border border-border px-3 py-2 text-sm',
                g === grade && 'bg-text text-bg',
              )}
            >
              {t('grade', { grade: g })}
            </Link>
          ))}
        </nav>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {quarters.map((qtr) => (
          <section
            key={qtr.quarter}
            aria-labelledby={`q${qtr.quarter}`}
            className="flex flex-col gap-4 rounded-lg border border-border p-4"
          >
            <h2 id={`q${qtr.quarter}`} className="text-lg font-semibold">
              {t('quarter', { quarter: qtr.quarter })}
            </h2>
            {qtr.sections.map((s, i) => (
              <SectionCard
                key={s.id}
                locale={locale}
                section={s}
                first={i === 0}
                last={i === qtr.sections.length - 1}
                topicOptions={options}
              />
            ))}
            <details>
              <summary className="cursor-pointer text-sm font-medium">{t('addSection')}</summary>
              <div className="pt-3">
                <AddSectionForm
                  locale={locale}
                  curriculumId={curriculumId}
                  subject={subject}
                  grade={grade}
                  quarter={qtr.quarter}
                />
              </div>
            </details>
          </section>
        ))}
      </div>
    </Container>
  );
}
