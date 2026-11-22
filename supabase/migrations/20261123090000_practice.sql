-- Stage 4: task templates, task instances with server-only answer keys, trainer runs, tests,
-- attempts and answers, entitlements (passes), content error reports. See DATABASE.md §5.
--
-- Rules:
--   * Expected answers live in task_instance_keys, which no client role can read.
--   * Instances, answers and runs are written by the server (service role) after authorization;
--     students and their parents only read them.
--   * Paid difficulty levels require an active entitlement — enforced by a trigger even for the
--     service role.

-- ---------------------------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------------------------
create type public.difficulty as enum ('easy', 'medium', 'sufficient', 'hard');
create type public.task_type as enum ('single_choice', 'multi_choice', 'number', 'formula', 'cloze_word', 'matching', 'ordering');
create type public.test_scope as enum ('topic', 'section', 'quarter', 'grade', 'subject');
create type public.test_mode as enum ('practice', 'exam');
create type public.attempt_kind as enum ('trainer', 'test');
create type public.answer_status as enum ('correct', 'wrong');
create type public.report_status as enum ('open', 'resolved', 'rejected');

-- ---------------------------------------------------------------------------------------------
-- Entitlements (passes). Stage 4: granted manually by admins; stage 7: created by payments.
-- ---------------------------------------------------------------------------------------------
create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  source text not null default 'manual' check (source in ('manual', 'order')),
  granted_by uuid references public.profiles (id) on delete set null,
  reason text check (char_length(reason) <= 500),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index entitlements_student on public.entitlements (student_id, ends_at desc);

create function private.has_entitlement(p_student uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.entitlements e
    where e.student_id = p_student and e.revoked_at is null
      and e.starts_at <= now() and e.ends_at > now()
  )
$$;
revoke all on function private.has_entitlement(uuid) from public;
grant execute on function private.has_entitlement(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- Task templates
-- ---------------------------------------------------------------------------------------------
create table public.task_templates (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics (id) on delete cascade,
  type public.task_type not null,
  difficulty public.difficulty not null,
  spec jsonb not null check (jsonb_typeof(spec) = 'object' and spec ->> 'type' = type::text),
  status public.formula_status not null default 'draft',
  version integer not null default 1,
  created_by uuid references public.profiles (id) on delete set null,
  reviewed_by uuid references public.profiles (id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index task_templates_pick on public.task_templates (topic_id, difficulty, status);

create table public.task_template_texts (
  template_id uuid not null references public.task_templates (id) on delete cascade,
  locale public.app_locale not null,
  -- {statement, options[], matches[], accepted[], hints[], solution}; shape checked by packages/task-engine
  texts jsonb not null check (jsonb_typeof(texts) = 'object' and texts ? 'statement'),
  primary key (template_id, locale)
);

/** Any change of a template or its texts bumps the version; issued instances keep theirs. */
create function private.task_template_bump()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_table_name = 'task_templates' then
    new.updated_at := now();
    if (new.spec, new.type, new.difficulty, new.topic_id) is distinct from (old.spec, old.type, old.difficulty, old.topic_id) then
      new.version := old.version + 1;
    end if;
    return new;
  end if;
  update public.task_templates set version = version + 1, updated_at = now()
   where id = coalesce(new.template_id, old.template_id);
  return coalesce(new, old);
end $$;
create trigger task_templates_bump before update on public.task_templates
  for each row execute function private.task_template_bump();
create trigger task_template_texts_bump after insert or update or delete on public.task_template_texts
  for each row execute function private.task_template_bump();

-- ---------------------------------------------------------------------------------------------
-- Tests (assembled from published templates of a curriculum scope)
-- ---------------------------------------------------------------------------------------------
create table public.tests (
  id uuid primary key default gen_random_uuid(),
  scope public.test_scope not null,
  topic_id uuid references public.topics (id) on delete cascade,
  section_id uuid references public.curriculum_sections (id) on delete cascade,
  subject_code text references public.subjects (code),
  grade smallint check (grade between 7 and 11),
  quarter smallint check (quarter between 1 and 4),
  mode public.test_mode not null default 'practice',
  time_limit_s integer check (time_limit_s between 60 and 14400),
  counts jsonb not null default '{"easy": 5}'::jsonb check (jsonb_typeof(counts) = 'object'),
  status public.formula_status not null default 'draft',
  created_by uuid references public.profiles (id) on delete set null,
  reviewed_by uuid references public.profiles (id) on delete set null,
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  check (
    (scope = 'topic' and topic_id is not null) or
    (scope = 'section' and section_id is not null) or
    (scope = 'quarter' and subject_code is not null and grade is not null and quarter is not null) or
    (scope = 'grade' and subject_code is not null and grade is not null) or
    (scope = 'subject' and subject_code is not null)
  ),
  check (mode = 'practice' or time_limit_s is not null)
);
create trigger tests_touch before update on public.tests
  for each row execute function private.touch_updated_at();

create table public.test_texts (
  test_id uuid not null references public.tests (id) on delete cascade,
  locale public.app_locale not null,
  title text not null check (char_length(title) between 1 and 150),
  description text not null default '' check (char_length(description) <= 1000),
  primary key (test_id, locale)
);

-- ---------------------------------------------------------------------------------------------
-- Practice: runs, attempts, instances, keys, answers, reports
-- ---------------------------------------------------------------------------------------------
create table public.trainer_runs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  topic_id uuid not null references public.topics (id) on delete cascade,
  difficulty public.difficulty not null,
  target smallint not null default 100 check (target between 1 and 500),
  solved integer not null default 0,
  correct integer not null default 0,
  status text not null default 'active' check (status in ('active', 'finished')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  last_activity_at timestamptz not null default now()
);
create unique index trainer_runs_one_active on public.trainer_runs (student_id, topic_id, difficulty) where status = 'active';

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  kind public.attempt_kind not null,
  trainer_run_id uuid references public.trainer_runs (id) on delete cascade,
  test_id uuid references public.tests (id) on delete set null,
  started_at timestamptz not null default now(),
  deadline_at timestamptz,
  finished_at timestamptz,
  score numeric(8, 2),
  max_score numeric(8, 2),
  check ((kind = 'trainer') = (trainer_run_id is not null))
);
create index attempts_student on public.attempts (student_id, started_at desc);

create table public.task_instances (
  id uuid primary key default gen_random_uuid(),
  -- restrict: deleting a template must never erase students' history
  template_id uuid not null references public.task_templates (id) on delete restrict,
  template_version integer not null,
  student_id uuid not null references public.profiles (id) on delete cascade,
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  position smallint not null default 0,
  seed integer not null,
  locale public.app_locale not null,
  params jsonb not null default '{}'::jsonb,
  prompt jsonb not null,
  created_at timestamptz not null default now()
);
create index task_instances_attempt on public.task_instances (attempt_id, position);

create table public.task_instance_keys (
  instance_id uuid primary key references public.task_instances (id) on delete cascade,
  expected jsonb not null,
  solution text not null default ''
);
comment on table public.task_instance_keys is 'Expected answers. No client role has any privilege on this table.';

create table public.attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  instance_id uuid not null unique references public.task_instances (id) on delete cascade,
  answer jsonb not null,
  status public.answer_status not null,
  score numeric(4, 3) not null check (score between 0 and 1),
  time_ms integer check (time_ms between 0 and 86400000),
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now()
);
create index attempt_answers_attempt on public.attempt_answers (attempt_id);

create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null,
  instance_id uuid references public.task_instances (id) on delete set null,
  template_id uuid references public.task_templates (id) on delete cascade,
  message text not null check (char_length(message) between 1 and 2000),
  status public.report_status not null default 'open',
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index content_reports_open on public.content_reports (status, created_at desc);

/** Paid levels need an active pass — enforced here even for the service role. */
create function private.task_instance_guard()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  t public.task_templates;
begin
  select * into t from public.task_templates where id = new.template_id;
  if t.status <> 'published' then
    raise exception 'template is not published' using errcode = 'check_violation';
  end if;
  if t.difficulty <> 'easy' and not private.has_entitlement(new.student_id) then
    raise exception 'an active pass is required for this level' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;
create trigger task_instances_guard before insert on public.task_instances
  for each row execute function private.task_instance_guard();

-- ---------------------------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------------------------
create function public.grant_entitlement(p_student uuid, p_days integer, p_reason text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_start timestamptz;
  v_id uuid;
begin
  if not (private.is_admin() and private.has_aal2()) then
    raise exception 'admin with a second factor required' using errcode = 'insufficient_privilege';
  end if;
  if p_days not between 1 and 400 then
    raise exception 'days must be between 1 and 400' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.profiles where id = p_student and role = 'student') then
    raise exception 'passes are granted to students' using errcode = 'check_violation';
  end if;
  -- A new pass continues an active one instead of overlapping it.
  select greatest(now(), coalesce(max(ends_at), now())) into v_start
    from public.entitlements where student_id = p_student and revoked_at is null and ends_at > now();
  insert into public.entitlements (student_id, starts_at, ends_at, source, granted_by, reason)
  values (p_student, v_start, v_start + make_interval(days => p_days), 'manual', auth.uid(), left(btrim(p_reason), 500))
  returning id into v_id;
  perform public.write_audit(auth.uid(), 'entitlement.granted', 'profile', p_student::text,
    jsonb_build_object('entitlement', v_id, 'days', p_days));
  return v_id;
end $$;

create function public.revoke_entitlement(p_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_student uuid;
begin
  if not (private.is_admin() and private.has_aal2()) then
    raise exception 'admin with a second factor required' using errcode = 'insufficient_privilege';
  end if;
  update public.entitlements set revoked_at = now() where id = p_id and revoked_at is null returning student_id into v_student;
  if v_student is null then
    raise exception 'no active pass with this id' using errcode = 'no_data_found';
  end if;
  perform public.write_audit(auth.uid(), 'entitlement.revoked', 'profile', v_student::text, jsonb_build_object('entitlement', p_id));
end $$;

/** Same workflow as formulas: managers submit drafts, reviewers publish or return. */
create function private.set_content_status(p_table text, p_id uuid, p_status public.formula_status)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_old public.formula_status;
begin
  execute format('select status from public.%I where id = $1 for update', p_table) into v_old using p_id;
  if v_old is null then
    raise exception 'not found' using errcode = 'no_data_found';
  end if;
  if p_status = 'in_review' and v_old = 'draft' then
    if not private.staff_aal2() then
      raise exception 'staff with a second factor required' using errcode = 'insufficient_privilege';
    end if;
  elsif not private.reviewer_aal2() then
    raise exception 'reviewer with a second factor required' using errcode = 'insufficient_privilege';
  end if;
  execute format(
    'update public.%I set status = $2, published_at = case when $2 = ''published'' then now() else published_at end,
            reviewed_by = case when $2 <> ''in_review'' then auth.uid() else reviewed_by end where id = $1', p_table)
  using p_id, p_status;
  perform public.write_audit(auth.uid(), p_table || '.status', p_table, p_id::text, jsonb_build_object('from', v_old, 'to', p_status));
end $$;
revoke all on function private.set_content_status(text, uuid, public.formula_status) from public;

create function public.set_task_template_status(p_template uuid, p_status public.formula_status)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if p_status = 'published' and not exists (select 1 from public.task_template_texts where template_id = p_template and locale = 'ru') then
    raise exception 'Russian texts are required before publishing' using errcode = 'check_violation';
  end if;
  perform private.set_content_status('task_templates', p_template, p_status);
end $$;

create function public.set_test_status(p_test uuid, p_status public.formula_status)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if p_status = 'published' and not exists (select 1 from public.test_texts where test_id = p_test and locale = 'ru') then
    raise exception 'a Russian title is required before publishing' using errcode = 'check_violation';
  end if;
  perform private.set_content_status('tests', p_test, p_status);
end $$;

/** Atomic trainer progress after a first-time answer; finishes the run at the target. Server-only. */
create function public.record_trainer_answer(p_run uuid, p_correct boolean)
returns public.trainer_runs language plpgsql security definer set search_path = ''
as $$
declare
  r public.trainer_runs;
begin
  update public.trainer_runs
     set solved = solved + 1,
         correct = correct + case when p_correct then 1 else 0 end,
         last_activity_at = now(),
         status = case when solved + 1 >= target then 'finished' else status end,
         finished_at = case when solved + 1 >= target then now() else finished_at end
   where id = p_run and status = 'active'
  returning * into r;
  if r.status = 'finished' then
    update public.attempts set finished_at = now(), score = r.correct, max_score = r.solved
     where trainer_run_id = p_run and finished_at is null;
  end if;
  return r;
end $$;
revoke all on function public.record_trainer_answer(uuid, boolean) from public, anon, authenticated;
grant execute on function public.record_trainer_answer(uuid, boolean) to service_role;

revoke all on function public.grant_entitlement(uuid, integer, text) from public, anon;
revoke all on function public.revoke_entitlement(uuid) from public, anon;
revoke all on function public.set_task_template_status(uuid, public.formula_status) from public, anon;
revoke all on function public.set_test_status(uuid, public.formula_status) from public, anon;
grant execute on function public.grant_entitlement(uuid, integer, text) to authenticated;
grant execute on function public.revoke_entitlement(uuid) to authenticated;
grant execute on function public.set_task_template_status(uuid, public.formula_status) to authenticated;
grant execute on function public.set_test_status(uuid, public.formula_status) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------------------------
revoke all on public.entitlements, public.task_templates, public.task_template_texts, public.tests,
  public.test_texts, public.trainer_runs, public.attempts, public.task_instances, public.task_instance_keys,
  public.attempt_answers, public.content_reports from anon, authenticated;

grant select on public.task_templates, public.task_template_texts, public.tests, public.test_texts to anon, authenticated;
grant insert, delete on public.task_templates, public.tests to authenticated;
grant update (topic_id, type, difficulty, spec) on public.task_templates to authenticated;
grant update (scope, topic_id, section_id, subject_code, grade, quarter, mode, time_limit_s, counts) on public.tests to authenticated;
grant insert, update, delete on public.task_template_texts, public.test_texts to authenticated;
grant select on public.entitlements, public.trainer_runs, public.attempts, public.task_instances, public.attempt_answers to authenticated;
grant select, update (status, resolved_by, resolved_at) on public.content_reports to authenticated;
-- task_instance_keys: intentionally no grants for anon/authenticated.

-- ---------------------------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------------------------
alter table public.entitlements enable row level security;
alter table public.task_templates enable row level security;
alter table public.task_template_texts enable row level security;
alter table public.tests enable row level security;
alter table public.test_texts enable row level security;
alter table public.trainer_runs enable row level security;
alter table public.attempts enable row level security;
alter table public.task_instances enable row level security;
alter table public.task_instance_keys enable row level security;
alter table public.attempt_answers enable row level security;
alter table public.content_reports enable row level security;

create policy entitlements_read on public.entitlements for select to authenticated
  using (student_id = (select auth.uid()) or private.is_parent_of(student_id) or private.is_admin());

create policy task_templates_read on public.task_templates for select to anon, authenticated
  using (status = 'published' or private.is_staff());
create policy task_templates_insert on public.task_templates for insert to authenticated
  with check (private.staff_aal2() and status = 'draft' and created_by = (select auth.uid()));
create policy task_templates_update on public.task_templates for update to authenticated
  using ((private.staff_aal2() and status = 'draft') or private.reviewer_aal2())
  with check ((private.staff_aal2() and status = 'draft') or private.reviewer_aal2());
create policy task_templates_delete on public.task_templates for delete to authenticated
  using ((private.staff_aal2() and status = 'draft') or private.reviewer_aal2());

create policy task_template_texts_read on public.task_template_texts for select to anon, authenticated
  using (exists (select 1 from public.task_templates t where t.id = template_id and (t.status = 'published' or private.is_staff())));
create policy task_template_texts_write on public.task_template_texts for all to authenticated
  using (exists (select 1 from public.task_templates t where t.id = template_id
                 and ((private.staff_aal2() and t.status = 'draft') or private.reviewer_aal2())))
  with check (exists (select 1 from public.task_templates t where t.id = template_id
                 and ((private.staff_aal2() and t.status = 'draft') or private.reviewer_aal2())));

create policy tests_read on public.tests for select to anon, authenticated
  using (status = 'published' or private.is_staff());
create policy tests_insert on public.tests for insert to authenticated
  with check (private.staff_aal2() and status = 'draft' and created_by = (select auth.uid()));
create policy tests_update on public.tests for update to authenticated
  using ((private.staff_aal2() and status = 'draft') or private.reviewer_aal2())
  with check ((private.staff_aal2() and status = 'draft') or private.reviewer_aal2());
create policy tests_delete on public.tests for delete to authenticated
  using ((private.staff_aal2() and status = 'draft') or private.reviewer_aal2());

create policy test_texts_read on public.test_texts for select to anon, authenticated
  using (exists (select 1 from public.tests t where t.id = test_id and (t.status = 'published' or private.is_staff())));
create policy test_texts_write on public.test_texts for all to authenticated
  using (exists (select 1 from public.tests t where t.id = test_id
                 and ((private.staff_aal2() and t.status = 'draft') or private.reviewer_aal2())))
  with check (exists (select 1 from public.tests t where t.id = test_id
                 and ((private.staff_aal2() and t.status = 'draft') or private.reviewer_aal2())));

-- Students see their own practice; parents see their children's.
create policy trainer_runs_read on public.trainer_runs for select to authenticated
  using (student_id = (select auth.uid()) or private.is_parent_of(student_id));
create policy attempts_read on public.attempts for select to authenticated
  using (student_id = (select auth.uid()) or private.is_parent_of(student_id));
create policy task_instances_read on public.task_instances for select to authenticated
  using (student_id = (select auth.uid()) or private.is_parent_of(student_id));
create policy attempt_answers_read on public.attempt_answers for select to authenticated
  using (exists (select 1 from public.attempts a where a.id = attempt_id
                 and (a.student_id = (select auth.uid()) or private.is_parent_of(a.student_id))));

create policy content_reports_staff_read on public.content_reports for select to authenticated
  using (private.is_staff());
create policy content_reports_staff_update on public.content_reports for update to authenticated
  using (private.staff_aal2()) with check (private.staff_aal2());
