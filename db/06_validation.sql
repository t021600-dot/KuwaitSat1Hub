-- =====================================================================
-- KuwaitSat-1 Mission Hub
-- 06 · INPUT VALIDATION  ·  THIS FILE IS se-m5
-- Owner: 03 · Security          Run: Sunday/Monday, after file 05
--
-- The judge's test, word for word:
--   "Paste 5,000 characters and submit. It refuses, does not freeze,
--    creates no row."
--
-- THE FAILURE THAT WILL GET YOU:  maxlength="1500" on the textarea.
-- The browser SILENTLY TRUNCATES the 5,000-character paste to 1,500, the
-- form accepts it, a row IS created, and nothing ever says no. From the
-- front it looks like the form "handled" it. It refused nothing.
-- >>> Ask 01 to REMOVE maxlength and use a live counter instead. <<<
--
-- Everything in this file is refused by the DATABASE. A browser check is
-- a courtesy to the user; it is not security. Every rule below still
-- fires when someone skips our page entirely and calls the API by hand.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0 · NOT NULL FIRST.  THIS ORDER MATTERS.
--
-- A CHECK constraint does not fire on a column that is ABSENT from the
-- insert — `check (char_length(objective) between 20 and 1500)` evaluates
-- to NULL, and NULL is not false, so the row is ACCEPTED.
--
--   sb.from('missions').insert({ title:'x', objective:'valid text ...' })
--   ^ no area_geojson key at all — walks straight past every CHECK below
--
-- NOT NULL is what closes that. Run these three lines before the CHECKs.
-- ---------------------------------------------------------------------
alter table public.missions alter column title        set not null;
alter table public.missions alter column objective    set not null;
alter table public.missions alter column area_geojson set not null;


-- ---------------------------------------------------------------------
-- 1 · LENGTH AND BLANKNESS
--
-- btrim() first, so 40 space characters is 0 characters, not 40.
-- char_length, NEVER octet_length: a 1,500-character Arabic objective is
-- about 3,000 bytes, and a byte check refuses a legitimate Arabic mission
-- while the counter on screen says it is fine. On a Kuwait project with a
-- language toggle, that is a visible contradiction a judge can trip.
-- ---------------------------------------------------------------------
alter table public.missions
  add constraint missions_title_len
  check (char_length(btrim(title)) between 3 and 120);

alter table public.missions
  add constraint missions_objective_len
  check (char_length(btrim(objective)) between 20 and 1500);

-- WRONG TYPE, the sneaky version. PostgREST turns the JSON number
-- 12345678901234567890123 into the STRING '1234...' and a bare length
-- check accepts it. An objective must contain something that is not a
-- digit, a space, or punctuation.
--
-- Written as a NEGATIVE match on purpose: `~ '[[:alpha:]]'` depends on
-- the database's lc_ctype and can return false for Arabic. This form
-- accepts Arabic, English, and anything else, on any locale.
-- Verify it yourself with query 6 in 99-verify.sql before you trust it.
alter table public.missions
  add constraint missions_objective_has_letter
  check (btrim(objective) !~ '^[0-9[:space:][:punct:]]*$');

alter table public.missions
  add constraint missions_title_has_letter
  check (btrim(title) !~ '^[0-9[:space:][:punct:]]*$');


-- ---------------------------------------------------------------------
-- 2 · THE MAP AREA — the field nobody validates.
-- Shape, ring count, point count, coordinate TYPE, and where on Earth.
-- ---------------------------------------------------------------------
create or replace function public.kuwait_area_ok(a jsonb)
returns boolean
language sql immutable
-- set search_path is REQUIRED here, and it was missing in the first draft.
-- Supabase's own Security Advisor flags it as `function_search_path_mutable`.
-- This one is not SECURITY DEFINER, so it cannot escalate privilege the way
-- an unpinned definer function can - but an unpinned search_path still means
-- the function resolves `jsonb_array_length` (and friends) against whatever
-- schema list the caller happens to have, so its BEHAVIOUR is not fixed.
-- For a function that sits inside a CHECK constraint - i.e. one that decides
-- whether a row is allowed to exist - "its behaviour is not fixed" is the
-- whole problem.
--
-- >>> se-m6 NOTE: this is a genuine before/after audit exhibit. Run the
-- >>> Security Advisor BEFORE applying this line, screenshot the finding,
-- >>> apply it, re-run, screenshot the clean result. Two minutes, and it is
-- >>> a real fix a judge can see - not a manufactured one.
set search_path = public, pg_temp
as $fn$
  with pts as (
    -- the CASE is load-bearing: jsonb_array_elements() on a scalar RAISES,
    -- and a validator that raises hands the researcher a raw Postgres
    -- error instead of our sentence.
    select pt from jsonb_array_elements(
      case when jsonb_typeof(a->'coordinates'->0) = 'array'
           then a->'coordinates'->0
           else '[]'::jsonb end) as pt
  )
  select
        jsonb_typeof(a) = 'object'
    and coalesce(a->>'type','') = 'Polygon'
    and jsonb_typeof(a->'coordinates') = 'array'
    and jsonb_array_length(a->'coordinates') = 1        -- one ring, no holes
    and jsonb_array_length(a->'coordinates'->0) between 4 and 200
    -- every point is [number, number]
    and not exists (
      select 1 from pts
      where jsonb_typeof(pt) <> 'array'
         or jsonb_array_length(pt) <> 2
         or jsonb_typeof(pt->0) <> 'number'
         or jsonb_typeof(pt->1) <> 'number')
    -- ...and it is over Kuwait.  [DECIDE — see DECISIONS.md D-3]
    -- This clause also bounds what the Satellite Data Agent can ever be
    -- pointed at, which is a guardrail as much as a validation.
    and not exists (
      select 1 from pts
      where jsonb_typeof(pt->0) = 'number'
        and jsonb_typeof(pt->1) = 'number'
        and ( (pt->>0)::numeric not between 46.5 and 48.8
           or (pt->>1)::numeric not between 28.5 and 30.1 ));
$fn$;

alter table public.missions
  add constraint missions_area_shape
  check (public.kuwait_area_ok(area_geojson));

-- "far too long" for a field that is not text: a 5,000-vertex freehand
-- polygon, or a Polygon object padded with 10,000 junk keys.
alter table public.missions
  add constraint missions_area_size
  check (octet_length(area_geojson::text) between 2 and 8192);

-- >>> ASK 01 FIRST: what does the map draw tool actually emit for a
-- >>> normal Kuwait-sized area? If a freehand draw routinely produces
-- >>> 300 points, the 200 bound refuses a legitimate mission and you
-- >>> find out on Wednesday. Count the real thing before you agree it.
-- >>> Leaflet's getLatLngs() returns {lat,lng} OBJECTS, not [lng,lat]
-- >>> arrays — if 01 feeds that through raw, every mission is refused.


-- ---------------------------------------------------------------------
-- 3 · STATUS IS A FIXED SET.
-- A typo'd status silently bypasses the status gate on results_select,
-- so this is se-m1's problem as much as se-m5's.
-- ---------------------------------------------------------------------
alter table public.missions
  add constraint missions_status_allowed
  check (status in ('draft','queued','running','review','complete','failed'));

alter table public.mission_runs
  add constraint runs_status_allowed
  check (status in ('queued','running','complete','failed','stalled'));


-- ---------------------------------------------------------------------
-- 4 · THE RULES A CHECK CANNOT EXPRESS.
-- Raised as P0001 with the EXACT strings 01 maps to screen messages.
-- Do not change a string here without telling 01 — their mapError()
-- matches on it.
-- ---------------------------------------------------------------------
create or replace function public.missions_guard()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare s public.app_settings; n int;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in before launching a mission.' using errcode = 'P0001';
  end if;

  -- The browser never chooses the owner or the status, even if it tries.
  -- The column grant in file 03 already makes this impossible; this line
  -- is the wall behind that wall.
  new.researcher_id := (select auth.uid());
  new.status        := 'draft';
  new.injection_flag := false;

  select * into s from public.app_settings where id;
  if s is null then
    raise exception 'Mission settings are unavailable.' using errcode = 'P0001';
  end if;
  if not s.accepting_new_missions then
    raise exception 'The prototype is not accepting new missions right now.'
      using errcode = 'P0001';
  end if;

  select count(*) into n from public.missions
   where researcher_id = (select auth.uid())
     and created_at > now() - interval '1 hour';
  if n >= s.max_missions_per_hour then
    raise exception 'Limit reached: % missions per hour.', s.max_missions_per_hour
      using errcode = 'P0001';
  end if;

  select count(*) into n from public.missions
   where researcher_id = (select auth.uid())
     and created_at > now() - interval '1 day';
  if n >= s.max_missions_per_day then
    raise exception 'Limit reached: % missions per day.', s.max_missions_per_day
      using errcode = 'P0001';
  end if;

  return new;
end $fn$;

drop trigger if exists missions_guard_bi on public.missions;
create trigger missions_guard_bi before insert on public.missions
  for each row execute function public.missions_guard();


-- =====================================================================
-- OPERATIONAL NOTE THAT WILL SAVE YOU TWENTY MINUTES ON TUESDAY
--
-- After you have created five valid test missions inside one hour, the
-- rate-limit trigger fires BEFORE the CHECK constraints — so your
-- 5,000-character test comes back "Limit reached: 5 missions per hour."
-- and you will think the length check broke. It did not.
--
-- Refused inserts roll back and do NOT count. Your successful test rows
-- do. Either wait the hour, use the second account, or raise
-- max_missions_per_hour in app_settings while testing:
--
--   update public.app_settings set max_missions_per_hour = 100 where id;
--   -- ... test ...
--   update public.app_settings set max_missions_per_hour = 5 where id;
--
-- PUT IT BACK BEFORE THE DEMO. Write it on your hand.
-- =====================================================================
