-- Automatically prepared drafts: marked, cannot be published until a reviewer confirms the check.
begin;
select plan(14);

create function pg_temp.new_user(p_id uuid, p_email text, p_role public.app_role) returns void
language plpgsql as $$
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email, '',
          '{"provider":"email"}', '{}', now(), now());
  if p_role <> 'parent' then update public.profiles set role = p_role where id = p_id; end if;
end $$;
create function pg_temp.as_user(p_id uuid, p_aal text default 'aal2') returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated', 'aal', p_aal)::text, true)
$$;
create function pg_temp.as_anon() returns void language sql as $$
  select set_config('role', 'anon', true), set_config('request.jwt.claims', '{"role":"anon"}', true)
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true)
$$;

select pg_temp.new_user('e5000000-0000-0000-0000-000000000001', 'p1@example.test', 'parent');

select pg_temp.new_user('e6000000-0000-0000-0000-000000000005', 'm@example.test', 'content_manager');
select pg_temp.new_user('e6000000-0000-0000-0000-000000000006', 'r@example.test', 'reviewer');
-- What the importer writes (as postgres): a topic draft, lab texts and a template, all ai_draft.
insert into public.topics (id, slug, subject_code) values ('f6000000-0000-0000-0000-000000000001', 'ai-topic', 'physics');
insert into public.topic_drafts (topic_id, locale, title, theory, status, submitted_at, content_origin)
  values ('f6000000-0000-0000-0000-000000000001', 'ru', 'Бросок', 'Теория', 'in_review', now(), 'ai_draft');
insert into public.lab_translations (lab_id, locale, title, goal, content_origin)
  select id, 'ru', 'Бросок', 'Цель', 'ai_draft' from public.labs where code = 'projectile';
insert into public.task_templates (id, topic_id, type, difficulty, spec, content_origin)
  values ('f6100000-0000-0000-0000-000000000001', 'f6000000-0000-0000-0000-000000000001', 'number', 'easy',
          '{"type":"number","answer":"1"}', 'ai_draft');
insert into public.task_template_texts (template_id, locale, texts) values ('f6100000-0000-0000-0000-000000000001', 'ru', '{"statement":"?"}');

select is((select count(*)::int from public.labs where code = 'projectile' and status = 'draft' and not is_free_demo), 1,
  'the projectile lab is registered as a paid draft');

select pg_temp.as_user('e6000000-0000-0000-0000-000000000006');
select throws_ok($$ select public.publish_topic('f6000000-0000-0000-0000-000000000001', 'ru') $$,
  '23514', 'an automatically prepared draft must be checked before publishing', 'an unchecked AI topic draft cannot be published');
select throws_ok($$ select public.set_task_template_status('f6100000-0000-0000-0000-000000000001', 'published') $$,
  '23514', 'an automatically prepared template must be checked before publishing', 'an unchecked AI template cannot be published');
select throws_ok($$ select public.set_lab_status((select id from public.labs where code = 'projectile'), 'published') $$,
  '23514', 'automatically prepared lab texts must be checked before publishing', 'a lab with unchecked AI texts cannot be published');

select pg_temp.as_user('e6000000-0000-0000-0000-000000000005');
select throws_ok($$ select public.mark_content_reviewed('topic', 'f6000000-0000-0000-0000-000000000001', 'ru') $$,
  '42501', null, 'a content manager cannot confirm the check');
select throws_ok($$ update public.lab_translations set content_origin = 'human' where content_origin = 'ai_draft' $$,
  '42501', null, 'staff cannot clear the mark by editing the column');

select pg_temp.as_user('e6000000-0000-0000-0000-000000000006', 'aal1');
select throws_ok($$ select public.mark_content_reviewed('topic', 'f6000000-0000-0000-0000-000000000001', 'ru') $$,
  '42501', null, 'confirming needs a second factor');

select pg_temp.as_user('e6000000-0000-0000-0000-000000000006');
select lives_ok($$ select public.mark_content_reviewed('topic', 'f6000000-0000-0000-0000-000000000001', 'ru') $$, 'reviewer confirms the topic');
select lives_ok($$ select public.publish_topic('f6000000-0000-0000-0000-000000000001', 'ru') $$, 'then it can be published');
select lives_ok($$ select public.mark_content_reviewed('template', 'f6100000-0000-0000-0000-000000000001') $$, 'reviewer confirms the template');
select lives_ok($$ select public.set_task_template_status('f6100000-0000-0000-0000-000000000001', 'published') $$, 'then it can be published');
select lives_ok($$ select public.mark_content_reviewed('lab', (select id from public.labs where code = 'projectile'), 'ru') $$, 'reviewer confirms the lab texts');
select throws_ok($$ select public.mark_content_reviewed('lab', (select id from public.labs where code = 'projectile'), 'ru') $$,
  'P0002', null, 'confirming twice reports that nothing is left');

select pg_temp.reset();
select is((select count(*)::int from public.audit_logs where action = 'content.reviewed'), 3, 'each confirmation is audited');

select * from finish();
rollback;
