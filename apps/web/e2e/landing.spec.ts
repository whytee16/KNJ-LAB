import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const cases = [
  {
    locale: 'ru',
    lang: 'ru-KZ',
    h1: 'Тренируйся. Понимай. Решай.',
    other: 'Қазақша',
    otherLocale: 'kk',
  },
  { locale: 'kk', lang: 'kk-KZ', h1: 'Жаттық. Түсін. Шеш.', other: 'Русский', otherLocale: 'ru' },
] as const;

test('root redirects to the default locale', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/ru$/);
});

for (const c of cases) {
  test.describe(`landing /${c.locale}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/${c.locale}`);
    });

    test('renders localized content with correct lang', async ({ page }) => {
      await expect(page.locator('html')).toHaveAttribute('lang', c.lang);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(c.h1);
      // KaTeX formulas are rendered on the server.
      expect(await page.locator('.katex').count()).toBeGreaterThanOrEqual(3);
    });

    test('every in-page link points to an existing section', async ({ page }) => {
      const hrefs = await page
        .locator('a[href^="#"]')
        .evaluateAll((as) => as.map((a) => a.getAttribute('href')!));
      expect(hrefs.length).toBeGreaterThan(0);
      for (const href of new Set(hrefs)) {
        await expect(page.locator(href), `target for ${href}`).toHaveCount(1);
      }
    });

    test('has no horizontal overflow', async ({ page }) => {
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });

    test('has no serious accessibility violations', async ({ page }) => {
      // Next streams <title> after the body; wait for it so axe sees the final document.
      await expect(page).toHaveTitle(/\S/);
      const { violations } = await new AxeBuilder({ page }).analyze();
      const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
    });

    test('switching language keeps the current section', async ({ page }) => {
      // Wait for hydration: without JS the switcher falls back to a plain link without the hash.
      await page.waitForLoadState('networkidle');
      await page.locator('main a[href="#pricing"]').first().click();
      await expect(page).toHaveURL(/#pricing$/);
      await page.getByRole('link', { name: c.other, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/${c.otherLocale}#pricing$`));
      await expect(page.locator('html')).toHaveAttribute('lang', `${c.otherLocale}-KZ`);
    });

    test('language links work without JavaScript', async ({ page }) => {
      const href = await page
        .getByRole('link', { name: c.other, exact: true })
        .getAttribute('href');
      expect(href).toBe(`/${c.otherLocale}`);
    });

    test('FAQ items expand without JavaScript-only widgets', async ({ page }) => {
      const first = page.locator('section[aria-labelledby="faq"] details').first();
      await first.locator('summary').click();
      await expect(first).toHaveAttribute('open', '');
    });
  });
}

test('unknown localized path shows a localized 404', async ({ page }) => {
  const res = await page.goto('/kk/does-not-exist');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Бет табылмады');
});

test('health endpoint responds', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.ok()).toBe(true);
  expect(await res.json()).toEqual({ status: 'ok' });
});

test('security headers are set', async ({ request }) => {
  const res = await request.get('/ru');
  const h = res.headers();
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['x-frame-options']).toBe('DENY');
  expect(h['x-powered-by']).toBeUndefined();
});
