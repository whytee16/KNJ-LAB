import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('renders inline and display formulas with KaTeX', async () => {
    const { html, mathErrors } = await renderMarkdown(
      'Уравнение $ax + b = 0$.\n\n$$\nx = -\\frac{b}{a}\n$$',
    );
    expect(html).toContain('class="katex"');
    expect(html).toContain('katex-display');
    expect(html).toContain('<math');
    expect(mathErrors).toEqual([]);
  });

  it('supports headings, lists and tables', async () => {
    const { html } = await renderMarkdown(
      '## Пример\n\n- один\n- два\n\n| a | b |\n|---|---|\n| 1 | 2 |',
    );
    expect(html).toContain('<h2>Пример</h2>');
    expect(html).toContain('<li>один</li>');
    expect(html).toContain('<table>');
  });

  it('drops raw HTML, scripts and dangerous links', async () => {
    const { html } = await renderMarkdown(
      '<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[x](javascript:alert(1))',
    );
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('javascript:');
  });

  it('reports LaTeX errors instead of throwing', async () => {
    const { mathErrors } = await renderMarkdown('Плохая формула: $\\frac{1$');
    expect(mathErrors.length).toBe(1);
  });

  it('does not allow trusted KaTeX commands', async () => {
    const { html } = await renderMarkdown('$\\href{javascript:alert(1)}{x}$');
    expect(html).not.toContain('href="javascript');
  });
});

describe('KaTeX version', () => {
  it('server rendering and the stylesheet use the same KaTeX', async () => {
    // Mixed versions silently break glyph layout (≠ rendered as "/=").
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    const ours = require('katex/package.json').version;
    const viaRehype = createRequire(require.resolve('rehype-katex'))('katex/package.json').version;
    expect(viaRehype).toBe(ours);
  });
});
