# The n8n side of the run

**Owner:** 04 · Dana. Five nodes. No webhook.

> **The browser never calls n8n** (`DECISIONS.md` D-1). n8n comes to us. It
> polls for `mission_runs` rows that are `queued` and works them. That is why
> the `au-m1` test passes: close n8n completely, press **Launch Mission**, and a
> `queued` row is still written by `launch_mission()`. n8n catches up when it
> reopens.

## The five nodes

| # | Node | What it is |
|---|---|---|
| 1 | **Schedule Trigger** | every 15 seconds |
| 2 | **HTTP Request — claim a run** | `GET {{$env.SUPABASE_URL}}/rest/v1/mission_runs?status=eq.queued&limit=1` |
| 3 | **Code — "Plan the run"** | paste `agent-code-node.js` whole |
| 4 | **HTTP Request — execute** | `POST {{$env.SUPABASE_URL}}/rest/v1/rpc/{{ $json.rpc }}`, body `{{ $json.args }}`, *Execute Once* off so it runs per item |
| 5 | **NoOp** | so a finished run is visibly finished on the canvas |

Node 2 is the one read n8n makes. Everything it *writes* goes through node 4,
and node 4 can only ever hit `/rest/v1/rpc/…` because node 3 only ever emits
three names: `agent_log_step`, `agent_write_result`, `agent_finish_run`.

> **If you ever see `/rest/v1/agent_steps` in this workflow, the workflow is
> wrong, not the grants.** n8n has zero table privileges
> (`03-security/db/05_views_rpc.sql`). A table URL returns 401 and the run dies
> halfway, which looks exactly like "the database is broken".

## Credentials

Header Auth, stored in the **n8n credential store**, never in this repo:

```
apikey:        <service_role key>
Authorization: Bearer <service_role key>
```

`.env.example` says the same thing: the secret / service-role key lives in n8n
and nowhere else. It bypasses row level security by definition — that is why
the browser must never hold it, and why the three functions re-read the owner
from the mission row instead of trusting anything n8n sends.

## `agent-code-node.js` is generated

Do not edit it. Edit `../agent/decision.js` and run:

```bash
node 04-agents/tools/bundle.js
```

An n8n Code node cannot `require` a local file, so the three agent files are
concatenated into one paste. If you hand-edit the bundle, the threshold exists
in two places and drifts, and "where does the number live" stops having one
answer.

## Never switch a node to "continue on fail"

A green canvas is not the goal. A node that fails must fail, so
`agent_finish_run(run, 'failed', …)` runs and the researcher sees the word
**Failed** with a reason. Making the canvas green by ignoring errors is how a
run ends as an endless spinner on the demo screen.
