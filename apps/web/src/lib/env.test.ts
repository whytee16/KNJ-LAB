import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

describe('parseEnv', () => {
  it('applies defaults', () => {
    const env = parseEnv({});
    expect(env.APP_URL).toBe('http://localhost:3000');
    expect(env.NEXT_PUBLIC_CONTACT_EMAIL).toBeUndefined();
  });

  it('treats an empty contact email as unset', () => {
    expect(parseEnv({ NEXT_PUBLIC_CONTACT_EMAIL: '' }).NEXT_PUBLIC_CONTACT_EMAIL).toBeUndefined();
  });

  it('rejects malformed values with a readable message', () => {
    expect(() => parseEnv({ APP_URL: 'not a url' })).toThrow(/APP_URL/);
    expect(() => parseEnv({ NEXT_PUBLIC_CONTACT_EMAIL: 'nope' })).toThrow(/CONTACT_EMAIL/);
  });
});
