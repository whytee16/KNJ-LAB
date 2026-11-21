-- Stage 2: identity, roles, parent–child links, consents, legal documents, audit log, rate limiting.
-- See DATABASE.md §2, §9, §11 and SECURITY.md.
--
-- Access model:
--   * Every table has RLS enabled. Clients (anon/authenticated) get only the grants listed here.
--   * Writes that need authorization logic (creating children, recording consents, audit) go through
--     the server with the service role, after checks in apps/web/src/server/authz.ts.
--   * Roles are assigned only from auth.users.raw_app_meta_data, which clients cannot set.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------------------------
create type public.app_role as enum ('student', 'parent', 'content_manager', 'reviewer', 'admin', 'support');
create type public.app_locale as enum ('ru', 'kk');
create type public.link_status as enum ('active', 'revoked');
create type public.legal_document_type as enum ('pd_processing', 'child_pd_processing', 'offer', 'terms');

-- ---------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 60),
  locale public.app_locale not null default 'ru',
  timezone text not null default 'Asia/Almaty',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is 'One row per auth user. Minimal personal data (SECURITY.md §2).';

create table public.student_profiles (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9][a-z0-9_.]{2,31}$'),
  grade smallint not null check (grade between 7 and 11),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.student_profiles.username is
  'Login for students without e-mail. Maps to a technical address that never receives mail.';

create table public.parent_student_links (
  parent_id uuid not null references public.profiles (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  status public.link_status not null default 'active',
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (parent_id, student_id),
  check (parent_id <> student_id),
  check ((status = 'revoked') = (revoked_at is not null))
);
create index parent_student_links_student_idx on public.parent_student_links (student_id);

create table public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  type public.legal_document_type not null,
  version text not null check (version ~ '^[0-9A-Za-z._-]{1,32}$'),
  locale public.app_locale not null,
  title text not null,
  body text not null,
  is_draft boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (type, version, locale)
);
comment on column public.legal_documents.is_draft is
  'Draft texts are for development only and are shown with a visible warning.';
create index legal_documents_current_idx on public.legal_documents (type, locale, published_at desc);

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  subject_profile_id uuid not null references public.profiles (id) on delete cascade,
  given_by_profile_id uuid not null references public.profiles (id) on delete cascade,
  type public.legal_document_type not null,
  document_version text not null,
  given_at timestamptz not null default now(),
  revoked_at timestamptz,
  ip_hash text
);
create index consents_subject_idx on public.consents (subject_profile_id, type);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);
create index audit_logs_at_idx on public.audit_logs (at desc);
create index audit_logs_entity_idx on public.audit_logs (entity, entity_id);

create table private.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  hits integer not null
);

-- ---------------------------------------------------------------------------------------------
-- Helpers (security definer, fixed search_path; used by RLS policies)
-- ---------------------------------------------------------------------------------------------
create function private.current_app_role()
returns public.app_role
language sql stable security definer set search_path = ''
as $$ select p.role from public.profiles p where p.id = auth.uid() $$;

create function private.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(private.current_app_role() = 'admin', false) $$;

create function private.is_parent_of(student uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.parent_student_links l
    where l.parent_id = auth.uid() and l.student_id = student and l.status = 'active'
  )
$$;

revoke all on function private.current_app_role() from public;
revoke all on function private.is_admin() from public;
revoke all on function private.is_parent_of(uuid) from public;
grant execute on function private.current_app_role() to authenticated, service_role;
grant execute on function private.is_admin() to authenticated, service_role;
grant execute on function private.is_parent_of(uuid) to authenticated, service_role;

create function private.touch_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at := now(); return new; end $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();
create trigger student_profiles_touch before update on public.student_profiles
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------------------------
-- Audit log: append-only, written only through this function.
-- ---------------------------------------------------------------------------------------------
create function public.write_audit(
  p_actor uuid, p_action text, p_entity text, p_entity_id text, p_details jsonb default '{}'::jsonb
)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (p_actor, p_action, p_entity, p_entity_id, coalesce(p_details, '{}'::jsonb))
$$;
revoke all on function public.write_audit(uuid, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.write_audit(uuid, text, text, text, jsonb) to service_role;

create function private.forbid_audit_change()
returns trigger language plpgsql set search_path = ''
as $$
begin
  raise exception 'audit_logs is append-only' using errcode = 'insufficient_privilege';
end $$;
create trigger audit_logs_append_only before update or delete on public.audit_logs
  for each row execute function private.forbid_audit_change();
create trigger audit_logs_no_truncate before truncate on public.audit_logs
  for each statement execute function private.forbid_audit_change();

create function private.audit_role_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.role is distinct from old.role then
    perform public.write_audit(auth.uid(), 'profile.role_changed', 'profile', new.id::text,
      jsonb_build_object('from', old.role, 'to', new.role));
  end if;
  return new;
end $$;
create trigger profiles_audit_role after update of role on public.profiles
  for each row execute function private.audit_role_change();

-- ---------------------------------------------------------------------------------------------
-- New auth users → profile. Every new account starts as a parent; metadata never grants a role
-- (GoTrue's admin API writes app_metadata in a separate statement after the insert, and user
-- metadata is client input). Students are created by register_student(); other roles change only
-- through audited updates by the service role.
-- ---------------------------------------------------------------------------------------------
create function private.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_locale public.app_locale := case when meta ->> 'locale' in ('ru', 'kk')
                                     then (meta ->> 'locale')::public.app_locale else 'ru' end;
  v_name text := left(btrim(coalesce(meta ->> 'display_name', '')), 60);
begin
  if v_name = '' then
    v_name := left(split_part(coalesce(new.email, 'user'), '@', 1), 60);
  end if;
  insert into public.profiles (id, role, display_name, locale) values (new.id, 'parent', v_name, v_locale);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------------------------
-- Turns a freshly created auth user into a student of the given parent, in one transaction:
-- role, student profile, parent link and the guardian's consent. Server-only.
-- Refuses anything but a brand-new, unused account so it cannot convert a real parent.
-- ---------------------------------------------------------------------------------------------
create function public.register_student(
  p_student uuid,
  p_parent uuid,
  p_username text,
  p_grade smallint,
  p_display_name text,
  p_consent_version text,
  p_ip_hash text default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles where id = p_parent and role = 'parent') then
    raise exception 'parent must be a parent profile' using errcode = 'foreign_key_violation';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = p_student and p.role = 'parent' and p.created_at > now() - interval '10 minutes'
  )
  or exists (select 1 from public.parent_student_links l where p_student in (l.parent_id, l.student_id))
  or exists (select 1 from public.consents c where p_student in (c.subject_profile_id, c.given_by_profile_id))
  then
    raise exception 'only a new, unused account can become a student' using errcode = 'check_violation';
  end if;
  if not exists (
    select 1 from public.legal_documents d
    where d.type = 'child_pd_processing' and d.version = p_consent_version
      and d.published_at is not null and d.published_at <= now()
  ) then
    raise exception 'unknown consent version' using errcode = 'check_violation';
  end if;

  update public.profiles set role = 'student', display_name = p_display_name where id = p_student;
  insert into public.student_profiles (profile_id, username, grade) values (p_student, p_username, p_grade);
  insert into public.parent_student_links (parent_id, student_id) values (p_parent, p_student);
  insert into public.consents (subject_profile_id, given_by_profile_id, type, document_version, ip_hash)
  values (p_student, p_parent, 'child_pd_processing', p_consent_version, p_ip_hash);
end $$;
revoke all on function public.register_student(uuid, uuid, text, smallint, text, text, text)
  from public, anon, authenticated;
grant execute on function public.register_student(uuid, uuid, text, smallint, text, text, text) to service_role;

-- ---------------------------------------------------------------------------------------------
-- Rate limiting (fixed window). Server-only.
-- ---------------------------------------------------------------------------------------------
create function public.rate_limit_hit(p_key text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_hits integer;
begin
  insert into private.rate_limits as r (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update
    set hits = case when r.window_start < now() - make_interval(secs => p_window_seconds)
                    then 1 else r.hits + 1 end,
        window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds)
                            then now() else r.window_start end
  returning hits into v_hits;
  return v_hits <= p_max;
end $$;
revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;

-- ---------------------------------------------------------------------------------------------
-- Grants: start from nothing, then grant exactly what clients need.
-- ---------------------------------------------------------------------------------------------
revoke all on public.profiles, public.student_profiles, public.parent_student_links,
  public.legal_documents, public.consents, public.audit_logs from anon, authenticated;
revoke all on private.rate_limits from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, locale, timezone) on public.profiles to authenticated;
grant select on public.student_profiles to authenticated;
grant update (grade) on public.student_profiles to authenticated;
grant select on public.parent_student_links to authenticated;
grant select on public.consents to authenticated;
grant select on public.audit_logs to authenticated;
grant select on public.legal_documents to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.student_profiles enable row level security;
alter table public.parent_student_links enable row level security;
alter table public.legal_documents enable row level security;
alter table public.consents enable row level security;
alter table public.audit_logs enable row level security;
alter table private.rate_limits enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.is_parent_of(id) or private.is_admin());
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy student_profiles_select on public.student_profiles for select to authenticated
  using (profile_id = (select auth.uid()) or private.is_parent_of(profile_id) or private.is_admin());
create policy student_profiles_update_parent on public.student_profiles for update to authenticated
  using (private.is_parent_of(profile_id)) with check (private.is_parent_of(profile_id));

create policy links_select on public.parent_student_links for select to authenticated
  using (parent_id = (select auth.uid()) or student_id = (select auth.uid()) or private.is_admin());

create policy legal_documents_select on public.legal_documents for select to anon, authenticated
  using (published_at is not null and published_at <= now());

create policy consents_select on public.consents for select to authenticated
  using (subject_profile_id = (select auth.uid()) or given_by_profile_id = (select auth.uid())
         or private.is_admin());

create policy audit_logs_select_admin on public.audit_logs for select to authenticated
  using (private.is_admin());
