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

### `prototype/` — KuwaitSat Green Intelligence

A **complete, working, self-contained research console.** ~6,000 lines in one
HTML file: launch sequence, objective entry, area and period selection, seven
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

Not a rewrite. The prototype becomes the **front end** and we put a real back
end underneath it. The SQL is already written and waiting in
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
- `be-m4` real accounts: two people sign up separately, each starts empty
- `be-m5` every automated run leaves a row: what started it, when, status, result

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

## Shared shipping duties

- Turn on **GitHub Pages**: Settings → Pages → Source `main`, folder `/ (root)`
- Put the live URL in the repo README and the About box
