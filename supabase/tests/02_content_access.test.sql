-- Content core: publication workflow, MFA-gated staff writes, curricula, formulas, favorites, roles.
begin;
select plan(49);

-- Fixtures --------------------------------------------------------------------------------------
create function pg_temp.new_user(p_id uuid, p_email text, p_role public.app_role) returns void
language plpgsql as $$
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email, '',
          '{"provider":"email"}', '{}', now(), now());
  update public.profiles set role = p_role where id = p_id;
end $$;

create function pg_temp.as_user(p_id uuid, p_aal text default 'aal2') returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims',
           json_build_object('sub', p_id, 'role', 'authenticated', 'aal', p_aal)::text, true)
$$;
create function pg_temp.as_anon() returns void language sql as $$
  select set_config('role', 'anon', true), set_config('request.jwt.claims', '{"role":"anon"}', true)
$$;
create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true)
$$;

select pg_temp.new_user('a0000000-0000-0000-0000-000000000001', 'manager@example.test', 'content_manager');
select pg_temp.new_user('a0000000-0000-0000-0000-000000000002', 'reviewer@example.test', 'reviewer');
select pg_temp.new_user('a0000000-0000-0000-0000-000000000003', 'admin@example.test', 'admin');
select pg_temp.new_user('a0000000-0000-0000-0000-000000000004', 'parent@example.test', 'parent');
select pg_temp.new_user('a0000000-0000-0000-0000-000000000005', 'other@example.test', 'parent');

-- Reference data -----------------------------------------------------------------------------------
select pg_temp.as_anon();
select is((select count(*)::int from public.subjects), 3, 'anyone reads the three subjects');
select is((select count(*)::int from public.curricula where is_default), 1, 'a default curriculum exists');
select pg_temp.reset();

-- Topic creation needs staff + second factor --------------------------------------------------------
select pg_temp.as_user('a0000000-0000-0000-0000-000000000001', 'aal1');
select throws_ok($$ insert into public.topics (id, slug, subject_code, created_by)
  values ('b0000000-0000-0000-0000-000000000001', 'linear-equations', 'algebra', 'a0000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'staff without a second factor cannot create topics');

select pg_temp.as_user('a0000000-0000-0000-0000-000000000001');
select lives_ok($$ insert into public.topics (id, slug, subject_code, created_by)
  values ('b0000000-0000-0000-0000-000000000001', 'linear-equations', 'algebra', 'a0000000-0000-0000-0000-000000000001') $$,
  'content manager with aal2 creates a topic');
select lives_ok($$ insert into public.topic_drafts (topic_id, locale, title, theory)
  values ('b0000000-0000-0000-0000-000000000001', 'ru', 'Линейные уравнения', 'Уравнение $ax + b = 0$.') $$,
  'content manager writes a draft');
select throws_ok($$ update public.topic_drafts set status = 'approved'
  where topic_id = 'b0000000-0000-0000-0000-000000000001' $$, '42501', null,
  'draft status cannot be set directly');
select throws_ok($$ select public.publish_topic('b0000000-0000-0000-0000-000000000001', 'ru') $$,
  '42501', null, 'content manager cannot publish');
select throws_ok($$ insert into public.parent_student_links (parent_id, student_id)
  values ('a0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000005') $$,
  '42501', null, 'staff gain no access to account tables');

-- Unpublished content is invisible outside staff ---------------------------------------------------
select pg_temp.as_anon();
select is((select count(*)::int from public.topics where id = 'b0000000-0000-0000-0000-000000000001'), 0, 'anon does not see an unpublished topic');
select throws_ok($$ select count(*) from public.topic_drafts $$, '42501', null, 'anon cannot read drafts');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000004');
select is((select count(*)::int from public.topic_drafts), 0, 'a parent cannot read any drafts');
select is((select count(*)::int from public.topics where id = 'b0000000-0000-0000-0000-000000000001'), 0, 'a parent does not see an unpublished topic');

-- Submit → review → publish ----------------------------------------------------------------------
select pg_temp.as_user('a0000000-0000-0000-0000-000000000001');
select lives_ok($$ select public.submit_topic_draft('b0000000-0000-0000-0000-000000000001', 'ru') $$,
  'content manager submits for review');
select is((select status from public.topic_drafts where topic_id = 'b0000000-0000-0000-0000-000000000001'),
  'in_review'::public.draft_status, 'draft is in review');

select pg_temp.as_user('a0000000-0000-0000-0000-000000000002', 'aal1');
select throws_ok($$ select public.publish_topic('b0000000-0000-0000-0000-000000000001', 'ru') $$,
  '42501', null, 'reviewer without a second factor cannot publish');

select pg_temp.as_user('a0000000-0000-0000-0000-000000000002');
select is(public.publish_topic('b0000000-0000-0000-0000-000000000001', 'ru'), 1, 'reviewer publishes version 1');
select is((select status from public.topic_drafts where topic_id = 'b0000000-0000-0000-0000-000000000001'),
  'approved'::public.draft_status, 'draft marked approved');

select pg_temp.as_anon();
select is((select count(*)::int from public.topics where id = 'b0000000-0000-0000-0000-000000000001'), 1, 'anon sees the published topic');
select is((select title from public.topic_contents where topic_id = 'b0000000-0000-0000-0000-000000000001'),
  'Линейные уравнения', 'anon reads the published text');

-- Editing a published topic keeps the published version until re-review -------------------------------
select pg_temp.as_user('a0000000-0000-0000-0000-000000000001');
update public.topic_drafts set title = 'Линейные уравнения с одной переменной'
  where topic_id = 'b0000000-0000-0000-0000-000000000001' and locale = 'ru';
select is((select status from public.topic_drafts where topic_id = 'b0000000-0000-0000-0000-000000000001'),
  'draft'::public.draft_status, 'editing an approved draft returns it to draft');
select is((select title from public.topic_contents where topic_id = 'b0000000-0000-0000-0000-000000000001'),
  'Линейные уравнения', 'published text is unchanged by the edit');

select public.submit_topic_draft('b0000000-0000-0000-0000-000000000001', 'ru');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000002');
select lives_ok($$ select public.request_topic_changes('b0000000-0000-0000-0000-000000000001', 'ru', 'Добавьте пример') $$,
  'reviewer requests changes');
select is((select review_note from public.topic_drafts where topic_id = 'b0000000-0000-0000-0000-000000000001'),
  'Добавьте пример', 'review note is stored');

select pg_temp.as_user('a0000000-0000-0000-0000-000000000001');
select public.submit_topic_draft('b0000000-0000-0000-0000-000000000001', 'ru');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000002');
select is(public.publish_topic('b0000000-0000-0000-0000-000000000001', 'ru'), 2, 'second publication is version 2');
select is((select title from public.topic_contents where topic_id = 'b0000000-0000-0000-0000-000000000001'),
  'Линейные уравнения с одной переменной', 'new text is published');
select pg_temp.reset();
select ok(exists(select 1 from public.audit_logs where action = 'topic.published'
  and entity_id = 'b0000000-0000-0000-0000-000000000001'), 'publication is audited');

-- Curriculum (KTP) ---------------------------------------------------------------------------------
select pg_temp.as_user('a0000000-0000-0000-0000-000000000001');
select throws_ok($$ insert into public.curriculum_sections (id, curriculum_id, subject_code, grade, quarter)
  select 'c0000000-0000-0000-0000-000000000001', id, 'algebra', 7, 1 from public.curricula where is_default $$,
  '42501', null, 'content manager cannot edit the curriculum');

select pg_temp.as_user('a0000000-0000-0000-0000-000000000002');
select lives_ok($$ insert into public.curriculum_sections (id, curriculum_id, subject_code, grade, quarter)
  select 'c0000000-0000-0000-0000-000000000001', id, 'algebra', 7, 1 from public.curricula where is_default $$,
  'reviewer adds a section');
select lives_ok($$ insert into public.curriculum_section_translations (section_id, locale, title)
  values ('c0000000-0000-0000-0000-000000000001', 'ru', 'Уравнения') $$, 'reviewer names the section');
select lives_ok($$ insert into public.curriculum_topics (section_id, topic_id)
  values ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001') $$,
  'reviewer attaches the topic');
select throws_ok($$ insert into public.curriculum_sections (curriculum_id, subject_code, grade, quarter)
  select id, 'algebra', 7, 5 from public.curricula where is_default $$, '23514', null,
  'quarters are limited to 1–4');

select pg_temp.as_anon();
select is((select count(*)::int from public.curriculum_topics where topic_id = 'b0000000-0000-0000-0000-000000000001'), 1, 'anon reads the curriculum');
select pg_temp.reset();

-- Formulas ----------------------------------------------------------------------------------------
select pg_temp.as_user('a0000000-0000-0000-0000-000000000001');
select lives_ok($$ insert into public.formulas (id, code, subject_code, grade_from, grade_to, latex, created_by)
  values ('d0000000-0000-0000-0000-000000000001', 'ohms-law', 'physics', 8, 11, 'I = \frac{U}{R}',
          'a0000000-0000-0000-0000-000000000001') $$, 'content manager drafts a formula');
select lives_ok($$ insert into public.formula_translations (formula_id, locale, name)
  values ('d0000000-0000-0000-0000-000000000001', 'ru', 'Закон Ома для участка цепи') $$,
  'content manager names it');
select throws_ok($$ select public.set_formula_status('d0000000-0000-0000-0000-000000000001', 'published') $$,
  '42501', null, 'content manager cannot publish a formula');
select lives_ok($$ select public.set_formula_status('d0000000-0000-0000-0000-000000000001', 'in_review') $$,
  'content manager submits the formula');
update public.formulas set latex = 'I = U' where id = 'd0000000-0000-0000-0000-000000000001';
select pg_temp.reset();
select is((select latex from public.formulas where id = 'd0000000-0000-0000-0000-000000000001'),
  'I = \frac{U}{R}', 'a formula in review is locked for content managers');

select pg_temp.as_anon();
select is((select count(*)::int from public.formulas where id = 'd0000000-0000-0000-0000-000000000001'), 0, 'anon does not see unpublished formulas');

select pg_temp.as_user('a0000000-0000-0000-0000-000000000002');
select lives_ok($$ select public.set_formula_status('d0000000-0000-0000-0000-000000000001', 'published') $$,
  'reviewer publishes the formula');
select pg_temp.as_anon();
select is((select count(*)::int from public.formula_translations where formula_id = 'd0000000-0000-0000-0000-000000000001'), 1, 'anon reads the published formula');

-- Favorites ---------------------------------------------------------------------------------------
select pg_temp.as_user('a0000000-0000-0000-0000-000000000004', 'aal1');
select lives_ok($$ insert into public.favorites (profile_id, formula_id)
  values ('a0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000001') $$,
  'a parent adds a published formula to favorites');
select throws_ok($$ insert into public.favorites (profile_id, formula_id)
  values ('a0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'nobody can add favorites for someone else');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000005', 'aal1');
select is((select count(*)::int from public.favorites where profile_id = 'a0000000-0000-0000-0000-000000000004'), 0, 'favorites are private');

-- Roles -------------------------------------------------------------------------------------------
select pg_temp.as_user('a0000000-0000-0000-0000-000000000002');
select throws_ok($$ select public.set_user_role('a0000000-0000-0000-0000-000000000005', 'admin') $$,
  '42501', null, 'only admins change roles');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000003', 'aal1');
select throws_ok($$ select public.set_user_role('a0000000-0000-0000-0000-000000000005', 'content_manager') $$,
  '42501', null, 'admins need a second factor to change roles');
select pg_temp.as_user('a0000000-0000-0000-0000-000000000003');
select lives_ok($$ select public.set_user_role('a0000000-0000-0000-0000-000000000005', 'content_manager') $$,
  'admin with aal2 promotes a user');
select throws_ok($$ select public.set_user_role('a0000000-0000-0000-0000-000000000003', 'parent') $$,
  '23514', null, 'admins cannot change their own role');
select throws_ok($$ select public.find_user_by_email('parent@example.test') $$, '42501', null,
  'user lookup by e-mail is server-only');
select pg_temp.reset();
select is((select role from public.profiles where id = 'a0000000-0000-0000-0000-000000000005'),
  'content_manager'::public.app_role, 'role change applied');

select * from finish();
rollback;
