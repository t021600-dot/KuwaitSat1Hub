-- =====================================================================
-- KuwaitSat-1 Mission Hub
-- 02 · OWNERSHIP HELPERS
-- Owner: 03 · Security          Run: Sunday, AFTER file 01, BEFORE file 04
--
-- WHY SECURITY DEFINER:
-- These functions read `missions` and `mission_collaborators` from INSIDE
-- a policy on those same tables. As DEFINER they run as the table owner,
-- so RLS is skipped inside the function body — no infinite recursion, and
-- the function can still see the row it needs in order to judge.
--
-- A plain (INVOKER) version of these returns false for everybody and looks
-- EXACTLY like "all our data vanished". If you hit that on Monday, this
-- comment is the answer.
--
-- Every one of them is `set search_path = public, pg_temp`. A SECURITY
-- DEFINER function without a pinned search_path is a privilege-escalation
-- hole, not a helper.
-- =====================================================================

-- Is the caller on the sharing list for this mission?
create or replace function public.is_collaborator(p_mission_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $fn$
  select exists (
    select 1 from public.mission_collaborators mc
    where mc.mission_id = p_mission_id
      and mc.user_id    = (select auth.uid())
  );
$fn$;

-- Owner ONLY — sharing does not apply. Use for inviting, deleting,
-- anything where a collaborator must not be able to act.
create or replace function public.owns_mission(p_mission_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $fn$
  select exists (
    select 1 from public.missions m
    where m.id = p_mission_id
      and m.researcher_id = (select auth.uid())
  );
$fn$;

-- Owner OR an invited collaborator. This is the normal read test.
create or replace function public.can_read_mission(p_mission_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $fn$
  select exists (
    select 1 from public.missions m
    where m.id = p_mission_id
      and ( m.researcher_id = (select auth.uid())
            or public.is_collaborator(m.id) )
  );
$fn$;

-- The child-table chain: agent_steps -> run -> mission -> researcher.
-- agent_steps has no owner column, so this is the only way it can be judged.
create or replace function public.can_read_run(p_run_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $fn$
  select exists (
    select 1 from public.mission_runs r
    where r.id = p_run_id
      and public.can_read_mission(r.mission_id)
  );
$fn$;


-- ---------------------------------------------------------------------
-- Take EXECUTE away from everyone, then hand it back to signed-in users
-- only. `anon` (a private window that never signed in) can call nothing.
-- ---------------------------------------------------------------------
revoke execute on function public.is_collaborator(uuid)   from public, anon;
revoke execute on function public.owns_mission(uuid)      from public, anon;
revoke execute on function public.can_read_mission(uuid)  from public, anon;
revoke execute on function public.can_read_run(uuid)      from public, anon;

grant  execute on function public.is_collaborator(uuid)   to authenticated;
grant  execute on function public.owns_mission(uuid)      to authenticated;
grant  execute on function public.can_read_mission(uuid)  to authenticated;
grant  execute on function public.can_read_run(uuid)      to authenticated;
