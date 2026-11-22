import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { createStaff, enrollTotp, resetProjectileAndImportDrafts, signIn } from './staff';

// 3D lab "projectile": AI drafts are imported, blocked until a reviewer confirms the check,
// then the 3D scene, the 2D fallback and the readouts work for visitors.
test.describe.configure({ mode: 'serial' });

const run = Date.now().toString(36);
const password = 'Labs3d2026pass';
const reviewer = `l3r-${run}@example.test`;
const contexts: BrowserContext[] = [];
let use: object;
async function newPage(browser: Browser, extra: object = {}): Promise<Page> {
  const ctx = await browser.newContext({ ...use, ...extra });
  contexts.push(ctx);
  return ctx.newPage();
}
let reviewerPage: Page;

test.beforeAll(async ({}, testInfo) => {
  use = testInfo.project.use;
  await resetProjectileAndImportDrafts();
  await createStaff(reviewer, password, 'reviewer', 'Методист');
});
test.afterAll(async () => {
  for (const c of contexts) await c.close();
});

test('imported AI draft cannot be published until a reviewer confirms the check', async ({
  browser,
}) => {
  reviewerPage = await newPage(browser);
  const page = reviewerPage;
  await signIn(page, reviewer, password);
  await enrollTotp(page);
  await page.goto('/ru/studio/labs');
  await page.getByRole('link', { name: 'Бросок под углом к горизонту' }).click();
  await expect(page.getByTestId('ai-draft')).toContainText(
    'Подготовлено автоматически — требует проверки',
  );
  await expect(page.getByLabel('Цель').first()).toHaveValue(/Выяснить, как дальность/);

  await page.getByRole('button', { name: 'Опубликовать' }).click();
  await expect(
    page.getByText(
      'Сначала подтвердите, что автоматически подготовленный текст проверен учителем.',
    ),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Проверено учителем' }).click();
  await expect(page.getByTestId('ai-reviewed')).toBeVisible();
  await expect(page.getByTestId('ai-draft')).toHaveCount(0);
  await page.getByLabel('Бесплатное демо').check();
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByText('Сохранено.')).toBeVisible();
  await page.getByRole('button', { name: 'Опубликовать' }).click();
  await expect(page.getByText('Опубликовано.')).toBeVisible();
});

test('imported topic draft is marked in the studio as well', async () => {
  await reviewerPage.goto('/ru/studio');
  await reviewerPage
    .getByRole('link', { name: 'Движение тела, брошенного под углом к горизонту' })
    .click();
  await expect(reviewerPage.getByTestId('ai-draft')).toBeVisible();
});

test('3D scene renders and follows the parameters; 2D view shows the same numbers', async ({
  browser,
}) => {
  const page = await newPage(browser);
  await page.goto('/ru/labs/projectile');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Бросок под углом к горизонту');
  await expect(page.getByText('Сопротивление воздуха не учитывается.')).toBeVisible();

  await page.getByRole('button', { name: '3D' }).click();
  await expect(page.getByTestId('scene-3d').locator('canvas')).toBeVisible();

  // From the ground at 45° and 15 m/s on the Earth: L = v²/g ≈ 22,96 m.
  await expect(page.getByTestId('readout-L')).toContainText('22,96');
  const angle = page.getByRole('textbox', { name: /^Угол к горизонту/ });
  await angle.fill('30');
  await angle.press('Enter');
  await expect(page.getByTestId('readout-L')).toContainText('19,88');
  // Complementary angle — same range.
  await angle.fill('60');
  await angle.press('Enter');
  await expect(page.getByTestId('readout-L')).toContainText('19,88');

  await page.getByRole('radio', { name: 'Луна 1,6' }).check();
  await expect(page.getByTestId('readout-T')).toContainText('16,24');

  await page.getByRole('button', { name: '2D' }).click();
  await expect(page.getByTestId('scene-2d')).toBeVisible();
  await expect(page.getByTestId('scene-3d')).toHaveCount(0);
  await expect(page.getByText('Включён упрощённый вид', { exact: false })).toHaveCount(0);
  await expect(page.getByTestId('readout-T')).toContainText('16,24');

  // The choice is remembered for this browser.
  await page.reload();
  await expect(page.getByTestId('scene-2d')).toBeVisible();
  await expect(page.getByRole('button', { name: '2D' })).toHaveAttribute('aria-pressed', 'true');
});

test('without WebGL the lab opens in 2D and 3D cannot be chosen', async ({ browser }) => {
  const page = await newPage(browser);
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...rest: unknown[]
    ) {
      if (type.startsWith('webgl')) return null;
      return original.call(this, type as '2d', ...(rest as []));
    } as typeof original;
  });
  await page.goto('/ru/labs/projectile');
  await expect(page.getByTestId('scene-2d')).toBeVisible();
  await expect(page.getByRole('button', { name: '3D' })).toBeDisabled();
});

for (const width of [390, 1440])
  test(`projectile lab fits ${width}px and is accessible`, async ({ browser }) => {
    const page = await newPage(browser, { viewport: { width, height: 860 } });
    await page.goto('/ru/labs/projectile');
    await page.getByRole('button', { name: '3D' }).click();
    await expect(page.getByTestId('scene-3d')).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(page).toHaveTitle(/\S/);
    const { violations } = await new AxeBuilder({ page }).analyze();
    const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
  });
