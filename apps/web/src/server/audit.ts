import 'server-only';
import type { Json } from '@/lib/supabase/database.types';
import { createAdminClient } from '@/lib/supabase/admin';

/** Appends to audit_logs. Details must not contain personal data beyond IDs. */
export async function audit(
  actorId: string | null,
  action: string,
  entity: string,
  entityId: string | null,
  details: Record<string, Json> = {},
): Promise<void> {
  const { error } = await createAdminClient().rpc('write_audit', {
    p_actor: actorId as string,
    p_action: action,
    p_entity: entity,
    p_entity_id: entityId as string,
    p_details: details,
  });
  if (error) throw new Error(`audit failed: ${error.message}`);
}
