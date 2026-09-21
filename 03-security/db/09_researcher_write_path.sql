-- =====================================================================
-- KuwaitSat-1 Mission Hub
-- 09 · THE BROWSER WRITE PATH
-- Owner: 03 · Security          Run: after 05, before the site is used
--
-- WHY THIS FILE EXISTS AT ALL
-- agent_log_step / agent_write_result / agent_finish_run in file 05 are
-- service_role only, because the designed production writer is n8n (D-1).
-- That has not changed.
--
-- But the demo runs the agent pipeline IN THE PAGE - it is Hind's console,
-- and the pipeline with its decision nodes already lives there. For that run
-- to leave an audit trail (be-m5) without n8n being live, the browser needs
-- its own way in.
--
-- THE DANGER, NAMED: a browser-callable writer lets a signed-in researcher
-- write steps and findings onto SOMEBODY ELSE'S run. Every function below
-- closes that the same way - it re-reads ownership from the run row with
-- owns_mission() on every single call. The caller's argument is used for
-- CONTENT, never for AUTHORISATION.
--
-- >>> THIS FILE WAS APPLIED TO THE LIVE DATABASE BEFORE IT WAS WRITTEN DOWN.
-- >>> That was a mistake. A migration that exists only in the database and
-- >>> not in the repo means a rebuild from db/ produces a site whose audit
-- >>> trail silently writes nothing - the calls 404 and the .then() only
-- >>> console.warns. The repo and the database must say the same thing.
-- =====================================================================

create or replace function public.researcher_log_step(
  p_run_id uuid, p_step text, p_tool text, p_args jsonb,
  p_allowed boolean default true, p_refused_reason text default null,
  p_injection boolean default false)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare v_id uuid; v_mission uuid; v_status text; v_calls int;
begin
  select r.mission_id, r.status, r.tool_calls
    into v_mission, v_status, v_calls
    from public.mission_runs r where r.id = p_run_id;

  if v_mission is null then
    raise exception 'Mission not found.' using errcode = 'P0001';
  end if;

  -- THE LINE THAT MAKES THIS SAFE.
  -- "Mission not found" for someone else's run too - a different message
  -- would confirm that the run exists.
  if not public.owns_mission(v_mission) then
    raise exception 'Mission not found.' using errcode = 'P0001';
  end if;

  if v_status not in ('queued','running') then
    raise exception 'Run is not active.' using errcode = 'P0001';
  end if;
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
  if p_injection then
    update public.missions set injection_flag = true where id = v_mission;
  end if;
  return v_id;
end $fn$;

create or replace function public.researcher_write_result(
  p_run_id uuid, p_kind text, p_title text, p_body text,
  p_geometry jsonb default null)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare v_id uuid; v_mission uuid;
begin
  select r.mission_id into v_mission from public.mission_runs r where r.id = p_run_id;
  if v_mission is null or not public.owns_mission(v_mission) then
    raise exception 'Mission not found.' using errcode = 'P0001';
  end if;
  if char_length(coalesce(p_body,'')) > 20000 then
    raise exception 'Result body too long.' using errcode = 'P0001';
  end if;

  insert into public.results
    (mission_id, run_id, kind, title, body, geometry, status)
  values (v_mission, p_run_id, p_kind, p_title, p_body, p_geometry, 'complete')
  returning id into v_id;
  return v_id;
end $fn$;

create or replace function public.researcher_finish_run(
  p_run_id uuid, p_status text, p_error text default null)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare v_mission uuid;
begin
  select r.mission_id into v_mission from public.mission_runs r where r.id = p_run_id;
  if v_mission is null or not public.owns_mission(v_mission) then
    raise exception 'Mission not found.' using errcode = 'P0001';
  end if;
  if p_status not in ('complete','failed','stalled') then
    raise exception 'Unknown run status.' using errcode = 'P0001';
  end if;

  update public.mission_runs
     set status = p_status, finished_at = now(), error_note = p_error
   where id = p_run_id;
  update public.missions
     set status = case when p_status = 'complete' then 'review' else 'failed' end
   where id = v_mission;
end $fn$;

revoke execute on function
  public.researcher_log_step(uuid,text,text,jsonb,boolean,text,boolean),
  public.researcher_write_result(uuid,text,text,text,jsonb),
  public.researcher_finish_run(uuid,text,text)
  from public, anon;

grant execute on function
  public.researcher_log_step(uuid,text,text,jsonb,boolean,text,boolean),
  public.researcher_write_result(uuid,text,text,text,jsonb),
  public.researcher_finish_run(uuid,text,text)
  to authenticated;

-- VERIFY: authenticated true, anon false, all three present.
--   select p.proname,
--          has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_ok,
--          has_function_privilege('anon', p.oid, 'EXECUTE')          as anon_ok
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname='public' and p.proname like 'researcher\_%';
