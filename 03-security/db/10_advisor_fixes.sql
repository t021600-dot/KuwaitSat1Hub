-- =====================================================================
-- 10_advisor_fixes.sql · THE se-m6 FIXES, MADE REPRODUCIBLE
-- Owner: 03 Security · Written 21 September 2026
--
-- WHY THIS FILE EXISTS
-- The two Security Advisor findings were fixed on the live database and
-- then existed NOWHERE IN THIS REPOSITORY. Rebuilding from 01→09 would
-- have produced a database with both holes back open, while the evidence
-- file in 03-security/evidence/ still said they were closed.
--
-- That is the same mistake as 09_researcher_write_path.sql: a change made
-- through the dashboard is not a change until it is in the file that
-- rebuilds the system. A fix you cannot reproduce is a story about a fix.
--
-- RUN THIS LAST, after 01→09.
-- Safe to run repeatedly. Safe to run when a function is absent.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1 · missions_guard() — the serious one.
--
-- Found by the Advisor as callable by `anon` over /rest/v1/rpc/. It is a
-- TRIGGER function: it has no business being an API endpoint at all. It
-- carries the rate limit, the accepting_new_missions kill switch, and
-- the assignment that forces researcher_id to the calling account.
--
-- Also revoked in 06_validation.sql beside the definition, so whichever
-- file someone reads, the revoke is next to the thing it protects.
-- ---------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.missions_guard()') is not null then
    execute 'revoke execute on function public.missions_guard()
               from public, anon, authenticated, service_role';
  end if;
end $$;


-- ---------------------------------------------------------------------
-- 2 · rls_auto_enable() — not ours, and that is exactly the point.
--
-- This function is created by SUPABASE, not by any file in this folder,
-- when "Automatically enable RLS on new tables" is switched on in the
-- dashboard. It is an event trigger function and was likewise exposed to
-- `anon` over PostgREST.
--
-- Because nothing in 01→09 creates it, nothing in 01→09 would ever have
-- secured it either. It is guarded with to_regprocedure so this file
-- stays runnable on a project where the setting was never enabled.
-- ---------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable()
               from public, anon, authenticated, service_role';
  end if;
end $$;


-- ---------------------------------------------------------------------
-- 3 · kuwait_area_ok(jsonb) — found by US, not by the Advisor.
--
-- The class-wide audit in section 4 below turned this up on 21 Sep 2026:
-- it was reachable at /rest/v1/rpc/kuwait_area_ok by `anon`, from the
-- open internet, with no sign-in. The Advisor had not flagged it.
--
-- It is a pure validator — reads no table, returns a boolean — so it
-- leaked nothing. Closed anyway: an unauthenticated endpoint that parses
-- attacker-supplied jsonb is CPU someone else gets to spend, and
-- "anon can execute nothing in public" is a rule worth being able to say
-- without an exception attached.
--
-- ⚠️ THE TRAP. Tested before applying, and it would have taken the whole
-- product down. PostgreSQL checks EXECUTE on functions used inside a
-- CHECK CONSTRAINT at INSERT TIME, and `authenticated` held this one only
-- through PUBLIC. So `revoke ... from public` on its own makes every
-- mission insert fail with "permission denied for function
-- kuwait_area_ok" — the constraint stops being enforceable rather than
-- stopping being reachable. The explicit grant below is not tidiness.
--
-- Verified after applying: a signed-in researcher can insert a valid
-- Kuwait area; an area in the Atlantic is still refused by
-- missions_area_shape; `anon` calling it is refused.
-- ---------------------------------------------------------------------
revoke execute on function public.kuwait_area_ok(jsonb) from public, anon;
grant  execute on function public.kuwait_area_ok(jsonb) to authenticated;


-- ---------------------------------------------------------------------
-- 4 · THE GENERAL RULE, not just these three.
--
-- PostgreSQL grants EXECUTE on every new function to PUBLIC by default.
-- Both findings above are that default, not a mistake anyone typed. So
-- rather than only naming the two we were caught by, close the class:
-- any function in `public` that no role should be calling over the API.
--
-- This lists what is still reachable, so the answer is checked rather
-- than assumed. Run it and read it — anything unexpected is a finding.
-- Section 3 above is what happened the first time it was run: the
-- expectation said "anon: nothing" and the database disagreed. Trust the
-- query, not the expectation.
-- ---------------------------------------------------------------------
select p.proname                                              as function_name,
       has_function_privilege('anon',          p.oid,'EXECUTE') as anon,
       has_function_privilege('authenticated', p.oid,'EXECUTE') as authenticated,
       has_function_privilege('service_role',  p.oid,'EXECUTE') as service_role
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by 2 desc, 3 desc, 1;

-- EXPECTED, as of 21 Sep 2026:
--   anon                 : nothing. Not one function. If anon is true on
--                          any row, stop and investigate before demoing.
--                          (kuwait_area_ok was the one exception until
--                          21 Sep 2026 — section 3.)
--   authenticated        : launch_mission, generate_report,
--                          researcher_log_step / _write_result /
--                          _finish_run, and the can_read_* / owns_mission
--                          / is_collaborator helpers used inside policies.
--   service_role         : agent_log_step / _write_result / _finish_run,
--                          claim_next_run, sweep_stalled_runs.
--   missions_guard, rls_auto_enable : false everywhere. Triggers only.
--   generate_report      : service_role MUST be false — that is the
--                          human checkpoint. See
--                          evidence/se-m5-checkpoint-2026-09-21.md.
