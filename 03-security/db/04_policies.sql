-- =====================================================================
-- KuwaitSat-1 Mission Hub
-- 04 · THE POLICIES  ·  THIS FILE IS se-m1
-- Owner: 03 · Security          Run: Sunday, after file 03
--
-- The shape of every read policy in this file:
--
--        for select TO AUTHENTICATED USING (<an ownership test>)
--
-- Two things that must never appear below, and do not:
--   · a policy with NO role clause — it applies to `anon` as well
--   · `using (true)` — that is the whole demo lost in four characters
--
-- Read the PART 2 table at the bottom out loud before you close the
-- laptop. The "(none)" rows are the point of it: they are the things we
-- blocked ON PURPOSE, and a judge who asks "what can't they do?" wants
-- those, not a shrug.
--
-- ---------------------------------------------------------------------
-- WHY EVERY `create policy` HAS A `drop policy if exists` ABOVE IT
--
-- `create policy` is NOT `create or replace policy` - no such thing
-- exists in Postgres. Re-paste this file onto a database that already
-- has these policies and the very first statement stops with
--
--     ERROR: policy "profiles_select_own" for table "profiles"
--            already exists
--
-- At 1am that error reads like "everything is broken" when it actually
-- means "this already worked". Worse, a beginner's reflex is to start
-- deleting things to make the red go away - and the thing they delete is
-- se-m1. The drop lines make the file safe to run as many times as you
-- like: each one removes only the policy the line under it immediately
-- re-creates, and the end state is identical every time.
--
-- `if exists` means the drop is silent on a fresh database too, so this
-- file behaves the same on first run and tenth run. WHAT the policies do
-- is unchanged - only the ability to re-run them safely is new.
--
-- >>> ALWAYS PASTE A DROP AND ITS CREATE TOGETHER. <<<
-- Run a `drop policy` on its own and you leave that table with RLS ON
-- and NO POLICY, which returns ZERO ROWS TO EVERYONE - including the
-- owner, including the screen you are testing. It looks exactly like
-- "all our data vanished" (README says the same thing about a missing
-- policy). The pair is one edit; never half of it.
-- =====================================================================


-- ---------------------------------------------------------------------
-- profiles · your own row, nothing else.
-- There is deliberately no researcher directory: Researcher B cannot even
-- enumerate who else has an account.
-- ---------------------------------------------------------------------
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated using      (user_id = (select auth.uid()))
                                with check (user_id = (select auth.uid()));


-- ---------------------------------------------------------------------
-- missions · THE ONE THE JUDGE WILL TEST
-- "Show me account B failing to read account A's record."
-- ---------------------------------------------------------------------

-- read: mine, or one somebody explicitly shared with me
drop policy if exists missions_select_own_or_shared on public.missions;
create policy missions_select_own_or_shared on public.missions
  for select to authenticated
  using ( researcher_id = (select auth.uid())
          or public.is_collaborator(id) );

-- write: I may create a mission and it is mine.
-- The with check re-states the owner even though the column default sets
-- it and the browser has no grant on it. Belt, braces, and a second belt.
--
-- DO NOT DELETE THIS POLICY THINKING THE GRANT IS ENOUGH. RLS denies by
-- default: a table with RLS on and no INSERT policy refuses every insert,
-- and the symptom is "Launch Mission does nothing" at 1am.
drop policy if exists missions_insert_own on public.missions;
create policy missions_insert_own on public.missions
  for insert to authenticated
  with check ( researcher_id = (select auth.uid()) );


-- ---------------------------------------------------------------------
-- mission_runs · readable because the parent mission is readable
-- ---------------------------------------------------------------------
drop policy if exists mission_runs_select_readable on public.mission_runs;
create policy mission_runs_select_readable on public.mission_runs
  for select to authenticated using ( public.can_read_mission(mission_id) );


-- ---------------------------------------------------------------------
-- agent_steps · the audit trail, owner-visible INCLUDING REFUSALS.
-- A refused step is evidence the guardrails fired. It is a feature on
-- screen, not something to hide.
-- ---------------------------------------------------------------------
drop policy if exists agent_steps_select_readable on public.agent_steps;
create policy agent_steps_select_readable on public.agent_steps
  for select to authenticated using ( public.can_read_run(run_id) );


-- ---------------------------------------------------------------------
-- results · ownership test AND a status gate.
-- An in-flight draft is not a finding and must not be read as one — the
-- researcher reviews what the agent FINISHED, never a half-written row.
-- ---------------------------------------------------------------------
drop policy if exists results_select_complete on public.results;
create policy results_select_complete on public.results
  for select to authenticated
  using ( status <> 'draft' and public.can_read_mission(mission_id) );


-- ---------------------------------------------------------------------
-- reports
-- ---------------------------------------------------------------------
drop policy if exists reports_select_readable on public.reports;
create policy reports_select_readable on public.reports
  for select to authenticated using ( public.can_read_mission(mission_id) );


-- ---------------------------------------------------------------------
-- mission_collaborators · my own invitation, or the sharing list of a
-- mission I own. Not a way to enumerate other people's sharing.
-- ---------------------------------------------------------------------
drop policy if exists collab_select_own on public.mission_collaborators;
create policy collab_select_own on public.mission_collaborators
  for select to authenticated
  using ( user_id = (select auth.uid()) or public.owns_mission(mission_id) );


-- =====================================================================
-- PART 2 · WHO GETS WHAT — INCLUDING EVERY COMBINATION THAT GETS NO
-- POLICY ON PURPOSE.
--
-- Print this table. It is your answer to "what can't they do?" and it is
-- half of the be-m3 pocket card ("say what one row of any table is").
--
-- | Policy name                   | Who          | What        | Which rows |
-- |-------------------------------|--------------|-------------|------------|
-- | profiles_select_own           | researcher   | select      | their own profile row only |
-- | profiles_insert_own/_update   | researcher   | insert,upd  | their own row, name + org only |
-- | missions_select_own_or_shared | researcher   | select      | researcher_id = auth.uid(), or invited |
-- | missions_insert_own           | researcher   | insert      | a row owned by themselves; 3 columns only |
-- | mission_runs_select_readable  | researcher   | select      | runs of a mission they may read |
-- | agent_steps_select_readable   | researcher   | select      | steps of a run of a mission they may read |
-- | results_select_complete       | researcher   | select      | NON-DRAFT results of a mission they may read |
-- | reports_select_readable       | researcher   | select      | reports of a mission they may read |
-- | collab_select_own             | researcher   | select      | their own invite, or the list on a mission they own |
-- |-------------------------------|--------------|-------------|------------|
-- | (none)  anon, never signed in | anything     | any table   | ZERO. No grant + no policy. The private-window test |
-- | (none)  researcher            | update,delete| missions    | ZERO — status moves through RPC only |
-- | (none)  researcher            | ins/upd/del  | mission_runs| ZERO — only n8n, through a function |
-- | (none)  researcher            | ins/upd/del  | agent_steps | ZERO — the audit log is append-only from the agent side |
-- | (none)  researcher            | ins/upd/del  | results     | ZERO — only n8n, through a function |
-- | (none)  researcher            | ins/upd/del  | reports     | ZERO — generate_report() writes it after the human click |
-- | (none)  researcher            | select draft | results     | ZERO — the status gate |
-- | (none)  researcher            | ins/upd/del  | collaborators| ZERO — sharing goes through share_mission() |
-- | (none)  anyone in a browser   | anything     | app_settings| ZERO — RLS on, no policy, no grant. The kill switch |
-- | (none)  researcher            | select       | any INTERNAL column | ZERO — not in the grant, so not selectable at all |
-- =====================================================================
