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
-- `app_settings` is the ONLY name allowed to appear here.
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
