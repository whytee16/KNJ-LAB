#!/usr/bin/env node
// Loads automatically prepared drafts from content/drafts into the database, marked `ai_draft`.
// Existing topics, lab texts and their templates are never overwritten. Publishing stays blocked
// until a reviewer confirms in the studio that a teacher checked the text (mark_content_reviewed).
//   DATABASE_URL=postgresql://... node --experimental-strip-types scripts/import-drafts.ts
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
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
type BankDraft = { topic: string };
type CurriculumDraft = {
  subject: string;
  grade: number;
  sections: { quarter: number; title: string; topics: string[] }[];
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
// Bundles: content/drafts/<subject>/<name> and the task bank content/drafts/bank/<subject>/<name>.
const subdirs = (d: string) =>
  readdirSync(d)
    .map((x) => join(d, x))
    .filter((x) => statSync(x).isDirectory());
const bundles = subdirs(root)
  .flatMap((s) => (s.endsWith(`${sep}bank`) ? subdirs(s).flatMap(subdirs) : subdirs(s)))
  // DRAFT_BUNDLES=physics/projectile,physics/atwood — import only these (tests, partial updates).
  .filter((d) => {
    const only = process.env.DRAFT_BUNDLES?.split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    return !only?.length || only.includes(d.slice(root.length + 1).replaceAll('\\', '/'));
  })
  // Bundles that create a topic go first: other bundles may link their labs to that topic.
  .sort(
    (a, b) => Number(existsSync(join(b, 'topic.json'))) - Number(existsSync(join(a, 'topic.json'))),
  );

// Validate everything before touching the database: every JSON parses, every template passes.
for (const dir of bundles)
  for (const f of ['topic.json', 'lab.json', 'templates.json'])
    try {
      read(join(dir, f));
    } catch (e) {
      console.error(`${dir}/${f}: ${(e as Error).message}`);
      process.exit(1);
    }
for (const dir of bundles) {
  for (const [i, t] of (read<TemplateDraft[]>(join(dir, 'templates.json')) ?? []).entries()) {
    const report = validateTemplate(t.spec, t.texts as never, 200);
    if (!report.ok) {
      console.error(`${dir}/templates.json #${i + 1}:`, JSON.stringify(report.problems));
      process.exit(1);
    }
  }
}

const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  await sql.begin(async (tx) => {
    // One importer at a time (parallel test runs, two terminals).
    await tx`select pg_advisory_xact_lock(724501)`;
    for (const dir of bundles) {
      const name = dir.slice(root.length + 1);
      const topic = read<TopicDraft>(join(dir, 'topic.json'));
      let topicId: string | null = null;
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
      // Task bank bundle: templates for an existing topic named in bank.json.
      const bank = read<BankDraft>(join(dir, 'bank.json'));
      if (bank) {
        const [row] = await tx<
          { id: string }[]
        >`select id from public.topics where slug = ${bank.topic}`;
        if (!row) throw new Error(`${name}: topic ${bank.topic} does not exist`);
        topicId = row.id;
      }
      // A bundle without its own topic attaches templates to the lab's first topic.
      if (!topicId && lab) {
        const [first] = await tx<
          { id: string }[]
        >`select id from public.topics where slug = ${lab.topics[0] ?? ''}`;
        topicId = first?.id ?? null;
      }
      if (templates.length && topicId) {
        // Every template has a stable key: a second run adds only templates that are new.
        let created = 0;
        const [maxPos] = labId
          ? await tx<
              { p: number }[]
            >`select coalesce(max(position), 0) as p from public.lab_tasks where lab_id = ${labId}`
          : [{ p: 0 }];
        let position = Number(maxPos?.p ?? 0);
        for (const [i, t] of templates.entries()) {
          const key = `${name.replaceAll('\\', '/')}#${i + 1}`;
          const [tpl] = await tx<{ id: string }[]>`
            insert into public.task_templates (topic_id, type, difficulty, spec, content_origin, draft_key)
            values (${topicId}, ${t.type}::public.task_type, ${t.difficulty}::public.difficulty, ${tx.json(t.spec as never)}, 'ai_draft', ${key})
            on conflict (draft_key) do nothing
            returning id`;
          if (!tpl) continue;
          created++;
          for (const [locale, texts] of Object.entries(t.texts))
            await tx`insert into public.task_template_texts (template_id, locale, texts)
                     values (${tpl.id}, ${locale}::public.app_locale, ${tx.json(texts as never)})`;
          if (t.lab && labId)
            await tx`insert into public.lab_tasks (lab_id, template_id, position) values (${labId}, ${tpl.id}, ${++position})`;
        }
        console.log(
          `${name}: ${created} templates created (ai_draft, draft), ${templates.length - created} already there`,
        );
      } else if (templates.length) console.log(`${name}: templates skipped (no topic)`);
    }

    // Curriculum placement approved by the owner: content/drafts/curriculum/<subject>-<grade>.json.
    // Creates missing sections of the default curriculum (by quarter and title) and attaches topics
    // that are not placed yet. Topics already placed somewhere are left where the methodist put them.
    const curDir = join(root, 'curriculum');
    const curFiles = existsSync(curDir)
      ? readdirSync(curDir).filter((f) => f.endsWith('.json') && !process.env.DRAFT_BUNDLES)
      : [];
    for (const file of curFiles) {
      const cur = read<CurriculumDraft>(join(curDir, file))!;
      const [def] = await tx<{ id: string }[]>`select id from public.curricula where is_default`;
      if (!def) throw new Error('no default curriculum');
      let placed = 0;
      for (const sec of cur.sections) {
        let [section] = await tx<{ id: string }[]>`
          select s.id from public.curriculum_sections s
          join public.curriculum_section_translations tr on tr.section_id = s.id and tr.locale = 'ru'
          where s.curriculum_id = ${def.id} and s.subject_code = ${cur.subject}
            and s.grade = ${cur.grade} and s.quarter = ${sec.quarter} and tr.title = ${sec.title}`;
        if (!section) {
          [section] = await tx<{ id: string }[]>`
            insert into public.curriculum_sections (curriculum_id, subject_code, grade, quarter, sort)
            select ${def.id}, ${cur.subject}, ${cur.grade}, ${sec.quarter}, coalesce(max(sort), 0) + 1
            from public.curriculum_sections
            where curriculum_id = ${def.id} and subject_code = ${cur.subject}
              and grade = ${cur.grade} and quarter = ${sec.quarter}
            returning id`;
          await tx`insert into public.curriculum_section_translations (section_id, locale, title)
                   values (${section!.id}, 'ru', ${sec.title})`;
        }
        for (const [i, slug] of sec.topics.entries()) {
          const [topic] = await tx<
            { id: string }[]
          >`select id from public.topics where slug = ${slug}`;
          if (!topic) {
            console.log(`curriculum/${file}: topic ${slug} not found, skipped`);
            continue;
          }
          const [already] = await tx<{ n: number }[]>`
            select count(*)::int as n from public.curriculum_topics ct
            join public.curriculum_sections s on s.id = ct.section_id
            where ct.topic_id = ${topic.id} and s.curriculum_id = ${def.id}`;
          if (already!.n > 0) continue;
          await tx`insert into public.curriculum_topics (section_id, topic_id, sort)
                   values (${section!.id}, ${topic.id}, ${i + 1})`;
          placed++;
        }
      }
      console.log(`curriculum/${file}: ${placed} topics placed`);
    }
  });
} finally {
  await sql.end();
}
