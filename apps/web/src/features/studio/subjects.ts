import 'server-only';
import type { Locale } from '@knj/i18n';
import { createUserClient } from '@/lib/supabase/server';
import { pickLocale } from '@/features/content/queries';

/** Subject names from the database (reference data), for selects. */
export async function subjectOptions(locale: Locale) {
  const supabase = await createUserClient();
  const { data } = await supabase
    .from('subjects')
    .select('code, sort, subject_translations(locale, name)')
    .order('sort');
  return (data ?? []).map((s) => ({
    value: s.code,
    label: pickLocale(s.subject_translations, locale)?.name ?? s.code,
  }));
}
