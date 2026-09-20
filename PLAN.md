# 📋 Where we are, and how we get to one product

**Read time: 8 minutes. Everyone reads all of it.**
Sunday 20 September · **3 build nights left** · Demo Thursday 24

---

## The situation in five lines

We have **four good submissions and no product.** Right now there is:

- ❌ no Supabase project — `js/config.js` still says `<PASTE PROJECT URL>`
- ❌ no public URL — GitHub Pages is not switched on
- ❌ **two front ends** that both do the same thing
- ❌ six MUST items (area 05) with nobody's name on them
- ✅ genuinely strong pieces in all four folders, if we connect them

**28 MUST items. Miss one and nobody passes.**

---

# 1 · Where each of us stands

## 🖥️ Retag — 01 Front end · 1,870 lines

**What's strong**
Six real screens that link. **Storage is touched in exactly 3 lines**, all in `js/data.js`, and every screen goes through `Data.*` — so connecting a real database is *one file's work*. `esc()` is correct and actually used. Leaflet self-hosted. Empty/loading/not-found states already written.

**What's weak**
| | |
|---|---|
| The whole database is one `localStorage` key | So isolation is JavaScript choosing not to draw a row — a **fake pass** |
| Passwords plaintext in `seed.js`, printed on `login.html` | Breaks `se-m3` |
| Her field names match nothing in the real schema | `owner_id` vs `researcher_id`, and her map area is a `{north,south,east,west}` box where the database wants a GeoJSON polygon — **every insert would be refused** |
| Every page runs inline `<script>` | Our own CSP (`script-src 'self'`) would **blank all six screens** |

**Missing entirely:** `supabase-js` — it is nowhere in the repo, and our CSP forbids loading it from a CDN. **This blocks everything.**

---

## 🗄️ Hind — 02 Back end · 5,990 lines

**What's strong**
`buildStudyReport()` returns **one string in ten sections** — exactly the shape `reports.body_md` wants. **16 numbered traceable sources.** A six-clause *Limits of Use* in English and Arabic. Four realistic research objectives. The "not official, no endorsement" framing, done unprompted and correctly.

**What's weak**
It is a **6,000-line self-contained page with no accounts, no database and no data layer.** It cannot be swapped — only retyped. Seven agents where the product has six. Its audit panel claims *"no network request"*, which stops being true the moment Supabase exists.

**Missing entirely:** the Supabase project itself. Confirm-email = OFF not set. No one-row-per-table glossary (`be-m3`).

---

## 🔐 Mariam — 03 Security · 2,363 lines of SQL

**What's strong**
The strongest single folder in the repo. Column-level grants **plus** `revoke all … from service_role`, so n8n physically cannot read another researcher's mission. Four `SECURITY DEFINER` helpers with pinned `search_path`. Verify query 4 catches the failure that hides best. The super-admin panel was costed and **cut in writing**.

**What's weak**
| | |
|---|---|
| **None of it has ever been run** | Seven SQL files against nothing |
| `evidence/` holds one `.gitkeep` | Evidence is what's scored |
| Files 04 and 06 are **not re-runnable** | One error at 1am and a re-paste looks like total collapse |
| ~~The proof script printed a false green pass on an error~~ | ✅ **fixed tonight** |

**Missing entirely:** two demo accounts, every screenshot, the AI audit (still a template → `se-m6` **NOT PROVEN**), and the pre-commit hook is installed on **zero** machines.

---

## 🤖 Dana — 04 Agents

**What's strong**
`automation.js` is a **finished drop-in** — calls `launch_mission()`, polls every 2s, shows refusals, prints a real failure sentence after a stall, renders with `textContent` only. The engine decision is written and reasoned. Guardrails written. `INTEGRATION.md` tells Retag exactly what to do.

**What's weak**
~~Her work was on three unmerged branches~~ → ✅ **merged to `main` tonight.**

**Missing entirely:** the live n8n workspace, credentials, an **Active** workflow. And `agent_claim_run()` — **she is blocked on Mariam.**

---

# 2 · The decision that has to be made tonight

### ✅ Retag's app is the product. Hind's prototype is the design study.

**Why, in one sentence:** Retag's app touches storage in **3 lines**, so connecting it to a real database is one file's work. Hind's touches simulated data in **6,000 lines**, so connecting hers is a rewrite — and we have three evenings.

**What we lift from Hind's prototype — as *text*, never as code:**

1. The ten-section report structure → the reporting agent's template
2. *Limits of Use*, six clauses EN+AR → the end of every report
3. The 16 numbered sources → the references section
4. The "not claimed" refusals → the footer
5. Four realistic objectives → what gets typed on stage instead of "test test"
6. Agent step copy in operator voice

**What we abandon, out loud:** the canvas map · the governorate dropdown · the `setTimeout` sequencer · the **seventh agent** (no slot in the schema) · the prototype's own guardrail panel (two disagreeing guardrail lists in one public repo makes a judge stop believing both).

> ⚠️ **Someone will propose merging the two front ends on Tuesday at 10pm.** That is the worst option — it destroys the two properties that make Retag's shippable. **Kill it tonight.**

### And the second decision: **area 05 needs an owner**

Six MUST items, nobody's name. The guide is blunt: *"Jobs can overlap. **Ownership cannot.**"* And `sh-m3`'s test is a judge reading the front page for names against jobs.

**Recommendation: Hind owns 05.** She loses the front end and gains six MUST items — that's a promotion, not a consolation.

---

# 3 · What blocks what

```
SUNDAY ─ two roots. Nothing downstream exists until both are done.
══════════════════════════════════════════════════════════════════

  [A] vendor/supabase.js            [B] Supabase project + SQL 01→06 run
      Retag · 15 min                    Hind creates · Mariam runs · 2h30
      (CSP forbids a CDN)               + Confirm email = OFF
           │                                      │
           │ blocks: everything                   │ blocks: be-m1 be-m2 be-m4
           │                                      │ be-m5 se-m1..se-m6 au-m1
           ▼                                      ▼
  [C] APP MOVES TO REPO ROOT (Retag · 40 min · SUNDAY)
      blocks: fe-m2, sh-m1, sh-m4, and every path built later
           │
     ┌─────┴──────────────┬────────────────────────┐
     ▼                    ▼                        ▼
  [D] THE CALL SHEET   [E] agent_claim_run()   [F] MARIAM'S HARNESS
      Hind · 45 min        Mariam runs it          a 20-line HTML page
      the real call        blocks ALL of 04        ► se-m1 PROVEN SUNDAY
      beside each                                    whatever state 01 is in
      data.js function                               ← do NOT wait for the app
           │
MONDAY ═══ THE WIRING NIGHT ══════════════════════════════════════
           ▼
  [H] data.js SWAP  + boundsToPolygon()  ← or EVERY insert is refused
           │
           ▼
  [K] Automation.mount() in mission.html  ► au-m1 au-m2 au-m6 be-m5
           │
TUESDAY ═══ PROVE IT, THEN FREEZE ════════════════════════════════
           ▼
  se-m5 · phone-portrait · report body · be-m3 glossary · 2nd researcher
           │
           ▼
  ██ SCHEMA FREEZE · TUESDAY 22:00 · SAID OUT LOUD ██
           │
           ▼
  Mariam re-runs all 9 verify queries AFTER the last schema change
```

**The thing nobody has said out loud:** *Mariam is only blocked by the app if she lets herself be.* A 20-line harness page proves `se-m1` **tonight**, and the two demo accounts get created in the **Supabase dashboard**, not through the app.

---

# 4 · Tonight — Sunday

**First 20 minutes, all four, out loud:** Retag's app is the product · who owns area 05 · everyone fills their own README row **and pushes it from their own account** *(right now zero commits exist from Retag, Hind or Dana — `sh-m3` and the shared-repo marks need their names in the history)*

| Who | Tasks | Hrs |
|---|---|---|
| **Retag** | `vendor/supabase.js` **first** · move app to repo root, re-click all 6 screens · delete the `#launch.disabled` line · `.chip` 11.5px→12.5px · **hand the phone to Dana and say nothing** · start read paths | **2:00** |
| **Hind** | Create the project + **Confirm email = OFF** + paste URL/key into `config.js` · **the call sheet** (14 lines: the real Supabase call beside each `data.js` function) · declare the six step strings as the single truth · **turn Pages on** · prototype "NOT THE PRODUCT" banner | **2:00** |
| **Mariam** | Make 04 and 06 re-runnable **first** · run 01→06 one block at a time · `99_verify` + screenshots · two demo accounts in the dashboard · **harness page → `se-m1` proven** · run `agent_claim_run()` for Dana · write the D-5 decision | **2:40** |
| **Dana** | n8n Cloud workspace + credentials · the Schedule trigger + claim loop · one end-to-end run writing real `agent_steps` rows | **2:00** |

**Monday** = the wiring night (`data.js` swap, automation mounted).
**Tuesday** = prove it, then **freeze at 22:00**.
**Wednesday** = rehearsal only. The capstone forbids building.

---

# 5 · The five things most likely to lose us a MUST

| # | Risk | Owner | De-risk by |
|---|---|---|---|
| 1 | **No `supabase-js` in the repo** and the CSP forbids a CDN — nothing can connect | Retag | **Sunday, 15 min** |
| 2 | **Inline `<script>` on all six pages** — our own CSP blanks the site | Retag + Mariam | Sunday (decide), Tuesday (apply) |
| 3 | **Area box vs GeoJSON polygon** — every insert refused by `kuwait_area_ok()` | Retag + Mariam | Monday, with `boundsToPolygon()` |
| 4 | **`se-m6` audit is still a template** — NOT PROVEN = failed | Mariam | **Monday night, no later** |
| 5 | **`agent_claim_run()` doesn't exist** — all of area 04 is stopped | Mariam → Dana | **Sunday**, or Dana loses Monday |

---

# 6 · What we deliberately do NOT do

- ❌ Merge the two front ends
- ❌ Build the super-admin panel (already cut in writing)
- ❌ Researcher MFA (the SQL is 20 min; the *evidence* is 3–4 hours)
- ❌ Supabase Storage — no bucket, no file, nothing to right-click
- ❌ The seventh agent
- ❌ Anything on Wednesday

---

## The one-line version

> **Tonight is about connecting, not building.** Two roots — the Supabase
> project and `supabase-js` — then everything else follows. Nobody should
> write a new feature until both exist.
