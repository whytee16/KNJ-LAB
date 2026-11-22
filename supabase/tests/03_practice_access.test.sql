-- Practice: template workflow, answer keys, paid levels and passes, visibility of attempts.
begin;
select plan(37);

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

-- People: two families, staff.
select pg_temp.new_user('e0000000-0000-0000-0000-000000000001', 'p1@example.test', 'parent');
select pg_temp.new_user('e0000000-0000-0000-0000-000000000002', 's1@student.invalid', 'parent');
select public.register_student('e0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'stud.one', 8::smallint, 'Арман', 'dev-0');
select pg_temp.new_user('e0000000-0000-0000-0000-000000000003', 'p2@example.test', 'parent');
select pg_temp.new_user('e0000000-0000-0000-0000-000000000004', 's2@student.invalid', 'parent');
select public.register_student('e0000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000003', 'stud.two', 8::smallint, 'Дана', 'dev-0');
select pg_temp.new_user('e0000000-0000-0000-0000-000000000005', 'm@example.test', 'content_manager');
select pg_temp.new_user('e0000000-0000-0000-0000-000000000006', 'r@example.test', 'reviewer');
select pg_temp.new_user('e0000000-0000-0000-0000-000000000007', 'a@example.test', 'admin');
insert into public.topics (id, slug, subject_code) values ('f0000000-0000-0000-0000-000000000001', 'practice-topic', 'algebra');

-- Template workflow -------------------------------------------------------------------------------
select pg_temp.as_user('e0000000-0000-0000-0000-000000000005', 'aal1');
select throws_ok($$ insert into public.task_templates (id, topic_id, type, difficulty, spec, created_by)
  values ('f1000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'number', 'easy',
          '{"type":"number","answer":"1"}', 'e0000000-0000-0000-0000-000000000005') $$,
  '42501', null, 'templates need a second factor');

select pg_temp.as_user('e0000000-0000-0000-0000-000000000005');
select lives_ok($$ insert into public.task_templates (id, topic_id, type, difficulty, spec, created_by) values
  ('f1000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'number', 'easy',
   '{"type":"number","answer":"1"}', 'e0000000-0000-0000-0000-000000000005'),
  ('f1000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001', 'number', 'medium',
   '{"type":"number","answer":"2"}', 'e0000000-0000-0000-0000-000000000005') $$,
  'content manager drafts templates');
select throws_ok($$ insert into public.task_templates (topic_id, type, difficulty, spec, created_by)
  values ('f0000000-0000-0000-0000-000000000001', 'number', 'easy', '{"type":"formula"}', 'e0000000-0000-0000-0000-000000000005') $$,
  '23514', null, 'spec type must match the template type');
select lives_ok($$ insert into public.task_template_texts (template_id, locale, texts) values
  ('f1000000-0000-0000-0000-000000000001', 'ru', '{"statement":"Сколько?"}'),
  ('f1000000-0000-0000-0000-000000000002', 'ru', '{"statement":"Сколько?"}') $$, 'texts added');
select is((select version from public.task_templates where id = 'f1000000-0000-0000-0000-000000000001'), 2,
  'adding texts bumps the template version');
select throws_ok($$ select public.set_task_template_status('f1000000-0000-0000-0000-000000000001', 'published') $$,
  '42501', null, 'content manager cannot publish templates');
select lives_ok($$ select public.set_task_template_status('f1000000-0000-0000-0000-000000000001', 'in_review') $$,
  'content manager submits a template');

select pg_temp.as_anon();
select is((select count(*)::int from public.task_templates where id = 'f1000000-0000-0000-0000-000000000001'), 0,
  'unpublished templates are hidden');

select pg_temp.as_user('e0000000-0000-0000-0000-000000000006');
select lives_ok($$ select public.set_task_template_status('f1000000-0000-0000-0000-000000000001', 'published') $$,
  'reviewer publishes');
select lives_ok($$ select public.set_task_template_status('f1000000-0000-0000-0000-000000000002', 'published') $$,
  'reviewer publishes the paid template');

select pg_temp.as_user('e0000000-0000-0000-0000-000000000005');
update public.task_templates set spec = '{"type":"number","answer":"99"}' where id = 'f1000000-0000-0000-0000-000000000001';
select pg_temp.reset();
select is((select spec ->> 'answer' from public.task_templates where id = 'f1000000-0000-0000-0000-000000000001'), '1',
  'published templates are locked for content managers');

select pg_temp.as_anon();
select is((select count(*)::int from public.task_template_texts where template_id = 'f1000000-0000-0000-0000-000000000001'), 1,
  'anyone reads published template texts');
select pg_temp.reset();

-- Issuing tasks (server side) and paid levels ------------------------------------------------------
insert into public.trainer_runs (id, student_id, topic_id, difficulty) values
  ('f2000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001', 'easy');
insert into public.attempts (id, student_id, kind, trainer_run_id) values
  ('f3000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'trainer', 'f2000000-0000-0000-0000-000000000001');

select lives_ok($$ insert into public.task_instances (id, template_id, template_version, student_id, attempt_id, seed, locale, prompt)
  values ('f4000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 3,
          'e0000000-0000-0000-0000-000000000002', 'f3000000-0000-0000-0000-000000000001', 1, 'ru', '{"statement":"x"}') $$,
  'free level task is issued without a pass');
insert into public.task_instance_keys (instance_id, expected) values ('f4000000-0000-0000-0000-000000000001', '{"type":"number","value":1}');
insert into public.attempt_answers (attempt_id, instance_id, answer, status, score, idempotency_key)
  values ('f3000000-0000-0000-0000-000000000001', 'f4000000-0000-0000-0000-000000000001', '"1"', 'correct', 1, gen_random_uuid());
select throws_ok($$ insert into public.attempt_answers (attempt_id, instance_id, answer, status, score, idempotency_key)
  values ('f3000000-0000-0000-0000-000000000001', 'f4000000-0000-0000-0000-000000000001', '"2"', 'wrong', 0, gen_random_uuid()) $$,
  '23505', null, 'a task is answered only once');

select throws_ok($$ insert into public.task_instances (template_id, template_version, student_id, attempt_id, seed, locale, prompt)
  values ('f1000000-0000-0000-0000-000000000002', 1, 'e0000000-0000-0000-0000-000000000002',
          'f3000000-0000-0000-0000-000000000001', 1, 'ru', '{}') $$,
  '42501', null, 'paid level is refused without a pass, even for the server');

-- Passes ----------------------------------------------------------------------------------------
select pg_temp.as_user('e0000000-0000-0000-0000-000000000006');
select throws_ok($$ select public.grant_entitlement('e0000000-0000-0000-0000-000000000002', 30, 'pilot') $$,
  '42501', null, 'only admins grant passes');
select pg_temp.as_user('e0000000-0000-0000-0000-000000000007', 'aal1');
select throws_ok($$ select public.grant_entitlement('e0000000-0000-0000-0000-000000000002', 30, 'pilot') $$,
  '42501', null, 'admins need a second factor');
select pg_temp.as_user('e0000000-0000-0000-0000-000000000007');
select throws_ok($$ select public.grant_entitlement('e0000000-0000-0000-0000-000000000001', 30, 'pilot') $$,
  '23514', null, 'passes are for students only');
select lives_ok($$ select public.grant_entitlement('e0000000-0000-0000-0000-000000000002', 30, 'pilot') $$,
  'admin grants a 30-day pass');
select lives_ok($$ select public.grant_entitlement('e0000000-0000-0000-0000-000000000002', 15, 'extension') $$,
  'admin extends the pass');
select pg_temp.reset();
select ok((select max(ends_at) - min(starts_at) from public.entitlements where student_id = 'e0000000-0000-0000-0000-000000000002')
  between interval '44 days 23 hours' and interval '45 days 1 hour', 'extension continues the active pass');

select lives_ok($$ insert into public.task_instances (template_id, template_version, student_id, attempt_id, seed, locale, prompt)
  values ('f1000000-0000-0000-0000-000000000002', 1, 'e0000000-0000-0000-0000-000000000002',
          'f3000000-0000-0000-0000-000000000001', 1, 'ru', '{}') $$, 'paid level is issued with a pass');
select throws_ok($$ insert into public.task_instances (template_id, template_version, student_id, attempt_id, seed, locale, prompt)
  values ('f1000000-0000-0000-0000-000000000002', 1, 'e0000000-0000-0000-0000-000000000004',
          'f3000000-0000-0000-0000-000000000001', 1, 'ru', '{}') $$, '42501', null, 'another student still has no pass');

-- Visibility ------------------------------------------------------------------------------------
select pg_temp.as_user('e0000000-0000-0000-0000-000000000002', 'aal1');
select is((select count(*)::int from public.task_instances), 2, 'student sees own tasks');
select is((select count(*)::int from public.attempt_answers), 1, 'student sees own answers');
select is((select count(*)::int from public.entitlements), 2, 'student sees own passes');
select throws_ok($$ select * from public.task_instance_keys $$, '42501', null, 'students cannot read answer keys');
select throws_ok($$ insert into public.attempt_answers (attempt_id, instance_id, answer, status, score, idempotency_key)
  values ('f3000000-0000-0000-0000-000000000001', 'f4000000-0000-0000-0000-000000000001', '"1"', 'correct', 1, gen_random_uuid()) $$,
  '42501', null, 'students cannot write answers directly');

select pg_temp.as_user('e0000000-0000-0000-0000-000000000004', 'aal1');
select is((select count(*)::int from public.attempts), 0, 'another student sees nothing');

select pg_temp.as_user('e0000000-0000-0000-0000-000000000001', 'aal1');
select is((select count(*)::int from public.attempts), 1, 'parent sees the child''s attempts');
select is((select count(*)::int from public.attempt_answers), 1, 'parent sees the child''s answers');
select throws_ok($$ select * from public.task_instance_keys $$, '42501', null, 'parents cannot read answer keys');

select pg_temp.as_user('e0000000-0000-0000-0000-000000000003', 'aal1');
select is((select count(*)::int from public.attempts), 0, 'other parent sees nothing');

-- Revocation -----------------------------------------------------------------------------------------
select pg_temp.as_user('e0000000-0000-0000-0000-000000000007');
select public.revoke_entitlement(id) from public.entitlements where student_id = 'e0000000-0000-0000-0000-000000000002';
select pg_temp.reset();
select is(private.has_entitlement('e0000000-0000-0000-0000-000000000002'), false, 'revoked passes no longer count');

-- Tests --------------------------------------------------------------------------------------------
select pg_temp.as_user('e0000000-0000-0000-0000-000000000005');
select throws_ok($$ insert into public.tests (scope, topic_id, mode, created_by)
  values ('topic', 'f0000000-0000-0000-0000-000000000001', 'exam', 'e0000000-0000-0000-0000-000000000005') $$,
  '23514', null, 'exam mode needs a time limit');
select lives_ok($$ insert into public.tests (id, scope, topic_id, mode, time_limit_s, created_by)
  values ('f5000000-0000-0000-0000-000000000001', 'topic', 'f0000000-0000-0000-0000-000000000001', 'exam', 600,
          'e0000000-0000-0000-0000-000000000005') $$, 'content manager drafts a test');
select pg_temp.as_user('e0000000-0000-0000-0000-000000000006');
select throws_ok($$ select public.set_test_status('f5000000-0000-0000-0000-000000000001', 'published') $$,
  '23514', null, 'a test needs a Russian title before publishing');

select * from finish();
rollback;
