import { describe, expect, it } from 'vitest';
import {
  formulaSchema,
  formulaTextSchema,
  newTopicSchema,
  topicDraftSchema,
  variablesToText,
} from './index.ts';

const msg = (r: { success: boolean; error?: { issues: { message: string }[] } }) =>
  r.success ? null : r.error!.issues[0]!.message;

describe('topicDraftSchema', () => {
  it('splits list fields into trimmed lines', () => {
    const r = topicDraftSchema.parse({
      title: ' Линейные уравнения ',
      summary: '',
      objectives: 'решать уравнения\n\n  проверять корни ',
      theory: 'Текст',
      mistakes: '',
      isMachineTranslation: 'on',
    });
    expect(r).toMatchObject({
      title: 'Линейные уравнения',
      objectives: ['решать уравнения', 'проверять корни'],
      mistakes: [],
      isMachineTranslation: true,
    });
  });

  it('enforces database limits', () => {
    const many = Array.from({ length: 21 }, (_, i) => `цель ${i}`).join('\n');
    expect(
      msg(
        topicDraftSchema.safeParse({
          title: 'x',
          summary: '',
          objectives: many,
          theory: '',
          mistakes: '',
        }),
      ),
    ).toBe('validation.tooManyLines');
    expect(
      msg(
        topicDraftSchema.safeParse({
          title: '',
          summary: '',
          objectives: '',
          theory: '',
          mistakes: '',
        }),
      ),
    ).toBe('validation.required');
  });
});

describe('newTopicSchema', () => {
  it('accepts kebab-case slugs only', () => {
    expect(
      newTopicSchema.safeParse({ slug: 'Linear-Equations', subject: 'algebra', title: 'x' })
        .success,
    ).toBe(true);
    expect(
      msg(newTopicSchema.safeParse({ slug: 'linear equations', subject: 'algebra', title: 'x' })),
    ).toBe('validation.slug');
    expect(msg(newTopicSchema.safeParse({ slug: 'ok', subject: 'chemistry', title: 'x' }))).toBe(
      'validation.required',
    );
  });
});

describe('formula schemas', () => {
  it('checks the grade range', () => {
    const base = { code: 'ohms-law', subject: 'physics', latex: 'I = \\frac{U}{R}' };
    expect(formulaSchema.safeParse({ ...base, gradeFrom: '8', gradeTo: '11' }).success).toBe(true);
    expect(msg(formulaSchema.safeParse({ ...base, gradeFrom: '10', gradeTo: '8' }))).toBe(
      'validation.gradeRange',
    );
  });

  it('parses variable lines and round-trips them', () => {
    const r = formulaTextSchema.parse({
      name: 'Закон Ома',
      description: '',
      variables: 'I | сила тока | А\nU | напряжение | В\nR | сопротивление',
    });
    expect(r.variables).toEqual([
      { symbol: 'I', meaning: 'сила тока', unit: 'А' },
      { symbol: 'U', meaning: 'напряжение', unit: 'В' },
      { symbol: 'R', meaning: 'сопротивление', unit: '' },
    ]);
    expect(variablesToText(r.variables)).toBe(
      'I | сила тока | А\nU | напряжение | В\nR | сопротивление',
    );
  });

  it('rejects variable lines without a meaning', () => {
    expect(msg(formulaTextSchema.safeParse({ name: 'x', description: '', variables: 'I' }))).toBe(
      'validation.variableLine',
    );
  });
});
