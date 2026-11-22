import type { Expected } from '../generate.ts';
import { checkMatching, checkMulti, checkOrdering, checkSingle } from './choice.ts';
import { checkCloze } from './cloze.ts';
import { checkFormula } from './formula.ts';
import { checkNumber } from './number.ts';
import { invalid, type CheckResult } from './types.ts';

export type { CheckResult } from './types.ts';

/** Student answers as sent by the client (validated shape per type). */
export type Answer = string | string[] | Record<string, string>;

export function checkAnswer(expected: Expected, answer: Answer): CheckResult {
  switch (expected.type) {
    case 'number':
      return typeof answer === 'string' ? checkNumber(answer, expected) : invalid('unparseable');
    case 'formula':
      return typeof answer === 'string' ? checkFormula(answer, expected) : invalid('unparseable');
    case 'cloze_word':
      return typeof answer === 'string' ? checkCloze(answer, expected) : invalid('unparseable');
    case 'single_choice':
      return typeof answer === 'string' ? checkSingle(answer, expected) : invalid('unparseable');
    case 'multi_choice':
      return Array.isArray(answer) ? checkMulti(answer, expected) : invalid('unparseable');
    case 'ordering':
      return Array.isArray(answer) ? checkOrdering(answer, expected) : invalid('unparseable');
    case 'matching':
      return answer && typeof answer === 'object' && !Array.isArray(answer)
        ? checkMatching(answer, expected)
        : invalid('unparseable');
  }
}
