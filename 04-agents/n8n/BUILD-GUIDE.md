# Building the worker in n8n — node by node

**Owner:** 04 · Automation and agents (Dana)
**Engine decision:** `docs/DECISION-A1-ENGINE.md` — n8n Cloud, with `worker/edge/` as the named fallback.
**Files:** `n8n/workflow.json` (import this), `n8n/workflow.template.js` + `tools/build-workflow.js` (what generates it), `n8n/phases.js` (what the Code nodes actually run), `tests/phases.test.js` (proof it only ever does four things).

> **Blocked until 03 runs the SQL.** Two things must exist in the database before a single node works:
> 1. everything in `03-security/db/` (files 01 → 06). Until then `launch_mission()` does not exist and the button writes nothing.
> 2. `03-security/db/08_agent_claim.sql` — the read path. Every table privilege is revoked from `service_role`, so **the worker cannot SELECT `mission_runs` and cannot read an objective**: it can write through three functions and read through none. That file adds `claim_next_run()` and `sweep_stalled_runs()`. It has been reviewed by 03 and lives in their folder now, which is why it runs with `01`→`06` and not separately. (It supersedes `04-agents/db/REQUEST-TO-03-agent_claim_run.sql` — the ask, which had two bugs the answer fixed. That file has been **deleted**, so nobody can paste the older draft into the SQL editor.)
>
> Nothing below is a claim about a system that is running. It is the build order for one that is not yet.

---

## 1 · Before you open n8n — four checks, ten minutes

| # | Check | Why it can end the plan |
|---|---|---|
| 1 | **Is your n8n trial alive through Thursday 24 September?** Billing → plan page. | The course taught n8n on Night 9. A 14-day trial started then lapses on or about demo day. If it is dead, switch to `worker/edge/` — same logic, one file move, no rewrite of the button, the SQL or the guardrails. |
| 2 | **Is it n8n *Cloud*, not n8n on your laptop?** | The judge's own test is "close n8n completely, press the button". Local n8n inverts it: close the laptop app and the run never happens. Cloud is what makes the test pass. |
| 3 | **What is your monthly execution allowance?** Same plan page. | See §9. A 15-second poll is 5,760 executions a day. Read that number before you activate anything. |
| 4 | **Do you have the Supabase project URL and the service-role key?** Supabase → Project Settings → API. | The URL is public — it is already in the front end. The **key is not**, ever, see §2. |

---

## 2 · The credential — once, and never in this repo

n8n → **Credentials → New → Custom Auth**.

Name it exactly **`Supabase service role`**, and paste this as the JSON, with your key in both places:

```json
{
  "headers": {
    "apikey": "PASTE-THE-SERVICE-ROLE-KEY",
    "Authorization": "Bearer PASTE-THE-SERVICE-ROLE-KEY"
  }
}
```

Why Custom Auth and not Header Auth: Header Auth holds **one** header. Supabase's gateway wants `apikey` and PostgREST wants `Authorization`. Custom Auth holds both, so neither of them has to be typed into a node as a literal — and a header value typed into a node is a header value that ends up in an exported workflow JSON, which ends up in this repo, which is public.

**The rules around that key, in four lines:**

- It lives in the n8n credential store and nowhere else. Not in `js/config.js`, not in a node field, not in a screenshot, not in the team chat.
- It bypasses row level security by definition. That is why the browser must never hold it, and why all four functions re-read ownership from the database instead of trusting anything n8n sends.
- `tools/build-workflow.js` **refuses to write `workflow.json` if it finds a key in it.** That check is there because the workflow file is the one artefact of this build that gets exported and committed.
- If a key ever lands in a commit: tell Mariam, delete the file, and **rotate the key**. Deleting it from the working tree does not remove it from the history.

Every HTTP node in this workflow uses: **Authentication → Generic Credential Type → Custom Auth → `Supabase service role`.**

---

## 3 · The canvas

```
 Every 15 seconds ─ Demo controls ─ Sweep stalled runs ─ Claim a queued run ─ Anything queued? ─┬─ (no) ─ Nothing to do
                                                                           │
                                       ┌───────────────────────────────────┘
                                       │
                          Prepare the run ─ Log steps 1-2 ─ Rank and project ─ Log steps 3-4 ─ Impact gate
                                                                  ▲                                │
                                                                  │                          (yes) │
                                       ┌──────────────────────────┘                                │
                                       │                                                           ▼
                                 Re-ranks left? ─ Log the refusal ─ Reject the zone ◄──── (no)    Deliver findings
                                       │                                                           │
                                       └─ (no) ─ Finish: stalled                              Write findings
                                                                                                   │
                                                                                           All writes landed?
                                                                                                   │
                                                                                            Finish: complete

          every error output ────────► Explain the failure ─ Log the failure ─ Finish: failed
```

22 nodes. Build them in three sittings, in this order — each one is demonstrable on its own:

| Phase | Nodes | You can prove |
|---|---|---|
| **A · the spine** | 1–10 | press Launch, watch four steps appear in the app |
| **B · the decision** | 11–19 | the gate rejects Zone A, the run goes back, Zone B reaches the map — `au-m3` |
| **C · the failure** | 20–22 | break a step on purpose and the app says **Failed** and why — SHOULD 9 |

If Wednesday runs out, phase C is the one to drop, not phase B. Without B there is no decision point and `au-m3` fails.

### Faster: import it

`n8n → Workflows → Import from File → 04-agents/n8n/workflow.json`. Then:

1. Open each of the ten HTTP nodes once and pick the `Supabase service role` credential from the dropdown (credential ids are per-account, so the import cannot pick it for you). **This is now the only hand step**, and it is the one step that cannot be automated away, because the credential holds the service-role key and that key is never in this repo.
2. Leave `break_visualization` **false**.
3. Check that **Demo controls** already reads `https://kqboenytmzagdiweqygl.supabase.co`. You should not have to type it. Until 22 Sep this step said "put your project URL in `supabase_url`", the generated file shipped a `YOUR-PROJECT-REF` placeholder, and preflight A3 failed on every clean checkout to remind somebody. An import that skipped the hand step failed on its first poll with a DNS error that says nothing about the real cause, so the URL is now baked into `workflow.template.js` instead. It is public — the same string `js/config.js` ships to every browser that opens the site.

Rebuild the file after any change to `agent/decision.js`, `agent/steps.js`, `agent/run.js` or `n8n/phases.js`:

```bash
node 04-agents/tools/build-workflow.js
node 04-agents/tests/phases.test.js
```

**Never edit `n8n/workflow.json` by hand**, and never edit the generated block at the top of a Code node. Both exist so the threshold is written in exactly one place. Edit it inside n8n to try something, and the number now lives in two places and nobody can say which one is real.

---

## 4 · Node by node

Fields not mentioned stay at their defaults.

### 1 · `Every 15 seconds` — Schedule Trigger

**Trigger Interval:** Seconds · **Seconds Between Triggers:** 15.

**Why a schedule and not a webhook — the sentence for a judge:**

> A webhook is a URL that makes our agents run, and anything with a URL can be pressed by someone who is not us. On a schedule, n8n only ever asks our own database "is there a queued run?", so the only thing that can start an agent is a signed-in researcher pressing Launch in our app.

Three more reasons, in order of how much they matter:

1. **D-1 says the browser never calls n8n.** With a webhook, something has to call it — and if that something is the browser, the URL is in View Source and the Network tab, and it is a URL that reaches a key which bypasses RLS. A schedule means there is no URL to leak, so the rule cannot be broken by accident later.
2. **It makes `au-m1` true rather than argued.** Close n8n entirely, press Launch: `launch_mission()` writes a `queued` row, and that row is still there when n8n next looks. Nothing about the button depends on n8n being awake.
3. **A queue survives what a webhook drops.** A webhook fired during a network blip is gone. A queued row is still queued.

The cost, said out loud rather than hidden: **up to 15 seconds before the first step appears.** Say it before the judge notices it — "it polls every fifteen seconds, so watch the strip; the run is already queued."

### 2 · `Demo controls` — Set

Two fields. Building the node by hand, these are the values:

| Name | Type | Value |
|---|---|---|
| `supabase_url` | String | `https://kqboenytmzagdiweqygl.supabase.co` |
| `break_visualization` | Boolean | `false` |

Every other node builds its URL from this one, so there is one place to change and no chance of eight nodes disagreeing.

The project URL is public; the key is not and is not here. If that distinction ever looks like a slip, it is the same one `03-security` is built on: the browser already holds this URL and the publishable key, and every rule that matters lives in Postgres below the API where a browser cannot reach around it. The service-role key is the opposite kind of string — it bypasses row level security — and it lives only in the n8n credential store. `build-workflow.js` refuses to write `workflow.json` if a key-shaped string reaches it, and preflight `A5` checks the committed file again afterwards.

### 3 · `Sweep stalled runs` — HTTP Request

| Field | Value |
|---|---|
| URL | `={{ $('Demo controls').first().json.supabase_url }}/rest/v1/rpc/sweep_stalled_runs` |
| Body | JSON · `{}` |
| Settings → On Error | leave at **Stop Workflow** |

Sweep first, claim second. That order is Option A in `03-security/db/08_agent_claim.sql`, and it is there because **a worker that dies mid-run cannot call `agent_finish_run` to say so**. The row would stay `running` for ever and the researcher would watch a spinner — the exact thing SHOULD 9 forbids. Nothing inside a dead process can fix that; the database has to, and this is the worker asking it to.

An empty body takes the function's default of three minutes of no activity, which is deliberately the same number as `STALL_MS = 180000` in `app/js/automation.js`, so the screen and the database give up at the same moment. (The panel used to say 120000, which meant the screen read *Failed* while the row still read `running`. `node 04-agents/tools/preflight.js` check C5 now fails if the two drift again.) It returns how many runs it stalled — usually `0`.

It never touches `queued` runs. A run that is queued with n8n closed is the `au-m1` test in progress, and sweeping it would fail the exact test this workflow exists to pass.

Leave On Error at Stop Workflow: if the sweeper is refused, the poll does nothing this cycle and turns red, and the next poll tries again fifteen seconds later. A database that is refusing calls should be loud.

### 4 · `Claim a queued run` — HTTP Request

| Field | Value |
|---|---|
| Method | POST |
| URL | `={{ $('Demo controls').first().json.supabase_url }}/rest/v1/rpc/claim_next_run` |
| Authentication | Generic → Custom Auth → `Supabase service role` |
| Send Body | on · JSON · `{}` |
| Settings → **Always Output Data** | **on** |

**This is the whole of "claiming a run safely".** `claim_next_run()` (`03-security/db/08_agent_claim.sql`) does it inside one statement:

```sql
update public.mission_runs r
   set status = 'running', claimed_at = now()
 where r.id = (select r2.id from public.mission_runs r2
                where r2.status = 'queued'
                order by r2.started_at
                limit 1
                for update skip locked)       -- <- this line
returning ...
```

Call `claim_next_run`. It is the only name — the older `agent_claim_run` shim was removed from `08_agent_claim.sql` on 21 Sep 2026 once every caller had moved, and it never existed on the live database. A request to `/rest/v1/rpc/agent_claim_run` will 404.

- `for update skip locked` means two polls that overlap **cannot** take the same row: the second one skips the locked row and takes the next queued one, or nothing.
- The row flips to `running` in the same statement that reads it, so there is no window between "found it" and "claimed it".
- **It takes no arguments.** The worker cannot be told which run to work on, so there is nothing for a forged call to name.
- It returns no `researcher_id`. n8n never learns whose mission it is.

**Always Output Data** matters: with nothing queued, PostgREST returns `[]` and n8n would produce zero items, and every node after it stays grey. With it on you get one empty item, the IF sends it to `Nothing to do`, and a poll that found nothing looks like what it is instead of looking broken.

### 5 · `Anything queued?` — IF

Condition: `={{ $json.run_id }}` · **String → exists**. Settings → **Execute Once: on**.
True → `Prepare the run`. False → `Nothing to do`.

### 6 · `Nothing to do` — No Operation

Most polls land here. It is not an error, and it is on the canvas so that it does not look like one.

### 7 · `Prepare the run` — Code — **steps 1 and 2**

Paste: the generated bundle, then the tail shown in `workflow.template.js`. If you imported the JSON it is already there.

It calls one pure function, `AgentPhases.phaseObserve()`, which:

- screens the objective for instructions (`AgentRun.looksLikeInstruction`) and puts the result on `p_injection` of step 1 — the flag rides on the mission from there and `agent_log_step` raises `missions.injection_flag`, which is never lowered;
- checks the mission area is a real area inside Kuwait (46.5–48.8 E, 28.5–30.1 N — D-3, and the same check the database runs in `06_validation.sql`), and refuses the run with a readable sentence if it is not;
- emits two `agent_log_step` calls — `satellite_data`, then `environmental_analysis`.

Every item it emits carries the same `ctx`. That is how the run id survives the HTTP nodes: an HTTP node replaces the item with the database's response, so later nodes read `$('Prepare the run').first().json.ctx` instead.

### 8 · `Log steps 1-2` — HTTP Request

| Field | Value |
|---|---|
| URL | `={{ $('Demo controls').first().json.supabase_url }}/rest/v1/rpc/{{ $json.rpc }}` |
| Body | JSON · `={{ JSON.stringify($json.args) }}` |
| Settings → On Error | **Continue (using error output)** — and see §6 |

One node, one call per item, posted in order. The URL is built from the item, and the item can only ever carry one of three function names, because `phases.js` can only ever emit three. **A `/rest/v1/<table>` URL anywhere in this workflow is a security finding** — `service_role` has no table privileges, so it returns 401 and the run dies halfway, which on screen looks exactly like "the database is broken".

The ten HTTP nodes are all this same shape. Get it right once.

### 9 · `Rank and project` — Code — **steps 3 and 4** — the node the backwards arrow returns to

Calls `AgentPhases.phaseRankAndProject()`, which logs `recommendation` and `impact_prediction` and produces the two numbers the gate compares: `ctx.cooling_c` and `ctx.floor_c`.

The re-rank memory is three lines and there is no other state anywhere in the workflow:

```js
let rejected = [];
try { rejected = $('Reject the zone').first().json.ctx.rejected_ids || []; }
catch (e) { rejected = []; }
```

On the first pass `Reject the zone` has never run, `$()` throws, and the catch gives an empty list. On the second pass it returns the zones already refused. Note `$('Node')` gives you that node's **most recent** run in this execution — which is exactly what a loop needs.

### 10 · `Log steps 3-4` — HTTP Request

Identical to node 7.

### 11 · `Impact gate` — IF — **THE DECISION POINT**

| Field | Value |
|---|---|
| Value 1 | `={{ $('Rank and project').first().json.ctx.cooling_c }}` |
| Operation | **Number → is greater than or equal to** |
| Value 2 | `={{ $('Rank and project').first().json.ctx.floor_c }}` |
| Settings → Execute Once | **on** |

True → `Deliver findings`. False → `Reject the zone`.

**Neither number is typed into n8n.** `floor_c` is `IMPACT_FLOOR_C` from `agent/decision.js`; `cooling_c` is the projection for the top-ranked zone, rounded to the one decimal place the report prints, by `round1()` in the same file. When a judge asks where the threshold lives, the answer is one file and one line — and changing it in `decision.js` and rebuilding changes the canvas, the browser panel and the test together.

Two traps on this node:

- **Execute Once must be on.** Its input is two items from the HTTP node (two log steps), and without it the IF emits two items down the branch. The Code nodes below run once for all items so it would not double-write, but the canvas becomes unreadable and `Finish` nodes fed two items post twice.
- **Set the operation to Number, not String.** As strings, `"0.6" >= "1"` is `false` and `"1.9" >= "1"` is `true` — which looks right for a while and is not. `phases.js` has a tripwire for this: if the false branch is reached when `decide()` says the run should go forward, it stalls the run and says the IF node is miswired rather than looping.

### 12 · `Deliver findings` — Code — **steps 5 and 6**, true branch

Calls `AgentPhases.phaseDeliver()`. Emits, in order: one `agent_write_result` per accepted zone (`kind: 'site'`, with `geometry` as a GeoJSON Polygon — no file, no bucket, D-2), one `metric` row naming the floor that was applied, the `visualization` log step, the `narrative` draft, and the `reporting` log step.

Every result body ends with *"Sample prototype figure, not a KuwaitSat-1 measurement."* — on the row, not in a slide, because a provenance label a judge cannot click is not traceability.

It also reads `break_visualization` from `Demo controls`. See §7.

### 13 · `Write findings` — HTTP Request

Identical to node 7. On Error → Continue (using error output).

### 14 · `All writes landed?` — Code

```js
const planned = $('Deliver findings').all().length;
const landed  = $input.all().length;
if (landed < planned) { return []; }     // the failure branch is already closing this run
```

**A run calls itself `complete` only if every write it planned came back 2xx.** If one was refused, that item went out of the error output, the failure branch is closing the run as `failed`, and this node returns nothing so the complete path simply stops. This is the opposite of "continue on fail": the error is looked at, and a half-written run is refused the word "complete".

### 15 · `Finish: complete` — HTTP Request

Same shape. Settings → **Retry On Fail: on, Max Tries 2, Wait Between Tries 5000 ms**. `agent_finish_run` sets `mission_runs.status = 'complete'` and moves `missions.status` to **`review`** — the researcher now has something to approve.

Retry here and not on the log nodes, deliberately: this call is the last one, and a lost response leaves a run `running` for ever. Retrying a *log* write after a timeout risks two rows for one step. Retry the closing call; never retry a write that a guardrail refused (see §6).

### 16 · `Reject the zone` — Code — false branch

Calls `AgentPhases.phaseReject()`, which asks `decide()` for the verdict **and for the sentence**:

> *"Zone A - North corridor projects only 0.6 °C of cooling at 24 months, below the 1.0 °C floor. Zone rejected. Ranking again without it."*

That sentence goes to `agent_log_step(..., p_allowed => false, p_refused_reason => ...)`, which lands in `agent_steps.refused_reason` — a column the `my_agent_steps` view exposes to the researcher. It deliberately does **not** go to `mission_runs.error_note`, which the browser has no grant on: a reason stored only there is a reason nobody ever reads.

### 17 · `Log the refusal` — HTTP Request

Identical to node 7.

### 18 · `Re-ranks left?` — IF

Condition: `={{ $('Reject the zone').first().json.ctx.can_rerank }}` · **Boolean → is true**. Execute Once: on.
**True → back to node 9, `Rank and project`.** False → `Finish: stalled`.

That connection is the one backwards arrow on the board. Why it terminates: a rejected zone leaves the candidate list, so every pass has one fewer zone, and `MAX_RERANKS = 2` in `decision.js` stops it regardless. `tests/phases.test.js` runs the loop with every zone below the floor and asserts it stops.

### 19 · `Finish: stalled` — HTTP Request

URL ends `/rpc/agent_finish_run`; body `={{ JSON.stringify($('Reject the zone').first().json.ctx.stall_args) }}`. Execute Once: on, Retry On Fail: on.

`stalled` is a real outcome, not a failure to be hidden: no zone cleared the floor, so nothing was recommended. `missions.status` goes to `failed` and the app shows **Stopped** with the reason. A run that recommends nothing and says why is a better demo than one that recommends something it should not.

### 20 · `Explain the failure` — Code

Every error output on the canvas lands here. It turns whatever the database or the network said into one sentence, then emits an `agent_log_step` with `p_allowed: false` — because that is the only channel the researcher can actually read.

### 21 · `Log the failure` — HTTP Request

On Error → Continue (using error output), and **both outputs go to node 21**. If even the reason row cannot be written (the run was already closed, say), the run still gets closed.

### 22 · `Finish: failed` — HTTP Request

Body built from `$('Explain the failure').first().json.ctx`. Execute Once: on, Retry On Fail: on. Sets `mission_runs.status = 'failed'`, `missions.status = 'failed'`, and the app shows the word **Failed**.

---

## 5 · Where the decision really lives

One number decides the run, and it is written once:

```js
// 04-agents/agent/decision.js
var IMPACT_FLOOR_C = 1.0;   // °C of projected 24-month cooling
var MAX_RERANKS    = 2;
var MIN_ZONE_SCORE = 40;    // a guardrail, NOT the decision
```

Four things read that file and none of them holds a copy: the n8n Code nodes (through the generated bundle), the browser panel, `tools/rehearse.js`, and both test files. The demo sentence:

> "Zone A ranks first at 88 out of 100 and projects 0.6 °C. The floor is 1.0, so the agent rejected its own best-ranked zone and ranked again without it. What you are looking at on the map is Zone B, at 81. The highest-scoring zone is not the one on the map — that is the decision doing something."

---

## 6 · The trap: "continue on fail"

n8n gives a node three behaviours on error. They are not interchangeable, and one of them will quietly lose you the marks:

| Setting | What happens | Use it? |
|---|---|---|
| **Stop Workflow** (default) | the execution stops, red on the canvas | On the three `Finish` nodes only |
| **Continue (using regular output)** | the failed item is passed on as if it succeeded, down the same wire | **Never. This is the trap.** |
| **Continue (using error output)** | the failed item leaves by a second, red output you must wire somewhere | On the five write nodes: 8, 10, 13, 17, 21 |

**Why "continue (regular output)" is worse than a red canvas.** The refusals this workflow will actually meet are not bugs. They are the guardrails doing their job:

- `Run is not active.` — someone is writing to a finished run
- `Step budget exhausted.` — 40 tool calls, the limit in `agent_log_step`
- `Result body too long.` — over 20,000 characters
- a `step_name` the CHECK constraint refuses

Swallow one of those and the run walks on to `agent_finish_run(..., 'complete')`. The mission goes to **review**. The researcher opens a mission that is marked ready, with a step missing and a finding that was never written, and nothing anywhere says so. That is precisely the failure the capstone guide names — *"the trap is the silent continue"* — and it is worse than the red canvas because a red canvas is at least true.

**What to do instead**, in one rule: *every node that can fail routes its error output to `Explain the failure`, which writes the reason where the researcher can read it and then closes the run as failed.* A green canvas is not the goal. A run that ends with a word and a reason is.

And a corollary about **Retry On Fail**: retries are for transient network trouble, not for refusals. A 400 from a guardrail will be a 400 on the second try, and retrying a `agent_log_step` that actually succeeded before the response was lost writes the step twice. Retry only the three `Finish` nodes, twice, five seconds apart.

---

## 7 · Breaking a step on purpose, and putting it back — SHOULD 9

**Open `Demo controls` and set `break_visualization` to `true`. That is the whole sabotage.**

What happens, and why it is a real failure rather than a pretend one:

1. `phaseDeliver()` emits the visualization step as `visualisation` — British spelling.
2. That name is not in the database's CHECK constraint (`01_tables_rls.sql`: `'satellite_data','environmental_analysis','recommendation','impact_prediction','visualization','reporting'`), so **the database refuses the insert**. Nothing was faked and nothing was thrown by hand: a real constraint rejected a real write.
3. PostgREST answers 400. `Write findings` sends that item out of its error output.
4. `All writes landed?` sees fewer writes than planned and returns nothing, so the run never says "complete".
5. `Explain the failure` → `Log the failure` writes a refused step carrying the database's own message → `Finish: failed` closes the run.
6. In the app: the step strip stops, the word **Failed** appears, and the reason is on screen. No spinner.

**Putting it back: set the same field to `false`.** There is no edit to undo, no file to remember, and nothing left in a source file after Thursday — which is exactly why the switch is on the canvas and not in the code.

Two things not to do instead:

- **Do not break the credential.** The run then fails before it is claimed: the row stays `queued`, the app shows "waiting for a worker", and there is no failed step to point at. You would be demonstrating a spinner.
- **Do not add `throw new Error()` to a Code node.** It proves n8n can show red. It does not prove your app tells a researcher anything.

Rehearse this once on Wednesday with the app open, and write down the exact wording that appears on screen. If the wording is bad, that is a finding worth having before Thursday, not after.

---

## 8 · Two guides this replaced — both deleted

Three sessions wrote into this folder in parallel and left three descriptions of the same workflow. Two of them are now **deleted**, because shipping two guides is worse than shipping either. This is the record of what they said and why they went, so nobody restores one from history on Wednesday:

- **`04-agents/n8n/README.md`** (five nodes) — **deleted.** Its node 2 did `GET /rest/v1/mission_runs?status=eq.queued`. That is a **table URL, and the grants make it 401** — the same page's own text said a table URL is a finding. It also never claimed the row, so two polls 15 seconds apart would process the same run twice and write two sets of steps onto one run. Both are fixed by `claim_next_run()`, which claims inside the same statement that reads (`for update skip locked`) and is reached at `/rest/v1/rpc/claim_next_run`.
- **`04-agents/worker/n8n/WORKFLOW.md`** — **deleted.** It built the same run behind a **Webhook** woken by a Supabase Database Webhook. It works, but it puts a URL that starts agents back on the internet, which is the thing D-1 exists to prevent; it called the compatibility shim `agent_claim_run()` rather than `claim_next_run()`; and it had no IF node, so there was no decision anywhere on the canvas to point at for `au-m3`.

This guide is the one with a schedule, a claim, and the decision as a node you can point at. `node 04-agents/tools/preflight.js` check C1b fails if either file comes back.

---

## 9 · The poll interval is a billing decision

| Interval | Executions per day | Per month |
|---|---|---|
| 15 s | 5,760 | ~173,000 |
| 60 s | 1,440 | ~43,000 |
| 5 min | 288 | ~8,600 |

Every poll is an execution, including the ones that find nothing. Check your plan's allowance (§1, check 3) and do the division — if it is a few thousand a month, an always-on 15-second poll spends it in hours and the workflow stops working at the worst possible moment.

**How to spend it deliberately:**

- While building, leave the workflow **Inactive** and use **Test workflow** — a manual execution claims a real queued run and is the fastest way to debug.
- Activate at 15 seconds for the Wednesday rehearsal, then deactivate.
- Activate again on Thursday morning and leave it.
- If the allowance is genuinely tight, set 60 seconds for rehearsals and 15 for demo day. One field, one number, no other change.

Related, and worth knowing before it surprises you: if a run takes longer than 15 seconds, the next poll starts a **second execution**. That is safe — `for update skip locked` means it claims the *next* queued run or nothing. It is the reason claiming had to be done in SQL rather than with an IF node.

---

## 10 · Proving it to a judge

**`au-m1` — the trigger lives in our app.**

1. Open the n8n editor, show the canvas, say "this is the worker", **close the tab**.
2. In the app, press **Launch Mission**. Say: "it polls every fifteen seconds."
3. The steps tick. The findings appear. The map draws.
4. Open the browser's Network tab, filter for `n8n` — **nothing**. Filter for `rpc` — `launch_mission`. Do this unasked: `au-m1` is about where the trigger lives, and the Network tab is the only place that can be checked rather than claimed.

**`au-m6` — someone who never opens n8n sees the outcome.** Close the n8n tab and the Supabase dashboard. Everything on screen came from `my_missions`, `my_agent_steps` and `results`, read by the app with the researcher's own session.

**`au-m5` — the approved tool and its limit.** `agent/steps.js`, one line per step. Point at `scene_index.search`: *"It reads a stored scene index inside Kuwait only, returns at most 20 scenes, never tasks the satellite and never writes."* Then show the line.

---

## 11 · What is not true yet

Say these as they are. Every one of them is fixable this week; none of them is fixable by describing it as done.

1. **The SQL has not been run.** No `launch_mission()`, no `claim_next_run()`, no run.
2. **`03-security/db/08_agent_claim.sql` has been reviewed by 03 but not RUN.** It adds a column (`mission_runs.claimed_at`) as well as two functions, and until somebody runs it there is no read path for the worker at all.
3. **This workflow has not been built in n8n.** Every node above is instructions, not evidence. `au-m1` passes the first time node 4 claims a real row.
4. **No rehearsal has broken a rule**, so `au-m4`'s "one rule I changed" cannot be claimed. `GUARDRAILS.md` R-1 is the rehearsal designed to break one; run it Tuesday, write down what happened, then change the rule. Patch it first and there is nothing true to say.
5. **Zone scores and cooling projections are sample values**, not KuwaitSat-1 measurements. Every finding row says so. The decision comparing them is real code; the inputs are illustrative.
6. **A worker that dies mid-run is corrected only when a worker next polls.** `sweep_stalled_runs()` runs at the top of each poll (node 3), so if n8n itself is down, nothing sweeps and the row stays `running` until it comes back. The front end's own 180-second timeout (`STALL_MS`, the same three minutes) still tells the researcher, so no spinner survives either way — but the row is corrected late. pg_cron would close that gap and is written up in `08_agent_claim.sql` as Option B; it is a second scheduler to explain, and not this week.

---

## 12 · The one ask to 02 · Back end (Hind) — send this whole section

Everything the worker touches, it touches through four functions. I need no table grant and no new column. What I need is confirmation that these exist with these names, and answers to the eight questions.

### Columns the workflow writes, through the functions only

| Table | Columns | Written by |
|---|---|---|
| `mission_runs` | `status`, `started_at`, `claimed_at`, `finished_at`, `tool_calls`, `error_note` | `launch_mission`, `claim_next_run`, `sweep_stalled_runs`, `agent_log_step`, `agent_finish_run` |
| `agent_steps` | `run_id`, `step_name`, `tool`, `arguments`, `allowed`, `refused_reason`, `injection_flag`, `status`, `finished_at` | `agent_log_step` |
| `results` | `mission_id`, `run_id`, `kind`, `title`, `body`, `geometry`, `status`, `source_ref` | `agent_write_result` |
| `missions` | `status`, `launched_at`, `injection_flag` | `launch_mission`, `agent_log_step`, `agent_finish_run` |

### Values that must not drift — the workflow hard-fails on any of them

| Where | Allowed values |
|---|---|
| `agent_steps.step_name` | `satellite_data`, `environmental_analysis`, `recommendation`, `impact_prediction`, `visualization` (US spelling), `reporting` |
| `results.kind` | `site`, `metric`, `map_layer`, `narrative` |
| `mission_runs.status` | `queued`, `running`, `complete`, `failed`, `stalled` |
| `missions.status` | `draft`, `queued`, `running`, `review`, `complete`, `failed` (`06_validation.sql`, `missions_status_allowed`) |
| `mission_runs.tool_calls` | 0–40 |
| `results.body` | ≤ 20,000 characters |

### The eight questions

1. **Are you building on `03-security/db/`, or on a schema of your own?** If there are two schemas there is no demo. If any column here is named differently in yours, tell me tonight — I name all of them through the four functions and nowhere else.
2. **Who runs the SQL, and when?** Nothing in 04 exists until 01→06 are executed. Name a person and a time.
3. **Will `03-security/db/08_agent_claim.sql` be run with them, and does `mission_runs.claimed_at` clash with anything of yours?** Without that file the worker has no read path at all — `service_role` cannot select `mission_runs`. It adds one nullable column and two functions, and no table grant.
4. **Which coordinate order does the front end draw?** The database wants GeoJSON, longitude first: `06_validation.sql` checks `(pt->>0)` against 46.5–48.8 E and `(pt->>1)` against 28.5–30.1 N. Leaflet's `L.latLng()` is the other way round. ~~The sample polygon in `tests/decision.test.js` is latitude first.~~ **Fixed on my side:** every polygon in 04 is now `[lng, lat]` with a closed ring — `phases.js`, `app/demo.html` and `tests/decision.test.js`. Confirm the map reads the same order, because a sample in the wrong order is how the wrong order reaches production.
5. **During a run, what does the mission list show?** `claim_next_run()` sets `mission_runs.status = 'running'` and deliberately leaves `missions.status` at `queued` until the run finishes. So **any screen that badges from `missions.status` reads "Queued" while six steps tick.** The agreed answer in `08_agent_claim.sql` is that the live screen reads `mission_runs.status` and `my_agent_steps`. Confirm that is what the mission list and the mission page actually do — `06_validation.sql` would also allow `'running'` on missions, so if a screen needs it, say so now rather than on Thursday.
6. **Does the mission screen read `results` by column name, or the `my_mission_results` view?** The view truncates `body` to 240 characters (`left(r.body, 240) as preview`), which cuts the provenance line — *"Sample prototype figure, not a KuwaitSat-1 measurement"* — off the end of every finding. SHOULD 11 is traceability. **My panel reads the `results` table by name** (`id,kind,title,body,geometry,status,created_at`, all granted) and only ever uses the view for step rows. Do the same, or move the truncation — but do not read `preview` and call it the finding.
7. **Does the Launch button return the run id to the page?** `launch_mission()` returns a uuid. The panel needs it to poll `my_agent_steps` for that run.
8. **Is `results.body` rendered with `textContent`?** D-2 says plain text, never markdown or `innerHTML`. The agent writes that field, and I would rather it be untrusted on your side too.
