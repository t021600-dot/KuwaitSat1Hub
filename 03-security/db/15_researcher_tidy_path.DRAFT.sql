-- =====================================================================
-- 15_researcher_tidy_path.sql
--
-- >>> DRAFT. NOT APPLIED. DO NOT RUN THIS BEFORE DEMO DAY. <<<
--
-- Status on 2026-09-23: written, NOT reviewed line by line, NOT tested
-- against any database, NOT applied to the live project. It is checked
-- in so the design is not lost, not because it is ready.
--
-- WHY IT EXISTS
-- A researcher cannot tidy their own mission list. 03_grants.sql:76-82
-- gives authenticated INSERT on three columns and SELECT on nine, and
-- no UPDATE or DELETE on missions at all. That is deliberate and the
-- comment there says so: a researcher cannot edit a mission after
-- launching it, and that is what makes the audit trail worth anything.
--
-- The cost showed up on 2026-09-23: three identically-named Jahra
-- missions and two mislabelled Al-Khiran ones had to be removed by
-- hand, in the Supabase SQL editor, because nothing in the page could
-- do it.
--
-- WHY IT CANNOT SIMPLY BE TWO MORE GRANTS
-- Every child table points at missions(id) ON DELETE CASCADE:
--   01_tables_rls.sql:65   mission_runs.mission_id
--   01_tables_rls.sql:94   agent_steps.run_id -> mission_runs
--   01_tables_rls.sql:120  results.mission_id
--   01_tables_rls.sql:144  reports.mission_id
-- One DELETE therefore takes the runs, every agent_step INCLUDING the
-- refused ones that are the only evidence the guardrails fired, every
-- result, and the signed report with its approved_by. Observed live:
-- deleting one mission took the report count from 2 to 1 and left zero
-- orphans. A researcher holding DELETE is a researcher who can erase
-- the evidence that the platform worked.
--
-- WHAT IT DOES INSTEAD
--   archive   the everyday action. Sets a flag. Destroys nothing and
--             is reversible.
--   edit      title and objective only, and only while status=draft.
--             After launch the objective is the text the Orchestrator
--             actually read, and editing it would make the trail
--             describe a question nobody asked.
--   delete    only when the mission has no runs, no results and no
--             report. Nothing to destroy, so nothing is destroyed.
--   tripwire  a BEFORE DELETE trigger refusing any delete of a mission
--             that has evidence behind it, INCLUDING from the SQL
--             editor.
-- All of it goes through SECURITY DEFINER functions, so no new UPDATE
-- or DELETE grant appears on missions or on any other table, and the
-- audit panel claim stays literally true.
--
-- BEFORE THIS IS APPLIED, IT NEEDS:
--   1. a line-by-line read by 03-security against 01_tables_rls.sql and
--      03_grants.sql as they actually are on the live project
--   2. a run on a Supabase BRANCH, not on main
--   3. the six P0001 messages added to the SAFE allowlist in
--      js/ksat-workflow.js, which is the other half of a contract that
--      nothing enforces
--   4. the UI work: archive filter, restore, edit and delete buttons
--      built from real row state in actionsFor(), plus EN and AR
--      strings, plus a rewrite of the append-only sentence in
--      js/ksat-audit-plain.js in the SAME commit
--   5. loadMissions() to select archived_at, which select(*) cannot do
--      under the column grants
--
-- It is 600 lines with 6 SECURITY DEFINER functions and 3 triggers.
-- Applying it untested hours before a demo would put mission creation
-- itself at risk, which is the one path the demo cannot lose.
-- =====================================================================

-- =====================================================================
-- KuwaitSat-1 Mission Hub
-- 15 · THE RESEARCHER TIDY PATH — archive, edit a draft, delete an empty
-- Owner: 03 · Security     Run: after 01-14, by hand in the SQL editor
--
-- >>> NOT APPLIED. Written 23 Sep 2026, reviewed, not yet run. <<<
-- Run it one block at a time, in file order, the way 01 asks. If a block
-- errors you need to know which one.
--
-- ---------------------------------------------------------------------
-- WHY THIS FILE EXISTS
-- ---------------------------------------------------------------------
-- 03_grants.sql line 80 says, and means: "No UPDATE grant, no DELETE
-- grant." A researcher who tries to clean up their own test rows gets
-- "permission denied for table missions". That is the append-only
-- property the audit panel praises, and it cuts the team too.
--
-- The obvious fix - grant update and delete on missions to the owner -
-- is the one thing that must not happen, and the reason is in
-- 01_tables_rls.sql, not in any policy:
--
--   mission_runs.mission_id          -> missions(id) ON DELETE CASCADE  (line 65)
--   agent_steps.run_id               -> mission_runs(id) ON DELETE CASCADE (line 94)
--   results.mission_id / run_id      -> ON DELETE CASCADE  (lines 120-121)
--   reports.mission_id               -> ON DELETE CASCADE  (line 144)
--   mission_collaborators.mission_id -> ON DELETE CASCADE  (line 157)
--
-- One DELETE on one mission row therefore destroys every run, every
-- agent step INCLUDING THE REFUSALS, every result, and the approved
-- report with its approved_by - the named human who signed it. This was
-- observed, not theorised: a mission deleted from the SQL editor on
-- 23 Sep 2026 took its whole subtree with it and the report count went
-- 2 -> 1 with no orphan rows left behind. The only table that survives
-- is admin_access_log, whose mission_id is ON DELETE SET NULL on purpose
-- (07_admin_audit_PHASE2.sql line 297-300: "we lose the pointer, not the
-- event"). Everything else is gone with no row saying it ever existed.
--
-- A DELETE grant on missions is therefore a grant to erase the evidence
-- that the guardrails fired. It is not a convenience feature.
--
-- ---------------------------------------------------------------------
-- WHAT WAS CONSIDERED, AND WHY THIS SHAPE
-- ---------------------------------------------------------------------
-- (a) archive flag           - reversible, destroys nothing, but never
--                              actually removes the typo'd test row
-- (b) edit while status=draft- fixes the ten-seconds-later typo, and
--                              refuses after launch ON PURPOSE: the
--                              objective is the text the Orchestrator
--                              READ, and editing it afterwards makes the
--                              trail describe a question never asked
-- (c) delete when no runs    - honest removal, but only ever helps with
--                              the mission nobody regrets
-- (d) all three              - each covers what the others miss
--
-- (d) is what this file does, and it adds the thing none of them contain:
-- a BEFORE DELETE tripwire so the SQL-editor cascade above cannot happen
-- by reflex again, whoever types it.
--
-- >>> THE RULE THIS FILE KEEPS <<<
-- No new UPDATE grant. No new DELETE grant. Not on missions, not on
-- anything. After this file `authenticated` still holds exactly the
-- privileges 03_grants.sql hands it, plus SELECT on one new column.
-- Every write below happens inside a SECURITY DEFINER function that
-- re-reads ownership from the database with owns_mission() and never
-- trusts its arguments for authorisation - the same shape as
-- 09_researcher_write_path.sql.
--
-- It works because 01_tables_rls.sql line 195 refuses `force row level
-- security`: these functions run as the table OWNER, so RLS does not
-- apply inside them. If anyone ever adds force RLS, every function here
-- stops writing and it will look like "the buttons do nothing".
--
-- ---------------------------------------------------------------------
-- WHAT THIS COSTS. READ IT BEFORE YOU RUN IT.
-- ---------------------------------------------------------------------
-- missions.researcher_id references auth.users(id) ON DELETE CASCADE, so
-- deleting a researcher's ACCOUNT cascades into their missions - and the
-- tripwire in section 2 will refuse it. After this file, deleting a test
-- account from the Supabase Auth dashboard FAILS for any researcher who
-- has ever run a mission, with the sentence from section 2. That is not a
-- bug report; it is this file. Use the escape hatch in section 2, in SQL,
-- deliberately. Nobody will remember this on Thursday, so it is also
-- written on the trigger function as a COMMENT.
--
-- ---------------------------------------------------------------------
-- IDEMPOTENT. Safe to run twice, and safe on a half-finished database:
-- add column if not exists / create index if not exists / create or
-- replace function / drop trigger if exists + create trigger / create or
-- replace view. Re-running changes nothing.
-- =====================================================================


-- =====================================================================
-- 1 · THE COLUMN
--
-- One column, nullable, no default. NULL means live; a timestamp means
-- the owner archived it and when. No archived_by: only the owner can
-- archive, so it would always equal researcher_id, and a column that can
-- only hold one value is a comment with storage.
--
-- A new column carries NO privileges, so the grant below is required -
-- without it the page reads the column as "permission denied for column
-- archived_at" the first time it names it, which reads like the table
-- broke. It is a SELECT grant only. There is still no UPDATE grant.
-- =====================================================================
alter table public.missions
  add column if not exists archived_at timestamptz;

comment on column public.missions.archived_at is
  'NULL = live. Set by archive_mission(), cleared by restore_mission(). '
  'A hidden row, never a deleted one - the runs, steps, results and report '
  'are all still there. See 15_researcher_tidy_path.sql.';

grant select (archived_at) on public.missions to authenticated;

-- The default list is "mine, live, newest first". missions_by_researcher
-- (01_tables_rls.sql line 55) still serves the archive view.
create index if not exists missions_live_by_researcher
  on public.missions (researcher_id, created_at desc)
  where archived_at is null;


-- =====================================================================
-- 2 · THE TRIPWIRE — the part that is not about the browser at all
--
-- The browser cannot delete a mission: it has no DELETE grant and this
-- file does not give it one. This trigger is for the OTHER delete - the
-- one-liner in the SQL editor, the cleanup script, the cascade from a
-- deleted auth account. It refuses any delete of a mission that has
-- evidence behind it, whoever asks.
--
-- 11_monitoring.sql section 5 says the general form of this: "a guard
-- inside a function is a check the next function somebody writes can
-- skip; a unique index is the database refusing, whoever asks." A
-- trigger is that, for a verb an index cannot express.
--
-- THE ESCAPE HATCH, and it is two steps on purpose:
--
--     begin;
--       set local ksat.allow_cascade_delete = 'on';
--       delete from public.missions where id = '<uuid>';
--     commit;
--
-- `set local` dies with the transaction, so it cannot leak into the next
-- statement in the same editor tab. Use the same block to delete a test
-- ACCOUNT (see WHAT THIS COSTS in the header) - delete the auth.users
-- row inside a transaction that has set the GUC.
--
-- HONEST LIMIT: a superuser can `alter table public.missions disable
-- trigger missions_delete_guard_bd`. This is a wall against reflex, not
-- against the postgres role. It is still worth having, because reflex is
-- what actually cost us a report.
-- =====================================================================
create or replace function public.missions_delete_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_runs    int;
  v_results int;
  v_reports int;
begin
  -- deliberate, transaction-scoped override. Absent -> NULL -> 'off'.
  if coalesce(current_setting('ksat.allow_cascade_delete', true), 'off') = 'on' then
    return old;
  end if;

  select count(*) into v_runs    from public.mission_runs where mission_id = old.id;
  select count(*) into v_results from public.results      where mission_id = old.id;
  select count(*) into v_reports from public.reports      where mission_id = old.id;

  if v_runs > 0 or v_results > 0 or v_reports > 0 then
    raise exception
      'This mission has evidence behind it and cannot be deleted. Archive it instead.'
      using errcode = 'P0001',
            detail  = format(
              'ON DELETE CASCADE would have destroyed %s run(s), %s result(s), '
              '%s report(s) and every agent step under those runs. '
              'See 15_researcher_tidy_path.sql section 2.',
              v_runs, v_results, v_reports),
            hint    = 'Deliberate cleanup: set local ksat.allow_cascade_delete = ''on'' '
                      'inside a transaction.';
  end if;

  return old;
end $fn$;

comment on function public.missions_delete_guard() is
  'BEFORE DELETE on missions. Refuses any delete that would cascade over runs, '
  'results or reports. ALSO BLOCKS DELETING A RESEARCHER auth.users ROW, because '
  'researcher_id cascades - use set local ksat.allow_cascade_delete = ''on''.';

-- A trigger function has no business being a PostgREST endpoint. This is
-- the lesson of 10_advisor_fixes.sql section 1, where the Advisor found
-- missions_guard() callable by anon at /rest/v1/rpc/missions_guard.
-- PostgreSQL grants EXECUTE on every new function to PUBLIC by default,
-- so the revoke lives here, beside the thing it protects.
revoke execute on function public.missions_delete_guard()
  from public, anon, authenticated, service_role;

drop trigger if exists missions_delete_guard_bd on public.missions;
create trigger missions_delete_guard_bd
  before delete on public.missions
  for each row execute function public.missions_delete_guard();


-- =====================================================================
-- 3 · AN ARCHIVED MISSION DOES NOT RUN
--
-- archive_mission() refuses while a run is active, but that leaves the
-- other order: archive a finished mission, then press Launch on a stale
-- tab. Rather than edit launch_mission() in 05_views_rpc.sql and leave
-- two files disagreeing about one function, the rule goes where nothing
-- can route around it - a trigger on the row that would be created.
-- This also covers claim-side and any future launcher.
-- =====================================================================
create or replace function public.mission_runs_archive_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare v_archived timestamptz;
begin
  select m.archived_at into v_archived
    from public.missions m where m.id = new.mission_id;

  if v_archived is not null then
    raise exception 'This mission is archived. Restore it first.'
      using errcode = 'P0001';
  end if;

  return new;
end $fn$;

revoke execute on function public.mission_runs_archive_guard()
  from public, anon, authenticated, service_role;

drop trigger if exists mission_runs_archive_guard_bi on public.mission_runs;
create trigger mission_runs_archive_guard_bi
  before insert on public.mission_runs
  for each row execute function public.mission_runs_archive_guard();


-- =====================================================================
-- 4 · archive_mission / restore_mission — THE EVERYDAY ACTION
--
-- Reversible, destroys nothing, works in any status. The only refusal is
-- an active run: a pipeline writing steps into a mission the researcher
-- believes is gone is a screen that lies.
--
-- 'This mission is already running.' is reused WORD FOR WORD from
-- launch_mission(). The SAFE allowlist in js/ksat-workflow.js already
-- matches it, so this sentence needs no front-end change.
--
-- DELIBERATE NON-FEATURE: archiving does NOT refund quota.
-- missions_guard() counts rows created in the last hour/day and does not
-- look at archived_at. If archiving gave the hour back, archive becomes
-- the documented way around the rate limit.
-- =====================================================================
create or replace function public.archive_mission(p_mission_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  -- Same sentence for "does not exist" and "is not yours". A different
  -- message would confirm the mission exists. 09_researcher_write_path.sql
  -- line 46-51 is the note that owns this reasoning.
  if not public.owns_mission(p_mission_id) then
    raise exception 'Mission not found.' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.mission_runs
              where mission_id = p_mission_id
                and status in ('queued','running')) then
    raise exception 'This mission is already running.' using errcode = 'P0001';
  end if;

  -- coalesce, not now(): archiving twice is a no-op, not a rewrite of
  -- when it was archived. A double-click must not move the timestamp.
  update public.missions
     set archived_at = coalesce(archived_at, now())
   where id = p_mission_id;
end $fn$;

create or replace function public.restore_mission(p_mission_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  if not public.owns_mission(p_mission_id) then
    raise exception 'Mission not found.' using errcode = 'P0001';
  end if;

  update public.missions set archived_at = null where id = p_mission_id;
end $fn$;


-- =====================================================================
-- 5 · edit_draft_mission — TITLE AND OBJECTIVE, BEFORE ANYTHING RAN
--
-- Two columns. Not status, not researcher_id, not injection_flag, not
-- area_geojson - the area bounds what the Satellite Data Agent can ever
-- be pointed at (06_validation.sql line 164), so it is a guardrail, not
-- a form field, and moving it is a new mission.
--
-- >>> THE TEST IS THE EVIDENCE, NOT THE LABEL. <<<
-- status='draft' is checked, but the real check is that no run and no
-- report exists. status is a text column with a CHECK on it; the runs
-- table is the thing that would contradict an edited objective. If those
-- two ever disagree, the rows win.
--
-- The length and has-a-letter CHECK constraints from 06_validation.sql
-- fire on UPDATE as well as INSERT, so they are a free second wall. The
-- raises below exist so the researcher gets our sentence instead of
-- "new row for relation missions violates check constraint".
-- =====================================================================
create or replace function public.edit_draft_mission(
  p_mission_id uuid,
  p_title      text,
  p_objective  text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_status   text;
  v_archived timestamptz;
  v_title    text;
  v_obj      text;
begin
  if not public.owns_mission(p_mission_id) then
    raise exception 'Mission not found.' using errcode = 'P0001';
  end if;

  select m.status, m.archived_at into v_status, v_archived
    from public.missions m where m.id = p_mission_id;

  if v_archived is not null then
    raise exception 'This mission is archived. Restore it first.'
      using errcode = 'P0001';
  end if;

  if exists (select 1 from public.mission_runs where mission_id = p_mission_id)
     or exists (select 1 from public.reports  where mission_id = p_mission_id)
     or v_status <> 'draft' then
    raise exception 'This mission has already been run and can no longer be edited.'
      using errcode = 'P0001',
            hint = 'The objective is the text the agents read. Start a new mission.';
  end if;

  v_title := btrim(coalesce(p_title, ''));
  v_obj   := btrim(coalesce(p_objective, ''));

  if char_length(v_title) not between 3 and 120 then
    raise exception 'A mission name is between 3 and 120 characters.'
      using errcode = 'P0001';
  end if;
  if char_length(v_obj) not between 20 and 1500 then
    raise exception 'A research objective is between 20 and 1500 characters.'
      using errcode = 'P0001';
  end if;

  -- Negative match, exactly as missions_objective_has_letter is written:
  -- `~ '[[:alpha:]]'` depends on lc_ctype and can return false for
  -- Arabic. This form accepts Arabic, English and anything else.
  if v_title ~ '^[0-9[:space:][:punct:]]*$'
     or v_obj ~ '^[0-9[:space:][:punct:]]*$' then
    raise exception 'The name and the objective both have to contain letters.'
      using errcode = 'P0001';
  end if;

  update public.missions
     set title = v_title, objective = v_obj
   where id = p_mission_id;
end $fn$;


-- =====================================================================
-- 6 · delete_draft_mission — THE NARROW, HONEST ONE
--
-- A mission with no run, no result and no report has nothing behind it.
-- Deleting it destroys no evidence because there is none, and the
-- cascade has nothing to reach. That is the entire argument for letting
-- this exist at all.
--
-- reports is checked as well as mission_runs, and not out of tidiness:
-- generate_report() checks ownership and body length only, so a report
-- on a never-launched mission is possible. "No runs" alone is the wrong
-- test.
--
-- mission_collaborators rows still cascade. Accepted: share_mission() is
-- not deployed (05_views_rpc.sql line 220), so that table holds no rows.
--
-- The tripwire in section 2 re-checks all of this as the delete happens.
-- Two walls for one verb, and the outer one does not trust this function.
-- =====================================================================
create or replace function public.delete_draft_mission(p_mission_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  if not public.owns_mission(p_mission_id) then
    raise exception 'Mission not found.' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.mission_runs where mission_id = p_mission_id)
     or exists (select 1 from public.results  where mission_id = p_mission_id)
     or exists (select 1 from public.reports  where mission_id = p_mission_id) then
    raise exception
      'This mission has evidence behind it and cannot be deleted. Archive it instead.'
      using errcode = 'P0001';
  end if;

  delete from public.missions where id = p_mission_id;
end $fn$;


-- =====================================================================
-- 7 · GRANTS ON THE FOUR NEW FUNCTIONS
--
-- Same shape as every write path in this folder: take it from everyone
-- first, then hand it to exactly one role. `from public` is the line
-- that matters - PostgreSQL grants EXECUTE on every new function to
-- PUBLIC, which includes anon, and that default is what the Security
-- Advisor caught this project with twice (10_advisor_fixes.sql §4).
--
-- service_role is named explicitly and gets nothing. n8n has no business
-- archiving, editing or deleting a researcher's mission, and 03_grants.sql
-- line 56-58 is the rule being applied without an exception.
-- =====================================================================
revoke execute on function
  public.archive_mission(uuid),
  public.restore_mission(uuid),
  public.edit_draft_mission(uuid, text, text),
  public.delete_draft_mission(uuid)
  from public, anon, service_role;

grant execute on function
  public.archive_mission(uuid),
  public.restore_mission(uuid),
  public.edit_draft_mission(uuid, text, text),
  public.delete_draft_mission(uuid)
  to authenticated;


-- =====================================================================
-- 8 · my_missions — ONE COLUMN APPENDED
--
-- This SUPERSEDES the definition in 05_views_rpc.sql lines 32-47, the
-- same way 14_widen_mission_envelope.sql supersedes kuwait_area_ok() in
-- 06. A rebuild runs 05 then 15, so 15 wins. Do NOT hand-edit 05 out of
-- step with this file; change one and you have two truths.
--
-- The view deliberately does NOT filter archived rows out. A researcher
-- who cannot see their archive cannot restore from it. The filter is the
-- page's, the column is the database's.
--
-- `create or replace view` may only APPEND columns - archived_at is last
-- for that reason. If this errors with "cannot change name of view
-- column", the live view has drifted from 05 and someone edited it in
-- the dashboard; find out what changed before you drop anything.
-- Grants survive create or replace, so my_missions keeps its grant.
-- =====================================================================
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
         where r.mission_id = m.id and r.status = 'complete') as finding_count,
       m.archived_at
from public.missions m
where m.researcher_id = (select auth.uid())
   or public.is_collaborator(m.id);


-- =====================================================================
-- 9 · VERIFY — run these and read them. Do not take this file's word.
-- =====================================================================

-- 9.1 · THE ONE THAT MATTERS MOST. Expected: ZERO ROWS.
--       No UPDATE and no DELETE grant reached any table.
-- select grantee, table_name, privilege_type
--   from information_schema.role_table_grants
--  where table_schema = 'public'
--    and grantee in ('anon','authenticated','service_role')
--    and privilege_type in ('UPDATE','DELETE','TRUNCATE')
--    and table_name <> 'payload_frames';   -- 13 grants service_role update
-- ORDER BY 1,2;

-- 9.2 · agent_steps, results and reports are untouched. Expected: the
--       exact column lists from 03_grants.sql lines 98-115, SELECT only.
-- select table_name, privilege_type, column_name
--   from information_schema.column_privileges
--  where table_schema='public' and grantee='authenticated'
--    and table_name in ('agent_steps','results','reports')
--  order by 1,3;

-- 9.3 · missions gained SELECT on archived_at and nothing else.
--       Expected: 10 SELECT rows, 3 INSERT rows, no UPDATE, no DELETE.
-- select privilege_type, column_name
--   from information_schema.column_privileges
--  where table_schema='public' and table_name='missions'
--    and grantee='authenticated'
--  order by 1,2;

-- 9.4 · anon can call none of the four. Expected: anon false on all.
-- select p.proname,
--        has_function_privilege('anon',          p.oid,'EXECUTE') as anon,
--        has_function_privilege('authenticated', p.oid,'EXECUTE') as auth,
--        has_function_privilege('service_role',  p.oid,'EXECUTE') as svc
--   from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--  where n.nspname='public'
--    and p.proname in ('archive_mission','restore_mission',
--                      'edit_draft_mission','delete_draft_mission',
--                      'missions_delete_guard','mission_runs_archive_guard')
--  order by 1;
--   EXPECTED: the four researcher functions  false / true  / false
--             the two trigger functions      false / false / false

-- 9.5 · Both triggers are attached. Expected: two rows, tgenabled = 'O'.
-- select c.relname as table_name, t.tgname, t.tgenabled
--   from pg_trigger t join pg_class c on c.oid=t.tgrelid
--  where not t.tgisinternal
--    and t.tgname in ('missions_delete_guard_bd','mission_runs_archive_guard_bi');

-- 9.6 · THE TRIPWIRE, PROVEN. Pick a mission that HAS runs and try it.
--       Expected: "This mission has evidence behind it and cannot be
--       deleted." and, critically, the counts below UNCHANGED afterwards.
-- select (select count(*) from public.mission_runs) as runs,
--        (select count(*) from public.agent_steps)  as steps,
--        (select count(*) from public.results)      as results,
--        (select count(*) from public.reports)      as reports;
-- -- then, in a transaction you ROLL BACK:
-- --   begin;
-- --     delete from public.missions
-- --      where id = (select mission_id from public.mission_runs limit 1);
-- --   rollback;

-- 9.7 · As a signed-in researcher in the browser console, the round trip:
-- --   await sb.rpc('archive_mission',      { p_mission_id: '<id>' })
-- --   await sb.rpc('restore_mission',      { p_mission_id: '<id>' })
-- --   await sb.rpc('edit_draft_mission',   { p_mission_id: '<draft id>',
-- --                                          p_title: '...', p_objective: '...' })
-- --   await sb.rpc('delete_draft_mission', { p_mission_id: '<draft id>' })
-- -- and the two-account test: every one of them must answer
-- -- "Mission not found." for a mission belonging to the other account.


-- =====================================================================
-- 10 · WHAT THIS FILE CHANGES IN OTHER FILES
--      Read this before chasing a contradiction in one of them.
--
-- 03_grants.sql line 80-82 · "No UPDATE grant, no DELETE grant" is STILL
--   TRUE and must stay true. What changed is that missions is no longer
--   insert-only in EFFECT: four named functions can now update two
--   columns and delete an empty row. Add a line there pointing here.
--
-- 04_policies.sql line 160 · the PART 2 row
--     | (none) researcher | update,delete | missions | ZERO |
--   now needs "...from the browser. archive/restore/edit/delete of an
--   EMPTY mission go through the functions in file 15."
--
-- 05_views_rpc.sql lines 32-47 · my_missions is superseded by section 8.
--
-- js/ksat-workflow.js SAFE allowlist (line 187) · SIX new sentences.
--   The pairing is checked by hand; nothing enforces it, and a sentence
--   missing from the list reaches the researcher as the generic line:
--     /^This mission has evidence behind it and cannot be deleted\. Archive it instead\.$/
--     /^This mission is archived\. Restore it first\.$/
--     /^This mission has already been run and can no longer be edited\.$/
--     /^A mission name is between 3 and 120 characters\.$/
--     /^A research objective is between 20 and 1500 characters\.$/
--     /^The name and the objective both have to contain letters\.$/
--   'Mission not found.' and 'This mission is already running.' are
--   already in the list and are reused verbatim for exactly that reason.
--
-- 99_verify.sql · the isolation harness deletes nothing, so it is
--   unaffected. Its test rows, if you ever clean them up by hand, now
--   need the escape hatch once they have runs.
--
-- The audit panel copy · "append-only, a researcher cannot rewrite or
--   erase a mission" is no longer the whole truth and should become the
--   sharper claim, which is a better one to defend anyway:
--   "a researcher can hide a mission and can fix one that never ran;
--    nothing that has been run can be edited or deleted by anyone
--    through the application, and the database refuses the cascade even
--    from the SQL editor."
-- =====================================================================