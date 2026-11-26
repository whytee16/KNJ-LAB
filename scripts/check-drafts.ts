// Checks every task template draft in content/drafts without touching the database:
// structure, texts and a run over 200 random parameter sets (answers finite, constraints
// satisfiable, options consistent, figures buildable). Prints a summary; exits 1 on errors.
//   node --experimental-strip-types scripts/check-drafts.ts
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { validateTemplate } from '../packages/task-engine/src/validate.ts';

const RUNS = Number(process.env.CHECK_RUNS ?? 200);
const root = join(import.meta.dirname, '..', 'content', 'drafts');

type Draft = {
  type: string;
  difficulty: string;
  spec: { figure?: unknown };
  texts: Record<string, unknown>;
};

const bundles: string[] = [];
for (const subject of readdirSync(root)) {
  const dir = join(root, subject);
  if (!statSync(dir).isDirectory()) continue;
  for (const name of readdirSync(dir))
    if (existsSync(join(dir, name, 'templates.json'))) bundles.push(join(dir, name));
}

let errors = 0;
let total = 0;
let figures = 0;
const byLevel: Record<string, number> = {};
const byType: Record<string, number> = {};
for (const bundle of bundles.sort()) {
  const file = join(bundle, 'templates.json');
  let list: Draft[];
  try {
    list = JSON.parse(readFileSync(file, 'utf8')) as Draft[];
  } catch (e) {
    console.error(`${relative(root, file)}: invalid JSON — ${(e as Error).message}`);
    errors++;
    continue;
  }
  list.forEach((t, i) => {
    total++;
    byLevel[t.difficulty] = (byLevel[t.difficulty] ?? 0) + 1;
    byType[t.type] = (byType[t.type] ?? 0) + 1;
    if (t.spec?.figure) figures++;
    const report = validateTemplate(t.spec, t.texts, RUNS);
    if (!report.ok) {
      errors++;
      console.error(
        `${relative(root, file)} #${i + 1}: ${JSON.stringify(report.problems.slice(0, 3))}`,
      );
    }
  });
}
console.log(
  `${bundles.length} bundles, ${total} templates, ${figures} with figures, ${RUNS} runs each`,
);
console.log(`levels: ${JSON.stringify(byLevel)}`);
console.log(`types: ${JSON.stringify(byType)}`);
console.log(errors ? `${errors} template(s) with errors` : 'all templates passed');
process.exit(errors ? 1 : 0);
