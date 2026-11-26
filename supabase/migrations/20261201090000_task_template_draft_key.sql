-- Task bank: each template imported from content/drafts carries a stable key
-- ("<bundle>#<n>"), so the importer can add templates to existing topics and re-run safely.
alter table public.task_templates add column draft_key text;
alter table public.task_templates
  add constraint task_templates_draft_key_key unique (draft_key);
comment on column public.task_templates.draft_key is
  'Key of the draft the template was imported from (scripts/import-drafts.ts); null for templates made in the studio.';
