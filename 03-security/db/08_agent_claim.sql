-- =====================================================================
-- KuwaitSat-1 Mission Hub
-- 08 · THE CLAIM PATH — how the worker gets a run, and how a dead run dies
-- Owner: 04 · Automation (Dana)      Review: 03 · Security (Mariam)
-- Run: Supabase SQL editor, AFTER 03-security/db/05_views_rpc.sql.
--      ONE BLOCK AT A TIME, in file order. If a block errors you need to
--      know which one. Do not paste the folder.
--
-- This file SUPERSEDES 04-agents/db/REQUEST-TO-03-agent_claim_run.sql.
-- That file was the ask; this is the answer, with two bugs fixed that the
-- ask contained. Run this one. Do not run both.
--
-- WHY THIS FILE EXISTS
--   03_grants.sql revokes EVERY table privilege from service_role, and it
--   is right to. So the worker can call agent_log_step, agent_write_result
--   and agent_finish_run — and cannot SELECT mission_runs to find out that
--   there is anything to log about. It has three write paths and no read
--   path. 03_grants.sql already wrote the answer to that:
--
--       "If n8n needs a fourth, it gets a fourth FUNCTION, never a table
--        grant."                                — 03_grants.sql, line ~57
--
--   Blocks 1 and 3 are that fourth and fifth function. Neither gives the
--   browser anything. Neither gives service_role a single table row.
--
-- WHAT IS IN HERE
--   0 · one additive column, claimed_at            (the ONE ask to 02)
--   1 · claim_next_run()          — take exactly one queued run, safely
--   2 · agent_claim_run()         — REMOVED 21 Sep 2026 (was a shim)
--   3 · sweep_stalled_runs()      — a dead run reads "Stopped", not a spinner
--   4 · how the sweeper gets called
--   5 · VERIFY — run these yourself, do not take my word for any of it
-- =====================================================================


-- =====================================================================
-- 0 · THE ONE COLUMN 04 ASKS 02 FOR. Additive, idempotent, ungranted.
--
-- NOTE TO 02 · BACK END: this adds a column and changes nothing else. No
-- grant is issued on it, so no browser role can see it and no screen that
-- works today stops working. It is the only schema change job 04 asks for
-- all week.
--
-- >>> WHY IT IS NEEDED, AND THE BUG IT FIXES <<<
-- mission_runs.started_at is written by the DEFAULT on INSERT — that is,
-- when launch_mission() QUEUES the run, not when the worker STARTS it.
-- The column name lies. The sweeper draft in REQUEST-TO-03 said:
--
--     where status = 'running' and started_at < now() - interval '3 minutes'
--
-- Read that against the au-m1 test. The judge CLOSES n8n, presses Launch,
-- and the run sits queued for as long as it takes to reopen n8n. Say that
-- is four minutes. The worker then claims it — and the sweeper kills it
-- one second later, because started_at is four minutes old. The run the
-- test exists to prove would be marked stalled before its first step.
--
-- So we need to know when work actually BEGAN, which is a different fact
-- from when the run was queued, and no existing column holds it.
--
-- Fallback if 02 refuses the column (they will not, but write it down):
-- drop this block and let the sweeper key off the last agent step alone.
-- Block 3 already does that with coalesce(), so it degrades on its own —
-- the only thing lost is the case of a run that dies before step one.
-- =====================================================================
alter table public.mission_runs
  add column if not exists claimed_at timestamptz;

comment on column public.mission_runs.claimed_at is
  'When a worker took this run. NULL while queued. Set only by claim_next_run(). INTERNAL - no browser grant.';

-- Deliberately no grant line here. A new column carries no privileges, so
-- `authenticated` cannot read it, and that is the intended end state.


-- =====================================================================
-- 1 · claim_next_run() — FOR THE WORKER (n8n node 2, or the Edge
--     Function in 04-agents/worker/edge/index.ts). For nobody else.
--
-- Takes one queued run, marks it running, and hands back the four facts
-- the agents need: which run, which mission, the objective, the area.
--
-- >>> WHY IT TAKES NO ARGUMENTS <<<
-- A worker trigger is reachable by anyone who learns its address. If this
-- function took a run id from its caller, whoever knew that address could
-- name ANY run. It takes nothing. It reads the oldest queued run and
-- claims it. The most a forged ping can do is start a run a researcher
-- already queued from inside our app — which was going to happen anyway.
--
-- >>> WHAT IT DELIBERATELY DOES NOT RETURN <<<
-- researcher_id, n8n_execution_id, error_note, source_ref, or anything at
-- all from auth.users. n8n never learns which human owns a mission. If you
-- ever need to add a column to this RETURNS TABLE to make a node work,
-- message 03 first — that is exactly how a leak ships.
-- =====================================================================
create or replace function public.claim_next_run()
returns table (run_id uuid, mission_id uuid, title text,
               objective text, area_geojson jsonb)
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_column
-- ^ RETURNS TABLE makes run_id and mission_id plpgsql VARIABLES as well as
-- column names. Without this line, an unqualified reference to either is
-- "column reference is ambiguous" at run time — an error you will meet for
-- the first time on demo night. Every reference below is alias-qualified
-- too. Belt and braces, on purpose.
begin
  return query
  with claimed as (
    update public.mission_runs r
       set status     = 'running',
           claimed_at = now()
     where r.id = (
       select r2.id
         from public.mission_runs r2
        where r2.status = 'queued'
        order by r2.started_at          -- oldest queue entry first, fair
        -- >>> THE LINE THIS WHOLE FUNCTION EXISTS FOR <<<
        -- Two workers poll. Without FOR UPDATE SKIP LOCKED they both read
        -- the same queued row, both claim it, and one run gets two sets of
        -- agent steps written onto it. The audit trail then stops being a
        -- record of what happened, which is the only thing it is for.
        -- SKIP LOCKED means the second worker walks past the locked row
        -- and takes the next one, or takes nothing. It never waits and it
        -- never duplicates.
        --
        -- The locking clause goes AFTER limit. Postgres accepts it either
        -- side, but "limit 1 for update skip locked" is the form every
        -- reference writes, and a reviewer reading it should not have to
        -- stop and decide whether it still means what it looks like.
        limit 1
        for update skip locked)
    returning r.id as claimed_run, r.mission_id as claimed_mission)
  select c.claimed_run, c.claimed_mission, m.title, m.objective, m.area_geojson
    from claimed c
    join public.missions m on m.id = c.claimed_mission;

  -- ZERO ROWS when nothing is queued. That is not an error and the worker
  -- must not treat it as one: it means "nothing to do", and the schedule
  -- trigger fires again in fifteen seconds. A worker that raises on empty
  -- fills the n8n execution log with red and hides the real failures.
end $fn$;

-- Same shape as the three write paths in 05_views_rpc.sql: take it from
-- everyone first, then hand it to exactly one role.
revoke execute on function public.claim_next_run()
  from public, anon, authenticated;
grant  execute on function public.claim_next_run() to service_role;

-- >>> NOTE THE `from public` <<<
-- Postgres grants EXECUTE on every new function to PUBLIC automatically.
-- Skip that revoke and `anon` — a private window holding the publishable
-- key out of our config.js — can call this and claim a researcher's run.
-- Verify query 5.4 is how you prove it did not happen.

-- The mission row is left alone on purpose. missions.status stays 'queued'
-- until agent_finish_run() moves it to 'review' or 'failed'. The live
-- screen reads mission_runs.status and my_agent_steps, not missions.status
-- (04-agents/app/automation.js), so introducing a 'running' value here
-- would add a mission status that 01's label map has never seen.


-- =====================================================================
-- 2 · agent_claim_run() — SHIM REMOVED, 21 Sep 2026.
--
-- It existed only so code already written against the older name would
-- keep working. Every caller in 04 now says claim_next_run:
--     04-agents/worker/edge/index.ts:144   rpc("claim_next_run", {})
--     04-agents/n8n/BUILD-GUIDE.md:158     /rest/v1/rpc/claim_next_run
-- and 04-agents/README.md released it explicitly ("can be dropped
-- whenever you like ... it holds nothing open").
--
-- Dropped rather than kept, because a SECURITY DEFINER function granted
-- to service_role is attack surface, and one door with two names is two
-- things to check in every future review. It was never created on the
-- live database, so there is nothing to drop there — but if you are
-- rebuilding from an older dump, this is the line:
--
--     drop function if exists public.agent_claim_run();
-- =====================================================================


-- =====================================================================
-- 3 · sweep_stalled_runs(p_idle_minutes) — FOR THE WORKER, and for the
--     researcher staring at a screen that has not moved.
--
-- This is guardrail Rule 16 ("Stop loudly. Never spin forever.") and
-- capstone SHOULD 9 ("failure is visible"), enforced in the one place
-- that keeps working when the thing that failed is the worker itself.
--
-- A worker that dies mid-run cannot call agent_finish_run to say so. The
-- run stays 'running' for ever, the screen polls every 2 seconds for ever,
-- and the researcher sees a spinner — which SHOULD 9 exists to forbid.
-- Nothing inside a dead process can fix that. The database has to.
--
-- Returns the NUMBER of runs it stalled, so the worker can log it and so
-- you can say "the sweeper marked one run stalled" and then show the row.
--
-- >>> THE NUMBER, AND WHERE ELSE IT IS WRITTEN <<<
-- Three minutes of no activity. That is deliberately the SAME number as
-- STALL_MS = 180000 in 04-agents/app/automation.js. The screen gives up
-- and the database gives up at the same moment, so they never disagree in
-- front of a judge. CHANGE ONE, CHANGE BOTH, and say which two files you
-- changed. (For contrast, the worker's own run budget is 120 seconds,
-- RUN_MAX_SECONDS in 04-agents/worker/agent-run.js — a live worker gives
-- up a minute before this sweeper would.)
--
-- >>> NEVER ADD 'queued' TO THE WHERE CLAUSE <<<
-- The au-m1 test is "close n8n completely, press the button in your app".
-- That run is SUPPOSED to sit queued, for as long as it takes the judge to
-- reopen n8n. Sweeping queued runs would fail the exact test this file
-- exists to protect. Only 'running' is swept. Only ever 'running'.
-- =====================================================================
create or replace function public.sweep_stalled_runs(p_idle_minutes int default 3)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare v_count integer := 0;
begin
  -- Refuse an argument that would empty the queue. A worker with a bug in
  -- its config, or a 0 typed into the SQL editor, would otherwise stall
  -- every run in flight — including the one on the projector.
  if p_idle_minutes is null or p_idle_minutes < 1 then
    raise exception 'Idle minutes must be at least 1.' using errcode = 'P0001';
  end if;

  -- `as materialized` is not decoration. An inlined CTE can have its
  -- locking clause folded into the outer statement and re-planned; forcing
  -- materialisation means the rows are selected and LOCKED first, once,
  -- and the UPDATE below can only ever touch rows this session holds.
  with dead as materialized (
    select r.id
      from public.mission_runs r
     where r.status = 'running'
       -- LAST ACTIVITY, not start time. A six-step run that is still
       -- logging steps must never be swept just because it has been going
       -- a while; and a run that sat in the queue for ten minutes before a
       -- worker took it must never be swept one second after it is taken.
       -- coalesce() order is the whole fix: claimed_at first, started_at
       -- only as a fallback for rows written before block 0 ran.
       and greatest(
             coalesce(r.claimed_at, r.started_at),
             coalesce((select max(coalesce(s.finished_at, s.started_at))
                         from public.agent_steps s
                        where s.run_id = r.id),
                      coalesce(r.claimed_at, r.started_at))
           ) < now() - make_interval(mins => p_idle_minutes)
     -- The sweeper and a claiming worker can run in the same second. SKIP
     -- LOCKED means neither ever waits on the other: a row another session
     -- is mid-claim is simply left for the next sweep.
     for update skip locked
  ),
  swept as (
    update public.mission_runs r
       set status      = 'stalled',
           finished_at = now(),
           error_note  = 'No agent step for ' || p_idle_minutes
                         || ' minutes. The run was marked stalled by the sweeper.'
      from dead d
     where r.id = d.id
    returning r.id, r.mission_id),
  -- The mission follows the run, exactly as agent_finish_run() does it for
  -- a live worker: anything that is not 'complete' leaves the mission
  -- 'failed'. Two code paths, one visible outcome, no third state for 01
  -- to have to render.
  fixed as (
    update public.missions m
       set status = 'failed'
      from swept s
     where m.id = s.mission_id
    returning m.id)
  -- Counted from `swept`, the RUNS, not from `fixed`, the missions. A
  -- mission can in principle own more than one dead run, and the number
  -- this function returns is the number of runs it stalled.
  -- `fixed` is never read, and runs anyway: a data-modifying CTE always
  -- executes exactly once, to completion, whether or not anything selects
  -- from it. That is the documented behaviour, not a lucky accident.
  select count(*) into v_count from swept;

  return v_count;
end $fn$;

-- error_note is not in any browser grant (03_grants.sql leaves it out of
-- mission_runs deliberately), so this sentence never reaches the screen
-- raw. The screen's own wording for a stalled run lives in automation.js.

revoke execute on function public.sweep_stalled_runs(int)
  from public, anon, authenticated;
grant  execute on function public.sweep_stalled_runs(int) to service_role;


-- =====================================================================
-- 4 · HOW THE SWEEPER GETS CALLED — pick ONE, tonight.
--
-- OPTION A (chosen, no new moving parts): the worker calls it at the top
-- of every poll, before it claims. n8n node 2 becomes two HTTP requests:
--
--     POST /rest/v1/rpc/sweep_stalled_runs   body {}
--     POST /rest/v1/rpc/claim_next_run       body {}
--
-- and the Edge Function does the same two lines. The cost is one extra
-- round trip every fifteen seconds. The benefit is that there is nothing
-- new to install, nothing new to forget on Thursday, and the sweep is
-- covered by the same credential and the same grant as everything else.
--
-- >>> The limitation, stated rather than hidden: if the worker is down,
-- >>> nothing sweeps. A run that died at the same moment the worker did
-- >>> stays 'running' until the worker comes back. The front end's own
-- >>> 3-minute timeout still tells the researcher, so no spinner survives
-- >>> either way — but the ROW is only corrected when a worker next polls.
--
-- OPTION B (only if the sweep must survive the worker being down):
-- pg_cron. Supabase has it, it is off by default, and it must be enabled
-- in Dashboard -> Database -> Extensions before the next two lines mean
-- anything. Trap: pg_cron jobs run as `postgres`, NOT as service_role, so
-- the grant above is irrelevant to them — postgres owns the function and
-- can execute it regardless. Do not "fix" that by granting anything.
--
--   create extension if not exists pg_cron;
--   select cron.schedule('sweep-stalled-runs', '* * * * *',
--                        $job$select public.sweep_stalled_runs(3)$job$);
--
--   -- and to take it away again:
--   -- select cron.unschedule('sweep-stalled-runs');
--
-- Option B is a second scheduler to explain to a judge and a second thing
-- that can be silently off. Not this week. Option A.
-- =====================================================================


-- =====================================================================
-- 5 · VERIFY — run these yourself, do not take anyone's word
--
-- Run all six now, and again on Wednesday before the freeze. Queries 5.1
-- to 5.4 are the ones 03 will ask for; 5.5 and 5.6 are the ones that
-- prove the thing actually works.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 5.1 · What can service_role EXECUTE in public?
--
-- EXPECTED, exactly these and nothing else:
--     (agent_claim_run was here until 21 Sep 2026 — removed)
--     agent_finish_run
--     agent_log_step
--     agent_write_result
--     claim_next_run
--     sweep_stalled_runs
-- ANY other name is a finding. Write it up, do not "just leave it".
--
-- >>> THE TRAP THIS QUERY IS BUILT AROUND <<<
-- Postgres grants EXECUTE on every new function to PUBLIC, and every role
-- is a member of PUBLIC. So a function that nobody revoked shows up here
-- looking granted. The `acl` column is how you tell the difference:
--   service_role=X/postgres   -> granted to service_role ON PURPOSE
--   =X/postgres               -> granted to PUBLIC, i.e. to EVERYONE
--   (null)                    -> nothing was ever revoked: default PUBLIC
-- A null or a bare =X/postgres on anything agent-shaped is the finding.
-- ---------------------------------------------------------------------
select p.proname                                 as function_name,
       p.prosecdef                               as is_security_definer,
       pg_get_function_identity_arguments(p.oid) as args,
       p.proacl::text                            as acl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and has_function_privilege('service_role', p.oid, 'EXECUTE')
order by 1;


-- ---------------------------------------------------------------------
-- 5.2 · Did this file hand service_role a single table row? It must not.
-- This is 99_verify.sql query 6, re-run because THIS file is the one that
-- would have broken it. BOTH must return ZERO ROWS.
-- ---------------------------------------------------------------------
select table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and grantee = 'service_role';

select table_name, column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public' and grantee = 'service_role'
order by 1, 2;


-- ---------------------------------------------------------------------
-- 5.3 · Every SECURITY DEFINER function pins search_path.
-- One without it is a privilege-escalation hole, not a helper — 03 checks
-- this in 99_verify.sql query 8 and will check it again over the live
-- schema on Wednesday. This version returns ONLY the offenders.
--
-- >>> ZERO ROWS IS THE PASS. Any row here is a blocker, including one of
-- >>> mine. <<<
-- ---------------------------------------------------------------------
select p.proname as security_definer_without_pinned_search_path,
       pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
  and coalesce(array_to_string(p.proconfig, ','), '') not like '%search_path%'
order by 1;


-- ---------------------------------------------------------------------
-- 5.4 · Did any BROWSER role gain anything? Every answer must be false,
-- and the column list must be the one 03_grants.sql wrote.
--
-- The first query asks the question directly, for both browser roles and
-- both functions. Four rows, all false.
--
-- agent_claim_run() is NOT in this list any more: the shim was removed on
-- 21 Sep 2026 and has_function_privilege() RAISES undefined_function on a
-- name that does not exist, so naming it here would make this verify step
-- fail rather than report. A verify query that errors is worse than none.
-- ---------------------------------------------------------------------
select r.rolname as browser_role,
       f.fn      as function_name,
       has_function_privilege(r.rolname, f.fn, 'EXECUTE') as can_execute
from (values ('anon'), ('authenticated')) as r(rolname)
cross join (values ('public.claim_next_run()'),
                   ('public.sweep_stalled_runs(int)')) as f(fn)
order by 1, 2;
-- expected: false, four times.

-- And the shim really is gone. Expected: zero rows.
select p.proname
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'agent_claim_run';

-- ...and the column grants on mission_runs, unchanged by block 0.
-- EXPECTED for `authenticated`: id, mission_id, status, started_at,
-- finished_at, tool_calls — SELECT only.
-- `claimed_at` MUST NOT APPEAR. Neither must n8n_execution_id or
-- error_note. If claimed_at is in this list, someone granted it; take it
-- back with:
--     revoke select (claimed_at) on public.mission_runs from authenticated;
select grantee, column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'mission_runs'
  and grantee in ('anon', 'authenticated', 'public')
order by grantee, column_name;


-- ---------------------------------------------------------------------
-- 5.5 · THE CONCURRENCY PROOF. This is the one that cannot be done in a
-- single editor tab, because the whole claim is about two sessions.
--
-- Setup — queue two runs against missions you own (the seeding recipe at
-- the bottom of 99_verify.sql tells you how to get a mission id into the
-- SQL editor, guard trigger and all):
--
--     select public.launch_mission('<mission A id>');
--     select public.launch_mission('<mission B id>');
--     select id, mission_id, status from public.mission_runs
--      where status = 'queued' order by started_at;
--     -- expect two rows
--
-- TAB 1:  begin;
--         select * from public.claim_next_run();
--         -- one row. DO NOT COMMIT YET. Leave this tab open.
--
-- TAB 2:  select * from public.claim_next_run();
--         -- one row, and it is the OTHER run. Never the same run_id.
--         -- With a single queued run instead of two, tab 2 returns
--         -- ZERO ROWS rather than blocking. That is SKIP LOCKED, and it
--         -- is the whole of this function's reason to exist.
--
-- TAB 1:  commit;
--
-- >>> If tab 2 HANGS instead of returning, FOR UPDATE SKIP LOCKED is not
-- >>> in the function you actually ran. Re-run block 1. <<<
-- ---------------------------------------------------------------------


-- ---------------------------------------------------------------------
-- 5.6 · The sweeper leaves healthy runs alone, and catches dead ones.
--
-- A · immediately after a claim, nothing is idle yet:
--       select public.sweep_stalled_runs(3);        -- expect 0
--
-- B · to prove it fires, age a run by hand rather than waiting three
--     minutes in front of a judge. Move BOTH columns, or coalesce() reads
--     the one you did not move:
--
--       update public.mission_runs
--          set claimed_at = now() - interval '10 minutes',
--              started_at = now() - interval '10 minutes'
--        where id = '<the run id>';
--
--       select public.sweep_stalled_runs(3);        -- expect 1
--
--       select r.status, r.error_note, m.status as mission_status
--         from public.mission_runs r
--         join public.missions m on m.id = r.mission_id
--        where r.id = '<the run id>';
--       -- expect: stalled | No agent step for 3 minutes... | failed
--
-- C · the argument guard:
--       select public.sweep_stalled_runs(0);
--       -- expect: ERROR  Idle minutes must be at least 1.
--
-- D · and the screen, which is the only part a judge sees: with that run
--     open in the app, 04-agents/app/automation.js stops polling and
--     writes "Stopped." plus a reason. Word "stalled" in the row, word
--     "Stopped" on the screen, no spinner. That is SHOULD 9, demonstrated
--     rather than described.
-- ---------------------------------------------------------------------


-- =====================================================================
-- WHAT THIS FILE DID NOT CHANGE — say this to 03 in one breath.
--
--   · No policy was created, altered or dropped.
--   · No table grant was issued to anyone, to any role, on any table.
--   · One column was added and left ungranted, so no browser role can
--     read it and `select *` behaves exactly as it did before.
--   · anon gained nothing. authenticated gained nothing.
--   · service_role gained EXECUTE on two functions (three until the shim
--     in block 2 is deleted) and still holds zero table privileges.
--   · Every function here is SECURITY DEFINER with search_path pinned to
--     `public, pg_temp`, which query 5.3 proves rather than promises.
-- =====================================================================
