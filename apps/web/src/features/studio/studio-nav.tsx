import { Container } from '@knj/ui';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { AppRole } from '@/server/redirects';

export function StudioNav({ role }: { role: AppRole }) {
  const t = useTranslations('studio.nav');
  const items = [
    { href: '/studio', label: t('topics') },
    { href: '/studio/formulas', label: t('formulas') },
    ...(role === 'reviewer' || role === 'admin'
      ? [{ href: '/studio/curriculum', label: t('curriculum') }]
      : []),
    ...(role === 'admin' ? [{ href: '/studio/users', label: t('users') }] : []),
  ];
  return (
    <nav aria-label={t('label')} className="border-b border-border bg-surface">
      <Container className="flex gap-1 overflow-x-auto py-2">
        {items.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className="rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap hover:bg-surface-muted"
          >
            {i.label}
          </Link>
        ))}
      </Container>
    </nav>
  );
}
