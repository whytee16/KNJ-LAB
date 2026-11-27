import { buttonVariants, Container } from '@knj/ui';
import { getTranslations } from 'next-intl/server';
import { listStudioTemplates } from '@/features/studio/queries';
import { StatusBadge } from '@/features/studio/status-badge';
import { pageLocale } from '@/features/shell/page-locale';
import { Link } from '@/i18n/navigation';
import { requireStaff } from '@/server/authz';

export default async function StudioTasksPage({ params }: PageProps<'/[locale]/studio/tasks'>) {
  const locale = await pageLocale(params);
  await requireStaff(locale, `/${locale}/studio/tasks`);
  const t = await getTranslations('studio.task');
  const rows = await listStudioTemplates();
  const statement = (texts: unknown) =>
    String((texts as { statement?: string })?.statement ?? '').slice(0, 90);
  return (
    <Container className="flex flex-col gap-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="type-h1">{t('title')}</h1>
        <Link href="/studio/tasks/new" className={buttonVariants()}>
          {t('new')}
        </Link>
      </div>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border text-text-muted">
              <tr>
                <th className="py-2 pr-4 font-medium">{t('statement')}</th>
                <th className="py-2 pr-4 font-medium">{t('topic')}</th>
                <th className="py-2 pr-4 font-medium">{t('type')}</th>
                <th className="py-2 pr-4 font-medium">{t('difficulty')}</th>
                <th className="py-2 pr-4 font-medium">{t('status')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border">
                  <td className="py-3 pr-4">
                    <Link href={`/studio/tasks/${r.id}`} className="underline underline-offset-4">
                      {statement(r.task_template_texts.find((x) => x.locale === 'ru')?.texts) ||
                        '—'}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs">{r.topics?.slug}</td>
                  <td className="py-3 pr-4">{t(`types.${r.type}`)}</td>
                  <td className="py-3 pr-4">{t(`levels.${r.difficulty}`)}</td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-text-muted">{t('empty')}</p>
      )}
    </Container>
  );
}
