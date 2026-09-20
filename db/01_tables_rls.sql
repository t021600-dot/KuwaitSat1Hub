-- =====================================================================
-- KuwaitSat-1 Mission Hub
-- 01 · TABLES + RLS SWITCH
-- Owner: 03 · Security          Run: Sunday 20 Sep, BEFORE any page reads data
-- Run in the Supabase SQL editor. ONE BLOCK AT A TIME, in file order.
-- If a block errors you need to know which one. Do not paste the folder.
--
-- NOTE TO 02 · BACK END: the columns below are the SECURITY-CRITICAL ones.
-- Add your own columns freely. Do not remove or change:
--   · researcher_id                        (every ownership rule hangs off it)
--   · id uuid default gen_random_uuid()    (NOT serial — see DECISIONS.md D-4)
--   · the "enable row level security" lines at the bottom
-- =====================================================================

-- ---------------------------------------------------------------------
-- profiles · our own user table. NO PASSWORD COLUMN EXISTS (se-m3).
-- Supabase Auth holds the password hash in auth.users. We never copy it,
-- never read it, never display it. That is the whole of se-m3.
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  org          text,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- missions · the research question + the map area
-- ---------------------------------------------------------------------
create table if not exists public.missions (
  id             uuid primary key default gen_random_uuid(),

  -- THE OWNER COLUMN. Everything in se-m1 hangs off this one line.
  -- Defence in depth, three independent walls:
  --   1. the column default sets it
  --   2. the trigger in file 06 overwrites whatever arrives
  --   3. the browser has no INSERT grant on this column (file 03)
  -- Any one alone would do. We use all three.
  researcher_id  uuid not null default auth.uid()
                 references auth.users(id) on delete cascade,

  title          text not null,
  objective      text not null,
  area_geojson   jsonb not null,          -- GeoJSON Polygon over the Kuwait map

  status         text not null default 'draft',

  -- set by the agent when the objective contains an INSTRUCTION rather than
  -- a research question. Shown on screen as a chip. Never browser-editable.
  injection_flag boolean not null default false,

  created_at     timestamptz not null default now(),
  launched_at    timestamptz
);
create index if not exists missions_by_researcher
  on public.missions (researcher_id, created_at desc);

-- ---------------------------------------------------------------------
-- mission_runs · one row per Launch Mission press.
-- This is capstone item be-m5: "every automated run leaves a row: what
-- started it, when, its status, what came out".
-- ---------------------------------------------------------------------
create table if not exists public.mission_runs (
  id          uuid primary key default gen_random_uuid(),
  mission_id  uuid not null references public.missions(id) on delete cascade,
  status      text not null default 'queued',
  started_at  timestamptz not null default now(),
  finished_at timestamptz,

  -- six named agent steps; the bound is generous ON PURPOSE.
  -- A too-tight bound refuses a real run and the audit row vanishes with it.
  tool_calls  integer not null default 0 check (tool_calls between 0 and 40),

  n8n_execution_id text,   -- INTERNAL · never granted to the browser
  error_note       text    -- INTERNAL · never granted to the browser
);
-- one lost HTTP response must never create two runs for one n8n execution
create unique index if not exists mission_runs_exec
  on public.mission_runs (n8n_execution_id) where n8n_execution_id is not null;
create index if not exists mission_runs_by_mission
  on public.mission_runs (mission_id, started_at desc);

-- ---------------------------------------------------------------------
-- agent_steps · the six agents, one row each, INCLUDING REFUSALS.
-- A refused step is the evidence that the AI asked and was told no.
--
-- NOTE: there is deliberately NO researcher column here. This table
-- reaches its owner through run_id -> mission_runs -> mission_id ->
-- missions. That chain is why can_read_run() in file 02 must be
-- SECURITY DEFINER.
-- ---------------------------------------------------------------------
create table if not exists public.agent_steps (
  id             uuid primary key default gen_random_uuid(),
  run_id         uuid not null references public.mission_runs(id) on delete cascade,
  step_name      text not null check (step_name in
                   ('satellite_data','environmental_analysis','recommendation',
                    'impact_prediction','visualization','reporting')),
  tool           text,
  arguments      jsonb,
  allowed        boolean not null default true,
  refused_reason text,
  status         text not null default 'running'
                 check (status in ('running','complete','refused','failed')),
  injection_flag boolean not null default false,
  started_at     timestamptz not null default now(),
  finished_at    timestamptz,

  raw_prompt     text,     -- INTERNAL
  raw_response   text,     -- INTERNAL
  confidence     numeric   -- INTERNAL
);
create index if not exists agent_steps_by_run
  on public.agent_steps (run_id, started_at);

-- ---------------------------------------------------------------------
-- results · what appears on the Kuwait map
-- ---------------------------------------------------------------------
create table if not exists public.results (
  id         uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  run_id     uuid not null references public.mission_runs(id) on delete cascade,
  kind       text not null check (kind in ('site','metric','map_layer','narrative')),
  title      text not null,
  body       text,
  geometry   jsonb,

  -- the status gate: a half-written agent output is not a finding
  status     text not null default 'draft'
             check (status in ('draft','complete','superseded')),

  source_ref text,   -- INTERNAL · satellite scene / archive path. See DECISIONS D-2
  created_at timestamptz not null default now()
);
create index if not exists results_by_mission
  on public.results (mission_id, created_at desc);

-- ---------------------------------------------------------------------
-- reports · exists only because a human clicked Generate Report.
-- This table IS the capstone SHOULD item "the agent proposes, a person
-- approves". approved_by is the person. Do not default it.
-- ---------------------------------------------------------------------
create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  mission_id  uuid not null references public.missions(id) on delete cascade,
  body_md     text not null,
  approved_by uuid not null references auth.users(id) on delete cascade,
  approved_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- mission_collaborators · explicit sharing. Researcher A invites B.
-- Without this table "private" means "nobody can ever share", which is not
-- what a research platform is. With it, sharing is a WRITTEN ROW that you
-- can point at — never a guess, never a role string in localStorage.
-- ---------------------------------------------------------------------
create table if not exists public.mission_collaborators (
  mission_id uuid not null references public.missions(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'viewer' check (role in ('viewer','editor')),
  granted_by uuid not null references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  primary key (mission_id, user_id)
);

-- ---------------------------------------------------------------------
-- app_settings · one row: the kill switch and the rate limits.
-- No browser role ever gets a grant on it. You flip it in the SQL editor.
-- ---------------------------------------------------------------------
create table if not exists public.app_settings (
  id                     boolean primary key default true check (id),
  accepting_new_missions boolean not null default true,
  max_missions_per_hour  int     not null default 5,
  max_missions_per_day   int     not null default 20
);
insert into public.app_settings (id) values (true) on conflict do nothing;


-- =====================================================================
-- THE LINE WITHOUT WHICH NOTHING ABOVE MATTERS
--
-- Miss one of these and that table is readable by anyone holding the
-- publishable key — which is in our JavaScript, which is public by design.
-- The publishable key is safe ONLY because RLS is on. That sentence is
-- from CONTRIBUTING.md and it is the entire reason this file exists.
-- =====================================================================
alter table public.profiles              enable row level security;
alter table public.missions              enable row level security;
alter table public.mission_runs          enable row level security;
alter table public.agent_steps           enable row level security;
alter table public.results               enable row level security;
alter table public.reports               enable row level security;
alter table public.mission_collaborators enable row level security;
alter table public.app_settings          enable row level security;

-- Do NOT add "force row level security". Force applies RLS to the table
-- owner too, which breaks every SECURITY DEFINER helper in file 02 and
-- looks exactly like "all the data vanished".
