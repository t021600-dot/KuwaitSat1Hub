# 🤖 Job 04 · Automation and agents

**Owner:** Dana · **GitHub:** *to fill in*
*What acts on its own. The single entry point for this role.*

---

## What this role is

> **If it only collects and forwards, it is a form in a costume.**

Six AI agents that take a research objective and work it through to a finding —
with at least one real decision where the next step depends on what was found,
guardrails written *before* the agent can act, and a run that a researcher can
watch without ever opening n8n.

| | |
|---|---|
| **My share of the bar** | **6** of the 28 MUST items (`au-m1` … `au-m6`) |
| **The judge's question to me** | *"Draw the process. Where does it decide?"* |
| **The test I cannot fake** | Close n8n completely, then press the button in our own app |

---

## My MUST items
- `au-m1` the automation is triggered from our own front end, not the n8n canvas
- `au-m2` the front end has an automation section: start, status, result
- `au-m3` at least three steps and one decision point
- `au-m4` a written guardrail list with numbers, and one rule changed because
  a rehearsal broke it
- `au-m5` at least one approved tool, and we can say what it may and may not do
- `au-m6` a user who never opens n8n sees the outcome in the app

---

# THE MAP OF THIS FOLDER

Three sessions wrote into this folder in parallel and left **two extra panels,
two extra n8n guides and a second copy of the worker logic**. They had drifted
apart: different stall timeouts, a table URL in one guide, and an injection path
that stopped the run in one engine while the other flagged it and carried on.
Six files were deleted. What is left is one answer per question.

**If you only open one other file, open [`GUARDRAILS.md`](GUARDRAILS.md).**

## The agent's brain — where every decision is made

| File | What it is |
|---|---|
| [`agent/decision.js`](agent/decision.js) | **THE THRESHOLD.** `IMPACT_FLOOR_C = 1.0`, `MAX_RERANKS = 2`, `MIN_ZONE_SCORE = 40`, written once. Everything else reads them. |
| [`agent/steps.js`](agent/steps.js) | The six step names the database will accept, each with its tool and its one-line limit. This is the `au-m5` answer. |
| [`agent/run.js`](agent/run.js) | `planRun()` — the whole run as an ordered list of database calls. Also `describeRefusal()`, the injection screen. |
| [`n8n/phases.js`](n8n/phases.js) | The same run, broken at the decision into four pure functions, so the gate can be a node on the canvas you can point at. |

Nothing else decides anything. A new rule goes in one of these four files —
never into n8n, never into the panel.

## The worker — what runs the agents

| File | What it is |
|---|---|
| [`n8n/BUILD-GUIDE.md`](n8n/BUILD-GUIDE.md) | **THE ONLY n8n GUIDE.** 22 nodes, one at a time: schedule → sweep → claim → observe → rank → **the decision** → deliver or reject → finish. |
| [`n8n/workflow.json`](n8n/workflow.json) | Generated. Import this rather than building by hand. |
| [`n8n/workflow.template.js`](n8n/workflow.template.js) | What generates it. Edit this; never the JSON. |
| [`n8n/agent-code-node.js`](n8n/agent-code-node.js) | Generated fallback — the whole run in ONE Code node, for the evening the import fails. |
| [`worker/edge/index.ts`](worker/edge/index.ts) | The named fallback engine: a Supabase Edge Function importing the same four brain files. Not what we are building. |

## The screen — what a researcher sees

> **Corrected 21 September 2026.** This table used to call
> `app/js/automation.js` **"THE ONLY PANEL"**. It is not the panel that ships,
> and `index.html` has never loaded it. Saying otherwise in the folder's own
> map is the kind of sentence that gets read out beside a judge.

**What actually ships is [`js/ksat-workflow.js`](../js/ksat-workflow.js)**, at
the repo root, loaded by `index.html` — the page Vercel serves. `automation.js`
here is the **reference implementation**: the same panel written against the
**n8n** write path, for the day the worker is switched on. Both exist on
purpose and neither is dead code.

| File | What it is |
|---|---|
| [`../js/ksat-workflow.js`](../js/ksat-workflow.js) | **THE PANEL THAT SHIPS.** Not in this folder and not 04's file alone — it is 04 · Agents with 03 · Security. Start, status, result, and the human checkpoint. Calls `launch_mission()`, then runs the six agents **in the page**, writing each step through `researcher_log_step()` and reading the rows back from `agent_steps` as proof they landed. |
| [`app/js/automation.js`](app/js/automation.js) | **THE REFERENCE PANEL.** Same three regions, same checkpoint, but it assumes a worker: `launch_mission()`, then polls `my_agent_steps` every 2 s for rows n8n writes with `agent_log_step()`, and reads full findings from `results`. Nothing the browser downloads loads it. **Do not delete it and do not copy it into `js/`** — a second panel in the page means two Launch buttons and no way to say which one ran. |
| [`app/INTEGRATION.md`](app/INTEGRATION.md) | **The mapping between the two, line by line**, plus the reference panel's mounting contract and the eight traps that apply to both. Start here if you are touching either file. |
| [`app/demo.html`](app/demo.html) | The **reference** panel with a **fake database** under it — clickable with no Supabase and no n8n. Say "this is a replay, and it is not the shipped panel" out loud. Open it from disk. |

**The one number that genuinely differs:** `agent/decision.js` rejects a zone
below `IMPACT_FLOOR_C = 1.0` °C of cooling; `js/ksat-workflow.js` rejects below
`UPLIFT_FLOOR_PP = 4.0` percentage points of vegetation cover. That is not
drift. `js/ksat-workflow.js:55-65` shows the arithmetic: the page's own
`predictImpact()` tops out at −0.86 °C across all six governorates, so a 1.0 °C
floor rejects every candidate and every run stalls. The panel therefore states
its floor in the unit the page computes. Preflight check **B5** fails if anyone
"fixes" it by copying `IMPACT_FLOOR_C` across.

> **Nothing in `04-agents/` is served.** A `.vercelignore` keeps the whole
> folder out of the deployment, so this README, `INTEGRATION.md`, `demo.html`
> and `automation.js` have no public URL. They are read on GitHub and run from
> disk. That is deliberate: the reference implementation, the n8n guide and the
> guardrail list are working papers, not product.

## The writing — what gets read aloud

| File | What it is |
|---|---|
| [`GUARDRAILS.md`](GUARDRAILS.md) | Sixteen numbered rules in four kinds, the approved tool list (`au-m5`), and the rehearsals. **Written to be spoken.** |
| [`docs/AU-M3-PROCESS.md`](docs/AU-M3-PROCESS.md) | The process and the decision point — the two minutes at the whiteboard. |
| [`docs/DEMO-RUNBOOK.md`](docs/DEMO-RUNBOOK.md) | Demo night beat by beat, including what to say when something fails. |
| [`docs/HAND-SIMULATION.md`](docs/HAND-SIMULATION.md) | The whole run walked through by hand, on paper. Where O-1, O-2 and O-3 came from. |
| [`docs/VERIFICATION-CHECKLIST.md`](docs/VERIFICATION-CHECKLIST.md) | Every claim in this folder, how to verify it, and what is **not true yet**. |
| [`docs/DECISION-A1-ENGINE.md`](docs/DECISION-A1-ENGINE.md) | Why n8n Cloud, and what the fallback is. |

## The tools — run these instead of trusting memory

```bash
node 04-agents/tools/preflight.js      # reads the repo, prints which claims are still true
node 04-agents/tools/rehearse.js       # prints a whole run to the terminal, no network
node 04-agents/tools/build-workflow.js # regenerates n8n/workflow.json
node 04-agents/tools/bundle.js         # regenerates n8n/agent-code-node.js

node 04-agents/tests/decision.test.js          # 17 checks · the decision and the loop
node 04-agents/tests/phases.test.js            # 20 checks · what the canvas emits
node 04-agents/tests/automation-panel.test.js  # 38 checks · the panel, in a fake DOM
node 04-agents/tests/injection.test.js         # 35 checks · the R-2 break test, end to end
```

**Rebuild after any change to `agent/*.js` or `n8n/phases.js`**, or the canvas
runs last night's threshold. Preflight check A6 catches a stale build.

---

# WHAT DANA STILL HAS TO DO LIVE

None of this can be done by editing a file. Every row is a thing done in
somebody's browser, and until it is done the claim beside it is not true.

| # | The thing | Where | Blocks |
|---|---|---|---|
| 1 | **Get the SQL run** — `03-security/db/01` → `06`, then `08_agent_claim.sql` (04's only read path: `claim_next_run`, `sweep_stalled_runs`), `09`, `10`, and now `11_monitoring.sql` (`monitor_record` for the nightly cron, and the `reports_one_per_mission` guard). `07` is PHASE2: read, do not run. Mariam's hands, not yours. | Supabase SQL editor | **everything** |
| 2 | **Check the n8n trial is alive through Thursday.** The course taught n8n on Night 9; a 14-day trial lapses on or about demo day. | n8n → Billing | the engine choice |
| 3 | **Create the n8n Cloud workspace and the credential.** Custom Auth named `Supabase service role`, holding `apikey` **and** `Authorization`. The key lives there and nowhere else. | n8n → Credentials | every HTTP node |
| 4 | **Import `n8n/workflow.json`**, put the real project URL in the **Demo controls** node, and pick the credential in each of the ten HTTP nodes. | n8n → Import from File | `au-m1`, `au-m3` |
| 5 | **Switch the workflow to ACTIVE.** Saved is not active. An inactive workflow never polls, and every run sits `queued` for ever. | n8n, top right | `au-m1`, `au-m6` |
| 6 | **Run rehearsal R-1** (`GUARDRAILS.md` §4) and fill in its table. Until it has real numbers, **do not say** the `au-m4` sentence. | the app + SQL editor | `au-m4` |
| 7 | **Rehearse R-2 live** — the injection objective, once, with the app open — and write down the exact wording that appears on screen. | the app | `COULD 14` |
| 8 | **Watch somebody else drive it** for 45 minutes with your hands off the keyboard. | Wednesday | all of it |
| 9 | **Make `04-agents/evidence/` and put files in it.** A row nobody screenshotted scores the same as a row that failed. | `mkdir` | every claim |

Do 1 and 4 before anything else. `node 04-agents/tools/preflight.js` tells you
where you actually are; section E of its output is this list, as ticks.

---

## Hand-offs — things 04 cannot fix from inside this folder

- ~~**To 01 · Retag.** `mission.html` still has to mount the panel
  (`app/INTEGRATION.md`).~~ **Closed, 21 Sep.** There is no `mission.html` in
  this repo. The panel that ships is `js/ksat-workflow.js`, loaded by
  `index.html`, and it has been wired in since the integration layer landed.
  The rest of that hand-off stands: `launch_mission()` raises sentences the
  page must recognise — `Limit reached: 5 agent runs per hour.`, `… per day.`,
  `Limit reached: 3 runs per mission per hour.` and
  `This mission has an approved report. Start a new mission.` — which are
  different from the insert trigger's `Limit reached: 5 missions per hour.`
  All of them need to reach the error mapper, or a researcher meets a raw
  Postgres error. `js/ksat-workflow.js` keeps that allowlist in its `SAFE`
  array and quotes the database's own number back.
- ~~**To 03 · Mariam.** Rule 10b from rehearsal R-1 is **not in the code**.~~
  **Done, 21 Sep.** Both halves are in `05_views_rpc.sql` inside
  `launch_mission()`: block **R-1a** refuses any relaunch of a mission that
  already has an approved report, and **R-1b** caps a single mission at 3 runs
  per hour. The comment beside R-1a is worth reading aloud — it is why this is
  a security control rather than a budget one: *"a report carries approved_by —
  a named human … the evidence behind a signed conclusion could change after it
  was signed, with no trace."*
- **To 03 · Mariam.** The uniqueness guard on `reports` is new and **has to be
  run**: `reports_one_per_mission` in `03-security/db/11_monitoring.sql`
  section 5. Without it, pressing Approve twice writes two report rows for one
  mission — two `approved_by` values for one decision. R-1a stops the second
  *run*; nothing stopped the second *report*.
- **To 03 · Mariam.** ~~The `agent_claim_run()` compatibility shim (block 2 of
  `08_agent_claim.sql`) can be dropped whenever you like.~~ **Done, 21 Sep.**
  Dropped from the file; it had never been created on the live database.
  `claim_next_run` is now the only name.
- **To 02 · Hind.** The eight questions in `n8n/BUILD-GUIDE.md` §12 stand,
  except that 4 (coordinate order) and 6 (reading `results`, not the truncating
  view) are now answered from this side.

---

⚠️ **Open the exported JSON before committing it.** n8n exports can contain
credential data. `tools/build-workflow.js` refuses to write a file with a
key-shaped string in it, and preflight A5 re-checks the committed file — but
look anyway. Keys live in the n8n credential store, never in this repo.

## What 03 · Security needs from me
- The browser **never** calls the n8n webhook — it calls `launch_mission()`
- n8n writes only through three named functions, and has no table access
- **Never** switch a node to "continue on fail" to make it green
- The mission objective is untrusted text going into a tool-using agent —
  wrap it, and flag injection attempts rather than acting on them
