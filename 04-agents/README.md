# 04 · Automation and agents — Dana

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
- `GUARDRAILS.md` — numbered, four kinds:
  **never · ask a human first · spend limits · stop and ask**
- a failure plan per node

⚠️ **Open the exported JSON before committing it.** n8n exports can contain
credential data. Keys live in the n8n credential store, never in this repo.

## What 03 · Security needs from me
- The browser **never** calls the n8n webhook — it calls `launch_mission()`
- n8n writes only through three named functions, and has no table access
- **Never** switch a node to "continue on fail" to make it green
- The mission objective is untrusted text going into a tool-using agent —
  wrap it, and flag injection attempts rather than acting on them
