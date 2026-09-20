-- =====================================================================
-- KuwaitSat-1 Mission Hub
-- 07 · THE SUPER ADMIN, AND THE LOG THAT MAKES IT ACCOUNTABLE
-- Owner: 03 · Security
--
-- Run: NOT THIS WEEK BY DEFAULT. Read BLOCK 0 before you paste anything.
--      If it does run, it runs AFTER file 06, and never on a night a
--      MUST is still open.
--
-- WHAT THIS FILE IS
-- A role that can read every researcher's work is the most dangerous
-- object in this database. So the access and the ACCOUNTABILITY are
-- built in the same file, in the same hour, and the access does not
-- exist without the log.
--
-- The one sentence, if I only get one:
--   "A super admin who can read everything is easy. A super admin who
--    CANNOT READ ANYTHING WITHOUT LEAVING A ROW THE RESEARCHER CAN SEE
--    is the part worth building."
--
-- THE HONESTY LINE, and it belongs in this file as much as on the
-- screen: this is an independent student prototype with entirely
-- invented data. It is NOT kuwaitsat.space, it does not secure any KFAS
-- system, and no real researcher's work is in here.
-- =====================================================================


-- =====================================================================
-- BLOCK 0 · READ THIS BEFORE YOU PASTE ONE LINE
-- =====================================================================
--
-- 0.1 · WHY THIS IS NOT TONIGHT, AND PROBABLY NOT THIS WEEK
--
-- The capstone rule is "never start a COULD while a MUST is open."
-- se-m1 (row level security) is open. Tonight is RLS and only RLS.
-- A super admin is on no MUST list; no judge test in CHECKLIST.md asks
-- for one.
--
-- And the calendar does not have room for it. docs/NIGHT-PLAN.md books
-- Tuesday 22 Sep as 19:00-22:20, T1-T7, EVERY ONE A MUST, and says
-- "Never cut T1/T2 or T6." There is no two-hour block hiding in that
-- evening. An earlier draft of this track said "Tuesday, after the
-- secrets sweep" — that means displacing five MUST items, or starting
-- at 22:20, which is already past this file's own cut line. The plan
-- was impossible, and it is better to say so here than to discover it
-- at 23:40 on the last build night.
--
-- >>> THE DEFAULT ANSWER FOR THIS WEEK IS NOT THIS FILE. <<<
-- The default is 30 minutes of WRITING, on Tuesday, with no new SQL and
-- no new attack surface:
--   1. the decision entry (BLOCK 11) pasted into docs/DECISIONS.md
--   2. the UI copy string (BLOCK 11) handed to 01
--   3. rehearsing the answer out loud for Q&A
-- A judge scores a clear honest answer about a thing you CHOSE not to
-- build far above a half-built admin panel that leaks.
--
-- 0.2 · IF IT DOES RUN: THE REAL NUMBERS, NOT THE HOPEFUL ONES
--
--   BLOCK 1-7 pasted and working ........................... 50-60 min
--   The four verify queries in BLOCK 8, read properly ....... 15 min
--   The five browser checks in BLOCK 11 ..................... 20 min
--   Writing the decision entry .............................. 15 min
--                                                           ~ 1 h 50 m
-- That is AN EVENING, for a beginner, and it is only that small because
-- everything expensive has been pushed to BLOCK 10 (PHASE 2). Anyone
-- who says "about two hours" INCLUDING the demo beat and 01's screen
-- has not counted 01's screen.
--
-- 0.3 · THE CUT LINE — keep it with the file, the way D-5's is kept
--
--   If it is 22:00 and admin_read_mission() does not return a row WHILE
--   writing a log row, run the FIVE drop statements in BLOCK 9 and
--   stop. Then SAY THE DESIGN OUT LOUD in Q&A instead of showing it.
--
-- Nothing in files 01-06 refers to any name created here, and this file
-- does not edit can_read_mission(), owns_mission(), any existing
-- policy, or any existing grant. THE CUT CANNOT BREAK se-m1. That is
-- the whole reason the design took this shape.
--
-- 0.4 · THE RE-PASTE TRAP — this is the 1 a.m. failure to expect
--
-- The blocks below use `create table if not exists` and `create or
-- replace function`. Those are NOT drop-then-create:
--   · `create table if not exists` on a table that already exists does
--     NOTHING. It prints "Success. No rows returned" and your changed
--     column or CHECK constraint is not applied. You will believe it
--     was applied. It was not.
--   · `create or replace function` CANNOT change a function's RETURNS
--     TABLE column list. Postgres says
--         ERROR: cannot change return type of existing function
--     and tells you to DROP it first.
--
-- >>> So: if you change a COLUMN, a CONSTRAINT, or a function's RETURN
-- >>> COLUMNS, run the BLOCK 9 drops FIRST, then re-paste the file. <<<
--
-- 0.5 · WHAT THIS FILE DELIBERATELY DOES NOT DO
--   · It does not touch db/03_grants.sql. An earlier draft appended a
--     `revoke ... on public.app_admins` line to file 03 — but 03 runs
--     BEFORE 07 creates that table, so a clean rebuild would abort with
--     `relation "public.app_admins" does not exist`, and the cut in
--     BLOCK 9 would then break file 03 as well. The revokes live HERE,
--     beside the tables they protect. Put a one-line comment in 03 if
--     you like ("app_admins and admin_access_log are revoked in 07,
--     which creates them"), nothing more.
--   · It does not modify can_read_mission(). See BLOCK 4.
--   · It creates NO VIEW. See BLOCK 6 — the "who viewed this" read path
--     is a function, so verify query 4 in 99_verify.sql (views without
--     security_invoker) has nothing new to check and cannot newly fail.


-- =====================================================================
-- BLOCK 1 · app_admins — WHERE AUTHORITY LIVES
-- =====================================================================
--
-- THE RULE, IN ONE SENTENCE:
--   authority is a ROW THE SERVER READS, never a CLAIM THE CLIENT SENDS.
--
-- Three versions of getting that wrong, in increasing order of how
-- respectable they look:
--   1. localStorage.setItem('role','admin'), or ?admin=1 in the URL.
--      Not security. One line to say so.
--   2. user_metadata in the JWT. This is the most common Supabase RBAC
--      failure and it looks completely legitimate:
--          await sb.auth.updateUser({ data: { role: 'admin' } })
--      is a SUPPORTED, USER-CALLABLE API. Anything that reads
--      auth.jwt() -> 'user_metadata' ->> 'role' is self-service
--      administrator. (app_metadata is service-role-only, so it is not
--      that same hole —)
--   3. — but a claim in a token CANNOT BE REVOKED. If admin is a token
--      claim, revoking an admin at 02:00 does nothing until that token
--      refreshes. If admin is a ROW, is_admin() re-reads it on EVERY
--      request, so `update app_admins set active = false` takes effect
--      on the next call. That is the argument to say out loud.
--
-- AND IT MUST NEVER BE A COLUMN ON profiles. File 03 already says
--     grant update (display_name, org) on public.profiles to authenticated;
-- and file 04 already has profiles_update_own, whose entire purpose is
-- to let a user write their own row. Add `is_admin boolean` to profiles
-- and, the night somebody widens that grant to make a settings screen
-- work,
--     await sb.from('profiles').update({ is_admin: true }).eq('user_id', myId)
-- succeeds AND THE POLICY SAID YES. The policy is not broken. The data
-- model is. Privilege never lives on a row whose job is self-service.

create table if not exists public.app_admins (
  -- on delete RESTRICT, not cascade. Deleting the user must not delete
  -- the record that they were ever an administrator — that record is
  -- audit evidence. If you try to delete this account in the dashboard
  -- you will get a foreign-key error. THAT IS THE TABLE WORKING.
  -- To tear down after the demo, use the drops in BLOCK 9 instead.
  user_id    uuid primary key references auth.users(id) on delete restrict,

  -- Who granted it. NULL means "made in the SQL editor by the project
  -- owner" — the bootstrap. Verify query V-A checks there is exactly
  -- ONE such row. A second null row appearing is somebody
  -- self-bootstrapping.
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),

  -- Revocation is a FLAG, never a DELETE. The record of who was ever an
  -- administrator is itself evidence; deleting it destroys that.
  active     boolean not null default true,
  revoked_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,

  reason     text not null check (char_length(btrim(reason)) >= 10),

  -- An inactive row must SAY WHEN it was revoked. Without this line you
  -- can set active = false and leave no date, which is a delete wearing
  -- an update's clothes.
  constraint app_admins_inactive_has_date
    check (active or revoked_at is not null),

  -- >>> THE ONE LINE THAT BLOCKS THE NAIVE SELF-GRANT <<<
  -- Not a policy, not a function check — a TABLE CONSTRAINT, so it
  -- holds against every future RPC, every future bug, and the SQL
  -- editor.
  --
  -- BE PRECISE ABOUT WHAT IT IS WORTH, because a judge will ask.
  -- It blocks writing YOUR OWN id into granted_by. It does NOT make
  -- privilege escalation "structurally impossible": anyone who can
  -- insert here can write (attacker_id, some_other_admin_id, 'reason')
  -- and pass. What the line really buys is that an attacker must FORGE
  -- A SECOND PERSON'S NAME INTO THE RECORD — which is why verify query
  -- V-A prints granted_by, granted_at and reason for every row, and why
  -- you are expected to actually READ them on Tuesday and again on
  -- Wednesday. An admin list nobody reads is not a control.
  constraint app_admins_no_self_grant
    check (granted_by is null or granted_by <> user_id)
);

alter table public.app_admins enable row level security;

-- NO POLICY. NO GRANT. Exactly the shape app_settings has in file 01:
-- RLS on + no policy + no grant = the only things that can read this
-- table are SECURITY DEFINER functions (they run as the table owner)
-- and the SQL editor (it connects as postgres). There is NO API VERB.
-- Not even an administrator can list the administrators from a browser.
revoke all on public.app_admins from anon, authenticated, service_role;


-- =====================================================================
-- BLOCK 2 · is_admin() — THE ONLY PLACE THAT ANSWERS "ARE YOU ADMIN?"
-- =====================================================================
--
-- SECURITY DEFINER for exactly the reason file 02 gives for
-- is_collaborator(): app_admins has RLS on and NO POLICY, so an INVOKER
-- version returns false for everybody — and the symptom is "admin
-- silently never works, and nothing errors."
--
-- search_path is pinned because a SECURITY DEFINER function without one
-- is a privilege-escalation hole, not a helper.
--
-- `stable`, not `volatile`, so the planner may evaluate it once per
-- statement instead of once per row.

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $fn$
  select exists (
    select 1 from public.app_admins a
    where a.user_id = (select auth.uid())
      and a.active
  );
$fn$;

revoke execute on function public.is_admin() from public, anon;
grant  execute on function public.is_admin() to authenticated;

-- THE RECURSION QUESTION, ANSWERED PRECISELY.
-- There is exactly ONE way to create recursion here:
--
--   >>> NEVER PUT A POLICY ON app_admins THAT CALLS is_admin(). <<<
--   The error is:
--       infinite recursion detected in policy for relation "app_admins"
--   Learn that string now, so you recognise it at 01:00 instead of
--   rebuilding the file.
--
-- app_admins has no policy at all, so there is no cycle. is_admin()
-- reads ONLY app_admins; the tables whose policies could ever call it
-- (missions, mission_runs, agent_steps, results, reports) are not
-- touched by it. This also relies on the thing file 01 already forbids:
-- do NOT add `force row level security`. Force applies RLS to the table
-- owner too, and breaks every SECURITY DEFINER helper you have — this
-- one first.


-- =====================================================================
-- BLOCK 3 · admin_access_log — THE ROW THAT MAKES THE POWER SURVIVABLE
-- =====================================================================
--
-- THE HONEST PART, AND IT IS THE WHOLE DESIGN: A POLICY CANNOT LOG.
--
-- An RLS policy is a BOOLEAN EXPRESSION evaluated per candidate row
-- inside a read. It has no statement of its own; you cannot insert from
-- it. Beginners try to dodge that with a volatile function in the USING
-- clause — `using ( log_and_return_true(id) )` — and it is wrong for
-- three independent reasons:
--   1. THE PLANNER decides how many times to call it: zero, once, or
--      once per row. It may short-circuit an OR, reorder against a
--      cheaper predicate, or cache a stable result. You get missing
--      entries and duplicate entries and cannot tell which is which.
--   2. IT MAKES EVERY READ A WRITE. The statement then fails in a
--      read-only transaction, and every ordinary researcher query pays
--      for an insert.
--   3. IT LOGS ROWS THAT WERE THEN FILTERED OUT — the policy runs
--      before the rest of the WHERE. You record an access to a mission
--      whose data never reached anybody. A log full of false
--      accusations is worse than no log.
--
-- The consequence follows directly, and it is the sentence to say out
-- loud:
--   >>> IF YOU HAND AN ADMIN ACCESS THROUGH A POLICY, YOU HAVE
--   >>> PERMANENTLY GIVEN UP THE ABILITY TO RECORD IT. <<<
--
-- That is why the admin does not get a bigger account. The admin gets a
-- DIFFERENT DOOR, and the door writes down who opened it (BLOCK 5).

create table if not exists public.admin_access_log (
  id         uuid primary key default gen_random_uuid(),

  -- RESTRICT, for the same reason as app_admins.user_id: deleting the
  -- admin account must not delete the record of everything that admin
  -- read. A log that disappears with the thing it recorded is not a
  -- log, it is a convenience.
  admin_id   uuid not null references auth.users(id) on delete restrict,

  -- Only ONE action ships this week, so only one value is allowed.
  -- An earlier draft listed six ('read_run', 'grant_admin', ...) and
  -- nothing wrote five of them. A schema that implies "granting admin
  -- is logged" when it is not is worse than an honest short list.
  -- Adding a value later is one drop-constraint / add-constraint pair.
  action     text not null check (action in ('read_mission')),

  -- 'set null', NOT cascade: if the mission or the researcher is
  -- deleted, the LOG MUST SURVIVE. We lose the pointer, not the event.
  mission_id uuid references public.missions(id) on delete set null,
  subject_id uuid references auth.users(id)      on delete set null,

  reason     text not null check (char_length(btrim(reason)) >= 10),
  row_count  int,
  at         timestamptz not null default now()
);

alter table public.admin_access_log enable row level security;

-- ZERO GRANTS TO ANY BROWSER ROLE — including select.
-- An earlier draft granted `select (id, mission_id, subject_id, ...)`
-- to authenticated and put ONE policy between every signed-in user and
-- every row in this table. One mis-edit of that policy would expose a
-- map of who is on the platform and who got investigated. File 03's
-- closing note warns about exactly that ("if you ever find yourself
-- adding a column to a grant to make a screen work, message me first").
-- The researcher reads their own rows through the function in BLOCK 6
-- instead — same evidence, no grant, no view, one fewer way to be
-- wrong.
revoke all on public.admin_access_log from anon, authenticated, service_role;

create index if not exists adminlog_by_subject
  on public.admin_access_log (subject_id, at desc);
create index if not exists adminlog_by_admin
  on public.admin_access_log (admin_id, at desc);


-- =====================================================================
-- BLOCK 4 · THE POLICIES — SAFE TO RUN OVER THE EXISTING ONES
-- =====================================================================
--
-- Everything here is drop-then-create, so this block can be re-pasted
-- on top of a half-finished attempt without reading the error twice.
-- It adds policies to the two NEW tables only. It does not alter, drop
-- or replace a single policy from file 04, so the 25-check RLS matrix
-- is untouched by it.

-- ---------------------------------------------------------------------
-- admin_access_log · IN PLAIN WORDS: a researcher may see the log rows
-- that are ABOUT THEM. Nobody may write one from a browser — there is
-- no insert/update/delete policy and no grant of any kind.
--
-- NOTE, AND IT IS THE POINT: because BLOCK 3 grants NOTHING on this
-- table, this policy is currently UNREACHABLE. It is the wall behind
-- the wall — there for the night somebody adds a grant "to make a
-- screen work". Rows still reach their owner through my_access_log() in
-- BLOCK 6, which is SECURITY DEFINER and so does not consult this
-- policy at all.
-- ---------------------------------------------------------------------
drop policy if exists adminlog_select_subject on public.admin_access_log;
create policy adminlog_select_subject on public.admin_access_log
  for select to authenticated
  using ( subject_id = (select auth.uid()) );

-- ---------------------------------------------------------------------
-- app_admins · DELIBERATELY NO POLICY. DO NOT "FIX" THIS.
-- A policy here that calls is_admin() recurses (BLOCK 2). A policy here
-- that does anything else is a way for a browser to find out WHO the
-- administrators are — a targeting list for phishing, on a platform
-- whose whole security model rests on a couple of accounts.
--
-- The line below is a broom, not a policy: if an earlier attempt left
-- one behind, this removes it. It is harmless when there is nothing to
-- drop.
-- ---------------------------------------------------------------------
drop policy if exists app_admins_select_admin on public.app_admins;

-- ---------------------------------------------------------------------
-- missions / mission_runs / agent_steps / results / reports ·
-- NOTHING CHANGES HERE, AND THAT IS THE DESIGN.
--
-- The obvious route is to add `or public.is_admin()` to
-- can_read_mission() in file 02. It is correct SQL. It is the wrong
-- design, for two reasons:
--
--  1. ONE EDIT TO ONE FUNCTION SILENTLY WIDENS FIVE READ PATHS, because
--     of the dependency chain already built:
--        mission_runs_select_readable -> can_read_mission()
--        agent_steps_select_readable  -> can_read_run() -> can_read_mission()
--        results_select_complete      -> can_read_mission()
--        reports_select_readable      -> can_read_mission()
--        the my_mission_results and my_agent_steps views — their row
--        filter IS the underlying policy; my_agent_steps has no WHERE
--        of its own at all
--     while my_missions does NOT widen, because it carries its own
--     `where researcher_id = auth.uid() or is_collaborator(...)`. You
--     would end up with an admin who can read every result and every
--     agent step through the API but whose dashboard looks empty. You
--     discover that on Wednesday, which is not a building night.
--
--  2. EVERY ONE OF THOSE READS IS UNLOGGED AND UNLOGGABLE (BLOCK 3).
--
-- An earlier draft of this file shipped `missions_select_admin ... using
-- (public.is_admin())` commented out and ready to paste. IT HAS BEEN
-- DELETED ON PURPOSE: at 23:50 with the door not working, the shortest
-- path to a demo would be uncommenting four characters — which gives
-- the admin every mission, unlogged, while the researcher's screen
-- still says "she sees that they looked." Do not re-add it.
--
-- Through the ordinary researcher path an admin gets ZERO ROWS, exactly
-- like anybody else. That is not a bug to work around. It is the
-- design, and it is the best beat in the demo.
-- ---------------------------------------------------------------------


-- =====================================================================
-- BLOCK 5 · admin_read_mission() — THE ADMIN DOOR
-- =====================================================================
--
-- >>> THE LOG INSERT AND THE RETURN ARE IN ONE TRANSACTION. <<<
-- There is no ordering of events in which an administrator obtains the
-- data and no row is written. If the read rolls back, so does the log —
-- which is also correct: no read, no entry.
--
-- Authorisation is RE-READ from app_admins INSIDE the function. It is
-- never taken from an argument, a header, or a token claim.
--
-- WHY `grant execute ... to authenticated` AND NOT TO SOME ADMIN ROLE:
-- Supabase gives every signed-in user the same database role,
-- `authenticated`. There is no per-user Postgres role to grant to. That
-- is precisely why the check lives INSIDE the body, and why the
-- function must be SECURITY DEFINER — it has to read app_admins, which
-- nobody can read.
--
-- WHAT IT RETURNS, AND WHAT IT DOES NOT:
-- the SAME COLUMNS A RESEARCHER SEES, and nothing more. No source_ref,
-- no raw_prompt, no error_note. The requirement was to see the
-- researcher's WORK, not our plumbing.
-- And say this plainly rather than overstate it on the projector: this
-- opens the MISSION BRIEF and says who owns it. IT DOES NOT RETURN THE
-- FINDINGS — results, reports and agent steps are not in this function.
-- That was a scope choice; BLOCK 10.2 is where the next function goes.

create or replace function public.admin_read_mission(
  p_mission_id uuid, p_reason text)
returns table (id uuid, researcher_email text, title text, objective text,
               area_geojson jsonb, status text, injection_flag boolean,
               created_at timestamptz, launched_at timestamptz)
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare v_owner uuid; v_recent int;
begin
  -- The SAME string an ordinary researcher gets from launch_mission()
  -- in file 05. Not because the door itself is a secret — PostgREST
  -- publishes an OpenAPI document listing every RPC that
  -- `authenticated` may execute, so the NAME of this function is
  -- discoverable by anyone holding the publishable key, which is in our
  -- config.js by design. The uniform message is right for a different
  -- reason: it refuses to confirm whether the mission exists, and it
  -- does not distinguish "you are not an admin" from "no such mission".
  -- One string, no oracle.
  if not public.is_admin() then
    raise exception 'Mission not found.' using errcode = 'P0001';
  end if;

  if char_length(btrim(coalesce(p_reason,''))) < 10 then
    raise exception 'State a reason before opening a researcher''s mission.'
      using errcode = 'P0001';
  end if;

  -- A CRUDE CAP, reusing the counting pattern from file 06's guard.
  -- Missions get 5/hour; an earlier draft gave the admin door no limit
  -- at all, so a stolen admin session could enumerate at HTTP speed.
  -- Thirty an hour is generous for support work and useless for
  -- harvesting.
  -- BE HONEST ABOUT WHAT IT IS: this RECORDS and SLOWS. It does not
  -- DETECT, and it alerts nobody. Detection is BLOCK 10.7.
  -- A refused attempt writes no log row — same as a refused insert in
  -- file 06, which rolls back and does not count.
  select count(*) into v_recent
    from public.admin_access_log l
   where l.admin_id = (select auth.uid())
     and l.at > now() - interval '1 hour';
  if v_recent >= 30 then
    raise exception 'Admin read limit reached: 30 in one hour.'
      using errcode = 'P0001';
  end if;

  select m.researcher_id into v_owner
    from public.missions m where m.id = p_mission_id;
  if v_owner is null then
    raise exception 'Mission not found.' using errcode = 'P0001';
  end if;

  insert into public.admin_access_log
    (admin_id, action, mission_id, subject_id, reason, row_count)
  values
    ((select auth.uid()), 'read_mission', p_mission_id, v_owner,
     btrim(p_reason), 1);

  -- Every column reference is qualified (m.id, not id). The output
  -- column names above are variables inside plpgsql, and an unqualified
  -- `id` here is an ambiguity error at RUN time, not at CREATE time.
  return query
    select m.id, u.email::text, m.title, m.objective, m.area_geojson,
           m.status, m.injection_flag, m.created_at, m.launched_at
      from public.missions m
      join auth.users u on u.id = m.researcher_id
     where m.id = p_mission_id;
end $fn$;

revoke execute on function public.admin_read_mission(uuid,text) from public, anon;
grant  execute on function public.admin_read_mission(uuid,text) to authenticated;

-- NOTE FOR 01 · FRONT END: two error strings exist here that mapError()
-- does not know —
--     'State a reason before opening a researcher''s mission.'
--     'Admin read limit reached: 30 in one hour.'
-- Both are only ever seen by an administrator, never by a researcher,
-- so they do not need screen copy this week. 'Mission not found.' is
-- the string you already map.
--
-- THERE IS NO ADMIN LISTING FUNCTION, ON PURPOSE. An earlier draft had
-- admin_list_missions(), which returned every researcher's email
-- address and 200 mission titles and logged ONE row with
-- subject_id = null — so a bulk disclosure appeared on NOBODY's "who
-- viewed this" page, while the sign-up screen promised "every time that
-- happens, you can see it". Deleting it saved 15 minutes AND closed the
-- hole. The Tier-1 administrator finds a mission id the same way they
-- review the log: in the SQL editor. The honest version of a listing is
-- BLOCK 10.1.


-- =====================================================================
-- BLOCK 6 · my_access_log() — WHAT THE RESEARCHER IS TOLD
-- =====================================================================
--
-- "Each researcher's work is private" and "the super admin can see
-- everything" are contradictory AS STATED. They reconcile as exactly
-- one sentence, and it is the sentence that must be on the sign-up
-- screen:
--
--   private from other researchers, accessible to a named administrator
--   for support and safety, and EVERY ACCESS IS VISIBLE TO YOU.
--
-- Silent admin visibility would make the product's own privacy claim
-- false, and a false privacy claim is worse than none: it induces the
-- disclosure it then fails to protect. A judge who finds an
-- unadvertised super-admin behind a "private to you" label has found a
-- BIGGER problem than the super-admin itself.
--
-- A FUNCTION, NOT A VIEW. A view here would need its own grant, its own
-- `security_invoker = on`, and a column grant on subject_id just to
-- satisfy its own WHERE — and it would appear in verify query 4 as one
-- more thing that can be created wrong. A SECURITY DEFINER function
-- matches every other read path in file 05 and leaves admin_access_log
-- with zero grants to anybody.
drop view if exists public.my_access_log;   -- in case an earlier draft made one

create or replace function public.my_access_log()
returns table (id uuid, mission_id uuid, action text, reason text,
               at timestamptz, accessed_by text)
language sql stable security definer
set search_path = public, pg_temp
as $fn$
  select l.id, l.mission_id, l.action, l.reason, l.at,
         'Platform administrator'::text
    from public.admin_access_log l
   where l.subject_id = (select auth.uid())
   order by l.at desc
   limit 100;
$fn$;

revoke execute on function public.my_access_log() from public, anon;
grant  execute on function public.my_access_log() to authenticated;

-- FOR 01: this is an RPC, not a table read —
--     const { data } = await sb.rpc('my_access_log')
-- and it renders as one line per row on the mission page:
--     Accessed by a platform administrator · 14:22 today · "support request #4"
--
-- >>> USE textContent, NEVER innerHTML, FOR `reason`. <<<
-- That string is the FIRST piece of text one user can put into a
-- DIFFERENT user's page. On hand-written static JS, innerHTML there is
-- stored XSS, admin -> researcher.
--
-- WHY THE ADMIN'S IDENTITY IS THE ONE THING WITHHELD. Naming the
-- individual administrator turns every researcher into an enumerator of
-- privileged accounts. The counter-argument is real — full transparency
-- means naming the person — and it wins as soon as there is an
-- organisation with a published list of who the administrators are.
-- That is BLOCK 10.7. This week, with one demo admin, "a platform
-- administrator" is the honest and the safer form. Say WHICH TRADE-OFF
-- YOU MADE AND WHY; that is the answer, not the column.
--
-- TWO LIMITS THE SCREEN MUST NOT OVERCLAIM:
--   · This shows access THROUGH THE ADMIN DOOR. It cannot show someone
--     reading the database directly with the owner credential.
--   · A mission shared with a collaborator logs subject_id = THE OWNER
--     only, so the collaborator is not told. One sentence in the
--     decision entry covers that this week; per-collaborator rows are
--     BLOCK 10.


-- =====================================================================
-- BLOCK 7 · GRANTING AND REVOKING ADMIN — SQL EDITOR ONLY
-- =====================================================================
--
-- There is NO IN-APP GRANT PATH AT ALL: no function, no policy, no
-- grant on app_admins. The browser has no verb. Zero lines of code, and
-- it is the strongest version available in three nights.
--
-- THE HONEST COST, said before a judge says it: this is not separation
-- of duties. The project owner holds the dashboard password and could
-- insert a row naming anyone. With a five-person student team and one
-- Supabase project, that is the true state of affairs, and saying so
-- beats pretending. Two-person granting is BLOCK 10.4.
--
-- The statements below are left COMMENTED on purpose. They are not part
-- of the schema, they contain email addresses you must change, and a
-- blind paste is how a second bootstrap row appears.

-- THE BOOTSTRAP. Run ONCE. granted_by is null because there was nobody
-- to grant it. This is the only row in the table allowed to look like
-- this, and verify query V-A counts them.
-- insert into public.app_admins (user_id, granted_by, reason)
-- select u.id, null,
--        'Bootstrap: capstone platform administrator, created in the SQL editor'
--   from auth.users u
--  where lower(u.email) = lower('admin@ksat.demo')
-- on conflict (user_id) do update
--    set active = true,
--        reason = excluded.reason;
--
-- NOTE WHAT THE ON CONFLICT DOES **NOT** TOUCH, and why.
-- An earlier draft re-set granted_at = now(), revoked_at = null and
-- revoked_by = null on conflict. Revoke at 02:00, re-grant at 02:05,
-- and there is NO TRACE the revocation ever happened — and the original
-- grant date is gone too. That is a delete wearing an update's clothes,
-- in the file that forbids deletes. So a re-grant flips `active` and
-- refreshes the reason, and LEAVES the previous revocation date
-- standing as history. A row reading "active = true, revoked_at =
-- 02:00" is not a contradiction: it is the record that this
-- administrator was revoked and then re-granted.

-- EVERY SUBSEQUENT GRANT NAMES WHO GRANTED IT.
-- insert into public.app_admins (user_id, granted_by, reason)
-- select u.id,
--        (select id from auth.users where lower(email) = lower('owner@ksat.demo')),
--        'Second administrator for demo-day cover'
--   from auth.users u
--  where lower(u.email) = lower('admin2@ksat.demo')
-- on conflict (user_id) do update
--    set active = true,
--        granted_by = excluded.granted_by,
--        reason = excluded.reason;

-- THE 20-SECOND BREAK-GLASS. REHEARSE IT. "How do you revoke an admin?"
-- is a fair Q&A question, and the answer is a strong one:
--   "One UPDATE, and it is live on the NEXT REQUEST, because privilege
--    is a row the server reads and not a token the client presents."
-- NEVER "delete from app_admins".
-- update public.app_admins
--    set active = false,
--        revoked_at = now(),
--        revoked_by = (select id from auth.users
--                       where lower(email) = lower('owner@ksat.demo'))
--  where user_id = (select id from auth.users
--                    where lower(email) = lower('admin@ksat.demo'));
--
-- proof it took effect, immediately:
-- select user_id, active, granted_at, revoked_at from public.app_admins;

-- WHAT IS NOT LOGGED, AND WE SAY IT RATHER THAN IMPLY OTHERWISE:
-- granting and revoking happen HERE, in the SQL editor, as the database
-- owner, with auth.uid() null — so they write NO admin_access_log row.
-- That is exactly why 'grant_admin' and 'revoke_admin' are NOT in the
-- action CHECK in BLOCK 3. The evidence for a grant is the app_admins
-- row itself: granted_by, granted_at, reason, and V-A reading them.


-- =====================================================================
-- BLOCK 8 · VERIFY — RUN THESE YOURSELF, DO NOT TAKE ANYONE'S WORD
-- =====================================================================
-- These prove the three things that matter:
--   (a) a normal researcher is not an admin
--   (b) an admin read produced a log row
--   (c) the log cannot be edited or deleted by anyone through the API
-- plus (d) the three new functions are built safely.
--
-- Run them in the SQL editor, AND run the browser checks in BLOCK 11 —
-- a query run as the database owner proves what the OWNER sees, and
-- that is a different question from what a browser can reach.

-- ---------------------------------------------------------------------
-- V-A · (a) WHO IS AN ADMIN, AND WHO IS NOT.
-- Expected: exactly ONE row reading true (your demo admin). Every
-- researcher account reads false. READ the granted_by / reason columns
-- — that eyeball is the control, not the CHECK constraint (BLOCK 1).
-- ---------------------------------------------------------------------
select u.email,
       coalesce(a.active, false) as is_admin_now,
       a.granted_by, a.granted_at, a.revoked_at, a.reason
  from auth.users u
  left join public.app_admins a on a.user_id = u.id
 order by coalesce(a.active, false) desc, u.email;

-- Exactly ONE bootstrap row is allowed. A second null-granted_by row
-- means somebody granted themselves administrator in the SQL editor.
select count(*) as bootstrap_rows_must_be_one
  from public.app_admins where granted_by is null;

-- And the helper itself, from here:
select public.is_admin() as is_admin_in_the_sql_editor;
-- This returns FALSE, and that fact proves nothing about a researcher —
-- it proves the SQL editor carries no JWT, so auth.uid() is null. The
-- real proof for a researcher is check 26 in BLOCK 11, in a browser.

-- ---------------------------------------------------------------------
-- V-B · (b) AN ADMIN READ PRODUCED A LOG ROW.
-- The recipe, in this order, or the proof is not a proof:
--   1. run the count below and write the number down
--   2. in the ADMIN's browser session (second browser — see BLOCK 11):
--        await sb.rpc('admin_read_mission',
--          { p_mission_id: A_MISSION, p_reason: 'demo: support request' })
--   3. run both queries again. The count is EXACTLY ONE HIGHER, and the
--      new row names the admin, the subject, the mission and the reason.
--   4. now call it again with p_reason: 'x'. It is refused AND THE
--      COUNT DOES NOT MOVE — a refused read leaves no entry, because
--      there was no read.
-- ---------------------------------------------------------------------
select count(*) as log_rows from public.admin_access_log;

select l.at,
       admin_u.email as admin_email,
       subj_u.email  as subject_email,
       l.action, l.mission_id, l.row_count, l.reason
  from public.admin_access_log l
  left join auth.users admin_u on admin_u.id = l.admin_id
  left join auth.users subj_u  on subj_u.id  = l.subject_id
 order by l.at desc
 limit 20;

-- ---------------------------------------------------------------------
-- V-C · (c) NOBODY IN A BROWSER CAN READ, WRITE, EDIT OR DELETE EITHER
-- NEW TABLE. BOTH QUERIES MUST RETURN ZERO ROWS.
-- Table-level first, then COLUMN-level — the first query does not show
-- column grants, and a column grant is exactly how a leak hides.
-- ---------------------------------------------------------------------
select grantee, table_name, privilege_type
  from information_schema.role_table_grants
 where table_schema = 'public'
   and table_name in ('app_admins','admin_access_log')
   and grantee in ('anon','authenticated','public','service_role');

select grantee, table_name, column_name, privilege_type
  from information_schema.column_privileges
 where table_schema = 'public'
   and table_name in ('app_admins','admin_access_log')
   and grantee in ('anon','authenticated','public','service_role');

-- ---------------------------------------------------------------------
-- V-D · (d) THE NEW FUNCTIONS ARE BUILT SAFELY, AND THE NEW POLICIES
-- ARE THE ONES YOU THINK THEY ARE.
-- All three functions must show prosecdef = true AND a search_path in
-- `settings`. A SECURITY DEFINER function without a pinned search_path
-- is a privilege-escalation hole, not a helper. (This is verify query 8
-- in 99_verify.sql, narrowed to tonight's three.)
-- ---------------------------------------------------------------------
select p.proname as function_name, p.prosecdef as is_security_definer,
       p.proconfig as settings
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('is_admin','admin_read_mission','my_access_log')
 order by 1;

-- Exactly ONE row: adminlog_select_subject, cmd SELECT, roles
-- {authenticated}, on admin_access_log. app_admins must appear NOWHERE
-- in this result — it has no policy on purpose.
select tablename, policyname, roles, cmd, qual
  from pg_policies
 where schemaname = 'public'
   and tablename in ('app_admins','admin_access_log')
 order by tablename, policyname;


-- =====================================================================
-- BLOCK 9 · THE CUT — FIVE STATEMENTS, KEPT WITH THE FILE
-- =====================================================================
-- If it is 22:00 and the admin door does not work, uncomment these
-- five, run them, re-run 99_verify.sql queries 1, 3 and 4, and stop.
-- Run them BEFORE re-pasting this file after changing a column, a
-- constraint, or a function's return columns (BLOCK 0.4).
--
-- drop function if exists public.my_access_log();
-- drop function if exists public.admin_read_mission(uuid,text);
-- drop function if exists public.is_admin();
-- drop table    if exists public.admin_access_log cascade;
-- drop table    if exists public.app_admins cascade;
--
-- The policy in BLOCK 4 goes with its table, so it needs no line of its
-- own. Nothing in files 01-06 refers to any of these names, which is
-- why the cut cannot break se-m1.


-- =====================================================================
-- BLOCK 10 · PHASE 2 — DO NOT RUN THIS WEEK, AND HERE IS WHY
-- =====================================================================
-- Everything below is real, designed, and deliberately not built.
-- Being able to describe the rung above you is worth more to a judge
-- than a half-built version of it.
--
-- 10.1 · AN ADMIN LISTING THAT IS HONEST — ~25 min
--   The naive version logs one row with subject_id = null, so the bulk
--   disclosure appears on NOBODY's "who viewed this" page (BLOCK 5).
--   The honest version writes ONE ROW PER AFFECTED RESEARCHER:
--     insert into public.admin_access_log
--       (admin_id, action, subject_id, reason, row_count)
--     select (select auth.uid()), 'list_missions', m.researcher_id,
--            btrim(p_reason), count(*)
--       from public.missions m group by m.researcher_id;
--   ...which also needs 'list_missions' added to the action CHECK.
--   NOT THIS WEEK: the SQL editor already lists missions, so this buys
--   an administrator convenience at the price of a new bulk-read path.
--
-- 10.2 · admin_read_raw_step() FOR ABUSE INVESTIGATION — ~20 min
--   A SECOND named function with its own action value, so the log can
--   distinguish "looked at her work" from "read our system prompts".
--   The same shape would extend the door to results and reports.
--   NOT THIS WEEK: nothing in the demo needs raw prompts, and a second
--   door is a second thing to get wrong at midnight.
--
-- 10.3 · HASH-CHAIN THE LOG — ~60 min
--   prev_hash + row_hash computed in the logging function over
--   (prev_hash, admin_id, subject_id, mission_id, at, reason); a
--   verification query re-walks the chain. Makes tampering DETECTABLE
--   even by someone holding the SQL editor. It does not make tampering
--   impossible — that is Phase 3.
--   NOT THIS WEEK: it changes the table shape, so BLOCK 9 first, and it
--   is an hour of arithmetic on a week with no hour spare.
--
-- 10.4 · TWO-PERSON GRANT — ~90 min
--   Admin 1 inserts the row with active = false; a DIFFERENT admin
--   activates it via admin_activate_grant(uuid, reason), which refuses
--   when auth.uid() = granted_by AND when auth.uid() = user_id, and
--   logs both events. Genuine separation of duties in about thirty
--   lines. NOT THIS WEEK: there is one administrator and one dashboard
--   password, so this week it would be theatre.
--
-- 10.5 · MFA REQUIRED FOR ADMIN, ENFORCED IN THE DATABASE
--   The DATABASE LINE IS TWO MINUTES — add to is_admin():
--     -- and coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
--   so an admin session that has not completed a second factor is not
--   an admin session at all, enforced in Postgres and not in the UI.
--   THE ENROLMENT SCREEN IS AN EVENING (2.5-4 h): a TOTP flow on a
--   hand-written static page with no build step, plus a recovery path
--   for the night the authenticator is on a phone that is not in the
--   room. Do not quote "20 minutes" for the pair; quote both numbers.
--   [CHECK IN DASHBOARD] that MFA/TOTP enrolment is enabled on this
--   project, and verify the claim name on a live token with
--       select auth.jwt();
--   before trusting the string 'aal'.
--   AND NAME THE COLLISION: if MFA ships as OPT-IN for researchers, it
--   must still be MANDATORY for an administrator. The account worth
--   stealing is this one.
--
-- 10.6 · AN IN-APP ADMIN REVIEW CONSOLE — ~60 min
--   Needs a select policy on admin_access_log for admins, plus a
--   read-only screen. NOT THIS WEEK: it spends 01's last build night on
--   a COULD, and the Tier-1 administrator reviews the log in the SQL
--   editor at a cost of zero minutes of anybody else's evening.
--
-- 10.7 · ALERTING, REQUEST CONTEXT, NAMED ADMIN IDENTITY
--   A nightly digest of every admin read (detection, not just
--   record-keeping, ~45 min); session/IP context on the log row
--   [CHECK IN DASHBOARD for what PostgREST exposes as GUCs on this
--   version]; and naming the individual administrator once there is a
--   published list of who the administrators are (BLOCK 6).
--
-- 10.8 · TWO NARROW ADMIN WRITES, IF THE PRODUCT EVER NEEDS THEM
--   admin_set_accepting_missions(boolean, reason) and
--   admin_suspend_mission(uuid, reason). Both write STATUS, never
--   CONTENT; neither can edit an objective, a result, an agent step or
--   a report. The Tier-1 admin is READ-ONLY — see the decision entry in
--   BLOCK 11 for the six arguments, of which the strongest is that
--   write access destroys the meaning of reports.approved_by and of
--   every refusal row in agent_steps.
--   Deletion for a GDPR-style erasure request is Phase 3: that is a
--   documented process with a request record and a second approver, not
--   a button. Build the button first and you have built the deletion
--   capability without the process, which is the wrong order.
--
-- =====================================================================
-- PHASE 3 · WHAT A REAL KFAS-GRADE VERSION WOULD REQUIRE
-- State these as the ladder you can SEE, never as things you have.
--   · THE LOG LEAVES THE DATABASE IT AUDITS. Append-only, write-once
--     storage in a separate account, written by a principal the
--     application cannot revoke. Everything above can ultimately be
--     edited by whoever holds the database owner credential; this is
--     the rung that fixes that, and nothing below it does.
--   · SEPARATION OF DUTIES AS AN ORG FACT: the person who administers
--     the platform is not the person who holds the database credential,
--     and neither can grant themselves the other's access.
--   · JUST-IN-TIME, TIME-BOXED, TICKET-LINKED ADMIN. Nobody is a
--     standing admin; `active boolean` becomes `active_until
--     timestamptz` and expires on its own.
--   · pgAudit or equivalent AT THE DATABASE LAYER, so a direct SQL
--     session is recorded too and not only application traffic.
--     [CHECK IN DASHBOARD for availability; assume it needs a plan that
--     exposes server parameters.]
--   · ACCESS REVIEW on a schedule. An admin list nobody re-certifies is
--     a list of former employees.
--   · THE ARCHITECTURAL VERSION OF "PRIVATE REGARDLESS OF THE SUPER
--     ADMIN": objective and result bodies encrypted in the browser with
--     keys the platform never holds — then the admin cannot read them,
--     because there is nothing readable to read. AND THAT WOULD BREAK
--     THIS PRODUCT, because the n8n agent chain has to read the
--     objective in order to act on it. That is a real design conflict,
--     not an excuse, and saying so is a better answer than either "we
--     built Apple-grade security" or "we ran out of time".


-- =====================================================================
-- BLOCK 11 · WHAT THIS FILE ASKS OF EVERYTHING ELSE
-- =====================================================================
--
-- ONE EDIT TO ONE EXISTING FILE — AND IT HAS ALREADY BEEN MADE.
-- db/99_verify.sql, query 3, used to say app_settings is the ONLY name
-- allowed to appear there. Its comment now names `app_admins` as the
-- one legitimate exception, CONDITIONAL on this file having been run.
-- That wording is deliberate: in a week where 07 is only READ, the
-- table does not exist, app_admins must NOT appear, and the check
-- still reads correctly. Nothing further to change there.
--
-- Both tables are "RLS on, no policy, no grant" on purpose — the kill
-- switch and the admin list. A THIRD name in query 3 is a bug.
--
-- (admin_access_log does NOT appear there: it HAS a policy. It has no
-- grant either, which is belt and braces, and V-C proves it.)
-- Do NOT edit db/03_grants.sql (BLOCK 0.5). Do not edit files 01, 02,
-- 04, 05 or 06 at all.
--
-- ---------------------------------------------------------------------
-- THE UI COPY STRING — give this to 01 as a string to paste, on the
-- sign-up screen and under the mission objective field.
-- >>> THIS SHIPS EVEN IF NONE OF THE SQL ABOVE DOES. <<<
--
--   Your missions are private to you and to anyone you share them with.
--   Other researchers cannot see them. A platform administrator can
--   open any mission for support and safety reasons — every time that
--   happens it is recorded, and you can see it on the mission page.
--   Prototype. Invented data only. Not connected to kuwaitsat.space or
--   to any KFAS system.
--
-- The last line is not decoration. It is the honesty line, it belongs
-- on the same panel as the privacy claim, and it is the difference
-- between a confident answer and a scramble when a judge asks whether
-- this is the real site.
--
-- If the SQL above was cut, cut the middle sentence of that copy too —
-- never advertise a "you can see it" that does not exist.
--
-- ---------------------------------------------------------------------
-- FIVE NEW ROWS FOR tests/RLS-TEST-MATRIX.md — the five that carry the
-- argument, with the same three setup rules already at the top of that
-- file (check who you are first; never the service-role key; a real
-- PASS goes to the API, not to our page).
--
-- >>> THE SETUP CORRECTION THAT MATTERS MOST: the admin session goes in
-- >>> A SECOND BROWSER (Edge, Firefox) or a SEPARATE CHROME PROFILE —
-- >>> NEVER a "third private window". docs/DEMO-SCRIPT.md already says
-- >>> every Incognito window in one browser shares ONE session, so
-- >>> signing in as the admin REPLACES Researcher B. If a judge then
-- >>> asks to re-run the two-window test, se-m1 — a MUST — fails live,
-- >>> because of a COULD. Open it and sign in BEFORE the demo starts,
-- >>> never during. <<<
--
-- | #  | What we try                                                     | As    | Expected |
-- |----|-----------------------------------------------------------------|-------|----------|
-- | 26 | sb.from('missions').select('id,title').eq('id', A_MISSION)      | admin | 0 rows — admin is not a bigger account |
-- | 28 | sb.rpc('admin_read_mission', {p_mission_id: A_MISSION,           | admin | the mission returns AND a new admin_access_log row exists |
-- |    |   p_reason: 'demo: support request'})                           |       |  |
-- | 30 | the same rpc, p_reason: 'trying it on'                           | B     | 'Mission not found.' — the same string B gets everywhere else |
-- | 32 | sb.from('admin_access_log').delete().neq('id','00000000-0000-0000-0000-000000000000') | admin | 0 rows / permission denied — an admin cannot erase their own visit |
-- | 33 | sb.rpc('my_access_log')                                          | B     | none of A's rows — the log is not a directory |
--
-- 26 proves the DESIGN rather than the feature: anyone can demo a role
-- flag that turns on more data; showing the admin getting ZERO through
-- the ordinary path is what shows you understood the problem.
-- 32 is the one a good judge asks for unprompted.
-- 33 is the one this design would otherwise have left untested.
--
-- ---------------------------------------------------------------------
-- THE DECISION ENTRY. docs/DECISIONS.md currently ends at D-7 — but two
-- other security tracks also want "D-8". CHECK THE FILE AND TAKE THE
-- NEXT FREE NUMBER before pasting, and add the matching row to the
-- table at the top.
--
--   ### D-? · The super admin is read-only, and every read is logged
--
--   DECISION. Administrator status is a row in public.app_admins — RLS
--   on, no policy, no grant to any browser role. It is never a column
--   on profiles, never user_metadata, never anything the browser sends.
--   can_read_mission() is NOT modified. An administrator reads a
--   researcher's mission only by calling admin_read_mission(id,
--   reason), which writes an admin_access_log row IN THE SAME
--   TRANSACTION as the read. The administrator has NO WRITE ACCESS TO
--   ANY RESEARCH CONTENT. Researchers are told this in the interface
--   and can see every access to their own missions.
--
--   WHY READ-ONLY. It is what was actually asked for — "allowed to see
--   and look at". And write privilege would destroy the meaning of
--   every audit trail already built: agent_steps is the evidence that
--   the AI asked and was told no, and reports.approved_by is the human
--   checkpoint behind "the agent proposes, a person approves". If an
--   admin can edit either, we can no longer say "this report was
--   approved by this researcher"; only "no admin has edited it", which
--   is the one thing we cannot prove. It also shrinks a stolen admin
--   session from CORRUPT THE RECORD to READ THE RECORD — and even the
--   read is visible to the person it was about. Read-only costs
--   nothing: it is a decision, not code.
--
--   WHY A SEPARATE DOOR. An RLS policy is a boolean expression inside a
--   read: it cannot insert, so it cannot log. Therefore admin access
--   granted BY POLICY can never be recorded. Editing can_read_mission()
--   would have silently widened four policies and two views, all of
--   them unloggable. A separate logged door is the only shape in which
--   "the log is complete" is true by construction rather than by
--   discipline.
--
--   WHAT IT COSTS THE REST OF YOU. Nothing in files 01-06 changes. 01
--   adds one line of copy to the sign-up and mission screens, and one
--   "who has viewed this" list from my_access_log() — rendered with
--   textContent, never innerHTML, because that reason string is written
--   by one user and displayed to another. 02 must not add an is_admin
--   column to profiles; if a screen ever needs the flag, it comes from
--   is_admin().
--
--   SCOPE LIMITS WE STATE OURSELVES. The admin can open a mission's
--   BRIEF and see who owns it; the findings, reports and agent steps
--   are not in that function. A mission shared with a collaborator logs
--   the OWNER as the subject, so the collaborator is not notified.
--   Tier 1 RECORDS, and caps an admin at 30 reads an hour; it does not
--   DETECT and it alerts nobody. Granting and revoking happen in the
--   SQL editor and are evidenced by the app_admins row, not by the log.
--
--   THE HONEST LIMIT, AND WE SAY IT FIRST. The log is honest against an
--   ADMINISTRATOR. It is not honest against whoever holds the database
--   credential — that is me, with the SQL editor open, and I can edit
--   any table in this project. Every "canary query" we run for
--   monitoring is itself an unaudited read of every researcher's work,
--   made as the database owner and leaving no row anywhere. For a
--   prototype with invented data that is the right trade; it is also
--   the exact reason the admin role is an audited SECURITY DEFINER
--   function that writes a row before it returns data, and not a second
--   seat in that dashboard. In a real deployment the log ships off this
--   database to storage the application account cannot write to, and
--   the person who runs the platform is not the person who holds the
--   database credential. Here, those are the same student.
--
--   THE APPLE COMPARISON, IN FOUR LINES. Apple's model is: privilege is
--   a server-side entitlement, never a client claim; the most sensitive
--   content is protected ARCHITECTURALLY (end-to-end encryption, keys
--   Apple does not hold), not by policy; and privileged access is
--   instrumented and reviewed by people whose only job is that. THE
--   RUNG WE ARE STANDING ON: privilege IS a server-side row — the same
--   idea at a tiny scale, and that part is genuinely right. Access is
--   POLICY-PREVENTED, NOT ARCHITECTURALLY PREVENTED. Instrumentation
--   exists at the application layer only. The rung above is Phase 3 in
--   BLOCK 10, and it conflicts with our own agent chain, which has to
--   read the objective.
--
--   STATUS: LOCKED. Who must agree: 01, 02, 05.
--
-- ---------------------------------------------------------------------
-- THE 30-SECOND DEMO BEAT — ONLY IF THE SQL ABOVE ACTUALLY RAN, and
-- only with 05 (who owns the seven-minute clock) agreeing to the extra
-- time. docs/DEMO-SCRIPT.md is titled "the 40 seconds I own"; this adds
-- 30 more, and Wednesday is rehearsal only, so it gets ONE rehearsal.
-- It runs AFTER the existing six beats, reusing the same mission id.
-- Pre-paste both console commands into history and use the up-arrow;
-- "it's on the clipboard from beat 2" is the most fragile object in a
-- live demo.
--
--   1. Second browser, admin session, the ORDINARY query on A's mission
--      -> rows: 0.
--      "Third account. This one is the platform administrator. Through
--       the normal door, nothing. Admin isn't a bigger account."
--   2. await sb.rpc('admin_read_mission', { p_mission_id: A_MISSION,
--                    p_reason: 'demo: support request' })
--      -> the mission BRIEF returns.
--      "There's one door, and it makes you say why."
--   3. Refresh Researcher A's window
--      -> "Accessed by a platform administrator · just now · support
--          request".
--      "They can look. She sees that they looked."
--
-- If asked "could the admin delete that log row?" — do not explain, run
-- check 32. Then give the honest half immediately, unprompted:
--   "As the administrator, no — the log is append-only and they have no
--    delete grant. As the person holding the database password, yes, I
--    could. In a real deployment that log is written off this database
--    to storage the app can't reach, and the platform administrator
--    isn't the person with the database credential. Here they're both
--    me. That's the next rung, and I know which rung I'm on."
-- =====================================================================
