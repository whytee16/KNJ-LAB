import { z } from 'zod';
import { slugSchema, subjectCodeSchema } from './topic.ts';

const grade = z.coerce
  .number({ message: 'validation.grade' })
  .int('validation.grade')
  .min(7, 'validation.grade')
  .max(11, 'validation.grade');

/**
 * Variables are edited as lines "symbol | meaning | unit", e.g. "I | сила тока | А".
 * Symbols are LaTeX; meaning is localized text; unit is optional.
 */
export const variablesSchema = z
  .string()
  .transform((v, ctx) => {
    const rows = v
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const out: { symbol: string; meaning: string; unit: string }[] = [];
    for (const row of rows) {
      const [symbol = '', meaning = '', unit = ''] = row.split('|').map((p) => p.trim());
      if (!symbol || !meaning) {
        ctx.addIssue({ code: 'custom', message: 'validation.variableLine' });
        return z.NEVER;
      }
      out.push({ symbol, meaning, unit });
    }
    return out;
  })
  .pipe(
    z
      .array(
        z.object({
          symbol: z.string().max(40),
          meaning: z.string().max(200),
          unit: z.string().max(40),
        }),
      )
      .max(15, 'validation.tooManyLines'),
  );

export const formulaSchema = z
  .object({
    code: slugSchema,
    subject: subjectCodeSchema,
    gradeFrom: grade,
    gradeTo: grade,
    latex: z.string().trim().min(1, 'validation.required').max(500, 'validation.tooLong'),
  })
  .refine((v) => v.gradeFrom <= v.gradeTo, { message: 'validation.gradeRange', path: ['gradeTo'] });

export const formulaTextSchema = z.object({
  name: z.string().trim().min(1, 'validation.required').max(150, 'validation.tooLong'),
  description: z.string().trim().max(1000, 'validation.tooLong'),
  variables: variablesSchema,
});

export type FormulaVariable = { symbol: string; meaning: string; unit: string };

/** Inverse of variablesSchema for pre-filling the editor. */
export function variablesToText(vars: FormulaVariable[]): string {
  return vars
    .map((v) => [v.symbol, v.meaning, v.unit].filter((p, i) => i < 2 || p).join(' | '))
    .join('\n');
}
