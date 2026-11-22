import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const pages = [
  { path: '/ru/login', h1: 'Вход' },
  { path: '/kk/login', h1: 'Кіру' },
  { path: '/ru/register', h1: 'Регистрация родителя' },
  { path: '/kk/register', h1: 'Ата-ананы тіркеу' },
  { path: '/ru/forgot-password', h1: 'Восстановление пароля' },
  { path: '/kk/forgot-password', h1: 'Құпиясөзді қалпына келтіру' },
  { path: '/ru/learn', h1: 'Учебные темы' },
  { path: '/kk/learn', h1: 'Оқу тақырыптары' },
  { path: '/ru/learn/physics/9', h1: 'Физика · 9 класс' },
  { path: '/ru/reference', h1: 'Справочник формул' },
  { path: '/kk/reference', h1: 'Формулалар анықтамалығы' },
];

for (const p of pages) {
  test(`${p.path} renders, fits the screen and is accessible`, async ({ page }) => {
    await page.goto(p.path);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(p.h1);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    // Next streams <title> after the body; wait for it so axe sees the final document.
  await expect(page).toHaveTitle(/\S/);
  const { violations } = await new AxeBuilder({ page }).analyze();
    const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
  });
}

test('legal document page shows the draft warning in development', async ({ page }) => {
  await page.goto('/ru/legal/pd_processing');
  await expect(
    page.getByText('Черновик для разработки. Не является юридическим документом.'),
  ).toBeVisible();
});

test('unknown legal document type is a 404', async ({ page }) => {
  const res = await page.goto('/ru/legal/unknown');
  expect(res?.status()).toBe(404);
});

test('pages are served with a nonce-based Content-Security-Policy', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && /Content Security Policy/i.test(m.text())) errors.push(m.text());
  });
  const res = await page.goto('/ru/login');
  const csp = res?.headers()['content-security-policy'] ?? '';
  expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
  expect(csp).toContain("frame-ancestors 'none'");
  // Hydrated forms prove that Next's scripts carry the nonce and are not blocked.
  await page.waitForLoadState('networkidle');
  expect(errors).toEqual([]);
});

test('unknown subject or grade in the catalogue is a 404', async ({ page }) => {
  expect((await page.goto('/ru/learn/chemistry/7'))?.status()).toBe(404);
  expect((await page.goto('/ru/learn/algebra/12'))?.status()).toBe(404);
});

test('studio requires signing in', async ({ page }) => {
  await page.goto('/ru/studio');
  await expect(page).toHaveURL(/\/ru\/login\?next=%2Fru%2Fstudio$/);
});
