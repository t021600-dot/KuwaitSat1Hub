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
