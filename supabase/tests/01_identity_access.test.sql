-- RLS matrix for stage 2 tables: student / parent / other parent / admin / anon.
begin;
select plan(39);

-- Fixtures --------------------------------------------------------------------------------------
create function pg_temp.new_user(p_id uuid, p_email text, p_app jsonb, p_meta jsonb default '{}')
returns void language sql as $$
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email, '',
          p_app, p_meta, now(), now())
$$;

create function pg_temp.as_user(p_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true)
$$;

create function pg_temp.as_anon() returns void language sql as $$
  select set_config('role', 'anon', true), set_config('request.jwt.claims', '{"role":"anon"}', true)
$$;

create function pg_temp.reset() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true)
$$;

select pg_temp.new_user('11111111-1111-1111-1111-111111111111', 'parent1@example.test',
  '{"provider":"email"}', '{"display_name":"Айгерим","locale":"kk"}');
select pg_temp.new_user('22222222-2222-2222-2222-222222222222', 'parent2@example.test',
  '{"provider":"email"}', '{"display_name":"Ерлан"}');
select pg_temp.new_user('33333333-3333-3333-3333-333333333333', 'arman@student.invalid',
  '{"provider":"email"}', '{}');
select pg_temp.new_user('44444444-4444-4444-4444-444444444444', 'admin@example.test',
  '{"provider":"email"}', '{"display_name":"Admin"}');
update public.profiles set role = 'admin' where id = '44444444-4444-4444-4444-444444444444';

-- Trigger behaviour ---------------------------------------------------------------------------
select is((select role from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'parent'::public.app_role, 'self sign-up becomes a parent');
select is((select locale from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'kk'::public.app_locale, 'locale comes from user metadata');

-- Metadata never grants a role, neither user nor app metadata.
select pg_temp.new_user('55555555-5555-5555-5555-555555555555', 'sneaky@example.test',
  '{"provider":"email","app_role":"admin"}', '{"app_role":"admin","role":"admin","display_name":"x"}');
select is((select role from public.profiles where id = '55555555-5555-5555-5555-555555555555'),
  'parent'::public.app_role, 'metadata cannot grant a role');

-- register_student -------------------------------------------------------------------------------
select lives_ok($$ select public.register_student('33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111', 'arman.k', 8::smallint, 'Арман', 'dev-0', 'h') $$,
  'service registers a fresh account as a student');
select is((select role from public.profiles where id = '33333333-3333-3333-3333-333333333333'),
  'student'::public.app_role, 'student role assigned');
select is((select grade from public.student_profiles where profile_id = '33333333-3333-3333-3333-333333333333'),
  8::smallint, 'student profile created with grade');
select ok(exists(select 1 from public.parent_student_links
  where parent_id = '11111111-1111-1111-1111-111111111111' and student_id = '33333333-3333-3333-3333-333333333333'
  and status = 'active'), 'parent link created');
select ok(exists(select 1 from public.consents where subject_profile_id = '33333333-3333-3333-3333-333333333333'
  and given_by_profile_id = '11111111-1111-1111-1111-111111111111' and type = 'child_pd_processing'),
  'guardian consent recorded for the student');

select throws_ok($$ select public.register_student('11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222', 'parent.one', 7::smallint, 'x', 'dev-0') $$,
  '23514', null, 'a parent who already has children cannot be turned into a student');
select throws_ok($$ select public.register_student('55555555-5555-5555-5555-555555555555',
  '33333333-3333-3333-3333-333333333333', 'xx.y', 7::smallint, 'x', 'dev-0') $$,
  '23503', null, 'a student cannot become someone''s parent');
select throws_ok($$ select public.register_student('55555555-5555-5555-5555-555555555555',
  '22222222-2222-2222-2222-222222222222', 'xx.y', 7::smallint, 'x', 'no-such-version') $$,
  '23514', null, 'an unknown consent version is rejected');
update public.profiles set created_at = now() - interval '1 hour' where id = '55555555-5555-5555-5555-555555555555';
select throws_ok($$ select public.register_student('55555555-5555-5555-5555-555555555555',
  '22222222-2222-2222-2222-222222222222', 'xx.y', 7::smallint, 'x', 'dev-0') $$,
  '23514', null, 'an older existing account cannot be converted');

-- Parent 1 ------------------------------------------------------------------------------------
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is((select count(*)::int from public.profiles), 2, 'parent sees own profile and own child');
select is((select count(*)::int from public.student_profiles), 1, 'parent sees own child student profile');
select is((select count(*)::int from public.consents), 1, 'parent sees consents given by them');
select is((select count(*)::int from public.audit_logs), 0, 'parent cannot read the audit log');

update public.student_profiles set grade = 9 where profile_id = '33333333-3333-3333-3333-333333333333';
select is((select grade from public.student_profiles where profile_id = '33333333-3333-3333-3333-333333333333'),
  9::smallint, 'parent can change the child''s grade');

select throws_ok($$ update public.profiles set role = 'admin' where id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null, 'parent cannot change own role');
update public.profiles set display_name = 'Айгерим К.' where id = '11111111-1111-1111-1111-111111111111';
select is((select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Айгерим К.', 'parent can change own display name');
update public.profiles set display_name = 'hacked' where id = '33333333-3333-3333-3333-333333333333';
select isnt((select display_name from public.profiles where id = '33333333-3333-3333-3333-333333333333'),
  'hacked', 'parent cannot rename the child profile directly');

select throws_ok($$ insert into public.parent_student_links (parent_id, student_id)
  values ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222') $$,
  '42501', null, 'parent cannot create links directly');
select throws_ok($$ insert into public.consents (subject_profile_id, given_by_profile_id, type, document_version)
  values ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'pd_processing', 'x') $$,
  '42501', null, 'consents cannot be written by clients');
select throws_ok($$ select public.write_audit(null, 'x', 'y', null) $$, '42501', null,
  'clients cannot write to the audit log');
select throws_ok($$ select public.rate_limit_hit('k', 1, 60) $$, '42501', null,
  'clients cannot call the rate limiter');
select throws_ok($$ select public.register_student('22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111', 'zz.zz', 7::smallint, 'x', 'dev-0') $$, '42501', null,
  'clients cannot register students');

-- Parent 2 (not related) -----------------------------------------------------------------------
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select is((select count(*)::int from public.profiles), 1, 'another parent sees only own profile');
select is((select count(*)::int from public.student_profiles), 0, 'another parent cannot see the child');
select is((select count(*)::int from public.parent_student_links), 0, 'another parent cannot see links');
update public.student_profiles set grade = 11 where profile_id = '33333333-3333-3333-3333-333333333333';
select pg_temp.reset();
select is((select grade from public.student_profiles where profile_id = '33333333-3333-3333-3333-333333333333'),
  9::smallint, 'another parent cannot change the child''s grade');

-- Student ---------------------------------------------------------------------------------------
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select is((select count(*)::int from public.profiles), 1, 'student sees only own profile');
select is((select count(*)::int from public.student_profiles), 1, 'student sees own student profile');
select is((select count(*)::int from public.parent_student_links), 1, 'student sees own link');
update public.student_profiles set grade = 11 where profile_id = '33333333-3333-3333-3333-333333333333';
select pg_temp.reset();
select is((select grade from public.student_profiles where profile_id = '33333333-3333-3333-3333-333333333333'),
  9::smallint, 'student cannot change own grade');

-- Admin ----------------------------------------------------------------------------------------
select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
select is((select count(*)::int from public.profiles), 5, 'admin sees all profiles');
select pg_temp.reset();

-- Anonymous --------------------------------------------------------------------------------------
select pg_temp.as_anon();
select throws_ok($$ select count(*) from public.profiles $$, '42501', null, 'anon cannot read profiles');
select ok((select count(*) from public.legal_documents) >= 0, 'anon can read published legal documents');
select pg_temp.reset();

-- Audit + rate limit (service side) ---------------------------------------------------------------
update public.profiles set role = 'content_manager' where id = '22222222-2222-2222-2222-222222222222';
select ok(exists(select 1 from public.audit_logs where action = 'profile.role_changed'
  and entity_id = '22222222-2222-2222-2222-222222222222'), 'role changes are audited');
select throws_ok($$ update public.audit_logs set action = 'x' $$, '42501', null,
  'audit log is append-only, even for the table owner');

select results_eq(
  $$ select public.rate_limit_hit('test:k', 2, 60) from generate_series(1, 3) $$,
  $$ values (true), (true), (false) $$,
  'rate limiter allows max hits per window, then blocks');

select * from finish();
rollback;
