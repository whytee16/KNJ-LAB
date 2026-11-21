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

describe('supabaseEnv', async () => {
  const { supabaseEnv, isSupabaseConfigured } = await import('./env');

  it('lists every missing variable', () => {
    expect(() => supabaseEnv(parseEnv({}))).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, IP_HASH_SALT/,
    );
    expect(isSupabaseConfigured(parseEnv({}))).toBe(false);
  });

  it('returns settings when configured', () => {
    const env = parseEnv({
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
      SUPABASE_SERVICE_ROLE_KEY: 'service',
      IP_HASH_SALT: 'a-long-enough-salt',
    });
    expect(supabaseEnv(env)).toMatchObject({
      url: 'http://127.0.0.1:54321',
      serviceRoleKey: 'service',
    });
  });
});

describe('account settings', () => {
  it('keeps registration closed unless explicitly enabled', () => {
    expect(parseEnv({}).REGISTRATION_ENABLED).toBe(false);
    expect(parseEnv({ REGISTRATION_ENABLED: 'true' }).REGISTRATION_ENABLED).toBe(true);
  });

  it('only allows non-deliverable student domains and long salts', () => {
    expect(() => parseEnv({ STUDENT_EMAIL_DOMAIN: 'gmail.com' })).toThrow(/STUDENT_EMAIL_DOMAIN/);
    expect(() => parseEnv({ IP_HASH_SALT: 'short' })).toThrow(/IP_HASH_SALT/);
  });
});
