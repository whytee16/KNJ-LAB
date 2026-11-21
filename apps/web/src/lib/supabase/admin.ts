import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { supabaseEnv } from '@/lib/env';
import type { Database } from './database.types';

/**
 * Service-role client: bypasses RLS. Only for server code that has already performed
 * authorization (src/server/authz.ts). Never import from client components.
 */
export function createAdminClient() {
  const { url, serviceRoleKey } = supabaseEnv();
  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
