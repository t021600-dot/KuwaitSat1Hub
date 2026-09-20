# KuwaitSat-1 Mission Hub — front end

A secure research platform for authorized KuwaitSat-1 researchers. A researcher writes a
research objective, draws an area of Kuwait on a map, and launches a **mission**. Six AI
agents then work through the analysis in order. The researcher reads the findings and
approves the report.

The agents do not control the satellite and do not decide anything for the researcher.
**AI assists → researcher reviews → AI continues.**

This repository is the **front end only**, built with plain HTML, CSS and JavaScript.
No build step, no framework, no API keys.

---

## Run it

There is nothing to install. Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deploy it

Drag this whole folder into a new GitHub repository, then import that repository on
Vercel. No build command, no environment variables, output directory is the repository
root. You get a live public URL in about a minute.

---

## Demo accounts

| Email | Password | Owns |
|---|---|---|
| `researcher.a@kuwaitsat.kw` | `demo1234` | One completed mission with a report |
| `researcher.b@kuwaitsat.kw` | `demo1234` | One unrelated draft mission |

Signing in as B proves the isolation: none of A's work is visible, and pasting A's mission
URL into the address bar gives a neutral "not found or no access" screen.

---

## The demo script (5 minutes)

1. Sign in as **Researcher A**. The Jahra mission is already complete, with a report.
2. Press **New mission**. Write an objective — *"Identify areas in Kuwait where increasing
   vegetation could improve environmental conditions."*
3. Tap two opposite corners on the Kuwait map to select an area.
4. Press **Launch Mission**. The six agents run in sequence, about two seconds apart:
   Satellite Data → Environmental Analysis → Recommendation → Impact Prediction →
   Visualization → Reporting.
5. Result zones appear on the map, colour-coded by priority, with findings underneath.
6. **Generate Report** is disabled until all six agents finish. This is the human
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
js/agents.js        the six agents, in fixed order
js/seed.js          demo users, missions, zone + report builders
js/data.js          >>> THE MOCK DATA LAYER — REPLACE THIS FILE WITH SUPABASE <<<
js/ui.js            shared helpers, header, auth guard, map helpers
vendor/             Leaflet 1.9.4 (map library, MIT) — no CDN, no API key
```

---

## Swapping in Supabase

`js/data.js` is the **only** file that touches storage. Nothing else in the project imports
`localStorage` or the seed data. Every function in it carries a comment naming the Supabase
call that replaces it, for example:

```js
// -> supabase.from('missions').select('*').eq('owner_id', user.id)
listMissions: function () { ... }
```

Keep the same function names and the same promise-based return shapes and no other file
needs to change:

```
signIn, signUp, signOut, getCurrentUser,
listMissions, getMission, createMission,
startPipeline, getAgentRuns, advanceAgent,
getZones, generateReport, getReport
```

**The access rule.** Today every function filters by the signed-in user's id inside
`data.js`, and `getMission` / `getZones` / `getReport` return `null` for a mission owned by
someone else — even when the id is correct. In Supabase the same rule lives in Row Level
Security policies, e.g.

```sql
alter table missions enable row level security;
create policy "owners read their missions"
  on missions for select using (auth.uid() = owner_id);
```

Once RLS is on, the client-side filter becomes a second layer rather than the only one.

---

## What is mocked

* Authentication — email and password are checked against seeded users in the browser.
* The agent pipeline — timings and outputs are fixed sample values, advanced by a timer.
* Result zones and every figure in the report — **sample data, not measurements.**

The map is real: Leaflet (bundled locally in `vendor/`, MIT licensed) drawing free
OpenStreetMap tiles. It needs no API key and no CDN, so there is no secret anywhere in
this repository and nothing external has to load for the page to work. If the tiles are
blocked on the demo network, the page still works — the map area falls back to a message
and the coordinate fields, and the findings are listed as text.

## Accessibility notes

Real `<button>` and `<label>` elements throughout, visible focus rings, logical tab order,
the agent timeline is an `aria-live="polite"` region so status changes are announced, status
is carried by icon and text as well as colour, and `prefers-reduced-motion` turns off the
pulse and slide animations. Every screen works at 390px wide with no horizontal scroll.
