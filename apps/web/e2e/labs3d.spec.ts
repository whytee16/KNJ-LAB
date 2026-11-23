import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { createStaff, enrollTotp, resetDraftLabsAndImport, signIn } from './staff';

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
  await resetDraftLabsAndImport([
    { code: 'projectile', topic: 'projectile-motion' },
    { code: 'inclined-plane', topic: 'inclined-plane-motion' },
    { code: 'math-pendulum', topic: 'pendulums' },
    { code: 'spring-pendulum', topic: 'pendulums' },
    { code: 'circuit', topic: 'ohms-law-connections' },
  ]);
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

  await page.getByRole('button', { name: 'Проверено учителем', exact: true }).click();
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

test('inclined plane: reviewed and published, forces and the rest condition', async ({
  browser,
}) => {
  const page = reviewerPage;
  await page.goto('/ru/studio/labs');
  await page.getByRole('link', { name: 'Брусок на наклонной плоскости' }).click();
  await page.getByRole('button', { name: 'Проверено учителем', exact: true }).click();
  await expect(page.getByTestId('ai-reviewed')).toBeVisible();
  await page.getByLabel('Бесплатное демо').check();
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByText('Сохранено.')).toBeVisible();
  await page.getByRole('button', { name: 'Опубликовать' }).click();
  await expect(page.getByText('Опубликовано.')).toBeVisible();

  const guest = await newPage(browser);
  await guest.goto('/ru/labs/inclined-plane');
  await guest.getByRole('button', { name: '3D' }).click();
  await expect(guest.getByTestId('scene-3d').locator('canvas')).toBeVisible();
  // α = 30°, μ = 0,2: a = g(sin α − μ cos α) ≈ 3,2 m/s².
  await expect(guest.getByTestId('readout-a')).toContainText('3,2');
  await expect(guest.getByTestId('motion-state')).toContainText('скользит');

  const mass = guest.getByRole('textbox', { name: /^Масса бруска/ });
  await mass.fill('9');
  await mass.press('Enter');
  await expect(guest.getByTestId('readout-a')).toContainText('3,2'); // does not depend on the mass

  const mu = guest.getByRole('textbox', { name: /^Коэффициент трения/ });
  await mu.fill('0,6');
  await mu.press('Enter');
  await expect(guest.getByTestId('motion-state')).toContainText('покоится');
  await expect(guest.getByTestId('motion-state')).toContainText('30,96');
  await expect(guest.getByTestId('readout-a')).toContainText('0');

  await guest.getByRole('button', { name: '2D' }).click();
  await expect(guest.getByTestId('scene-2d').locator('[data-force="Ffr"]')).toBeVisible();
  await expect(guest.getByTestId('scene-2d').locator('[data-force="ma"]')).toHaveCount(0);
  const overflow = await guest.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  const { violations } = await new AxeBuilder({ page: guest }).analyze();
  expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
});

async function reviewAndPublish(page: Page, title: string) {
  await page.goto('/ru/studio/labs');
  await page.getByRole('link', { name: title }).click();
  await page.getByRole('button', { name: 'Проверено учителем', exact: true }).click();
  await expect(page.getByTestId('ai-reviewed')).toBeVisible();
  await page.getByLabel('Бесплатное демо').check();
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByText('Сохранено.')).toBeVisible();
  await page.getByRole('button', { name: 'Опубликовать' }).click();
  await expect(page.getByText('Опубликовано.')).toBeVisible();
}

test('mathematical pendulum: period by length, not by mass; large angles differ from the formula', async ({
  browser,
}) => {
  await reviewAndPublish(reviewerPage, 'Математический маятник');
  const page = await newPage(browser);
  await page.goto('/ru/labs/math-pendulum');
  await page.getByRole('button', { name: '3D' }).click();
  await expect(page.getByTestId('scene-3d').locator('canvas')).toBeVisible();
  await expect(page.getByTestId('readout-T0')).toContainText('2,007');

  const mass = page.getByRole('textbox', { name: /^Масса груза/ });
  await mass.fill('2');
  await mass.press('Enter');
  await expect(page.getByTestId('readout-T0')).toContainText('2,007');

  const len = page.getByRole('textbox', { name: /^Длина нити/ });
  await len.fill('0,25');
  await len.press('Enter');
  await expect(page.getByTestId('readout-T0')).toContainText('1,004'); // 4× shorter → 2× faster (2,007 / 2)

  const angle = page.getByRole('textbox', { name: /^Начальный угол/ });
  await angle.fill('60');
  await angle.press('Enter');
  await expect(page.getByTestId('readout-deviation')).toContainText('7,3');

  await page.getByRole('button', { name: '2D' }).click();
  await expect(page.getByTestId('scene-2d')).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
});

test('spring pendulum: period does not depend on the amplitude, energy grows as A²', async ({
  browser,
}) => {
  await reviewAndPublish(reviewerPage, 'Пружинный маятник');
  const page = await newPage(browser);
  await page.goto('/ru/labs/spring-pendulum');
  await page.getByRole('button', { name: '3D' }).click();
  await expect(page.getByTestId('scene-3d').locator('canvas')).toBeVisible();
  await expect(page.getByTestId('readout-T')).toContainText('0,993');
  await expect(page.getByTestId('readout-E')).toContainText('0,2');

  const amp = page.getByRole('textbox', { name: /^Амплитуда/ });
  await amp.fill('0,2');
  await amp.press('Enter');
  await expect(page.getByTestId('readout-T')).toContainText('0,993');
  await expect(page.getByTestId('readout-E')).toContainText('0,8');

  // Running moves the block: x leaves the starting amplitude.
  await page.getByRole('button', { name: 'Запуск' }).click();
  await expect(page.getByTestId('readout-x')).not.toContainText('0,2', { timeout: 5000 });
  await page.getByRole('button', { name: 'Пауза' }).click();

  await page.getByRole('button', { name: '2D' }).click();
  await expect(page.getByTestId('scene-2d')).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('circuit: Ohm law, series and parallel rules, the switch and the meters', async ({
  browser,
}) => {
  await reviewAndPublish(reviewerPage, 'Закон Ома и соединения проводников');
  const page = await newPage(browser);
  await page.goto('/ru/labs/circuit');
  await page.getByRole('button', { name: '3D' }).click();
  await expect(page.getByTestId('scene-3d').locator('canvas')).toBeVisible();

  // Open switch: no current, the meters show zero; the calculation is still there.
  await expect(page.getByTestId('switch-state')).toContainText('Ключ разомкнут');
  await expect(page.getByTestId('readout-I')).toContainText('0');
  await expect(page.getByTestId('readout-calc-I')).toContainText('0,4');

  // Series, ε = 12 V, R1 = 10 Ω, R2 = 20 Ω: I = 0,4 A, U1 = 4 V.
  await page.getByRole('button', { name: 'Запуск' }).click();
  await expect(page.getByTestId('switch-state')).toContainText('Ключ замкнут');
  await expect(page.getByTestId('readout-I')).toContainText('0,4');
  await expect(page.getByTestId('readout-U1')).toContainText('4');
  await expect(page.getByTestId('rule')).toContainText('4 В + 8 В = 12 В');

  // Parallel: I = 1,8 A, I1 = 1,2 A, I2 = 0,6 A.
  await page.getByRole('radio', { name: 'Параллельное' }).check();
  await expect(page.getByTestId('readout-I')).toContainText('1,8');
  await expect(page.getByTestId('readout-I1')).toContainText('1,2');
  await expect(page.getByTestId('readout-I2')).toContainText('0,6');

  // Internal resistance: the terminal voltage drops below the EMF.
  const r = page.getByRole('textbox', { name: /^Внутреннее сопротивление/ });
  await r.fill('2');
  await r.press('Enter');
  await expect(page.getByTestId('readout-U')).not.toContainText('12');

  // Opening the switch stops the current.
  await page.getByRole('button', { name: 'Пауза' }).click();
  await expect(page.getByTestId('readout-I')).toHaveText(/I\s*0\s*А$/);

  await page.getByRole('button', { name: '2D' }).click();
  await expect(page.getByTestId('scene-2d').locator('[data-meter="A"]')).toBeVisible();
  await expect(page.getByTestId('scene-2d').locator('[data-meter="V"]')).toBeVisible();
});

test('circuit lab fits a phone and is accessible', async ({ browser }) => {
  const page = await newPage(browser, { viewport: { width: 390, height: 860 } });
  await page.goto('/ru/labs/circuit');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Закон Ома и соединения проводников',
  );
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
});
