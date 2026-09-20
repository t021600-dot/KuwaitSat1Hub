-- =====================================================================
-- KuwaitSat-1 Mission Hub
-- 03 · GRANTS — the second wall, invisible in the CREATE TABLE SQL
-- Owner: 03 · Security          Run: Sunday, after file 02
--
-- THE THING NOBODY TELLS BEGINNERS:
-- Supabase grants ALL on every new public table to `anon` AND
-- `authenticated` automatically. So a table with perfect RLS policies can
-- still leak a COLUMN, because:
--
--        RLS decides WHICH ROWS.      GRANTS decide WHICH COLUMNS
--                                     and WHICH VERBS.
--
-- RLS cannot hide a column. That is not a gap in our design, it is what
-- RLS is. Column hiding is done here, and in the views in file 05.
--
-- So: take everything back, then hand back the minimum, column by column.
-- =====================================================================

revoke all on public.profiles, public.missions, public.mission_runs,
              public.agent_steps, public.results, public.reports,
              public.mission_collaborators, public.app_settings
  from anon, authenticated;

-- `anon` now has NOTHING anywhere. A private window that never signed in
-- reads zero rows from every table, even holding the publishable key
-- straight out of our config.js. That is sh-m1 and se-m1 at once.


-- ---------------------------------------------------------------------
-- >>> THE LINE THAT IS MISSING FROM EVERY TUTORIAL <<<
--
-- n8n has to authenticate as SOMETHING to call our agent_* functions.
-- That something is `service_role`, and service_role has BYPASSRLS —
-- every policy in file 04 is invisible to it.
--
-- So the key sitting in the n8n credential store, which exists only to
-- call /rest/v1/rpc/agent_log_step, can ALSO call
--        GET /rest/v1/missions?select=*
-- and read every researcher's objective, map area and source_ref, and
--        POST /rest/v1/results
-- onto anybody's mission. Our whole model would rest on n8n choosing to
-- be polite.
--
-- Revoking the TABLE privileges fixes it and costs nothing: BYPASSRLS
-- skips POLICIES, it does not skip GRANTS. The SECURITY DEFINER
-- functions still work, because they run as the table OWNER, not as
-- service_role. The Supabase dashboard is unaffected — it connects as
-- `postgres`.
-- ---------------------------------------------------------------------
revoke all on public.profiles, public.missions, public.mission_runs,
              public.agent_steps, public.results, public.reports,
              public.mission_collaborators, public.app_settings
  from service_role;

-- After this, service_role can do exactly three things, all named in
-- file 05: agent_log_step, agent_write_result, agent_finish_run.
-- If n8n needs a fourth, it gets a fourth FUNCTION, never a table grant.


-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
grant select (user_id, display_name, org, created_at) on public.profiles to authenticated;
grant insert (user_id, display_name, org)             on public.profiles to authenticated;
grant update (display_name, org)                      on public.profiles to authenticated;
-- user_id is absent from the UPDATE grant: nobody can re-point their
-- profile row at another account.

-- ---------------------------------------------------------------------
-- missions · the browser may write EXACTLY these three columns.
-- researcher_id and status are ABSENT, so the Launch button physically
-- cannot claim a mission for somebody else or mark one complete.
-- This is stronger than any policy, because there is no code path at all.
-- ---------------------------------------------------------------------
grant insert (title, objective, area_geojson) on public.missions to authenticated;
grant select (id, researcher_id, title, objective, area_geojson, status,
              injection_flag, created_at, launched_at)
  on public.missions to authenticated;
-- No UPDATE grant, no DELETE grant. Status moves only through the RPCs
-- in file 05. A researcher cannot edit a mission after launching it —
-- that is what makes the audit trail worth anything.

-- ---------------------------------------------------------------------
-- mission_runs · read only.
-- n8n_execution_id and error_note are NOT listed: an n8n execution id is
-- an internal handle and a raw error_note leaks our stack to the screen.
-- ---------------------------------------------------------------------
grant select (id, mission_id, status, started_at, finished_at, tool_calls)
  on public.mission_runs to authenticated;

-- ---------------------------------------------------------------------
-- agent_steps · read only.
-- raw_prompt, raw_response and confidence are NOT listed. raw_prompt is
-- our system prompt; publishing it hands an attacker the exact wording to
-- work around. The researcher sees the STEP, not the plumbing.
-- ---------------------------------------------------------------------
grant select (id, run_id, step_name, tool, allowed, refused_reason,
              status, injection_flag, started_at, finished_at)
  on public.agent_steps to authenticated;

-- ---------------------------------------------------------------------
-- results · read only.
-- source_ref (the satellite archive path) is NOT listed. That path is the
-- one genuinely satellite-specific secret we hold — see THREAT-MODEL.md.
-- ---------------------------------------------------------------------
grant select (id, mission_id, run_id, kind, title, body, geometry,
              status, created_at)
  on public.results to authenticated;

-- ---------------------------------------------------------------------
-- reports, collaborators
-- ---------------------------------------------------------------------
grant select (id, mission_id, body_md, approved_by, approved_at)
  on public.reports to authenticated;

grant select (mission_id, user_id, role, granted_at)
  on public.mission_collaborators to authenticated;

-- ---------------------------------------------------------------------
-- app_settings · NO GRANT TO ANYONE. Not even select.
-- RLS on + no policy + no grant = only SECURITY DEFINER functions and the
-- SQL editor can see the kill switch. That is deliberate and it is the
-- only table allowed to appear in verify query 3 in file 99.
-- ---------------------------------------------------------------------


-- =====================================================================
-- >>> TELL 01 · FRONT END THIS, TONIGHT, IN WRITING <<<
--
-- `select('*')` on missions, mission_runs, agent_steps or results now
-- ERRORS with "permission denied for column ...". That is correct and
-- deliberate, not a bug to work around.
--
-- Two legal options:
--   1. name the columns:  .select('id, title, status, created_at')
--   2. read the views in file 05:  .from('my_missions').select('*')
--
-- Option 2 is better — the view is where I keep the never-shown list.
-- If you ever find yourself adding a column to a grant to make a screen
-- work, message me first. That is exactly how a leak ships.
-- =====================================================================
