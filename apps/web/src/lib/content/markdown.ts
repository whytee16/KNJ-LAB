import rehypeKatex from 'rehype-katex';
import rehypeSanitize, { defaultSchema, type Options as SanitizeSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

/**
 * Sanitizer: GitHub-like defaults (no raw HTML, scripts, styles or event handlers) plus the
 * classes remark-math puts on formula placeholders. KaTeX runs *after* sanitizing, so its own
 * markup is produced from validated LaTeX only.
 */
const schema: SanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [
      ...(defaultSchema.attributes?.code ?? []),
      ['className', 'language-math', 'math-inline', 'math-display'],
    ],
  },
};

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkRehype) // raw HTML in Markdown is dropped (allowDangerousHtml is off)
  .use(rehypeSanitize, schema)
  .use(rehypeKatex, {
    throwOnError: false,
    trust: false,
    strict: 'ignore',
    output: 'htmlAndMathml',
  } as const)
  .use(rehypeStringify);

export interface RenderedMarkdown {
  html: string;
  /** KaTeX error messages; content with errors must not be published. */
  mathErrors: string[];
}

export async function renderMarkdown(source: string): Promise<RenderedMarkdown> {
  const html = String(await processor.process(source));
  const mathErrors = [...html.matchAll(/class="katex-error"[^>]*title="([^"]*)"/g)].map((m) =>
    m[1]!
      .replace(/&#x27;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&'),
  );
  return { html, mathErrors };
}
