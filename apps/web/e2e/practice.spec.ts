import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import {
  createFamily,
  createPublishedTopic,
  createStaff,
  enrollTotp,
  expireOpenAttempts,
  signIn,
} from './staff';

// Practice lifecycle: templates in the studio → trainer for a student → paid level behind a pass.
test.describe.configure({ mode: 'serial' });

const run = Date.now().toString(36);
const password = 'Practice2026x';
const manager = `pm-${run}@example.test`;
const reviewer = `pr-${run}@example.test`;
const admin = `pa-${run}@example.test`;
const topic = { slug: `practice-${run}`, title: `Практика ${run}` };
let family: Awaited<ReturnType<typeof createFamily>>;

const contexts: BrowserContext[] = [];
let use: object;
async function newPage(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext(use);
  contexts.push(ctx);
  return ctx.newPage();
}

let managerPage: Page;
let reviewerPage: Page;
let studentPage: Page;
const templateUrls: string[] = [];

test.beforeAll(async ({}, testInfo) => {
  use = testInfo.project.use;
  await createStaff(manager, password, 'content_manager', 'Автор');
  await createStaff(reviewer, password, 'reviewer', 'Методист');
  await createStaff(admin, password, 'admin', 'Админ');
  await createPublishedTopic(topic.slug, topic.title);
  family = await createFamily(run, password);
});
test.afterAll(async () => {
  for (const c of contexts) await c.close();
});

async function createTemplate(page: Page, fill: (p: Page) => Promise<void>) {
  await page.goto('/ru/studio/tasks/new');
  await page.getByLabel('Тема').selectOption({ label: `${topic.title} (algebra)` });
  await fill(page);
  await page.getByRole('button', { name: 'Создать шаблон' }).click();
  await expect(page).toHaveURL(/\/ru\/studio\/tasks\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId('validation-report').first()).toContainText(
    'Проверка на 50 вариантах пройдена.',
  );
  templateUrls.push(page.url());
  await page.getByRole('button', { name: 'Отправить на проверку' }).click();
  await expect(page.getByText('Отправлено на проверку.')).toBeVisible();
}

test('content manager creates task templates of three types', async ({ browser }) => {
  managerPage = await newPage(browser);
  await signIn(managerPage, manager, password);
  await enrollTotp(managerPage);

  // Invalid parameter line is reported with its number.
  await managerPage.goto('/ru/studio/tasks/new');
  await managerPage.getByLabel('Тема').selectOption({ label: `${topic.title} (algebra)` });
  await managerPage.getByLabel('Параметры').fill('a: int 1..9\nb: integer 5');
  await managerPage.getByLabel('Ответ (выражение)').fill('a+b');
  await managerPage.getByRole('group', { name: 'Русский' }).getByLabel('Условие').fill('x');
  await managerPage.getByRole('button', { name: 'Создать шаблон' }).click();
  await expect(managerPage.getByText('Не удалось разобрать параметр в строке 2.')).toBeVisible();

  await createTemplate(managerPage, async (p) => {
    await p.getByLabel('Параметры').fill('a: int 2..9\nb: int 10..30');
    await p.getByLabel('Ответ (выражение)').fill('a + b');
    await p
      .getByRole('group', { name: 'Русский' })
      .getByLabel('Условие')
      .fill('Найдите сумму чисел {{a}} и {{b}}.');
    await p
      .getByRole('group', { name: 'Русский' })
      .getByLabel('Решение (Markdown)')
      .fill('Сложите: {{a}} + {{b}}.');
  });

  await createTemplate(managerPage, async (p) => {
    await p.getByLabel('Тип').selectOption('single_choice');
    await p.getByLabel('Уровень').selectOption('medium');
    await p.getByLabel('Номер правильного ответа').fill('2');
    const ru = p.getByRole('group', { name: 'Русский' });
    await ru.getByLabel('Условие').fill('Сколько будет $2 + 2$?');
    await ru.getByLabel('Варианты ответа').fill('3\n4\n5');
  });

  await createTemplate(managerPage, async (p) => {
    await p.getByLabel('Тип').selectOption('formula');
    await p.getByLabel('Уровень').selectOption('sufficient');
    await p.getByLabel('Параметры').fill('k: int 2..5');
    await p.getByLabel('Ответ (выражение)').fill('k*(x + 1)');
    await p
      .getByRole('group', { name: 'Русский' })
      .getByLabel('Условие')
      .fill('Запишите выражение $k(x+1)$ при $k = {{k}}$, раскрыв скобки.');
  });
});

test('reviewer publishes the templates', async ({ browser }) => {
  reviewerPage = await newPage(browser);
  await signIn(reviewerPage, reviewer, password);
  await enrollTotp(reviewerPage);
  for (const url of templateUrls) {
    await reviewerPage.goto(url);
    await reviewerPage.getByRole('button', { name: 'Опубликовать' }).click();
    await expect(reviewerPage.getByText('Опубликовано.')).toBeVisible();
  }
});

function numbersIn(text: string): number[] {
  return [...text.matchAll(/\d+/g)].map((m) => Number(m[0]));
}

test('student solves the free level: right and wrong answers', async ({ browser }) => {
  studentPage = await newPage(browser);
  await signIn(studentPage, family.username, password);
  await expect(studentPage).toHaveURL(/\/ru\/app$/);
  await studentPage.goto(`/ru/topics/${topic.slug}`);
  await expect(studentPage.getByTestId('level-medium')).toContainText('Открывается по подписке.');
  await studentPage.getByTestId('level-easy').getByRole('button', { name: 'Решать' }).click();
  await expect(studentPage).toHaveURL(new RegExp(`/ru/app/trainer/${topic.slug}\\?level=easy$`));

  const statement = await studentPage.locator('.prose-topic').first().innerText();
  const [a, b] = numbersIn(statement.replace(run, ''));
  await studentPage.getByLabel('Ответ', { exact: true }).fill(String(a! + b!));
  await studentPage.getByRole('button', { name: 'Проверить' }).click();
  await expect(studentPage.getByText('✓ Верно')).toBeVisible();
  await studentPage.getByRole('button', { name: 'Следующая задача' }).click();
  await expect(studentPage.getByTestId('run-progress')).toHaveText('Решено 1 из 100');

  await studentPage.getByLabel('Ответ', { exact: true }).fill('1');
  await studentPage.getByRole('button', { name: 'Проверить' }).click();
  await expect(studentPage.getByText('✗ Неверно')).toBeVisible();
  await expect(studentPage.getByText('Правильный ответ:')).toBeVisible();
  await expect(studentPage.getByText('Сложите:', { exact: false })).toBeVisible();
  await studentPage.getByRole('button', { name: 'Следующая задача' }).click();
  await expect(studentPage.getByTestId('run-progress')).toHaveText('Решено 2 из 100');
  await expect(studentPage.getByText('Точность 50%')).toBeVisible();

  // Unreadable input is not counted as an answer.
  await studentPage.getByLabel('Ответ', { exact: true }).fill('пять');
  await studentPage.getByRole('button', { name: 'Проверить' }).click();
  await expect(
    studentPage.getByText('Не удалось распознать ответ.', { exact: false }),
  ).toBeVisible();
});

test('student reports an error in a task', async () => {
  await studentPage.getByText('Сообщить об ошибке в задаче').click();
  await studentPage.getByLabel('Что не так?').fill(`Опечатка в условии ${run}`);
  await studentPage.getByRole('button', { name: 'Отправить' }).click();
  await expect(studentPage.getByText('Спасибо! Методист проверит задачу.')).toBeVisible();
});

test('paid levels need a pass', async () => {
  await studentPage.goto(`/ru/app/trainer/${topic.slug}?level=medium`);
  await expect(
    studentPage.getByText('Этот уровень открывается по подписке.', { exact: false }),
  ).toBeVisible();
});

test('admin grants a pass to the child', async ({ browser }) => {
  const page = await newPage(browser);
  await signIn(page, admin, password);
  await enrollTotp(page);
  await page.goto('/ru/studio/users');
  await page.getByLabel('E-mail пользователя').fill(family.parentEmail);
  await page.getByRole('button', { name: 'Найти' }).click();
  const child = page.getByTestId(`passes-${family.username}`);
  await child.getByLabel('Дней').fill('30');
  await child.getByRole('button', { name: 'Выдать доступ' }).click();
  await expect(page.getByText('Доступ выдан.')).toBeVisible();
  await expect(child.getByText('Доступ до', { exact: false })).toBeVisible();
});

test('with a pass the student solves a choice task and a formula', async () => {
  await studentPage.goto(`/ru/topics/${topic.slug}`);
  await expect(studentPage.getByText('Полный доступ действует до', { exact: false })).toBeVisible();
  await studentPage.getByTestId('level-medium').getByRole('button', { name: 'Решать' }).click();
  await studentPage.getByRole('radio', { name: '4' }).check();
  await studentPage.getByRole('button', { name: 'Проверить' }).click();
  await expect(studentPage.getByText('✓ Верно')).toBeVisible();

  await studentPage.goto(`/ru/topics/${topic.slug}`);
  await studentPage.getByTestId('level-sufficient').getByRole('button', { name: 'Решать' }).click();
  await expect(studentPage).toHaveURL(/level=sufficient$/);
  const statement = await studentPage.locator('.prose-topic').first().innerText();
  const k = Number(statement.match(/k\s*=\s*(\d)/)?.[1]);
  expect(k).toBeGreaterThan(1);
  await expect(studentPage.getByTestId('formula-input')).toHaveAttribute('data-ready', 'true');
  // Headless Chromium does not move focus into MathLive on click; real browsers do.
  await studentPage.locator('math-field').focus();
  await studentPage.keyboard.type(`${k}x+${k}`);
  await studentPage.getByRole('button', { name: 'Проверить' }).click();
  await expect(studentPage.getByText('✓ Верно')).toBeVisible();
});

const testTitle = `Контрольная ${run}`;

test('content manager builds an exam and the reviewer publishes it', async () => {
  await managerPage.goto('/ru/studio/tests/new');
  await managerPage.getByLabel('Название (рус.)').fill(testTitle);
  await managerPage.getByLabel('Тема').selectOption({ label: `${topic.title} (algebra)` });
  await managerPage.getByLabel('Режим').selectOption('exam');
  await managerPage.getByLabel('Время, минут').fill('5');
  await managerPage.getByLabel('Лёгкий').fill('2');
  await managerPage.getByRole('button', { name: 'Создать тест' }).click();
  await expect(managerPage).toHaveURL(/\/ru\/studio\/tests\/[0-9a-f-]{36}$/);
  await managerPage.getByRole('button', { name: 'Отправить на проверку' }).click();
  await expect(managerPage.getByText('Отправлено на проверку.')).toBeVisible();

  await reviewerPage.goto(managerPage.url());
  await reviewerPage.getByRole('button', { name: 'Опубликовать' }).click();
  await expect(reviewerPage.getByText('Опубликовано.')).toBeVisible();
});

test('student takes the exam and sees a detailed result', async () => {
  await studentPage.goto(`/ru/topics/${topic.slug}`);
  const card = studentPage.locator('section[aria-labelledby="topic-tests"]');
  await expect(card.getByText(testTitle)).toBeVisible();
  await card.getByRole('button', { name: 'Начать тест' }).click();
  await expect(studentPage).toHaveURL(/\/ru\/app\/tests\/run\/[0-9a-f-]{36}$/);
  await expect(studentPage.getByRole('timer')).toHaveText(/^[45]:\d\d$/);

  const items = studentPage.locator('[data-instance]');
  await expect(items).toHaveCount(2);
  const first = await items.nth(0).locator('.prose-topic').innerText();
  const [a, b] = numbersIn(first.replace(run, ''));
  await items
    .nth(0)
    .getByLabel('Ответ', { exact: true })
    .fill(String(a! + b!));
  await studentPage.getByRole('button', { name: 'Сдать тест' }).click();

  await expect(studentPage).toHaveURL(/\/ru\/app\/results\/[0-9a-f-]{36}$/);
  await expect(studentPage.getByTestId('result-score')).toContainText('50%');
  await expect(studentPage.getByTestId('result-score')).toContainText('Верно 1 из 2');
  await expect(studentPage.getByTestId('result-item-2')).toContainText('Нет ответа');
  await expect(studentPage.getByTestId('result-item-2')).toContainText('Правильный ответ');
  await expect(
    studentPage
      .locator('section[aria-labelledby="recommend"]')
      .getByRole('link', { name: topic.title }),
  ).toBeVisible();

  // A finished attempt cannot be reopened: the server sends the run page to the result.
  const resultUrl = studentPage.url();
  await studentPage.goto(resultUrl.replace('/app/results/', '/app/tests/run/'));
  await expect(studentPage).toHaveURL(resultUrl);
});

test('an exam whose time ran out is closed by the server', async () => {
  await studentPage.goto(`/ru/topics/${topic.slug}`);
  await studentPage
    .locator('section[aria-labelledby="topic-tests"]')
    .getByRole('button', { name: 'Начать тест' })
    .click();
  await expect(studentPage).toHaveURL(/\/ru\/app\/tests\/run\//);
  await expireOpenAttempts(family.studentId);
  await studentPage.reload();
  await expect(studentPage).toHaveURL(/\/ru\/app\/results\//);
  await expect(studentPage.getByTestId('result-score')).toContainText('0%');
});

test('student cabinet lists results and active trainers', async () => {
  await studentPage.goto('/ru/app');
  await expect(
    studentPage
      .locator('section[aria-labelledby="my-results"]')
      .getByRole('link', { name: testTitle })
      .first(),
  ).toBeVisible();
  await expect(
    studentPage
      .locator('section[aria-labelledby="my-runs"]')
      .getByRole('link', { name: topic.title })
      .first(),
  ).toBeVisible();
});

test("parent sees the child's statistics and results", async ({ browser }) => {
  const page = await newPage(browser);
  await signIn(page, family.parentEmail, password);
  await expect(page).toHaveURL(/\/ru\/parent$/);
  const stats = page.getByTestId(`stats-${family.username}`);
  await expect(stats).toContainText('Решено задач:');
  await stats.getByRole('link', { name: testTitle }).first().click();
  await expect(page.getByTestId('result-score')).toBeVisible();
});

test('reviewer resolves the error report', async () => {
  await reviewerPage.goto('/ru/studio/reports');
  const report = reviewerPage.locator('li').filter({ hasText: `Опечатка в условии ${run}` });
  await expect(report).toBeVisible();
  await report.getByRole('button', { name: 'Исправлено' }).click();
  // Resolved reports leave the open queue.
  await expect(report).toHaveCount(0);
});
