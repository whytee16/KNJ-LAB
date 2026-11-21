import 'server-only';
import type { Locale } from '@knj/i18n';
import { cache } from 'react';
import { createUserClient } from '@/lib/supabase/server';

export const SUBJECTS = ['algebra', 'geometry', 'physics'] as const;
export type SubjectCode = (typeof SUBJECTS)[number];
export const GRADES = [7, 8, 9, 10, 11] as const;

export function isSubject(v: string): v is SubjectCode {
  return (SUBJECTS as readonly string[]).includes(v);
}

/** Picks the row for `locale`, falling back to Russian. */
export function pickLocale<T extends { locale: string }>(
  rows: T[] | null | undefined,
  locale: Locale,
): T | undefined {
  return rows?.find((r) => r.locale === locale) ?? rows?.find((r) => r.locale === 'ru');
}

export const defaultCurriculumId = cache(async (): Promise<string> => {
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from('curricula')
    .select('id')
    .eq('is_default', true)
    .single();
  if (error || !data) throw new Error('default curriculum is missing');
  return data.id;
});

export interface CurriculumQuarter {
  quarter: number;
  sections: {
    id: string;
    title: string;
    titleRu: string;
    titleKk: string;
    sort: number;
    topics: { id: string; slug: string; title: string; published: boolean }[];
  }[];
}

/**
 * Sections and topics for one subject and grade. Public callers see published topics only
 * (RLS hides the rest); staff see every attached topic, flagged by `published`.
 */
export async function getCurriculum(
  subject: SubjectCode,
  grade: number,
  locale: Locale,
  { staff = false }: { staff?: boolean } = {},
): Promise<CurriculumQuarter[]> {
  const supabase = await createUserClient();
  const curriculumId = await defaultCurriculumId();
  // Drafts are readable by staff only; public pages must not even ask for them.
  const topicFields = staff
    ? 'id, slug, topic_contents(locale, title), topic_drafts(locale, title)'
    : 'id, slug, topic_contents(locale, title)';
  const { data: sections, error } = await supabase
    .from('curriculum_sections')
    .select(
      `id, quarter, sort, created_at, curriculum_section_translations(locale, title), curriculum_topics(sort, topic_id, topics(${topicFields}))`,
    )
    .eq('curriculum_id', curriculumId)
    .eq('subject_code', subject)
    .eq('grade', grade)
    .order('quarter')
    .order('sort')
    .order('created_at');
  if (error) throw new Error(`curriculum query failed: ${error.message}`);

  return [1, 2, 3, 4].map((quarter) => ({
    quarter,
    sections: (sections ?? [])
      .filter((s) => s.quarter === quarter)
      .map((s) => ({
        id: s.id,
        sort: s.sort,
        title: pickLocale(s.curriculum_section_translations, locale)?.title ?? '',
        titleRu: s.curriculum_section_translations.find((t) => t.locale === 'ru')?.title ?? '',
        titleKk: s.curriculum_section_translations.find((t) => t.locale === 'kk')?.title ?? '',
        topics: [...s.curriculum_topics]
          .sort((a, b) => a.sort - b.sort)
          .flatMap((ct) => {
            const t = ct.topics as unknown as {
              id: string;
              slug: string;
              topic_contents: { locale: string; title: string }[];
              topic_drafts?: { locale: string; title: string }[];
            } | null;
            if (!t) return [];
            const published = pickLocale(t.topic_contents, locale);
            const draft = pickLocale(t.topic_drafts ?? [], locale);
            const title = published?.title ?? draft?.title ?? t.slug;
            return [{ id: t.id, slug: t.slug, title, published: Boolean(published) }];
          }),
      })),
  }));
}

export interface TopicPageData {
  id: string;
  slug: string;
  subject: SubjectCode;
  locale: Locale;
  title: string;
  summary: string;
  objectives: string[];
  theory: string;
  mistakes: string[];
  version: number;
  publishedAt: string;
  placement: { grade: number; quarter: number; section: string } | null;
}

export async function getTopicPage(slug: string, locale: Locale): Promise<TopicPageData | null> {
  const supabase = await createUserClient();
  const { data: topic } = await supabase
    .from('topics')
    .select(
      'id, slug, subject_code, topic_contents(*), curriculum_topics(curriculum_sections(grade, quarter, curriculum_section_translations(locale, title)))',
    )
    .eq('slug', slug)
    .maybeSingle();
  const content = pickLocale(topic?.topic_contents, locale);
  if (!topic || !content || !isSubject(topic.subject_code)) return null;
  const section = topic.curriculum_topics[0]?.curriculum_sections;
  return {
    id: topic.id,
    slug: topic.slug,
    subject: topic.subject_code,
    locale: content.locale,
    title: content.title,
    summary: content.summary,
    objectives: content.objectives,
    theory: content.theory,
    mistakes: content.mistakes,
    version: content.version,
    publishedAt: content.published_at,
    placement: section
      ? {
          grade: section.grade,
          quarter: section.quarter,
          section: pickLocale(section.curriculum_section_translations, locale)?.title ?? '',
        }
      : null,
  };
}

export interface FormulaListItem {
  id: string;
  code: string;
  subject: SubjectCode;
  gradeFrom: number;
  gradeTo: number;
  latex: string;
  name: string;
  description: string;
  variables: { symbol: string; meaning: string; unit: string }[];
  favorite: boolean;
}

export interface FormulaFilters {
  q?: string;
  subject?: SubjectCode;
  grade?: number;
  favoritesOf?: string;
  userId?: string;
}

/** Published formulas with optional search and filters (search runs over the visitor's locale). */
export async function listFormulas(
  locale: Locale,
  filters: FormulaFilters,
): Promise<FormulaListItem[]> {
  const supabase = await createUserClient();
  let query = supabase
    .from('formulas')
    .select(
      'id, code, subject_code, grade_from, grade_to, latex, formula_translations(locale, name, description, variables)',
    )
    .eq('status', 'published')
    .order('subject_code')
    .order('code');
  if (filters.subject) query = query.eq('subject_code', filters.subject);
  if (filters.grade) query = query.lte('grade_from', filters.grade).gte('grade_to', filters.grade);
  const { data, error } = await query;
  if (error) throw new Error(`formulas query failed: ${error.message}`);

  let favorites = new Set<string>();
  if (filters.userId) {
    const { data: favs } = await supabase
      .from('favorites')
      .select('formula_id')
      .eq('profile_id', filters.userId);
    favorites = new Set((favs ?? []).map((f) => f.formula_id));
  }

  const q = filters.q?.trim().toLowerCase();
  return (data ?? [])
    .flatMap((f) => {
      const text = pickLocale(f.formula_translations, locale);
      if (!text || !isSubject(f.subject_code)) return [];
      const item: FormulaListItem = {
        id: f.id,
        code: f.code,
        subject: f.subject_code,
        gradeFrom: f.grade_from,
        gradeTo: f.grade_to,
        latex: f.latex,
        name: text.name,
        description: text.description,
        variables: Array.isArray(text.variables)
          ? (text.variables as FormulaListItem['variables'])
          : [],
        favorite: favorites.has(f.id),
      };
      return [item];
    })
    .filter((f) => !filters.favoritesOf || f.favorite)
    .filter(
      (f) =>
        !q ||
        [f.name, f.description, f.latex, ...f.variables.map((v) => v.meaning)].some((s) =>
          s.toLowerCase().includes(q),
        ),
    );
}
