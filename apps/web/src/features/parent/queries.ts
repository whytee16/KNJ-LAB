import 'server-only';
import { createUserClient } from '@/lib/supabase/server';
import type { ChildSummary } from './child-card';

/** Children of the signed-in parent. Runs as the parent, so RLS limits it to linked students. */
export async function listChildren(parentId: string): Promise<ChildSummary[]> {
  const supabase = await createUserClient();
  const { data: links, error } = await supabase
    .from('parent_student_links')
    .select('student_id')
    .eq('parent_id', parentId)
    .eq('status', 'active');
  if (error) throw new Error(`children query failed: ${error.message}`);
  const ids = (links ?? []).map((l) => l.student_id);
  if (!ids.length) return [];

  const [{ data: profiles }, { data: students }] = await Promise.all([
    supabase.from('profiles').select('id, display_name, created_at').in('id', ids),
    supabase.from('student_profiles').select('profile_id, username, grade').in('profile_id', ids),
  ]);
  const byId = new Map((students ?? []).map((s) => [s.profile_id, s]));
  return (profiles ?? [])
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .flatMap((p) => {
      const s = byId.get(p.id);
      return s
        ? [{ id: p.id, displayName: p.display_name, username: s.username, grade: s.grade }]
        : [];
    });
}
