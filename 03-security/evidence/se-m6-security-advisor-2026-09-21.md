# se-m6 - the AI security audit, run for real

**Tool:** Supabase Security Advisor (the platform's own database linter)
**Project:** `kqboenytmzagdiweqygl` · **Run:** Monday 21 September 2026, 00:40
**Owner:** 03 · Security

Not a hypothetical review. This is the vendor's linter run against our live
database, before and after, with the fixes in the migration history.

## BEFORE - 2 WARN findings at `anon` level

```
anon_security_definer_function_executable  (WARN, EXTERNAL, count 2)

  public.missions_guard()   callable by `anon` via /rest/v1/rpc/missions_guard
  public.rls_auto_enable()  callable by `anon` via /rest/v1/rpc/rls_auto_enable
```

**What that meant.** Postgres exposes every function in the `public` schema as
a PostgREST endpoint. Both of these are **trigger functions** - nobody is ever
meant to call them directly - and both were reachable **without signing in**.

`missions_guard()` is the one that carries the rate limit, the kill switch, and
the line that forces `researcher_id` to the calling account. `rls_auto_enable()`
is the event trigger that switches row level security on for every new table.
A trigger function reachable as a public API endpoint is a surface with no
reason to exist.

## THE FIX - migration `06_advisor_fix_revoke_trigger_functions`

```sql
revoke execute on function public.missions_guard()  from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
```

The functions are correct as triggers. The bug was the `EXECUTE` Postgres
granted by default. We took it away rather than rewriting them.

## AFTER - re-run, same tool

```
anon_security_definer_function_executable  ......  GONE (0 findings)
```

## What remains, and why it is deliberate

Six `authenticated`-level findings stay, and all six are the design:

| Function | Why a signed-in researcher may call it |
|---|---|
| `launch_mission` | the Launch Mission button |
| `generate_report` | the human checkpoint - a report exists only because a person clicked |
| `owns_mission`, `can_read_mission`, `can_read_run`, `is_collaborator` | called from inside the RLS policies; `authenticated` needs EXECUTE for a policy to evaluate |

None is an information oracle: each returns false for anything the caller does
not own, which they could determine with a SELECT anyway.

`rls_enabled_no_policy` on `app_settings` is also expected - it is the kill
switch, deliberately readable by no browser role at all.

## Said out loud to a judge

> "We ran Supabase's own security linter against the live database. It found
> two trigger functions exposed as public API endpoints that anyone could call
> without signing in - our insert guard and the auto-RLS trigger. We revoked
> execute on both, re-ran the linter, and those findings are gone. What's left
> is six functions signed-in researchers are supposed to call, and I can say
> why for each one."

---

# Second pass, same day — after the R-1 work

Re-run after adding the relaunch freeze, the daily cap, and the browser
write path. Re-run **because** the schema changed: an advisor result is
only true for the schema it ran against.

## What the linter says now

| Finding | Level | Verdict |
|---|---|---|
| `rls_enabled_no_policy` — `app_settings` | INFO | **Deliberate.** It is the kill switch. RLS on with *no* policy means no role reads it directly; only `SECURITY DEFINER` functions can, which is the point. |
| `authenticated_security_definer_function_executable` × **9** | WARN | **Deliberate — and checked, not assumed.** See below. |
| `auth_leaked_password_protection` disabled | WARN | ⚠️ **Real, and actionable.** See below. |
| `missions_guard` / `rls_auto_enable` exposed to `anon` | — | ✅ **Gone.** These were the first-pass findings; still closed. |

## The nine warnings, and why they stay

They are the RPCs a signed-in researcher **must** be able to call — the
write path (`researcher_log_step` / `_write_result` / `_finish_run`),
`launch_mission`, `generate_report`, and the four helpers the RLS
policies themselves evaluate (`owns_mission`, `can_read_mission`,
`can_read_run`, `is_collaborator`). Revoking any of them does not harden
the product, it stops it working: a policy that calls a function the
querying role cannot execute fails the query.

**The one way they could be a real finding is existence leakage** — a
boolean endpoint that answers differently for *"not yours"* and *"no such
thing"* lets a signed-in researcher confirm that a colleague's mission id
is real. So that was tested rather than argued:

| Probe, run as Dr Yousef | Answer |
|---|---|
| `owns_mission(` a **real** mission owned by Dr Noura `)` | `false` |
| `can_read_mission(` same `)` | `false` |
| `is_collaborator(` same `)` | `false` |
| `owns_mission(` a mission that **does not exist** `)` | `false` |
| `can_read_mission(` same `)` | `false` |
| `owns_mission(` **his own** mission `)` — control | `true` |

**A colleague's real mission and a mission that was never created are
indistinguishable.** Nothing is leaked by their being callable.

## One finding that is real: leaked-password protection is off

Supabase can check every new password against **HaveIBeenPwned** and
refuse ones that appear in a known breach. It is currently **disabled**.

This is not a schema problem and cannot be fixed from SQL or from the
management API — it is a dashboard toggle:

> Supabase → **Authentication** → **Policies** *(Password settings)* →
> enable **"Check for leaked passwords"**

Worth doing before the demo, and worth saying out loud: the platform
holds no passwords itself (`se-m3`), so the only password risk left is a
researcher re-using one that is already on a breach list. This closes
exactly that.

## One finding that is deliberately *not* fixed

`auth` has **0 MFA factors** enrolled. Two accounts, three days to the
demo, and an MFA prompt on stage is a way to lose the room. It is written
down here rather than quietly left out.
