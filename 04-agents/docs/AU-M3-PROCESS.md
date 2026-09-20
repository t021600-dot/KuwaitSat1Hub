# au-m3 · The process, the decision, and the two minutes at the whiteboard

**Owner:** 04 · Automation and agents (Dana) · **Written:** Sunday 20 September 2026

> **The test.** Whiteboard, two minutes, no screen: the trigger, three steps, the
> decision, the result. And the judge must hear **what sends the decision each way**.

Six steps exist. **One** of them decides. Draw the six, but spend your two
minutes on the diamond.

---

## 1 · The whiteboard

Draw this top to bottom in one column, then add the one arrow that goes
*backwards*. That arrow is the whole item.

```
        [ LAUNCH MISSION ]          <- our app, not the n8n canvas
                 |
                 v
        mission_runs: QUEUED        <- one row. that is all the browser does
                 |
                 v
        n8n picks up queued runs    <- n8n comes to us. we never call n8n
                 |
                 v
        1  SATELLITE DATA           scenes for the area
                 |
                 v
        2  ENVIRONMENTAL ANALYSIS   NDVI + surface temperature
                 |
                 v
   +--> 3  RECOMMENDATION           ranks planting zones 0-100
   |             |
   |             v
   |    4  IMPACT PREDICTION        projects 24-month cooling
   |             |
   |             v
   |            / \
   +-- NO -----<   >----- YES -->   THE IMPACT GATE:
   reject the   \ /                 is the top zone >= 1.0 C ?
   zone, rank    |
   again         v
   (max 2)   5  VISUALIZATION       polygons on the Kuwait map
                 |
                 v
             6  REPORTING           a DRAFT, nothing more
                 |
                 v
        [ GENERATE REPORT ]         <- a human presses this. never the agent
```

Three marks are worth saying out loud as you draw them:

- **The button is above the line, n8n is below it.** The browser writes a
  `queued` row through `launch_mission()`. No webhook URL exists in anything the
  browser downloads (`DECISIONS.md` D-1).
- **The backwards arrow is the only one.** Everything else goes down the page.
- **The last box is a person.** `generate_report()` is granted to
  `authenticated`, not to n8n — a report cannot exist unless a researcher clicked.

---

## 2 · The decision point: **the Impact Gate**

### The condition, both ways, in the words you say

> **Is the top-ranked zone's projected 24-month cooling at least 1.0 °C?**
>
> **Yes** → it goes forward to Visualization and lands on the map.
> **No** → that zone is **rejected**, and the run goes **back to Recommendation**
> and ranks again **without it**.

Concrete, from the demo data:

| | Zone | Score | Projected cooling | Gate |
|---|---|---|---|---|
| ranked first | Zone A — North corridor | 88/100 | **0.6 °C** | **rejected — below 1.0** |
| ranked first on the re-rank | Zone B — Central basin | 81/100 | **1.9 °C** | **accepted** |

The highest-scoring zone is not the one that ends up on the map. That is the
sentence that makes a judge believe the decision is real.

### The number, and exactly where it lives

```js
// 04-agents/agent/decision.js
var IMPACT_FLOOR_C = 1.0;   // °C of projected 24-month cooling
var MAX_RERANKS    = 2;     // how many times it may go back
var MIN_ZONE_SCORE = 40;    // a zone below this is never proposed at all
```

One file. One line. The n8n Code node runs that same file (it is concatenated
into `n8n/agent-code-node.js` by `tools/bundle.js` — n8n cannot `require` a
local file, and a hand-typed second copy would drift). The browser panel loads
it. The test asserts on it:

```bash
node 04-agents/tests/decision.test.js      # 17 checks, both branches
node 04-agents/tools/rehearse.js           # prints the run the way you draw it
```

**MIN_ZONE_SCORE is not the decision.** It is a guardrail that keeps hopeless
zones out of the list. If a judge points at it, say that — do not let the two
numbers blur into one answer.

### Why the loop ends, when someone asks

It is not the same question asked twice.

- Recommendation ranks on what was **observed** — vegetation index, surface
  temperature, access.
- Impact Prediction then **models the zone forward 24 months**. That is
  information the ranking did not have.

So a rejected zone leaves the list, and every loop has one fewer zone to
consider. `MAX_RERANKS = 2` stops it regardless. On the third refusal the run
finishes as **`stalled`** with the reason written as a refused step the
researcher can read — not as a spinner, and not as a silent success.

One more thing the code does on purpose: the reason is written with
`agent_log_step(..., p_allowed => false, p_refused_reason => '…')`, **not** only
into `mission_runs.error_note`. The browser has no grant on `error_note`
(`03-security/db/03_grants.sql`), so a reason that lives only there is a reason
the researcher never sees.

### Budget

A clean run logs 8 steps. A run with one rejection logs 9. The worst case —
two rejections and a stall — logs 11. The database refuses at 40
(`agent_log_step`: *"Step budget exhausted."*). We are nowhere near it, which is
the right place to be.

---

## 3 · The rehearsal script

Say it while you draw. Short sentences. Roughly 1 minute 40 at a normal pace —
practise until the marker and the words finish together.

> **[draw the button]**
> "This is our app. The button is in our product, not on the n8n canvas."
>
> **[arrow down to a box: QUEUED]**
> "Pressing Launch writes one row. Status: queued. That is everything the
> browser does."
>
> **[arrow down]**
> "n8n watches for queued rows and picks them up. So you can close n8n
> completely, press the button, and the row is still written."
>
> **[write 1 and 2 down the left]**
> "Step one: satellite data for the area. Step two: environmental analysis —
> vegetation and surface temperature."
>
> **[write 3]**
> "Step three: recommendation. It ranks planting zones out of a hundred."
>
> **[write 4]**
> "Step four: impact prediction. It projects how much cooling each zone would
> actually give over twenty-four months."
>
> **[draw the diamond]**
> "Here is the decision, and it is one number. Is the top zone's projected
> cooling at least one degree?"
>
> **[draw the YES arrow down]**
> "Yes: on to step five, visualization, and the zones land on the Kuwait map.
> Step six writes a draft."
>
> **[draw the NO arrow back up to 3 — slowly]**
> "No: that zone is rejected, and the run goes back to step three and ranks
> again without it."
>
> **[tap the diamond]**
> "In our demo the top zone scored eighty-eight and projected zero point six
> degrees. It was rejected. The second zone went to the map."
>
> **[tap the loop]**
> "It is not asking the same question twice. Ranking uses what we observed. The
> projection is new information the ranking never had. Every loop drops a zone."
>
> "It can go back twice. On the third refusal the run stops and says on screen
> why. Never a spinner."
>
> **[tap the last box]**
> "And the report is not the agent. A researcher presses Generate Report. The
> database only lets a signed-in human do that."
>
> "The number is one point zero degrees. It lives in one file —
> `decision.js`, `IMPACT_FLOOR_C`."

**The three sentences to have cold**, in case you get one question and no time:

1. "At least one degree of projected cooling goes forward; under one degree, the
   zone is rejected and it ranks again without it."
2. "The highest-scoring zone is not the one on the map. That is the decision
   doing something."
3. "Two re-ranks maximum, then it stops and says why."

---

## 4 · SHOULD item 7 — "why is this an agent and not a plain automation"

> It is an agent because step four's own output picks step five: when the
> top-ranked zone's projected cooling comes in under 1.0 °C, the run sends
> itself back to Recommendation instead of carrying on, so the next step is
> chosen by what was found rather than by the order we wired.

*(Word count check: the sentence does not contain "intelligent". Keep it that
way — the graded test is "does it choose its own next step", and that sentence
answers exactly that.)*

---

## 5 · Where the automation section sits (au-m2)

**It is the first section of `mission.html`, directly under the mission title,
above the map and above the findings.** `id="automation"`, so
`mission.html?id=…#automation` links straight to it.

Start, status and result are **one panel**, in that order:

```
Automation                                   [ Running ]
Six research assistants run in order. One of them can send the work back.

[ Launch Mission ]   Watching the run. Updates every 2 seconds.

 1  Satellite data              Complete
 2  Environmental analysis      Complete
 3  Recommendation · ran 2 times Complete
 4  Impact prediction           Complete
     Decision: Zone A — North corridor projects only 0.6 °C of cooling
     at 24 months, below the 1.0 °C floor. Zone rejected. Ranking again
     without it.
 5  Visualization               Complete
 6  Reporting                   Complete

4 finding(s) on the map below. Review them, then press Generate Report.
```

### Why a judge finds it with no help

1. **There is one path and it is the obvious one.** Sign in → `missions.html` is
   a list of missions → clicking a mission is the only action on that screen →
   `mission.html`. Retag built exactly four screens after login, and only one of
   them is about a single mission.
2. **It is the first thing on that screen.** Not below the map, not behind a
   tab, not in a menu. A judge who scrolls nothing at all still sees the button.
3. **The word on the panel is "Automation".** The rubric's own word. A judge
   hunting for an automation section reads the heading and stops.
4. **The button and the status are in the same box.** This is the change worth
   making, and it is a real problem in today's build: `Launch Mission` currently
   sits at the *bottom* of `mission.html`, inside "Researcher review", **below**
   the six-step strip and the map. A judge reading top-down meets six grey steps
   and no way to start them, and asks for help — which is the `au-m2` failure,
   word for word.

### The patch Retag applies — six lines added, one branch deleted

The agent code stays in `04-agents/`. Nothing of Retag's moves.

```html
<!-- 01-front-end/app/mission.html · before </body>, after js/ui.js -->
<script src="../../04-agents/agent/decision.js"></script>
<script src="../../04-agents/agent/steps.js"></script>
<script src="../../04-agents/agent/run.js"></script>
<script src="../../04-agents/app/agent-panel.js"></script>
```

In `shell()`, make this the **first** section of `#content`, above the title
block's sibling sections:

```html
<section id="automation-slot"></section>
```

And where the mission finishes loading:

```js
AgentPanel.mount({
  el: $('#automation-slot'),
  missionId: mission.id,
  source: AgentPanel.supabaseSource(sb)   // before Supabase is live:
});                                        // AgentPanel.mockSource(zones, objective)
```

Then **delete** the `if (btn.dataset.action === 'launch')` branch from
`onGenerate()`. Launching moves to the panel; the review button goes back to
doing one thing, which is the human checkpoint.

*(If the screens later move to the repo root for GitHub Pages, the four `src`
paths become `04-agents/…` with no `../../`.)*

### See it before touching Retag's file

`04-agents/app/demo.html` mounts the same panel with a local replay of
`agent/run.js`. Three buttons: one zone refused, nothing refused, everything
refused. It needs no Supabase, no n8n and no network.

---

## 6 · What is true today, and what is not yet

The honesty rule, applied to this item.

**True now, and demonstrable tonight:**

- The decision point is real code with a real threshold, and both branches are
  covered by a test that runs with `node` and no install.
- The run plan emits only the three functions n8n is granted, and only the six
  step names the database `CHECK` constraint allows. The test asserts both.
- The panel renders start, status and result, and shows the refusal text.

**Not true yet. Do not claim any of it to a judge until it is:**

- **The SQL in `03-security/db/` has not been run.** Until it is,
  `launch_mission()` does not exist and `AgentPanel.supabaseSource` has nothing
  to call. That is the single biggest dependency this item has.
- **The n8n workflow does not exist yet.** `n8n/README.md` describes five
  nodes; none of them are built. `au-m1`'s test — close n8n, press the button —
  passes only once node 2 is polling.
- **No rehearsal has broken a rule yet, so `au-m4`'s "one rule I changed" cannot
  be claimed.** That item needs a real rehearsal with a real outcome. It is a
  separate deliverable and it is not covered by this file. Do not invent it.
- The zone scores and the cooling projections are **sample values produced by
  the prototype**, not KuwaitSat-1 measurements. Say that once, early, in your
  own words. The decision comparing them is real; the inputs are not
  measurements.

**The ordering that follows from that:** run Mariam's SQL first, then wire the
n8n nodes, then swap `mockSource` for `supabaseSource`. The whiteboard answer
does not depend on any of it — it is the same drawing either way.
