-- =====================================================================
-- KuwaitSat-1 Mission Hub
-- 99 · VERIFY — run these yourself, do not take anyone's word
-- Owner: 03 · Security
--
-- RUN THIS FILE THREE TIMES:
--   · Sunday night, when you finish files 01-06
--   · Tuesday night, over the live schema
--   · Wednesday, one last time before the freeze
--
-- Tuesday matters most. A table somebody adds on Monday with RLS off is
-- a total leak, and nothing will tell you. This file is how you find out.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1 · Is RLS on for every table?  ANY "false" IS A BLOCKER.
-- ---------------------------------------------------------------------
select c.relname as table_name, c.relrowsecurity as rls_on
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by 1;


-- ---------------------------------------------------------------------
-- 2 · Every policy with its ROLE list.
-- A `roles` value of {public} is a FINDING: that policy applies to anon.
-- A `qual` of `true` is the demo lost. Read every row.
-- ---------------------------------------------------------------------
select tablename, policyname, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public'
order by tablename, policyname;


-- ---------------------------------------------------------------------
-- 3 · RLS ON but NO POLICY AT ALL = zero rows for everyone, including
-- the screens that are supposed to work.
-- `app_settings` is the ONLY name allowed to appear here THIS WEEK.
--
-- ONE LEGITIMATE EXCEPTION, so you do not chase it at 1am: if file
-- 07_admin_audit_PHASE2.sql has been run (it is "read, do not run" this
-- week), `app_admins` appears here too, and that is CORRECT and
-- deliberate - RLS on + no policy + no grant is exactly how 07 keeps the
-- administrator list unreadable from any browser. Its own BLOCK 4 says
-- so. If you see `app_admins` here and 07 was NOT run, that is a real
-- finding: somebody created the table by hand.
-- ANY OTHER NAME IS A BLOCKER.
-- ---------------------------------------------------------------------
select c.relname as table_with_rls_and_no_policy
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  and not exists (select 1 from pg_policies p
                  where p.schemaname = 'public' and p.tablename = c.relname);


-- ---------------------------------------------------------------------
-- 4 · >>> THE VIEW CHECK. The one everybody forgets. <<<
--
-- Queries 1 and 3 filter relkind = 'r' — TABLES ONLY. A view created
-- WITHOUT `security_invoker = on` runs with its OWNER's privileges and
-- BYPASSES RLS ENTIRELY.
--
-- So on Monday, when 02 helpfully adds
--     create view mission_overview as select * from missions join ...
-- every researcher sees every row, RLS is still "on" everywhere, and
-- queries 1-3 all come back clean.
--
-- ANY row here reading OFF is the same severity as RLS being off.
-- ---------------------------------------------------------------------
select c.relname as view_name,
       coalesce((select option_value
                 from pg_options_to_table(c.reloptions)
                 where option_name = 'security_invoker'), 'OFF') as invoker
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'v'
order by 1;


-- ---------------------------------------------------------------------
-- 5 · What can `anon` still touch?  THE ANSWER MUST BE ZERO ROWS.
-- ---------------------------------------------------------------------
select table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and grantee = 'anon';

-- ...and at COLUMN level, which the query above does not show:
select table_name, column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public' and grantee in ('anon','public')
order by 1,2;


-- ---------------------------------------------------------------------
-- 6 · Does service_role still hold table privileges?
-- After file 03 this must be ZERO ROWS. If it is not, the key in the n8n
-- credential store can read every mission in the database.
-- ---------------------------------------------------------------------
select table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and grantee = 'service_role';


-- ---------------------------------------------------------------------
-- 7 · se-m3 in ten seconds, a live answer for the judge:
-- there is no password column anywhere in our schema.
--
-- Word-bounded (\m \M) on purpose. A plain LIKE '%pass%' on a SATELLITE
-- project matches satellite_pass, orbital_pass and tokens_used, and your
-- "no rows returned" beat turns into three rows on the projector.
-- ---------------------------------------------------------------------
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and column_name ~* '\m(pass|passwd|pwd|passphrase|pin|secret|token|hash|credential)\M';


-- ---------------------------------------------------------------------
-- 8 · Every SECURITY DEFINER function must pin its search_path.
-- One without it is a privilege-escalation hole, not a helper.
-- Every row must show a search_path setting.
-- ---------------------------------------------------------------------
select p.proname as function_name,
       p.prosecdef as is_security_definer,
       p.proconfig as settings
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
order by 1;


-- ---------------------------------------------------------------------
-- 9 · The Arabic check. Run this BEFORE you trust file 06's letter rule.
-- Both must come back true. If arabic_ok is false, your objective
-- constraint refuses a legitimate Arabic mission on Thursday.
-- ---------------------------------------------------------------------
select 'خريطة الغطاء النباتي في الكويت' !~ '^[0-9[:space:][:punct:]]*$' as arabic_ok,
       'Vegetation cover map for Kuwait'  !~ '^[0-9[:space:][:punct:]]*$' as english_ok,
       '12345 !!! ???'                    !~ '^[0-9[:space:][:punct:]]*$' as junk_refused,
       current_setting('lc_ctype') as lc_ctype;
-- expected: true | true | false | (some UTF-8 locale)


-- =====================================================================
-- SEEDING RECIPE — write this down now, use it Monday.
--
-- Monday you will try to type test missions into the Supabase SQL editor
-- and every one will fail with "Sign in before launching a mission."
-- The SQL editor carries no JWT, so auth.uid() is null and the guard
-- trigger in file 06 refuses. The error points at sign-in, so you will
-- spend an hour looking at the wrong thing.
--
-- Keep the re-enable line in the SAME paste as the disable line, so it
-- cannot be forgotten:
--
--   alter table public.missions disable trigger missions_guard_bi;
--
--   -- get real ids first:  select id, email from auth.users;
--   insert into public.missions (researcher_id, title, objective, area_geojson)
--   values ('<paste a real uuid>', 'Jahra vegetation survey',
--           'Identify areas around Jahra where increasing vegetation could
--            reduce surface temperature and dust load.',
--           '{"type":"Polygon","coordinates":[[[47.6,29.3],[47.8,29.3],
--             [47.8,29.4],[47.6,29.4],[47.6,29.3]]]}'::jsonb);
--
--   alter table public.missions enable trigger missions_guard_bi;
--
-- Then re-run query 1. Leaving that trigger disabled is a silent
-- failure of se-m5 that nothing else in this file will catch.
-- =====================================================================


-- =====================================================================
-- §checkpoint · CAN THE REPORT BE WRITTEN WITHOUT PRESSING APPROVE?
--
-- Added 21 Sep 2026. This is the question a judge asks first, so it is
-- asked here rather than left to them. It is deliberately written to be
-- able to FAIL: test A is expected to be ACCEPTED, and that acceptance
-- is the honest finding, not a bug in the test.
--
-- SAFE TO RUN ON THE LIVE DATABASE. Everything happens inside a
-- transaction that is rolled back, and the final select re-counts the
-- reports table so you can see nothing was left behind.
--
-- Expected output, five rows:
--   A. owner -> own mission, no UI        ACCEPTED   <- the honest gap
--   B. approved_by is the caller          true       <- cannot be forged
--   C. researcher -> colleague's mission  REFUSED: Mission not found.
--   D. service_role (the agent)           REFUSED: permission denied ...
--   E. anon (signed out)                  REFUSED: permission denied ...
--
-- Read 03-security/evidence/se-m5-checkpoint-2026-09-21.md for what the
-- combination means. Short version: the card does not stop the owner,
-- and is not claimed to. The grant stops the AGENT, and that is the
-- guarantee worth having.
--
-- Substitute your own ids for :owner / :mission / :other_mission.
-- =====================================================================
begin;

create temp table _ck(ord int, test text, verdict text) on commit drop;

do $ck$
declare
  v_owner        uuid := 'REPLACE-WITH-A-RESEARCHER-UUID';
  v_own_mission  uuid := 'REPLACE-WITH-THAT-RESEARCHERS-MISSION';
  v_other        uuid := 'REPLACE-WITH-A-DIFFERENT-RESEARCHERS-MISSION';
  v_body         text := repeat('Filler so the fifty character minimum is met. ', 3);
  v_approver     uuid;
begin
  -- A · the owner, bypassing the UI completely.
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
    perform public.generate_report(v_own_mission, v_body);
    insert into _ck values (1, 'A. owner -> own mission, no UI', 'ACCEPTED');

    select approved_by into v_approver
      from public.reports where mission_id = v_own_mission
      order by approved_at desc limit 1;
    insert into _ck values (2, 'B. approved_by is the caller',
      case when v_approver = v_owner then 'true  (cannot be forged)'
           else 'FALSE  *** approved_by was not the caller ***' end);
  exception when others then
    insert into _ck values (1, 'A. owner -> own mission, no UI', 'REFUSED: '||sqlerrm);
  end;
  reset role;

  -- C · across accounts.
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
    perform public.generate_report(v_other, v_body);
    insert into _ck values (3, 'C. researcher -> colleague''s mission', 'ACCEPTED  *** HOLE ***');
  exception when others then
    insert into _ck values (3, 'C. researcher -> colleague''s mission', 'REFUSED: '||sqlerrm);
  end;
  reset role;

  -- D · the automation engine. THIS is the one that must never pass.
  begin
    set local role service_role;
    perform public.generate_report(v_own_mission, v_body);
    insert into _ck values (4, 'D. service_role (the agent)', 'ACCEPTED  *** HOLE ***');
  exception when others then
    insert into _ck values (4, 'D. service_role (the agent)', 'REFUSED: '||sqlerrm);
  end;
  reset role;

  -- E · a signed-out visitor.
  begin
    set local role anon;
    perform public.generate_report(v_own_mission, v_body);
    insert into _ck values (5, 'E. anon (signed out)', 'ACCEPTED  *** HOLE ***');
  exception when others then
    insert into _ck values (5, 'E. anon (signed out)', 'REFUSED: '||sqlerrm);
  end;
  reset role;
end $ck$;

select test, verdict from _ck order by ord;

rollback;

-- Nothing was left behind. Run this after the rollback:
select 'reports after the test' as check, count(*) as n from public.reports;
