import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import { StudioNav } from '@/features/studio/studio-nav';
import { pageLocale } from '@/features/shell/page-locale';
import { requireStaff } from '@/server/authz';

/** Content studio: staff roles with a verified second factor only. */
export default async function StudioLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const locale = await pageLocale(params);
  const next = (await headers()).get('x-pathname') ?? `/${locale}/studio`;
  const user = await requireStaff(locale, next);
  return (
    <>
      <StudioNav role={user.role} />
      {children}
    </>
  );
}
