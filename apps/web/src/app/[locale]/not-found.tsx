import { buttonVariants, Container } from '@knj/ui';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function NotFound() {
  const t = useTranslations('notFound');
  return (
    <main id="main">
      <Container className="flex min-h-dvh flex-col items-start justify-center gap-4 py-16">
        <p className="text-sm font-medium text-accent">404</p>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{t('title')}</h1>
        <p className="max-w-md text-text-muted">{t('description')}</p>
        <Link href="/" className={buttonVariants()}>
          {t('back')}
        </Link>
      </Container>
    </main>
  );
}
