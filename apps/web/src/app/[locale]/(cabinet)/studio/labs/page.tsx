import { Badge, Container } from '@knj/ui';
import { getTranslations } from 'next-intl/server';
import { StatusBadge } from '@/features/studio/status-badge';
import { pageLocale } from '@/features/shell/page-locale';
import { Link } from '@/i18n/navigation';
import { createUserClient } from '@/lib/supabase/server';
import { requireStaff } from '@/server/authz';

export default async function StudioLabsPage({ params }: PageProps<'/[locale]/studio/labs'>) {
  const locale = await pageLocale(params);
  await requireStaff(locale, `/${locale}/studio/labs`);
  const t = await getTranslations('studio.labs');
  const supabase = await createUserClient();
  const { data: labs } = await supabase
    .from('labs')
    .select('id, code, status, is_free_demo, lab_translations(locale, title)')
    .order('sort')
    .order('code');
  return (
    <Container className="flex flex-col gap-6 py-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t('listTitle')}</h1>
        <p className="mt-2 max-w-2xl text-text-muted">{t('listHint')}</p>
      </div>
      <ul className="flex flex-col divide-y divide-border">
        {(labs ?? []).map((lab) => (
          <li key={lab.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <Link href={`/studio/labs/${lab.id}`} className="underline underline-offset-4">
              {lab.lab_translations.find((x) => x.locale === 'ru')?.title ?? lab.code}
            </Link>
            <span className="flex items-center gap-2 text-sm text-text-muted">
              <code>{lab.code}</code>
              {lab.is_free_demo ? <Badge tone="geometry">{t('demoBadge')}</Badge> : null}
              <StatusBadge status={lab.status} />
            </span>
          </li>
        ))}
      </ul>
    </Container>
  );
}
