-- =====================================================================
-- KuwaitSat-1 Mission Hub
-- 13 · THE PAYLOAD ARCHIVE  ·  the frames the spacecraft actually returned
-- Owner: 03 · Security            Run: after file 12
--
-- ---------------------------------------------------------------------
-- WHAT THIS TABLE HOLDS, AND THE ONE INSTRUCTION THAT SHAPED IT
--
-- Eight decoded frames from KuwaitSat-1, with the acquisition record the
-- payload team keeps for each: date, geolocation, ground sample distance,
-- band count and processing level. The frames themselves are in here too,
-- as base64 in image_b64.
--
-- The instruction was:
--
--     "it should never be exposed in github or anywhere but in the
--      researchers page ... THE DATA SHOULD ONLY BE AVAILABLE ON THE
--      RESEARCHER page after signing in."
--
-- That rules out every path this project would otherwise have reached
-- for first:
--
--   · not a file in the repository      — the repository is public
--   · not a file in assets/             — .vercelignore ships assets/**,
--                                         so it would be a public URL
--   · not a seed .sql in this directory — this directory IS committed;
--                                         .gitignore blocks seed*.sql for
--                                         exactly this reason
--   · not Storage on a public bucket    — a public bucket URL needs no
--                                         session at all
--
-- What is left is a row in Postgres behind row level security, which is
-- the one place on this platform where "only after signing in" is
-- enforced by the database rather than promised by a screen. The page at
-- /researcher.html can be read by anyone; it contains no frames and no
-- coordinates. Every one of those arrives over an authenticated
-- PostgREST call or does not arrive.
--
-- The images are base64 text rather than bytea because the client renders
-- them straight into a data: URI, which vercel.json's img-src already
-- allows. bytea would arrive as a \x hex string — twice the bytes for the
-- same picture and a decode step on the way in.
--
-- ---------------------------------------------------------------------
-- WHY THE READ POLICY IS NOT `using (true)`
--
-- File 04 says, in capitals, that `using (true)` is the demo lost in four
-- characters, and that every read policy carries an ownership test. This
-- archive is genuinely shared — it is one instrument's output, not one
-- researcher's private work — so there is no owner column to test.
--
-- The test that IS correct here is enrolment: holding a valid JWT is not
-- the same as being a researcher on this programme. is_enrolled_researcher()
-- requires a row in public.profiles, which js/ksat-integration.js creates
-- on first sign-in and which only the programme can bring into existence.
-- If self-signup is ever left open on the Supabase dashboard, THIS is the
-- line that still holds: a stranger with an account and no profile row
-- reads zero frames.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1 · The enrolment test
--
--     SECURITY DEFINER for the same reason file 02 gives: the function
--     reads public.profiles from inside a policy, and as DEFINER it runs
--     as the table owner so RLS inside the body cannot deny it the row it
--     needs in order to judge. search_path is pinned — an unpinned
--     DEFINER function is a privilege-escalation waiting for a schema
--     called `public` to be shadowed.
-- ---------------------------------------------------------------------
create or replace function public.is_enrolled_researcher()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
  );
$$;

comment on function public.is_enrolled_researcher() is
  'True when the caller has a profile row on this programme. Used by the '
  'payload archive read policy: a valid JWT alone is not enrolment.';

revoke all on function public.is_enrolled_researcher() from public, anon;
grant execute on function public.is_enrolled_researcher() to authenticated;


-- ---------------------------------------------------------------------
-- 2 · The table
--
--     Column names follow the payload team's own record sheet so the two
--     can be read side by side. geo_method and geo_confidence are NOT
--     decoration: the source sheet left Geolocation blank on all eight
--     rows, so every coordinate in this table was worked out afterwards
--     rather than recorded by the spacecraft. A platform that badges
--     every other figure as measured or modelled has to badge these too.
-- ---------------------------------------------------------------------
create table if not exists public.payload_frames (
  frame_no          smallint     primary key,
  captured_on       date         not null,

  -- Geolocation. NULL lat/lon is a legitimate state: "not resolved".
  place_label       text,
  lat               numeric(9,5) check (lat between -90 and 90),
  lon               numeric(9,5) check (lon between -180 and 180),
  geo_method        text         not null,
  geo_confidence    text         not null
                    check (geo_confidence in ('high','medium','low','unresolved')),
  geo_note          text,

  -- The acquisition record, as the payload team wrote it.
  gsd_m             numeric(6,2) not null check (gsd_m > 0),
  band_note         text         not null,
  processing_level  text         not null,

  -- The frame itself.
  image_mime        text         not null default 'image/jpeg',
  image_b64         text         not null,
  image_w           integer,
  image_h           integer,

  source_note       text         not null,
  added_at          timestamptz  not null default now()
);

comment on table public.payload_frames is
  'Decoded KuwaitSat-1 payload frames and their acquisition record. '
  'Readable only by enrolled researchers; never served as a file.';
comment on column public.payload_frames.geo_method is
  'How the coordinate on this row was arrived at. The source record sheet '
  'left Geolocation empty, so no value here came off the spacecraft.';
comment on column public.payload_frames.image_b64 is
  'The frame, base64. Rendered client side into a data: URI.';


-- ---------------------------------------------------------------------
-- 3 · Grants
--
--     Supabase grants ALL on every new public table to anon AND
--     authenticated at creation time. File 03 explains why that is taken
--     away first and handed back one column list at a time; the same
--     applies here. anon is given nothing at all — not a narrowed grant,
--     nothing — so an unauthenticated PostgREST call fails at the
--     privilege check before RLS is ever consulted.
--
--     No INSERT, UPDATE or DELETE to anybody. Frames are loaded by the
--     payload team out of band. A researcher reading the archive can
--     never alter it, which is also what the researcher console's own
--     permission table claims on screen ("Modify original data: DENIED").
-- ---------------------------------------------------------------------
revoke all on public.payload_frames from anon, authenticated;

grant select (frame_no, captured_on, place_label, lat, lon,
              geo_method, geo_confidence, geo_note,
              gsd_m, band_note, processing_level,
              image_mime, image_b64, image_w, image_h,
              source_note, added_at)
  on public.payload_frames to authenticated;


-- ---------------------------------------------------------------------
-- 4 · Row level security
--
--     Enabled, and force'd. FORCE matters: without it the table owner
--     bypasses its own policies, and the owner is the role a careless
--     psql session or a future SECURITY DEFINER function runs as.
-- ---------------------------------------------------------------------
alter table public.payload_frames enable row level security;
alter table public.payload_frames force row level security;

drop policy if exists payload_frames_select_enrolled on public.payload_frames;
create policy payload_frames_select_enrolled on public.payload_frames
  for select
  to authenticated
  using (public.is_enrolled_researcher());

-- No insert / update / delete policy, deliberately. RLS on with no policy
-- for a command means that command is refused for everyone, including a
-- role that somehow acquired the table grant.


-- ---------------------------------------------------------------------
-- 5 · What this looks like from the outside
--
--   | caller                        | select payload_frames            |
--   |-------------------------------|----------------------------------|
--   | anon (the public site)        | permission denied — no grant     |
--   | authenticated, no profile row | 0 rows — policy false            |
--   | authenticated, enrolled       | all 8 frames                     |
--   | any caller                    | insert/update/delete: refused    |
--
-- Check it the same way file 99 checks the rest:
--
--   set local role anon;
--   select count(*) from public.payload_frames;       -- expect: denied
--
-- ---------------------------------------------------------------------
