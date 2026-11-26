import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { createStaff, enrollTotp, resetDraftLabsAndImport, signIn } from './staff';

// Ray optics (stage 5q.1): reflection, refraction with total internal reflection, thin lens.
test.describe.configure({ mode: 'serial' });

const run = Date.now().toString(36);
const password = 'Optics2026pass';
const reviewer = `opt-${run}@example.test`;
const contexts: BrowserContext[] = [];
let use: object;
async function newPage(browser: Browser, extra: object = {}): Promise<Page> {
  const ctx = await browser.newContext({ ...use, ...extra });
  contexts.push(ctx);
  return ctx.newPage();
}

test.beforeAll(async ({}, testInfo) => {
  use = testInfo.project.use;
  await resetDraftLabsAndImport([
    { code: 'reflection', topic: 'light-reflection' },
    { code: 'refraction', topic: 'light-refraction' },
    { code: 'thin-lens', topic: 'thin-lens' },
  ]);
  await createStaff(reviewer, password, 'reviewer', 'Методист');
});
test.afterAll(async () => {
  for (const c of contexts) await c.close();
});

async function setParam(page: Page, label: RegExp, value: string) {
  // The 3D switch turns on only after hydration: typing earlier would be lost.
  await expect(page.getByRole('button', { name: '3D' })).toBeEnabled();
  const field = page.getByRole('textbox', { name: label });
  await field.fill(value);
  await field.press('Enter');
}

test('the reviewer confirms and publishes the three optics labs with their questions', async ({
  browser,
}) => {
  const page = await newPage(browser);
  await signIn(page, reviewer, password);
  await enrollTotp(page);
  for (const title of [
    'Отражение света. Плоское зеркало',
    'Преломление света. Полное отражение',
    'Тонкая линза',
  ]) {
    await page.goto('/ru/studio/labs');
    await page.getByRole('link', { name: title, exact: true }).click();
    await page.getByLabel('Бесплатное демо').check();
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await expect(page.getByText('Сохранено.')).toBeVisible();
    // Lab texts + 4 questions.
    await page
      .getByTestId('lab-bundle')
      .getByRole('button', { name: /Проверено учителем: тексты и все вопросы \(5\)/ })
      .click();
    await page
      .getByTestId('lab-bundle')
      .getByRole('button', { name: /Опубликовать лабораторию с вопросами \(5\)/ })
      .click();
    await expect(page.getByText('Лаборатория и её вопросы опубликованы.')).toBeVisible();
  }
});

test('reflection: β = α, the reflected ray turns by 2φ, the image is as far behind', async ({
  browser,
}) => {
  const page = await newPage(browser);
  await page.goto('/ru/labs/reflection');
  await page.getByRole('button', { name: '3D' }).click();
  await expect(page.getByTestId('scene-3d').locator('canvas')).toBeVisible();
  await expect(page.getByTestId('readout-i')).toContainText('30');
  await expect(page.getByTestId('readout-r')).toContainText('30');
  await expect(page.getByTestId('readout-dImg')).toContainText('20');
  await setParam(page, /^Поворот зеркала/, '10');
  await expect(page.getByTestId('readout-turn')).toContainText('20');
  await expect(page.getByTestId('readout-i')).toContainText('40');
  await page.getByRole('button', { name: '2D' }).click();
  await expect(page.getByTestId('scene-2d').getByTestId('mirror-image')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Запуск' })).toHaveCount(0);
});

test('refraction: Snell law, then total internal reflection from water', async ({ browser }) => {
  const page = await newPage(browser);
  await page.goto('/ru/labs/refraction');
  // Air → water at 40°: γ = arcsin(sin 40° / 1,33) ≈ 28,9°.
  await expect(page.getByTestId('readout-gamma')).toContainText('28,9');
  await expect(page.getByTestId('optics-status')).toContainText('приближается к перпендикуляру');
  await page.getByRole('radio', { name: 'Вода → воздух' }).check();
  await expect(page.getByTestId('readout-critical')).toContainText('48,75');
  await setParam(page, /^Угол падения/, '60');
  await expect(page.getByTestId('optics-status')).toContainText('полностью отражается');
  await expect(page.getByTestId('optics-steps')).toContainText('> 1');
  await page.getByRole('button', { name: '2D' }).click();
  await expect(page.getByTestId('scene-2d').locator('[data-ray="refracted"]')).toHaveCount(0);
  await expect(page.getByTestId('scene-2d').getByTestId('tir-label')).toBeVisible();
});

test('thin lens: d = 2F, the sharp screen, a magnifier, a diverging lens', async ({ browser }) => {
  const page = await newPage(browser, { viewport: { width: 390, height: 860 } });
  await page.goto('/ru/labs/thin-lens');
  await expect(async () => {
    await setParam(page, /^Расстояние от свечи/, '20');
    await expect(page.getByTestId('readout-f')).toContainText('20', { timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await expect(page.getByTestId('readout-G')).toContainText('1');
  await expect(page.getByTestId('optics-status')).toContainText('перевёрнутое');
  await expect(page.getByTestId('screen-state')).toContainText('резкое');
  await setParam(page, /^Расстояние от линзы до экрана/, '35');
  await expect(page.getByTestId('screen-state')).toContainText('размытое');

  await setParam(page, /^Расстояние от свечи/, '5');
  await expect(page.getByTestId('optics-status')).toContainText('мнимое, прямое, увеличенное');
  await expect(page.getByTestId('screen-state')).toContainText('нельзя получить на экране');

  await page.getByRole('radio', { name: 'Рассеивающая' }).check();
  await setParam(page, /^Расстояние от свечи/, '25');
  await expect(page.getByTestId('optics-status')).toContainText('мнимое, прямое, уменьшенное');
  await expect(page.getByTestId('readout-D')).toContainText('-10');

  await page.getByRole('button', { name: '2D' }).click();
  await expect(page.getByTestId('scene-2d').locator('[data-ray="virtual"]').first()).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
});
