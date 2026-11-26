-- Task bank import: templates carry a unique draft key, so a second import adds nothing.
begin;
select plan(4);

insert into public.topics (id, slug, subject_code) values ('f7000000-0000-0000-0000-000000000001', 'bank-topic', 'physics');

select has_column('public', 'task_templates', 'draft_key', 'templates have a draft key');

select lives_ok($$
  insert into public.task_templates (topic_id, type, difficulty, spec, content_origin, draft_key)
  values ('f7000000-0000-0000-0000-000000000001', 'number', 'easy', '{"type":"number","answer":"1"}', 'ai_draft', 'bank/physics/x#1')
$$, 'a template with a draft key is imported');

insert into public.task_templates (topic_id, type, difficulty, spec, content_origin, draft_key)
values ('f7000000-0000-0000-0000-000000000001', 'number', 'easy', '{"type":"number","answer":"1"}', 'ai_draft', 'bank/physics/x#1')
on conflict (draft_key) do nothing;
select is(
  (select count(*)::int from public.task_templates where draft_key = 'bank/physics/x#1'),
  1,
  'the same key is not imported twice');

select lives_ok($$
  insert into public.task_templates (topic_id, type, difficulty, spec)
  values ('f7000000-0000-0000-0000-000000000001', 'number', 'easy', '{"type":"number","answer":"1"}'),
         ('f7000000-0000-0000-0000-000000000001', 'number', 'easy', '{"type":"number","answer":"2"}')
$$, 'studio templates without a key are not limited');

select * from finish();
rollback;
