# How this project actually goes live

**Read this before you assume "push = deployed". It is only true for one of our
four parts.**

---

## The thing that surprises everyone

Our project lives in **four different places**. Git is the source of truth for
all of it, but **only one part deploys itself when you push.**

```
                    git push to main
                           │
        ┌──────────────────┼──────────────────┬──────────────────┐
        ▼                  ▼                  ▼                  ▼
  ┌───────────┐     ┌────────────┐     ┌────────────┐     ┌────────────┐
  │ FRONT END │     │  DATABASE  │     │    n8n     │     │  SUPABASE  │
  │ html/css/ │     │  db/*.sql  │     │  workflow  │     │  SETTINGS  │
  │    js     │     │            │     │            │     │            │
  ├───────────┤     ├────────────┤     ├────────────┤     ├────────────┤
  │ ✅ DEPLOYS │     │ ❌ does NOT │     │ ❌ does NOT │     │ ❌ does NOT │
  │ AUTOMATIC │     │            │     │            │     │            │
  │ ~30-60s   │     │ you RUN it │     │ you IMPORT │     │ you CLICK  │
  │           │     │ in Supabase│     │ it in n8n  │     │ it in the  │
  │           │     │ SQL editor │     │ and PUBLISH│     │ dashboard  │
  └───────────┘     └────────────┘     └────────────┘     └────────────┘
```

**Pushing `db/04_policies.sql` to GitHub changes nothing about the database.**
It is a text file sitting in a repo. Someone has to open the Supabase SQL editor
and run it. Same for the n8n workflow, same for every dashboard setting.

Git is where we keep the *record* of those things so they are reviewable,
re-runnable and not lost. It is not the mechanism that applies them.

---

## Part 1 · The front end — this one really does auto-deploy

**Owner: 01 · Front end (Retag)** · **Set up by: 05 · Ship**

### One-time setup

1. GitHub → the repo → **Settings** → **Pages**
2. **Source:** Deploy from a branch
3. **Branch:** `main`, folder **`/ (root)`** → **Save**
4. Wait ~1 minute. The URL appears at the top of that page:
   `https://t021600-dot.github.io/KuwaitSat1Hub/`
5. Put that URL in the README and in the repo's **About** box

> Pages needs the repo to be **public** on a free account. Ours is public.
> `.nojekyll` is already committed — without it GitHub ignores folders
> starting with an underscore.

### After that

```bash
git push origin main      # → live in 30-60 seconds
```

That is the whole deploy. **What is on `main` is what is live** — which is why
you never push half-finished work to `main`.

Check it in a **private window**, not your normal one. Your normal browser
caches, so you will see the old version and think the deploy failed.

---

## Part 2 · The database — you run it by hand

**Owners: 02 · Back end (Hind) + 03 · Security (Mariam)**

The SQL in `db/` is version-controlled so we can review it, re-run it and prove
what we did. **Applying it is a separate, manual act.**

1. Open your Supabase project → **SQL Editor**
2. Open `db/01_tables_rls.sql`
3. **Copy one block at a time. Not the whole file.** If a block errors you need
   to know which one.
4. Run it. Read the result.
5. Next block. Then next file, in numeric order.
6. When `01` → `06` are done, run **`db/99_verify.sql`** and read every result.

**Order matters and is not optional:**

```
01 tables + RLS  →  02 helpers  →  03 grants  →  04 policies
       →  05 views + RPCs  →  06 validation  →  99 verify
```

`04_policies.sql` calls functions created in `02_helpers.sql`. Run them out of
order and you get "function does not exist".

> `db/07_admin_audit_PHASE2.sql` is for **reading, not running** this week.
> Its first block explains why.

### If someone changes the SQL later

Pushing the change does **not** update the database. Whoever merges it has to
run it in Supabase too, and then re-run `99_verify.sql`. Say so in the PR.

---

## Part 3 · The n8n workflow — export, commit, import

**Owner: 04 · Automation and agents (Dana)**

The workflow lives inside n8n. The file in `n8n/` is a **backup and a record**,
not the running thing.

**To save your work into the repo:**
1. n8n → open the workflow → **⋯** menu → **Download**
2. Put the JSON in `n8n/`
3. ⚠️ **Open it first and check no credential value is inside.** n8n exports can
   contain credential data. Keys live in the n8n credential store, never in the
   repo.
4. Commit and push

**To restore it elsewhere:** n8n → **Import from File** → then re-attach the
credentials by hand, and **Publish**.

> An unpublished workflow does not run. "It works in n8n" and "it is published"
> are two different things — check both before the demo.

---

## Part 4 · Supabase dashboard settings — clicks only

**Owner: 03 · Security (Mariam)**

Some controls are not code at all and live only in a web form:

- Authentication → URL Configuration → **Site URL** and **Redirect URLs**
- Authentication → Providers → Email → **Confirm email = OFF**
- Advisors → **Security Advisor**
- Password minimum length

**Nothing in git can set these.** They are applied by clicking, and the only
record is a screenshot. Put those screenshots in `docs/evidence/`.

---

## The full path, from your laptop to the judge

```
  1. work on a branch          git checkout -b security/rls-policies
  2. commit                    git add . && git commit -m "..."
  3. push the branch           git push -u origin security/rls-policies
  4. open a Pull Request       on GitHub
  5. a teammate reviews        one person, same evening
  6. merge into main           ──┐
                                 │
  7a. front end changed?         └─► LIVE AUTOMATICALLY in ~60s
  7b. SQL changed?               ──► SOMEONE MUST RUN IT IN SUPABASE
  7c. workflow changed?          ──► SOMEONE MUST IMPORT + PUBLISH IN n8n
  7d. a setting changed?         ──► SOMEONE MUST CLICK IT + SCREENSHOT IT

  8. check the live URL in a PRIVATE window
```

**Steps 7b–7d are the ones teams forget.** The classic failure is a merged PR
that everyone believes is deployed, while the database still has last night's
rules — and nobody finds out until the demo.

---

## The pre-demo checklist

Run through this on Wednesday, **on the live public URL, on a laptop that did
not build the project**:

- [ ] The public URL opens in a **private window**, no login wall on the landing page
- [ ] The address bar shows **`https://`** and the padlock — never `localhost`
- [ ] Sign in works, and a **brand new account** can be created on the spot
- [ ] `db/99_verify.sql` passes on the **live** project (not a local copy)
- [ ] The n8n workflow is **Published**, and a mission runs with the n8n tab closed
- [ ] The two-account isolation check passes — **A in a normal window, B in a private window**
- [ ] `docs/evidence/` contains the saved outputs and screenshots
- [ ] A backup screen recording is on the presenting laptop

> Something that works but has no saved evidence scores **NOT PROVEN** — which
> counts the same as failed.
