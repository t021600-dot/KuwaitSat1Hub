# 🌱 Demo seed data

**Owner:** 02 · Back end (Hind)
*Two researchers, one completed mission with findings and a report, one unrelated
draft. This is what is on screen the moment the demo starts.*

---

## Why we seed at all

The `se-m1` test is *"sign in as account B and show me that account A's work is
not visible."* You cannot run that test against an empty database — an empty
screen proves nothing, because an empty screen is also what a broken query
looks like.

So **A has work and B has different work.** When B signs in and sees B's draft
and only B's draft, the isolation is visible rather than asserted.

Everything below is **invented data about real places**. Al-Jahra and Bubiyan
are real, the rainfall and temperature figures come from the published sources
in [`prototype/CREDITS-AND-SOURCES.txt`](prototype/CREDITS-AND-SOURCES.txt),
and the researchers, the scene ids and the zone measurements are made up for
this demo. Nothing here is a KuwaitSat-1 product.

---

## Before you paste anything

**1 · Run the schema first, in order, one file at a time.**

`03-security/db/` files `01` → `06`, then `08`, then `99_verify.sql`.
If those have not been run, everything below fails on the first insert.

**2 · Supabase → Authentication → Providers → Email → Confirm email = OFF.**

Without it a judge cannot create an account on stage and `be-m4` is untestable.

**3 · Create the two accounts.** Sign up through the app, or
Authentication → Users → Add user.

| Email | Password | Owns |
|---|---|---|
| `researcher.a@kuwaitsat.kw` | *(set in the dashboard, never written here)* | one completed mission, five findings, one approved report |
| `researcher.b@kuwaitsat.kw` | *(set in the dashboard, never written here)* | one unrelated draft mission |


> **Why no password here.** This repo is public, and `se-m3` is *"your app
> never stores a password, and none is shown on any screen or table."* A
> credential table in a committed file fails that on a grep. Create both
> accounts in **Supabase → Authentication → Users → Add user** (tick
> auto-confirm), choose the passwords there, and keep them in a password
> manager or on paper. Whoever runs the demo needs them; the repo does not.

These match the accounts already written into
`01-front-end/app/RETAG-NOTES.md`, so do not invent different ones.

> **Say this once and move on:** these credentials are in a public repository on
> purpose, because they are demo accounts on a prototype project that holds
> invented data. Do not reuse that password anywhere that matters, and do not
> put a real person's email into this project.

The SQL below finds both accounts by email, so **you never have to copy a uuid
by hand.** If either account is missing, the first block stops the script with
a sentence telling you so.

---

## ⚠️ The thing that will stop you dead

`missions` has a BEFORE INSERT trigger, `missions_guard_bi`
(`03-security/db/06_validation.sql`). Its first four lines are:

```sql
if (select auth.uid()) is null then
  raise exception 'Sign in before launching a mission.' using errcode = 'P0001';
end if;
```

**In the SQL editor `auth.uid()` is always null.** You are connected as
`postgres`, not as a signed-in researcher, so there is no JWT and no user id.
Every mission insert you paste will come back:

```
ERROR:  Sign in before launching a mission.
```

That is the trigger working exactly as designed. It is not a bug and it must
not be "fixed" by weakening the trigger.

The trigger also does three more things that we need switched off while seeding:
it overwrites `researcher_id` with `auth.uid()` (null → NOT NULL violation), it
forces `status` to `'draft'` (so A's mission could never be `'complete'`), and
it counts against the per-hour rate limit.

So the recipe is **disable → insert → re-enable**, and the re-enable is in the
same paste so it cannot be forgotten.

### Two things make forgetting it impossible

1. **The whole script is one transaction.** `alter table … disable trigger` is
   DDL, and DDL in Postgres is transactional. If *any* statement below fails,
   the `commit` never happens and the disable is rolled back with everything
   else. There is no path where the script half-runs and leaves the guard off.
2. **The re-enable is the very next statement after the mission inserts**, not
   at the bottom of the file — so even a partial copy-paste takes it along.

Then you run the one-line check at the end and *see* that it is back on.

> If you ever do find the trigger disabled — the check at the end prints `D` —
> turn it on with this one line and tell 03 · Security:
> ```sql
> alter table public.missions enable trigger missions_guard_bi;
> ```
> A disabled guard means an unauthenticated insert can set its own
> `researcher_id`. That is `se-m1` gone, silently.

---

## The seed script

Paste the whole thing into the Supabase SQL editor **in one go** and run it
once. It is safe to run again — it deletes its own rows first.

```sql
-- =====================================================================
-- KuwaitSat-1 Mission Hub · DEMO SEED
-- Owner: 02 · Back end (Hind)
-- Run: Supabase SQL editor, as one paste, AFTER 03-security/db/01..06 + 08
--      and AFTER both demo accounts exist.
-- Re-runnable: it removes its own two missions before writing them again.
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- 0 · Stop now, with a readable sentence, if the accounts are missing.
--     Without this you get "null value in column researcher_id violates
--     not-null constraint" instead, and spend ten minutes on the wrong
--     problem.
-- ---------------------------------------------------------------------
do $seed$
declare n int;
begin
  select count(*) into n from auth.users
   where lower(email) in ('researcher.a@kuwaitsat.kw',
                          'researcher.b@kuwaitsat.kw');
  if n < 2 then
    raise exception
      'Create both demo accounts first (Authentication -> Users -> Add user). Found % of 2.', n
      using errcode = 'P0001';
  end if;
end $seed$;


-- ---------------------------------------------------------------------
-- 1 · Clear the previous seed. Deleting the two missions cascades to
--     their runs, agent steps, results and reports, so this is the whole
--     clean-up. Real missions made during testing are untouched, because
--     these two ids only ever come from this file.
-- ---------------------------------------------------------------------
delete from public.missions
 where id in ('a1a1a1a1-0000-4000-8000-000000000001',
              'b1b1b1b1-0000-4000-8000-000000000001');


-- ---------------------------------------------------------------------
-- 2 · The two researchers. profiles holds the NAME; auth.users holds the
--     account and the password hash, and we never touch that.
-- ---------------------------------------------------------------------
insert into public.profiles (user_id, display_name, org)
select u.id, 'Dr Noura Al-Hajri', 'Kuwait University, College of Science'
  from auth.users u where lower(u.email) = 'researcher.a@kuwaitsat.kw'
on conflict (user_id) do update
   set display_name = excluded.display_name, org = excluded.org;

insert into public.profiles (user_id, display_name, org)
select u.id, 'Dr Yousef Al-Rashidi', 'Kuwait Institute for Scientific Research'
  from auth.users u where lower(u.email) = 'researcher.b@kuwaitsat.kw'
on conflict (user_id) do update
   set display_name = excluded.display_name, org = excluded.org;


-- =====================================================================
-- 3 · THE GUARD GOES OFF HERE.  Read the section above before this line.
--     It comes back on 40 lines down, and nothing in between can fail
--     without rolling the whole transaction back.
-- =====================================================================
alter table public.missions disable trigger missions_guard_bi;

insert into public.missions
  (id, researcher_id, title, objective, area_geojson,
   status, injection_flag, created_at, launched_at)
values

-- ---- RESEARCHER A · the finished piece of work ----------------------
-- Area: the southern edge of Al-Jahra city, 47.58-47.78 E, 29.30-29.42 N.
-- Every corner is inside the Kuwait box enforced by kuwait_area_ok()
-- (46.5-48.8 E, 28.5-30.1 N, DECISIONS D-3). The ring closes on its
-- first point, which is what makes it a valid GeoJSON Polygon.
('a1a1a1a1-0000-4000-8000-000000000001',
 (select id from auth.users where lower(email) = 'researcher.a@kuwaitsat.kw'),
 'Al-Jahra southern edge - greening potential',
 'Identify the built-up areas along the southern edge of Al-Jahra where '
 'increasing vegetation cover would deliver the largest measurable fall in '
 'surface temperature, and rank them so the governorate can plant the '
 'highest-benefit sites first.',
 '{"type":"Polygon","coordinates":[[[47.58,29.30],[47.78,29.30],[47.78,29.42],[47.58,29.42],[47.58,29.30]]]}'::jsonb,
 'complete', false,
 timestamptz '2026-09-16 08:40:00+03',
 timestamptz '2026-09-16 08:52:00+03'),

-- ---- RESEARCHER B · something completely unrelated ------------------
-- Different governorate, different question, never launched. When B
-- signs in, THIS is the only row on the screen. That is the se-m1 proof.
('b1b1b1b1-0000-4000-8000-000000000001',
 (select id from auth.users where lower(email) = 'researcher.b@kuwaitsat.kw'),
 'Bubiyan Island - mangrove pilot feasibility',
 'Assess whether the tidal flats on the western shore of Bubiyan Island '
 'could support a small mangrove planting pilot, and establish a vegetation '
 'baseline for the site before any intervention is proposed.',
 '{"type":"Polygon","coordinates":[[[48.00,29.72],[48.20,29.72],[48.20,29.86],[48.00,29.86],[48.00,29.72]]]}'::jsonb,
 'draft', false,
 timestamptz '2026-09-19 11:05:00+03',
 null);

-- =====================================================================
-- 4 · THE GUARD COMES STRAIGHT BACK ON. Do not move this line further
--     down the file and do not paste section 3 without it.
-- =====================================================================
alter table public.missions enable trigger missions_guard_bi;


-- ---------------------------------------------------------------------
-- 5 · A's run. One press of Launch Mission, on 16 September, that
--     finished. This row is be-m5: what started it, when, status, result.
--     n8n_execution_id is written as a 'seed-' value on purpose, so a
--     real n8n execution can never collide with it on the unique index.
-- ---------------------------------------------------------------------
insert into public.mission_runs
  (id, mission_id, status, started_at, claimed_at, finished_at,
   tool_calls, n8n_execution_id, error_note)
values
('a2a2a2a2-0000-4000-8000-000000000001',
 'a1a1a1a1-0000-4000-8000-000000000001',
 'complete',
 timestamptz '2026-09-16 08:52:04+03',   -- queued by launch_mission()
 timestamptz '2026-09-16 08:52:09+03',   -- picked up by the worker
 timestamptz '2026-09-16 08:56:31+03',
 7, 'seed-2026-09-16-jahra', null);


-- ---------------------------------------------------------------------
-- 6 · The seven steps of that run: the six named agents, plus ONE
--     REFUSAL.
--
--     The refusal is not decoration. It is the only row in this database
--     that proves the guardrail is real: the agent asked to task the
--     satellite, the tool was not on its approved list, and the system
--     wrote down the no. Open this row on stage when somebody asks
--     "what stops the AI doing something it should not?"
--
--     step_name is CHECKed against exactly six values. A seventh name
--     throws. Repeating one (as satellite_data does here) is fine.
-- ---------------------------------------------------------------------
insert into public.agent_steps
  (id, run_id, step_name, tool, arguments, allowed, refused_reason,
   status, injection_flag, started_at, finished_at,
   raw_prompt, raw_response, confidence)
values

('a3a3a3a3-0000-4000-8000-000000000001',
 'a2a2a2a2-0000-4000-8000-000000000001',
 'satellite_data', 'scene_index.search',
 '{"bbox":[47.58,29.30,47.78,29.42],"from":"2025-04-01","to":"2026-08-31","max_cloud_pct":15}'::jsonb,
 true, null, 'complete', false,
 timestamptz '2026-09-16 08:52:09+03', timestamptz '2026-09-16 08:52:27+03',
 null, null, 0.94),

-- >>> THE REFUSAL <<<
('a3a3a3a3-0000-4000-8000-000000000002',
 'a2a2a2a2-0000-4000-8000-000000000001',
 'satellite_data', 'satellite.task_capture',
 '{"target":"Al-Jahra south","requested_pass":"2026-09-18T06:40:00Z"}'::jsonb,
 false,
 'Refused: satellite.task_capture is not on the approved tool list. This agent may read the stored scene index and may never task the satellite or write anywhere.',
 'refused', false,
 timestamptz '2026-09-16 08:52:31+03', timestamptz '2026-09-16 08:52:31+03',
 null, null, null),

('a3a3a3a3-0000-4000-8000-000000000003',
 'a2a2a2a2-0000-4000-8000-000000000001',
 'environmental_analysis', 'ndvi_thermal.summarise',
 '{"scenes":14,"usable":11,"grid_m":39}'::jsonb,
 true, null, 'complete', false,
 timestamptz '2026-09-16 08:52:58+03', timestamptz '2026-09-16 08:53:34+03',
 null, null, 0.88),

('a3a3a3a3-0000-4000-8000-000000000004',
 'a2a2a2a2-0000-4000-8000-000000000001',
 'recommendation', 'zone_ranker.rank',
 '{"candidates":4,"ndvi_bar":0.14,"anomaly_bar_c":2.0}'::jsonb,
 true, null, 'complete', false,
 timestamptz '2026-09-16 08:53:40+03', timestamptz '2026-09-16 08:54:18+03',
 null, null, 0.81),

('a3a3a3a3-0000-4000-8000-000000000005',
 'a2a2a2a2-0000-4000-8000-000000000001',
 'impact_prediction', 'impact_model.project',
 '{"zone":"J-1","horizon_months":24,"coefficient_source":"[15]"}'::jsonb,
 true, null, 'complete', false,
 timestamptz '2026-09-16 08:54:25+03', timestamptz '2026-09-16 08:55:02+03',
 null, null, 0.66),

('a3a3a3a3-0000-4000-8000-000000000006',
 'a2a2a2a2-0000-4000-8000-000000000001',
 'visualization', 'geometry.build_layers',
 '{"layers":["priority_zones","anomaly_composite"],"features":3}'::jsonb,
 true, null, 'complete', false,
 timestamptz '2026-09-16 08:55:12+03', timestamptz '2026-09-16 08:55:44+03',
 null, null, 0.92),

('a3a3a3a3-0000-4000-8000-000000000007',
 'a2a2a2a2-0000-4000-8000-000000000001',
 'reporting', 'report.compose',
 '{"sections":10,"language":"en","awaiting_human_approval":true}'::jsonb,
 true, null, 'complete', false,
 timestamptz '2026-09-16 08:56:20+03', timestamptz '2026-09-16 08:56:31+03',
 null, null, 0.79);


-- ---------------------------------------------------------------------
-- 7 · A's findings. These are the rows the Kuwait map draws from -
--     geometry lives HERE, in jsonb. There is no file storage anywhere
--     in this project (DECISIONS D-2).
--
--     Every geometry sits inside A's mission polygon. status is
--     'complete' on all five, because my_mission_results shows nothing
--     else - a 'draft' row here would simply never appear and you would
--     think the seed failed.
-- ---------------------------------------------------------------------
insert into public.results
  (id, mission_id, run_id, kind, title, body, geometry, status,
   source_ref, created_at)
values

('a4a4a4a4-0000-4000-8000-000000000001',
 'a1a1a1a1-0000-4000-8000-000000000001',
 'a2a2a2a2-0000-4000-8000-000000000001',
 'metric',
 'Scene catalogue over the drawn area',
 '14 scenes over the area between April 2025 and August 2026; 11 usable at 15% cloud or less. Ground sample distance 39 m, frame swath about 80 km [3][4]. Mean NDVI across the usable scenes 0.11. Mean July surface temperature 51.4 C, an anomaly of +2.6 C against the rural reference. Kuwait reference rainfall 121 mm/yr [11].',
 null, 'complete',
 'seed/catalogue/jahra-2026-03', timestamptz '2026-09-16 08:53:34+03'),

('a4a4a4a4-0000-4000-8000-000000000002',
 'a1a1a1a1-0000-4000-8000-000000000001',
 'a2a2a2a2-0000-4000-8000-000000000001',
 'site',
 'Zone J-1 - Al-Naseem west verge',
 'Highest-ranked site, 81/100. Vegetation cover 4.2%, NDVI 0.09, July surface temperature anomaly +3.1 C, built fraction 61%. Wide road verges already under irrigation, so the marginal water cost is low. Ranked first because it is both the driest and the hottest quarter of the drawn area.',
 '{"type":"Polygon","coordinates":[[[47.61,29.33],[47.66,29.33],[47.66,29.36],[47.61,29.36],[47.61,29.33]]]}'::jsonb,
 'complete', 'seed/zones/j-1', timestamptz '2026-09-16 08:54:18+03'),

('a4a4a4a4-0000-4000-8000-000000000003',
 'a1a1a1a1-0000-4000-8000-000000000001',
 'a2a2a2a2-0000-4000-8000-000000000001',
 'site',
 'Zone J-2 - Jahra industrial edge',
 'Second, 64/100. Vegetation cover 2.8%, NDVI 0.07, July surface temperature anomaly +2.4 C, built fraction 78%. Hotter than average but with almost no existing irrigation, so establishment cost is higher than J-1 for a smaller expected gain.',
 '{"type":"Polygon","coordinates":[[[47.70,29.31],[47.75,29.31],[47.75,29.34],[47.70,29.34],[47.70,29.31]]]}'::jsonb,
 'complete', 'seed/zones/j-2', timestamptz '2026-09-16 08:54:18+03'),

('a4a4a4a4-0000-4000-8000-000000000004',
 'a1a1a1a1-0000-4000-8000-000000000001',
 'a2a2a2a2-0000-4000-8000-000000000001',
 'map_layer',
 'Surface temperature anomaly, July composite',
 'Composite of the 11 usable July scenes, differenced against the rural reference. Drawn over the whole drawn area rather than a single zone. MODELLED, not a KuwaitSat-1 measurement: KuwaitSat-1 carries an RGB imager with no thermal band [1][4].',
 '{"type":"Polygon","coordinates":[[[47.58,29.30],[47.78,29.30],[47.78,29.42],[47.58,29.42],[47.58,29.30]]]}'::jsonb,
 'complete', 'seed/layers/lst-july', timestamptz '2026-09-16 08:55:44+03'),

('a4a4a4a4-0000-4000-8000-000000000005',
 'a1a1a1a1-0000-4000-8000-000000000001',
 'a2a2a2a2-0000-4000-8000-000000000001',
 'narrative',
 'Draft finding - awaiting researcher approval',
 'Two of the four quarters of the drawn area clear the evidence bar of NDVI at or below 0.14 and a surface temperature anomaly at or above +2.0 C. Zone J-1 is recommended first. Raising vegetation cover there from 4.2% towards 12% projects a fall in land surface temperature of 1.4 to 2.1 C over 24 months, scaled from the 0.6-3.7 C published for a 20% to 50% cover rise [15]; the source states the relationship is non-linear, so the lower bound is the one to plan against. Kuwait own observations give a night-time urban heat island of +3.6 C and a daytime urban COOL island of -1.1 C [14], which is why this study reports a surface-temperature effect and not a claim about air temperature. Nothing here may be acted on without human review and competent-authority approval.',
 null, 'complete', null, timestamptz '2026-09-16 08:56:31+03');


-- ---------------------------------------------------------------------
-- 8 · The approved report. approved_by is a PERSON - researcher A - and
--     the table has no default for it on purpose: "the agent proposes, a
--     person approves" has to be a row, not a slogan.
--
--     body_md is rendered with textContent, never markdown and never
--     innerHTML (DECISIONS D-2), so the layout below is plain text and
--     the line breaks are the layout.
--
--     Dollar-quoted with $rep$ because the text contains apostrophes.
-- ---------------------------------------------------------------------
insert into public.reports (id, mission_id, body_md, approved_by, approved_at)
values
('a5a5a5a5-0000-4000-8000-000000000001',
 'a1a1a1a1-0000-4000-8000-000000000001',
 $rep$KUWAITSAT-1 MISSION HUB - RESEARCH STUDY REPORT
================================================================
Run: seed-2026-09-16-jahra
Approved: 16 September 2026 09:14 +03 by Dr Noura Al-Hajri
Status: study closed

1. RESEARCH OBJECTIVE
   Identify the built-up areas along the southern edge of Al-Jahra
   where increasing vegetation cover would deliver the largest
   measurable fall in surface temperature, and rank them so the
   governorate can plant the highest-benefit sites first.

2. STUDY AREA AND PERIOD
   Area of interest: southern edge of Al-Jahra city
                     47.58-47.78 E, 29.30-29.42 N (about 230 km2)
   Period: April 2025 - August 2026

3. SATELLITE DATA
   Frames retained: 11 of 14 (cloud at or below 15%)
   Ground sample distance: 39 m  [3][4]
   Frame swath: about 80 km  [4]
   Sensor: Gecko RGB imager, KuwaitSat-1  [1][4]
   Note: the scene catalogue used in this run is invented for the
   prototype. It is not a KuwaitSat-1 product.

4. ENVIRONMENTAL ANALYSIS
   Quarters assessed: 4
   Highest priority: Zone J-1, Al-Naseem west verge
     vegetation cover ..... 4.2%
     NDVI ................. 0.09
     surface temperature .. +3.1 C anomaly (July composite)
     built fraction ....... 61%
     priority score ....... 81/100

5. RECOMMENDATION
   Plant Zone J-1 first. It is the driest and the hottest quarter of
   the area and its road verges are already irrigated, so the
   additional water demand is the smallest of the four.
   Zone J-2 second, at 64/100.
   Confidence: medium.

6. PREDICTED IMPACT
   Vegetation cover: 4.2% -> 12%  (+7.8 pp)
   Land surface temperature: -1.4 to -2.1 C over 24 months
     scaled from: 0.6-3.7 C for a 20%->50% vegetation rise  [15]
   Kuwait observed baseline: -1.1 C day / +3.6 C night  [14]
   Reference rainfall: 121 mm/yr  [11]
   Confidence: medium. The published relationship is non-linear, so
   plan against the lower bound.

7. INDICATIVE COST
   No cost is asserted by this platform. Unit rates are the
   researcher's own and no market price research was performed.

8. MONITORING
   Not started - no intervention has been marked as deployed.
   Method when it is: same footprint, same calendar month, differenced
   against the pre-intervention baseline of 4.2%.

9. LIMITS OF USE
   1. This is a decision-support prototype, not an official planning
      instrument, and it carries no endorsement.
   2. Environmental values for the zones are a demonstration dataset;
      operational figures require calibrated products and field survey.
   3. KuwaitSat-1 carries no thermal sensor and no near-infrared band;
      the heat and vegetation layers here are model-derived.
   4. The cooling coefficient is peer-reviewed but was not derived in
      Kuwait, and the source states the relationship is non-linear.
   5. Species selection, irrigation design, soil preparation and cost
      require an agronomist and a site survey.
   6. No recommendation may be acted on without human review and
      competent-authority approval.

10. REFERENCES
   [1]  KuwaitSat-1 project - official site
        https://kuwaitsat.space/
   [3]  Kuwait University - KuwaitSat-1 mosaic announcement
        https://www.ku.edu.kw/media-center/news/announcements/kuw290561
   [4]  AlJassar et al., "The First Kuwait National Satellite Project -
        KuwaitSat-1", 37th Small Satellite Conference (2023)
        https://digitalcommons.usu.edu/smallsat/2023/all2023/206/
   [11] World Bank Open Data - Kuwait country indicators
        https://data.worldbank.org/country/kuwait
   [14] Alahmad B et al. (2020). Spatial Distribution of Land Surface
        Temperatures in Kuwait. IJERPH 17(9):2993
        https://doi.org/10.3390/ijerph17092993
   [15] Yin Y et al. (2024). Cooling Benefits of Urban Tree Canopy.
        Sustainability 16(12):4955
        https://doi.org/10.3390/su16124955

- END OF REPORT -$rep$,
 (select id from auth.users where lower(email) = 'researcher.a@kuwaitsat.kw'),
 timestamptz '2026-09-16 09:14:00+03');


-- ---------------------------------------------------------------------
-- 9 · WHAT THIS SCRIPT DELIBERATELY DOES NOT DO.
--
--     It writes NO row into mission_collaborators. Sharing works and it
--     is a real feature, but the se-m1 test is "account B cannot see
--     account A's mission". One collaborator row makes B see A's work -
--     correctly, by design - and on a projector a correct result looks
--     exactly like a leak. Demonstrate sharing AFTER the isolation test,
--     live, with share_mission(), so the judge watches the row appear.
--
--     It also touches nothing in app_settings. There is one row and it
--     is already correct.
-- ---------------------------------------------------------------------

commit;
```

> **If your SQL client rejects the explicit `begin;` / `commit;`,** delete those
> two lines *and nothing else*. The Supabase SQL editor already runs one paste
> as a single transaction, so the rollback guarantee is unchanged.

---

## Check it worked — run these four, every time

```sql
-- 1 · THE IMPORTANT ONE. Is the guard trigger back on?
--     'O' = enabled.  'D' = DISABLED, fix it before you do anything else.
select tgname, tgenabled
  from pg_trigger
 where tgname = 'missions_guard_bi';

-- 2 · Does it actually refuse an unauthenticated insert again?
--     EXPECTED: ERROR  Sign in before launching a mission.
--     If this SUCCEEDS, the trigger is off. (It rolls back either way.)
begin;
  insert into public.missions (title, objective, area_geojson)
  values ('trigger check',
          'This insert is expected to be refused by the guard trigger.',
          '{"type":"Polygon","coordinates":[[[47.6,29.3],[47.7,29.3],[47.7,29.4],[47.6,29.4],[47.6,29.3]]]}'::jsonb);
rollback;

-- 3 · The shape of the seed: one mission each, A complete, B draft.
select p.display_name, m.title, m.status, m.launched_at,
       (select count(*) from public.mission_runs  r where r.mission_id = m.id) as runs,
       (select count(*) from public.results       x where x.mission_id = m.id) as findings,
       (select count(*) from public.reports       q where q.mission_id = m.id) as reports
  from public.missions m
  join public.profiles p on p.user_id = m.researcher_id
 order by m.created_at;
-- EXPECTED, exactly two rows:
--   Dr Noura Al-Hajri  | Al-Jahra ... | complete | 2026-09-16 ... | 1 | 5 | 1
--   Dr Yousef Al-Rashidi | Bubiyan ... | draft   | (null)         | 0 | 0 | 0

-- 4 · The refusal row exists and says why.
select step_name, tool, allowed, refused_reason
  from public.agent_steps
 where run_id = 'a2a2a2a2-0000-4000-8000-000000000001'
 order by started_at;
-- EXPECTED: 7 rows, and exactly one with allowed = false.
```

**Then do the test that actually matters, and do it in the browser, not here.**
The SQL editor connects as `postgres` and bypasses row level security
completely — everything looks visible in here, always. Open the app in a normal
window as A and a private window as B. B sees one draft about Bubiyan and
nothing else.

---

## Two traps on the night

**The rate limit will confuse you before it stops you.** After five missions in
one hour the guard trigger refuses the sixth with *"Limit reached: 5 missions
per hour"* — including when you are testing something else entirely, so the
error you see has nothing to do with what you were testing. While building:

```sql
update public.app_settings set max_missions_per_hour = 100 where id;
-- ... test ...
update public.app_settings set max_missions_per_hour = 5   where id;
```

**Put it back before the demo.** Refused inserts roll back and do not count;
successful ones do.

**The seeded rows bypass `launch_mission()` and `generate_report()`.** That is
fine for pre-loaded history, and it is exactly why the live part of the demo
must create a *new* mission and press the real buttons. The seed proves the
data model; the live run proves the platform.

---

## Hand-offs this file creates

| To | What |
|---|---|
| **01 · Front end** | the seeded objectives are the same four sentences offered as example chips on the New Mission screen — see [`HARVEST.md`](HARVEST.md) |
| **03 · Security** | nothing here changes a grant, a policy or a view; the only DDL is disabling and re-enabling `missions_guard_bi` inside one transaction |
| **04 · Agents** | `n8n_execution_id` values in the seed are prefixed `seed-` so a live n8n execution can never collide with them on `mission_runs_exec` |
