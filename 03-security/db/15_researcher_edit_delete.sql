-- =====================================================================
-- 15_researcher_edit_delete.sql
-- Owner: 03 Security · 24 September 2026
--
-- Lets a researcher rename and delete their own missions, from the page.
--
-- WHY THIS AND NOT 15_researcher_tidy_path.DRAFT.sql
-- The draft is 673 lines, 6 SECURITY DEFINER functions and 3 triggers.
-- This is 2 functions and 0 triggers. It adds NO column, alters NO table
-- and changes NO table grant. After it runs, `authenticated` holds
-- exactly what 03_grants.sql gave it: INSERT on 3 columns of missions,
-- SELECT on 9, and no UPDATE or DELETE anywhere. Verify 4.1 below.
--
-- The draft's BEFORE DELETE trigger was the reason to cut it. Because
-- missions.researcher_id cascades from auth.users, that trigger makes
-- DELETING A TEST ACCOUNT from the Supabase Auth dashboard fail for any
-- researcher who has ever run a mission. A new failure mode, in a
-- surface the team uses, for hardening against a SQL-editor reflex.
--
-- THE ONE REFUSAL
-- delete_mission refuses a mission that has a signed report, and
-- nothing else. reports.approved_by is a named human who pressed the
-- button; it is the only artifact on this platform where a person takes
-- responsibility for an AI output. The cascade would take it.
--
-- WHAT DELETING AN UNSIGNED MISSION STILL DESTROYS, on the record:
-- its refused agent_steps, which are the evidence the guardrails fired.
-- Accepted, because an unsigned mission was never offered to anyone as
-- evidence, the confirmation names the exact refusal count before the
-- press, and the deletion writes a COUNTS-ONLY row to monitoring_events
-- so the erasure itself is recorded even though the mission is not.
--
-- EDIT IS SPLIT, deliberately. The title is a label and stays editable.
-- The objective is the text the agents read, and locks the moment
-- anything has run: rewriting it afterwards would make agent_steps
-- describe a question nobody asked. area_geojson is not editable at
-- all, which keeps kuwait_area_ok out of this file's blast radius.
--
-- VERIFIED AGAINST THE LIVE DATABASE BEFORE WRITING, 24 Sep 2026:
--   monitor_record(p_source text, p_action text, p_runs_swept integer,
--                  p_ok boolean, p_anomaly text, p_detail jsonb) → uuid
--   owns_mission(p_mission_id uuid) → boolean
-- Both exist with these exact signatures. The fifth argument is passed
-- as null::text rather than a bare null so resolution cannot drift if
-- an overload is ever added.
--
-- Run after 01-14. Safe to run more than once.
-- =====================================================================

-- ===================================================================
-- 1 · edit_mission — title always, objective only before anything ran
-- ===================================================================
create or replace function public.edit_mission(
  p_mission_id uuid,
  p_title      text,
  p_objective  text default null)   -- NULL = rename only, never touches it
returns void
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare v_title text; v_obj text; v_locked boolean;
begin
  -- Same sentence for "does not exist" and "is not yours". A different
  -- one would confirm the mission exists. 09_researcher_write_path.sql:46-51.
  if not public.owns_mission(p_mission_id) then
    raise exception 'Mission not found.' using errcode = 'P0001';
  end if;

  v_title := btrim(coalesce(p_title, ''));
  if char_length(v_title) not between 3 and 120 then
    raise exception 'A mission name is between 3 and 120 characters.'
      using errcode = 'P0001';
  end if;
  -- Negative match, as missions_title_has_letter is written: `~ '[[:alpha:]]'`
  -- depends on lc_ctype and returns false for Arabic.
  if v_title ~ '^[0-9[:space:][:punct:]]*$' then
    raise exception 'The name and the objective both have to contain letters.'
      using errcode = 'P0001';
  end if;

  if p_objective is null then
    update public.missions set title = v_title where id = p_mission_id;
    return;
  end if;

  -- THE LINE THAT KEEPS THE TRAIL HONEST. agent_steps hold prompts built
  -- from THIS objective. Rewriting it afterwards makes the trail describe
  -- a question nobody asked. The rows win, not the status label.
  select exists (select 1 from public.mission_runs where mission_id = p_mission_id)
      or exists (select 1 from public.reports      where mission_id = p_mission_id)
    into v_locked;
  if v_locked then
    raise exception
      'This mission has already been run. The objective can no longer be changed.'
      using errcode = 'P0001',
            hint = 'The name can still be corrected. Start a new mission to ask a different question.';
  end if;

  v_obj := btrim(coalesce(p_objective, ''));
  if char_length(v_obj) not between 20 and 1500 then
    raise exception 'A research objective is between 20 and 1500 characters.'
      using errcode = 'P0001';
  end if;
  if v_obj ~ '^[0-9[:space:][:punct:]]*$' then
    raise exception 'The name and the objective both have to contain letters.'
      using errcode = 'P0001';
  end if;

  update public.missions set title = v_title, objective = v_obj
   where id = p_mission_id;
end $fn$;

-- ===================================================================
-- 2 · delete_mission — everything except a signed report
-- ===================================================================
create or replace function public.delete_mission(p_mission_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare v_runs int; v_steps int; v_refused int; v_results int;
begin
  if not public.owns_mission(p_mission_id) then
    raise exception 'Mission not found.' using errcode = 'P0001';
  end if;

  -- THE ONE REFUSAL IN THIS FILE. reports.approved_by is a named human.
  -- The cascade would delete that signature. Nothing else is refused.
  if exists (select 1 from public.reports where mission_id = p_mission_id) then
    raise exception 'This mission has a signed report and cannot be deleted.'
      using errcode = 'P0001',
            hint = 'The report was approved by a named person. Renaming is still allowed.';
  end if;

  select count(*) into v_runs
    from public.mission_runs where mission_id = p_mission_id;
  select count(*), count(*) filter (where s.status = 'refused')
    into v_steps, v_refused
    from public.agent_steps s
    join public.mission_runs r on r.id = s.run_id
   where r.mission_id = p_mission_id;
  select count(*) into v_results
    from public.results where mission_id = p_mission_id;

  -- The mission goes; the fact that it went stays, as COUNTS ONLY.
  -- 11_monitoring.sql section 1 forbids any mission/run/researcher id in
  -- this table and this respects that. ok=true and runs_swept=0 on purpose:
  -- monitor_health() sums runs_swept and counts non-null anomaly, so a
  -- delete must read as activity, not as a stalled-run sweep or an alarm.
  perform public.monitor_record(
    'researcher', 'mission_deleted', 0, true, null::text,
    jsonb_build_object('runs', v_runs, 'agent_steps', v_steps,
                       'refused_steps', v_refused, 'results', v_results));

  delete from public.missions where id = p_mission_id;
end $fn$;

-- ===================================================================
-- 3 · GRANTS. `from public` is the line that matters - Postgres grants
--     EXECUTE to PUBLIC by default, which includes anon, and that default
--     is what the Advisor caught this project with twice (10_advisor_fixes §4).
-- ===================================================================
revoke execute on function
  public.edit_mission(uuid, text, text),
  public.delete_mission(uuid)
  from public, anon, service_role;

grant execute on function
  public.edit_mission(uuid, text, text),
  public.delete_mission(uuid)
  to authenticated;

-- ===================================================================
-- 4 · VERIFY. Run these, read them, do not take this file's word.
-- ===================================================================
-- 4.1 THE ONE THAT MATTERS. Expected: ZERO ROWS.
-- select grantee, table_name, privilege_type
--   from information_schema.role_table_grants
--  where table_schema='public'
--    and grantee in ('anon','authenticated','service_role')
--    and privilege_type in ('UPDATE','DELETE','TRUNCATE')
--    and table_name <> 'payload_frames';   -- 13 grants service_role update

-- 4.2 Expected: false / true / false on both rows.
-- select p.proname,
--        has_function_privilege('anon',          p.oid,'EXECUTE') as anon,
--        has_function_privilege('authenticated', p.oid,'EXECUTE') as auth,
--        has_function_privilege('service_role',  p.oid,'EXECUTE') as svc
--   from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--  where n.nspname='public' and p.proname in ('edit_mission','delete_mission');

-- 4.3 Two accounts, in the browser console. BOTH must answer
--     "Mission not found." for a mission belonging to the other account:
--       await sb.rpc('delete_mission', { p_mission_id: '<their id>' })
--       await sb.rpc('edit_mission',   { p_mission_id: '<their id>', p_title: 'x' })

-- 4.4 The guard, proven. Pick a mission that HAS a report:
--       await sb.rpc('delete_mission', { p_mission_id: '<signed id>' })
--     Expected: "This mission has a signed report and cannot be deleted."
--     and this count UNCHANGED afterwards:
--       select count(*) from public.reports;