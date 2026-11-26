import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { createFamily, createPublishedNumberTemplate, createPublishedTopic, signIn } from './staff';

// Task figures (ADR-0012): a student gets a task with a drawing built from its numbers.
const run = Date.now().toString(36);
const password = 'Figures2026pass';

test('a student sees the figure of a task on a phone; it carries no answer', async ({
  browser,
}, testInfo) => {
  const slug = `pythagoras-${run}`;
  const topicId = await createPublishedTopic(slug, `Теорема Пифагора ${run}`);
  await createPublishedNumberTemplate(
    topicId,
    `Катеты 6 см и 8 см. Найдите гипотенузу. (${run})`,
    '10',
    {
      unit: 'см',
      figure: {
        kind: 'right_triangle',
        a: 6,
        b: 8,
        labels: { a: '6 см', b: '8 см', c: '?' },
        vertices: ['A', 'B', 'C'],
      },
    },
  );
  const family = await createFamily(run, password);
  const ctx = await browser.newContext({
    ...testInfo.project.use,
    viewport: { width: 390, height: 860 },
  });
  const page = await ctx.newPage();
  await signIn(page, family.username, password);
  await expect(page).toHaveURL(/\/ru\/app$/);
  await page.goto(`/ru/app/trainer/${slug}?level=easy`);
  await page.getByRole('button', { name: 'Начать' }).click();
  const figure = page.getByTestId('task-figure');
  await expect(figure).toBeVisible();
  await expect(figure).toHaveAttribute('data-kind', 'right_triangle');
  await expect(figure.getByRole('img', { name: 'Рисунок к задаче' })).toBeVisible();
  await expect(figure).toContainText('6 см');
  await expect(figure).toContainText('?');
  await expect(figure).not.toContainText('10');
  await page.getByLabel('Ответ', { exact: true }).fill('10');
  await page.getByRole('button', { name: 'Проверить' }).click();
  await expect(page.getByText('✓ Верно')).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
  await ctx.close();
});
