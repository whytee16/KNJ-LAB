import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compareMessages, isComplete } from './check.ts';
import { defaultLocale, locales } from './locales.ts';

const dir = fileURLToPath(new URL('../messages/', import.meta.url));
const load = (l: string) => JSON.parse(readFileSync(`${dir}${l}.json`, 'utf8'));
const reference = load(defaultLocale);
let failed = false;
for (const locale of locales) {
  const report = compareMessages(reference, load(locale));
  if (!isComplete(report)) {
    failed = true;
    console.error(`[i18n] ${locale}:`, JSON.stringify(report, null, 2));
  } else {
    console.log(`[i18n] ${locale}: ok`);
  }
}
process.exit(failed ? 1 : 0);
