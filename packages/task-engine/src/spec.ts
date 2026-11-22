import { z } from 'zod';

export const TASK_TYPES = [
  'single_choice',
  'multi_choice',
  'number',
  'formula',
  'cloze_word',
  'matching',
  'ordering',
] as const;
export type TaskType = (typeof TASK_TYPES)[number];
export const DIFFICULTIES = ['easy', 'medium', 'sufficient', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
export const FREE_DIFFICULTY: Difficulty = 'easy';

const name = z.string().regex(/^[a-z][a-z0-9_]{0,15}$/, 'validation.paramName');

export const paramSchema = z.discriminatedUnion('kind', [
  z.object({ name, kind: z.literal('int'), min: z.number().int(), max: z.number().int() }),
  z.object({
    name,
    kind: z.literal('decimal'),
    min: z.number(),
    max: z.number(),
    step: z.number().positive(),
  }),
  z.object({ name, kind: z.literal('choice'), values: z.array(z.number()).min(1).max(50) }),
]);
export type ParamDef = z.infer<typeof paramSchema>;

const base = {
  params: z.array(paramSchema).max(10).default([]),
  /** mathjs boolean expressions over the params, e.g. "a != 0", "b > a". */
  constraints: z.array(z.string().min(1).max(200)).max(10).default([]),
};

/** `spec` column of task_templates, per type. Texts (statement, options…) live per locale. */
export const taskSpecSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('single_choice'), ...base, correct: z.number().int().min(0) }),
  z.object({
    type: z.literal('multi_choice'),
    ...base,
    correct: z.array(z.number().int().min(0)).min(1),
  }),
  z.object({
    type: z.literal('number'),
    ...base,
    /** mathjs expression over the params, e.g. "-b / a". */
    answer: z.string().min(1).max(300),
    decimals: z.number().int().min(0).max(6).optional(),
    tolerance: z
      .object({ abs: z.number().min(0).optional(), rel: z.number().min(0).max(0.5).optional() })
      .default({}),
    unit: z.string().max(20).optional(),
  }),
  z.object({
    type: z.literal('formula'),
    ...base,
    /** Expected expression in mathjs syntax over params and variables, e.g. "a*(x + b)". */
    answer: z.string().min(1).max(300),
    variables: z
      .array(z.string().regex(/^[a-z]$/))
      .min(1)
      .max(3),
    /** Sampling range for variables. */
    range: z.tuple([z.number(), z.number()]).default([-10, 10]),
  }),
  z.object({ type: z.literal('cloze_word'), ...base }),
  z.object({ type: z.literal('matching'), ...base }),
  z.object({ type: z.literal('ordering'), ...base }),
]);
export type TaskSpec = z.infer<typeof taskSpecSchema>;

/** Localized texts of a template (task_template_texts). `{{a}}` inserts a parameter. */
export const taskTextsSchema = z.object({
  statement: z.string().min(1).max(4000),
  options: z.array(z.string().min(1).max(500)).max(10).default([]),
  /** Right-hand column for matching (same order as options = correct pairs). */
  matches: z.array(z.string().min(1).max(500)).max(10).default([]),
  /** Accepted answers for cloze_word. */
  accepted: z.array(z.string().min(1).max(100)).max(20).default([]),
  hints: z.array(z.string().max(1000)).max(5).default([]),
  solution: z.string().max(8000).default(''),
});
export type TaskTexts = z.infer<typeof taskTextsSchema>;
