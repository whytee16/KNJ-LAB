import katex from 'katex';

/**
 * Renders LaTeX to HTML on the server.
 * Throws on invalid LaTeX and on commands that need trust (\href, \url, \includegraphics,
 * \htmlClass…), so broken or unsafe formulas fail loudly instead of rendering silently.
 */
export function renderLatex(latex: string, displayMode = false): string {
  return katex.renderToString(latex, {
    displayMode,
    throwOnError: true,
    trust: (context) => {
      throw new Error(`Untrusted LaTeX command: ${context.command}`);
    },
    strict: 'error',
    output: 'htmlAndMathml',
  });
}
