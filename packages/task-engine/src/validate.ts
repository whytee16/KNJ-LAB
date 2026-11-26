import type { FigureScene } from './figure.ts';
import { placeholders, type EngineLocale } from './format.ts';
import { generateTask } from './generate.ts';
import { taskSpecSchema, taskTextsSchema, type TaskSpec, type TaskTexts } from './spec.ts';

export interface ValidationReport {
  ok: boolean;
  /** Machine-readable problem codes with context, shown in the studio. */
  problems: { code: string; detail?: string; locale?: EngineLocale; seed?: number }[];
  /** A few sample statements for the preview. */
  samples: { locale: EngineLocale; seed: number; statement: string; figure?: FigureScene }[];
}

/**
 * Structural checks plus a run over `runs` seeds per locale: constraints satisfiable, answers
 * finite, options consistent. Publication is refused unless `ok`.
 */
export function validateTemplate(
  specInput: unknown,
  textsInput: Partial<Record<EngineLocale, unknown>>,
  runs = 50,
): ValidationReport {
  const problems: ValidationReport['problems'] = [];
  const samples: ValidationReport['samples'] = [];
  const spec = taskSpecSchema.safeParse(specInput);
  if (!spec.success)
    return {
      ok: false,
      problems: [{ code: 'spec_invalid', detail: spec.error.issues[0]?.message }],
      samples,
    };

  const names = new Set([
    ...spec.data.params.map((p) => p.name),
    ...spec.data.derived.map((d) => d.name),
  ]);
  const locales = (Object.keys(textsInput) as EngineLocale[]).filter((l) => textsInput[l]);
  if (!locales.includes('ru')) problems.push({ code: 'ru_missing' });

  for (const locale of locales) {
    const parsed = taskTextsSchema.safeParse(textsInput[locale]);
    if (!parsed.success) {
      problems.push({ code: 'texts_invalid', locale, detail: parsed.error.issues[0]?.message });
      continue;
    }
    const texts = parsed.data;
    const all = [
      texts.statement,
      texts.solution,
      ...texts.options,
      ...texts.matches,
      ...texts.accepted,
      ...texts.hints,
    ];
    for (const name of all.flatMap(placeholders)) {
      if (!names.has(name)) problems.push({ code: 'unknown_placeholder', locale, detail: name });
    }
    problems.push(...structural(spec.data, texts).map((code) => ({ code, locale })));
    if (problems.length) continue;

    for (let seed = 1; seed <= runs; seed++) {
      try {
        const task = generateTask(spec.data, texts, seed, locale);
        if (seed <= 3)
          samples.push({
            locale,
            seed,
            statement: task.prompt.statement,
            figure: task.prompt.figure,
          });
      } catch (e) {
        problems.push({
          code: 'generation_failed',
          locale,
          seed,
          detail: e instanceof Error ? e.message : String(e),
        });
        break;
      }
    }
  }
  return { ok: problems.length === 0, problems, samples };
}

function structural(spec: TaskSpec, t: TaskTexts): string[] {
  const out: string[] = [];
  const n = t.options.length;
  switch (spec.type) {
    case 'single_choice':
      if (n < 2) out.push('too_few_options');
      if (spec.correct >= n) out.push('correct_out_of_range');
      break;
    case 'multi_choice':
      if (n < 2) out.push('too_few_options');
      if (spec.correct.some((c) => c >= n)) out.push('correct_out_of_range');
      break;
    case 'ordering':
      if (n < 2) out.push('too_few_options');
      break;
    case 'matching':
      if (n < 2) out.push('too_few_options');
      if (t.matches.length !== n) out.push('matching_length');
      break;
    case 'cloze_word':
      if (!t.statement.includes('___')) out.push('cloze_gap_missing');
      if (!t.accepted.length) out.push('cloze_no_answers');
      break;
    default:
      break;
  }
  return out;
}
