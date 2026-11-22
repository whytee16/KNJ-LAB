import { Badge, Card } from '@knj/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { LabListItem } from './queries';

const TONE = { algebra: 'algebra', geometry: 'geometry', physics: 'physics' } as const;

export async function LabCard({ lab }: { lab: LabListItem }) {
  const t = await getTranslations('labs');
  const s = await getTranslations('studio.subjects');
  return (
    <Card className="flex h-full flex-col gap-3" data-testid={`lab-${lab.code}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={TONE[lab.subject as keyof typeof TONE] ?? 'neutral'}>
          {s(lab.subject as 'physics')}
        </Badge>
        <Badge tone={lab.isFreeDemo ? 'geometry' : 'accent'}>
          {lab.isFreeDemo ? t('freeDemo') : t('withPass')}
        </Badge>
        <span className="text-sm text-text-muted">{t('fromGrade', { grade: lab.grade })}</span>
      </div>
      <h3 className="text-lg font-semibold">
        <Link href={`/labs/${lab.code}`} className="underline-offset-4 hover:underline">
          {lab.title}
        </Link>
      </h3>
      {lab.goal ? <p className="text-sm text-text-muted">{lab.goal}</p> : null}
      <div className="mt-auto">
        <Link
          href={`/labs/${lab.code}`}
          className="inline-flex min-h-11 items-center text-sm font-medium text-accent underline underline-offset-4"
        >
          {t('open')}
        </Link>
      </div>
    </Card>
  );
}
