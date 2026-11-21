import { isLocale } from '@knj/i18n';
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { createUserClient } from '@/lib/supabase/server';
import { safeNext } from '@/server/redirects';

/**
 * Target of e-mail links (sign-up confirmation, password recovery). Exchanges the one-time
 * PKCE code for a session, then continues to a same-locale path.
 */
export async function GET(
  request: NextRequest,
  { params }: RouteContext<'/[locale]/auth/callback'>,
) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : 'ru';
  const url = request.nextUrl;
  // Redirect to the configured origin, never one derived from request headers (Host spoofing).
  const origin = env().APP_URL;
  const code = url.searchParams.get('code');
  const next = safeNext(url.searchParams.get('next'), locale, `/${locale}/parent`);

  if (code) {
    const supabase = await createUserClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }
  return NextResponse.redirect(new URL(`/${locale}/login?error=link`, origin));
}
