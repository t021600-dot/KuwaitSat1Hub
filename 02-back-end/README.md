# 🗄️ Job 02 · Back end and data

**Owner:** Hind · **GitHub:** *to fill in*
*What remembers. The single entry point for this role.*

---

## What this role is

> **If a refresh empties it, we have a slideshow, not a platform.**

The tables, the accounts, the records, and the log that proves the automation
actually ran. Persistence is what turns a demo into a product — and it is the
foundation every other job stands on: security has nothing to protect and agents
have nowhere to write without it.

| | |
|---|---|
| **My share of the bar** | **5** of the 28 MUST items (`be-m1` … `be-m5`) |
| **The judge's question to me** | *"What is one row in this table?"* |
| **The test I cannot fake** | Add a record, hard refresh, then open the URL in a private window and sign in |

---

## What is in here

| File | What it is |
|---|---|
| [`TABLE-GLOSSARY.md`](TABLE-GLOSSARY.md) | **`be-m3`.** One plain sentence per table, for all eight. Read it out loud before Thursday. |
| [`SEED-DATA.md`](SEED-DATA.md) | The demo rows: two researchers, one finished mission, one draft. Includes the disable/re-enable recipe for the guard trigger. |
| [`HARVEST.md`](HARVEST.md) | The five pieces of writing being lifted out of `prototype/` into the real product, each with the file that receives it. |
| `prototype/` | The design study. **Not the product** — see below. |

### `prototype/` — KuwaitSat Green Intelligence

> **DECIDED: this is the design study, not the product.** ~6,000 lines in one
> HTML file, all of it simulated in the browser. Vercel serves every file in
> the repo, so this page goes live at a public URL next to the real app —
> which is why it now carries an unmissable banner saying what it is, a link
> to the real Mission Hub, and `<meta name="robots" content="noindex">`.
> **Do not wire it to Supabase.** Its writing moves across instead:
> [`HARVEST.md`](HARVEST.md).

A launch sequence, objective entry, area and period selection, seven
agent steps, costed visualisation, monitoring, and a generated written report.

Genuinely strong work, and three things in it are done properly:

- **Every factual claim is numbered and traceable.** `CREDITS-AND-SOURCES.txt`
  maps each `[n]` chip on the page to a real source — the KuwaitSat-1 project
  site, the Kuwait University announcements, the SmallSat conference paper.
  Judges ask *"where did that number come from?"* and this answers it.
- **The honesty framing is correct.** The page says plainly *"Conceptual AI
  simulation — not an official planning proposal"* and *"a student capstone
  prototype… it carries no endorsement."* In front of a KFAS panel that is
  exactly the right call.
- **No secrets, no mixed content.** Scanned clean with gitleaks. Every external
  resource loads over HTTPS.

**To run it:** open `prototype/index.html` in a browser. No server, no install.

---

## ⚠️ The gap we have to close, and it is not a small one

The prototype has **no accounts and no database.** Verified, not assumed:

| Searched for | Hits |
|---|---|
| sign in / login / password | **0** |
| Supabase / createClient | **0** |
| `researcher_id` / `user_id` | **0** |
| `localStorage` | 3 — and all three store an audio on/off preference |

The data is simulated in the page (62 references to mock/simulated/demo). That
is completely fine for a *look and feel* prototype, and it is not a criticism of
the work. But the capstone grades specific things that need a real back end:

| Item | Test | With the prototype as it stands |
|---|---|---|
| `be-m1` | Data survives a refresh **and a new browser** | ❌ refresh clears it |
| `be-m2` | The app reads from the database, not a list typed in the code | ❌ the list is in the code |
| `be-m4` | Two people sign up separately, each starts empty | ❌ there is no sign-up |
| `be-m5` | Every automated run leaves a row | ❌ nothing is written |
| **`se-m1`** | **Account B cannot read account A's rows** | ❌ **there are no accounts** |

`se-m1` is 03 · Security's item and it is the one a judge asks about **by name**:
*"Show me account B failing to read account A's record."* That question cannot be
answered against a page with no accounts, no matter how good the page is.

**That is five MUST items. Miss one and the team does not pass.**

---

## What closing it actually takes

Not a rewrite of the prototype — **the prototype is not the thing being wired
up.** The real screens are the plain static pages in
[`../01-front-end/app/`](../01-front-end/app/), and the back end goes underneath
*those*. The prototype stays as the design study and hands over its writing
through [`HARVEST.md`](HARVEST.md).

The SQL is already written and waiting in
[`../03-security/db/`](../03-security/db/).

**1 · Supabase sign-in** — replace the opening screen with a real one.
`js/config.js` at the repo root already has the client set up.

```js
await sb.auth.signUp({ email, password });
await sb.auth.signInWithPassword({ email, password });
```

**2 · Save the mission instead of holding it in a variable.**

```js
const { data, error } = await sb.from('missions')
  .insert({ title, objective, area_geojson })
  .select('id').single();
```

Row level security stamps the owner automatically — the browser cannot set it.

**3 · Read missions back on load**, so a refresh keeps them:

```js
const { data } = await sb.from('my_missions').select('*');
```

**4 · Write each agent step and result** as a row, so `be-m5` has something to
show and the six steps on screen come from the database rather than a timer.

Run [`../03-security/db/`](../03-security/db/) files `01` → `06` in order first,
then `99_verify.sql`. See [`../03-security/README.md`](../03-security/README.md).

---

## One thing to fix while wiring it up

The prototype uses **`innerHTML` in 101 places**. That is harmless while all the
text is ours. The moment a *researcher* types an objective and it is rendered
back — especially onto **another** researcher's screen — it becomes the classic
stored-XSS path, and our agent chain runs that text through an AI first.

**The rule:** `textContent` for anything a person or the AI wrote. Keep
`innerHTML` only for markup we wrote ourselves.

```js
box.innerHTML  = mission.objective;   // wrong, once a user types it
box.textContent = mission.objective;  // right
```

Same for map popups — Leaflet's `bindPopup()` takes HTML, so build a DOM node
and set `textContent` on it.

Detail: [`../03-security/docs/DECISIONS.md`](../03-security/docs/DECISIONS.md)

---

## My MUST items

- `be-m1` data survives a refresh and a new browser
- `be-m2` the app reads from the database, not a list typed in the code
- `be-m3` any member can say what one row of any table is, in one sentence
  → **written: [`TABLE-GLOSSARY.md`](TABLE-GLOSSARY.md)**
- `be-m4` real accounts: two people sign up separately, each starts empty
  → the two demo accounts and their rows: [`SEED-DATA.md`](SEED-DATA.md)
- `be-m5` every automated run leaves a row: what started it, when, status, result
  → one seeded run with seven steps, one of them a refusal: [`SEED-DATA.md`](SEED-DATA.md)

## Two rules from 03 · Security that outlive whoever writes the SQL

1. **Every new table ends with `alter table … enable row level security;`** in
   the same paste that creates it. A table added later with RLS off is a total
   silent leak and nothing in the app will tell us.
2. **Every new view is created `with (security_invoker = on)`.** Without it the
   view runs as *its owner* and bypasses row level security entirely — it hands
   every row to every account while every check still reports green.

Also: Supabase → Authentication → Providers → Email → **Confirm email = OFF**,
or a judge cannot create an account on stage and `be-m4` is untestable.

---

## 🚨 Hand-off to 03 · Security — the CSP will blank the design study

**I am not touching `vercel.json`; it is 03's file. Writing it down instead.**

The new `vercel.json` at the repo root sends
`Content-Security-Policy: … script-src 'self' …` on `source: "/(.*)"` — which
matches `/02-back-end/prototype/index.html` as well as the app.

`prototype/index.html` has **28 inline `<script>` blocks and zero external
script files**. Under `script-src 'self'` with no nonce and no hash, every one
of them is blocked. The live prototype URL becomes a black page. Not degraded —
blank.

*(The design-study banner itself survives: its `<style>` is allowed by
`style-src 'unsafe-inline'`, and its one small script only fine-tunes the
banner height, which is why that CSS carries a `52px` fallback. So the page
would show the banner and nothing else.)*

Two ways to fix it, both in `vercel.json`, 03's call which:

```jsonc
// A · relax the header for that one path only. Add AFTER the catch-all
//     block, because for a duplicate header key the LAST matching rule wins.
{ "source": "/02-back-end/prototype/(.*)",
  "headers": [{ "key": "Content-Security-Policy",
    "value": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src https://fonts.gstatic.com; style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com; frame-src https://www.youtube-nocookie.com; frame-ancestors 'none'; base-uri 'none'; object-src 'none'" }] }

// B · or keep one strict policy and exclude the prototype from it:
//     "source": "/((?!02-back-end/prototype).*)"
```

**Verify which header actually lands — do not assume:**

```bash
curl -sI https://<the-vercel-url>/02-back-end/prototype/index.html | grep -i content-security-policy
```

> The strict policy on the **real app** is right and must not be loosened. This
> is only about the one static page that is explicitly not the product.

---

## Shared shipping duties

- **Deployment is VERCEL, not GitHub Pages.** Import the repo on Vercel: no
  build command, no environment variables, output directory is the repo root.
  Vercel can send HTTP response headers, which is what 03 · Security needs for
  a real Content-Security-Policy instead of a `<meta>` tag.
- Put the live URL in the repo README and the About box.
- **Vercel serves every file in the repo**, including `prototype/index.html`.
  That is why it carries a design-study banner and `robots: noindex`. Check
  both are still there after any merge — open the live prototype URL once on
  Wednesday and look at the top of the page.
