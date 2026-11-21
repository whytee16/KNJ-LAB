import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const pages = [
  { path: '/ru/login', h1: 'Вход' },
  { path: '/kk/login', h1: 'Кіру' },
  { path: '/ru/register', h1: 'Регистрация родителя' },
  { path: '/kk/register', h1: 'Ата-ананы тіркеу' },
  { path: '/ru/forgot-password', h1: 'Восстановление пароля' },
  { path: '/kk/forgot-password', h1: 'Құпиясөзді қалпына келтіру' },
];

for (const p of pages) {
  test(`${p.path} renders, fits the screen and is accessible`, async ({ page }) => {
    await page.goto(p.path);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(p.h1);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
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
