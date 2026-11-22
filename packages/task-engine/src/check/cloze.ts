import { correct, invalid, wrong, type CheckResult } from './types.ts';

/** Case, ё/е, extra spaces and trailing punctuation do not matter. */
export function normalizeWord(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.,;:!?]+$/, '');
}

export function checkCloze(answer: string, expected: { accepted: string[] }): CheckResult {
  const a = normalizeWord(answer);
  if (!a) return invalid('empty');
  return expected.accepted.some((x) => normalizeWord(x) === a) ? correct : wrong();
}
