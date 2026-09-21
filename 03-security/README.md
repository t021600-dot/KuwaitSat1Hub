# 🔐 Job 03 · Security

**Owner:** Mariam Madouh · **GitHub:** `t021600-dot`
*The single entry point for my part of KuwaitSat-1 Mission Hub. Start here.*

---

## The one sentence my role comes down to

> **Researcher A's work is visible to Researcher A. Nobody else.**

That is the product premise. Without it this is not a research platform — it is
a public website with a login page on the front.

The judge's scripted question to whoever owns security:

> **"Show me account B failing to read account A's record."**

That is **step 9 of our demo**. Steps 1–8 are the team showing the thing works.
Step 9 is showing it is *safe*.

---

## The idea everything else follows from

**The browser is not on our side.** Our front end is static and its API key is
public by design — anyone can open developer tools and call the database
directly, skipping every page we wrote.

So **hiding a row on screen proves nothing.** Every rule lives in Postgres,
below the API, where a browser cannot reach around it.

```
  browser ──(publishable key + session token)──► Supabase API ──► Postgres
                                                                    │
                                          ┌─────────────────────────┴─────────┐
                                          │ 1. GRANTS     which columns/verbs │
                                          │ 2. RLS POLICY which rows          │
                                          │ 3. CONSTRAINTS is the data valid  │
                                          └───────────────────────────────────┘
```

---

## My six pass/fail items, and where the proof lives

Security is **6 of the 28 MUST items** — the largest share of any single job.
Miss one and the team does not pass.

| # | The item | The judge's test | Built in | Proof |
|---|---|---|---|---|
| `se-m1` | Row level security — B cannot read A | Two accounts, live | [`db/04_policies.sql`](db/04_policies.sql) | [`tests/two-window-check.js`](tests/two-window-check.js) |
| `se-m2` | No key/token/password in the repo **or history** | They grep, including history | [`SECRETS.md`](docs/SECRETS.md) | `evidence/se-m2-gitleaks.json` |
| `se-m3` | No password stored or shown | They open the users table | Supabase Auth holds it; we never copy it | [`db/99_verify.sql`](db/99_verify.sql) q7 |
| `se-m4` | HTTPS everywhere, no mixed content | Address bar + console + **Response Headers** | [`vercel.json`](../vercel.json) · [`csp-meta.html`](docs/csp-meta.html) · [`HTTPS-AND-CSP.md`](docs/HTTPS-AND-CSP.md) | `evidence/se-m4-console-clean.png` · `evidence/se-m4-response-headers.png` |
| `se-m5` | Every field refuses empty / too long / wrong type | **Paste 5,000 characters** | [`db/06_validation.sql`](db/06_validation.sql) | [`tests/VALIDATION-MATRIX.md`](tests/VALIDATION-MATRIX.md) |
| `se-m6` | AI security audit + **two** shipped fixes | They open the audit file | [`audit/AI-SECURITY-AUDIT.md`](audit/AI-SECURITY-AUDIT.md) | the two commits |

Plus two SHOULD items: the **blast radius** in one sentence and the **three
biggest threats** — both in [`THREAT-MODEL.md`](docs/THREAT-MODEL.md).

> **DONE is not PROVEN.** Something that works but has no saved output in
> `docs/evidence/` scores **NOT PROVEN**, which counts the same as failed.

---

## Every file I own

### `db/` — the database rules. **Run in order, one block at a time.**

| File | What it does | Why |
|---|---|---|
| [`01_tables_rls.sql`](db/01_tables_rls.sql) | Eight tables, then **RLS on for every one** | Without the last lines, every table is readable by anyone holding our public key |
| [`02_helpers.sql`](db/02_helpers.sql) | Four ownership functions | Child tables have no owner column — they reach it through the mission row |
| [`03_grants.sql`](db/03_grants.sql) | Revoke everything, grant back named columns | **RLS hides rows; it cannot hide a column.** Also the one `revoke` that stops n8n's key reading everyone's work |
| [`04_policies.sql`](db/04_policies.sql) | **⭐ This file IS `se-m1`** | The judge's question lives here |
| [`05_views_rpc.sql`](db/05_views_rpc.sql) | Views + the only write paths | Views hide columns; the RPCs are why n8n never touches a table |
| [`06_validation.sql`](db/06_validation.sql) | **⭐ This file IS `se-m5`** | What refuses the 5,000-character paste when someone skips the form |
| [`07_admin_audit_PHASE2.sql`](db/07_admin_audit_PHASE2.sql) | Super-admin + access log | **Read, do not run** this week — see its Block 0 |
| [`08_agent_claim.sql`](db/08_agent_claim.sql) | `claim_next_run()` + `sweep_stalled_runs()` | **RUN IT.** Without this the worker has three write paths and no way to find out there is anything to write about — nothing ever leaves `queued` |
| [`99_verify.sql`](db/99_verify.sql) | Nine checks that prove it took effect | Run Sunday, Tuesday, Wednesday |

### `tests/` — proving it

| File | What it is |
|---|---|
| [`two-window-check.js`](tests/two-window-check.js) | **⭐ The 40 seconds I am graded on.** Runs in the console against the API — not through our screens |
| [`RLS-TEST-MATRIX.md`](tests/RLS-TEST-MATRIX.md) | 25 checks where **every line is expected to fail** |
| [`VALIDATION-MATRIX.md`](tests/VALIDATION-MATRIX.md) | Every field × empty / too long / wrong type, plus the refusal wording for 01 |

### `docs/` — the written material

| File | For |
|---|---|
| `SECURITY.md` | Anyone — how the platform protects researchers' work. **NOT WRITTEN YET** — do not link it from anywhere until it exists |
| [`THREAT-MODEL.md`](docs/THREAT-MODEL.md) | Blast radius + the three biggest threats |
| [`DECISIONS.md`](docs/DECISIONS.md) | **The team** — seven decisions that change what you build |
| [`SECRETS.md`](docs/SECRETS.md) | `se-m2` — the key register and the sweep |
| [`HTTPS-AND-CSP.md`](docs/HTTPS-AND-CSP.md) | `se-m4` — and the layer only we would think of |
| [`SUPABASE-SETTINGS.md`](docs/SUPABASE-SETTINGS.md) | 13 dashboard settings nobody opens |
| [`VERCEL-HEADERS.md`](docs/VERCEL-HEADERS.md) | **Everyone** — `vercel.json` line by line, and the six response headers we now send |
| `DEPLOY.md` | **NOT WRITTEN YET.** What deploys on push and what does not — owned by 05 · Ship, now that the host is Vercel |
| [`audit/`](audit/) | `se-m6` evidence |
| [`evidence/`](evidence/) | Saved outputs and screenshots |

### `tools/hooks/pre-commit`

Refuses to commit a key, a token or an `.env` file. **Everyone installs it:**

```bash
git config core.hooksPath tools/hooks
git config core.hooksPath          # must print: tools/hooks
```

---

## How to apply my work

**⚠️ The SQL does not deploy when you push it.** Pushing `db/04_policies.sql`
to GitHub changes nothing about the database — it is a text file in a repo.

```
1. Supabase → SQL Editor
2. Open db/01_tables_rls.sql
3. Copy ONE BLOCK. Not the whole file.
4. Run it. Read the result. Next block.
5. Then 02 → 03 → 04 → 05 → 06 → 08, in that order
6. Run db/99_verify.sql and read every result
```

**Order is not optional** — `04_policies.sql` calls functions created in
`02_helpers.sql`. Out of order gives you *"function does not exist"*.

**07 is the gap in the numbering, and it is deliberate.** It is `PHASE2`:
read it, do not run it this week (its Block 0 says why). **08 is not
optional** — it is the agents' only read path, and skipping it looks like
"Launch Mission does nothing" because the run really does sit at `queued`
for ever.

**04 and 06 are safe to re-paste.** Every `create policy` has a
`drop policy if exists` above it and every `add constraint` has a
`drop constraint if exists`, so a re-run after a mistake ends in the same
state instead of *"already exists"*. 01, 02, 05, 07 and 08 were already
re-runnable (`if not exists` / `create or replace`) — with one caveat that
bites only if you EDIT them: `create or replace` cannot change a function's
return columns or a view's column list. If you change either, drop that one
object first. 07's Block 0.4 spells it out.

Then the two-window check by hand:

| | Must be |
|---|---|
| **A** sees their own mission | ✅ yes |
| **B** sees A's mission | ❌ no |

> **If A also sees nothing, that is a missing policy, not a working lock.**
> RLS enabled with no policy returns zero rows to *everyone* — which looks
> identical to a perfect lock and is a dead product. Always check both halves.

> **Window setup:** **A in a normal window, B in a private window.** Not two
> private windows — every Incognito window in one browser shares a single
> session, so B replaces A and both become B.

---

## What the rest of the team must do for this to hold

| Who | What | Why |
|---|---|---|
| **Hind (02)** | `enable row level security` on **every** new table, in the same paste that creates it | A table added later with RLS off is a total silent leak |
| **Hind (02)** | Every new view created `with (security_invoker = on)` | Without it a view runs as *its owner* and bypasses RLS entirely — while every check still reports green |
| **Hind (02)** | Auth → Providers → Email → **Confirm email = OFF** | The judge creates an account on stage; otherwise they cannot sign in |
| **Retag (01)** | `textContent`, never `innerHTML`, for anything a person or the AI wrote | The objective flows through an AI onto another researcher's screen — stored XSS |
| **Retag (01)** | **Remove `maxlength`** from the objective box | It silently truncates the judge's 5,000-char paste, a row **is** created, and we fail `se-m5` while the screen looks fine |
| **Retag (01)** | Paste [`csp-meta.html`](docs/csp-meta.html) into every page head | `se-m4` |
| **Dana (04)** | The browser never calls the n8n webhook | The URL would sit in View Source, and n8n's key bypasses RLS |
| **Dana (04)** | n8n writes only through the three named functions | It gets no table access at all |
| **Dana (04)** | Never switch a node to "continue on fail" | A refused write becomes a run that looks successful and tells nobody |
| **Dana (04)** | Run [`db/08_agent_claim.sql`](db/08_agent_claim.sql) after 06 | `claim_next_run()` is the worker's only read path; without it every run sits at `queued` for ever |
| **Whoever deploys** | Vercel project: Framework Preset **Other**, **no build command**, output = repo root | there is no build step, and a preset that expects one fails the deploy |
| **Whoever deploys** | Replace `PROJECTREF` in [`vercel.json`](../vercel.json) (two places) with the real Supabase ref | the site loads and every Supabase call is **silently** blocked by the CSP if this is missed |
| **Whoever deploys** | Vercel → Settings → **Deployment Protection** → on for **Preview** | every branch and PR builds to a public URL of the whole app — see [`SUPABASE-SETTINGS.md`](docs/SUPABASE-SETTINGS.md) §2b |

Full reasoning: [`DECISIONS.md`](docs/DECISIONS.md).

---

## Honest limits — say these before a judge finds them

- **Sign-up is open.** Deliberate, so a judge can create an account on stage —
  but "approved researcher" currently means anyone with an email address.
- **n8n holds a key that bypasses row level security.** Its table privileges are
  revoked, leaving three functions. **On the agent path the wall is the
  function, not the policy.** I would rather say that accurately than claim RLS
  covers it.
- **We deploy to Vercel, which sends real HTTP response headers.** The CSP,
  HSTS, `frame-ancestors 'none'`, `X-Content-Type-Options`,
  `Referrer-Policy: no-referrer` and `Permissions-Policy` all ship from
  [`vercel.json`](../vercel.json) — see [`VERCEL-HEADERS.md`](docs/VERCEL-HEADERS.md).
  *(This used to read "our host cannot send response headers, so HSTS and
  `frame-ancestors` are unavailable". That was true on GitHub Pages and is
  **false now**. Do not say it.)* The remaining honest limit is that HSTS only
  protects a browser that has already visited once over HTTPS, and that we left
  `preload` off on purpose because it is not a reversible decision.
- **Basemap tiles come from a third party**, which can therefore infer which
  area a researcher is viewing.
- **All demo data is invented.** Our blast radius is small mostly because of
  that — a property of the project, not of my controls.

---

## Status — all proven, 21 September 2026

| | | Evidence |
|---|---|---|
| SQL written and reviewed | ✅ | `db/01` → `db/10`, plus `99_verify.sql` |
| SQL **run against the live project** | ✅ | 12 migrations applied to `kqboenytmzagdiweqygl` |
| `99_verify.sql` passing | ✅ | **8 checks, 0 failures** — see below |
| Two-window check passing | ✅ | [`evidence/se-m1-isolation-matrix-2026-09-21.md`](evidence/se-m1-isolation-matrix-2026-09-21.md) |
| `se-m6` audit **run for real**, fixes shipped | ✅ | **three** fixes, not two — [`evidence/se-m6-security-advisor-2026-09-21.md`](evidence/se-m6-security-advisor-2026-09-21.md) |
| `evidence/` populated | ✅ | 8 files, every one a recorded result |
| **Automated suite** | ✅ | **36 checks, 0 failures** — `node 03-security/tests/security-check.mjs` |

### `99_verify.sql`, run against the live database

Every check returns rows **only on failure**.

| # | Check | Failures |
|---|---|---|
| 1 | RLS enabled on every table | **0** |
| 2 | Views run as the caller (`security_invoker`) | **0** |
| 3 | `anon` holds no table grant | **0** |
| 4 | `service_role` holds no table grant | **0** |
| 5 | `anon` can execute no function | **0** |
| 6 | Every `SECURITY DEFINER` function pins `search_path` | **0** |
| 7 | No password-shaped column anywhere | **0** |
| 8 | The agent cannot write a report | **0** |
| 9 | RLS on with no policy | **1 — `app_settings`, correct** |

Check 9 is *meant* to return one row. `app_settings` is the kill switch: RLS
on with no policy means **no role reads it directly**, and only
`SECURITY DEFINER` functions can see it. A zero there would mean the switch
was readable.

Check 2 is the one that matters most and is easiest to get wrong. The views
are owned by `postgres`, which **bypasses RLS**. With `security_invoker` off
they would run as their owner and every researcher would read every row.

### The two-window check

Two researchers, each signed in, each holding real work. The database holds
**3 missions · 2 runs · 16 steps · 5 results · 2 reports**:

| Signed in as | missions | runs | steps | results | reports | `auth.users` |
|---|---|---|---|---|---|---|
| Dr Noura | 1 | 1 | 6 | 3 | 1 | refused |
| Dr Yousef | 2 | 1 | 10 | 2 | 1 | refused |
| **sum** | **3** | **2** | **16** | **5** | **2** | |
| **actually present** | **3** | **2** | **16** | **5** | **2** | |

The sums are exact — a **partition**, not just a filter. From the browser,
Dr Yousef asking for Dr Noura's mission **by its exact primary key** gets
**0 rows**.

> Written is not proven. Every tick above names the file that proves it, and
> every one of those files records what the tool actually returned — including
> the answers that were inconvenient.
