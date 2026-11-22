#!/usr/bin/env node
// Loads automatically prepared drafts from content/drafts into the database, marked `ai_draft`.
// Existing topics, lab texts and their templates are never overwritten. Publishing stays blocked
// until a reviewer confirms in the studio that a teacher checked the text (mark_content_reviewed).
//   DATABASE_URL=postgresql://... node --experimental-strip-types scripts/import-drafts.ts
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';
import { validateTemplate } from '../packages/task-engine/src/validate.ts';

type TopicDraft = {
  slug: string;
  subject: string;
  locale: 'ru';
  title: string;
  summary: string;
  objectives: string[];
  theory: string;
  mistakes: string[];
};
type LabDraft = {
  code: string;
  locale: 'ru';
  title: string;
  goal: string;
  steps: string[];
  hints: string[];
  topics: string[];
};
type TemplateDraft = {
  lab?: boolean;
  type: string;
  difficulty: string;
  spec: { type: string };
  texts: Record<string, unknown>;
};

const root = join(import.meta.dirname, '..', 'content', 'drafts');
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(2);
}
const read = <T>(file: string): T | null =>
  existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as T) : null;
const bundles = readdirSync(root)
  .filter((s) => statSync(join(root, s)).isDirectory())
  .flatMap((s) => readdirSync(join(root, s)).map((b) => join(root, s, b)))
  .filter((d) => statSync(d).isDirectory());

// Validate everything before touching the database.
for (const dir of bundles) {
  for (const [i, t] of (read<TemplateDraft[]>(join(dir, 'templates.json')) ?? []).entries()) {
    const report = validateTemplate(t.spec, t.texts as never);
    if (!report.ok) {
      console.error(`${dir}/templates.json #${i + 1}:`, JSON.stringify(report.problems));
      process.exit(1);
    }
  }
}

const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  await sql.begin(async (tx) => {
    for (const dir of bundles) {
      const name = dir.slice(root.length + 1);
      const topic = read<TopicDraft>(join(dir, 'topic.json'));
      let topicId: string | null = null;
      let topicCreated = false;
      if (topic) {
        const [existing] = await tx<
          { id: string }[]
        >`select id from public.topics where slug = ${topic.slug}`;
        if (existing) {
          topicId = existing.id;
          console.log(`${name}: topic ${topic.slug} exists, skipped`);
        } else {
          const [row] = await tx<{ id: string }[]>`
            insert into public.topics (slug, subject_code) values (${topic.slug}, ${topic.subject}) returning id`;
          topicId = row!.id;
          topicCreated = true;
          await tx`insert into public.topic_drafts (topic_id, locale, title, summary, objectives, theory, mistakes, content_origin)
                   values (${topicId}, ${topic.locale}, ${topic.title}, ${topic.summary}, ${topic.objectives},
                           ${topic.theory}, ${topic.mistakes}, 'ai_draft')`;
          console.log(`${name}: topic ${topic.slug} created (ai_draft)`);
        }
      }

      const lab = read<LabDraft>(join(dir, 'lab.json'));
      let labId: string | null = null;
      if (lab) {
        const [row] = await tx<
          { id: string }[]
        >`select id from public.labs where code = ${lab.code}`;
        if (!row)
          throw new Error(`${name}: lab ${lab.code} is not registered (add it with a migration)`);
        labId = row.id;
        const [texts] =
          await tx`select 1 from public.lab_translations where lab_id = ${labId} and locale = ${lab.locale}`;
        if (texts) console.log(`${name}: lab texts exist, skipped`);
        else {
          await tx`insert into public.lab_translations (lab_id, locale, title, goal, steps, hints, translation_status, content_origin)
                   values (${labId}, ${lab.locale}, ${lab.title}, ${lab.goal}, ${lab.steps}, ${lab.hints}, 'draft', 'ai_draft')`;
          console.log(`${name}: lab texts created (ai_draft)`);
        }
        for (const slug of lab.topics) {
          await tx`insert into public.lab_topics (lab_id, topic_id)
                   select ${labId}, id from public.topics where slug = ${slug} on conflict do nothing`;
        }
      }

      const templates = read<TemplateDraft[]>(join(dir, 'templates.json')) ?? [];
      if (templates.length && topicId && topicCreated) {
        let position = 0;
        for (const t of templates) {
          const [tpl] = await tx<{ id: string }[]>`
            insert into public.task_templates (topic_id, type, difficulty, spec, content_origin)
            values (${topicId}, ${t.type}::public.task_type, ${t.difficulty}::public.difficulty, ${tx.json(t.spec as never)}, 'ai_draft')
            returning id`;
          for (const [locale, texts] of Object.entries(t.texts))
            await tx`insert into public.task_template_texts (template_id, locale, texts)
                     values (${tpl!.id}, ${locale}::public.app_locale, ${tx.json(texts as never)})`;
          if (t.lab && labId)
            await tx`insert into public.lab_tasks (lab_id, template_id, position) values (${labId}, ${tpl!.id}, ${++position})`;
        }
        console.log(`${name}: ${templates.length} templates created (ai_draft, draft)`);
      } else if (templates.length)
        console.log(`${name}: templates skipped (topic already existed)`);
    }
  });
} finally {
  await sql.end();
}
