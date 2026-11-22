import 'server-only';
import { createUserClient } from '@/lib/supabase/server';

/**
 * MFA assurance level of the current request, read from a token that is first verified with
 * the auth server (passing the JWT makes supabase-js call getUser(jwt) before decoding it).
 */
export async function assuranceLevel(): Promise<{ current: string | null; next: string | null }> {
  const supabase = await createUserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { current: null, next: null };
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel(
    session.access_token,
  );
  if (error || !data) return { current: null, next: null };
  return { current: data.currentLevel, next: data.nextLevel };
}
