import { z } from 'zod';

/** Limits mirror private.valid_topic_text() in the database. Messages are i18n keys. */
export const TOPIC_LIMITS = {
  title: 150,
  summary: 500,
  theory: 60_000,
  listItems: 20,
  listItem: 500,
} as const;

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(80, 'validation.slug')
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'validation.slug');

export const subjectCodeSchema = z.enum(['algebra', 'geometry', 'physics'], {
  message: 'validation.required',
});

/** One item per line in the editor; empty lines are dropped. */
export const lineListSchema = z
  .string()
  .transform((v) =>
    v
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean),
  )
  .pipe(
    z
      .array(z.string().max(TOPIC_LIMITS.listItem, 'validation.lineTooLong'))
      .max(TOPIC_LIMITS.listItems, 'validation.tooManyLines'),
  );

export const topicDraftSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'validation.required')
    .max(TOPIC_LIMITS.title, 'validation.tooLong'),
  summary: z.string().trim().max(TOPIC_LIMITS.summary, 'validation.tooLong'),
  objectives: lineListSchema,
  theory: z.string().max(TOPIC_LIMITS.theory, 'validation.tooLong'),
  mistakes: lineListSchema,
  isMachineTranslation: z
    .enum(['on', ''])
    .optional()
    .transform((v) => v === 'on'),
});

export type TopicDraftInput = z.input<typeof topicDraftSchema>;
export type TopicDraft = z.output<typeof topicDraftSchema>;

export const newTopicSchema = z.object({
  slug: slugSchema,
  subject: subjectCodeSchema,
  title: z
    .string()
    .trim()
    .min(1, 'validation.required')
    .max(TOPIC_LIMITS.title, 'validation.tooLong'),
});
