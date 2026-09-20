# RLS TEST MATRIX — every line here is expected to **FAIL**

**Owner:** 03 · Security · **Run:** Monday night, then again Tuesday on the live URL
**Proves:** `se-m1` — "Row level security is on; account B cannot read account A's rows"

---

## How to run it, and the rule that makes it worth anything

Every check runs **in the browser console of a private window**, using the app's
own session (`window.sb`). Never through a screen.

> **Real PASS** · the check goes to the API, not to our page. 0 rows, or a
> permission error.
> **Fake PASS** · the row *did* come back and our JavaScript chose not to draw it.

That is why nothing in this table is tested by clicking.

**Three setup rules or the whole matrix is worthless:**

1. **Private windows.** Two normal tabs share one session and account B silently
   becomes account A. Every check then passes for the wrong reason.
2. **Check who you are first.** Run `(await sb.auth.getUser()).data.user.email`
   before anything. A signed-out window produces *almost the same output as a
   perfect pass* — zeros everywhere. A zero from nobody proves nothing.
3. **Never use the secret / service-role key.** It bypasses RLS and every single
   test passes for the wrong reason.

A check that errors because you typed the table name wrong is **not** a pass.
Read the error text before you tick the box.

---

## The matrix

Accounts: **A** = `researcher-a@ksat.demo` · **B** = `researcher-b@ksat.demo`
A owns at least one launched, completed mission. B owns at least two of their own.

| # | What we try | Signed in as | Expected | Pass? |
|---|---|---|---|---|
| 1 | `sb.from('missions').select('*')` | **B** | permission denied for column (blanket select is revoked) | ☐ |
| 2 | `sb.from('missions').select('id,title').eq('id', A_MISSION)` | **B** | **0 rows** | ☐ |
| 3 | `sb.from('my_missions').select('id,title')` | **B** | only B's own — never A's | ☐ |
| 4 | `sb.from('mission_runs').select('id,status')` | **B** | 0 rows | ☐ |
| 5 | `sb.from('agent_steps').select('id,step_name')` | **B** | 0 rows | ☐ |
| 6 | `sb.from('results').select('id,title')` | **B** | 0 rows | ☐ |
| 7 | `sb.from('reports').select('id,body_md')` | **B** | 0 rows | ☐ |
| 8 | `sb.from('missions').select('researcher_id')` then compare to A | **B** | 0 rows — cannot enumerate owners | ☐ |
| 9 | `sb.from('missions').update({title:'x'}).eq('id', A_MISSION)` | **B** | 0 rows updated, or permission denied | ☐ |
| 10 | `sb.from('missions').update({title:'x'}).eq('researcher_id', <B own>)` | **B** | **0 rows** — no update grant for anyone | ☐ |
| 11 | `sb.from('missions').delete().eq('id', <B own>)` | **B** | 0 rows — no delete grant for anyone | ☐ |
| 12 | `sb.from('missions').insert({title:'x',objective:'…',area_geojson:{…},researcher_id:'<A uuid>'})` | **B** | refused — `researcher_id` is not in the insert grant | ☐ |
| 13 | `sb.from('agent_steps').insert({run_id:'…',step_name:'reporting'})` | **B** | refused — the audit log is append-only from the agent side | ☐ |
| 14 | `sb.from('results').insert({…})` | **B** | refused — only n8n, through a function | ☐ |
| 15 | `sb.from('results').select('id').eq('status','draft')` | **A** *(the owner!)* | **0 rows** — the status gate hides in-flight drafts | ☐ |
| 16 | `sb.from('agent_steps').select('raw_prompt')` | **A** *(the owner!)* | permission denied for column | ☐ |
| 17 | `sb.from('results').select('source_ref')` | **A** *(the owner!)* | permission denied — the archive path is internal | ☐ |
| 18 | `sb.from('mission_runs').select('n8n_execution_id,error_note')` | **A** | permission denied for column | ☐ |
| 19 | `sb.from('profiles').select('user_id,display_name')` | **B** | only B's own row — no researcher directory | ☐ |
| 20 | `sb.from('app_settings').select('*')` | **A or B** | permission denied — the kill switch is invisible | ☐ |
| 21 | `sb.rpc('launch_mission', { p_mission_id: A_MISSION })` | **B** | error `Mission not found.` | ☐ |
| 22 | `sb.rpc('generate_report', { p_mission_id: A_MISSION, p_body_md: '…' })` | **B** | error `Mission not found.` | ☐ |
| 23 | `sb.rpc('agent_log_step', {...})` | **A or B** | permission denied — granted to `service_role` only | ☐ |
| 24 | everything in `two-window-check.js` | **signed out**, private window | permission denied / 0 everywhere | ☐ |
| 25 | open a mission URL directly, e.g. `/mission.html?id=<A_MISSION>` | **B** | an empty state ("Mission not found"), not an error page, not a blank screen | ☐ |

### The ones that catch real bugs

Rows **15–18** are the interesting ones and they are easy to skip, because they
run as **the owner**. A model asked to write this matrix finds the B-side tests
easy and the owner-side limits hard, because those live in a *column grant* and
a *status gate* rather than a policy. Ask for them explicitly.

Row **10** surprises people: **A cannot update their own mission either.** That
is on purpose — a mission that can be edited after launching makes the run log
worthless as an audit trail. If a judge asks, that is the answer.

Row **24** is the one that proves the publishable key in `config.js` is safe to
be public.

---

## The verdict lines

Fill these in Monday night and again Tuesday. They go in the evidence folder.

```
Run 1 — Monday __ / __ , local
  Signed in as: ______________________  (check this FIRST)
  Rows 1-25:  ___ pass  ___ fail
  Failures and what I changed:


Run 2 — Tuesday __ / __ , the LIVE public URL, borrowed laptop
  Signed in as: ______________________
  Rows 1-25:  ___ pass  ___ fail
  Failures and what I changed:
```

**If a check that was supposed to FAIL comes back with rows**, ask in this order:

1. Am I actually signed in as the second account, or did the session collapse
   into account A? (`(await sb.auth.getUser()).data.user.email`)
2. Is the key I used a **service-role key**, which bypasses RLS?
3. Does a permissive policy elsewhere let this through? Run query 2 in
   `sql/99-verify.sql` and look for `roles = {public}` or `qual = true`.
4. Is there a **view without `security_invoker`** in the path? Run query 4 in
   `sql/99-verify.sql`. This is the one that hides best.
