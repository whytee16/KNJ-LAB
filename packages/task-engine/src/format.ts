export type EngineLocale = 'ru' | 'kk';

/** Formats a number for display: decimal comma for ru/kk, no float noise. */
export function formatNumber(value: number, _locale: EngineLocale = 'ru'): string {
  const rounded = Math.round(value * 1e9) / 1e9;
  const s = String(rounded);
  return s.replace('-', '−').replace('.', ',');
}

/** Same, but safe inside LaTeX math: `{,}` keeps KaTeX from adding a space after the comma. */
export function formatNumberLatex(value: number): string {
  const rounded = Math.round(value * 1e9) / 1e9;
  return String(rounded).replace('.', '{,}');
}

/**
 * Replaces `{{name}}` with parameter values. Inside `$…$` / `$$…$$` math the LaTeX-safe format
 * is used, outside the plain one.
 */
export function substitute(
  text: string,
  params: Record<string, number>,
  locale: EngineLocale,
): string {
  let out = '';
  let inMath = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === '\\' && text[i + 1] === '$') {
      out += '\\$';
      i++;
      continue;
    }
    if (ch === '$') {
      inMath = !inMath;
      if (text[i + 1] === '$') {
        out += '$$';
        i++;
        continue;
      }
      out += '$';
      continue;
    }
    if (ch === '{' && text[i + 1] === '{') {
      const end = text.indexOf('}}', i + 2);
      if (end > 0) {
        const key = text.slice(i + 2, end).trim();
        if (key in params) {
          out += inMath ? formatNumberLatex(params[key]!) : formatNumber(params[key]!, locale);
          i = end + 1;
          continue;
        }
      }
    }
    out += ch;
  }
  return out;
}

/** Names used as `{{name}}` in a text (for validation). */
export function placeholders(text: string): string[] {
  return [...text.matchAll(/\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g)].map((m) => m[1]!);
}
