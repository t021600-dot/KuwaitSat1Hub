# Evidence · `99_verify.sql` against the live database

**Owner:** 03 · Security · **Run:** Monday 21 September 2026
**Target:** `kqboenytmzagdiweqygl` — the live project, not a branch

Every check is written to return rows **only on failure**, so an empty
result is the pass. Both the count and what was counted are reported, so
a check cannot quietly pass by counting nothing.

| # | Check | Failures | What was counted |
|---|---|---|---|
| 1 | RLS enabled on every table | **0** | tables with RLS off |
| 2 | Views run as the caller | **0** | views without `security_invoker` |
| 3 | `anon` holds no table grant | **0** | grants to `anon` |
| 4 | `service_role` holds no table grant | **0** | grants to `service_role` |
| 5 | `anon` can execute no function | **0** | functions `anon` may call |
| 6 | Definer functions pin `search_path` | **0** | unpinned definer functions |
| 7 | No password-shaped column | **0** | suspicious columns |
| 8 | The agent cannot write a report | **0** | `service_role` grants on `generate_report` |
| 9 | RLS on with no policy | **1** | `app_settings` — **expected** |

## The two that carry the most weight

**Check 2.** The three `my_*` views are owned by `postgres`, and
`postgres` **bypasses row-level security**. If `security_invoker` were
off, those views would run with the owner's rights and every researcher
would read every row — while every policy still looked correct in the
dashboard. It is on for all three.

**Check 9 returns a row on purpose.** `app_settings` carries the kill
switch and the rate limits. RLS on with *no policy* means no role reads
it directly; only `SECURITY DEFINER` functions can. A zero here would
mean the switch had become readable.

## Check 5, and why it is stricter than it was

Until 21 September this check would have returned **1**:
`kuwait_area_ok(jsonb)` was reachable by `anon` at
`/rest/v1/rpc/kuwait_area_ok`, from the open internet. It was found by
our own grant audit, not by the Supabase Advisor.

Closing it had a trap worth recording: PostgreSQL checks `EXECUTE` on
functions used inside a **CHECK constraint at insert time**, and
`authenticated` held this privilege only through `PUBLIC`. Revoking from
`PUBLIC` alone therefore breaks **every mission insert** with
`permission denied for function kuwait_area_ok`. The explicit re-grant to
`authenticated` is load-bearing, and that was tested before it was
applied — see `db/10_advisor_fixes.sql` §3.

## Reproducing it

`03-security/db/99_verify.sql`. Safe to run against production: every
statement reads catalogue tables, and the checkpoint section wraps its
one writing test in `begin … rollback`.
