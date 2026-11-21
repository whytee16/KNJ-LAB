import 'server-only';
import type { Locale } from '@knj/i18n';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/supabase/database.types';

export type LegalType = Database['public']['Enums']['legal_document_type'];

export interface LegalDocument {
  type: LegalType;
  version: string;
  locale: Locale;
  title: string;
  body: string;
  isDraft: boolean;
}

/**
 * Current published document of a type in the requested locale, falling back to Russian.
 * Returns null when nothing is published: features that need consent must then stay closed.
 */
export async function currentDocument(
  type: LegalType,
  locale: Locale,
): Promise<LegalDocument | null> {
  const { data, error } = await createAdminClient()
    .from('legal_documents')
    .select('type, version, locale, title, body, is_draft, published_at')
    .eq('type', type)
    .not('published_at', 'is', null)
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false });
  if (error) throw new Error(`legal documents query failed: ${error.message}`);
  const latest = data?.[0];
  if (!latest) return null;
  const sameVersion = data.filter((d) => d.version === latest.version);
  const doc =
    sameVersion.find((d) => d.locale === locale) ??
    sameVersion.find((d) => d.locale === 'ru') ??
    latest;
  return {
    type: doc.type,
    version: doc.version,
    locale: doc.locale,
    title: doc.title,
    body: doc.body,
    isDraft: doc.is_draft,
  };
}
