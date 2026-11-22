import 'server-only';
import { FREE_DIFFICULTY, type Difficulty } from '@knj/task-engine';
import { createAdminClient } from '@/lib/supabase/admin';

/** Active pass of a student (latest end), or null. The DB re-checks this on every paid task. */
export async function activePass(studentId: string): Promise<{ endsAt: string } | null> {
  const now = new Date().toISOString();
  const { data, error } = await createAdminClient()
    .from('entitlements')
    .select('ends_at')
    .eq('student_id', studentId)
    .is('revoked_at', null)
    .lte('starts_at', now)
    .gt('ends_at', now)
    .order('ends_at', { ascending: false })
    .limit(1);
  if (error) throw new Error(`entitlement query failed: ${error.message}`);
  return data?.[0] ? { endsAt: data[0].ends_at } : null;
}

export async function canUseLevel(studentId: string, difficulty: Difficulty): Promise<boolean> {
  return difficulty === FREE_DIFFICULTY || (await activePass(studentId)) !== null;
}
