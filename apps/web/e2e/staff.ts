import { expect, type Page } from '@playwright/test';
import { TOTP } from 'otpauth';
import postgres from 'postgres';

const DB =
  process.env.E2E_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

/** Creates a confirmed account through the Auth admin API and gives it a role (local stack only). */
export async function createStaff(email: string, password: string, role: string, name: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env is missing (apps/web/.env.local)');
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: name },
    }),
  });
  if (!res.ok) throw new Error(`createStaff failed: ${res.status} ${await res.text()}`);
  const sql = postgres(DB, { max: 1, onnotice: () => undefined });
  try {
    await sql`update public.profiles p set role = ${role}::public.app_role from auth.users u
              where u.id = p.id and u.email = ${email}`;
  } finally {
    await sql.end();
  }
}

export function totpCode(secret: string, offsetSteps = 0): string {
  const totp = new TOTP({ secret, digits: 6, period: 30, algorithm: 'SHA1' });
  return totp.generate({ timestamp: Date.now() + offsetSteps * 30_000 });
}

export async function signIn(page: Page, email: string, password: string) {
  await page.goto('/ru/login');
  await page.getByLabel('E-mail или логин ученика').fill(email);
  await page.getByLabel('Пароль', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
}

/** First staff login: set up the authenticator and return its secret. */
export async function enrollTotp(page: Page): Promise<string> {
  await expect(page).toHaveURL(/\/ru\/security\/enroll/);
  await page.getByRole('button', { name: 'Подключить приложение' }).click();
  const secret = (await page.getByTestId('totp-secret').textContent())!.trim();
  await page.getByLabel('Код из приложения').fill(totpCode(secret));
  await page.getByRole('button', { name: 'Подтвердить' }).click();
  await expect(page).toHaveURL(/\/ru\/studio/);
  return secret;
}
