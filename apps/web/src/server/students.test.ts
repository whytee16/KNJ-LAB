import { describe, expect, it } from 'vitest';
import { identifierToEmail, isStudentEmail, usernameToEmail } from './students';

const D = 'student.knj.invalid';

describe('student logins', () => {
  it('maps usernames to the technical domain', () => {
    expect(usernameToEmail('Arman.K', D)).toBe('arman.k@student.knj.invalid');
    expect(isStudentEmail('arman.k@student.knj.invalid', D)).toBe(true);
    expect(isStudentEmail('parent@mail.kz', D)).toBe(false);
  });

  it('accepts either an e-mail or a username at login', () => {
    expect(identifierToEmail(' Parent@Mail.kz ', D)).toBe('parent@mail.kz');
    expect(identifierToEmail('arman.k', D)).toBe('arman.k@student.knj.invalid');
  });
});
