# 📦 The harvest list

**Owner:** 02 · Back end (Hind)
*What gets lifted out of the design study and into the real product, line by
line, with the file that receives each piece.*

---

## Why this file exists

`prototype/index.html` is about 6,000 lines and
[it is the design study, not the product](prototype/index.html). It will not be
wired to Supabase and it will not be shown as the app. A banner at the top of
it now says so, and `robots: noindex` keeps it out of search results.

That decision loses nothing **only if the writing inside it is moved across.**
The code in there is a simulation; the *text* is the best work on this project.
Somebody sat down and wrote a real ten-section study report, a bilingual limits
clause, sixteen sourced references and four objectives that sound like a
researcher wrote them. None of that is simulated. All of it is reusable as-is.

**This page is the list. Five items. Each one names the file that receives it.**

Work top to bottom — item 1 is the largest and the most visible on Thursday.

---

## 1 · The ten-section report structure

**What it is.** The shape of the written study: ten numbered sections in a
fixed order, each one answering a question a reader will actually ask.

| # | Section |
|---|---|
| 1 | Research objective |
| 2 | Study area and period |
| 3 | Satellite data |
| 4 | Environmental analysis |
| 5 | Recommendation *(prototype: "Species shortlist")* |
| 6 | Predicted impact |
| 7 | Indicative cost |
| 8 | Monitoring |
| 9 | Limits of use |
| 10 | References |

**In the prototype:** `prototype/index.html`, `buildStudyReport()` at line
**5985**. (There is a shorter five-section version at line **4113** — ignore
that one, it is the earlier draft.)

**Receiving file:** **`04-agents/worker/agent-run.js`**, in the reporting step
that builds the text handed to `generate_report(p_body_md)`. That function
already produces a plain-text report with headed blocks; this replaces its
section list with the ten above.

**Also receives it:** **`01-front-end/app/report.html`** renders whatever
arrives in `reports.body_md`. Nothing to change there *if* the headings stay
plain text — but see the warning below.

> **The one rule that cannot bend.** `reports.body_md` is rendered with
> `textContent`, never `innerHTML` and never as markdown (`DECISIONS.md` D-2).
> So the report's layout is its **line breaks and its spaces** — no `#`
> headings, no `**bold**`, no tables. The version already seeded in
> [`SEED-DATA.md`](SEED-DATA.md) section 8 is a working example of the ten
> sections written that way; copy its shape.

**Owner:** 04 · Agents writes it, 02 checks it renders.

---

## 2 · The bilingual Limits of Use

**What it is.** Six numbered limits, each written in English and Arabic, saying
plainly what this platform is not. It is the single most credible thing on the
prototype, and it is the answer to the hardest question a judge can ask:
*"what happens if your AI is wrong?"*

The six, in the order they should stay:

1. A decision-support prototype, not an official planning instrument; no endorsement.
2. The environmental values are a demonstration dataset; operational figures need calibrated products and field survey.
3. KuwaitSat-1 carries no thermal sensor and no near-infrared band, so the heat and vegetation layers are model-derived.
4. The cooling coefficient is peer-reviewed but was not derived in Kuwait, and the source says the relationship is non-linear.
5. Species selection, irrigation, soil and cost need an agronomist and a site survey.
6. No recommendation may be acted on without human review and competent-authority approval.

**In the prototype:** `prototype/index.html` line **6078**, as an array of
`[english, arabic]` pairs — already paired, already translated, ready to lift.

**Receiving files:**

- **`04-agents/worker/agent-run.js`** — section 9 of every generated report.
  English only in `body_md` for now (one language per report, chosen by the
  researcher), and the Arabic stays in the array for when the toggle lands.
- **`01-front-end/app/report.html`** — the same six as a permanent block under
  the report, so a report printed without section 9 still carries them.

> **Arabic means RTL, and RTL is not a nice-to-have on this project.** Any
> element holding Arabic needs `lang="ar" dir="rtl"`. The banner added to the
> prototype this weekend is a two-line example of it done correctly.

**Owner:** 04 · Agents for the report, 01 · Front end for the page block.

---

## 3 · The sixteen numbered sources

**What it is.** Sixteen real, checkable references, each with a URL and a line
saying exactly which claim it supports — the KuwaitSat-1 project site, the
Kuwait University announcements, the SmallSat conference paper, the WMO
temperature verification, World Bank Kuwait indicators, and four peer-reviewed
papers on species and urban cooling. The `[n]` chips in the prototype's text
point at them.

**In the prototype:** the master list is
[`prototype/CREDITS-AND-SOURCES.txt`](prototype/CREDITS-AND-SOURCES.txt) —
already a standalone file, already correct. The in-page copy is the `SOURCES`
array at line **1899**.

**Receiving files:**

- **`04-agents/worker/agent-run.js`** — section 10 of the report prints only
  the sources that run actually cited, as
  `[11] World Bank Open Data - Kuwait country indicators` + the URL on the next
  line. Do not print all sixteen every time; print the ones referenced.
- **`01-front-end/app/report.html`** — a "Sources" block listing all sixteen,
  so the provenance is on screen and not only in a downloaded report.

> **Hand-off to 01 · Front end:** `report.html` has no sources section today.
> It needs one `<section>` with a sixteen-item list. The content is the text
> file above, copied across unchanged — no rewriting, the wording is the point.

**Owner:** 02 keeps `CREDITS-AND-SOURCES.txt` as the single source of truth;
01 and 04 copy from it. If a number changes, it changes there first.

---

## 4 · The four realistic objectives

**What it is.** Four objectives that sound like a researcher wrote them, not
like placeholder text:

1. *Identify areas in Kuwait that need greenery and could deliver a measurable environmental benefit*
2. *Find the built-up zones with the widest gap between surface heat and vegetation cover*
3. *Evaluate whether existing green space in this governorate is gaining or losing canopy*
4. *Shortlist planting sites that will not raise irrigation demand beyond what rainfall supports*

**In the prototype:** `RC_EXAMPLES`, line **5417**.

**Receiving files:**

- **`01-front-end/app/new-mission.html`** — as clickable example chips under
  the objective box. One tap fills the textarea; the researcher edits from
  there. This is also what stops a demo stalling while somebody types.
- **`02-back-end/SEED-DATA.md`** — done. The two seeded missions are written in
  the same voice, one about Al-Jahra and one about Bubiyan.

> **Check the length before you paste them in.** The database refuses an
> objective shorter than 20 characters or longer than 1500
> (`missions_objective_len`). All four clear 20 comfortably. And **ask 01 to
> remove any `maxlength` from the textarea** — a `maxlength` silently truncates
> a 5,000-character paste instead of refusing it, which is the exact failure
> `03-security/db/06_validation.sql` is written to prevent.

**Owner:** 01 · Front end.

---

## 5 · The agent step copy

**What it is.** For each agent: a name, one line saying what it does *for the
researcher*, and — this is the valuable half — one line saying what it is **not
allowed to do**. That second line is what turns a list of agents into a
guardrail you can point at.

**In the prototype:** the `AGENTS` array at line **5496**. Seven entries.

**The mapping, and the mismatch — read this before copying anything.** The
database pins `agent_steps.step_name` to exactly six values. The prototype has
seven agents. They do not line up one-to-one:

| Prototype agent (line 5496 ff.) | `step_name` in the schema | Notes |
|---|---|---|
| Satellite Data Agent | `satellite_data` | direct |
| Environmental Analysis Agent | `environmental_analysis` | direct |
| Species Recommendation Agent | `recommendation` | **renamed** — the copy is about species, the step is about ranking sites; rewrite the line, keep the voice |
| Impact Prediction Agent | `impact_prediction` | direct |
| Visualisation & Costing Agent | `visualization` | the costing half has no step; keep it as report section 7 |
| Reporting Agent | `reporting` | direct |
| **Monitoring Agent** | **— none —** | **no step_name exists for it** |

> **The Monitoring Agent cannot be harvested as a step, and inventing a seventh
> `step_name` throws at insert time.** Do not add one this week — the CHECK
> constraint is in `01_tables_rls.sql` and changing it touches 03's file and
> 04's step list two nights before the demo. Its copy is still worth keeping:
> put it in the report as section 8 (Monitoring), which is where
> [`SEED-DATA.md`](SEED-DATA.md) already puts it.

**Receiving files:**

- **`01-front-end/app/js/agents.js`** — the `AGENTS` array there has
  `name` / `role` / `summary` per step and is currently written in flat
  placeholder voice. Replace `role` with the prototype's line. *(Note: its
  `key` values are `environmental` and `impact`, which do **not** match the
  database's `environmental_analysis` and `impact_prediction` — fix the keys in
  the same pass or the live steps will not match the seeded ones.)*
- **`04-agents/agent/steps.js`** — already carries `label` and `limit` per
  step. The prototype's "what it will not do" sentences belong in `limit`,
  where `GUARDRAILS.md` can quote them.

**Owner:** 01 for the screen copy, 04 for the limits.

---

## What is NOT being harvested, and why

Say these out loud once, so nobody spends Monday night on them.

| Not harvested | Why |
|---|---|
| The cinematic intro, the synthesised launch audio, the star field | Beautiful, and it is the design study's signature. It is also five minutes of a seven-minute slot. |
| The orbit readout | A two-body model, not telemetry. Nothing in the product claims live orbit data and it should not start. |
| The team photograph | Permission scope is still unconfirmed with the KuwaitSat-1 project (`prototype/README.txt`, "IMAGE PERMISSION"). Do not copy it into the public app until that is settled. |
| The costing calculator | Real work, but it needs a whole screen and there is no `results.kind` for it. Section 7 of the report carries the idea in one sentence. |
| The simulated data generators | This is the actual product's job now — `results` rows written by the agent chain. |

---

## The one-line summary for the demo

> *"The prototype is our design study, and it is linked from the repo. The
> report structure, the limits clause, the sources and the agent copy all came
> out of it and are in the product you are looking at."*

That sentence is true only once items 1–5 are done. Until then it is a plan.

---

## Progress

| # | Item | Receiving file | Done |
|---|---|---|---|
| 1 | Ten-section report structure | `04-agents/worker/agent-run.js` | ☐ |
| 2 | Bilingual Limits of Use | `04-agents/worker/agent-run.js` · `01-front-end/app/report.html` | ☐ |
| 3 | Sixteen numbered sources | `04-agents/worker/agent-run.js` · `01-front-end/app/report.html` | ☐ |
| 4 | Four realistic objectives | `01-front-end/app/new-mission.html` | ☐ |
| 5 | Agent step copy | `01-front-end/app/js/agents.js` · `04-agents/agent/steps.js` | ☐ |

Tick a box only when the text is in the file on `main`, not when it is decided.
