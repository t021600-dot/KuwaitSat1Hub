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

**Four people, five jobs.** The capstone guide is explicit about this:

> *"A team of four puts two jobs on one name."*

**Owning a job means you answer first — not that you do it alone.**
Jobs can overlap; ownership cannot.

| Job | Owner | Owns | GitHub |
|---|---|---|---|
| **01 · Front end** | **Retag** | Four screens that link, forms that answer, the phone-portrait pass | *to fill in* |
| **02 · Back end and data** | **Hind** | The tables, accounts, records, the run log | *to fill in* |
| **03 · Security** | **Mariam** | Row level security, secrets, validation, the AI audit | `t021600-dot` |
| **04 · Automation and agents** | **Dana** | The workflow, the six agents, guardrails, the tools | *to fill in* |
| **05 · Ship and present** | ⚠️ **unassigned** | The live address, this page, testing on another machine, demo day | |

> **Everyone: add your GitHub username to this table in your first PR.**
> *(Check the spelling of your own name too — fix it if I got it wrong.)*

### ⚠️ Job 05 still needs a name

Every one of the 28 pass/fail items is graded whether or not someone owns it,
and **05 · Ship and present has six of them** — the public URL, the repo front
page, testing on a machine that did not build it, two rehearsals, and everyone
explaining their own part. Leave it unowned and they simply do not get done.

**The recommendation: Hind takes 05 alongside 02.**

The two jobs are complementary rather than competing:

| | Sun | Mon | Tue | Wed |
|---|---|---|---|---|
| **02 · Back end** | heavy | heavy | lighter | done |
| **05 · Ship** | light | light | medium | **the whole night** |

02 is front-loaded, 05 is back-loaded — so one person can carry both without a
clash.

**Not Mariam (03).** Security is the blocker on the first build night — nobody
can safely point a page at the database until row level security is on — and it
already carries six pass/fail items of its own, the largest share of any job.

**Not Retag (01).** Front end is heavy on all three build nights, and 05 owns
Wednesday entirely.

**Dana (04) is the alternative** if Hind is overloaded — 04 is light on Sunday,
though it peaks on Tuesday just as 05 starts to climb.

**Decide tonight and write the name in the table.** *"We all did everything"* is
the sentence that loses marks.

---

## Run it

**Live:** *to fill in — GitHub Pages URL*

There is no build step. Open `index.html` in a browser.

First, copy your Supabase project URL and **publishable** key into
`js/config.js`. Both are public by design — the browser has to receive them —
and they are safe **only because row level security is switched on**.

---

## Where your work goes

```
index.html        landing page            01 · Front end
signin.html       sign in                 01
dashboard.html    the researcher's missions   01
mission.html      one mission + the map   01
css/              styles                  01
js/               client code             01
js/config.js      project URL + publishable key (public by design)

db/               SQL: tables, row level security, policies   02 + 03
tests/            test matrices and proof scripts             03
n8n/              exported workflow JSON, guardrail list      04
docs/             SECURITY.md, THREAT-MODEL.md, slides        03 + 05
assets/           images, the backup recording                05
```

Each folder has a `README.md` saying what belongs in it and who owns it.
**Add your own files to your own folders.** If you need something in someone
else's area, ask them in the PR rather than editing it yourself.

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
| `ship/` | 05 · Ship and present |

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
