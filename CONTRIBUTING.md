# How our team works in one repo

*Idea-independent: this works for any capstone team.*

One repo, four people, four evenings. These rules exist so nobody overwrites anybody else's
work at 9 PM on Tuesday.

## 1. Get write access (once)

1. Make a free GitHub account if you do not have one, and send your **GitHub username** to the
   team chat.
2. The repo owner adds you under **Settings → Collaborators → Add people**.
3. Accept the invitation from your email or from <https://github.com/notifications>.
   Until you accept it, you cannot push.

## 2. Get the code on your laptop (once)

```bash
git clone <repo-url>
cd <repo-folder>
```

Or in VS Code: **Ctrl+Shift+P → Git: Clone**, then paste the repo URL.

## 3. Every time you sit down to work

```bash
git pull                       # get everybody else's work first
git checkout -b front-end/sign-in-screen   # one branch per piece of work: <job>/<what>
# ...work...
git add .
git commit -m "sign in screen shows an error when the email is empty"
git push -u origin front-end/sign-in-screen
```

Then open a **Pull Request** on GitHub and ask one teammate to look at it before merging.
Small pull requests, merged the same evening, beat one giant one on Wednesday.

A pull request template opens with the PR and lists what to check before you ask for review.
It is a prompt, not paperwork — every line on it is something that has gone wrong once.

**What is on `main` is what is live** (checklist MUST: live = main). Never push half-finished
work straight to `main`.

### What runs automatically on your pull request

`.github/workflows/ci.yml` runs on every push and every pull request. It needs no install and
no secrets, and it checks five things: every `.js` and `.mjs` file still parses, every `.json`
file still parses, every local file `index.html` references is actually **committed**, the four
agent test suites in `04-agents/tests/` still pass, and nothing loads a script or stylesheet
from a CDN.

Two scripts are deliberately **not** in CI. `04-agents/tools/preflight.js` is a demo-night
readiness board that includes items only a human can finish, so it is never fully green by
design. `03-security/tests/security-check.mjs` fires at the live Vercel deployment and the live
Supabase project, so it needs network access and should be run by hand, not on every push.

## 4. Who answers first

There are **four jobs and four people** — one owner each (see the table on your repo front page,
`README.md`). Owning a job does not mean doing it alone. It means that when somebody asks a
question about that area, you answer first. Jobs can overlap. Ownership cannot.

Shipping and the demo are **shared across all four**. There is no separate fifth job, and the
`ship/` branch prefix belongs to whoever is doing that piece of work.

| Branch prefix | Job |
|---|---|
| `front-end/` | 01 · Front end |
| `data/` | 02 · Back end and data |
| `security/` | 03 · Security |
| `agent/` | 04 · Automation and agents |
| `ship/` | shipping and demo work — anyone |

## 5. The freeze rule

The feature list agreed by the team is **frozen**. A new feature only goes in if an old one
comes out, and you name the one that comes out, out loud, in front of the other three. Write the
trade into the pull request that brings the new feature in — the feature request template asks
for it by name.

## 6. Never commit a secret

- Keys, tokens and passwords go in a local `.env` file, which `.gitignore` already blocks.
- Put the *names* of the variables (never the values) in `.env.example`.
- If a key ever lands in a commit, tell the Security owner at once. Deleting the file is not
  enough, because the key stays in the history. **Rotate the key.**
- The Supabase **publishable** key (`sb_publishable_…`) in `js/config.js` is designed to be
  public — the browser has to receive it — and it is safe **only while row level security is
  on**. The **secret / service-role** key must never appear in this repo. It lives in the n8n
  credential store.
- Use the `sb_publishable_…` format, **not** the legacy `eyJ…` anon key. The pre-commit hook in
  `tools/hooks/` blocks any real JWT from being committed, deliberately, because a legacy anon
  key and a service-role key look identical at a glance.

How to report a vulnerability, and what is in scope: [`SECURITY.md`](SECURITY.md).
