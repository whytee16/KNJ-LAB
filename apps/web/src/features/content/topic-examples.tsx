import 'server-only';
import type { Locale } from '@knj/i18n';
import {
  generateTask,
  taskSpecSchema,
  taskTextsSchema,
  type Difficulty,
  type TaskSpec,
} from '@knj/task-engine';
import { Badge } from '@knj/ui';
import { getTranslations } from 'next-intl/server';
import { expectedHtml } from '@/features/practice/engine-server';
import { TaskFigure } from '@/features/practice/figure';
import { renderMarkdown } from '@/lib/content/markdown';
import { createAdminClient } from '@/lib/supabase/admin';

const LEVELS: Difficulty[] = ['easy', 'medium', 'sufficient'];

/** Stable seed per template, so a worked example does not change between visits. */
function seedOf(id: string): number {
  let h = 2166136261;
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) % 2147483646 || 1;
}

/**
 * Worked examples on the topic page: up to three published number tasks of the topic
 * (easy, medium, sufficient; templates with a figure first), each with its answer and solution.
 * The trainer draws the same templates with random numbers, so this shows the method, not its answers.
 */
export async function TopicExamples({ topicId, locale }: { topicId: string; locale: Locale }) {
  const admin = createAdminClient();
  const { data } = await admin
    .from('task_templates')
    .select('id, difficulty, type, spec, task_template_texts(locale, texts)')
    .eq('topic_id', topicId)
    .eq('status', 'published')
    .eq('type', 'number')
    .in('difficulty', LEVELS)
    .order('id');
  if (!data?.length) return null;

  const hasFigure = (spec: unknown) => Boolean((spec as Partial<TaskSpec>)?.figure);
  const picked = LEVELS.flatMap((level) => {
    const rows = data.filter((r) => r.difficulty === level);
    const row = rows.find((r) => hasFigure(r.spec)) ?? rows[0];
    return row ? [row] : [];
  });
  if (!picked.length) return null;

  const t = await getTranslations('topic');
  const p = await getTranslations('practice');
  const md = async (s: string) => (await renderMarkdown(s)).html;
  const examples = await Promise.all(
    picked.map(async (row) => {
      const texts =
        row.task_template_texts.find((x) => x.locale === locale) ??
        row.task_template_texts.find((x) => x.locale === 'ru');
      if (!texts) return null;
      const lang = texts.locale as Locale;
      const task = generateTask(
        taskSpecSchema.parse(row.spec),
        taskTextsSchema.parse(texts.texts),
        seedOf(row.id),
        lang,
      );
      return {
        id: row.id,
        level: row.difficulty as Difficulty,
        statementHtml: await md(task.prompt.statement),
        figure: task.prompt.figure,
        answerHtml: await expectedHtml(task.expected, task.prompt, lang),
        solutionHtml: await md(task.solution),
      };
    }),
  );

  return (
    <section
      aria-labelledby="examples"
      className="mt-10 max-w-3xl border-t border-border pt-8"
      data-testid="topic-examples"
    >
      <h2 id="examples" className="type-h2">
        {t('examples')}
      </h2>
      <ol className="mt-5 flex flex-col gap-4">
        {examples.map((ex, i) =>
          ex ? (
            <li key={ex.id} className="rounded-lg border border-border bg-surface p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="font-semibold">{t('example', { n: i + 1 })}</span>
                <Badge>{p(`levels.${ex.level}`)}</Badge>
              </div>
              <div className="prose-topic" dangerouslySetInnerHTML={{ __html: ex.statementHtml }} />
              {ex.figure ? (
                <div className="mt-4">
                  <TaskFigure figure={ex.figure} label={p('figure')} />
                </div>
              ) : null}
              <details className="mt-4">
                <summary className="cursor-pointer font-medium text-accent">
                  {t('showSolution')}
                </summary>
                <div className="mt-3 flex flex-col gap-3">
                  <div
                    className="prose-topic"
                    dangerouslySetInnerHTML={{ __html: ex.solutionHtml }}
                  />
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-semibold">{t('answer')}:</span>
                    <div dangerouslySetInnerHTML={{ __html: ex.answerHtml }} />
                  </div>
                </div>
              </details>
            </li>
          ) : null,
        )}
      </ol>
    </section>
  );
}
