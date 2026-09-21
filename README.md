# 🛰️ KuwaitSat-1 Mission Hub

**A secure AI-powered research platform for KuwaitSat-1 satellite data.**
Authorised researchers go from *"I have a research question"* to *"I have a
complete research report"* without handling every step by hand.

> **Prototype — invented data only.** A student capstone for AI for Coding
> (CODED × KFAS × SACGC). **Not** connected to kuwaitsat.space, holds no real
> KuwaitSat-1 imagery, and secures nothing belonging to KFAS.

---

## What it does

A researcher signs in, writes a research objective, draws an area on a map of
Kuwait, and presses **Launch Mission**. Six AI agents run in sequence:

| | Agent | What it does |
|---|---|---|
| 🛰️ | **Satellite Data** | Pulls the imagery for the selected area |
| 🌍 | **Environmental Analysis** | Reads vegetation, temperature, land cover |
| 🌱 | **Recommendation** | Proposes where intervention would help most |
| 📈 | **Impact Prediction** | Estimates the effect of acting there |
| 🗺️ | **Visualization** | Draws the findings on the Kuwait map |
| 📄 | **Reporting** | Writes it up for the researcher to review |

Results appear on the map. The researcher reviews them and clicks **Generate
Report**. Refresh the page and the mission is still there. Sign in as a
different researcher and the first one's work is not visible.

**The AI never commands the satellite.** It reads stored data and proposes
findings — every decision stays with the researcher:

> **researcher asks → AI assists → researcher reviews → AI continues**

---

## The team

**Four people, four jobs.** Owning a job means **you answer first** — not that
you do it alone. Jobs can overlap; ownership cannot.

| Job | Owner | Owns | GitHub |
|---|---|---|---|
| 🖥️ **01 · Front end** | **Retag** | Four screens that link, forms that answer, the phone-portrait pass | *to fill in* |
| 🗄️ **02 · Back end and data** | **Hind** | The tables, accounts, records, the run log | *to fill in* |
| 🔐 **03 · Security** | **Mariam Madouh** | Row level security, secrets, validation, the AI audit — **[full role →](03-security/README.md)** | `t021600-dot` |
| 🤖 **04 · Automation and agents** | **Dana** | The workflow, the six agents, guardrails, the tools | *to fill in* |

> **Everyone: add your GitHub username to this table in your first PR.**
> *(Fix the spelling of your own name too, if it is wrong.)*

### Shipping and the demo are shared

There is no separate ship-and-present job — the four of us split it:

| What | Who |
|---|---|
| GitHub Pages on, the live URL in this README | **Hind** |
| The live site works on a laptop that did not build it | **Retag** |
| Two full rehearsals, Wednesday | **all four** |
| Each of us explains our own part, no slides, no reading | **all four** |
| The backup screen recording | **Dana** |

**What is on `main` is what is live.** Push before the demo and open the link
in a private window to check.

---

## Run it

**Live:** <https://kuwait-sat1-hub.vercel.app/>  ·  deployed on Vercel, database on Supabase

There is no build step. Open `index.html` in a browser.

First, copy your Supabase project URL and **publishable** key into
`js/config.js`. Both are public by design — the browser has to receive them —
and they are safe **only because row level security is switched on**.

---

## Where the code lives

The product is **one page** — Hind's research console — with the security and
agent layers added on top of it rather than woven into it.

```
index.html              THE SITE. ~6,000 lines. Hind's console: the 3D globe,
                        the orbit view, imagery compare, charts, the agent
                        pipeline, 16 numbered sources, EN/AR throughout.
                        It carries exactly 10 ADDED lines and nothing else.

site-original/          A PRISTINE, UNTOUCHED COPY of that page. Any change to
                        index.html is caught by diffing against this.

css/ksat-integration.css   the sign-in gate + identity bar
css/ksat-theme.css         the ESA/NASA visual layer
js/ksat-integration.js     auth, Supabase persistence, the agent audit trail,
                           prompt-injection screening, the approved tools
js/ksat-theme.js           re-points the colours hard-coded in JS (canvas,
                           charts, globe) to the theme, without editing the page
js/config.js               Supabase URL + publishable key (public by design)
vendor/                    supabase-js and Leaflet, self-hosted
vercel.json                the security response headers

app-retag/              Retag's multi-page app. PRESERVED, not deleted - it has
                        a full screen set and a swappable data layer, and it is
                        the fallback if anything in the main page goes wrong.

01-front-end/  02-back-end/  03-security/  04-agents/
                        each member's own documentation, SQL, tests and evidence
```

### The rule that keeps this safe

**`index.html` is never edited.** Everything is achieved by adding a file and
one line that loads it. Prove it at any time:

```bash
diff site-original/index.html index.html
```

Every differing line must start with `>`. A `<` or a `c` means something was
removed or changed, and that is a bug.

### What deploys and what does not

Pushing to `main` puts the **site** live on Vercel in about a minute. It does
**not** apply the SQL — that is run in the Supabase SQL editor, in order, from
`03-security/db/`. See `03-security/docs/` and `02-back-end/README.md`.

---

## Before your first push — everyone, once

```bash
git clone https://github.com/t021600-dot/KuwaitSat1Hub.git
cd KuwaitSat1Hub
```

### Every time you sit down to work

```bash
git pull                                 # get everybody else's work first
git checkout -b front-end/sign-in-screen # one branch per piece of work
# ...work...
git add .
git commit -m "sign in screen shows an error when the email is empty"
git push -u origin front-end/sign-in-screen
```

Then open a **Pull Request** and ask one teammate to review before merging.
Small PRs merged the same evening beat one giant one on Wednesday.

**Branch prefixes**

| Prefix | Job |
|---|---|
| `front-end/` | 01 · Front end |
| `data/` | 02 · Back end and data |
| `security/` | 03 · Security |
| `agent/` | 04 · Automation and agents |
| `ship/` | shipping and demo work — anyone |

**What is on `main` is what is live.** Never push half-finished work to it.

Full rules: [`CONTRIBUTING.md`](CONTRIBUTING.md)

---

## Never commit a secret

- Keys, tokens and passwords go in a local `.env`, which `.gitignore` blocks.
- Put the **names** of variables in `.env.example` — never the values.
- The Supabase **publishable** key is designed to be public, and it is safe
  **only while row level security is on**.
- The Supabase **secret / service-role key must never appear in this repo.**
  It lives in the n8n credential store.
- **If a key ever lands in a commit, tell 03 · Security at once.** Deleting the
  file is not enough — the value stays in the history. It has to be **rotated**.

---

## The demo we are building towards

1. Researcher logs in
2. Creates a mission — *"Identify areas suitable for environmental improvement"*
3. Clicks **Launch Mission**
4. The six agents tick through on screen
5. Results appear on the Kuwait map
6. The researcher reviews the findings
7. **Generate Report** → Mission Complete
8. Refresh — the mission is still there
9. **Sign in as another account — the first researcher's mission is not visible**

That one run proves front end, back end, data, AI agents, automation, security
and persistence.
