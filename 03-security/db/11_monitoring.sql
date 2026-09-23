-- >>> APPLIED TO THE LIVE DATABASE ON 23 Sep 2026. <<<
-- Every check in section 6 was run against it afterwards and every one
-- matched: RLS on, zero table grants, zero column grants, monitor_health
-- authenticated-only, monitor_record service_role-only, both SECURITY
-- DEFINER with search_path pinned, reports_one_per_mission UNIQUE.
-- The generate_report() wording change section 5 recommends went in at
-- the same time and is written into 05_views_rpc.sql.

-- =====================================================================
-- KuwaitSat-1 Mission Hub
-- 11 · MONITORING — somewhere for the nightly sweep to leave a record
-- Owner: 03 · Security          Run: Supabase SQL editor, AFTER file 10.
--                               ONE BLOCK AT A TIME, in file order.
--
-- WHY THIS FILE EXISTS
-- 08_agent_claim.sql section 4 chose Option A for the sweeper: the worker
-- calls sweep_stalled_runs() at the top of every poll. It also wrote down
-- the limitation rather than hiding it —
--
--     "if the worker is down, nothing sweeps. A run that died at the same
--      moment the worker did stays 'running' until the worker comes back."
--
-- 04 is now closing that with a Vercel cron (api/monitor.js) that calls
-- sweep_stalled_runs(3) once a night with the service-role key. A cron
-- that runs unattended at 02:00 and leaves no trace is indistinguishable
-- from a cron that never fired, and the first anybody would know is a
-- judge asking "how do you know it ran?" on Thursday. So the cron needs a
-- place to write one row per night, and that place is this file.
--
-- WHAT IS IN HERE
--   1 · monitoring_events            the table, RLS on
--   2 · GRANTS                       the revoke, and why nobody gets one
--   3 · monitor_record()             the ONLY write path  (service_role)
--   4 · monitor_health()             the ONLY read path   (authenticated)
--   5 · reports_one_per_mission      the uniqueness guard reports lacked
--   6 · VERIFY                       run these yourself
--   7 · What this file changes in OTHER files — read before you panic
--
-- WHAT THIS FILE DOES NOT DO, so 03 can say it in one breath:
--   · no policy on an existing table is created, altered or dropped
--   · no table grant is issued to any role, on any table, including the
--     new one — service_role included, and it is the writer
--   · anon gains nothing; authenticated gains EXECUTE on one function
--     that returns counts and no identifiers
-- =====================================================================


-- =====================================================================
-- 1 · monitoring_events
--
-- Four questions, and nothing else: WHAT ran, WHEN, HOW MANY runs it
-- swept, and WAS ANYTHING ODD. Every column below answers one of them.
--
-- >>> THE COLUMN THAT IS DELIBERATELY ABSENT <<<
-- There is no mission_id, no run_id and no researcher_id in this table,
-- and that absence is the security design, not an oversight. A shared
-- operational log that names rows is a cross-tenant leak waiting for
-- somebody to widen a grant: the moment one column can identify a
-- researcher's work, "every signed-in account may read the health
-- summary" stops being a safe sentence. Counts cannot identify anybody.
-- If a future column ever carries an id, section 4 has to be rewritten
-- BEFORE that column is added, not after.
-- =====================================================================
create table if not exists public.monitoring_events (
  id         uuid primary key default gen_random_uuid(),
  event_at   timestamptz not null default now(),

  -- who ran it: 'vercel_cron', 'worker', 'manual'. A free-text column
  -- with a length check rather than a CHECK ... in (...) allowlist, and
  -- that is a deliberate trade. A strict allowlist means an unattended
  -- 02:00 job that sends a name nobody anticipated writes NOTHING, and
  -- the silence looks exactly like the cron not firing — which is the
  -- one failure this table exists to make visible.
  source     text not null check (char_length(btrim(source)) between 3 and 40),

  -- what ran: 'sweep_stalled_runs'. Same reasoning as `source`.
  action     text not null check (char_length(btrim(action)) between 3 and 60),

  ok         boolean not null default true,

  -- how many runs the sweep marked stalled. The upper bound is generous
  -- ON PURPOSE, exactly as mission_runs.tool_calls is: a bound that
  -- refuses a real number loses the row, and the row is the point.
  runs_swept integer not null default 0
             check (runs_swept >= 0 and runs_swept <= 10000),

  -- null when nothing odd happened. Capped, and monitor_record()
  -- truncates rather than refusing — see section 3.
  anomaly    text check (anomaly is null or char_length(anomaly) <= 512),

  -- INTERNAL. Never returned by monitor_health(), never granted to a
  -- browser role. Somewhere for an HTTP status or a stack shape to live
  -- for the team, without it reaching a screen.
  detail     jsonb
);

-- Every read of this table is "the last few nights, newest first".
create index if not exists monitoring_events_by_time
  on public.monitoring_events (event_at desc);

-- THE LINE WITHOUT WHICH THE REST OF THIS FILE IS DECORATION.
-- A new table in `public` is readable by anyone holding the publishable
-- key out of js/config.js until this runs. 01_tables_rls.sql says it once
-- for eight tables; it is just as true for the ninth.
alter table public.monitoring_events enable row level security;

-- Deliberately NO POLICY. RLS on + no policy + no grant is the
-- app_settings pattern from 01_tables_rls.sql: no role reads this table
-- directly, and the only ways in are the two SECURITY DEFINER functions
-- below. Section 7 covers what that does to 99_verify.sql query 3 and to
-- the Supabase Advisor, so nobody chases it at 1am.

comment on table public.monitoring_events is
  'Nightly sweep log. No mission, run or researcher id may ever be added - see 11_monitoring.sql section 1.';


-- =====================================================================
-- 2 · GRANTS — take everything back, hand nothing out.
--
-- Supabase grants ALL on every new table in `public` to anon AND
-- authenticated automatically. 03_grants.sql explains why that matters
-- better than this file can:
--
--        RLS decides WHICH ROWS.      GRANTS decide WHICH COLUMNS
--                                     and WHICH VERBS.
--
-- >>> THE PART THAT LOOKS WRONG AND IS NOT <<<
-- service_role is the WRITER here — the Vercel cron holds that key — and
-- it is revoked along with everybody else. That is 03_grants.sql's rule
-- applied without an exception:
--
--     "If n8n needs a fourth, it gets a fourth FUNCTION, never a table
--      grant."                                — 03_grants.sql, line ~57
--
-- service_role has BYPASSRLS, so a table grant here would hand the key
-- sitting in the Vercel environment an INSERT it could point anywhere,
-- and SELECT on every row of this log as well. It gets EXECUTE on one
-- function instead, and the function decides what a row may contain.
-- =====================================================================
revoke all on public.monitoring_events from anon, authenticated, service_role;

-- No `grant select (...)` line follows, and that is the decision rather
-- than an omission. 03_grants.sql hands back named columns to
-- `authenticated` wherever a screen needs them; no screen reads this
-- table, and section 4 is the read path instead. If you ever add a column
-- grant here, you are reopening the question in section 4 — read it first.


-- =====================================================================
-- 3 · monitor_record() — THE ONLY WRITE PATH. service_role only.
--
-- The cron does two POSTs, in this order:
--
--     POST /rest/v1/rpc/sweep_stalled_runs   {"p_idle_minutes": 3}   -> n
--     POST /rest/v1/rpc/monitor_record
--          {"p_source":"vercel_cron","p_action":"sweep_stalled_runs",
--           "p_runs_swept": n, "p_ok": true}
--
-- >>> THE LIMIT OF THIS DESIGN, STATED RATHER THAN HIDDEN <<<
-- Two round trips are not atomic. If the sweep succeeds and the process
-- dies before the second call, the night has no row and looks identical
-- to a night the cron never ran. The mitigation lives in api/monitor.js,
-- not here: it must call monitor_record even when the sweep THREW, with
-- p_ok = false and the reason in p_anomaly. A monitoring writer whose
-- only failure mode is silence is not monitoring.
--
-- WHY THIS FUNCTION REPAIRS ITS INPUT INSTEAD OF REFUSING IT.
-- Every other function in this folder raises on bad input, because a
-- researcher is watching and a refusal is information. Nobody is watching
-- at 02:00. A raise here means the CHECK constraint stops the row, the
-- cron logs a 400 into a Vercel log nobody opens, and the night is blank
-- for the one reason this table exists to rule out. So: clamp, truncate,
-- substitute, and write the row.
--
-- This is NOT the `maxlength` mistake that 06_validation.sql forbids on
-- the objective box. There, truncation silently threw away the judge's
-- 5,000-character paste and created a row that looked fine. Here the
-- truncated value is an operational note from our own cron, the thing
-- being preserved is the EVENT, and nothing a researcher typed passes
-- through this function at all.
-- =====================================================================
create or replace function public.monitor_record(
  p_source     text,
  p_action     text,
  p_runs_swept integer default 0,
  p_ok         boolean default true,
  p_anomaly    text    default null,
  p_detail     jsonb   default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_id     uuid;
  v_source text;
  v_action text;
  v_anom   text;
  v_detail jsonb;
begin
  v_source := left(btrim(coalesce(p_source, '')), 40);
  if char_length(v_source) < 3 then v_source := 'unknown'; end if;

  v_action := left(btrim(coalesce(p_action, '')), 60);
  if char_length(v_action) < 3 then v_action := 'unspecified'; end if;

  v_anom := nullif(btrim(coalesce(p_anomaly, '')), '');
  if v_anom is not null and char_length(v_anom) > 512 then
    v_anom := left(v_anom, 500) || ' [truncated]';
  end if;

  -- A caller looping on an error can post a very large jsonb. The marker
  -- keeps the row, keeps the size bounded, and says what happened.
  v_detail := p_detail;
  if v_detail is not null and octet_length(v_detail::text) > 4096 then
    v_detail := jsonb_build_object(
      'note',  'detail was larger than 4096 bytes and was dropped',
      'bytes', octet_length(p_detail::text));
  end if;

  insert into public.monitoring_events
    (source, action, ok, runs_swept, anomaly, detail)
  values
    (v_source, v_action, coalesce(p_ok, true),
     greatest(0, least(coalesce(p_runs_swept, 0), 10000)),
     v_anom, v_detail)
  returning id into v_id;

  return v_id;
end $fn$;

-- Same shape as every other write path in this folder: take it from
-- everyone first, then hand it to exactly one role. Skip the `from
-- public` and `anon` — a private window holding the publishable key out
-- of js/config.js — can forge monitoring rows, because Postgres grants
-- EXECUTE on every new function to PUBLIC by default. That default is
-- what the Security Advisor caught us with twice: 10_advisor_fixes.sql
-- section 4.
revoke execute on function
  public.monitor_record(text, text, integer, boolean, text, jsonb)
  from public, anon, authenticated;
grant execute on function
  public.monitor_record(text, text, integer, boolean, text, jsonb)
  to service_role;


-- =====================================================================
-- 4 · monitor_health() — THE ONLY READ PATH. Signed-in accounts only.
--
-- >>> WHO MAY READ THIS, AND WHY IT WAS ARGUED RATHER THAN ASSUMED <<<
--
-- The table itself: NOBODY. No role holds a grant on it and there is no
-- policy, so a browser cannot reach a row of it under any key.
--
-- The SUMMARY: any signed-in account. Three reasons, heaviest first.
--
--   1. The question the summary answers — "did the watchdog run last
--      night, and did it find anything?" — is about the PLATFORM, not
--      about anybody's research. Today the only way to answer it is to
--      open the Supabase SQL editor, which means the answer belongs to
--      the one person holding the dashboard login. That is the situation
--      this table exists to end.
--   2. What comes back is counts and a timestamp. No mission, no run, no
--      researcher, no anomaly TEXT and no `detail`. There is nothing in
--      the result that belongs to a researcher, because section 1
--      refuses to put anything of the kind in the table.
--   3. Sign-up on this platform is open on purpose, so "signed in" means
--      "anyone with an email address" — which is exactly why the return
--      value is aggregates. If this returned the `anomaly` column, an
--      open sign-up would be an open window onto our operational text,
--      and the answer here would have to be different.
--
-- If the team decides even that is too much, ONE line takes it back and
-- the SQL editor still works:
--     revoke execute on function public.monitor_health(integer)
--       from authenticated;
--
-- WHY IT CLAMPS p_days INSTEAD OF RAISING.
-- A `raise exception` is a new sentence, and every browser-facing
-- sentence in this schema has to be matched in the SAFE allowlist in
-- js/ksat-workflow.js or the researcher gets the generic line instead.
-- No screen calls this function yet, so inventing a contract with the
-- front end for it would be inventing work for somebody else.
-- Out-of-range days are clamped to 1..90 and the caller gets an answer.
--
-- The day boundary is Asia/Kuwait, not UTC. A cron firing at 02:00
-- Kuwait time is 23:00 the previous day in UTC, so grouping by the UTC
-- date would put two sweeps on one date and none on the next, and that
-- gap would read as a missed night. The timezone is the fix.
-- =====================================================================
create or replace function public.monitor_health(p_days integer default 7)
returns table (
  day        date,
  events     bigint,
  sweeps_ok  bigint,
  runs_swept bigint,
  anomalies  bigint,
  last_event timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select (e.event_at at time zone 'Asia/Kuwait')::date  as day,
         count(*)                                       as events,
         count(*) filter (where e.ok)                   as sweeps_ok,
         coalesce(sum(e.runs_swept), 0)                 as runs_swept,
         count(*) filter (where e.anomaly is not null)  as anomalies,
         max(e.event_at)                                as last_event
    from public.monitoring_events e
   where e.event_at >= now() - make_interval(
           days => greatest(1, least(coalesce(p_days, 7), 90)))
   group by 1
   order by 1 desc;
$fn$;

revoke execute on function public.monitor_health(integer) from public, anon;
grant  execute on function public.monitor_health(integer) to authenticated;

-- service_role is not granted this and does not need it. The cron writes;
-- it has no reason to read every night back out again.


-- =====================================================================
-- 5 · reports_one_per_mission — the guard `reports` never had.
--
-- THE BUG, NAMED.
-- generate_report() in 05_views_rpc.sql is a plain INSERT:
--
--     insert into public.reports (mission_id, body_md, approved_by)
--     values (p_mission_id, p_body_md, (select auth.uid()));
--
-- launch_mission() refuses a second RUN once a mission has an approved
-- report ("This mission has an approved report. Start a new mission."),
-- but nothing refuses a second REPORT on the same mission. Press Approve
-- twice — a double click, a retried request, a researcher who reloaded
-- the page and pressed it again — and `reports` holds two rows for one
-- mission.
--
-- Why that matters more than a duplicate row usually does: `reports` IS
-- the human checkpoint. Two rows means two approved_by values and two
-- approved_at times for one decision, and "who approved this finding,
-- and when" stops having one answer. That question is the whole of the
-- capstone SHOULD item the table exists for.
--
-- CHECK FOR DUPLICATES FIRST. The index cannot be created while any
-- mission has two reports, and the failure arrives as "could not create
-- unique index ... Key (mission_id)=(...) is duplicated" — clear, but
-- only if you were expecting it:
--
--     select mission_id, count(*), min(approved_at), max(approved_at)
--       from public.reports group by 1 having count(*) > 1;
--
-- Zero rows on the live database on 21 Sep 2026 (2 reports across 2
-- missions), so it creates cleanly today. If it ever does not, decide
-- deliberately which row survives; do not delete the older one by
-- reflex, because the older one is the approval that actually happened.
--
-- WHAT A SECOND APPROVAL LOOKS LIKE AFTER THIS RUNS. Postgres raises
-- "duplicate key value violates unique constraint", a sentence the SAFE
-- allowlist in js/ksat-workflow.js does not match, so the researcher
-- sees the generic line: "Something went wrong writing this step.
-- Nothing was saved for it." That sentence is TRUE here — the insert was
-- refused and nothing was written — so this is safe to ship as it
-- stands. The better wording already exists in that allowlist, and the
-- fix belongs in generate_report(), which is file 05's to change:
--
--     if exists (select 1 from public.reports r
--                 where r.mission_id = p_mission_id) then
--       raise exception 'This mission has an approved report. Start a new mission.'
--         using errcode = 'P0001';
--     end if;
--
-- The index stays either way. A guard inside a function is a check the
-- next function somebody writes can skip; a unique index is the database
-- refusing, whoever asks.
-- =====================================================================
create unique index if not exists reports_one_per_mission
  on public.reports (mission_id);

comment on index public.reports_one_per_mission is
  'One approval, one report row. See 11_monitoring.sql section 5.';


-- =====================================================================
-- 6 · VERIFY — run these yourself, do not take this file's word
-- =====================================================================

-- ---------------------------------------------------------------------
-- 6.1 · RLS is on for the new table. Expected: monitoring_events | true
-- ---------------------------------------------------------------------
select c.relname as table_name, c.relrowsecurity as rls_on
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'monitoring_events';

-- ---------------------------------------------------------------------
-- 6.2 · No role holds a grant on it. EXPECTED: ZERO ROWS, both queries.
-- ---------------------------------------------------------------------
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'monitoring_events'
  and grantee in ('anon', 'authenticated', 'service_role', 'public');

select grantee, column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'monitoring_events'
  and grantee in ('anon', 'authenticated', 'service_role', 'public');

-- ---------------------------------------------------------------------
-- 6.3 · Who can execute the two new functions?
-- EXPECTED, exactly:
--   monitor_health  anon false · authenticated TRUE  · service_role false
--   monitor_record  anon false · authenticated false · service_role TRUE
-- Any `true` in the anon column is a blocker: that is the PUBLIC default
-- and it means one of the revokes above did not run.
-- ---------------------------------------------------------------------
select p.proname                                                as function_name,
       has_function_privilege('anon',          p.oid, 'EXECUTE') as anon,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated,
       has_function_privilege('service_role',  p.oid, 'EXECUTE') as service_role
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('monitor_record', 'monitor_health')
order by 1;

-- ---------------------------------------------------------------------
-- 6.4 · Both new functions are SECURITY DEFINER with search_path pinned.
-- EXPECTED: two rows, each showing {search_path=public, pg_temp}.
-- ---------------------------------------------------------------------
select p.proname as function_name, p.prosecdef as is_security_definer,
       p.proconfig as settings
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('monitor_record', 'monitor_health')
order by 1;

-- ---------------------------------------------------------------------
-- 6.5 · The uniqueness guard exists and really is unique.
-- EXPECTED: reports_one_per_mission, with CREATE UNIQUE INDEX in its def.
-- ---------------------------------------------------------------------
select indexname, indexdef
from pg_indexes
where schemaname = 'public' and tablename = 'reports'
order by 1;

-- ---------------------------------------------------------------------
-- 6.6 · The write path works, and it is the only one that does.
--
-- In the SQL editor you are `postgres`, so the function is callable:
--
--   select public.monitor_record('manual', 'verify_11_monitoring', 0, true,
--                                'Written by hand while verifying file 11.');
--   select event_at, source, action, ok, runs_swept, anomaly
--     from public.monitoring_events order by event_at desc limit 5;
--
-- ...and the summary, which is what a signed-in account sees:
--
--   select * from public.monitor_health(7);
--
-- Then prove the browser cannot do the first two. In the app's console,
-- signed in as a researcher:
--
--   await sb.from('monitoring_events').select('id')                -- denied
--   await sb.rpc('monitor_record', {p_source:'x', p_action:'yy'})  -- denied
--   await sb.rpc('monitor_health', {p_days: 7})                    -- counts
--
-- A row back from the first line is a blocker. Counts back from the
-- third is the intended end state, not a leak.
-- ---------------------------------------------------------------------


-- =====================================================================
-- 7 · WHAT THIS FILE CHANGES IN OTHER FILES. Read this before chasing
--     something at 1am that is working exactly as designed.
--
-- · 99_verify.sql query 3 ("RLS on but NO POLICY") now returns TWO rows:
--   app_settings and monitoring_events. Both are correct and both are
--   named in that query's own comment. A THIRD name is still a blocker.
--
-- · The Supabase Security Advisor's INFO lint `rls_enabled_no_policy`
--   goes from 1 finding to 2, for the same reason. It was 1
--   (app_settings) when checked on 21 Sep 2026.
--
-- · The Advisor's WARN lint "Signed-In Users Can Execute SECURITY
--   DEFINER Function" goes from 9 findings to 10, the tenth being
--   monitor_health. That WARN is the shape of this whole schema —
--   launch_mission, generate_report and the researcher_* writers are all
--   on that list on purpose — and section 4 is the written reason for
--   this one.
--
-- · js/ksat-workflow.js says in its header, of Vercel cron monitoring:
--   "not possible ... There is also no monitoring table." Once this file
--   has been run and api/monitor.js is deployed, the second half of that
--   sentence is false. That file belongs to 01/04 — tell them, do not
--   edit it from here.
--
-- · 03-security/README.md lists the db/ files and gains a row for 11.
-- =====================================================================
