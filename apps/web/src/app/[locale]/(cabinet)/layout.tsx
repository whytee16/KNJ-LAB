import { headers } from 'next/headers';
import { CabinetHeader } from '@/features/shell/cabinet-header';
import { pageLocale } from '@/features/shell/page-locale';
import { requireUser } from '@/server/authz';

/** Signed-in area. Each page additionally checks its role (src/server/authz.ts). */
export default async function CabinetLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const locale = await pageLocale(params);
  const next = (await headers()).get('x-pathname') ?? undefined;
  const user = await requireUser(locale, { next });
  return (
    <>
      <CabinetHeader locale={locale} name={user.displayName} />
      <main id="main">{children}</main>
    </>
  );
}
