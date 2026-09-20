# KuwaitSat-1 Mission Hub — front end

A secure research platform for authorized KuwaitSat-1 researchers. A researcher writes a
research objective, draws an area of Kuwait on a map, and launches a **mission**. Six AI
agents then work through the analysis in order. The researcher reads the findings and
approves the report.

The agents do not control the satellite and do not decide anything for the researcher.
**AI assists → researcher reviews → AI continues.**

Plain HTML, CSS and JavaScript. No build step, no framework, no bundler.

---

## Run it

There is nothing to install. Serve the folder (do not open the files with `file://` —
the Supabase client and the module-free scripts want a real origin):

```bash
python -m http.server 8000
# then open http://localhost:8000
```

## Deploy it

Vercel, no build command, output directory = this folder. Vercel **can** send HTTP
response headers, which is how 03 · Security ships the Content Security Policy.

---

## The two modes, and how to tell them apart

| | LIVE | DEMO |
|---|---|---|
| When | `js/config.js` has the real project URL + publishable key, and `vendor/supabase.js` exists | either is missing |
| Storage | Supabase Postgres | this browser's localStorage |
| Access control | Row Level Security, in the database | none — our JavaScript choosing what to draw |
| On screen | nothing special | an orange **DEMO MODE** line in the footer of every page |

Demo mode exists so the app opens on a laptop with no network. **It proves nothing about
access control**, which is why it says so on every page. The two-window isolation test
(`03-security/tests/two-window-check.js`) is only meaningful in LIVE mode.

---

## Demo accounts

`researcher.a@kuwaitsat.kw` owns a completed mission with a report.
`researcher.b@kuwaitsat.kw` owns one unrelated draft mission.

**The passwords are not written down in this repository, and must never be.** They live in
the team password manager; whoever presents types them in. Supabase Auth holds the hash —
we store no password and display none (se-m3).

Signing in as B proves the isolation: none of A's work is visible, and pasting A's mission
URL into the address bar gives a neutral "not found or no access" screen.

---

## The demo script (5 minutes)

1. Sign in as **Researcher A**. The Jahra mission is already complete, with a report.
2. Press **New mission**. Write an objective — *"Identify areas in Kuwait where increasing
   vegetation could improve environmental conditions."*
3. Tap two opposite corners on the Kuwait map to select an area.
4. Press **Launch Mission**. The browser calls `launch_mission()`; n8n picks the run up.
   The six steps appear in the strip as the agents write them, polled every 2 seconds.
5. Result areas appear on the map, with the findings listed underneath.
6. **Generate Report** stays disabled until the run is complete. This is the human
   checkpoint — point at it.
7. Press it. Mission Complete ✓. Open the report, print it.
8. **Refresh the page.** Everything is still there.
9. Sign out, sign in as **Researcher B**. Researcher A's missions are gone.
10. Paste Researcher A's mission URL. Access denied, neutrally.

---

## Files

```
index.html          public landing page
login.html          sign in / sign up
missions.html       the signed-in researcher's mission list
new-mission.html    objective + area picker on a map of Kuwait
mission.html        agent pipeline, results map, findings, review checkpoint
report.html         the approved report, printable

css/styles.css      the whole visual system (colours are CSS variables)
js/config.js        Supabase client bootstrap (public URL + publishable key)
js/agents.js        the six agents. `key` == agent_steps.step_name, exactly
js/ui.js            shared helpers, header, auth guard, map + polygon helpers
js/seed.js          DEMO-MODE sample data. No password field, ever
js/data.js          >>> THE ONLY FILE THAT TALKS TO STORAGE <<<
js/page-*.js        one file per screen — see "No inline scripts" below
vendor/             Leaflet 1.9.4 (MIT) and supabase-js, both local, no CDN
```

### No inline scripts

Our CSP is `script-src 'self'`. An inline `<script>` does not run, and neither does an
`onclick=` attribute. Every screen's behaviour therefore lives in `js/page-<screen>.js`
and every handler is `addEventListener`. If you add a screen, add a page file — do not
reach for an inline script, it will simply be dead on the deployed site.

---

## How `js/data.js` maps to the schema

| Function | Live call |
|---|---|
| `signIn` / `signUp` / `signOut` | `sb.auth.*` — Supabase Auth holds the password hash |
| `getCurrentUser` | `sb.auth.getUser()` + `profiles(user_id, display_name, org)` |
| `listMissions` | `my_missions` view, ordered by `created_at desc` |
| `getMission` | `my_missions` view, `.eq('id', …)` |
| `createMission` | `missions` insert of **title, objective, area_geojson** only |
| `startPipeline` | `sb.rpc('launch_mission', { p_mission_id })` |
| `getRunState` / `getAgentRuns` | latest `mission_runs` row + the `my_agent_steps` view |
| `getResults` (`getZones`) | `my_mission_results` view — `preview`, not `body` |
| `generateReport` | `sb.rpc('generate_report', { p_mission_id, p_body_md })` |
| `getReport` | `reports(id, mission_id, body_md, approved_by, approved_at)` |

Four rules that are load-bearing, not style:

1. **No owner filter in JavaScript.** There is no `.eq('researcher_id', …)` in the live
   path. RLS decides which rows come back. A client-side filter would make a broken policy
   look like a working one, which is exactly what the two-window test exists to catch.
2. **No `select('*')` on a base table.** The grants are column-level (`03_grants.sql`), so
   `*` errors with *permission denied for column*. Read a view, or name the columns.
3. **The area is a GeoJSON Polygon, not a box.** `boundsToPolygon()` in `js/ui.js` converts
   `{north, south, east, west}` into `{"type":"Polygon","coordinates":[[[lng,lat],…]]}`
   with the ring closed. Send the raw box and `kuwait_area_ok()` refuses every insert.
4. **The browser never calls n8n.** There is no webhook URL in this repository's
   JavaScript. `launch_mission()` queues the run; n8n polls for it (D-1).

---

## What the screens do about failure

Every form has three states: working, worked, and **failed with a reason**. The banner at
the top of each form says which. `mapError()` in `js/data.js` turns constraint names into
sentences — if 03 changes a constraint name or a P0001 message, that table changes with it.
The agent strip is polled, and a failed poll says so instead of spinning forever.

---

## Hand-offs — things this folder cannot fix by itself

1. **`vendor/supabase.js` is not committed yet.** `script-src 'self'` forbids the CDN, so
   supabase-js has to be downloaded into `vendor/` and committed. Until it is, every page
   runs in DEMO MODE and the console says why.
2. **`js/config.js` still holds `<PASTE PROJECT URL>`.** Paste the project URL and the
   `sb_publishable_…` key. Same two values as the repo-root `js/config.js`; when the
   screens move to the repo root, keep one file, not two.
3. **CSP.** 03 owns `03-security/docs/csp-meta.html`. On Vercel it should ship as a
   response header rather than a `<meta>` tag — a header can also carry `frame-ancestors`,
   which a meta tag ignores. These pages are already `script-src 'self'` clean.
4. **04's automation panel.** `04-agents/app/automation.js` mounts into
   `<section id="automation">` on `mission.html`. Our own pipeline strip reads the same
   `my_agent_steps` view, so decide with Dana which of the two ships on Thursday rather
   than showing the judge both.
5. **Profiles.** `signUp` writes the `profiles` row as soon as there is a session. If email
   confirmation is ON in Supabase, there is no session at sign-up, so the row is written on
   first sign-in instead. If confirmation is off for the demo, say so in the runbook.

## Accessibility notes

Real `<button>` and `<label>` elements throughout, visible focus rings, logical tab order,
the agent timeline is an `aria-live="polite"` region so status changes are announced, form
banners are `role="status"`, status is carried by icon and text as well as colour, no text
below 12px, and `prefers-reduced-motion` turns off the pulse and slide animations. Every
screen works at 390px wide with no horizontal scroll.
