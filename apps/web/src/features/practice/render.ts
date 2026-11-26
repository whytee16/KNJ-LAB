import 'server-only';
import type { TaskPrompt } from '@knj/task-engine';
import { renderMarkdown } from '@/lib/content/markdown';
import type { RenderedPrompt } from './types';

const md = async (s: string) => (await renderMarkdown(s)).html;
const plain = (s: string) =>
  s
    .replace(/\$+/g, '')
    .replace(/\\[a-z]+/gi, '')
    .trim();

/** Server-side rendering of a stored prompt (Markdown + KaTeX, sanitized). */
export async function renderPrompt(
  instanceId: string,
  prompt: TaskPrompt,
): Promise<RenderedPrompt> {
  return {
    instanceId,
    type: prompt.type,
    statementHtml: await md(prompt.statement),
    options: prompt.options
      ? await Promise.all(prompt.options.map(async (o) => ({ id: o.id, html: await md(o.text) })))
      : undefined,
    left: prompt.left
      ? await Promise.all(prompt.left.map(async (o) => ({ id: o.id, html: await md(o.text) })))
      : undefined,
    right: prompt.right
      ? await Promise.all(
          prompt.right.map(async (o) => ({
            id: o.id,
            html: await md(o.text),
            text: plain(o.text),
          })),
        )
      : undefined,
    unit: prompt.unit,
    variables: prompt.variables,
    hintsHtml: await Promise.all(prompt.hints.map(md)),
    figure: prompt.figure,
  };
}
