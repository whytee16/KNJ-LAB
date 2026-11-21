import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export function BrandLink() {
  const t = useTranslations('nav');
  return (
    <Link href="/" aria-label={t('home')} className="text-lg font-bold tracking-tight">
      KNJ <span className="text-accent">LAB</span>
    </Link>
  );
}
