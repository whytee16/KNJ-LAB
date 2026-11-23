import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import {
  createFamily,
  createStaff,
  enrollTotp,
  grantPass,
  resetDraftLabsAndImport,
  signIn,
} from './staff';

// Mechanics constructor (ADR-0010): four scenarios on shared solvers and one generic view.
test.describe.configure({ mode: 'serial' });

const run = Date.now().toString(36);
const password = 'Scenario2026pass';
const reviewer = `scr-${run}@example.test`;
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
    { code: 'elevator-scales', topic: 'weight-weightlessness' },
    { code: 'lamp-two-ropes', topic: 'equilibrium-forces' },
    { code: 'block-pulley', topic: 'connected-bodies' },
    { code: 'atwood', topic: 'connected-bodies' },
  ]);
  await createStaff(reviewer, password, 'reviewer', 'Методист');
});
test.afterAll(async () => {
  for (const c of contexts) await c.close();
});

async function publish(title: string) {
  const page = reviewerPage;
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

async function setParam(page: Page, label: RegExp, value: string) {
  const field = page.getByRole('textbox', { name: label });
  await field.fill(value);
  await field.press('Enter');
}

test('the reviewer confirms and publishes three scenarios one by one', async ({ browser }) => {
  reviewerPage = await newPage(browser);
  await signIn(reviewerPage, reviewer, password);
  await enrollTotp(reviewerPage);
  for (const title of [
    'Человек на весах в лифте',
    'Лампа на двух тросах',
    'Брусок на столе и груз через блок',
  ])
    await publish(title);
});

test('bundle review: one click confirms the lab texts and all questions, the next publishes them', async ({
  browser,
}) => {
  const page = reviewerPage;
  await page.goto('/ru/studio/labs');
  await page.getByRole('link', { name: 'Машина Атвуда' }).click();
  // Publishing before the check is refused by the database.
  await page.getByRole('button', { name: 'Опубликовать', exact: true }).click();
  await expect(
    page.getByText(
      'Сначала подтвердите, что автоматически подготовленный текст проверен учителем.',
    ),
  ).toBeVisible();
  await page.getByLabel('Бесплатное демо').check();
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByText('Сохранено.')).toBeVisible();
  // Lab texts + 3 questions = 4 confirmations; 3 questions + the lab = 4 publications.
  await page
    .getByTestId('lab-bundle')
    .getByRole('button', { name: /Проверено учителем: тексты и все вопросы \(4\)/ })
    .click();
  await expect(
    page.getByText('Проверка подтверждена для текстов и всех вопросов', { exact: false }),
  ).toBeVisible();
  await page
    .getByTestId('lab-bundle')
    .getByRole('button', { name: /Опубликовать лабораторию с вопросами \(4\)/ })
    .click();
  await expect(page.getByText('Лаборатория и её вопросы опубликованы.')).toBeVisible();

  // A student with a pass gets a question of the lab.
  const family = await createFamily(`bundle${run}`, password);
  await grantPass(family.studentId);
  const student = await newPage(browser);
  await signIn(student, family.username, password);
  await expect(student).toHaveURL(/\/ru\/app$/);
  await student.goto('/ru/labs/atwood');
  await student.getByRole('button', { name: 'Начать' }).click();
  await expect(student.getByRole('progressbar', { name: 'Ответы на вопросы' })).toBeVisible();
  await expect(student.getByRole('button', { name: 'Проверить' })).toBeVisible();
});

test('elevator: heavier going up with acceleration, weightless in free fall', async ({
  browser,
}) => {
  const page = await newPage(browser);
  await page.goto('/ru/labs/elevator-scales');
  await page.getByRole('button', { name: '3D' }).click();
  await expect(page.getByTestId('scene-3d').locator('canvas')).toBeVisible();
  await expect(page.getByTestId('readout-P')).toContainText('588'); // 60 · 9,8
  await setParam(page, /^Ускорение лифта/, '2');
  await expect(page.getByTestId('readout-P')).toContainText('708');
  await expect(page.getByTestId('scenario-status')).toContainText('перегрузка');
  await setParam(page, /^Ускорение лифта/, '-9,8');
  await expect(page.getByTestId('readout-P')).toContainText('0');
  await expect(page.getByTestId('scenario-status')).toContainText('невесомость');

  await page.getByRole('button', { name: 'Запуск' }).click();
  await expect(page.getByTestId('readout-live-v')).not.toHaveText(/v\s*0\s*м\/с$/, {
    timeout: 5000,
  });
});

test('lamp: flatter ropes pull harder; a weak rope breaks; static scene has no Run', async ({
  browser,
}) => {
  const page = await newPage(browser);
  await page.goto('/ru/labs/lamp-two-ropes');
  await expect(page.getByRole('button', { name: 'Запуск' })).toHaveCount(0);
  // m = 2 kg, α = 30°: T = mg/(2 sin 30°) = 19,6 N.
  await expect(page.getByTestId('readout-T1')).toContainText('19,6');
  await setParam(page, /^Угол левого троса/, '10');
  await setParam(page, /^Угол правого троса/, '10');
  await expect(page.getByTestId('readout-T1')).toContainText('56,4');
  await setParam(page, /^Масса лампы/, '10');
  await expect(page.getByTestId('scenario-status')).toContainText('не выдержит');

  await page.getByRole('button', { name: '2D' }).click();
  await expect(page.getByTestId('scene-2d').locator('[data-force="tension"]')).toHaveCount(2);
  await expect(page.getByTestId('scene-2d').locator('[data-force="gravity"]')).toHaveCount(1);
  await page.getByLabel('Показать силы (схема сил)').uncheck();
  await expect(page.getByTestId('scene-2d').locator('[data-force]')).toHaveCount(0);
});

test('block and pulley: formula with friction, static friction holds the system', async ({
  browser,
}) => {
  const page = await newPage(browser);
  await page.goto('/ru/labs/block-pulley');
  // m1 = 2, m2 = 1, μ = 0,2: a = (1 − 0,4)·9,8/3 = 1,96 m/s².
  await expect(page.getByTestId('readout-a')).toContainText('1,96');
  await setParam(page, /^Масса бруска/, '4');
  await setParam(page, /^Коэффициент трения/, '0,5');
  await expect(page.getByTestId('scenario-status')).toContainText('покоится');
  await expect(page.getByTestId('readout-Ffr')).toContainText('9,8'); // = m2·g, not μ·m1·g
  await page.getByRole('button', { name: '2D' }).click();
  await expect(page.getByTestId('scene-2d').locator('[data-force="friction"]')).toHaveCount(1);
  await expect(page.getByTestId('scene-2d').locator('[data-force="normal"]')).toHaveCount(1);
});

test('Atwood machine: a = (m1 − m2)g/(m1 + m2), T between the weights; phone and axe', async ({
  browser,
}) => {
  const page = await newPage(browser, { viewport: { width: 390, height: 860 } });
  await page.goto('/ru/labs/atwood');
  await expect(page.getByTestId('readout-a')).toContainText('4,9');
  await expect(page.getByTestId('readout-T')).toContainText('14,7');
  await setParam(page, /^Масса правого груза/, '3');
  await expect(page.getByTestId('scenario-status')).toContainText('равновесии');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
});
