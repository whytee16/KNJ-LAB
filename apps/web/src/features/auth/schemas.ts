import { z } from 'zod';

// Messages are i18n keys under `validation.*`.
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('validation.email').max(254, 'validation.email'));

export const passwordSchema = z
  .string()
  .min(8, 'validation.passwordShort')
  .max(72, 'validation.passwordLong')
  // Same rule as GoTrue's `letters_digits`: at least one Latin letter and one digit.
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'validation.passwordWeak');

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, 'validation.required')
  .max(60, 'validation.nameLong');

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9_.]{2,31}$/, 'validation.username');

export const gradeSchema = z.coerce
  .number({ message: 'validation.grade' })
  .int('validation.grade')
  .min(7, 'validation.grade')
  .max(11, 'validation.grade');

const consentSchema = z.literal('on', { message: 'validation.consentRequired' });

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'validation.required').max(254, 'validation.required'),
  password: z.string().min(1, 'validation.required').max(72, 'validation.passwordLong'),
});

export const registerSchema = z.object({
  displayName: displayNameSchema,
  email: emailSchema,
  password: passwordSchema,
  consent: consentSchema,
});

export const childSchema = z.object({
  displayName: displayNameSchema,
  username: usernameSchema,
  grade: gradeSchema,
  password: passwordSchema,
  consent: consentSchema,
});

export const resetRequestSchema = z.object({ email: emailSchema });

export const newPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, {
    message: 'validation.passwordMismatch',
    path: ['confirm'],
  });

export const consentFormSchema = z.object({ consent: consentSchema });
