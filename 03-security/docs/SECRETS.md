# SECRETS REGISTER — se-m2

**Owner:** 03 · Security
**Proves:** *"No key, token or password anywhere in the repo, including the history"*
**The judge's test:** they search the repo for `key`, `secret`, `password`, `token`, `eyJ` — **and the file history**.

---

## The situation we are starting from — and why it is lucky

As of Sunday 20 September, **this project is not a git repository yet.** No
`git init`, no remote, no commits, nothing tracked.

That means **there is no leaked key in the history, because there is no
history.** The entire "rotate first, then rewrite history" fire drill exists
because teams commit a key on night 1 and find it on night 3.

**Get `.gitignore` right before the first commit and you never enter that maze.**
This is the cheapest security win of the whole week and it expires the moment
somebody runs `git init && git add .`.

---

## The register

One row per secret. **Values never appear in this file.**

| # | What it is | Where it lives | Who holds it | In the repo? |
|---|---|---|---|---|
| 1 | Supabase **publishable** key (`sb_publishable_…`) | `js/config.js` | everyone | **YES — public by design.** Safe *only* because RLS is on |
| 2 | Supabase project URL | `js/config.js` | everyone | **YES — public by design** |
| 3 | Supabase **secret / service-role** key | n8n credential store **only** | 04 | **NEVER** |
| 4 | Supabase dashboard login | the owner's password manager | 02 | **NEVER** |
| 5 | Anthropic / model API key | n8n credential store **only** | 04 | **NEVER** |
| 6 | n8n webhook URL | n8n only — the browser never calls it (D-1) | 04 | **NEVER** |
| 7 | n8n webhook auth header **name** | n8n credential store | 04 | **NEVER** |
| 8 | n8n webhook auth header **value** | n8n credential store | 04 | **NEVER** |
| 9 | Demo account A password | password manager / on paper | 03 | **NEVER** |
| 10 | Demo account B password | password manager / on paper | 03 | **NEVER** |
| 11 | *(none)* — **no Storage bucket exists**, see DECISIONS D-2 | — | — | — |

### Row 1 is the one people get wrong in both directions

The publishable key **is meant to be in our JavaScript.** Putting it in a `.env`
and feeling safe is theatre — the browser has to receive it either way.

It is safe **only because row level security is on**. That is the sentence from
`CONTRIBUTING.md`, and it is the entire reason `sql/04-policies.sql` exists. Put
that comment next to the key in `config.js`, so the next person does not
"helpfully" hide it and conclude the problem is solved.

**Use the new `sb_publishable_…` key, not the legacy `anon` JWT.** Both a legacy
anon key and a service-role key start `eyJhbG` and are indistinguishable at a
glance. With the new format, a publishable key and a secret key look completely
different — which means you can block **every** `eyJ` in a pre-commit hook at
zero cost. That single change turns "which key is this?" into a non-question.

---

## The sweep — Tuesday night

PowerShell 5.1, Windows. Paste **one at a time**, not as a block.

```powershell
# (a) working tree, all tracked files.  ~2 seconds
git grep -nIE "(api[_-]?key|secret|password|token|eyJ|sk-ant-|sb_secret_|service_role|AIza|pk\.eyJ)"

# (b) did any of those strings EVER exist, in any commit?  ~10 seconds
git log --all -p -S "eyJ"      --oneline
git log --all -p -S "sk-ant-"  --oneline
git log --all -p -S "sb_secret_" --oneline

# (c) any .env-ish file ever added, even if deleted later.  ~3 seconds
git log --all --name-only --diff-filter=A -- "*.env" "*.env.*" "*secret*" "*key*"

# (d) what is tracked RIGHT NOW that should not be.  ~1 second
git ls-files | Select-String -Pattern "env|secret|key|credential"

# (e) the one people forget: is .gitignore itself committed?
git ls-files .gitignore

# (f) the one git grep CANNOT see: untracked files sitting in the folder
git status --porcelain
```

**Why (f) matters:** `git grep` only searches **tracked** files. An untracked
`.env` sitting in the folder will not show up in (a) at all — and it is one
careless `git add -A` away from being in the history forever.

**Why `AIza` and `pk.eyJ` are on the list:** this is a **map** project. The real
secret that ships in a front end on a mapping project is a basemap token — a
Google Maps key (`AIza…`) or a Mapbox public token (`pk.eyJ…`). The generic
wordlist in the kit does not catch either.

---

## gitleaks - the dedicated scanner (installed at C:\Users\senpa\tools\gitleaks.exe)

`git grep` finds strings you thought to search for. **gitleaks knows what a
secret looks like** - it ships ~170 rules for real credential formats,
including Supabase keys, `sk-ant-`, AWS, Google (`AIza...`) and Mapbox
(`pk.eyJ...`) tokens.

It is on your PATH. **New terminals only** - a shell opened before the
install still has the old PATH.

```powershell
# 1 - the working tree, right now.  ~2 seconds
gitleaks dir . --redact --verbose

# 2 - THE WHOLE GIT HISTORY. This is the se-m2 half git grep cannot do:
#     every commit, every branch, every file that was added then deleted.
gitleaks git . --redact --verbose

# 3 - the machine-readable run, saved as evidence
gitleaks git . --redact --report-format json --report-path audit\evidence\se-m2-gitleaks.json
```

**`--redact` is not optional.** Without it a found secret is printed in full
to your terminal - and then into the evidence file you are about to commit to
a public repo. You would publish the exact thing you were scanning for.

**Exit code 0 = clean. Exit code 1 = leaks found.** That makes it usable in
the pre-commit hook too:

```bash
gitleaks protect --staged --redact || exit 1
```

### Why this is worth three minutes of your Tuesday

1. **It covers the half of `se-m2` that is hard.** The judge tests *"and the
   file history"*. `git grep` only searches **tracked files at the current
   commit**; `gitleaks git` walks every commit on every branch, including
   files added and later deleted.
2. **It is a real `se-m6` exhibit.** "We ran a dedicated secret scanner across
   the full git history, here is the report" beats a hand-written grep, and
   the JSON report is a file a judge can open.
3. **It finds formats you would not have thought to grep for.** On a *map*
   project the realistic leak is a basemap token - `AIza...` or `pk.eyJ...` -
   and neither is in the kit's generic wordlist.

### Expect one false positive, and know the answer

It will likely flag the **publishable key** in `js/config.js`. That is
**PUBLIC BY DESIGN** - log it in the triage table below with that verdict and
move on. To silence it permanently, add `.gitleaksignore` with the finding's
fingerprint (the report gives you one). **Never** add a blanket ignore for
`config.js`: a service-role key pasted there by a tired teammate on Tuesday is
exactly what you need this tool to catch.

---
## The triage table

Fill this in as the sweep runs. **Never paste a secret value into this file, or
into any AI chat window** — the file path and the **first six characters** are
all anyone needs to make a decision.

| Hit | File + line | First 6 chars | Verdict | What we did |
|---|---|---|---|---|
| `sb_publishable_…` | `js/config.js:4` | `sb_pub` | **PUBLIC BY DESIGN** | left it; added the "safe only because RLS is on" comment |
| `password` | `signin.html:31` | `passwo` | **FALSE POSITIVE** | it is `type="password"` on an input |
| `service_role` | *(example)* deleted `js/admin.js`, commit `a19f4c2` | `eyJhbG` | **REAL SECRET** | rotate now, then clean history |
|  |  |  |  |  |
|  |  |  |  |  |

Verdict is one of: **REAL SECRET** / **PUBLIC BY DESIGN** / **FALSE POSITIVE**.

---

## If a REAL SECRET is found — in this order

1. **ROTATE IT FIRST**, in the provider's dashboard. The old value is already
   public; deleting the file does not un-publish it.
2. Put the new value **only** where it belongs: the n8n credential store or
   Supabase Vault. Never in a file. Never in a chat window.
3. Remove the file from the working tree, add it to `.gitignore`, commit.
4. **Only now** rewrite history. For a repo this young, deleting and re-pushing
   is faster and harder to get wrong than `git filter-repo` — but it **loses the
   multi-day commit history** the SHOULD list wants ("commits from more than one
   person across more than one day"). **Decide that with 05 before you do it.**
5. Tell the other four, so nobody force-pushes over the fix.

> **The step people get wrong is 1.** They clean the history first, feel safe,
> and leave a live key that was on GitHub for two days.

`[NEEDS CHECK]` whether the repo has forks or open pull requests — history
rewriting does not reach those.

---

## The files that must be in the first commit

**`.gitignore`** — already correct at the project root; it blocks `.env`,
`.env.*` (but not `.env.example`), `*.pem`, `*.key`.

**`.env.example`** — variable **names** only, never values:

```
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
# The secret key is NOT here and never will be. It lives in n8n only.
```

**A pre-commit hook** (`tools/hooks/pre-commit`) that blocks:
- any `eyJ` **anywhere, including `config.js`** — do not exclude it. "The anon
  key wasn't working so I tried the other one" is the most common Supabase
  beginner mistake there is.
- the literals `sk-ant-`, `sb_secret_`, `/webhook/`, `n8n.cloud`, `AIza`, and
  the demo email domain.
- `.env` files **but not** `.env.example`:
  `git diff --cached --name-only | grep -E '(^|/)\.env($|\.)' | grep -qv '\.env\.example$'`
  — the naive regex blocks `.env.example`, which is the very first file you are
  told to commit, and a beginner's answer to a hook that blocks legitimate work
  is `--no-verify`, which becomes a habit, which is how the real key lands on
  Monday.

Then, instead of an installer script, send one line to the team:

```
git config core.hooksPath tools/hooks
```

and ask all four to paste the output of `git config core.hooksPath` back into
chat. **That paste is your verification.** The person most likely to be holding
a real key is 04.

**Test the hook before you trust it:** `.env.example` commits · a fake `eyJhbG…`
blocks · a file with a demo password blocks · a normal `index.html` commits.
