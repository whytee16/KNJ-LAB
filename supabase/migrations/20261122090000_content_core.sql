-- Stage 3: content core — subjects, editable curricula (KTP), topics with draft/published split,
-- reference formulas, favorites, staff roles and MFA-gated staff writes.
-- See DATABASE.md §3–4 and SECURITY.md §3–4.
--
-- Rules:
--   * Students and anonymous visitors only ever read published content.
--   * Staff writes require a second factor (JWT aal = aal2), checked in RLS and in functions.
--   * Published topic texts change only through publish_topic() (reviewer/admin).

-- ---------------------------------------------------------------------------------------------
-- Role helpers
-- ---------------------------------------------------------------------------------------------
create function private.has_aal2()
returns boolean
language sql stable set search_path = ''
as $$ select coalesce(auth.jwt() ->> 'aal', '') = 'aal2' $$;

create function private.is_staff()
returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(private.current_app_role() in ('content_manager', 'reviewer', 'admin'), false) $$;

create function private.can_review()
returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(private.current_app_role() in ('reviewer', 'admin'), false) $$;

/** Staff member acting with a verified second factor. */
create function private.staff_aal2()
returns boolean
language sql stable security definer set search_path = ''
as $$ select private.is_staff() and private.has_aal2() $$;

create function private.reviewer_aal2()
returns boolean
language sql stable security definer set search_path = ''
as $$ select private.can_review() and private.has_aal2() $$;

do $$
declare f text;
begin
  foreach f in array array['has_aal2()', 'is_staff()', 'can_review()', 'staff_aal2()', 'reviewer_aal2()'] loop
    execute format('revoke all on function private.%s from public', f);
    execute format('grant execute on function private.%s to authenticated, service_role', f);
  end loop;
end $$;

-- Public read policies call is_staff(); for anonymous visitors it is always false.
grant usage on schema private to anon;
grant execute on function private.is_staff() to anon;

-- ---------------------------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------------------------
create type public.draft_status as enum ('draft', 'in_review', 'approved');
create type public.formula_status as enum ('draft', 'in_review', 'published');

-- ---------------------------------------------------------------------------------------------
-- Subjects (reference data, not user content)
-- ---------------------------------------------------------------------------------------------
create table public.subjects (
  code text primary key check (code ~ '^[a-z_]{3,32}$'),
  sort smallint not null default 0
);

create table public.subject_translations (
  subject_code text not null references public.subjects (code) on delete cascade,
  locale public.app_locale not null,
  name text not null check (char_length(name) between 1 and 60),
  primary key (subject_code, locale)
);

insert into public.subjects (code, sort) values ('algebra', 1), ('geometry', 2), ('physics', 3);
insert into public.subject_translations (subject_code, locale, name) values
  ('algebra', 'ru', 'Алгебра'), ('algebra', 'kk', 'Алгебра'),
  ('geometry', 'ru', 'Геометрия'), ('geometry', 'kk', 'Геометрия'),
  ('physics', 'ru', 'Физика'), ('physics', 'kk', 'Физика');

-- ---------------------------------------------------------------------------------------------
-- Curricula (KTP). The distribution of topics is entered by staff; nothing is pre-filled.
-- Fixed shape: curriculum → (subject, grade, quarter 1–4) → section → topics.
-- ---------------------------------------------------------------------------------------------
create table public.curricula (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9-]{2,40}$'),
  academic_year text check (academic_year ~ '^\d{4}-\d{4}$'),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index curricula_single_default on public.curricula (is_default) where is_default;

create table public.curriculum_translations (
  curriculum_id uuid not null references public.curricula (id) on delete cascade,
  locale public.app_locale not null,
  title text not null check (char_length(title) between 1 and 120),
  primary key (curriculum_id, locale)
);

insert into public.curricula (code, is_default) values ('default', true);
insert into public.curriculum_translations (curriculum_id, locale, title)
select id, 'ru'::public.app_locale, 'Основная программа' from public.curricula where code = 'default'
union all
select id, 'kk'::public.app_locale, 'Негізгі бағдарлама' from public.curricula where code = 'default';

create table public.curriculum_sections (
  id uuid primary key default gen_random_uuid(),
  curriculum_id uuid not null references public.curricula (id) on delete cascade,
  subject_code text not null references public.subjects (code),
  grade smallint not null check (grade between 7 and 11),
  quarter smallint not null check (quarter between 1 and 4),
  sort integer not null default 0,
  created_at timestamptz not null default now()
);
create index curriculum_sections_lookup on public.curriculum_sections (curriculum_id, subject_code, grade, quarter, sort);

create table public.curriculum_section_translations (
  section_id uuid not null references public.curriculum_sections (id) on delete cascade,
  locale public.app_locale not null,
  title text not null check (char_length(title) between 1 and 150),
  primary key (section_id, locale)
);

-- ---------------------------------------------------------------------------------------------
-- Topics: stable identity + published content + editable drafts, per locale.
-- ---------------------------------------------------------------------------------------------
create table public.topics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  subject_code text not null references public.subjects (code),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger topics_touch before update on public.topics
  for each row execute function private.touch_updated_at();

create table public.curriculum_topics (
  section_id uuid not null references public.curriculum_sections (id) on delete cascade,
  topic_id uuid not null references public.topics (id) on delete cascade,
  sort integer not null default 0,
  primary key (section_id, topic_id)
);
create index curriculum_topics_topic on public.curriculum_topics (topic_id);

-- Shared limits for topic texts (also enforced by Zod in packages/content-schema).
create function private.valid_topic_text(
  p_title text, p_summary text, p_objectives text[], p_theory text, p_mistakes text[]
)
returns boolean language sql immutable set search_path = ''
as $$
  select char_length(p_title) between 1 and 150
     and char_length(p_summary) <= 500
     and char_length(p_theory) <= 60000
     and coalesce(array_length(p_objectives, 1), 0) <= 20
     and coalesce(array_length(p_mistakes, 1), 0) <= 20
$$;

create table public.topic_contents (
  topic_id uuid not null references public.topics (id) on delete cascade,
  locale public.app_locale not null,
  title text not null,
  summary text not null default '',
  objectives text[] not null default '{}',
  theory text not null,
  mistakes text[] not null default '{}',
  version integer not null default 1,
  published_at timestamptz not null default now(),
  published_by uuid references public.profiles (id) on delete set null,
  primary key (topic_id, locale),
  check (private.valid_topic_text(title, summary, objectives, theory, mistakes) and char_length(theory) > 0)
);
comment on table public.topic_contents is 'Published topic texts. Written only by publish_topic().';

create table public.topic_drafts (
  topic_id uuid not null references public.topics (id) on delete cascade,
  locale public.app_locale not null,
  title text not null,
  summary text not null default '',
  objectives text[] not null default '{}',
  theory text not null default '',
  mistakes text[] not null default '{}',
  status public.draft_status not null default 'draft',
  is_machine_translation boolean not null default false,
  review_note text check (char_length(review_note) <= 2000),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  primary key (topic_id, locale),
  check (private.valid_topic_text(title, summary, objectives, theory, mistakes))
);
create index topic_drafts_status on public.topic_drafts (status, submitted_at);

/** Any content change sends the draft back to 'draft' (an approved text must be re-reviewed). */
create function private.topic_draft_changed()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  if tg_op = 'UPDATE' and (
       new.title, new.summary, new.objectives, new.theory, new.mistakes, new.is_machine_translation
     ) is distinct from (
       old.title, old.summary, old.objectives, old.theory, old.mistakes, old.is_machine_translation
     ) then
    new.status := 'draft';
    new.submitted_at := null;
  end if;
  return new;
end $$;
create trigger topic_drafts_changed before insert or update on public.topic_drafts
  for each row execute function private.topic_draft_changed();

-- ---------------------------------------------------------------------------------------------
-- Reference formulas. Content managers edit drafts; reviewers publish and may correct later.
-- ---------------------------------------------------------------------------------------------
create table public.formulas (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(code) <= 80),
  subject_code text not null references public.subjects (code),
  grade_from smallint not null check (grade_from between 7 and 11),
  grade_to smallint not null check (grade_to between 7 and 11),
  latex text not null check (char_length(latex) between 1 and 500),
  status public.formula_status not null default 'draft',
  created_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  check (grade_from <= grade_to)
);
create index formulas_filter on public.formulas (status, subject_code, grade_from, grade_to);
create trigger formulas_touch before update on public.formulas
  for each row execute function private.touch_updated_at();

create table public.formula_translations (
  formula_id uuid not null references public.formulas (id) on delete cascade,
  locale public.app_locale not null,
  name text not null check (char_length(name) between 1 and 150),
  description text not null default '' check (char_length(description) <= 1000),
  -- [{ "symbol": "I", "meaning": "сила тока", "unit": "А" }]
  variables jsonb not null default '[]'::jsonb check (jsonb_typeof(variables) = 'array'),
  primary key (formula_id, locale)
);
create extension if not exists pg_trgm with schema extensions;
create index formula_translations_search on public.formula_translations
  using gin ((name || ' ' || description) extensions.gin_trgm_ops);

create table public.favorites (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  formula_id uuid not null references public.formulas (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, formula_id)
);

-- ---------------------------------------------------------------------------------------------
-- Workflow functions (security definer; check role and second factor themselves)
-- ---------------------------------------------------------------------------------------------
create function public.submit_topic_draft(p_topic uuid, p_locale public.app_locale)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not private.staff_aal2() then
    raise exception 'staff with a second factor required' using errcode = 'insufficient_privilege';
  end if;
  update public.topic_drafts
     set status = 'in_review', submitted_at = now(), review_note = null
   where topic_id = p_topic and locale = p_locale and status = 'draft'
     and char_length(btrim(theory)) > 0;
  if not found then
    raise exception 'only a non-empty draft can be submitted' using errcode = 'check_violation';
  end if;
  perform public.write_audit(auth.uid(), 'topic.submitted', 'topic', p_topic::text,
    jsonb_build_object('locale', p_locale));
end $$;

create function public.request_topic_changes(p_topic uuid, p_locale public.app_locale, p_note text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not private.reviewer_aal2() then
    raise exception 'reviewer with a second factor required' using errcode = 'insufficient_privilege';
  end if;
  update public.topic_drafts
     set status = 'draft', review_note = left(btrim(p_note), 2000), submitted_at = null,
         reviewed_by = auth.uid(), reviewed_at = now()
   where topic_id = p_topic and locale = p_locale and status = 'in_review';
  if not found then
    raise exception 'draft is not in review' using errcode = 'check_violation';
  end if;
  perform public.write_audit(auth.uid(), 'topic.changes_requested', 'topic', p_topic::text,
    jsonb_build_object('locale', p_locale));
end $$;

create function public.publish_topic(p_topic uuid, p_locale public.app_locale)
returns integer language plpgsql security definer set search_path = ''
as $$
declare
  d public.topic_drafts;
  v_version integer;
begin
  if not private.reviewer_aal2() then
    raise exception 'reviewer with a second factor required' using errcode = 'insufficient_privilege';
  end if;
  select * into d from public.topic_drafts where topic_id = p_topic and locale = p_locale for update;
  if d is null or d.status <> 'in_review' then
    raise exception 'draft is not in review' using errcode = 'check_violation';
  end if;

  insert into public.topic_contents as c
    (topic_id, locale, title, summary, objectives, theory, mistakes, version, published_at, published_by)
  values (p_topic, p_locale, d.title, d.summary, d.objectives, d.theory, d.mistakes, 1, now(), auth.uid())
  on conflict (topic_id, locale) do update
    set title = excluded.title, summary = excluded.summary, objectives = excluded.objectives,
        theory = excluded.theory, mistakes = excluded.mistakes, version = c.version + 1,
        published_at = now(), published_by = auth.uid()
  returning version into v_version;

  update public.topic_drafts
     set status = 'approved', review_note = null, reviewed_by = auth.uid(), reviewed_at = now()
   where topic_id = p_topic and locale = p_locale;

  perform public.write_audit(auth.uid(), 'topic.published', 'topic', p_topic::text,
    jsonb_build_object('locale', p_locale, 'version', v_version));
  return v_version;
end $$;

create function public.unpublish_topic(p_topic uuid, p_locale public.app_locale)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not private.reviewer_aal2() then
    raise exception 'reviewer with a second factor required' using errcode = 'insufficient_privilege';
  end if;
  delete from public.topic_contents where topic_id = p_topic and locale = p_locale;
  perform public.write_audit(auth.uid(), 'topic.unpublished', 'topic', p_topic::text,
    jsonb_build_object('locale', p_locale));
end $$;

create function public.set_formula_status(p_formula uuid, p_status public.formula_status)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_old public.formula_status;
begin
  select status into v_old from public.formulas where id = p_formula for update;
  if v_old is null then
    raise exception 'formula not found' using errcode = 'no_data_found';
  end if;
  -- Content managers may only submit their drafts; everything else needs a reviewer.
  if p_status = 'in_review' and v_old = 'draft' then
    if not private.staff_aal2() then
      raise exception 'staff with a second factor required' using errcode = 'insufficient_privilege';
    end if;
  elsif not private.reviewer_aal2() then
    raise exception 'reviewer with a second factor required' using errcode = 'insufficient_privilege';
  end if;
  if p_status = 'published' and not exists (
    select 1 from public.formula_translations t where t.formula_id = p_formula and t.locale = 'ru'
  ) then
    raise exception 'a Russian name is required before publishing' using errcode = 'check_violation';
  end if;

  update public.formulas
     set status = p_status,
         published_at = case when p_status = 'published' then now() else published_at end,
         reviewed_by = case when p_status in ('published', 'draft') and v_old <> 'draft' then auth.uid() else reviewed_by end
   where id = p_formula;
  perform public.write_audit(auth.uid(), 'formula.status', 'formula', p_formula::text,
    jsonb_build_object('from', v_old, 'to', p_status));
end $$;

/** Admin changes a staff/parent role. Students are created only by register_student(). */
create function public.set_user_role(p_user uuid, p_role public.app_role)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_old public.app_role;
begin
  if not (private.is_admin() and private.has_aal2()) then
    raise exception 'admin with a second factor required' using errcode = 'insufficient_privilege';
  end if;
  if p_user = auth.uid() then
    raise exception 'admins cannot change their own role' using errcode = 'check_violation';
  end if;
  select role into v_old from public.profiles where id = p_user for update;
  if v_old is null then
    raise exception 'user not found' using errcode = 'no_data_found';
  end if;
  if v_old = 'student' or p_role = 'student' then
    raise exception 'student roles are managed through parent accounts' using errcode = 'check_violation';
  end if;
  update public.profiles set role = p_role where id = p_user; -- audited by profiles_audit_role
end $$;

/** Server-only lookup for the admin user search (e-mails live in auth.users). */
create function public.find_user_by_email(p_email text)
returns table (id uuid, email text, role public.app_role, display_name text)
language sql stable security definer set search_path = ''
as $$
  select u.id, u.email::text, p.role, p.display_name
    from auth.users u join public.profiles p on p.id = u.id
   where lower(u.email) = lower(btrim(p_email))
$$;

revoke all on function public.submit_topic_draft(uuid, public.app_locale) from public, anon;
revoke all on function public.request_topic_changes(uuid, public.app_locale, text) from public, anon;
revoke all on function public.publish_topic(uuid, public.app_locale) from public, anon;
revoke all on function public.unpublish_topic(uuid, public.app_locale) from public, anon;
revoke all on function public.set_formula_status(uuid, public.formula_status) from public, anon;
revoke all on function public.set_user_role(uuid, public.app_role) from public, anon;
grant execute on function public.submit_topic_draft(uuid, public.app_locale) to authenticated;
grant execute on function public.request_topic_changes(uuid, public.app_locale, text) to authenticated;
grant execute on function public.publish_topic(uuid, public.app_locale) to authenticated;
grant execute on function public.unpublish_topic(uuid, public.app_locale) to authenticated;
grant execute on function public.set_formula_status(uuid, public.formula_status) to authenticated;
grant execute on function public.set_user_role(uuid, public.app_role) to authenticated;
revoke all on function public.find_user_by_email(text) from public, anon, authenticated;
grant execute on function public.find_user_by_email(text) to service_role;

-- ---------------------------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------------------------
revoke all on public.subjects, public.subject_translations, public.curricula, public.curriculum_translations,
  public.curriculum_sections, public.curriculum_section_translations, public.curriculum_topics,
  public.topics, public.topic_contents, public.topic_drafts, public.formulas, public.formula_translations,
  public.favorites from anon, authenticated;

grant select on public.subjects, public.subject_translations, public.curricula, public.curriculum_translations,
  public.curriculum_sections, public.curriculum_section_translations, public.curriculum_topics,
  public.topics, public.topic_contents, public.formulas, public.formula_translations to anon, authenticated;

grant insert, update, delete on public.curricula, public.curriculum_translations,
  public.curriculum_sections, public.curriculum_section_translations, public.curriculum_topics to authenticated;
grant insert, update (slug, subject_code) on public.topics to authenticated;
grant select, insert on public.topic_drafts to authenticated;
grant update (title, summary, objectives, theory, mistakes, is_machine_translation) on public.topic_drafts to authenticated;
grant insert, delete on public.formulas to authenticated;
grant update (code, subject_code, grade_from, grade_to, latex) on public.formulas to authenticated;
grant insert, update, delete on public.formula_translations to authenticated;
grant select, insert, delete on public.favorites to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------------------------
alter table public.subjects enable row level security;
alter table public.subject_translations enable row level security;
alter table public.curricula enable row level security;
alter table public.curriculum_translations enable row level security;
alter table public.curriculum_sections enable row level security;
alter table public.curriculum_section_translations enable row level security;
alter table public.curriculum_topics enable row level security;
alter table public.topics enable row level security;
alter table public.topic_contents enable row level security;
alter table public.topic_drafts enable row level security;
alter table public.formulas enable row level security;
alter table public.formula_translations enable row level security;
alter table public.favorites enable row level security;

-- Public reference data
create policy subjects_read on public.subjects for select to anon, authenticated using (true);
create policy subject_translations_read on public.subject_translations for select to anon, authenticated using (true);

-- Curricula: everyone reads; reviewers/admins (aal2) edit.
create policy curricula_read on public.curricula for select to anon, authenticated using (true);
create policy curricula_write on public.curricula for all to authenticated
  using (private.reviewer_aal2()) with check (private.reviewer_aal2());
create policy curriculum_translations_read on public.curriculum_translations for select to anon, authenticated using (true);
create policy curriculum_translations_write on public.curriculum_translations for all to authenticated
  using (private.reviewer_aal2()) with check (private.reviewer_aal2());
create policy curriculum_sections_read on public.curriculum_sections for select to anon, authenticated using (true);
create policy curriculum_sections_write on public.curriculum_sections for all to authenticated
  using (private.reviewer_aal2()) with check (private.reviewer_aal2());
create policy curriculum_section_translations_read on public.curriculum_section_translations
  for select to anon, authenticated using (true);
create policy curriculum_section_translations_write on public.curriculum_section_translations for all to authenticated
  using (private.reviewer_aal2()) with check (private.reviewer_aal2());
create policy curriculum_topics_read on public.curriculum_topics for select to anon, authenticated using (true);
create policy curriculum_topics_write on public.curriculum_topics for all to authenticated
  using (private.reviewer_aal2()) with check (private.reviewer_aal2());

-- Topics: visible once any locale is published, or to staff.
create policy topics_read on public.topics for select to anon, authenticated
  using (exists (select 1 from public.topic_contents c where c.topic_id = topics.id) or private.is_staff());
create policy topics_insert on public.topics for insert to authenticated
  with check (private.staff_aal2() and created_by = (select auth.uid()));
create policy topics_update on public.topics for update to authenticated
  using (private.staff_aal2()) with check (private.staff_aal2());

create policy topic_contents_read on public.topic_contents for select to anon, authenticated using (true);

create policy topic_drafts_read on public.topic_drafts for select to authenticated using (private.is_staff());
create policy topic_drafts_insert on public.topic_drafts for insert to authenticated
  with check (private.staff_aal2() and status = 'draft');
create policy topic_drafts_update on public.topic_drafts for update to authenticated
  using (private.staff_aal2()) with check (private.staff_aal2());

-- Formulas
create policy formulas_read on public.formulas for select to anon, authenticated
  using (status = 'published' or private.is_staff());
create policy formulas_insert on public.formulas for insert to authenticated
  with check (private.staff_aal2() and status = 'draft' and created_by = (select auth.uid()));
create policy formulas_update on public.formulas for update to authenticated
  using ((private.staff_aal2() and status = 'draft') or private.reviewer_aal2())
  with check ((private.staff_aal2() and status = 'draft') or private.reviewer_aal2());
create policy formulas_delete on public.formulas for delete to authenticated
  using ((private.staff_aal2() and status = 'draft') or private.reviewer_aal2());

create policy formula_translations_read on public.formula_translations for select to anon, authenticated
  using (exists (select 1 from public.formulas f where f.id = formula_id
                 and (f.status = 'published' or private.is_staff())));
create policy formula_translations_write on public.formula_translations for all to authenticated
  using (exists (select 1 from public.formulas f where f.id = formula_id
                 and ((private.staff_aal2() and f.status = 'draft') or private.reviewer_aal2())))
  with check (exists (select 1 from public.formulas f where f.id = formula_id
                 and ((private.staff_aal2() and f.status = 'draft') or private.reviewer_aal2())));

-- Favorites: own rows only, published formulas only.
create policy favorites_own_read on public.favorites for select to authenticated
  using (profile_id = (select auth.uid()));
create policy favorites_own_insert on public.favorites for insert to authenticated
  with check (profile_id = (select auth.uid())
              and exists (select 1 from public.formulas f where f.id = formula_id and f.status = 'published'));
create policy favorites_own_delete on public.favorites for delete to authenticated
  using (profile_id = (select auth.uid()));
