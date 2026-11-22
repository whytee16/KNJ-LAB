/** `invalid` = the input could not be understood (not counted as a wrong answer). */
export interface CheckResult {
  status: 'correct' | 'wrong' | 'invalid';
  /** 0..1, for partial credit (multi choice, matching, ordering). */
  score: number;
  reason?: 'unparseable' | 'empty' | 'cannot_verify';
}

export const correct: CheckResult = { status: 'correct', score: 1 };
export const wrong = (score = 0): CheckResult => ({ status: 'wrong', score });
export const invalid = (reason: CheckResult['reason']): CheckResult => ({
  status: 'invalid',
  score: 0,
  reason,
});
