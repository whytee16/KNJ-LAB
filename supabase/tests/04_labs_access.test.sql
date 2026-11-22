-- Labs: registry, workflow, visibility, question links, sessions and the pass guard.
begin;
select plan(27);

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
select pg_temp.new_user('e5000000-0000-0000-0000-000000000002', 's1@student.invalid', 'parent');
select public.register_student('e5000000-0000-0000-0000-000000000002', 'e5000000-0000-0000-0000-000000000001', 'lab.one', 7::smallint, 'Арман', 'dev-0');
select pg_temp.new_user('e5000000-0000-0000-0000-000000000003', 'p2@example.test', 'parent');
select pg_temp.new_user('e5000000-0000-0000-0000-000000000004', 's2@student.invalid', 'parent');
select public.register_student('e5000000-0000-0000-0000-000000000004', 'e5000000-0000-0000-0000-000000000003', 'lab.two', 7::smallint, 'Дана', 'dev-0');
select pg_temp.new_user('e5000000-0000-0000-0000-000000000005', 'm@example.test', 'content_manager');
select pg_temp.new_user('e5000000-0000-0000-0000-000000000006', 'r@example.test', 'reviewer');
insert into public.topics (id, slug, subject_code) values ('f5000000-0000-0000-0000-000000000001', 'lab-topic', 'physics');
insert into public.task_templates (id, topic_id, type, difficulty, spec, status)
  values ('f5100000-0000-0000-0000-000000000001', 'f5000000-0000-0000-0000-000000000001', 'number', 'easy',
          '{"type":"number","answer":"1"}', 'published');
-- A second, paid lab registered only for this test (labs normally come with a model in code).
insert into public.labs (id, code, subject_code, kind, is_free_demo)
  values ('f5200000-0000-0000-0000-000000000002', 'paid-lab-test', 'physics', 'physics', false);

select is((select count(*)::int from public.labs where code = 'uniform-motion' and status = 'draft' and is_free_demo), 1,
  'the reference lab is registered as a free-demo draft');

-- Visibility and registry -------------------------------------------------------------------------
select pg_temp.as_anon();
select is((select count(*)::int from public.labs), 0, 'draft labs are hidden from visitors');
select throws_ok($$ insert into public.labs (code, subject_code, kind) values ('x', 'physics', 'physics') $$,
  '42501', null, 'visitors cannot register labs');

select pg_temp.as_user('e5000000-0000-0000-0000-000000000005');
select throws_ok($$ insert into public.labs (code, subject_code, kind) values ('x', 'physics', 'physics') $$,
  '42501', null, 'staff cannot register labs either (models come with code)');
select throws_ok($$ delete from public.labs where code = 'uniform-motion' $$,
  '42501', null, 'staff cannot delete labs');
select is((select count(*)::int from public.labs where code in ('uniform-motion', 'paid-lab-test')), 2, 'staff see draft labs');

-- Workflow ----------------------------------------------------------------------------------------
select pg_temp.as_user('e5000000-0000-0000-0000-000000000005', 'aal1');
select throws_ok($$ insert into public.lab_translations (lab_id, locale, title) select id, 'ru', 'Движение' from public.labs where code = 'uniform-motion' $$,
  '42501', null, 'lab texts need a second factor');

select pg_temp.as_user('e5000000-0000-0000-0000-000000000005');
select lives_ok($$ insert into public.lab_translations (lab_id, locale, title, goal, steps)
  select id, 'ru', 'Движение', '', '{"Шаг"}' from public.labs where code = 'uniform-motion' $$, 'manager writes texts');
select lives_ok($$ update public.labs set default_params = '{"v": 4, "t": 5, "x0": 0}' where code = 'uniform-motion' $$,
  'manager edits default parameters of a draft');
select lives_ok($$ insert into public.lab_topics (lab_id, topic_id)
  select id, 'f5000000-0000-0000-0000-000000000001' from public.labs where code = 'uniform-motion' $$, 'manager links a topic');
select lives_ok($$ insert into public.lab_tasks (lab_id, template_id)
  select id, 'f5100000-0000-0000-0000-000000000001' from public.labs where code = 'uniform-motion' $$, 'manager links a question');
select throws_ok($$ update public.labs set code = 'other' where code = 'uniform-motion' $$,
  '42501', null, 'the code (link to the model) cannot be changed');
select throws_ok($$ select public.set_lab_status((select id from public.labs where code = 'uniform-motion'), 'published') $$,
  '42501', null, 'content manager cannot publish a lab');
select lives_ok($$ select public.set_lab_status((select id from public.labs where code = 'uniform-motion'), 'in_review') $$,
  'content manager submits a lab');

select pg_temp.as_user('e5000000-0000-0000-0000-000000000006');
select throws_ok($$ select public.set_lab_status((select id from public.labs where code = 'uniform-motion'), 'published') $$,
  '23514', null, 'a goal in Russian is required before publishing');
update public.lab_translations set goal = 'Изучить равномерное движение' where locale = 'ru';
select lives_ok($$ select public.set_lab_status((select id from public.labs where code = 'uniform-motion'), 'published') $$,
  'reviewer publishes');
select lives_ok($$ select public.set_lab_status('f5200000-0000-0000-0000-000000000002', 'in_review') $$, 'paid lab sent');

select pg_temp.reset();
insert into public.lab_translations (lab_id, locale, title, goal) values ('f5200000-0000-0000-0000-000000000002', 'ru', 'Платная', 'Цель');
update public.labs set status = 'published' where id = 'f5200000-0000-0000-0000-000000000002';

select pg_temp.as_user('e5000000-0000-0000-0000-000000000005');
update public.labs set is_free_demo = false where code = 'uniform-motion';
select pg_temp.reset();
select ok((select is_free_demo from public.labs where code = 'uniform-motion'), 'published labs are locked for content managers');

select pg_temp.as_anon();
select is((select count(*)::int from public.lab_translations t join public.labs l on l.id = t.lab_id where l.code = 'uniform-motion'), 1,
  'visitors read texts of published labs');
select is((select count(*)::int from public.lab_tasks), 1, 'visitors see which templates a published lab uses');

-- Sessions and the pass guard ---------------------------------------------------------------------
select pg_temp.as_user('e5000000-0000-0000-0000-000000000002');
select throws_ok($$ insert into public.lab_sessions (student_id, lab_id) select 'e5000000-0000-0000-0000-000000000002', id from public.labs where code = 'uniform-motion' $$,
  '42501', null, 'students do not write sessions directly');

select pg_temp.reset();
select lives_ok($$ insert into public.lab_sessions (student_id, lab_id, params) select 'e5000000-0000-0000-0000-000000000002', id, '{"v": 3}' from public.labs where code = 'uniform-motion' $$,
  'the server saves a session of a free-demo lab');
select throws_ok($$ insert into public.lab_sessions (student_id, lab_id) values ('e5000000-0000-0000-0000-000000000002', 'f5200000-0000-0000-0000-000000000002') $$,
  '42501', null, 'a paid lab needs a pass even for the service role');
select throws_ok($$ insert into public.attempts (student_id, kind, lab_id) values ('e5000000-0000-0000-0000-000000000002', 'lab', 'f5200000-0000-0000-0000-000000000002') $$,
  '42501', null, 'paid lab questions need a pass too');

select throws_ok($$ delete from public.task_templates where id = 'f5100000-0000-0000-0000-000000000001' $$,
  '23503', null, 'a template used as a lab question cannot be deleted');

select pg_temp.as_user('e5000000-0000-0000-0000-000000000001');
select is((select count(*)::int from public.lab_sessions), 1, 'a parent sees their child''s lab sessions');
select pg_temp.as_user('e5000000-0000-0000-0000-000000000003');
select is((select count(*)::int from public.lab_sessions), 0, 'another parent does not');

select * from finish();
rollback;
