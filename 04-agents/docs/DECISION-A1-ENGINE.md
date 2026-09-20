# A-1 · Does the rubric require n8n, or only that the trigger lives in our app?

**Owner:** 04 · Dana · **Written:** Sunday 20 September 2026 · **Status: DECIDED — n8n Cloud**
**Decided against:** Supabase Edge Function (kept as the named fallback), pure client-side (cut).

A decision is made when it is written here and acknowledged in chat. Send section 4 to the team.

---

## 1 · What the rubric literally says, and what it assumes

I read `capstone-general/CAPSTONE-GUIDE.md` line by line. **n8n is named three times in
the whole document**, and in all three it is the place the judge must *not* have to be:

| Where | The words |
|---|---|
| `au-m1` item | "The automation is triggered from your own front end, **not the n8n canvas**" |
| `au-m1` test | "**Close n8n completely**, press the button in your app" |
| `au-m6` item | "A user who never opens n8n or the database sees the outcome in the app" |
| §9 "done" | "The automation starts from a button in your own app, **with n8n closed**" |

There is **no item that says "use n8n"**. The other four automation items never mention a
tool at all: a section in the app (`au-m2`), three steps and a decision (`au-m3`), a
numbered guardrail list (`au-m4`), an approved tool with a stated limit (`au-m5`). The
guide's own §7 rule 6 says "every **node** that can fail needs a failure plan… the trap is
the silent **continue**" — that is n8n vocabulary, which tells you the document was written
by someone expecting n8n. Vocabulary is not a requirement.

**So the literal answer to the question: no. The rubric requires the trigger to live in our
app. It does not require n8n.**

**Now the part that matters more than the literal answer.** The `au-m1` test is written as
an *action taken against a named product*. Its whole job is to stop you pressing "Execute
workflow" on a canvas and calling that a trigger. If there is no n8n, there is nothing to
close, and the test returns **nothing** — not a pass, not a fail. You would be satisfying
the item in substance while having no demonstration to offer, unless you propose the
generalised version yourself and the judge accepts the substitution.

All 28 MUST items are pass/fail for the whole team. `au-m1` is the only item in the entire
document phrased as an action against a named product. **That is not an item to be
interesting on.**

---

## 2 · The three options actually available to this team

**First, what is dead.** The brief I was given assumes Next.js 15 route handlers, Supabase
Realtime and a nightly Vercel cron, built on a scaffold from another project. **None of it
exists here.** This repo is plain static HTML, CSS and JavaScript on GitHub Pages: no build
step, no framework, no server, no ability to set an HTTP header. There is no Next.js to put
a route handler in and no Vercel to run a cron on. Anything that must run while the
researcher's tab is closed has to run somewhere else. That leaves three somewheres.

**Second, what all three share.** D-1 is LOCKED: the browser calls `launch_mission()`, which
writes a `mission_runs` row with status `queued`. The worker picks that row up and calls
three named functions. **Choosing the engine is choosing the worker, not the architecture** —
the front end, the SQL and the guardrails are identical in options A and B. That is worth
saying out loud to a judge, because it means the choice is reversible and it means the
security model does not depend on it.

### Option A · n8n Cloud

The workflow lives on n8n's servers and is **Active**. It picks up queued runs and calls the
Supabase RPC endpoints with a key held in n8n's credential store.

**Risk**

1. **It must be n8n *Cloud*, not n8n on a laptop.** Self-hosted local n8n inverts the test:
   close n8n completely and the run never happens, so you fail your own demo. You would have
   to close only a browser tab and explain the difference on stage, which reads as a dodge.
   Docker is not installed on the build machine either.
2. **The trial.** n8n Cloud's free trial is time-limited. The course taught n8n on Night 9,
   so a trial started then may lapse on or about Demo Day. **Check the expiry date tonight,
   before you build anything.** If it dies before Thursday, this option dies with it.
3. **A fourth system on venue wifi**, and a key that leaves our own accounts. The key part is
   already designed for — `03_grants.sql` revokes every table privilege from `service_role`,
   so the key can call three functions and nothing else — but it is still a dependency you
   do not control at 18:00 on Thursday.
4. **The silent "continue on fail" trap**: a node set to continue turns a broken run green.
   §7 rule 6 names it, and `04-agents/README.md` already forbids it.

### Option B · Supabase Edge Function

The same worker, in Deno, deployed from the Supabase dashboard. Triggered by a Database
Webhook on insert into `mission_runs`, or by `pg_cron` every few seconds.

**Risk**

1. **You cannot run the judge's sentence.** You substitute "close the Supabase dashboard and
   every tab except our app" — which is *exactly* `au-m6`'s own test, so it is defensible,
   but you are asking for a substitution on a pass/fail item while standing in front of the
   panel.
2. **Deno and TypeScript**, which nobody on this team has written, on a three-night build.
3. It gives up the free `au-m3` artefact: an n8n canvas is a drawing of the process that
   matches the whiteboard one-to-one.

**Everything else about it is better than A**: one vendor, the service-role key never leaves
Supabase, no third-party on the night, no trial, and no Docker.

### Option C · Pure client-side (the browser runs the steps)

**Cut. Do not build this, not even as a fallback.** Two reasons:

1. **It requires re-opening a locked security decision.** The three `agent_*` functions are
   revoked from `authenticated`, and they do **not** check who owns the run — they were only
   ever meant for `service_role`. Granting them to the browser hands every signed-in user the
   ability to write steps and findings onto any run id they can name. That is a real hole,
   opened on Mariam's Tuesday, to buy a worse story.
2. **"What runs when nobody is watching?" would be answered "nothing."** §2 of the guide
   names that shape — *the agent is a form in a costume* — as one of the four that cannot
   reach the bar. Judges ask this. They ask it because it is the cheap way to fake area 04.

---

## 3 · The recommendation, and why

**Use n8n Cloud.** Conditional on one thing you must check tonight: the trial is alive
through Thursday 24 September, and the workflow is Active on n8n's servers, not on a laptop.

The reasoning is short, because the engineering difference is small and the demo difference
is not:

- Options A and B build the *same* worker against the *same* four functions. The only thing
  the choice buys is **which test you get to run in front of the judge.** n8n lets you run
  the judge's own sentence, word for word, with nothing to explain.
- All 28 MUSTs are pass/fail for all four of us. Spending stage time arguing that you are
  *technically* satisfying `au-m1` is a bad trade against thirty minutes of wiring.
- It is the tool the course taught. Three nights is not the week to learn Deno.
- The canvas doubles as the `au-m3` artefact and the failure-plan-per-node artefact.

**What makes this safe to choose:** the worker logic is in `agent/decision.js`,
`agent/steps.js`, `agent/run.js` and `n8n/phases.js` — pure, with no network calls and no
secrets in any of them. `tools/build-workflow.js` generates them into the n8n Code nodes;
the Edge fallback in `worker/edge/index.ts` imports the same four files and does the HTTP
itself. **If the trial is dead tonight, or n8n breaks on Tuesday, you switch engines by
copying four files and you change nothing else** — not the button, not the SQL, not the
guardrails, not the demo script.

*(There was briefly a second copy of this logic in `worker/agent-run.js`, written by a
parallel session. It refused the whole run on an injection instead of flagging it and
answering the research question — the opposite of guardrail rule 13 — so the two engines
would have behaved differently in front of a judge. It has been deleted.)*

**The one thing that blocks both A and B, tonight:** `03_grants.sql` revokes every table
privilege from `service_role`, so the worker cannot read `mission_runs` or `missions`. It
cannot find a queued run and cannot learn the objective or the area. It needs a fourth
function — `03_grants.sql` says so itself: *"If n8n needs a fourth, it gets a fourth
FUNCTION, never a table grant."* That fourth function now exists: `claim_next_run()`, with `sweep_stalled_runs()` beside
it, in `03-security/db/08_agent_claim.sql` — reviewed by 03 and living in their folder, so
it runs with `01`→`06` rather than separately. **Nothing in area 04 runs until somebody
executes it.** *(04's original ask, `04-agents/db/REQUEST-TO-03-agent_claim_run.sql`, had
two bugs the answer fixed — it keyed the sweeper off `started_at`, which is set when the
run is QUEUED, so the `au-m1` test would have stalled its own run. The request file has
been deleted so nobody runs the older draft.)*

**Cut list for this decision** (a judge who asks what you left out wants answers, not a shrug):
Vercel cron · Next.js route handlers · Supabase Realtime · a browser-side agent loop ·
a second workflow on a clock.

---

## 4 · The sentence to a judge who asks why

> "We run the workflow in n8n because the run has to keep going when every one of our tabs
> is closed — but n8n has no way into our app: the button calls a database function that
> queues the run, n8n picks up work it did not start, with a key that can call three named
> functions and nothing else, and everything the researcher sees is read back out of our own
> database."

Short version, if they only want one clause: **"n8n does the work; our app owns the
trigger, and n8n never gets an address inside our page."**
