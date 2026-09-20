# 🖥️ Job 01 · Front end

**Owner:** Retag · **GitHub:** *to fill in*
*Everything a person touches. The single entry point for this role.*

---

## What this role is

> **If a stranger cannot reach the result without being told what to click,
> nothing else we built matters.**

Four screens that link, forms that always answer, and a page that works on a
phone held in one hand. This is the only part of the project a judge experiences
*directly* — everything else is experienced through it.

| | |
|---|---|
| **My share of the bar** | **5** of the 28 MUST items (`fe-m1` … `fe-m5`) |
| **The judge's question to me** | *"What happens when this button is pressed?"* |
| **The test I cannot fake** | Hand your phone to another team. Say nothing. If you have to speak, it failed |

---

## What is in here

### `app/` — the front end

The real screen set, plain HTML/CSS/JS, no build step:

```
index.html        landing
login.html        sign in
missions.html     the researcher's mission list
new-mission.html  objective + map area
mission.html      one mission, the agent strip, the map
report.html       the generated report

js/data.js        THE DATA LAYER  ← the important one, see below
js/agents.js      the six agent steps
js/ui.js          shared helpers, including esc()
js/seed.js        demo data
vendor/leaflet.*  the map library, self-hosted
```

**Run it:** open `app/index.html`, or `python -m http.server 8000` in `app/`.

---

## Four things done right, and they are worth naming

**1 · `js/data.js` is a swappable data layer.** Every function has the exact
Supabase call it will become written above it as a comment:

```js
/* -> supabase.auth.signInWithPassword({ email, password }) */
/* -> supabase.from('missions').select('*').eq('owner_id', user.id) */
```

That is the right architecture. Wiring the real back end means filling in
those functions — **not rewriting the screens.**

**2 · There is a proper escaping helper.** `esc()` in `js/ui.js` uses the
`textContent` → `innerHTML` round-trip, which is the correct pattern. Only three
`innerHTML` sites in the whole codebase, and an `esc()` to feed them. Compare
101 unescaped sites in the other prototype — this one is in good shape.

**3 · No `maxlength` on the objective textarea.** This matters more than it
looks. `maxlength` silently truncates the judge's 5,000-character paste, the form
accepts it, **a row is created**, and nothing ever says no — which fails `se-m5`
while the screen looks like it worked. Leaving it off is correct.

**4 · Leaflet is self-hosted in `vendor/`.** No CDN, which is what our CSP needs
(`script-src 'self'`). Already done.

---

## ⚠️ Two things that must change before demo day

### 1 · `se-m3` — FIXED. (Kept as the record of what was wrong.)

```js
// js/seed.js:116
id: 'usr_a', email: 'researcher.a@kuwaitsat.kw', password: '<REDACTED>',
```

```html
<!-- login.html:55 -->
<div class="mono">researcher.a@kuwaitsat.kw &nbsp; &lt;REDACTED&gt;</div>
```

The judge's `se-m3` test is *"your app never stores a password, and none is shown
on any screen or table."* Right now both halves fail: plaintext in `seed.js`, and
printed on the sign-in page.

**The fix comes free with the real back end.** Supabase Auth holds the password
hash in `auth.users`; we never see it, never copy it, never store it. Delete the
`password` field from `seed.js` and the credentials block from `login.html` as
soon as sign-in is real.

### 2 · `se-m1` is a **fake PASS** — the isolation is in JavaScript

The `RETAG-NOTES.md` says:

> *"Signing in as B proves the isolation: none of A's work is visible."*

The **screens** behave correctly. But the whole database sits in **one
`localStorage` key**, which means:

> **Researcher B's browser is holding Researcher A's data.** It is simply not
> being drawn.

Open DevTools → Application → Local Storage while signed in as B, and A's
missions are right there in the JSON. A judge who does that — and `se-m4`'s own
test invites them into DevTools — sees the whole thing.

This is exactly what `tests/RLS-TEST-MATRIX.md` calls a **fake PASS**:

> **Real PASS** — the check goes to the API and comes back with 0 rows or an error.
> **Fake PASS** — the row came back and our JavaScript chose not to draw it.

**Not a criticism of the build** — for a front end with no back end yet, this is
the only way to demo the flow, and building it this way was right. But `se-m1` is
the item a judge asks 03 · Security about **by name**, and it cannot pass until
the data lives in Postgres with row level security deciding what comes back.

---

## Wiring it to the real back end

Everything needed is already in the repo. Fill in `js/data.js`:

| `data.js` function | Becomes |
|---|---|
| sign in | `sb.auth.signInWithPassword({ email, password })` |
| sign up | `sb.auth.signUp({ email, password })` |
| current user | `sb.auth.getUser()` |
| list missions | `sb.from('my_missions').select('*')` |
| one mission | `sb.from('missions').select('*').eq('id', id).single()` |
| create mission | `sb.from('missions').insert({ title, objective, area_geojson }).select('id').single()` |
| launch | `sb.rpc('launch_mission', { p_mission_id: id })` |
| agent steps | `sb.from('my_agent_steps').select('*').eq('run_id', runId)` |
| generate report | `sb.rpc('generate_report', { p_mission_id: id, p_body_md: md })` |

**Do not filter by owner in JavaScript.** Drop the `.eq('owner_id', …)` — row
level security does it, and doing it client-side is what makes a fake PASS look
like a real one. `my_missions` already returns only what the caller may read.

The client is set up in [`../js/config.js`](../js/config.js) at the repo root.
Run [`../03-security/db/`](../03-security/db/) `01` → `06` first.

---

## Three smaller things

- **`maxlength="80"` on the title input** (`new-mission.html:32`) — same
  truncation trap as the objective, smaller field. Use a counter instead.
- **No Content-Security-Policy** on any page. Paste
  [`../03-security/docs/csp-meta.html`](../03-security/docs/csp-meta.html) into
  every `<head>`. It is written for self-hosted Leaflet and OpenStreetMap tiles.
- **Going live:** GitHub Pages serves from the repo **root**, so when we ship,
  the contents of `app/` move up to the root. Until then `app/` keeps it tidy.

---

## My MUST items

- `fe-m1` a stranger reaches the main result without being told what to click
- `fe-m2` at least four working screens, every link works
- `fe-m3` every form answers: success, error, or loading. Never nothing
- `fe-m4` works on a phone in portrait: no sideways scroll, thumb-sized buttons
- `fe-m5` the result is on the screen, not in the console

## Shared shipping duties

- Check the live site works on a **laptop that did not build it**
- Two full rehearsals on Wednesday, and explain your own part with no slides
