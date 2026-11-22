import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import {
  createFamily,
  createPublishedNumberTemplate,
  createPublishedTopic,
  createStaff,
  enrollTotp,
  grantPass,
  resetLab,
  signIn,
} from './staff';

// Reference lab S = v·t: methodologist fills and publishes it → visitors use the demo →
// a student answers its questions and the parameters are saved → paid access → parent stats.
test.describe.configure({ mode: 'serial' });

const run = Date.now().toString(36);
const password = 'Labs2026pass';
const reviewer = `lr-${run}@example.test`;
const topic = { slug: `motion-${run}`, title: `Движение ${run}` };
const labTitle = `Равномерное движение ${run}`;
let family: Awaited<ReturnType<typeof createFamily>>;

const contexts: BrowserContext[] = [];
let use: object;
async function newPage(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext(use);
  contexts.push(ctx);
  return ctx.newPage();
}
let reviewerPage: Page;
let studentPage: Page;

const numberField = (page: Page, label: string) =>
  page.getByRole('textbox', { name: new RegExp(`^${label}`) });

test.beforeAll(async ({}, testInfo) => {
  use = testInfo.project.use;
  await resetLab('uniform-motion');
  await createStaff(reviewer, password, 'reviewer', 'Методист');
  const topicId = await createPublishedTopic(topic.slug, topic.title);
  await createPublishedNumberTemplate(
    topicId,
    `Тело движется со скоростью 4 м/с в течение 5 с. Какой путь оно пройдёт? (${run})`,
    '20',
  );
  family = await createFamily(run, password);
});
test.afterAll(async () => {
  for (const c of contexts) await c.close();
});

test('draft lab is not public', async ({ request }) => {
  expect((await request.get('/ru/labs/uniform-motion')).status()).toBe(404);
});

test('methodologist fills, links and publishes the reference lab', async ({ browser }) => {
  reviewerPage = await newPage(browser);
  const page = reviewerPage;
  await signIn(page, reviewer, password);
  await enrollTotp(page);
  await page.goto('/ru/studio/labs');
  await page
    .getByRole('link', { name: /uniform-motion|Равномерное/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/ru\/studio\/labs\/[0-9a-f-]{36}$/);

  const ru = page.getByRole('group', { name: 'Русский' });
  await ru.getByLabel('Название').fill(labTitle);
  await ru.getByLabel('Цель').fill('Установить, как путь зависит от скорости и времени.');
  await ru
    .getByLabel('Шаги')
    .fill('Задай скорость и время.\nНажми «Запуск».\nСравни путь с графиком.');
  await page.getByLabel('Скорость, м/с').fill('45');
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByText('Значение вне диапазона модели.')).toBeVisible();
  await page.getByLabel('Скорость, м/с').fill('5');
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByText('Сохранено.')).toBeVisible();

  const topics = page.getByTestId('links-topics');
  await topics.getByLabel('Тема').selectOption({ label: `${topic.title} (algebra)` });
  await topics.getByRole('button', { name: 'Добавить' }).click();
  await expect(topics.getByText(`${topic.title} (algebra)`)).toBeVisible();

  const tasks = page.getByTestId('links-tasks');
  await tasks.getByLabel('Шаблон задачи').selectOption({ index: 0 });
  await tasks.getByRole('button', { name: 'Добавить' }).click();
  await expect(tasks.getByText(`motion-${run}`, { exact: false })).toBeVisible();

  await page.getByRole('button', { name: 'Опубликовать' }).click();
  await expect(page.getByText('Опубликовано.')).toBeVisible();
});

test('visitors use the free demo: slider, number field, range check, reset', async ({
  browser,
}) => {
  const page = await newPage(browser);
  await page.goto('/ru/labs');
  await page
    .getByTestId('lab-uniform-motion')
    .getByRole('link', { name: 'Открыть лабораторию' })
    .click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(labTitle);
  await expect(
    page.getByText('Тело считается материальной точкой', { exact: false }),
  ).toBeVisible();

  const S = page.getByTestId('readout-S');
  await expect(S).toContainText('50');
  await numberField(page, 'Скорость').fill('8');
  await numberField(page, 'Скорость').press('Enter');
  await expect(S).toContainText('80');
  await expect(page.getByTestId('formula')).toContainText('S = v · t = 8 · 10 = 80 м');

  await page.getByRole('slider', { name: 'Время движения' }).fill('4');
  await expect(S).toContainText('32');

  await numberField(page, 'Скорость').fill('45');
  await numberField(page, 'Скорость').press('Enter');
  await expect(page.getByText('Допустимо от 0 до 30 м/с')).toBeVisible();
  await expect(S).toContainText('32');

  await page.getByRole('button', { name: 'Сброс' }).click();
  await expect(S).toContainText('50');
  await expect(numberField(page, 'Скорость')).toHaveValue('5');

  // Short run: the body reaches the end, the clock shows t.
  await numberField(page, 'Время движения').fill('1');
  await numberField(page, 'Время движения').press('Enter');
  await page.getByRole('button', { name: 'Запуск' }).click();
  await expect(page.getByRole('button', { name: 'Запуск' })).toBeVisible({ timeout: 5000 });
  await expect(page.getByTestId('readout-tau')).toContainText('1');

  await expect(
    page.getByRole('link', { name: 'Войдите как ученик, чтобы отвечать на вопросы', exact: false }),
  ).toBeVisible();
  await expect(page.getByText('Войдите как ученик, чтобы эксперимент сохранялся.')).toBeVisible();
});

for (const width of [390, 768, 1440])
  for (const locale of ['ru', 'kk'])
    test(`lab page fits ${width}px and is accessible (${locale})`, async ({ browser }) => {
      const ctx = await browser.newContext({ ...use, viewport: { width, height: 860 } });
      contexts.push(ctx);
      const page = await ctx.newPage();
      await page.goto(`/${locale}/labs/uniform-motion`);
      await expect(page.getByRole('slider').first()).toBeVisible();
      if (locale === 'kk')
        await expect(
          page.getByText('Зертхананың қазақша нұсқасы дайындалуда', { exact: false }),
        ).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      if (width === 390) {
        // Mobile: the parameter sheet collapses and expands.
        await page.getByRole('button', { name: locale === 'ru' ? 'Скрыть' : 'Жасыру' }).click();
        await expect(page.getByRole('slider').first()).toBeHidden();
        await page.getByRole('button', { name: locale === 'ru' ? 'Показать' : 'Көрсету' }).click();
        await expect(page.getByRole('slider').first()).toBeVisible();
      }
      await expect(page).toHaveTitle(/\S/);
      const { violations } = await new AxeBuilder({ page }).analyze();
      const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
    });

test('the lab appears on its topic page', async ({ browser }) => {
  const page = await newPage(browser);
  await page.goto(`/ru/topics/${topic.slug}`);
  await expect(page.getByRole('heading', { name: 'Лаборатории по теме' })).toBeVisible();
  await expect(page.getByRole('link', { name: labTitle }).first()).toBeVisible();
});

test('student answers the lab question; parameters are saved and restored', async ({ browser }) => {
  studentPage = await newPage(browser);
  const page = studentPage;
  await signIn(page, family.username, password);
  await expect(page).toHaveURL(/\/ru\/app$/);
  await page.goto('/ru/labs/uniform-motion');
  await expect(page.getByText('Параметры сохраняются автоматически.')).toBeVisible();

  await numberField(page, 'Скорость').fill('4');
  await numberField(page, 'Скорость').press('Enter');
  await numberField(page, 'Время движения').fill('5');
  await numberField(page, 'Время движения').press('Enter');
  await expect(page.getByTestId('readout-S')).toContainText('20');
  await expect(page.getByTestId('save-status')).toHaveText('Эксперимент сохранён.');

  await page.getByRole('button', { name: 'Начать' }).click();
  await expect(page.getByText(`(${run})`, { exact: false })).toBeVisible();
  await page.getByLabel('Ответ', { exact: true }).fill('20');
  await page.getByRole('button', { name: 'Проверить' }).click();
  await expect(page.getByText('Верно', { exact: false }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Завершить' }).click();
  await expect(page.getByTestId('lab-score')).toHaveText('Верно 1 из 1');

  // The questions did not reset the experiment; a reload restores the saved parameters.
  await expect(page.getByTestId('readout-S')).toContainText('20');
  await page.reload();
  await expect(numberField(page, 'Скорость')).toHaveValue('4');
  await expect(numberField(page, 'Время движения')).toHaveValue('5');

  await page.goto('/ru/app');
  await expect(page.getByRole('link', { name: labTitle })).toBeVisible();
});

test('without the demo flag the lab needs a pass', async ({ browser }) => {
  const page = reviewerPage;
  await page.goto('/ru/studio/labs');
  await page.getByRole('link', { name: labTitle }).click();
  await page.getByLabel('Бесплатное демо').uncheck();
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByText('Сохранено.')).toBeVisible();

  const guest = await newPage(browser);
  await guest.goto('/ru/labs/uniform-motion');
  await expect(guest.getByTestId('lab-locked')).toBeVisible();
  await expect(guest.getByRole('slider')).toHaveCount(0);

  await studentPage.goto('/ru/labs/uniform-motion');
  await expect(studentPage.getByTestId('lab-locked')).toBeVisible();

  await grantPass(family.studentId);
  await studentPage.reload();
  await expect(studentPage.getByRole('slider', { name: 'Скорость' })).toBeVisible();
  await expect(studentPage.getByTestId('lab-score')).toHaveText('Верно 1 из 1');
});

test('parent sees the lab activity of their child', async ({ browser }) => {
  const page = await newPage(browser);
  await signIn(page, family.parentEmail, password);
  await expect(page).toHaveURL(/\/ru\/parent$/);
  await expect(page.getByTestId('child-labs')).toContainText('Лаборатории: 1 занятие');
});
