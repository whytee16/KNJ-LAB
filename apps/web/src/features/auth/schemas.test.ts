import { describe, expect, it } from 'vitest';
import {
  childSchema,
  newPasswordSchema,
  passwordSchema,
  registerSchema,
  usernameSchema,
} from './schemas';

const firstMessage = (r: { success: boolean; error?: { issues: { message: string }[] } }) =>
  r.success ? null : r.error!.issues[0]!.message;

describe('passwordSchema', () => {
  it.each([
    ['short1', 'validation.passwordShort'],
    ['onlyletters', 'validation.passwordWeak'],
    ['12345678', 'validation.passwordWeak'],
    ['пароль123', 'validation.passwordWeak'],
    ['пароль123a', null],
    ['secret12', null],
  ])('%s → %s', (pw, expected) => {
    expect(firstMessage(passwordSchema.safeParse(pw))).toBe(expected);
  });
});

describe('usernameSchema', () => {
  it('normalizes case and enforces the database pattern', () => {
    expect(usernameSchema.parse(' Arman.K ')).toBe('arman.k');
    expect(usernameSchema.safeParse('ab').success).toBe(false);
    expect(usernameSchema.safeParse('.arman').success).toBe(false);
    expect(usernameSchema.safeParse('арман').success).toBe(false);
  });
});

describe('registerSchema', () => {
  it('requires explicit consent', () => {
    const r = registerSchema.safeParse({
      displayName: 'Айгерим',
      email: 'a@b.kz',
      password: 'secret12',
      consent: '',
    });
    expect(firstMessage(r)).toBe('validation.consentRequired');
  });

  it('normalizes e-mail', () => {
    const r = registerSchema.parse({
      displayName: ' Айгерим ',
      email: ' A@B.KZ ',
      password: 'secret12',
      consent: 'on',
    });
    expect(r).toMatchObject({ displayName: 'Айгерим', email: 'a@b.kz' });
  });
});

describe('childSchema', () => {
  it('accepts grades 7–11 only', () => {
    const base = { displayName: 'Арман', username: 'arman', password: 'secret12', consent: 'on' };
    expect(childSchema.safeParse({ ...base, grade: '8' }).success).toBe(true);
    expect(firstMessage(childSchema.safeParse({ ...base, grade: '6' }))).toBe('validation.grade');
    expect(firstMessage(childSchema.safeParse({ ...base, grade: 'x' }))).toBe('validation.grade');
  });
});

describe('newPasswordSchema', () => {
  it('requires matching confirmation', () => {
    const r = newPasswordSchema.safeParse({ password: 'secret12', confirm: 'secret13' });
    expect(firstMessage(r)).toBe('validation.passwordMismatch');
  });
});
