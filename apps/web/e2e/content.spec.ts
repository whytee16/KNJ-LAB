import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { createStaff, enrollTotp, signIn, totpCode } from './staff';

// Content lifecycle: MFA for staff → topic draft → review → publication → curriculum → public pages,
// plus reference formulas, favorites and role management. Runs against the local Supabase stack.
test.describe.configure({ mode: 'serial' });

const run = Date.now().toString(36);
const password = 'Studio2026pass';
const manager = { email: `manager-${run}@example.test`, name: 'Дана' };
const reviewer = { email: `reviewer-${run}@example.test`, name: 'Методист' };
const admin = { email: `admin-${run}@example.test`, name: 'Админ' };
const topic = { slug: `linear-${run}`, title: `Линейные уравнения ${run}` };
const formula = { code: `ohms-law-${run}`, name: `Закон Ома ${run}` };
const section = `Уравнения ${run}`;

const contexts: BrowserContext[] = [];
async function newPage(browser: Browser, use: object): Promise<Page> {
  const ctx = await browser.newContext(use);
  contexts.push(ctx);
  return ctx.newPage();
}

let managerPage: Page;
let reviewerPage: Page;
let reviewerSecret: string;
let use: object;

test.beforeAll(async ({}, testInfo) => {
  use = testInfo.project.use;
  await createStaff(manager.email, password, 'content_manager', manager.name);
  await createStaff(reviewer.email, password, 'reviewer', reviewer.name);
  await createStaff(admin.email, password, 'admin', admin.name);
});
test.afterAll(async () => {
  for (const c of contexts) await c.close();
});

test('staff must set up a second factor before entering the studio', async ({ browser }) => {
  managerPage = await newPage(browser, use);
  await signIn(managerPage, manager.email, password);
  await enrollTotp(managerPage);
  await expect(managerPage.getByRole('heading', { level: 1 })).toHaveText('Темы');
});

test('wrong one-time code is rejected', async ({ browser }) => {
  const page = await newPage(browser, use);
  await signIn(page, manager.email, password);
  await expect(page).toHaveURL(/\/ru\/security\/verify/);
  await page.getByLabel('Код из приложения').fill('000000');
  await page.getByRole('button', { name: 'Продолжить' }).click();
  await expect(page.getByText('Неверный или устаревший код.', { exact: false })).toBeVisible();
});

test('content manager creates a topic and writes a draft with formulas', async () => {
  const page = managerPage;
  await page.getByRole('link', { name: 'Новая тема' }).click();
  await page.getByLabel('Название (на русском)').fill(topic.title);
  await page.getByLabel('Адрес страницы').fill(topic.slug);
  await page.getByLabel('Предмет').selectOption('algebra');
  await page.getByRole('button', { name: 'Создать тему' }).click();
  await expect(page).toHaveURL(/\/ru\/studio\/topics\/.+\?lang=ru$/);

  await page.getByLabel('Краткое описание').fill('Как решать уравнения вида ax + b = 0.');
  await page
    .getByLabel('Цели обучения')
    .fill('решать линейные уравнения\nпроверять корень подстановкой');
  await page
    .getByLabel('Теория (Markdown)')
    .fill('## Определение\n\nУравнение $ax + b = 0$, где $a \\ne 0$.\n\n$$\nx = -\\frac{b}{a\n$$');
  await page.getByLabel('Типичные ошибки').fill('забывают сменить знак при переносе');
  await page.getByRole('button', { name: 'Сохранить черновик' }).click();
  await expect(page.getByText('в формулах есть ошибки', { exact: false }).first()).toBeVisible();

  // Broken LaTeX blocks submission.
  await page.getByRole('button', { name: 'Отправить на проверку' }).click();
  await expect(page.getByText('В формулах есть ошибки. Исправьте их в черновике.')).toBeVisible();

  await page
    .getByLabel('Теория (Markdown)')
    .fill('## Определение\n\nУравнение $ax + b = 0$, где $a \\ne 0$.\n\n$$\nx = -\\frac{b}{a}\n$$');
  await page.getByRole('button', { name: 'Сохранить черновик' }).click();
  await expect(page.getByText('Черновик сохранён.')).toBeVisible();
  await page.reload();
  const preview = page.locator('section[aria-labelledby="preview"]');
  await expect(preview.locator('.katex-display')).toHaveCount(1);
  await expect(preview.getByText('проверять корень подстановкой')).toBeVisible();

  await page.getByRole('button', { name: 'Отправить на проверку' }).click();
  await expect(page.getByText('Отправлено на проверку.')).toBeVisible();
  // Content managers cannot publish.
  await expect(page.getByRole('button', { name: 'Опубликовать' })).toHaveCount(0);
});

test('unpublished topics are not public', async ({ request }) => {
  const res = await request.get(`/ru/topics/${topic.slug}`);
  expect(res.status()).toBe(404);
});

test('content managers cannot open the curriculum editor', async () => {
  await managerPage.goto('/ru/studio/curriculum');
  await expect(managerPage).toHaveURL(/\/ru\/studio$/);
});

test('reviewer publishes the topic from the review queue', async ({ browser }) => {
  reviewerPage = await newPage(browser, use);
  await signIn(reviewerPage, reviewer.email, password);
  reviewerSecret = await enrollTotp(reviewerPage);
  await reviewerPage
    .locator('section[aria-labelledby="queue"]')
    .getByRole('link', { name: topic.title })
    .click();
  await reviewerPage.getByRole('button', { name: 'Опубликовать' }).click();
  await expect(reviewerPage.getByText('Опубликовано.')).toBeVisible();
  await reviewerPage.reload();
  await expect(reviewerPage.getByText('Опубликована версия 1')).toBeVisible();
});

test('reviewer places the topic into the curriculum', async () => {
  const page = reviewerPage;
  await page.goto('/ru/studio/curriculum?subject=algebra&grade=7');
  const q1 = page.locator('section[aria-labelledby="q1"]');
  const add = q1
    .locator('details')
    .filter({ has: page.locator('summary', { hasText: 'Добавить раздел' }) });
  await add.locator('summary').click();
  await add.getByLabel('Название раздела (рус.)').fill(section);
  await add.getByRole('button', { name: 'Добавить раздел' }).click();
  await expect(add.getByText('Раздел добавлен.')).toBeVisible();

  const card = page.getByTestId(`section-${section}`);
  await card.getByLabel('Тема').selectOption({ label: `${topic.title} (${topic.slug})` });
  await card.getByRole('button', { name: 'Добавить тему' }).click();
  await expect(card.getByText(topic.title)).toBeVisible();
});

test('visitors find the topic through the catalogue and read it', async ({ browser }) => {
  const page = await newPage(browser, use);
  await page.goto('/ru/learn');
  await page.getByRole('link', { name: '7 класс' }).first().click();
  await expect(page).toHaveURL(/\/ru\/learn\/algebra\/7$/);
  await expect(page.getByText(section, { exact: true })).toBeVisible();
  await page.getByRole('link', { name: topic.title }).click();

  await expect(page).toHaveURL(new RegExp(`/ru/topics/${topic.slug}$`));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(topic.title);
  await expect(page.locator('.katex').first()).toBeVisible();
  await expect(page.getByText('Цели урока')).toBeVisible();
  await expect(page.getByText('забывают сменить знак при переносе')).toBeVisible();

  await page.goto(`/kk/topics/${topic.slug}`);
  await expect(
    page.getByText('Тақырыптың қазақша нұсқасы дайындалуда', { exact: false }),
  ).toBeVisible();
});

test('editing a published topic does not change the public page until it is re-published', async ({
  request,
}) => {
  const page = managerPage;
  await page.goto('/ru/studio');
  await page.getByRole('link', { name: topic.title }).click();
  await page.getByLabel('Название', { exact: true }).fill(`${topic.title} (новая редакция)`);
  await page.getByRole('button', { name: 'Сохранить черновик' }).click();
  await expect(page.getByText('Черновик сохранён.')).toBeVisible();

  const html = await (await request.get(`/ru/topics/${topic.slug}`)).text();
  expect(html).not.toContain('новая редакция');
});

test('formula goes from draft to the public reference', async () => {
  await managerPage.goto('/ru/studio/formulas');
  const form = managerPage.locator('section[aria-labelledby="new-formula"]');
  await form.getByLabel('Название (на русском)').fill(formula.name);
  await form.getByLabel('Формула (LaTeX)').fill('I = \\frac{U}{R}');
  await form.getByLabel('Код').fill(formula.code);
  await form.getByLabel('Предмет').selectOption('physics');
  await form.getByLabel('С класса').selectOption('8');
  await form.getByRole('button', { name: 'Создать формулу' }).click();
  await expect(managerPage).toHaveURL(/\/ru\/studio\/formulas\/.+/);

  const ru = managerPage.getByRole('group', { name: 'Русский' });
  await ru
    .getByLabel('Обозначения')
    .fill('I | сила тока | А\nU | напряжение | В\nR | сопротивление | Ом');
  await managerPage.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(managerPage.getByText('Сохранено.')).toBeVisible();
  await managerPage.getByRole('button', { name: 'Отправить на проверку' }).click();
  await expect(managerPage.getByText('Отправлено на проверку.')).toBeVisible();
  const formulaUrl = managerPage.url();

  await reviewerPage.goto(formulaUrl);
  await reviewerPage.getByRole('button', { name: 'Опубликовать' }).click();
  await expect(reviewerPage.getByText('Опубликовано.')).toBeVisible();
});

test('reference search, filters and favorites', async () => {
  const page = reviewerPage;
  await page.goto('/ru/reference');
  await page.getByLabel('Поиск').fill(`ома ${run}`);
  await page.getByRole('button', { name: 'Показать' }).click();
  const card = page.getByTestId(`formula-${formula.code}`);
  await expect(card).toBeVisible();
  await expect(card.getByText('сила тока, А')).toBeVisible();

  await page.goto(`/ru/reference?subject=physics&grade=7&q=${run}`);
  await expect(page.getByTestId(`formula-${formula.code}`)).toHaveCount(0); // formula starts in grade 8

  await page.goto(`/ru/reference?q=${run}`);
  await page
    .getByTestId(`formula-${formula.code}`)
    .getByRole('button', { name: 'В избранное' })
    .click();
  await expect(
    page.getByTestId(`formula-${formula.code}`).getByRole('button', { name: 'В избранном' }),
  ).toBeVisible();
  await page.goto('/ru/reference?fav=1');
  await expect(page.getByTestId(`formula-${formula.code}`)).toBeVisible();
});

test('a returning staff member enters a code from the authenticator', async ({ browser }) => {
  const page = await newPage(browser, use);
  await signIn(page, reviewer.email, password);
  await expect(page).toHaveURL(/\/ru\/security\/verify/);
  await page.getByLabel('Код из приложения').fill(totpCode(reviewerSecret, 1));
  await page.getByRole('button', { name: 'Продолжить' }).click();
  await expect(page).toHaveURL(/\/ru\/studio$/);
});

test('admin changes a role; non-admins cannot', async ({ browser }) => {
  await managerPage.goto('/ru/studio/users');
  await expect(managerPage).toHaveURL(/\/ru\/studio$/);

  const page = await newPage(browser, use);
  await signIn(page, admin.email, password);
  await enrollTotp(page);
  await page.getByRole('link', { name: 'Пользователи' }).click();
  await page.getByLabel('E-mail пользователя').fill(manager.email);
  await page.getByRole('button', { name: 'Найти' }).click();
  await expect(page.getByText(manager.email, { exact: false }).last()).toBeVisible();
  await page.getByLabel('Роль').selectOption('reviewer');
  await page.getByRole('button', { name: 'Изменить роль' }).click();
  await expect(page.getByText('Роль изменена.')).toBeVisible();

  await page.getByLabel('E-mail пользователя').fill(admin.email);
  await page.getByRole('button', { name: 'Найти' }).click();
  await expect(page.getByText(`Админ · ${admin.email}`)).toBeVisible();
  await page.getByRole('button', { name: 'Изменить роль' }).click();
  await expect(page.getByText('Эту роль изменить нельзя', { exact: false })).toBeVisible();
});
