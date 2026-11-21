import { Badge } from '@knj/ui';
import { useTranslations } from 'next-intl';

type Status = 'draft' | 'in_review' | 'approved' | 'published' | 'none';

const tone: Record<Status, 'neutral' | 'accent' | 'geometry' | 'algebra'> = {
  none: 'neutral',
  draft: 'neutral',
  in_review: 'accent',
  approved: 'geometry',
  published: 'geometry',
};

export function StatusBadge({ status }: { status: Status }) {
  const t = useTranslations('studio.status');
  return <Badge tone={tone[status]}>{t(status)}</Badge>;
}
