-- Stage 5b.1: drafts prepared automatically (AI) are marked and cannot be published until a
-- reviewer confirms that a teacher has checked them. See AGENTS.md and ADR-0009.
--
--   human        — written by a person (default)
--   ai_draft     — prepared automatically, not checked yet: publishing is blocked
--   ai_reviewed  — prepared automatically and checked by a reviewer (kept for traceability)

create type public.content_origin as enum ('human', 'ai_draft', 'ai_reviewed');

alter table public.topic_drafts add column content_origin public.content_origin not null default 'human';
alter table public.lab_translations add column content_origin public.content_origin not null default 'human';
alter table public.task_templates add column content_origin public.content_origin not null default 'human';

/** The origin changes only through mark_content_reviewed() (or by the importer as postgres). */
create function private.content_origin_guard()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.content_origin is distinct from old.content_origin
     and coalesce(current_setting('knj.mark_reviewed', true), '') <> 'on'
     and auth.uid() is not null then
    raise exception 'the content origin is changed by mark_content_reviewed()' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;
create trigger topic_drafts_origin before update on public.topic_drafts
  for each row execute function private.content_origin_guard();
create trigger lab_translations_origin before update on public.lab_translations
  for each row execute function private.content_origin_guard();
create trigger task_templates_origin before update on public.task_templates
  for each row execute function private.content_origin_guard();

/** Published texts are copied from drafts by publish_topic(): refuse unchecked AI drafts. */
create function private.topic_publish_origin_guard()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.topic_drafts d
             where d.topic_id = new.topic_id and d.locale = new.locale and d.content_origin = 'ai_draft') then
    raise exception 'an automatically prepared draft must be checked before publishing' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger topic_contents_origin before insert or update on public.topic_contents
  for each row execute function private.topic_publish_origin_guard();

create function private.template_publish_origin_guard()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.status = 'published' and new.content_origin = 'ai_draft' then
    raise exception 'an automatically prepared template must be checked before publishing' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger task_templates_publish_origin before insert or update on public.task_templates
  for each row execute function private.template_publish_origin_guard();

create function private.lab_publish_origin_guard()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'published' and exists (
       select 1 from public.lab_translations t where t.lab_id = new.id and t.content_origin = 'ai_draft') then
    raise exception 'automatically prepared lab texts must be checked before publishing' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger labs_publish_origin before insert or update on public.labs
  for each row execute function private.lab_publish_origin_guard();

/** Reviewer confirms that a teacher has checked an automatically prepared text. Audited. */
create function public.mark_content_reviewed(p_kind text, p_id uuid, p_locale public.app_locale default 'ru')
returns void language plpgsql security definer set search_path = ''
as $$
declare
  n integer;
begin
  if not private.reviewer_aal2() then
    raise exception 'reviewer with a second factor required' using errcode = 'insufficient_privilege';
  end if;
  perform set_config('knj.mark_reviewed', 'on', true);
  case p_kind
    when 'topic' then
      update public.topic_drafts set content_origin = 'ai_reviewed'
       where topic_id = p_id and locale = p_locale and content_origin = 'ai_draft';
    when 'lab' then
      update public.lab_translations set content_origin = 'ai_reviewed'
       where lab_id = p_id and locale = p_locale and content_origin = 'ai_draft';
    when 'template' then
      update public.task_templates set content_origin = 'ai_reviewed'
       where id = p_id and content_origin = 'ai_draft';
    else
      raise exception 'unknown content kind' using errcode = 'invalid_parameter_value';
  end case;
  get diagnostics n = row_count;
  perform set_config('knj.mark_reviewed', 'off', true);
  if n = 0 then
    raise exception 'nothing to confirm' using errcode = 'no_data_found';
  end if;
  perform public.write_audit(auth.uid(), 'content.reviewed', p_kind, p_id::text, jsonb_build_object('locale', p_locale));
end $$;
revoke all on function public.mark_content_reviewed(text, uuid, public.app_locale) from public, anon;
grant execute on function public.mark_content_reviewed(text, uuid, public.app_locale) to authenticated;

-- Registry: second physics lab (texts come as drafts through `pnpm content:import-drafts`).
insert into public.labs (code, subject_code, kind, grade_from, default_params, is_free_demo, sort)
values ('projectile', 'physics', 'physics', 9, '{"v0": 15, "angle": 45, "h0": 0, "g": 9.8}', false, 20);
