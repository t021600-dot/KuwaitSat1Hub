-- =====================================================================
-- >>> SUPERSEDED. DO NOT RUN THIS FILE. <<<
-- Run 04-agents/db/08_agent_claim.sql instead. It is this ask, answered,
-- with two bugs fixed that this draft contained:
--   1. the sweeper below keys off started_at, which is set when a run is
--      QUEUED, not when it is claimed — so it would mark a run stalled one
--      second after the worker picked it up, if the run had waited in the
--      queue (which is exactly the au-m1 "close n8n, press the button"
--      test). 08 adds mission_runs.claimed_at and keys off last activity.
--   2. the function is renamed claim_next_run(); the old name still
--      answers as a thin shim so worker/edge/index.ts keeps working.
-- This file is kept only as the written record of the ask.
-- =====================================================================
--
-- 04 · Automation  ->  03 · Security     ONE ASK, SUNDAY NIGHT
-- Requested by: Dana        Reviewed by: Mariam (03)        Status: ANSWERED
--
-- THE GAP, in one sentence:
--   03/db/03_grants.sql revokes EVERY table privilege from service_role,
--   so the worker cannot SELECT mission_runs and cannot SELECT missions.
--   It therefore has no way to find a queued run, and no way to learn the
--   objective or the area it is supposed to work on.
--
-- The three write paths in 05_views_rpc.sql are complete and I am not
-- asking to change any of them. What is missing is the READ path — and
-- 03_grants.sql already says what the answer has to be:
--
--     "If n8n needs a fourth, it gets a fourth FUNCTION, never a table
--      grant."                                    — 03_grants.sql, line ~57
--
-- This is that fourth function. Review it, change anything you like, and
-- run it at the bottom of 05_views_rpc.sql. Nothing in 04 works until it
-- exists, and the browser gains nothing from it.
--
-- WHY IT TAKES NO ARGUMENTS
--   An n8n webhook URL is publicly reachable by anyone who learns it.
--   If the worker took a run id from its caller, whoever knows the URL
--   could name any run. It takes nothing: it reads the oldest queued run
--   and claims it. The most a forged ping can do is start a run that a
--   researcher already queued from inside our app — which is what was
--   going to happen anyway.
--
-- WHAT IT DELIBERATELY DOES NOT RETURN
--   researcher_id, n8n_execution_id, error_note, source_ref, or anything
--   from auth.users. n8n never learns which human owns a mission.
-- =====================================================================

create or replace function public.agent_claim_run()
returns table (run_id uuid, mission_id uuid, title text,
               objective text, area_geojson jsonb)
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
begin
  return query
  with claimed as (
    update public.mission_runs r
       set status = 'running'
     where r.id = (
       select r2.id
         from public.mission_runs r2
        where r2.status = 'queued'
        order by r2.started_at
        -- two n8n executions must never claim the same run. Without
        -- SKIP LOCKED a retry writes a second set of steps onto one run
        -- and the audit trail stops being a record of what happened.
        for update skip locked
        limit 1)
    returning r.id as run_id, r.mission_id as mission_id)
  select c.run_id, c.mission_id, m.title, m.objective, m.area_geojson
    from claimed c
    join public.missions m on m.id = c.mission_id;
  -- zero rows when nothing is queued. The workflow treats that as
  -- "nothing to do" and stops. It is not an error.
end $fn$;

-- Same shape as the other three: nobody has it, then service_role only.
revoke execute on function public.agent_claim_run() from public, anon, authenticated;
grant  execute on function public.agent_claim_run() to service_role;


-- =====================================================================
-- KNOWN LIMITATION, WRITTEN DOWN ON PURPOSE (do not "fix" it this week)
--
-- A run claimed by a worker that then dies stays 'running' for ever, and
-- from the researcher's side that is an endless spinner — the exact thing
-- the capstone SHOULD list forbids.
--
-- We close it in the FRONT END, not here: 04-agents/app/automation.js
-- stops polling after 180 seconds with no new step and says
-- "Stopped responding" with the run id. A requeue-after-timeout job is a
-- second moving part on a three-night build; the visible failure is worth
-- more on demo night than the recovery.
--
-- If you would rather close it in SQL, this is the whole of it, and it
-- needs pg_cron:
--
--   update public.mission_runs
--      set status = 'stalled', finished_at = now(),
--          error_note = 'No agent step for 3 minutes.'
--    where status = 'running'
--      and started_at < now() - interval '3 minutes';
-- =====================================================================


-- =====================================================================
-- WHAT 04 NEEDS FROM 02 · BACK END — nothing new.
-- Everything the workflow writes already has a column:
--   mission_runs.status, .started_at, .finished_at, .tool_calls
--   agent_steps.step_name, .tool, .arguments, .allowed, .refused_reason,
--                .injection_flag, .status, .finished_at
--   results.kind, .title, .body, .geometry, .source_ref, .status
--   missions.status, .launched_at, .injection_flag
-- If a column moves, tell me before you move it — the worker names all of
-- them through the four functions and nothing else.
-- =====================================================================
