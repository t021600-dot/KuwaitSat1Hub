# 🗄️ What one row of each table is

**Owner:** 02 · Back end (Hind) · **Capstone item:** `be-m3`
*The judge's test, word for word: "any member can say what one row of any table is, in one sentence."*

---

## How to use this page

Read the **bold sentence** out loud. That is the answer. Everything under it is
there for the follow-up question, not for the first one.

There are eight tables. Four of them are about a piece of research
(`missions`, `mission_runs`, `agent_steps`, `results`), two are about people
(`profiles`, `mission_collaborators`), one is the human sign-off (`reports`),
and one is the switch we can throw if something goes wrong (`app_settings`).

**Do not run `select *` on any of these tables.** The grants are column-level,
so `select *` fails with *permission denied for column …*. That is deliberate,
not a bug to work around. Read the views — `my_missions`, `my_mission_results`,
`my_agent_steps` — or name the columns you want.
(`03-security/db/03_grants.sql`)

---

## The one idea behind all eight

Only `missions` knows who owns anything. It holds `researcher_id`. Every other
research table owns nothing itself — it **walks back to `missions`** to find out
whose row it is:

```
agent_steps ──run_id──▶ mission_runs ──mission_id──▶ missions ──researcher_id──▶ the researcher
results  ─────────────── mission_id ───────────────▶ missions
reports  ─────────────── mission_id ───────────────▶ missions
```

Say that chain out loud once before the demo. It is the answer to *"how does the
database know this agent step is not mine?"*, and it is the reason
`can_read_run()` in `03-security/db/02_helpers.sql` has to exist at all.

---

## 1 · `missions`

> **One row is one research question a researcher asked about one area of the
> Kuwait map.**

| | |
|---|---|
| **Owner column** | `researcher_id` — **the only owner column in the whole database** |
| **Reaches its owner** | directly; it *is* the owning row |
| **Written by** | the researcher, through the New Mission form — three columns only: `title`, `objective`, `area_geojson` |

`area_geojson` is a GeoJSON Polygon and it must sit inside Kuwait
(46.5–48.8 E, 28.5–30.1 N) or the `kuwait_area_ok()` CHECK refuses the row.
`status` walks `draft → queued → review → complete` (or `failed`), and the
browser can never set it — there is no UPDATE grant on this table at all.
`injection_flag` is raised by the agent when the objective contained an
*instruction* rather than a research question, and it is never lowered again.

---

## 2 · `mission_runs`

> **One row is one press of the Launch Mission button — one attempt by the
> agents to answer that question.**

| | |
|---|---|
| **Owner column** | none |
| **Reaches its owner** | `mission_id` → `missions.researcher_id` |
| **Written by** | `launch_mission()` creates it; the worker moves it on through `claim_next_run()` and `agent_finish_run()` |

This is the table `be-m5` is about: *what started, when, its status, what came
out*. `status` runs `queued → running → complete` (or `failed`, or `stalled`
when the sweeper finds a run that stopped logging).

One mission can have several runs — a second Launch Mission press writes a
second row, it does not overwrite the first. That is what makes the log worth
reading.

`n8n_execution_id`, `error_note` and `claimed_at` exist but are **internal**: no
browser role holds a grant on them, so they never reach a screen.

---

## 3 · `agent_steps`

> **One row is one thing one agent did — including the things it asked to do and
> was refused.**

| | |
|---|---|
| **Owner column** | none, deliberately |
| **Reaches its owner** | `run_id` → `mission_runs.mission_id` → `missions.researcher_id` |
| **Written by** | `agent_log_step()`, called by n8n. Never by the browser. |

`step_name` is one of exactly six values, fixed in the schema:
`satellite_data`, `environmental_analysis`, `recommendation`,
`impact_prediction`, `visualization`, `reporting`. Invent a seventh and the
insert throws — the set of things the agent may *claim to have done* is pinned
in the database, not in the workflow.

**The refused rows are the point of this table.** `allowed = false` plus a
`refused_reason` is the written evidence that the AI asked for something outside
its approved list and the system said no. A guardrail nobody can point at is a
claim; a refusal row is a record.

`raw_prompt`, `raw_response` and `confidence` are internal and ungranted — the
researcher sees the step, not the plumbing.

---

## 4 · `results`

> **One row is one finding the agents produced — a place on the map, a number, a
> map layer, or a paragraph.**

| | |
|---|---|
| **Owner column** | none |
| **Reaches its owner** | `mission_id` → `missions.researcher_id` (`run_id` records which run produced it) |
| **Written by** | `agent_write_result()`, called by n8n |

`kind` is one of `site`, `metric`, `map_layer`, `narrative`. `geometry` is the
jsonb the Kuwait map draws from — **there is no file storage anywhere in this
project** (`DECISIONS.md` D-2); the shapes live in this column.

`status` is the gate: only `complete` rows are findings. A half-written agent
output stays `draft` and never reaches the screen, because the
`my_mission_results` view filters on it.

`source_ref` — the satellite archive path — is internal and ungranted.

---

## 5 · `reports`

> **One row is a report a human read and approved — it exists only because a
> researcher pressed Generate Report.**

| | |
|---|---|
| **Owner column** | `approved_by` — the human who pressed the button |
| **Reaches its owner** | `mission_id` → `missions.researcher_id`; `approved_by` names the approver separately |
| **Written by** | `generate_report()` only, and only for a mission the caller owns |

`body_md` is the report text. **It is rendered with `textContent` — never
`innerHTML`, never as markdown** (`DECISIONS.md` D-2). The text passed through
an AI, and an AI's output is untrusted input like any other.

`approved_by` has no default, on purpose. A report with no human attached to it
would defeat the only thing this table exists for: *the agent proposes, a person
approves.*

---

## 6 · `profiles`

> **One row is one researcher's name and organisation — our half of their
> account.**

| | |
|---|---|
| **Owner column** | `user_id` |
| **Reaches its owner** | directly; `user_id` *is* the account id from `auth.users` |
| **Written by** | the researcher, for their own row and no other |

**There is no password column in this table, and no password column anywhere in
`public`.** Supabase Auth holds the password hash in `auth.users`; we never
copy it, read it, or display it. That sentence is the whole of `se-m3`.

`user_id` is absent from the UPDATE grant, so nobody can re-point their profile
at somebody else's account. And no policy lets you read another researcher's
profile — there is deliberately no directory of who has an account here.

---

## 7 · `mission_collaborators`

> **One row is one researcher being explicitly invited onto one mission by its
> owner.**

| | |
|---|---|
| **Owner column** | `granted_by` is the owner who issued the invite; `user_id` is the guest |
| **Reaches its owner** | `mission_id` → `missions.researcher_id` |
| **Written by** | `share_mission()` only, and only by the mission's owner |

`role` is `viewer` or `editor`. Sharing is a **written row you can point at** —
never a guess, never a role string kept in the browser. If the row is not here,
the access does not exist.

> **For Thursday: leave this table empty.** The `se-m1` test is *"account B
> cannot see account A's mission"*. One row in here makes that test fail
> correctly, and on a projector a correct failure looks exactly like a leak.

---

## 8 · `app_settings`

> **The single row is the platform's own settings: the kill switch, and how many
> missions one researcher may start per hour and per day.**

| | |
|---|---|
| **Owner column** | none — it belongs to the platform, not to a person |
| **Reaches its owner** | it does not; it is not about a researcher |
| **Written by** | nobody, through no screen. You change it by hand in the Supabase SQL editor. |

There is exactly one row, forced by `id boolean primary key check (id)`.

**No browser role has any grant on this table — not even `select`.** RLS on, no
policy, and no grant means only the SECURITY DEFINER functions and the SQL
editor can read it. That is the point: a rate limit the client can read is a
rate limit the client can plan around.

`accepting_new_missions = false` turns the whole platform off in one statement,
with no deploy and no code change.

---

## The three views, one line each

| View | One row is |
|---|---|
| `my_missions` | one mission **you** can see — yours, or one shared with you — with `is_owner` and a count of its complete findings |
| `my_mission_results` | one complete finding, with the body already cut to a 240-character preview *inside the database* |
| `my_agent_steps` | one agent step, without the prompt, the response, or the confidence number |

All three are created `with (security_invoker = on)`, which means row level
security still applies when you read through them. A view created without that
setting runs as its *owner* and hands every row to every account — and that one
missing setting is the most common way a team with "RLS on" still fails the
two-window test.

---

## If somebody asks a question this page does not answer

The schema itself is the source of truth and it is readable:
[`../03-security/db/01_tables_rls.sql`](../03-security/db/01_tables_rls.sql).
Every column in it carries a comment saying why it is there. Do not answer from
memory on Thursday — answer from the file, and then fix this page.
