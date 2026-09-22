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
-- TWO LEGITIMATE EXCEPTIONS, so you do not chase either at 1am.
--
-- 1. If file 07_admin_audit_PHASE2.sql has been run (it is "read, do not
--    run" this week), `app_admins` appears here too, and that is CORRECT
--    and deliberate - RLS on + no policy + no grant is exactly how 07
--    keeps the administrator list unreadable from any browser. Its own
--    BLOCK 4 says so. If you see `app_admins` here and 07 was NOT run,
--    that is a real finding: somebody created the table by hand.
--
-- 2. If file 11_monitoring.sql has been run, `monitoring_events` appears
--    here, for the same reason and on purpose: the nightly sweep log is
--    written by one SECURITY DEFINER function and read by another, and no
--    browser role holds a grant on the table at all. 11_monitoring.sql
--    section 1 is the written decision. Same rule as above - if it is
--    here and 11 was NOT run, somebody created the table by hand.
--
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
--   -- Look the researcher up by the one thing you actually know - their
--   -- email. This used to read `values ('<paste a real uuid>', ...)` with
--   -- `select id, email from auth.users;` above it, which meant copying a
--   -- uuid between two queries by eye; paste the wrong one and the mission
--   -- is seeded onto somebody else's account, where the owner cannot see
--   -- it and nothing reports an error. Put the email in and let the
--   -- database find the id.
--   insert into public.missions (researcher_id, title, objective, area_geojson)
--   values ((select id from auth.users where lower(email) = lower('researcher-a@ksat.demo')),
--           'Jahra vegetation survey',
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
-- Expected output, six rows:
--   0. discovered                         which mission and which two
--                                         researchers this run used
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
-- >>> THERE IS NOT ONE UUID IN THIS BLOCK EITHER <<<
-- Rewritten 22 Sep 2026. Until today this block opened with three
-- placeholders - REPLACE-WITH-A-RESEARCHER-UUID and two more - and the
-- header said "substitute your own ids". That is the same defect
-- tests/two-window-check.js was rewritten to remove, and the §isolation
-- block below was written from the start to avoid: a pasted id is
-- correct for exactly as long as that row exists, and a file that must
-- be edited before it runs is a file that gets run unedited. The
-- placeholder version of this block did not fail loudly when somebody
-- forgot - `'REPLACE-WITH-A-RESEARCHER-UUID'::uuid` raises a cast error
-- on the first line, which reads like a broken script rather than a
-- missed step, and tells the reader nothing about the checkpoint.
--
-- It now discovers its own three ids from public.missions, the way
-- §isolation discovers its researchers from public.profiles. Nothing in
-- this file has to be edited before it is run, anywhere.
--
-- WHAT IT PICKS, AND WHY EACH CONDITION IS THERE:
--   - the oldest mission that HAS NO REPORT YET, and its owner. The
--     no-report condition matters once db/11_monitoring.sql has been
--     run, because 11 adds the reports_one_per_mission unique index: on
--     a mission that already has a report, test A would raise a
--     duplicate-key error and print REFUSED. That would look exactly
--     like the checkpoint holding, when in fact it is the index doing
--     something unrelated. Test A is the one line here that is supposed
--     to read ACCEPTED, so a false REFUSED on it is the worst possible
--     failure mode for this block.
--   - the oldest mission belonging to ANY OTHER researcher, for test C.
--     Ordering by created_at then id makes the choice stable across
--     runs, so two people running this get the same rows and the same
--     output.
--
-- If the database cannot supply those, the block says so in row 0 and
-- skips the tests it cannot run, rather than inventing a verdict. An
-- empty missions table is not a security finding, and neither is a
-- database with only one researcher in it - but a block that silently
-- reported four refusals in either case would be lying.
-- =====================================================================
begin;

create temp table _ck(ord int, test text, verdict text) on commit drop;

do $ck$
declare
  -- Discovered below. Not one of these is pasted in.
  v_owner        uuid;
  v_own_mission  uuid;
  v_other        uuid;
  v_other_owner  uuid;
  v_owner_name   text;
  v_other_name   text;
  v_body         text := repeat('Filler so the fifty character minimum is met. ', 3);
  v_approver     uuid;
  v_a            text;
  v_c            text;
  v_d            text;
  v_e            text;
begin
  -- >>> DISCOVERY · the three ids this block used to ask you to paste <<<
  --
  -- Read as the table OWNER, before any `set local role`. That is
  -- deliberate and it is the same reason §isolation reads its totals as
  -- the owner: 01_tables_rls.sql does not use `force row level
  -- security`, so the owner sees the real contents of the table. Running
  -- discovery as `authenticated` would return only the rows one
  -- researcher can see, which is the thing being tested - the test would
  -- be choosing its subject using the mechanism under test.
  --
  -- `not exists (select 1 from public.reports ...)` rather than a left
  -- join: this only asks whether a report exists, and a join would have
  -- to be made distinct afterwards.
  select m.researcher_id, m.id
    into v_owner, v_own_mission
    from public.missions m
   where not exists (select 1 from public.reports r where r.mission_id = m.id)
   order by m.created_at, m.id
   limit 1;

  if v_owner is null then
    insert into _ck values (0, '0. discovered',
      'NOTHING TO TEST. public.missions holds no mission without a report, so there is '
      || 'no subject for test A. Create a mission as the demo researcher and re-run. '
      || 'This is not a finding.');
    return;
  end if;

  select p.display_name into v_owner_name
    from public.profiles p where p.user_id = v_owner;

  -- The colleague's mission, for test C. Any mission owned by anyone
  -- else will do; it does not need to be report-free, because test C is
  -- supposed to be refused before generate_report reaches the insert.
  select m.id, m.researcher_id
    into v_other, v_other_owner
    from public.missions m
   where m.researcher_id <> v_owner
   order by m.created_at, m.id
   limit 1;

  if v_other is not null then
    select p.display_name into v_other_name
      from public.profiles p where p.user_id = v_other_owner;
  end if;

  insert into _ck values (0, '0. discovered',
    'owner ' || coalesce(v_owner_name, '(no profile row)')
    || ' · mission ' || left(v_own_mission::text, 8)
    || ' · colleague ' || coalesce(v_other_name, '(none)')
    || ' · colleague mission ' || coalesce(left(v_other::text, 8), 'NONE')
    || case when v_other is null
            then '  *** test C WILL BE SKIPPED: every mission in the database belongs to '
                 || 'one researcher, so there is no colleague to be refused. Create a '
                 || 'second account with a mission, exactly as se-m1 needs. ***'
            else '' end);

  -- >>> WHY EVERY `insert into _ck` NOW HAPPENS AFTER `reset role` <<<
  -- Fixed 21 Sep 2026, during review. Until then each test wrote its own
  -- verdict row while the session was still `set local role
  -- authenticated` / `service_role` / `anon`. None of those roles holds a
  -- grant on `_ck` - it is a temp table created by `postgres`, and a temp
  -- table gets no grants it is not given - so the INSERT itself raised
  -- `permission denied for table _ck`, the surrounding handler caught THAT
  -- error instead of the one the test was about, and the row that landed
  -- read `REFUSED: permission denied for table _ck`.
  --
  -- Read what that does to each line. Test A reports REFUSED when the
  -- owner was in fact ACCEPTED, which hides the honest gap this block
  -- exists to show, and test B never runs at all. Worse, in C, D and E the
  -- insert is only REACHED when generate_report SUCCEEDED - the hole case
  -- - so a real hole would have been reported as a refusal. A security
  -- check whose failure mode is printing "REFUSED" is not a check.
  --
  -- The fix is to keep the role switch around the call being tested and
  -- nothing else: record the verdict in a plpgsql variable, which a
  -- subtransaction rollback does not touch, and write the row once the
  -- role is back. The §isolation block below already did it this way and
  -- says so in its own comment; this block now matches it.

  -- A · the owner, bypassing the UI completely.
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
    perform public.generate_report(v_own_mission, v_body);
    v_a := 'ACCEPTED';
  exception when others then
    v_a := 'REFUSED: '||sqlerrm;
  end;
  reset role;

  insert into _ck values (1, 'A. owner -> own mission, no UI', v_a);

  -- B only means anything if A actually wrote a report, exactly as before.
  -- The read is deliberately NOT done as `authenticated`: we want the row
  -- that was written, not the rows one researcher is allowed to see, and
  -- the question here is whose id ended up in approved_by.
  if v_a = 'ACCEPTED' then
    select approved_by into v_approver
      from public.reports where mission_id = v_own_mission
      order by approved_at desc limit 1;
    insert into _ck values (2, 'B. approved_by is the caller',
      case when v_approver = v_owner then 'true  (cannot be forged)'
           else 'FALSE  *** approved_by was not the caller ***' end);
  end if;

  -- C · across accounts.
  --
  -- Guarded on v_other because a single-researcher database has no
  -- colleague to be refused by. Calling generate_report(null, ...) would
  -- take the `owns_mission` branch and record a tidy
  -- 'REFUSED: Mission not found.' - a green-looking line proving nothing
  -- at all, since a null id is refused whatever the policies say. That
  -- is the shape of failure this file exists to catch, so it is refused
  -- here rather than printed.
  if v_other is null then
    insert into _ck values (3, 'C. researcher -> colleague''s mission',
      'SKIPPED - no second researcher with a mission. See row 0.');
  else
    begin
      set local role authenticated;
      perform set_config('request.jwt.claims',
        json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
      perform public.generate_report(v_other, v_body);
      v_c := 'ACCEPTED  *** HOLE ***';
    exception when others then
      v_c := 'REFUSED: '||sqlerrm;
    end;
    reset role;
    insert into _ck values (3, 'C. researcher -> colleague''s mission', v_c);
  end if;

  -- D · the automation engine. THIS is the one that must never pass.
  begin
    set local role service_role;
    perform public.generate_report(v_own_mission, v_body);
    v_d := 'ACCEPTED  *** HOLE ***';
  exception when others then
    v_d := 'REFUSED: '||sqlerrm;
  end;
  reset role;
  insert into _ck values (4, 'D. service_role (the agent)', v_d);

  -- E · a signed-out visitor.
  begin
    set local role anon;
    perform public.generate_report(v_own_mission, v_body);
    v_e := 'ACCEPTED  *** HOLE ***';
  exception when others then
    v_e := 'REFUSED: '||sqlerrm;
  end;
  reset role;
  insert into _ck values (5, 'E. anon (signed out)', v_e);
end $ck$;

select test, verdict from _ck order by ord;

rollback;

-- Nothing was left behind. Run this after the rollback:
select 'reports after the test' as check, count(*) as n from public.reports;


-- =====================================================================
-- §isolation · se-m1, RE-PROVED ON DEMAND, WITH NO IDS PASTED INTO IT
--
-- Added 21 Sep 2026. The isolation matrix in
-- 03-security/evidence/se-m1-isolation-matrix-2026-09-21.md was produced
-- by hand, by impersonating each researcher's JWT one at a time and
-- writing the numbers down. Numbers written down go stale, and a reader
-- has no way to tell a recorded pass from a recorded hope. This block is
-- that same matrix as something you RUN, and it is the block that file
-- points at.
--
-- >>> WHY THERE IS NOT ONE UUID IN IT <<<
-- A pasted id is correct for exactly as long as that row exists. This
-- block discovers its own accounts by reading public.profiles, so it is
-- still true next week, on a rebuilt database, with different people in
-- it. Nothing in it has to be edited before it is run.
--
-- This paragraph used to read "every other two-account test in this repo
-- needs somebody to paste an id", and named
-- 03-security/tests/two-window-check.js and the §checkpoint block above
-- as the two examples. That is no longer true of either: two-window-check
-- now asks the API for Researcher A's mission id, and §checkpoint was
-- given the same treatment on 22 Sep 2026 and discovers all three of its
-- ids from public.missions. This file now contains no placeholder
-- anywhere, which is the property worth keeping - if you add a block,
-- discover its ids rather than asking the reader for them.
--
-- SAFE TO RUN ON THE LIVE DATABASE. It writes nothing anywhere: four
-- temp tables - _iso, _iso_total, _iso_note and _iso_people - inside a
-- transaction that is rolled back, and reads. They are named here rather
-- than counted loosely because "it writes nothing" is the claim a reader
-- has to be able to check by eye, and this line said "three" while the
-- block below created four.
--
-- HOW IT WORKS. For each row of public.profiles it becomes that person
-- the way PostgREST does - `set local role authenticated` plus a
-- request.jwt.claims with their user_id as `sub` - and collects the row
-- IDS they can see in six tables. Then it compares, per table:
--
--     sum of what each researcher sees   vs   what is actually there
--     rows visible to more than one researcher   (must be 0)
--     rows visible to nobody                     (must be 0)
--
-- Counting IDs rather than counts is deliberate. Two researchers each
-- seeing one row of a two-row table sums to 2 whether or not it is the
-- SAME row twice, and "the sums add up" would then be true of a total
-- leak. The overlap column is what makes this a partition test.
--
-- >>> THE GRANT TRAP, so nobody rewrites this with count(*) <<<
-- 03_grants.sql gives `authenticated` column-level SELECT and never a
-- whole-table grant. `count(*)` is a reference to the table rather than
-- to a column, so a version of this block written with count(*) can
-- report "permission denied" for reasons that have nothing to do with
-- RLS. Every aggregate below names the primary key column, which is in
-- the grant on every one of these six tables.
--
-- WHAT A PASS LOOKS LIKE: every row of the THIRD result reads
-- EXACT PARTITION, and in the FIRST result the `reading auth.users ->`
-- line for every researcher reads `refused:`.
--
-- Those two pointers were the wrong way round until 21 Sep 2026: this
-- line said the verdicts were in the second result and auth.users in the
-- third. The second result is the matrix of COUNTS - worth reading, but
-- it asserts nothing and cannot fail - so anybody following the header
-- would have checked the one result that is incapable of reporting a
-- leak and never reached the verdict column. A pointer into the wrong
-- result is the same failure as the evidence file pointing at a block
-- that did not exist, which is what this whole section was added to fix.
-- =====================================================================
begin;

create temp table _iso (
  researcher   uuid,
  display_name text,
  tbl          text,
  row_id       uuid
) on commit drop;

create temp table _iso_total (
  tbl         text primary key,
  in_database bigint
) on commit drop;

create temp table _iso_note (ord int, note text) on commit drop;

-- Every researcher discovered, whether or not they can see a single row.
-- THE REASON THIS TABLE EXISTS: driving the matrix off _iso alone drops an
-- account that sees nothing, because it contributed no rows to join to —
-- and an empty account is precisely the case the first se-m1 run had (Dr
-- Yousef at 0/0/0/0, which the evidence file says "proves very little").
-- An account that vanishes from the matrix proves even less.
create temp table _iso_people (researcher uuid primary key, display_name text) on commit drop;

do $iso$
declare
  r          record;
  n_people   int := 0;
  a_missions uuid[];
  a_runs     uuid[];
  a_steps    uuid[];
  a_results  uuid[];
  a_reports  uuid[];
  a_profiles uuid[];
  v_users    text;
  v_n        bigint;
begin
  -- The totals are read as the table OWNER, which RLS does not apply to
  -- (01_tables_rls.sql deliberately does NOT use `force row level
  -- security`). So these are the real contents of the database, which is
  -- exactly what the per-researcher views have to add up to.
  insert into _iso_total (tbl, in_database) values
    ('missions',     (select count(*) from public.missions)),
    ('mission_runs', (select count(*) from public.mission_runs)),
    ('agent_steps',  (select count(*) from public.agent_steps)),
    ('results',      (select count(*) from public.results)),
    ('reports',      (select count(*) from public.reports)),
    ('profiles',     (select count(*) from public.profiles));

  for r in select p.user_id, p.display_name
             from public.profiles p
            order by p.display_name loop

    n_people := n_people + 1;
    insert into _iso_people values (r.user_id, r.display_name);

    a_missions := '{}'; a_runs    := '{}'; a_steps   := '{}';
    a_results  := '{}'; a_reports := '{}'; a_profiles := '{}';

    -- Wrapped so that one refused table reports itself and the rest of
    -- the matrix still prints. A block that dies halfway leaves you
    -- staring at an error message instead of at the six tables you came
    -- to check.
    begin
      set local role authenticated;
      perform set_config('request.jwt.claims',
        json_build_object('sub', r.user_id, 'role', 'authenticated')::text, true);

      select coalesce(array_agg(m.id), '{}'::uuid[]) into a_missions from public.missions m;
      select coalesce(array_agg(x.id), '{}'::uuid[]) into a_runs     from public.mission_runs x;
      select coalesce(array_agg(s.id), '{}'::uuid[]) into a_steps    from public.agent_steps s;
      select coalesce(array_agg(z.id), '{}'::uuid[]) into a_results  from public.results z;
      select coalesce(array_agg(b.id), '{}'::uuid[]) into a_reports  from public.reports b;
      select coalesce(array_agg(f.user_id), '{}'::uuid[]) into a_profiles from public.profiles f;
    exception when others then
      -- The role is restored by the subtransaction rollback on its own,
      -- but say it out loud: the very next statement writes to a temp
      -- table that `authenticated` holds no grant on, and a handler that
      -- fails inside a handler reports nothing at all.
      reset role;
      insert into _iso_note values (9,
        'READ FAILED for ' || r.display_name || ': ' || sqlerrm ||
        '  - the numbers below are incomplete for this researcher.');
    end;
    reset role;

    insert into _iso select r.user_id, r.display_name, 'missions',     t.id from unnest(a_missions) as t(id);
    insert into _iso select r.user_id, r.display_name, 'mission_runs', t.id from unnest(a_runs)     as t(id);
    insert into _iso select r.user_id, r.display_name, 'agent_steps',  t.id from unnest(a_steps)    as t(id);
    insert into _iso select r.user_id, r.display_name, 'results',      t.id from unnest(a_results)  as t(id);
    insert into _iso select r.user_id, r.display_name, 'reports',      t.id from unnest(a_reports)  as t(id);
    insert into _iso select r.user_id, r.display_name, 'profiles',     t.id from unnest(a_profiles) as t(id);

    -- The last column of the evidence matrix: can a researcher read the
    -- table that holds the password hashes? The answer has to be a
    -- refusal, not a filtered list of colleagues.
    begin
      set local role authenticated;
      perform set_config('request.jwt.claims',
        json_build_object('sub', r.user_id, 'role', 'authenticated')::text, true);
      select count(*) into v_n from auth.users;
      v_users := 'ACCEPTED *** ' || v_n || ' rows *** THIS IS A BLOCKER';
    exception when others then
      v_users := 'refused: ' || left(sqlerrm, 60);
    end;
    reset role;

    insert into _iso_note values (5, r.display_name || ' reading auth.users -> ' || v_users);
  end loop;

  perform set_config('request.jwt.claims', '', true);

  -- >>> A ZERO FROM NOBODY PROVES NOTHING <<<
  -- With no profiles rows the loop never runs, every sum below is 0 and
  -- every comparison passes vacuously. two-window-check.js refuses to
  -- report a pass from a signed-out window for the same reason, and so
  -- does this.
  if n_people = 0 then
    insert into _iso_note values (1,
      'NO RESEARCHERS FOUND in public.profiles. This block proved NOTHING. ' ||
      'Create the demo accounts, sign in once so a profile row exists, and re-run.');
  elsif n_people = 1 then
    insert into _iso_note values (1,
      'Only ONE researcher in public.profiles. The sums can still be checked, ' ||
      'but "B cannot read A" cannot be - there is no B. Create the second account.');
  else
    insert into _iso_note values (1,
      n_people || ' researchers discovered in public.profiles. No id was pasted into this block.');
  end if;
end $iso$;

-- ---------------------------------------------------------------------
-- isolation · result 1 of 3 · what the block found out about itself
-- ---------------------------------------------------------------------
select note from _iso_note order by ord, note;

-- ---------------------------------------------------------------------
-- isolation · result 2 of 3 · THE MATRIX, in the shape the evidence file
-- prints it. The last two rows must be identical.
-- ---------------------------------------------------------------------
-- count(i.row_id), not count(*): the left join keeps a researcher who sees
-- nothing, and count(*) would score their one null-extended row as a 1.
select 1 as ord, p.display_name as signed_in_as,
       count(i.row_id) filter (where i.tbl = 'missions')     as missions,
       count(i.row_id) filter (where i.tbl = 'mission_runs') as runs,
       count(i.row_id) filter (where i.tbl = 'agent_steps')  as steps,
       count(i.row_id) filter (where i.tbl = 'results')      as results,
       count(i.row_id) filter (where i.tbl = 'reports')      as reports,
       count(i.row_id) filter (where i.tbl = 'profiles')     as profiles
from _iso_people p
left join _iso i on i.researcher = p.researcher
group by p.researcher, p.display_name
union all
select 2, 'SUM of all researchers',
       count(*) filter (where i.tbl = 'missions'),
       count(*) filter (where i.tbl = 'mission_runs'),
       count(*) filter (where i.tbl = 'agent_steps'),
       count(*) filter (where i.tbl = 'results'),
       count(*) filter (where i.tbl = 'reports'),
       count(*) filter (where i.tbl = 'profiles')
from _iso i
union all
select 3, 'ACTUALLY in the database',
       (select in_database from _iso_total where tbl = 'missions'),
       (select in_database from _iso_total where tbl = 'mission_runs'),
       (select in_database from _iso_total where tbl = 'agent_steps'),
       (select in_database from _iso_total where tbl = 'results'),
       (select in_database from _iso_total where tbl = 'reports'),
       (select in_database from _iso_total where tbl = 'profiles')
order by ord, signed_in_as;

-- ---------------------------------------------------------------------
-- isolation · result 3 of 3 · THE ASSERTION. Six rows, every verdict
-- must read EXACT PARTITION.
--
-- The three ways it can read otherwise, and what each one means:
--
--   OVERLAP   two researchers hold the same row id. THE BLOCKER. Today
--             it can only happen through mission_collaborators, which is
--             empty by construction (05_views_rpc.sql leaves
--             share_mission() undeployed, so is_collaborator() can only
--             ever return false). If sharing is ever deployed, this line
--             starts reading OVERLAP legitimately and this comment has
--             to be rewritten before the verdict is trusted.
--
--   HIDDEN    rows nobody can see. Usually not a leak and sometimes
--             correct - `results` rows still at status 'draft' are
--             hidden from their own owner on purpose (04_policies.sql,
--             the status gate). It is still worth reading every time: a
--             researcher who cannot see their own finished work is a
--             missing policy, and a missing policy looks exactly like a
--             perfect lock.
--
--   IMPOSSIBLE more distinct rows were seen than the table holds. That
--             cannot happen against one database and means the block
--             itself is wrong, not the schema. Do not report it as a
--             finding; fix this file.
-- ---------------------------------------------------------------------
with seen as (
  select i.tbl,
         count(*)                 as sum_of_views,
         count(distinct i.row_id) as rows_seen_by_someone
  from _iso i group by i.tbl),
shared as (
  select d.tbl, count(*) as rows_seen_by_more_than_one
  from (select i.tbl, i.row_id
          from _iso i
         group by i.tbl, i.row_id
        having count(distinct i.researcher) > 1) d
  group by d.tbl)
select t.tbl                                          as table_name,
       t.in_database,
       coalesce(s.sum_of_views, 0)                    as sum_of_researcher_views,
       coalesce(s.rows_seen_by_someone, 0)            as seen_by_someone,
       coalesce(h.rows_seen_by_more_than_one, 0)      as seen_by_more_than_one,
       t.in_database - coalesce(s.rows_seen_by_someone, 0) as seen_by_nobody,
       case
         when coalesce(h.rows_seen_by_more_than_one, 0) > 0
           then 'OVERLAP *** ' || h.rows_seen_by_more_than_one ||
                ' row(s) visible to two researchers ***'
         when coalesce(s.rows_seen_by_someone, 0) > t.in_database
           then 'IMPOSSIBLE - this block is wrong, not the schema'
         when t.in_database > coalesce(s.rows_seen_by_someone, 0)
           then 'HIDDEN - ' || (t.in_database - coalesce(s.rows_seen_by_someone, 0)) ||
                ' row(s) visible to nobody'
         else 'EXACT PARTITION'
       end                                            as verdict
from _iso_total t
left join seen   s on s.tbl = t.tbl
left join shared h on h.tbl = t.tbl
order by t.tbl;

rollback;

-- Nothing was written. Prove it rather than claiming it - these two must
-- match the `in_database` column above:
select 'after §isolation' as check,
       (select count(*) from public.missions) as missions,
       (select count(*) from public.reports)  as reports;
