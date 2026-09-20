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

The n8n workflow, the guardrail list, and notes on the six agent steps.

## My MUST items
- `au-m1` the automation is triggered from our own front end, not the n8n canvas
- `au-m2` the front end has an automation section: start, status, result
- `au-m3` at least three steps and one decision point
- `au-m4` a written guardrail list with numbers, and one rule changed because
  a rehearsal broke it
- `au-m5` at least one approved tool, and we can say what it may and may not do
- `au-m6` a user who never opens n8n sees the outcome in the app

## What goes in this folder
- the exported workflow JSON (n8n → ⋯ → Download)
- **[`GUARDRAILS.md`](GUARDRAILS.md) — written.** Sixteen numbered rules in four
  kinds: **never · ask a human first · spend limits · stop and ask** — plus the
  approved tool list for `au-m5` and the rehearsal that `au-m4` needs.
  **Read it aloud; it is written to be spoken.**
  ⚠️ The rehearsal in its section 4 has **not been run yet**, so the "one rule
  changed" half of `au-m4` cannot be claimed until it has.
- **[`docs/DEMO-RUNBOOK.md`](docs/DEMO-RUNBOOK.md) — written.** Demo night,
  beat by beat: the pre-demo checklist, what to click, what to say word for
  word, the deliberate failure (SHOULD 9), the live break test (COULD 14), and
  what to say when something unplanned fails. Its section 1 is executable:
  `node tools/preflight.js` reads the repo and prints which claims are still
  true. ⚠️ Its section "what is true tonight" lists four things that do not
  exist yet — read that first.
- a failure plan per node

⚠️ **Open the exported JSON before committing it.** n8n exports can contain
credential data. Keys live in the n8n credential store, never in this repo.

## What 03 · Security needs from me
- The browser **never** calls the n8n webhook — it calls `launch_mission()`
- n8n writes only through three named functions, and has no table access
- **Never** switch a node to "continue on fail" to make it green
- The mission objective is untrusted text going into a tool-using agent —
  wrap it, and flag injection attempts rather than acting on them
