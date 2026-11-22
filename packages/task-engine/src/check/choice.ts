import { correct, invalid, wrong, type CheckResult } from './types.ts';

export function checkSingle(answer: string, expected: { correct: string }): CheckResult {
  if (!answer) return invalid('empty');
  return answer === expected.correct ? correct : wrong();
}

/** Exact set is correct; otherwise partial = (right picks − wrong picks) / total right, ≥ 0. */
export function checkMulti(answer: string[], expected: { correct: string[] }): CheckResult {
  if (!answer.length) return invalid('empty');
  const want = new Set(expected.correct);
  const got = new Set(answer);
  const hits = [...got].filter((a) => want.has(a)).length;
  const misses = got.size - hits;
  if (hits === want.size && misses === 0) return correct;
  return wrong(Math.max(0, (hits - misses) / want.size));
}

export function checkOrdering(answer: string[], expected: { order: string[] }): CheckResult {
  if (answer.length !== expected.order.length) return invalid('empty');
  const inPlace = answer.filter((id, i) => id === expected.order[i]).length;
  return inPlace === expected.order.length ? correct : wrong(inPlace / expected.order.length);
}

export function checkMatching(
  answer: Record<string, string>,
  expected: { pairs: Record<string, string> },
): CheckResult {
  const keys = Object.keys(expected.pairs);
  if (keys.some((k) => !answer[k])) return invalid('empty');
  const right = keys.filter((k) => answer[k] === expected.pairs[k]).length;
  return right === keys.length ? correct : wrong(right / keys.length);
}
