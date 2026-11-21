import AxeBuilder from '@axe-core/playwright';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { waitForLink } from './mailpit';

// End-to-end account lifecycle against the local Supabase stack (pnpm db:start).
// Runs serially: each step builds on the previous one.
test.describe.configure({ mode: 'serial' });

const run = Date.now().toString(36);
const parent = { name: 'Айгерим', email: `parent-${run}@example.test`, password: 'Parol2026x' };
const child = { name: 'Арман', username: `arman.${run}`, grade: '8', password: 'Uchenik2026' };

async function expectNoSeriousA11yIssues(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
}

async function signIn(page: Page, identifier: string, password: string, path = '/ru/login') {
  await page.goto(path);
  await page.getByLabel('E-mail или логин ученика').fill(identifier);
  await page.getByLabel('Пароль', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
}

async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Выйти' }).click();
  await expect(page).toHaveURL(/\/ru$/);
}

let context: BrowserContext;
let page: Page;
test.beforeAll(async ({ browser }, testInfo) => {
  // One browser session for the whole story (cookies carry over between steps).
  context = await browser.newContext(testInfo.project.use);
  page = await context.newPage();
});
test.afterAll(async () => {
  await context.close();
});

test('anonymous visitors are sent to login from protected pages', async () => {
  await page.goto('/ru/parent');
  await expect(page).toHaveURL(/\/ru\/login\?next=%2Fru%2Fparent$/);
  await page.goto('/ru/app');
  await expect(page).toHaveURL(/\/ru\/login\?next=%2Fru%2Fapp$/);
});

test('registration validates input and requires consent', async () => {
  await page.goto('/ru/register');
  await expectNoSeriousA11yIssues(page);
  await page.getByLabel('Как к вам обращаться').fill(parent.name);
  await page.getByLabel('E-mail').fill('not-an-email');
  await page.getByLabel('Пароль').fill('short');
  await page.getByRole('button', { name: 'Создать аккаунт' }).click();
  await expect(page.getByText('Введите корректный адрес электронной почты.')).toBeVisible();
  await expect(page.getByText('Пароль должен содержать не меньше 8 символов.')).toBeVisible();
  await expect(page.getByText('Без согласия мы не можем создать аккаунт.')).toBeVisible();
  await expect(page.getByLabel('Как к вам обращаться')).toHaveValue(parent.name);
});

test('parent registers and confirms the e-mail address', async () => {
  await page.getByLabel('E-mail').fill(parent.email);
  await page.getByLabel('Пароль').fill(parent.password);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Создать аккаунт' }).click();
  await expect(
    page.getByText('Мы отправили письмо для подтверждения адреса.', { exact: false }),
  ).toBeVisible();

  // Unconfirmed accounts cannot sign in yet.
  await signIn(page, parent.email, parent.password);
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Подтвердите e-mail');

  await page.goto(await waitForLink(parent.email, '/auth/v1/verify'));
  await expect(page).toHaveURL(/\/ru\/parent$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Здравствуйте, ${parent.name}`);
  await expect(
    page.getByText('Вы ещё не добавили ни одного ребёнка.', { exact: false }),
  ).toBeVisible();
  await expectNoSeriousA11yIssues(page);
});

test('parent creates a student account', async () => {
  const form = page.locator('section[aria-labelledby="add-child"]');
  await form.getByLabel('Имя ребёнка').fill(child.name);
  await form.getByLabel('Логин для входа').fill(child.username);
  await form.getByLabel('Класс').selectOption(child.grade);
  await form.getByLabel('Пароль ученика').fill(child.password);
  await form.getByRole('checkbox').check();
  await form.getByRole('button', { name: 'Создать аккаунт ученика' }).click();
  await expect(form.getByRole('status')).toContainText(`Логин ученика: ${child.username}`);
  const card = page.getByTestId(`child-${child.username}`);
  await expect(card).toContainText(child.name);
  await expect(card).toContainText('8 класс');
});

test('usernames are unique', async () => {
  const form = page.locator('section[aria-labelledby="add-child"]');
  await form.getByLabel('Имя ребёнка').fill('Другой');
  await form.getByLabel('Логин для входа').fill(child.username);
  await form.getByLabel('Пароль ученика').fill(child.password);
  await form.getByRole('checkbox').check();
  await form.getByRole('button', { name: 'Создать аккаунт ученика' }).click();
  await expect(form.getByText('Этот логин уже занят. Выберите другой.')).toBeVisible();
});

test('student signs in with the username and cannot open the parent cabinet', async () => {
  await signOut(page);
  await signIn(page, child.username, child.password);
  await expect(page).toHaveURL(/\/ru\/app$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Привет, ${child.name}!`);
  await expect(page.getByText('8 класс')).toBeVisible();
  await expectNoSeriousA11yIssues(page);

  await page.goto('/ru/parent');
  await expect(page).toHaveURL(/\/ru\/app$/);
});

test('wrong password shows a generic error and keeps the login', async () => {
  await signOut(page);
  await signIn(page, parent.email, 'Wrong-pass-1');
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('Неверный логин или пароль.');
  await expect(page.getByLabel('E-mail или логин ученика')).toHaveValue(parent.email);
});

test('login returns to the requested page', async () => {
  await page.goto('/ru/app');
  await expect(page).toHaveURL(/next=%2Fru%2Fapp/);
  await page.getByLabel('E-mail или логин ученика').fill(parent.email);
  await page.getByLabel('Пароль', { exact: true }).fill(parent.password);
  await page.getByRole('button', { name: 'Войти' }).click();
  // A parent asked for the student page: they land in their own cabinet instead.
  await expect(page).toHaveURL(/\/ru\/parent$/);
});

test('parent sets a new password for the student', async () => {
  const card = page.getByTestId(`child-${child.username}`);
  await card.getByText('Новый пароль ученика').click();
  await card.getByLabel('Новый пароль', { exact: true }).fill('Novyi2026pass');
  await card.getByLabel('Повторите пароль').fill('Novyi2026pass');
  await card.getByRole('button', { name: 'Сменить пароль' }).click();
  await expect(card.getByRole('status')).toHaveText('Пароль ученика изменён.');
  child.password = 'Novyi2026pass';
});

test('interface language switch is remembered in the cabinet', async () => {
  await page.getByRole('link', { name: 'Қазақша' }).click();
  await expect(page).toHaveURL(/\/kk\/parent$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Сәлеметсіз бе, ${parent.name}`);
  await page.getByRole('link', { name: 'Русский' }).click();
  await expect(page).toHaveURL(/\/ru\/parent$/);
});

test('parent resets a forgotten password by e-mail', async () => {
  await signOut(page);
  await page.goto('/ru/forgot-password');
  await page.getByLabel('E-mail').fill(parent.email);
  await page.getByRole('button', { name: 'Отправить ссылку' }).click();
  await expect(page.getByRole('main').getByRole('status')).toContainText(
    'мы отправили на него ссылку',
  );

  await page.goto(await waitForLink(parent.email, 'type=recovery'));
  await expect(page).toHaveURL(/\/ru\/reset-password$/);
  await page.getByLabel('Новый пароль').fill('Novyi2026parol');
  await page.getByLabel('Повторите пароль').fill('Novyi2026parol');
  await page.getByRole('button', { name: 'Сохранить пароль' }).click();
  await expect(page).toHaveURL(/\/ru\/parent$/);
  parent.password = 'Novyi2026parol';

  await signOut(page);
  await signIn(page, parent.email, parent.password);
  await expect(page).toHaveURL(/\/ru\/parent$/);
});

test('parent deletes the student account after confirming the username', async () => {
  const card = page.getByTestId(`child-${child.username}`);
  await card.getByText('Удалить аккаунт').click();
  await card.getByLabel(/Для подтверждения введите логин/).fill('wrong');
  await card.getByRole('button', { name: 'Удалить навсегда' }).click();
  await expect(card.getByText('Логин не совпадает.')).toBeVisible();

  await card.getByLabel(/Для подтверждения введите логин/).fill(child.username);
  await card.getByRole('button', { name: 'Удалить навсегда' }).click();
  await expect(page.getByTestId(`child-${child.username}`)).toHaveCount(0);

  await signOut(page);
  await signIn(page, child.username, child.password);
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('Неверный логин или пароль.');
});
