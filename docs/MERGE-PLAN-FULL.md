# KuwaitSat-1 Mission Hub — THE MERGE PLAN
### Four submissions → one product · Sunday 20 Sept → Demo Day Thursday 24 Sept

> **Read this first.** Three build nights remain (Sun 20, Mon 21, Tue 22). Wednesday is rehearsal only — the capstone forbids building. Today the product has **no database connection, no public URL, two incompatible front ends, and six MUST items with nobody's name on them.** Everything below is ordered so that the things that block other people happen first.

---

## Where each of the four actually is

| | What is genuinely good | The weakness that matters | What is missing entirely |
|---|---|---|---|
| **Retag** · 01 Front end | Six real screens. **One storage file** — `localStorage` appears at exactly 3 lines, all in `js/data.js`, and every screen reaches data through `Data.*`. Every function already carries its replacement Supabase call in a comment. `esc()` is correct and used. Leaflet self-hosted. Empty/loading/not-found states already written. | The whole database is one `localStorage` key, so account isolation is JavaScript choosing not to draw a row — a **fake pass** on se-m1. Plaintext passwords in `seed.js` and printed on `login.html`. Her object shapes (`owner_id`, `agent_runs`, `zones`, a `{north,south,east,west}` box) match **nothing** in the real schema. | **Any Supabase code at all.** No `supabase-js` file exists anywhere in the repo. No failure card. No connection to Dana's automation. No commit authored by her account. |
| **Hind** · 02 Back end | `buildStudyReport()` returns **one string in ten sections** — exactly the shape `reports.body_md` wants. `LIMITS OF USE` (6 clauses, EN+AR). **16 numbered traceable sources.** `NOT_CLAIMED`. Four realistic research objectives. Report painted with `textContent`. | Her deliverable is a **6,000-line self-contained page with no accounts, no database and no data layer**. It cannot be swapped — it can only be retyped. Seven agents where the product has six. Its audit panel claims "no network request", which becomes false the moment Supabase exists. | **The Supabase project itself.** `js/config.js` still holds `<PASTE PROJECT URL>`. Confirm-email = OFF not set. Zero Supabase calls, zero user ids, zero wiring in `02-back-end/`. No one-row-per-table glossary. No `summary` field in the run log. |
| **Mariam** · 03 Security | The strongest single folder in the repo. **Column-level grants** plus `revoke all … from service_role` — n8n *physically cannot* read another researcher's mission. Four SECURITY DEFINER helpers with pinned `search_path`. `99_verify` query 4 catches the failure that hides best. She costed the super-admin panel and **cut it in writing**. | **None of it has ever been run.** Seven SQL files, two matrices and an audit against nothing. `evidence/` holds one `.gitkeep`. Files 04 and 06 are **not re-runnable** — one real error at 1am and a re-paste looks like total collapse. Her own se-m1 proof script swallows its error and prints a false green pass. | Two demo accounts. All evidence screenshots. A filled-in AI audit (still a TEMPLATE, and the file warns that means **se-m6 NOT PROVEN**). The pre-commit hook is installed on **zero** machines. |
| **Dana** · 04 Agents | `automation.js` is a **finished drop-in**: calls `launch_mission()`, polls every 2s, shows refusals, prints a real failure sentence after a 3-minute stall, renders with `textContent` only. `INTEGRATION.md` tells Retag exactly what to do. The engine decision (A-1) is written and reasoned. Guardrails written. | **Almost none of her work is in `main`.** `main` contains exactly one file from her: `04-agents/README.md`. Everything else sits on three unmerged one-commit branches. `sh-m2` is "what is live is what is in main." | The live n8n Cloud workspace, credentials, the Database Webhook, an **Active** workflow. `agent_claim_run()` — her written request to Mariam is still marked **OPEN**, and her own header says *"nothing in 04 works until it exists."* The backup screen recording. |

---

## 1 · THE DECISION

### **Retag's multi-page app is the product. Hind's prototype is the design study. We harvest text from it, never code.**

**Why, in one sentence a beginner accepts:** Retag's app touches storage in three lines, so connecting it to a real database is one file's work; Hind's touches simulated data in six thousand lines, so connecting hers is a rewrite — and we have three evenings.

| Option | What it costs |
|---|---|
| **A · Ship Retag's app** ← **CHOSEN** | Hind's 6,000 lines are not the product. That hurts, and it is why she takes a second job below. |
| **B · Ship Hind's prototype** | Rebuild accounts, a data layer, a Leaflet map, RLS-safe rendering and 101 `innerHTML` sites — from zero, in three nights. Loses be-m1, be-m4, se-m1 with near-certainty. |
| **C · Merge the two front ends** | The worst option. It destroys the two properties that make A shippable (the one-file data layer, the 3-site `innerHTML` surface) and ships two of everything. **This proposal will be raised on Tuesday at 10pm. Kill it tonight, out loud.** |

### What gets lifted from Hind's prototype — **as text, never as code**

1. `buildStudyReport()`'s ten-section structure → becomes the **reporting agent's markdown template** written into `reports.body_md`. *(Highest-value asset in the 6,000 lines.)*
2. **Section 9 · LIMITS OF USE** — six clauses, EN+AR → the end of every generated report. Replaces Retag's single line.
3. The **16 numbered sources** + `CREDITS-AND-SOURCES.txt` → the report's references section. Answers "where did that number come from?"
4. **`NOT_CLAIMED`** — the six refusals → the footer and the "not official" framing.
5. **`RC_EXAMPLES`** — four real-sounding objectives → what gets typed on stage instead of "test test".
6. **Agent step copy in operator voice** → the six agents' step text.
7. The **run-id format** (`KS-260920-A4F2`) and the queued/running/complete vocabulary.

### What is abandoned, named out loud

The canvas map · `zonesFor()` and the governorate dropdown · the `setTimeout` sequencer · the **seventh (Monitoring) agent** — out of scope, it has no slot in the `step_name` CHECK · the prototype's guardrail and audit panels (they contradict `04-agents/GUARDRAILS.md`, and two disagreeing guardrail lists in one public repo makes a judge stop believing both) · the embedded team photograph.

> **Hind's prototype stays in the repo, is never the public URL, and she presents it as the design study it is.** One banner at the top of `prototype/README.txt` tonight: *NOT THE PRODUCT*, the seven→six agent mapping, and "the guardrail list is `04-agents/GUARDRAILS.md`."

### The second decision, and it is not optional

**Area 05 (`sh-m1`…`sh-m6`) is six MUST items with no owner.** The README currently says *"there is no separate ship-and-present job — the four of us split it."* The guide's words are: *"Jobs can overlap. **Ownership cannot.** A team of four puts two jobs on one name. 'We all did everything' is the sentence that loses marks."* And `sh-m3`'s test is a judge reading the front page for **five names, five jobs**.

> **Recommendation: Hind owns 05.** She already has GitHub Pages in the README, her remaining 02 tasks are documentation-shaped, and she is the strongest writer on the team. She loses the front end and gains six MUST items — that is a promotion, not a consolation. **Edit the README table tonight so a fifth row exists with a name on it.**

---

## 2 · THE MERGE SEQUENCE — who is blocked by whom

```
 SUNDAY 19:00 ─ the two roots. Nothing downstream exists until both are done.
 ═══════════════════════════════════════════════════════════════════════════

   [A] vendor/supabase.js committed          [B] Supabase project + 01→06 SQL run
       Retag · 15 min                            Hind creates · Mariam runs · 2h30
       (our own CSP forbids a CDN;                + Confirm email = OFF
        Leaflet was vendored, this was not)       + URL/key into js/config.js
            │                                             │
            │  ✗ blocks: every line of the swap           │  ✗ blocks: be-m1 be-m2
            │     be-m1 be-m4 se-m1                       │     be-m4 be-m5 se-m1..se-m6
            │                                             │     au-m1 au-m6
            ▼                                             ▼
   [C] FILES MOVE TO REPO ROOT (Retag · 40 min · SUNDAY, not later)
       01-front-end/app/* → /  · carries vendor/, js/config.js, js/automation.js
       ✗ blocks: fe-m2 sh-m1 sh-m4 — and every path Monday and Tuesday builds on
            │
            ├──────────────────────────────┬─────────────────────────────┐
            ▼                              ▼                             ▼
   [D] THE CALL SHEET              [E] agent_claim_run()          [F] MARIAM'S HARNESS
       Hind · 45 min · Sunday          Mariam runs Dana's SQL         20-line HTML page
       14 lines: the real call         ✗ blocks: ALL of 04            + two-window-check.js
       beside each data.js fn                │                        ► se-m1 PROVEN SUNDAY,
       ✗ blocks: Retag's whole               ▼                          whatever state 01 is in
          Monday                     [G] DANA MERGES 3 BRANCHES        (do NOT wait for the app)
            │                            → main + n8n Cloud live
            │                            ✗ blocks: sh-m2, au-m1
            ▼                                      │
 MONDAY ═══ THE WIRING NIGHT ═══════════════════════════════════════════════
            │                                      │
   [H] data.js SWAP (Retag · the big one)          │
       + boundsToPolygon()  ← or EVERY insert      │
         is refused by kuwait_area_ok()            │
       + scoped .eq() reads, never fetch-then-     │
         filter (that is se-m1 leaking in the      │
         network tab while looking identical)      │
       + .catch() on guard() FIRST                 │
            │                                      │
            ▼                                      ▼
   [I] FIRST REAL MISSION ROW ACCEPTED ──── [J] n8n writes agent_steps
       Mariam watches it succeed                for that run
            │                                      │
            └──────────────┬───────────────────────┘
                           ▼
   [K] Automation.mount() in mission.html — Dana's panel replaces
       advanceAgent + the Findings section. ► au-m1 au-m2 au-m6 be-m5
                           │
 TUESDAY ═══ PROVE IT, THEN FREEZE ═════════════════════════════════════════
                           ▼
   [L] se-m5 (5,000-char paste) · [M] phone-portrait pass · [N] report body_md
   [O] be-m3 glossary said aloud by all four · [P] second seeded researcher
                           │
                           ▼
            ██ SCHEMA FREEZE · TUESDAY 22:00 · SAID OUT LOUD ██
                           │
                           ▼
   [Q] Mariam re-runs all 9 verify queries AFTER the last schema change
       + se-m4 clean console on the LIVE URL   ► the only run that counts
```

**Three blocking facts nobody has said out loud yet:**

- **`main` has none of Dana's code.** Retag cannot mount a file that is not in `main`. Three branches (`agent/au-m3-process`, `agent/guardrails`, `agent/engine-decision-and-claim-path`), one commit each, plus an uncommitted `04-agents/README.md` edit. They touch disjoint files — three `git merge` commands will go clean. **Do it Sunday, not Tuesday.**
- **Mariam is only blocked by the app if she lets herself be.** Her 20-line harness page costs 15 minutes and proves se-m1 tonight. Creating the two demo accounts in the **Supabase dashboard** (Authentication → Users → Add user, auto-confirm) instead of "through the app" removes the one dependency that would have cost her the night she cannot lose.
- **`agent_claim_run()` is Dana's hard stop.** Her request file says *"nothing in 04 works until it exists."* Mariam must tell Dana tonight which night it lands, or Dana loses Monday waiting.

---

## 3 · NIGHT BY NIGHT, with honest hour totals

### SUNDAY 20 — tonight, what is left of it

| Who | Tasks | Hrs |
|---|---|---|
| **Team** (first 20 min, all four, out loud) | Retag's app is the product · CSP decision (below) · D-5 sharing decision · **who owns area 05** · everyone fills their own README row and pushes it **from their own account** | 0:20 |
| **Mariam** | `drop policy if exists` / `drop constraint if exists` edits to files 04 and 06 **first** (10) · create project with Hind (15) · paste 01→06 one block at a time (40) · `99_verify` + screenshot queries 1,3,4,5,6 (20) · two demo accounts in the dashboard (10) · harness page + two-window check + screenshot (30) · fix the false-green bug in `two-window-check.js` (10) · review and run `agent_claim_run` (20) · write the D-5 line before 23:00 (5) | **2:40** |
| **Hind** | Create the project + **Confirm email = OFF** + paste URL/key into `config.js` (30, with Mariam) · **the 14-line call sheet** at the top of `02-back-end/README.md` (45) · declare the six agent step strings as the single truth (15) · turn GitHub Pages **on** (15) · prototype `NOT THE PRODUCT` banner (15) | **2:00** |
| **Retag** | **`vendor/supabase.js` — first, before anything** (15) · move the app to the repo root and re-click all six screens (40) · delete the one `#launch.disabled` line (5) · `.chip` 11.5px → 12.5px (2) · **hand the phone to Dana and say nothing** (15) · start the read paths in `data.js` (40) | **2:00** |
| **Dana** | Commit the working-tree README edit, merge her three branches into `main` (30) · n8n Cloud account, **check the trial expiry date** (15) · build nodes 1–2 and the credentials (60) | **1:45** |

> **Does Sunday fit?** Only if it starts **now**. Mariam's 2h40 is the long pole and it cannot be shortened — she is the only one who can. **Checkpoint: if the Supabase project does not exist by 21:00, cut Hind's call sheet and Retag's `data.js` start to Monday and protect Mariam's SQL run.** Everything else on Sunday is 40 minutes or less.

### MONDAY 21 — the wiring night

| Who | Tasks | Hrs |
|---|---|---|
| **Retag** | The `data.js` swap against Hind's call sheet — all 14 functions (**2:00**) · `boundsToPolygon()` + `rowToMission` + `rowToUser` mapping block (30) · auth swap: delete the demo-password banner and both seeded passwords, add *"New here? Create an account…"* (15) · `failCard` in `ui.js` with `createElement`/`addEventListener` (**not** `innerHTML` with an inline `onclick` — our own CSP note forbids it), `.catch` on `guard()` first (25) | **3:10** |
| **Hind** | **Pair with Retag on the swap** — she wrote the call sheet, she is the one who knows why `select('*')` errors (1:30) · add `summary text` to `mission_runs` + the grant + the `p_summary` parameter (25) · the eight-line row glossary (25) | **2:20** |
| **Mariam** | **The AI security audit, two passes, and ship two real fixes (45)** — the `set search_path` Security Advisor before/after is her free, visible exhibit · se-m5 the 5,000-char paste through the form *and* the console, with the before/after/after-refresh row count (30) · `alter default privileges … revoke all` appended to `03_grants.sql` (10) · watch the first real mission insert succeed (10) · chase the pre-commit hook onto all four machines (10) | **1:45** |
| **Dana** | n8n workflow end to end: claim → three named RPC calls → finish (**2:00**) · Database Webhook on `mission_runs` insert (30) · one full run visible in `agent_steps` (30) | **3:00** |

> **Monday does not fit for Retag at 3h10 on top of a swap she has never done before.** Two corrections, both already in the plan: **(1)** Hind pairs with her — Hind's own Monday tasks are documentation-shaped and can move; **(2)** the report work and the length counters move to Tuesday. **Hard checkpoint: if Retag is not signed in against real Supabase by 21:30, stop the swap, call Mariam, and debug the connection — not the queries.**

### TUESDAY 22 — prove it, then freeze

| Who | Tasks | Hrs |
|---|---|---|
| **Retag** | Mount Dana's panel per `INTEGRATION.md` — delete `advanceAgent`, delete the Agent-pipeline and Findings sections, add the two script tags and the two CSS lines. **Do not edit her file.** (25) · the objective and title counters + the `validate()` upper branches, and **delete `maxlength="80"` from the title** (30) · report `body_md` split on `## ` + `approved_by` (30) · comment out `overflow-x:hidden`, walk every screen at 390px, fix what actually overflows, `.btn-sm` → 44px (30) | **1:55** |
| **Hind** | Seed the second researcher's mission (`99_verify.sql:148`, both trigger lines in the same paste) (20) · nominate and rehearse the be-m2 value — `missions.title` on a named demo mission (10) · **area 05**: the live URL in the README, three lines + five names + five jobs, run the demo from the public URL on a laptop that did not build it (60) | **1:30** |
| **Mariam** | **After the last schema change of the week**: re-run all nine `99_verify` queries including query 4 (20) · se-m4 clean console on the live URL, screenshot (15) · re-run the two-window check against the **live** URL on a borrowed laptop (20) · file every screenshot into `evidence/` (20) | **1:15** |
| **Dana** | Rehearse the agent three ways — normal, awkward, **one built to break a rule** — and **record the one guardrail rule the rehearsal forced you to change** (au-m4 is not satisfied by a list alone) (60) · the backup screen recording (40) | **1:40** |
| **All four** | **20 minutes, out loud: each person says what one row of each of the eight tables is, then says them again without looking.** be-m3 is the one MUST that four people can each individually fail. | 0:20 |
| **All four** | **22:00 — schema freeze, said out loud.** | — |

---

## 4 · WEDNESDAY 23 — rehearsal only, nothing is built

**Two full rehearsals, start to finish, on the public URL, on a laptop that did not build it, on the room network.** Write down what broke in the second one — `sh-m5`'s test is *"the judge asks when, and what broke. Everyone gives the same answer."*

**Verified, in this order:**

1. Private window → public URL → landing page opens with **no login wall** (`sh-m1`), and its button goes to a page that exists.
2. Create a brand-new account live, first try (`be-m4`). Then a mission, then Launch.
3. **n8n closed**, backend dashboard closed, dev tools closed — the run completes and the result is on the screen (`au-m1`, `au-m6`, `fe-m5`).
4. Open `mission_runs` — what started it, when, its status, and **what came out** (`be-m5`).
5. **Beat 5 of the se-m1 proof:** the identical `select` on A's mission id — `rows: 1` in A's window, `rows: 0` in B's. Same query, same id, opposite answers.
6. Change `missions.title` in the table editor, alt-tab, refresh, point (`be-m2`).
7. Open the users table — no password column (`se-m3`). Open the audit output — point at the two fixes (`se-m6`).
8. Each of the four says their part with no slides and no reading, and each says all eight row sentences (`sh-m6`, `be-m3`).
9. The backup recording is **on the presenting laptop**, not in a cloud folder.
10. Push one word to `main` and watch the live site change (`sh-m2`).

**Wednesday's only permitted edits: documentation links, and whatever rehearsal 1 broke. No new CSS.**

---

## 5 · THE CUT LIST — say these out loud, do not build them

> Rule 3 of the guide: *"A judge who asks what you left out wants four answers, not a shrug."* Here are twelve.

| Cut | Why |
|---|---|
| **Merging the two front ends** | Destroys the swappable data layer and the small `innerHTML` surface — the only two reasons the app can ship this week. |
| **Arabic and full RTL** | It is a **COULD**, and *"never start a COULD while a MUST is open."* The answer: *"cut because fe-m4 and se-m5 were still open on Tuesday, and a half-translated screen is worse than an English one."* |
| **A strict CSP (splitting six inline `<script>` blocks into six files)** | **No MUST requires a CSP.** `se-m4` is only "HTTPS everywhere, no mixed content" — and GitHub Pages gives that free. Pasting `script-src 'self'` as written **blanks all six screens**. Ship `'self' 'unsafe-inline'`, fix the stale filename list in `csp-meta.html`, and write the honest sentence. |
| **Rewriting git history to remove `demo1234`** | A botched `filter-repo` on a public repo with three days left is worse than the finding. The prepared answer: *"a mock password in a browser-only prototype with no database behind it; no real credential has ever been in this repo, and the pre-commit hook blocks the shapes that matter."* |
| **`db/07` super admin + access log (56KB)** | Mariam already costed it at ~1h50 and cut it in writing. That decision scores better than a half-built admin panel. |
| **The Share Mission button** | **Keep the table and `share_mission()` in the schema** — they cost nothing once created. Build no UI. The answer: *"sharing exists in the schema as a written row rather than a role string; here is the policy that would enforce it."* |
| **The `handle_new_user()` trigger on `auth.users`** | 15 minutes of the most error-prone SQL in the set, on the night we cannot afford a mystery, to fix a **cosmetic** blank name. Read the email from `sb.auth.getUser()` instead. |
| **Drawing agent findings as polygons on the mission map** | `fe-m5` is satisfied by text cards, and Dana's panel already renders them. Optional Tuesday extra, nothing more. |
| **Session-expiry handling, the tile-error fallback, the coordinate-clamp hint** | Real, all three. None is graded. Name them as known limits — a stated limit is worth more to this panel than a surprise. |
| **`docs/SECURITY.md` and `docs/DEPLOY.md`** | Listed in a README table, never written. **Delete the rows; do not write the files.** |
| **RLS matrix rows 21–25, the bilingual i18n error map, HSTS and `frame-ancestors`** | The last two are unavailable on a static host, not misconfigured. Say that. |
| **The seventh (Monitoring) agent** | It has no row in the `step_name` CHECK. Out of scope, stated in the prototype banner. |

---

## 6 · THE RISK TABLE — the five things most likely to lose a MUST

| # | Risk | MUSTs lost | Owner | Earliest de-risk |
|---|---|---|---|---|
| **1** | **The Supabase project does not exist at the end of tonight.** Everything is downstream of one 15-minute task that has not been done on the night the guide calls the blocker night. | be-m1 be-m2 be-m4 be-m5 · se-m1…se-m6 · au-m1 au-m6 — **13 of 28** | **Hind** creates · **Mariam** runs | **Tonight, 19:00.** Not one keystroke of anything else first. |
| **2** | **Area 05 has no owner.** Six MUST items, and `sh-m5` needs two rehearsals that must be *scheduled now*, not discovered on Wednesday. The README front page also fails `sh-m3`'s "five names, five jobs" as written. | sh-m1…sh-m6 — **6 of 28** | **Unassigned — recommend Hind** | **Tonight, 60 seconds.** Say the name, edit the README table, push it. |
| **3** | **n8n never runs live from the app.** A new cloud account, credentials, a Database Webhook, an **Active** workflow and a trial clock — all unstarted, and all blocked behind `agent_claim_run()`, which is still marked **OPEN**. | au-m1 au-m2 au-m6 be-m5 | **Dana** (engine) · **Mariam** (the SQL) | **Sunday**: account created + trial expiry date read out. **Monday 22:00 hard checkpoint** — if no active workflow has done one round trip, switch to Dana's own named fallback, the Supabase Edge Function in `worker/edge/`, and prepare the one-sentence answer. |
| **4** | **The CSP meta tag is pasted on Tuesday night without Retag in the room.** All six pages run their logic in an inline `<script>`. `script-src 'self'` blanks every screen silently — a console violation nobody reads on Wednesday. | fe-m1…fe-m5 sh-m4 | **Mariam** decides · **Retag** in the room | **Tonight, 5 minutes, out loud.** This is a conversation, not a ticket. |
| **5** | **Every mission insert is refused.** Retag sends `{north,south,east,west}`; `kuwait_area_ok()` demands a closed GeoJSON ring, **longitude first**. `missions_area_shape` rejects it, every mission, every time, with a raw Postgres error — and the seeded demo areas are the same wrong shape. | be-m1 be-m2 fe-m3 | **Retag** writes it · **Mariam** watches the insert | **Monday, the first insert.** Six lines of conversion, written *before* the first attempt, not debugged after it. |

---

## The blunt arithmetic

**Named work remaining: ≈25 person-hours.** Realistically available: three evenings × four people × three usable hours, **minus the half of Sunday already gone ≈ 30 hours.** A five-hour margin, for four beginners doing first-time Supabase and first-time n8n, with a pass/fail bar of 28 out of 28.

**That margin is not enough, so one thing is descoped in advance and named now:** *if n8n Cloud is not running an Active workflow that completes one round trip by Monday 22:00, the engine becomes the Supabase Edge Function Dana already wrote.* It is her own documented fallback, the front end and the SQL are identical either way, and the answer to the judge is one honest sentence.

**Six things must be true before anyone sleeps tonight:** the Supabase project exists · `01→06` ran clean · `vendor/supabase.js` is committed · the app lives at the repo root · Dana's three branches are merged into `main` · and one person's name is on area 05.