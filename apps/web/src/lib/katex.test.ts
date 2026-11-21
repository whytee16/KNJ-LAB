import { describe, expect, it } from 'vitest';
import { renderLatex } from './katex';

describe('renderLatex', () => {
  it('renders formulas with MathML for screen readers', () => {
    const html = renderLatex('I = \\frac{U}{R}');
    expect(html).toContain('katex');
    expect(html).toContain('<math');
  });

  it('throws on invalid LaTeX', () => {
    expect(() => renderLatex('\\frac{1')).toThrow();
  });

  it('does not allow untrusted commands', () => {
    expect(() => renderLatex('\\href{javascript:alert(1)}{x}')).toThrow(/Untrusted LaTeX/);
    expect(() => renderLatex('\\url{https://example.com}')).toThrow(/Untrusted LaTeX/);
  });
});
