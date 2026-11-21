import { describe, expect, it } from 'vitest';
import ru from '../messages/ru.json' with { type: 'json' };
import kk from '../messages/kk.json' with { type: 'json' };
import { compareMessages, isComplete } from './check.ts';
import { isLocale, locales } from './locales.ts';

describe('compareMessages', () => {
  it('detects missing, extra, empty and non-string values', () => {
    const r = compareMessages({ a: 'x', b: { c: 'y' }, d: 'z' }, { a: '', b: { c: 1 }, e: 'q' });
    expect(r.missing).toEqual(['d']);
    expect(r.extra).toEqual(['e']);
    expect(r.empty).toEqual(['a']);
    expect(r.nonString).toEqual(['b.c']);
    expect(isComplete(r)).toBe(false);
  });
});

describe('dictionaries', () => {
  it.each(locales)('%s is complete relative to ru', (locale) => {
    const dict = locale === 'ru' ? ru : kk;
    expect(compareMessages(ru, dict)).toEqual({ missing: [], extra: [], empty: [], nonString: [] });
  });

  it('isLocale guards unknown values', () => {
    expect(isLocale('kk')).toBe(true);
    expect(isLocale('en')).toBe(false);
  });
});
