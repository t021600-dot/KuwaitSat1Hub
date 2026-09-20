-- =====================================================================
-- KuwaitSat-1 Mission Hub
-- 05 · VIEWS (column hiding) + THE ONLY WRITE PATHS
-- Owner: 03 · Security          Run: Sunday, after file 04
--
-- Two jobs in this file.
--
-- A. THE VIEWS. RLS decides WHICH ROWS. A view decides WHICH COLUMNS.
--    `security_invoker = on` means the underlying RLS still applies, so
--    the WHERE clause below is a SECOND wall, not the only one.
--
--    >>> If you create a view WITHOUT security_invoker, it runs as the
--    >>> view's owner and every researcher sees EVERY row. That single
--    >>> missing setting is the most common way a team with "RLS on"
--    >>> fails the judge's two-window test. <<<
--
-- B. THE WRITE PATHS. Nothing writes to a table directly except a
--    researcher creating a mission. Everything else — launching, logging
--    an agent step, writing a result, approving a report, sharing —
--    goes through a named SECURITY DEFINER function that re-reads the
--    owner from the database and never trusts its arguments.
-- =====================================================================


-- =====================================================================
-- A · THE VIEWS
-- =====================================================================

-- The dashboard list. Note `is_owner` — the screen needs to know whether
-- to show the Share button, and computing it here means the front end
-- never has to compare user ids itself (and so can never get it wrong).
create or replace view public.my_missions
with (security_invoker = on) as
select m.id,
       m.title,
       m.objective,
       m.area_geojson,
       m.status,
       m.injection_flag,
       m.created_at,
       m.launched_at,
       (m.researcher_id = (select auth.uid())) as is_owner,
       (select count(*) from public.results r
         where r.mission_id = m.id and r.status = 'complete') as finding_count
from public.missions m
where m.researcher_id = (select auth.uid())
   or public.is_collaborator(m.id);

-- The results list gets a PREVIEW, computed HERE, not the whole narrative.
-- Truncating in JavaScript means the full text already crossed the wire
-- and is sitting in the Network tab.
create or replace view public.my_mission_results
with (security_invoker = on) as
select r.id, r.mission_id, r.run_id, r.kind, r.title,
       left(r.body, 240) as preview,
       r.geometry, r.created_at
from public.results r
where r.status = 'complete';

-- The live agent strip: six steps, their status, and any refusal.
-- raw_prompt / raw_response / confidence are absent by construction.
create or replace view public.my_agent_steps
with (security_invoker = on) as
select s.id, s.run_id, s.step_name, s.status, s.allowed,
       s.refused_reason, s.injection_flag, s.started_at, s.finished_at
from public.agent_steps s;

-- A VIEW NEEDS ITS OWN GRANT. Forget these three lines and the dashboard
-- is empty on Thursday, and it looks exactly like "the data was not saved".
revoke all on public.my_missions, public.my_mission_results,
              public.my_agent_steps from anon, authenticated;
grant select on public.my_missions        to authenticated;
grant select on public.my_mission_results to authenticated;
grant select on public.my_agent_steps     to authenticated;

-- >>> NEVER create a view over auth.users. <<<
-- It is the one table with the password hash in it. If a screen needs a
-- researcher's name, it comes from public.profiles, keyed to auth.uid().


-- =====================================================================
-- B · THE WRITE PATHS
-- =====================================================================

-- ---------------------------------------------------------------------
-- launch_mission · the ONLY way a mission becomes a run.
--
-- THE IMPORTANT PART: the browser calls THIS, not n8n. If the browser
-- POSTs to the n8n webhook directly, that URL is in View Source — and
-- the judge's own se-m4 test is "the address bar, plus the console".
-- Anyone who reads it can POST a run for any mission id they like.
-- See DECISIONS.md D-1.
-- ---------------------------------------------------------------------
create or replace function public.launch_mission(p_mission_id uuid)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare v_run uuid; s public.app_settings;
begin
  -- ownership is RE-READ from the table. It is never taken from an argument.
  if not public.owns_mission(p_mission_id) then
    raise exception 'Mission not found.' using errcode = 'P0001';
    -- "not found", not "not yours": a different message for a mission that
    -- exists-but-is-someone-else's tells a stranger that it exists.
  end if;

  select * into s from public.app_settings where id;
  if s is null then
    -- FAIL CLOSED. If the settings row is missing, refuse — do not
    -- fall through to "well, nothing said no".
    raise exception 'Mission settings are unavailable.' using errcode = 'P0001';
  end if;
  if not s.accepting_new_missions then
    raise exception 'The prototype is not accepting new missions right now.'
      using errcode = 'P0001';
  end if;

  if exists (select 1 from public.mission_runs
              where mission_id = p_mission_id
                and status in ('queued','running')) then
    raise exception 'This mission is already running.' using errcode = 'P0001';
  end if;

  insert into public.mission_runs (mission_id) values (p_mission_id)
    returning id into v_run;
  update public.missions
     set status = 'queued', launched_at = now()
   where id = p_mission_id;

  return v_run;
end $fn$;

revoke execute on function public.launch_mission(uuid) from public, anon;
grant  execute on function public.launch_mission(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- generate_report · the HUMAN CHECKPOINT.
-- The capstone SHOULD list asks for "the agent proposes, a person
-- approves". This function is that sentence in SQL: a report cannot exist
-- without a signed-in human calling it, and approved_by is that human.
-- ---------------------------------------------------------------------
create or replace function public.generate_report(p_mission_id uuid, p_body_md text)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare v_id uuid;
begin
  if not public.owns_mission(p_mission_id) then
    raise exception 'Mission not found.' using errcode = 'P0001';
  end if;
  if char_length(btrim(coalesce(p_body_md,''))) < 50 then
    raise exception 'A report needs at least 50 characters.' using errcode = 'P0001';
  end if;

  insert into public.reports (mission_id, body_md, approved_by)
  values (p_mission_id, p_body_md, (select auth.uid()))
  returning id into v_id;

  update public.missions set status = 'complete' where id = p_mission_id;
  return v_id;
end $fn$;

revoke execute on function public.generate_report(uuid,text) from public, anon;
grant  execute on function public.generate_report(uuid,text) to authenticated;


-- ---------------------------------------------------------------------
-- share_mission · sharing is a written row, made by the owner only.
-- ---------------------------------------------------------------------
create or replace function public.share_mission(p_mission_id uuid, p_email text,
                                                p_role text default 'viewer')
returns void
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare v_user uuid;
begin
  if not public.owns_mission(p_mission_id) then
    raise exception 'Mission not found.' using errcode = 'P0001';
  end if;
  if p_role not in ('viewer','editor') then
    raise exception 'Unknown role.' using errcode = 'P0001';
  end if;

  select id into v_user from auth.users where lower(email) = lower(btrim(p_email));
  if v_user is null then
    -- deliberately vague: this must not become a way to test which email
    -- addresses have accounts on the platform.
    raise exception 'That researcher cannot be added.' using errcode = 'P0001';
  end if;
  if v_user = (select auth.uid()) then
    raise exception 'You already own this mission.' using errcode = 'P0001';
  end if;

  insert into public.mission_collaborators (mission_id, user_id, role, granted_by)
  values (p_mission_id, v_user, p_role, (select auth.uid()))
  on conflict (mission_id, user_id) do update set role = excluded.role;
end $fn$;

revoke execute on function public.share_mission(uuid,text,text) from public, anon;
grant  execute on function public.share_mission(uuid,text,text) to authenticated;


-- ---------------------------------------------------------------------
-- n8n's ONLY door. It gets EXECUTE on functions. It NEVER gets a table
-- grant, and it must call /rest/v1/rpc/<name>, never /rest/v1/<table>.
-- A table URL in the n8n workflow is a finding — write it up.
--
-- Note the owner is re-read from the mission row every time. n8n telling
-- us whose mission it is would be n8n deciding our security model.
-- ---------------------------------------------------------------------
create or replace function public.agent_log_step(
  p_run_id uuid, p_step text, p_tool text, p_args jsonb,
  p_allowed boolean, p_refused_reason text, p_injection boolean default false)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare v_id uuid; v_mission uuid; v_status text; v_calls int;
begin
  select mission_id, status, tool_calls
    into v_mission, v_status, v_calls
    from public.mission_runs where id = p_run_id;

  if v_mission is null then
    raise exception 'Unknown run.' using errcode = 'P0001';
  end if;

  -- A finished run must never grow new steps. Without this, an n8n retry
  -- (or anyone holding the service key) can append to a completed run and
  -- the audit trail stops being a record of what happened.
  if v_status not in ('queued','running') then
    raise exception 'Run is not active.' using errcode = 'P0001';
  end if;

  -- The step budget, enforced where it cannot be argued with. This is the
  -- "max steps" line of the capstone's au-m4 guardrail list.
  if v_calls >= 40 then
    raise exception 'Step budget exhausted.' using errcode = 'P0001';
  end if;

  insert into public.agent_steps
    (run_id, step_name, tool, arguments, allowed, refused_reason,
     injection_flag, status, finished_at)
  values
    (p_run_id, p_step, p_tool, p_args, p_allowed, p_refused_reason,
     p_injection, case when p_allowed then 'complete' else 'refused' end, now())
  returning id into v_id;

  update public.mission_runs set tool_calls = tool_calls + 1 where id = p_run_id;

  -- one mission, one injection flag, raised once and never lowered
  if p_injection then
    update public.missions set injection_flag = true where id = v_mission;
  end if;

  return v_id;
end $fn$;

create or replace function public.agent_write_result(
  p_run_id uuid, p_kind text, p_title text, p_body text, p_geometry jsonb,
  p_source_ref text default null)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare v_id uuid; v_mission uuid;
begin
  select mission_id into v_mission from public.mission_runs where id = p_run_id;
  if v_mission is null then
    raise exception 'Unknown run.' using errcode = 'P0001';
  end if;

  -- the agent's output is bounded here too. An unbounded blob written back
  -- by the agent makes the 5,000-character refusal on the form worthless.
  if char_length(coalesce(p_body,'')) > 20000 then
    raise exception 'Result body too long.' using errcode = 'P0001';
  end if;

  insert into public.results
    (mission_id, run_id, kind, title, body, geometry, source_ref, status)
  values
    (v_mission, p_run_id, p_kind, p_title, p_body, p_geometry, p_source_ref,
     'complete')
  returning id into v_id;
  return v_id;
end $fn$;

create or replace function public.agent_finish_run(p_run_id uuid, p_status text,
                                                   p_error text default null)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $fn$
begin
  if p_status not in ('complete','failed','stalled') then
    raise exception 'Unknown run status.' using errcode = 'P0001';
  end if;
  update public.mission_runs
     set status = p_status, finished_at = now(), error_note = p_error
   where id = p_run_id;
  update public.missions m
     set status = case when p_status = 'complete' then 'review' else 'failed' end
    from public.mission_runs r
   where r.id = p_run_id and m.id = r.mission_id;
end $fn$;

-- The browser gets NONE of these three. Only the server-side role n8n
-- authenticates as. See DECISIONS.md D-1 for which role that is.
revoke execute on function
  public.agent_log_step(uuid,text,text,jsonb,boolean,text,boolean),
  public.agent_write_result(uuid,text,text,text,jsonb,text),
  public.agent_finish_run(uuid,text,text)
  from public, anon, authenticated;

grant execute on function
  public.agent_log_step(uuid,text,text,jsonb,boolean,text,boolean),
  public.agent_write_result(uuid,text,text,text,jsonb,text),
  public.agent_finish_run(uuid,text,text)
  to service_role;
