# Security — KuwaitSat-1 Mission Hub

*How this prototype protects researchers' work. Owner: job 03 · Security.*

> **This is a student prototype built in four evenings, using invented data.**
> It is not connected to kuwaitsat.space, holds no real KuwaitSat-1 imagery, and
> secures nothing belonging to KFAS.

---

## The one requirement

> Researcher A's missions, results and reports are visible to Researcher A.
> Researcher B cannot see them.

Everything below exists to make that true and to let anyone verify it.

---

## Where the rules live, and why not in the website

A website runs on the visitor's computer. Anyone can open developer tools and
call our API directly, skipping every page we wrote. **So our JavaScript is not
a security boundary** — hiding a row on screen proves nothing.

Every rule is enforced in **Postgres**, below the API, where a browser cannot
reach around it.

```
  browser ──(publishable key + session token)──► Supabase API ──► Postgres
                                                                    │
                                          ┌─────────────────────────┴──────────┐
                                          │ 1. GRANTS      which columns/verbs │
                                          │ 2. RLS POLICY  which rows          │
                                          │ 3. CONSTRAINTS is the data valid   │
                                          └────────────────────────────────────┘
```

## The four controls

**1 · Row level security on every table.** Each read is filtered by the database
to rows the caller owns. `auth.uid()` comes from a signed session token, so it is
the one fact about the caller that the caller cannot fabricate. Child tables
(`mission_runs`, `agent_steps`, `results`, `reports`) reach their owner through
the mission row.

**2 · Column-level grants.** RLS filters *rows*; it cannot hide a *column*. Every
default privilege is revoked and handed back by name, so internal fields — the
agent's raw prompt, model confidence, the satellite archive path — are not
selectable at all.

**3 · Validation in the database.** Length, type, shape, and where on Earth a
mission polygon may be, enforced as constraints and a trigger. These still fire
when someone skips the form and calls the API directly. Rate limits (5 missions
per hour, 20 per day) and a kill switch live here too.

**4 · A narrow write path.** Nothing writes to a table directly except a
researcher creating a mission. Launching, logging an agent step, writing a
result and approving a report all go through named functions that re-read the
owner from the database and never trust their arguments.

## The automation

The agent chain runs in n8n, which authenticates with a key that **bypasses row
level security by definition**. Rather than claim otherwise: every table
privilege is revoked from that role, leaving exactly three functions it may call
and no table access at all. **On the agent path the wall is the function, not the
policy.** The browser never calls n8n; it calls a database function, so no
webhook URL appears in our client code.

A report exists only because a person clicked *Generate Report* — the agent
proposes, a human approves.

## Verify it yourself

```sql
-- RLS on for every table? Any false is a failure.
select c.relname, c.relrowsecurity from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r';
```

Full checks in `db/99_verify.sql`; the 25-row isolation matrix, in which every
check is expected to fail, is in `tests/`.

## Known limits, stated deliberately

- **Sign-up is open.** Anyone with an email address can create an account. This
  is intentional so the platform can be tried, but "approved researcher" is not
  yet enforced.
- **The automation holds a broad key.** Reduced to three functions; in a real
  deployment it would get its own least-privilege database role.
- **Our host cannot send HTTP response headers**, so HSTS, `frame-ancestors`,
  and `Referrer-Policy` as a header are unavailable. The CSP ships as a meta tag.
- **Basemap tiles come from a third party**, which can therefore infer which area
  a researcher is viewing. With real data the basemap would be self-hosted.
- No passwords are stored by this application; Supabase Auth holds them and we
  never copy, read or display them.

## Reporting a problem

Open an issue, or contact the Security owner listed on the repo front page.
Please do not include a working credential in an issue.
