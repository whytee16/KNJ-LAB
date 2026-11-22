-- Stage 5a: labs. Models live in code (packages/physics, keyed by labs.code); the database holds
-- the lab registry, texts, links to topics and question templates, and students' sessions.
-- See DATABASE.md §7 and ADR-0008.
--
-- Rules:
--   * Lab rows are registered by migrations only (a lab without a model in code cannot run);
--     staff edit texts, default parameters, the free-demo flag and links; reviewers publish.
--   * Questions are published task templates linked through lab_tasks; they are issued and
--     checked by the stage 4 engine (attempt kind 'lab'), so answer keys never reach the client.
--   * Sessions and lab attempts are written by the server; a lab that is not a free demo
--     requires an active pass — enforced by a trigger even for the service role.

create type public.lab_kind as enum ('physics', 'geometry2d', 'geometry3d');
-- The new value is used only after this migration commits (checks below compare as text).
alter type public.attempt_kind add value if not exists 'lab';

-- ---------------------------------------------------------------------------------------------
-- Labs
-- ---------------------------------------------------------------------------------------------
create table public.labs (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(code) <= 60),
  subject_code text not null references public.subjects (code),
  kind public.lab_kind not null,
  grade_from smallint not null default 7 check (grade_from between 7 and 11),
  -- Validated against the model ranges by the server (packages/physics parseParams).
  default_params jsonb not null default '{}'::jsonb check (jsonb_typeof(default_params) = 'object'),
  is_free_demo boolean not null default false,
  status public.formula_status not null default 'draft',
  sort smallint not null default 0,
  reviewed_by uuid references public.profiles (id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger labs_touch before update on public.labs
  for each row execute function private.touch_updated_at();

create table public.lab_translations (
  lab_id uuid not null references public.labs (id) on delete cascade,
  locale public.app_locale not null,
  title text not null check (char_length(title) between 1 and 150),
  goal text not null default '' check (char_length(goal) <= 1000),
  steps text[] not null default '{}' check (cardinality(steps) <= 12),
  hints text[] not null default '{}' check (cardinality(hints) <= 10),
  translation_status public.draft_status not null default 'draft',
  primary key (lab_id, locale)
);

create table public.lab_topics (
  lab_id uuid not null references public.labs (id) on delete cascade,
  topic_id uuid not null references public.topics (id) on delete cascade,
  primary key (lab_id, topic_id)
);
create index lab_topics_topic on public.lab_topics (topic_id);

create table public.lab_tasks (
  lab_id uuid not null references public.labs (id) on delete cascade,
  -- restrict: a template used as a lab question cannot silently disappear
  template_id uuid not null references public.task_templates (id) on delete restrict,
  position smallint not null default 0,
  primary key (lab_id, template_id)
);

-- Lab questions are attempts of kind 'lab'.
alter table public.attempts add column lab_id uuid references public.labs (id) on delete restrict;
alter table public.attempts add constraint attempts_lab_kind check ((kind::text = 'lab') = (lab_id is not null));
create index attempts_lab on public.attempts (student_id, lab_id) where lab_id is not null;

create table public.lab_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  lab_id uuid not null references public.labs (id) on delete restrict,
  params jsonb not null default '{}'::jsonb check (jsonb_typeof(params) = 'object'),
  -- {"correct": n, "total": m} — summary of the questions answered in this session
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  duration_s integer not null default 0 check (duration_s between 0 and 86400),
  attempt_id uuid references public.attempts (id) on delete set null,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lab_sessions_student on public.lab_sessions (student_id, updated_at desc);
create trigger lab_sessions_touch before update on public.lab_sessions
  for each row execute function private.touch_updated_at();

/** Students only; published labs only; non-demo labs need an active pass. */
create function private.lab_use_guard()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  l public.labs;
begin
  if tg_table_name = 'attempts' and new.lab_id is null then
    return new;
  end if;
  select * into l from public.labs where id = new.lab_id;
  if l.status <> 'published' then
    raise exception 'lab is not published' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.profiles where id = new.student_id and role = 'student') then
    raise exception 'labs are saved for students only' using errcode = 'check_violation';
  end if;
  if not l.is_free_demo and not private.has_entitlement(new.student_id) then
    raise exception 'an active pass is required for this lab' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;
create trigger lab_sessions_guard before insert on public.lab_sessions
  for each row execute function private.lab_use_guard();
create trigger attempts_lab_guard before insert on public.attempts
  for each row execute function private.lab_use_guard();

-- ---------------------------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------------------------
create function public.set_lab_status(p_lab uuid, p_status public.formula_status)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if p_status = 'published' and not private.reviewer_aal2() then
    raise exception 'reviewer with a second factor required' using errcode = 'insufficient_privilege';
  end if;
  if p_status = 'published' and not exists (
    select 1 from public.lab_translations where lab_id = p_lab and locale = 'ru' and btrim(goal) <> ''
  ) then
    raise exception 'a Russian title and goal are required before publishing' using errcode = 'check_violation';
  end if;
  perform private.set_content_status('labs', p_lab, p_status);
end $$;
revoke all on function public.set_lab_status(uuid, public.formula_status) from public, anon;
grant execute on function public.set_lab_status(uuid, public.formula_status) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Registry: the reference lab of the template (texts are written by methodologists in Studio).
-- ---------------------------------------------------------------------------------------------
insert into public.labs (code, subject_code, kind, grade_from, default_params, is_free_demo, sort)
values ('uniform-motion', 'physics', 'physics', 7, '{"v": 5, "t": 10, "x0": 0}', true, 10);

-- ---------------------------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------------------------
revoke all on public.labs, public.lab_translations, public.lab_topics, public.lab_tasks, public.lab_sessions
  from anon, authenticated;
grant select on public.labs, public.lab_translations, public.lab_topics, public.lab_tasks to anon, authenticated;
-- No insert/delete on labs: rows come with their models through migrations.
grant update (default_params, is_free_demo, grade_from, sort) on public.labs to authenticated;
grant insert, update, delete on public.lab_translations, public.lab_topics, public.lab_tasks to authenticated;
grant select on public.lab_sessions to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------------------------
alter table public.labs enable row level security;
alter table public.lab_translations enable row level security;
alter table public.lab_topics enable row level security;
alter table public.lab_tasks enable row level security;
alter table public.lab_sessions enable row level security;

create policy labs_read on public.labs for select to anon, authenticated
  using (status = 'published' or private.is_staff());
create policy labs_update on public.labs for update to authenticated
  using ((private.staff_aal2() and status = 'draft') or private.reviewer_aal2())
  with check ((private.staff_aal2() and status = 'draft') or private.reviewer_aal2());

create function private.lab_visible(p_lab uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.labs l where l.id = p_lab and (l.status = 'published' or private.is_staff()))
$$;
create function private.lab_editable(p_lab uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.labs l where l.id = p_lab
                 and ((private.staff_aal2() and l.status = 'draft') or private.reviewer_aal2()))
$$;
revoke all on function private.lab_visible(uuid), private.lab_editable(uuid) from public;
grant execute on function private.lab_visible(uuid), private.lab_editable(uuid) to anon, authenticated;

create policy lab_translations_read on public.lab_translations for select to anon, authenticated
  using (private.lab_visible(lab_id));
create policy lab_translations_write on public.lab_translations for all to authenticated
  using (private.lab_editable(lab_id)) with check (private.lab_editable(lab_id));

create policy lab_topics_read on public.lab_topics for select to anon, authenticated
  using (private.lab_visible(lab_id));
create policy lab_topics_write on public.lab_topics for all to authenticated
  using (private.lab_editable(lab_id)) with check (private.lab_editable(lab_id));

create policy lab_tasks_read on public.lab_tasks for select to anon, authenticated
  using (private.lab_visible(lab_id));
create policy lab_tasks_write on public.lab_tasks for all to authenticated
  using (private.lab_editable(lab_id)) with check (private.lab_editable(lab_id));

create policy lab_sessions_read on public.lab_sessions for select to authenticated
  using (student_id = (select auth.uid()) or private.is_parent_of(student_id));
