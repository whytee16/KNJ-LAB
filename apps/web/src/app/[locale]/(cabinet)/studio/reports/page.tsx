import { Card, Container } from '@knj/ui';
import { getTranslations } from 'next-intl/server';
import { ActionForm } from '@/features/forms/action-form';
import { setReportStatus } from '@/features/studio/report-actions';
import { pageLocale } from '@/features/shell/page-locale';
import { Link } from '@/i18n/navigation';
import { createUserClient } from '@/lib/supabase/server';
import { requireStaff } from '@/server/authz';

export default async function ReportsPage({ params }: PageProps<'/[locale]/studio/reports'>) {
  const locale = await pageLocale(params);
  await requireStaff(locale, `/${locale}/studio/reports`);
  const t = await getTranslations('studio.reports');
  const supabase = await createUserClient();
  const { data: reports } = await supabase
    .from('content_reports')
    .select('id, message, created_at, template_id')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(100);
  const date = (iso: string) =>
    new Date(iso).toLocaleString(locale === 'kk' ? 'kk-KZ' : 'ru-KZ', { timeZone: 'Asia/Almaty' });
  return (
    <Container className="flex flex-col gap-6 py-10">
      <h1 className="type-h1">{t('title')}</h1>
      {reports?.length ? (
        <ul className="flex flex-col gap-3">
          {reports.map((r) => (
            <li key={r.id}>
              <Card className="flex flex-col gap-3 p-4">
                <p className="text-sm text-text-muted">{date(r.created_at)}</p>
                <p className="whitespace-pre-line">{r.message}</p>
                {r.template_id ? (
                  <Link
                    href={`/studio/tasks/${r.template_id}`}
                    className="text-sm underline underline-offset-4"
                  >
                    {t('openTemplate')}
                  </Link>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <ActionForm
                    action={setReportStatus}
                    fields={{ reportId: r.id, status: 'resolved' }}
                    label={t('resolve')}
                  />
                  <ActionForm
                    action={setReportStatus}
                    fields={{ reportId: r.id, status: 'rejected' }}
                    label={t('reject')}
                    variant="ghost"
                  />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-text-muted">{t('empty')}</p>
      )}
    </Container>
  );
}
