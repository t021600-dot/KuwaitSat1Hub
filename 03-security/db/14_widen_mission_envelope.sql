-- =====================================================================
-- KuwaitSat-1 Mission Hub
-- 14 · WIDEN THE MISSION ENVELOPE TO COVER KUWAIT'S SEA
-- Owner: 03 · Security     Run: by hand in Supabase, after review
--
-- >>> NOT YET APPLIED. <<<
-- Every other file in this folder describes the live database. This one
-- does not, and must not be assumed to, until somebody runs it and
-- changes this header.
--
-- ---------------------------------------------------------------------
-- WHY
-- ---------------------------------------------------------------------
-- kuwait_area_ok() in 06_validation.sql refuses any polygon outside
-- 46.5-48.8 E, 28.5-30.1 N. That was written as "a box round Kuwait" and
-- for LAND it very nearly is: measured against the OpenStreetMap
-- coastline it excludes 12.1 km2, a strip north of 30.1 N, out of
-- 17,353 km2. Fine.
--
-- For SEA it is not. Measured against the Marine Regions zones now in
-- assets/geo/:
--
--     zone                total        excluded by 48.8 E      %
--     EEZ                 10,791.7 km2      3,341.5         31.0
--     contiguous zone      2,057.4 km2      1,331.8         64.7
--     territorial sea      7,182.7 km2        457.9          6.4
--
-- The territorial sea reaches 49.005 E and the EEZ 49.526 E. Qaruh, the
-- easternmost island, sits 2.2 km inside the current limit - so the
-- envelope does not quite cut off Kuwaiti land, but it cuts off a third
-- of the sea Kuwait has rights over, and any mission over the outer EEZ
-- is refused today with a constraint violation.
--
-- ---------------------------------------------------------------------
-- WHAT CHANGES, AND WHAT DOES NOT
-- ---------------------------------------------------------------------
-- The envelope goes to 46.5-49.6 E, 28.5-30.15 N. That contains the
-- whole EEZ (49.526 E) with a small margin, and 30.15 N picks up the
-- 12 km2 of land the old north edge clipped.
--
-- Everything else about the check is untouched: still a Polygon, still
-- one ring, still 4 to 200 points, still every point a two-number array.
-- The envelope is the only clause that moves.
--
-- THIS ONLY LOOSENS. Every polygon that passes today still passes, so
-- there is no data migration and nothing to backfill. The existing rows
-- were re-checked before this was written.
--
-- >>> THE ENVELOPE IS NOT A MAP OF KUWAIT AND NEVER WAS <<<
-- It is a rectangle. Widening it means a mission can now be drawn over
-- sea, over Iraq east of 48.8 E, and over Iranian water. It is a sanity
-- bound - "this coordinate is somewhere near Kuwait" - not a statement
-- about sovereignty, and it must not be quoted as one.
--
-- The real test lives in the browser: KS.layers.onKuwaitiLand() in
-- js/ksat-layers.js asks the actual coastline. It is advisory, because
-- anything in a browser is. Moving the authoritative test into SQL would
-- mean putting a 58 kB polygon in the database and calling
-- ST_Contains(), which needs PostGIS - not installed on this project,
-- and not a thing to install the week of a demo.
--
-- ---------------------------------------------------------------------
-- VERIFY, BEFORE AND AFTER
-- ---------------------------------------------------------------------
--   -- nothing existing breaks: expect 0 rows
--   select id, title from public.missions
--    where not public.kuwait_area_ok(area_geojson);
--
--   -- after: a point in the outer EEZ is accepted, one in Iran is not
--   select public.kuwait_area_ok(
--     '{"type":"Polygon","coordinates":[[[49.2,29.2],[49.4,29.2],
--        [49.4,29.4],[49.2,29.4],[49.2,29.2]]]}'::jsonb) as outer_eez_ok;
--   select public.kuwait_area_ok(
--     '{"type":"Polygon","coordinates":[[[50.5,29.2],[50.7,29.2],
--        [50.7,29.4],[50.5,29.4],[50.5,29.2]]]}'::jsonb) as beyond_ok;
--   -- expect: outer_eez_ok = true, beyond_ok = false
-- =====================================================================

create or replace function public.kuwait_area_ok(a jsonb)
returns boolean
language sql
immutable
set search_path to 'public', 'pg_temp'
as $function$
  with pts as (
    select pt from jsonb_array_elements(
      case when jsonb_typeof(a->'coordinates'->0)='array'
           then a->'coordinates'->0 else '[]'::jsonb end) as pt)
  select jsonb_typeof(a)='object'
    and coalesce(a->>'type','')='Polygon'
    and jsonb_typeof(a->'coordinates')='array'
    and jsonb_array_length(a->'coordinates')=1
    and jsonb_array_length(a->'coordinates'->0) between 4 and 200
    and not exists (select 1 from pts where jsonb_typeof(pt)<>'array'
         or jsonb_array_length(pt)<>2 or jsonb_typeof(pt->0)<>'number'
         or jsonb_typeof(pt->1)<>'number')
    -- 46.5-49.6 E covers the EEZ to 49.526 E; 30.15 N picks up the
    -- 12 km2 of land the old 30.1 clipped. Was 46.5-48.8 / 28.5-30.1.
    and not exists (select 1 from pts
        where jsonb_typeof(pt->0)='number' and jsonb_typeof(pt->1)='number'
          and ((pt->>0)::numeric not between 46.5 and 49.6
            or (pt->>1)::numeric not between 28.5 and 30.15));
$function$;

comment on function public.kuwait_area_ok(jsonb) is
  'Mission area sanity bound: a GeoJSON Polygon, one ring, 4-200 points, '
  'every point inside 46.5-49.6 E / 28.5-30.15 N. A RECTANGLE, not a map '
  'of Kuwait - see 14_widen_mission_envelope.sql. The coastline test is '
  'KS.layers.onKuwaitiLand() in the browser and is advisory.';

-- The CHECK constraint on public.missions calls this function by name,
-- so replacing the function is enough. Postgres does NOT re-validate
-- existing rows on create or replace, which is correct here because the
-- change only loosens - but it is worth knowing that it would not catch
-- a tightening.
