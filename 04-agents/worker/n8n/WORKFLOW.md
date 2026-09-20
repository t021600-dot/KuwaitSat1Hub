# Building the workflow in n8n — node by node

**Engine decision:** `docs/DECISION-A1-ENGINE.md` (n8n Cloud, with the Edge Function in
`worker/edge/` as the named fallback).
**Blocked until:** 03 · Security runs `db/REQUEST-TO-03-agent_claim_run.sql`. Without
`agent_claim_run()` the worker cannot see a queued run or read an objective — every table
privilege is revoked from `service_role`.

> **It must be n8n Cloud and the workflow must be Active.** If n8n runs on a laptop, the
> judge's own test ("close n8n completely, press the button in your app") kills the run and
> you fail your own demo. Check the trial expiry date **before** you build.

---

## 1 · Credentials — once, and never in this repo

n8n → **Credentials → New → Header Auth**

| Field | Value |
|---|---|
| Name | `Supabase service role` |
| Header name | `apikey` |
| Header value | *the Supabase **secret / service-role** key* |

Add a second header on every HTTP node: `Authorization: Bearer <same key>`, and
`Content-Type: application/json`.

The key lives here and nowhere else. Not in `js/config.js`, not in a commit, not in chat.
If it ever lands in the repo, tell 03 immediately — the file has to be deleted **and the key
rotated**, because the value stays in the history.

Base URL for every call: `https://<project-ref>.supabase.co/rest/v1/rpc/<function>`
POST, JSON body. **A `/rest/v1/<table>` URL anywhere in this workflow is a security finding.**

## 2 · The nodes

| # | Node | Type | What it does |
|---|---|---|---|
| 1 | **Mission queued** | Webhook (POST) | Woken by a Supabase Database Webhook on insert into `mission_runs`. Carries no trust: see §3. |
| 2 | **Claim a run** | HTTP Request | `POST /rpc/agent_claim_run` with an empty body `{}`. Returns 0 or 1 row. |
| 3 | **Anything to do?** | IF | `{{ $json.run_id }}` *is not empty*. False → **No Operation**, the run ends quietly. |
| 4 | **Analyse the area** | Code | Paste `worker/agent-run.js` (everything except its last `export` line), then the tail in §4. Pure computation — no HTTP. |
| 5 | **Enough usable evidence?** | IF | `{{ $json.proceed }}` *is true*. **THIS IS THE DECISION POINT.** |
| 6a | **Write the findings** | Code | true branch. Posts `calls_common` then `calls_next` in order (§4). |
| 7a | **Finish: complete** | HTTP Request | `POST /rpc/agent_finish_run` with `{{ $json.finish }}` → mission goes to **review**. |
| 6b | **Refuse and explain** | Code | false branch. Same posting loop, different calls. |
| 7b | **Finish: stalled** | HTTP Request | `POST /rpc/agent_finish_run` with `{{ $json.finish }}` → the app shows *Stopped* and why. |

Nodes 6a and 6b run the same eight lines; only the data differs. That is on purpose — the
decision is made once, in node 4's `decide()`, and node 5 only routes it.

## 3 · Why node 2 takes no arguments

An n8n webhook URL is reachable by anyone who learns it. If the workflow took a run id from
its caller, whoever has the URL could name any run. `agent_claim_run()` takes nothing: it
claims the oldest queued run and returns it. The worst a forged ping can do is start a run a
researcher already queued from inside our app.

Set the Supabase Database Webhook to fire on **INSERT on `public.mission_runs`** with the
n8n webhook URL and a shared secret header. Two queued runs and two pings still result in
two claims — `for update skip locked` stops both pings claiming the same row.

## 4 · The code to paste

**Node 4 tail** — after the contents of `worker/agent-run.js`:

```js
// n8n Code node · Run Once for All Items
const claim = $input.first().json;
return [{ json: analyse(claim) }];
```

**Nodes 6a and 6b** — identical text in both:

```js
// n8n Code node · Run Once for All Items
const data = $input.first().json;
const base = 'https://<project-ref>.supabase.co/rest/v1/rpc/';
const calls = (data.calls_common || []).concat(data.calls_next || []);
for (const c of calls) {
  // the key is never in this code: httpHeaderAuth names the credential
  // you made in §1, and n8n adds the header itself.
  await this.helpers.httpRequestWithAuthentication.call(this, 'httpHeaderAuth', {
    method: 'POST', url: base + c.fn, body: c.body, json: true,
    headers: { 'Content-Type': 'application/json' }
  });
}
return [{ json: { run_id: data.run_id, posted: calls.length, finish: data.finish } }];
```

If `this.helpers.httpRequest` is unavailable in your n8n version, replace each Code node with
a **Split Out** node on `calls_common` / `calls_next` feeding one HTTP Request node — more
nodes on the canvas, same result.

## 5 · The v2 pattern for guardrail G-4

Do not paste this until the rehearsal in `GUARDRAILS.md` has actually refused a legitimate
objective and you have written the result down. Then replace the last entry of
`INJECTION_PATTERNS_V1` in `worker/agent-run.js` with:

```js
// G-4 v2 — changed after the rehearsal on <date>. Imperative phrasing
// about the research area is normal researcher English; an objective that
// names the system, its rules, or another account is not.
/\b(show|list|give|tell)\s+me\s+(all|every|each)\s+(mission|report|user|researcher|account|row|table|record)/i
```

## 6 · A failure plan for every node — §7 rule 6 of the capstone guide

**No node is ever set to "continue on fail".** A silent continue passes nothing to the next
step and tells nobody; a green run that did nothing is worse than a red one.

| Node | How it fails | The plan |
|---|---|---|
| 1 Webhook | Never fires | The run sits `queued`; the app says *Queued — waiting for a worker*, then *stopped responding* after 3 minutes. Visible, not a spinner. |
| 2 Claim | 401 / bad key | Stop. Nothing was claimed, the row stays `queued`, relaunch works after the key is fixed. |
| 3 IF | Nothing queued | No Operation. Not an error. |
| 4 Analyse | Malformed area | `bboxOf()` returns null → the G-3 refusal path, written as a finding the researcher can read. |
| 6a/6b post | `Step budget exhausted.` / `Run is not active.` | Stop, then node 7 closes the run `failed` with the database's own sentence. Never retry a write that a guardrail refused. |
| 7 Finish | Network error | Retry **twice**, 5 s apart (n8n node setting). If it still fails, the app's 3-minute stall message is the backstop. |

## 7 · Proving au-m1 to a judge

1. Open the n8n editor, show the canvas, **close the tab**.
2. In the app, press **Launch Mission**.
3. The steps tick. The findings appear. The map draws.
4. Open the browser's Network tab and search it for `n8n` — there is no such request,
   because the browser called `rpc/launch_mission` and nothing else.

Step 4 is worth doing unasked. `au-m1` is about where the trigger lives, and the Network tab
is the only place that answer can be checked rather than claimed.
