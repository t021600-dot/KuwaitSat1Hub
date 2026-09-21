# Evidence · what an outsider gets when they defeat the tier

**Owner:** 03 · Security · **Run:** Monday 21 September 2026
**Where:** <https://kuwait-sat1-hub.vercel.app/> — the live site, signed **out**
**Method:** browser console on the real page. The tier was **deliberately
undone first**, the way anyone with DevTools would undo it.

---

## Why this test, and not a screenshot of hidden panels

The site has two tiers: a visitor sees the record, a signed-in researcher
sees the instruments. **The tier is product framing. It is not a security
control, and we do not present it as one.** Every demo constant in the
page ships to every visitor and always did, and the tier is one attribute
on `<html>` — four seconds to flip.

So the honest test is not *"is the panel hidden?"* It is: **flip the
attribute, open the panel, and ask the database directly.**

```js
document.documentElement.setAttribute('data-ksat-tier','insider');
document.getElementById('console').style.display = 'block';
// ...then query everything.
```

---

## Result — thirteen doors, thirteen refusals

| What a signed-out visitor asked for | Answer |
|---|---|
| `missions` | **REFUSED** — permission denied for table missions |
| `mission_runs` | **REFUSED** — permission denied |
| `agent_steps` | **REFUSED** — permission denied |
| `results` | **REFUSED** — permission denied |
| `reports` | **REFUSED** — permission denied |
| `profiles` | **REFUSED** — permission denied |
| `mission_collaborators` | **REFUSED** — permission denied |
| `app_settings` | **REFUSED** — permission denied |
| `my_missions` *(view)* | **REFUSED** — permission denied for view |
| `my_agent_steps` *(view)* | **REFUSED** — permission denied for view |
| `my_mission_results` *(view)* | **REFUSED** — permission denied for view |
| `rpc/generate_report` | **REFUSED** — permission denied for function |
| Raw `GET /rest/v1/missions?select=*` with the publishable key | **HTTP 401** `42501` |

**Nothing returned a row. Nothing returned an empty array that JavaScript
had filtered — the requests were refused at the database.**

That distinction is the whole point. An empty panel proves only that the
page chose not to draw something. `permission denied for table missions`
proves the page was never given it.

---

## Why it is refused, in one line

`anon` holds **zero table grants and zero function grants**. RLS decides
*which rows* a role may see; **grants decide whether the role may ask the
question at all** — and `anon` may not. Both are needed, and a project
that sets policies while leaving the default grants in place has neither.

The three `my_*` views are `security_invoker = on`, verified live. That
matters more than it looks: their owner is `postgres`, which **bypasses
RLS**. With `security_invoker` off, every researcher would read every
row through them. It is on, and `service_role` holds no access to them
either.

---

## What the visitor legitimately does get

Fourteen public sections, unchanged and complete: the mission record, the
real KuwaitSat-1 facts, the imagery story, the governance and provenance
pages, the team, and every source. No login wall on arrival — `sh-m1`
holds; a stranger opening the URL is never asked to sign in to read.

The ten instrument surfaces are replaced by named invitations rather than
blank space — each one states the three real instruments behind it, and
carries the same footnote in English and Arabic:

> *Nothing here is hidden for secrecy. This is where a signed-in
> researcher's own missions, runs and results are drawn, and those live in
> the database behind row-level security — they were never in this page.*

---

## Said out loud to a judge

> "Don't take the hidden panels as the security story — flip the attribute
> in DevTools, it takes four seconds, and we did it for you. What you get
> is thirteen refusals, because the anonymous role holds no grant on any
> table, any view, or any function. The page hiding things is product
> design. The database refusing them is the control."
