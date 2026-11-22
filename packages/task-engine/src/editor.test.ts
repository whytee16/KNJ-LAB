import { describe, expect, it } from 'vitest';
import {
  EditorError,
  parseParams,
  paramsToText,
  specFromForm,
  specToForm,
  textsFromForm,
  type SpecForm,
} from './index.ts';

const blank: SpecForm = {
  type: 'number',
  params: '',
  constraints: '',
  answer: '',
  decimals: '',
  toleranceAbs: '',
  tolerancePercent: '',
  unit: '',
  variables: '',
  rangeFrom: '',
  rangeTo: '',
  correct: '',
};

describe('parseParams', () => {
  it('reads int, decimal and choice lines and round-trips them', () => {
    const p = parseParams('a: int -9..9\nh: decimal 0,5..10 step 0.5\nk: choice 2, 3, 5');
    expect(p).toEqual([
      { name: 'a', kind: 'int', min: -9, max: 9 },
      { name: 'h', kind: 'decimal', min: 0.5, max: 10, step: 0.5 },
      { name: 'k', kind: 'choice', values: [2, 3, 5] },
    ]);
    expect(parseParams(paramsToText(p))).toEqual(p);
  });

  it('points to the bad line', () => {
    try {
      parseParams('a: int 1..9\nb: int 9..1');
      expect.fail('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(EditorError);
      expect((e as EditorError).line).toBe(2);
    }
    expect(() => parseParams('A: int 1..2')).toThrow(EditorError);
    expect(() => parseParams('a: int 1.5..2')).toThrow(EditorError);
  });
});

describe('specFromForm', () => {
  it('builds a number spec with tolerance in percent', () => {
    const spec = specFromForm({
      ...blank,
      params: 'v: int 1..20\nt: int 1..10',
      answer: 'v*t',
      unit: 'м',
      tolerancePercent: '1',
      decimals: '1',
    });
    expect(spec).toMatchObject({
      type: 'number',
      answer: 'v*t',
      unit: 'м',
      decimals: 1,
      tolerance: { rel: 0.01 },
    });
    expect(specToForm(spec)).toMatchObject({
      answer: 'v*t',
      tolerancePercent: '1',
      unit: 'м',
      decimals: '1',
    });
  });

  it('uses 1-based option numbers in the form', () => {
    expect(specFromForm({ ...blank, type: 'multi_choice', correct: '1, 3' })).toMatchObject({
      correct: [0, 2],
    });
    expect(
      specToForm(specFromForm({ ...blank, type: 'single_choice', correct: '2' })).correct,
    ).toBe('2');
    expect(() => specFromForm({ ...blank, type: 'single_choice', correct: '' })).toThrow(
      EditorError,
    );
  });

  it('builds a formula spec', () => {
    expect(
      specFromForm({
        ...blank,
        type: 'formula',
        answer: 'k*(x+1)',
        variables: 'x',
        params: 'k: int 2..5',
      }),
    ).toMatchObject({
      variables: ['x'],
      range: [-10, 10],
    });
  });
});

describe('textsFromForm', () => {
  it('splits list fields', () => {
    expect(
      textsFromForm({
        statement: ' Что? ',
        options: 'а\n\nб',
        matches: '',
        accepted: '',
        hints: 'подумай',
        solution: '',
      }),
    ).toMatchObject({
      statement: 'Что?',
      options: ['а', 'б'],
      hints: ['подумай'],
    });
  });
});
