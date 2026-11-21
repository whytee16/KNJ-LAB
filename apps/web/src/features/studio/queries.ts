import 'server-only';
import { createUserClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';

type DraftStatus = Database['public']['Enums']['draft_status'];
type Locale = 'ru' | 'kk';

export interface StudioTopicRow {
  id: string;
  slug: string;
  subject: string;
  title: string;
  locales: Record<Locale, { draft: DraftStatus | null; version: number | null; machine: boolean }>;
  updatedAt: string;
}

export async function listStudioTopics(): Promise<StudioTopicRow[]> {
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from('topics')
    .select(
      'id, slug, subject_code, updated_at, topic_drafts(locale, title, status, is_machine_translation, updated_at), topic_contents(locale, version)',
    )
    .order('updated_at', { ascending: false });
  if (error) throw new Error(`studio topics failed: ${error.message}`);
  return (data ?? []).map((t) => {
    const locales = {} as StudioTopicRow['locales'];
    for (const l of ['ru', 'kk'] as const) {
      const d = t.topic_drafts.find((x) => x.locale === l);
      const c = t.topic_contents.find((x) => x.locale === l);
      locales[l] = {
        draft: d?.status ?? null,
        version: c?.version ?? null,
        machine: d?.is_machine_translation ?? false,
      };
    }
    const title = t.topic_drafts.find((d) => d.locale === 'ru')?.title ?? t.slug;
    return {
      id: t.id,
      slug: t.slug,
      subject: t.subject_code,
      title,
      locales,
      updatedAt: t.updated_at,
    };
  });
}

export async function getTopicForEditor(id: string) {
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from('topics')
    .select(
      'id, slug, subject_code, topic_drafts(*), topic_contents(locale, version, published_at, title)',
    )
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`topic query failed: ${error.message}`);
  return data;
}

export async function listStudioFormulas() {
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from('formulas')
    .select(
      'id, code, subject_code, grade_from, grade_to, latex, status, updated_at, formula_translations(locale, name)',
    )
    .order('updated_at', { ascending: false });
  if (error) throw new Error(`studio formulas failed: ${error.message}`);
  return data ?? [];
}

export async function getFormulaForEditor(id: string) {
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from('formulas')
    .select('*, formula_translations(*)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`formula query failed: ${error.message}`);
  return data;
}

/** Topics of a subject for attaching to curriculum sections. */
export async function topicOptions(subject: string) {
  const supabase = await createUserClient();
  const { data } = await supabase
    .from('topics')
    .select('id, slug, topic_drafts(locale, title)')
    .eq('subject_code', subject)
    .order('slug');
  return (data ?? []).map((t) => ({
    id: t.id,
    label: `${t.topic_drafts.find((d) => d.locale === 'ru')?.title ?? t.slug} (${t.slug})`,
  }));
}
