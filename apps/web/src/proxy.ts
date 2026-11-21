import { createServerClient } from '@supabase/ssr';
import createMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';
import { routing } from './i18n/routing';
import { buildCsp, createNonce } from './lib/csp';

const intl = createMiddleware(routing);

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> };

/**
 * Refreshes the Supabase session (if any) so Server Components see a valid token.
 * Authorization itself happens in server code (src/server/authz.ts), not here.
 */
async function refreshSession(request: NextRequest): Promise<CookieToSet[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const hasSession = request.cookies.getAll().some((c) => c.name.startsWith('sb-'));
  if (!url || !key || !hasSession) return [];

  const toSet: CookieToSet[] = [];
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const c of list) {
          request.cookies.set(c.name, c.value);
          toSet.push(c);
        }
      },
    },
  });
  await supabase.auth.getUser();
  return toSet;
}

export default async function proxy(request: NextRequest) {
  const nonce = createNonce();
  const csp = buildCsp(nonce, process.env.NODE_ENV === 'development');
  // next-intl forwards request headers; Next reads the nonce from the request CSP header.
  request.headers.set('x-nonce', nonce);
  request.headers.set('Content-Security-Policy', csp);
  // Lets layouts build a return path for the login redirect (always overwritten here).
  request.headers.set('x-pathname', request.nextUrl.pathname);

  const cookies = await refreshSession(request);
  const response = intl(request);

  response.headers.set('Content-Security-Policy', csp);
  for (const { name, value, options } of cookies) response.cookies.set(name, value, options);
  return response;
}

export const config = {
  // Everything except API routes, Next internals and files with an extension.
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};
