# se-m6 · Security Advisor, re-run 22 September 2026

Run against `kqboenytmzagdiweqygl` after the payload archive
(`13_payload_archive.sql`) was added and after the legacy API keys were
disabled. The 21 September run and its two fixes are in
`se-m6-security-advisor-2026-09-21.md`; this file records what the
Advisor says **now**, and — the point of it — what we are deliberately
leaving open and why.

A finding with no decision written next to it reads as a finding nobody
saw. All three below have a decision.

---

## 1 · Leaked Password Protection Disabled — WARN — **OPEN, plan-gated**

> Supabase Auth can check a new password against HaveIBeenPwned.org so a
> password already in a public breach cannot be set. It is off.

**We tried to turn it on and could not.** The dashboard answers:

```
Failed to update auth configuration: Configuring leaked password
protection via HaveIBeenPwned.org is available on Pro Plans and up.
```

This project runs on the free tier. The control is not available to us at
any price we are paying, so it stays open. That is a **plan limitation,
not an oversight**, and it is written here so nobody reading the Advisor
page later assumes it was missed.

**What carries the weight instead**, all of which we do have:

| Compensating control | Where |
|---|---|
| Passwords are never stored, copied or displayed by us — Supabase Auth holds the hash | `db/99_verify.sql` q7; no password-shaped column exists anywhere in our schema |
| Server-side authentication rate limiting | Supabase Auth, not ours to disable |
| A visible client-side throttle, so repeated failures are something a person can *see* rather than a wall of identical refusals | `js/ksat-integration.js`, and it says in its own comment that it is not the rate limit |
| Sign-in failures are deliberately vague, so the form cannot be used to test which research staff have accounts | `js/ksat-integration.js` |
| Minimum password length raised above the Supabase default of 6 | Dashboard → Authentication → Providers → Email |

**If the project ever moves to Pro, this is the first thing to switch on.**

---

## 2 · Signed-In Users Can Execute SECURITY DEFINER Function — WARN ×10 — **ACCEPTED, by design**

Ten functions are flagged as callable by `authenticated` over
`/rest/v1/rpc/`:

```
can_read_mission   can_read_run   is_collaborator   owns_mission
is_enrolled_researcher
launch_mission     generate_report
researcher_log_step   researcher_write_result   researcher_finish_run
```

**Do not act on this warning.** Two groups, both intentional:

- The first five are the **row level security helpers**. The policies in
  `04_policies.sql` and `13_payload_archive.sql` call them. They are
  `SECURITY DEFINER` for the reason `02_helpers.sql` gives: they read the
  very tables whose policies invoke them, and as DEFINER they skip RLS
  inside the body so there is no infinite recursion. **Revoking EXECUTE
  from `authenticated` would take the product down**, because a policy
  evaluated for a signed-in user still needs EXECUTE on the function it
  calls. This was very nearly done once during development and caught
  before it shipped.

- The second five are the **researcher write path** (`09_researcher_write_path.sql`).
  They are the only way a researcher changes anything, precisely so the
  tables can have no write grant. Each one re-checks ownership inside the
  body rather than trusting the caller.

Every one is `SECURITY DEFINER` **with a pinned `search_path`**, which is
the actual hazard the lint is pointing at. An unpinned DEFINER function is
a privilege escalation waiting for a schema to be shadowed; a pinned one
is not.

---

## 3 · RLS Enabled No Policy on `public.app_settings` — INFO — **ACCEPTED, by design**

RLS on, no policy, no grant to anybody. That combination means the table
is reachable only by `SECURITY DEFINER` functions and the service role,
which is exactly what `03_grants.sql` says it is for. The linter reports
it at INFO, not WARN, for the same reason.

---

## What changed since 21 September

- `public.payload_frames` added. `anon` has **no grant at all** on it;
  `authenticated` has a column-level SELECT and no write; the read policy
  additionally requires enrolment via `is_enrolled_researcher()`.
  Verified from outside with the shipped publishable key: `HTTP 401`.
- **Legacy API keys (anon, service_role JWTs) disabled** on 22 September,
  after a service_role key was exposed in a working session. Verified dead
  from outside: both `/rest/v1/` and `/auth/v1/admin/users` return
  `401 Legacy API keys are disabled`. The site is unaffected — it ships
  the newer publishable key, which is a separate credential.
- `service_role` granted `select, update` on `payload_frames` so the
  payload team can load frames out of band with
  `03-security/tools/load_payload_frames.py`. Recorded in
  `13_payload_archive.sql`, not left only on the live database.
