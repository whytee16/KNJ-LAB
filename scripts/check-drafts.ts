// Checks every task template draft in content/drafts without touching the database:
// structure, texts and a run over 200 random parameter sets (answers finite, constraints
// satisfiable, options consistent, figures buildable). Prints a summary; exits 1 on errors.
//   node --experimental-strip-types scripts/check-drafts.ts
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { validateTemplate } from '../packages/task-engine/src/validate.ts';
import { generateTask } from '../packages/task-engine/src/generate.ts';
import { taskSpecSchema, taskTextsSchema } from '../packages/task-engine/src/spec.ts';

const RUNS = Number(process.env.CHECK_RUNS ?? 200);
const root = join(import.meta.dirname, '..', 'content', 'drafts');

type Draft = {
  type: string;
  difficulty: string;
  spec: { figure?: unknown };
  texts: Record<string, unknown>;
};

// Bundles: content/drafts/<subject>/<name> and the task bank content/drafts/bank/<subject>/<name>.
const subdirs = (d: string) =>
  readdirSync(d)
    .map((x) => join(d, x))
    .filter((x) => statSync(x).isDirectory());
const bundles = subdirs(root)
  .flatMap((s) => (s.endsWith(`${sep}bank`) ? subdirs(s).flatMap(subdirs) : subdirs(s)))
  .filter((d) => existsSync(join(d, 'templates.json')));
const LEVELS = ['easy', 'medium', 'sufficient', 'hard'];
const PER_LEVEL = 15;
const warnings: string[] = [];

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
  // Task bank bundles must have 15 templates on every level.
  if (relative(root, bundle).startsWith(`bank${sep}`)) {
    const counts = LEVELS.map((l) => list.filter((t) => t.difficulty === l).length);
    if (counts.some((c) => c < PER_LEVEL))
      warnings.push(
        `${relative(root, bundle)}: levels ${LEVELS.map((l, i) => `${l} ${counts[i]}`).join(', ')}`,
      );
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
      return;
    }
    // Numbers a student reads must be short: a derived value like 55,384615385 is a defect.
    const spec = taskSpecSchema.parse(t.spec);
    const texts = taskTextsSchema.parse(t.texts.ru);
    for (let seed = 1; seed <= 60; seed++) {
      const task = generateTask(spec, texts, seed, 'ru');
      const shown = [task.prompt.statement, ...(task.prompt.options ?? []).map((o) => o.text)];
      const long = shown.join(' ').match(/\d+[,.{}]+\d{4,}/);
      if (long) {
        errors++;
        console.error(
          `${relative(root, file)} #${i + 1}: long number «${long[0]}» in the statement (seed ${seed})`,
        );
        break;
      }
    }
  });
}
console.log(
  `${bundles.length} bundles, ${total} templates, ${figures} with figures, ${RUNS} runs each`,
);
console.log(`levels: ${JSON.stringify(byLevel)}`);
console.log(`types: ${JSON.stringify(byType)}`);
for (const w of warnings)
  console.warn(`warning: fewer than ${PER_LEVEL} templates on a level — ${w}`);
console.log(errors ? `${errors} template(s) with errors` : 'all templates passed');
process.exit(errors ? 1 : 0);
