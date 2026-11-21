import type { Locale } from '@knj/i18n';
import { Button } from '@knj/ui';
import { useTranslations } from 'next-intl';
import { signOut } from './actions';

/** Plain form post: works without JavaScript. */
export function SignOutButton({ locale }: { locale: Locale }) {
  const t = useTranslations('common');
  return (
    <form action={signOut}>
      <input type="hidden" name="locale" value={locale} />
      <Button type="submit" variant="ghost" size="sm">
        {t('signOut')}
      </Button>
    </form>
  );
}
