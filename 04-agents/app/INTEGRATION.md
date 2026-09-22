# Wiring the automation section into the app

**From:** Dana (04) · **Status:** *done, but not the way this file originally
said.* Corrected 21 September 2026.

---

## 0 · Read this before anything below it

This file used to open with *"Cost to you: two lines and one `<div>`"* and then
tell 01 · Front end how to mount `Automation` into `mission.html`. Three things
about that are no longer true, and one of them never was:

- **There is no `mission.html` in this repository, and there never has been.**
  The product is a single page, `index.html`, at the repo root — the one Vercel
  serves at `kuwait-sat1-hub.vercel.app`.
- **The panel that ships is [`js/ksat-workflow.js`](../../js/ksat-workflow.js)**,
  loaded from `index.html` alongside `js/config.js`, `js/ksat-integration.js`
  and the rest of the integration layer. It is already wired in. Nothing on the
  list below is outstanding work.
- **`04-agents/app/js/automation.js` is the reference implementation.** It is
  not loaded by anything the browser downloads. It is kept — deliberately, not
  by neglect — because it is the version written against the **n8n** write
  path, and if the worker is ever switched on it is the panel that fits.
- **`04-agents/` is no longer served at all.** A `.vercelignore` keeps the whole
  folder out of the deployment, so this file, `demo.html` and `automation.js`
  have no public URL. They are documentation and a bench test, read on GitHub
  and opened from disk.

Nothing here is deleted. Sections 1 to 4 still describe the reference panel's
contract accurately, and every trap in section 3 applies to both panels,
because both talk to the same database.

---

## The mapping, line by line

The two panels share the beginning and the end of the story — a signed-in
researcher presses one button, and a human approves the report at the end. What
differs is who runs the six agents in between, and therefore which write path
is used and which tables are read.

| | `04-agents/app/js/automation.js` — the reference | `js/ksat-workflow.js` — what the site runs |
|---|---|---|
| **Loaded by** | nothing; `app/demo.html` mounts it against a fake client | `index.html`, as a plain `<script src>` |
| **Mounted as** | `Automation.mount({el, missionId, client, onResults})` | an IIFE that appends one container inside `<section id="agent">` and touches nothing else in the page |
| **Starts a run** | `launch_mission(p_mission_id)` | **`launch_mission(p_mission_id)` — identical.** This is the shared half, and it is the half `au-m1` is graded on |
| **Who runs the agents** | n8n, claiming work with `claim_next_run()` | the page itself; there is no worker in the shipped path |
| **Writes each step** | n8n calls `agent_log_step()` (service_role) | the browser calls `researcher_log_step()` (`03-security/db/09_researcher_write_path.sql`) |
| **Writes findings** | `agent_write_result()` | `researcher_write_result()`, through `KS.writeResult` in `js/ksat-integration.js` |
| **Ends the run** | `agent_finish_run()` | `researcher_finish_run()` |
| **Reads steps back** | polls the `my_agent_steps` **view** every 2 s, because the rows arrive from somewhere else | renders each step as it writes it, then re-reads the `agent_steps` **table** afterwards as proof the rows landed |
| **Reads findings** | `results` | `results` — same table, same column grants |
| **Human checkpoint** | `generate_report()` from the panel | `generate_report()` from the panel — identical |
| **Step budget** | `STEP_BUDGET = 40` | `STEP_BUDGET = 40` — the same number, checked against the SQL wall by preflight B3 and B6 |
| **Stall timeout** | `STALL_MS = 180000` | `STALL_MS = 180000` — both checked against `sweep_stalled_runs(3)` by preflight C5 |
| **Re-rank budget** | **not in the panel at all.** The loop runs on the worker, so `MAX_RERANKS = 2` lives in [`agent/decision.js`](../agent/decision.js) and in its bundled copy `n8n/agent-code-node.js`. Grep `automation.js` for the name and you get nothing — this row claimed the constant was in both files until 21 Sep 2026, and a reader changing the budget "in both places" would have edited one file and the canvas would have kept last night's number | `MAX_RERANKS = 2`, in the panel itself, because in the shipped path the page *is* the loop |
| **The decision floor** | `IMPACT_FLOOR_C = 1.0` °C of cooling, from `agent/decision.js` | **`UPLIFT_FLOOR_PP = 4.0` percentage points of vegetation cover** |

### The floor is the one number that is genuinely different, and it is not a bug

`js/ksat-workflow.js` lines 55–65 record why, with the arithmetic:

> replaying `zonesFor()` → `predictImpact()` for every AOI (the rng is seeded at
> 4200, so this is reproducible, not a sample) gives Al Asimah zone D 3.6 pp
> REJECT, zone C 3.6 pp REJECT, zone B 4.1 pp ACCEPT. Two re-ranks, then
> accepted — exactly the budget, and the highest-ranked zone is not the one that
> reaches the map.
>
> `IMPACT_FLOOR_C = 1.0` is arithmetically unreachable here: `predictImpact()`
> scales source [15]'s 0.6–3.7 °C-per-30-points coefficient, and across all six
> governorates the best case upper bound is −0.86 °C. A 1.0 °C floor rejects
> every candidate in Kuwait and every run stalls.

So the shipped panel states its floor in the unit the page actually computes and
the source actually publishes. **Do not "fix" the difference by copying
`IMPACT_FLOOR_C` into the panel** — every run would stall in front of the judge.
`node 04-agents/tools/preflight.js` check **B5** fails if anyone does.

---

## 1 · Where the panel goes, and why that is findable without help

*(This was written for `mission.html`. The reasoning is what matters and it is
why the shipped panel sits where it does — inside `<section id="agent">`, which
is the section the page's own navigation labels "Agent pipeline".)*

**Immediately under the objective and above the map.**

That is the answer to `au-m2` ("the judge finds it without help"):

- it is the **first** thing below the mission's own text, so the eye reaches it
  before the map;
- it is the **only** primary-coloured button on the screen until the run finishes;
- its heading is the word **Automation**, not a product name;
- the three things the item asks for are three visible regions in one box —
  the button (**start**), the status line and the six-step strip (**status**),
  and the cards underneath (**result**);
- the mission list links each row straight to it, so a stranger goes
  sign in → my missions → a mission → the button, with nothing else competing.

## 2 · The change a host page makes — the reference panel's contract

```html
<!-- in <head> or before the closing body tag, once, AFTER js/config.js -->
<script src="js/config.js"></script>
<script src="js/automation.js"></script>
```

```html
<!-- where the "Agent pipeline" section is now -->
<section class="card section" id="automation"></section>
```

```js
// inside guard(), after the mission has loaded
Automation.mount({
  el: document.getElementById('automation'),
  missionId: mission.id,
  client: window.sb,               // from js/config.js
  onResults: function (rows, geometries) {
    // optional — draw geometries on your Leaflet map.
    // Each entry is a GeoJSON Polygon or FeatureCollection:
    //   L.geoJSON(g, { style: ... }).addTo(map)
  }
});
```

**Do not copy `automation.js` into `js/`.** That instruction used to read
"copy it when the screens move for deployment", and following it now would put
a second automation panel in the page — two Launch buttons, two writers, and no
way to say which one ran. `js/ksat-workflow.js` is the one that ships. If the
reference panel needs a change, change the one in `04-agents/`; preflight check
**C1** fails if `index.html` ever loads a second panel, and **C1b** fails if a
deleted duplicate comes back. *(This folder held three panels once. It holds
one, plus the shipped file at the repo root.)*

## 3 · Things that will bite, listed before they bite

*Every row applies to both panels: they are facts about the database, not about
either file.*

| | |
|---|---|
| **`select('*')` now errors** | Every table has column grants (`03_grants.sql`). Both panels name their columns. Anything new must too, or read the `my_*` views. |
| **The area format** | The database stores `area_geojson` as a **GeoJSON Polygon**: `{"type":"Polygon","coordinates":[[[lng,lat],…]]}` — longitude first, and the ring must close (last point = first point). Leaflet's `getLatLngs()` gives you `{lat,lng}` objects; convert before insert or every mission is refused by `kuwait_area_ok()`. This is D-3 in `03-security/docs/DECISIONS.md`. |
| **No `maxlength` on the objective** | `06_validation.sql` says it plainly: `maxlength` silently truncates the judge's 5,000-character paste, the row is created, and nothing refuses anything. Use a live counter. |
| **The step strip only shows finished steps** | `agent_log_step` writes a step that is already complete, so a step is either written or not yet written. The strip marks the next unwritten step as *Running…* while the run is live. That is inference, and it is honest — the row appears the moment the step really finished. |
| **Two runs on one mission** | `launch_mission()` refuses a second run while one is `queued`/`running`, refuses a fourth run on the same mission within an hour (`Limit reached: 3 runs per mission per hour.`), and refuses outright once the mission has an approved report (`This mission has an approved report. Start a new mission.`). For a second demo, make a new mission. |
| **One report per mission** | `03-security/db/11_monitoring.sql` adds `reports_one_per_mission`, a unique index on `reports (mission_id)`. Before it, pressing Approve twice wrote two report rows with two `approved_by` values for one decision. After it, the second press is refused by the database. |
| **The rate limits raise four different sentences** | `launch_mission()` says `Limit reached: 5 agent runs per hour.` (or `per day`) and `Limit reached: 3 runs per mission per hour.`; the insert trigger says `Limit reached: 5 missions per hour.` They mean different things — launching versus creating — and the per-researcher number comes from `app_settings`, so it can change without a deploy. Both panels match the SHAPE of the sentence and quote the database's own number; `js/ksat-workflow.js` keeps that allowlist in its `SAFE` array. |
| **The human checkpoint is inside the panel** | When a run completes, the panel shows the draft and an **Approve and generate report** button, and calls `generate_report()` itself. Two buttons that both publish is worse than either. |
| **Never `innerHTML` with a value from the database** | `results.body` and `reports.body_md` are written by the agent from text a researcher typed. Both panels use `textContent` and `white-space: pre-wrap` everywhere. D-2, and preflight check **C4** enforces it on both files. |

## 4 · What the reference panel needs in CSS (optional, 2 lines)

It uses the host page's existing classes (`card`, `btn`, `timeline`, `agent`,
`chip`, `small`, `muted`, `pipeline-head`). If `.bad` and `.good` are not in
`styles.css` yet, these are the only two it adds meaning to:

```css
.small.bad  { color: #E5484D; }
.small.good { color: #30A46C; }
```

Without them the status line still reads correctly — it just is not coloured.
`app/demo.html` pulls `app-retag/css/styles.css` from disk for exactly this
reason; that path was `01-front-end/app/css/styles.css` until 21 Sep 2026 and
had been 404ing since the stylesheet moved, which made the bench page render
unstyled and look broken.
