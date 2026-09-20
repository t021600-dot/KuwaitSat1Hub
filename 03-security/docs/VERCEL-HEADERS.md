# `vercel.json` — LINE BY LINE

**Owner:** 03 · Security · **File it documents:** [`../../vercel.json`](../../vercel.json) (repo root)
**Why this document exists:** **JSON cannot hold comments.** Put a `//` in `vercel.json`
and the deployment fails to parse. So the file stays clean and every line of it is
explained here. If you change `vercel.json`, change this file in the same commit.

---

## What changed, and why it matters to `se-m4`

We moved the host from **GitHub Pages to Vercel**. GitHub Pages serves static files
and **cannot send HTTP response headers you choose**. Vercel **can**.

Everything that used to be written down as *"unavailable to us, not misconfigured"* —
a real `Content-Security-Policy` header, `frame-ancestors`, HSTS — is now **available
and shipped**. Any doc still saying we cannot send headers is **out of date and
wrong**, and a wrong sentence said to a judge costs more than the control it was
apologising for.

> **The one sentence to say:** *"The CSP is a real HTTP response header from
> `vercel.json`, not only a meta tag — so `frame-ancestors` and HSTS actually apply."*

**Proof, 15 seconds, on the live URL:** DevTools → **Network** → click the document
request → **Response Headers**. All six are listed. That is a screenshot for
`audit/evidence/se-m4-response-headers.png`, and it is stronger evidence than View
Source, because a header cannot be faked by the page.

---

## Where the file goes and how it takes effect

`vercel.json` lives at the **repo root**, next to `index.html`. Vercel reads it on
every deployment. There is **no build step** — this is still plain static
HTML/CSS/JS, exactly as `DECISIONS.md` says.

**Project settings on Vercel** (Settings → General), so nobody guesses on Thursday:

| Setting | Value |
|---|---|
| Framework Preset | **Other** |
| Build Command | **empty** (override off) |
| Output Directory | **empty** — serves the repo root |
| Install Command | **empty** |

**Headers apply to preview deployments too**, not only production. That is good —
but a preview deployment is a *public URL*, which is its own problem. See
[`SUPABASE-SETTINGS.md`](SUPABASE-SETTINGS.md) §2b.

---

## The file, line by line

### `"$schema": "https://openapi.vercel.sh/vercel.json"`

Not a setting. It tells VS Code which schema to validate against, so a typo in a key
name is underlined in the editor instead of discovered by a failed deployment. Vercel
ignores it.

### `"headers": [ ... ]`

The list of header rules. Each entry is `{ "source": ..., "headers": [...] }`. We have
exactly one entry, because every header below should be on every response.

### `"source": "/(.*)"`

**Which URLs the rule applies to.** `/(.*)` is *"the site root plus everything under
it"* — `index.html`, `css/style.css`, `js/config.js`, `vendor/leaflet.js`, every page.

> **Do not "tidy" this to `"/*"`.** Vercel's matcher wants a capture group here.
> `/(.*)` is the form Vercel's own documentation uses, and it is the one we tested.

---

### 1 · `Content-Security-Policy`

The long one. It is the **allowlist of where the browser may load things from**. If a
directive does not list an origin, the browser refuses to fetch from it — and refuses
**silently**, with only a console line. Read every clause below before changing one.

| Clause | What it does | Why ours says that |
|---|---|---|
| `default-src 'self'` | the fallback for every directive not named | our own origin only, so anything we forget to think about is denied by default rather than allowed |
| `script-src 'self'` | where JavaScript may come from | **no `'unsafe-inline'`, on purpose.** This is the directive that actually stops stored XSS, and it is the reason there are **zero `onclick=` attributes** in the app — every handler is `addEventListener` in a `.js` file. It also means **no CDN**: `leaflet.js` and `supabase-js` are self-hosted in `vendor/` and committed |
| `style-src 'self' 'unsafe-inline'` | where CSS may come from | keeps `'unsafe-inline'` because our pages carry inline `style="…"` attributes and Leaflet's own CSS. Inline **style** is a far weaker risk than inline **script**. **Never let anyone "tidy" this same allowance onto `script-src`** |
| `img-src 'self' data: …` | where images may come from | the map tiles are images. `data:` is for small inline icons |
| `… https://PROJECTREF.supabase.co` (in `img-src`) | Supabase-served images | harmless today (D-2 says no Storage), kept so an avatar or a tile proxy does not blank the page later |
| `… https://tile.openstreetmap.org` | the bare tile host | |
| `… https://*.tile.openstreetmap.org` | **the subdomain wildcard** | **the line that keeps the map from being blank.** Leaflet's tile template is `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`, where `{s}` becomes `a`, `b` or `c` (see `01-front-end/app/js/ui.js`). CSP host sources **do not match subdomains** without an explicit `*.`. List only the bare host and **every tile is blocked**, with a console violation nobody reads until Thursday |
| `connect-src 'self' https://PROJECTREF.supabase.co` | where `fetch`/XHR may go | the Supabase origin, or **every read on the site fails silently**. There is deliberately **no `wss://`** — `DECISIONS.md` **D-6** says we poll `my_agent_steps` every 2 s rather than use Realtime. Add `wss://` only if that decision is ever reversed |
| `font-src 'self'` | where fonts may come from | we ship no web font; this stops one being added by accident from a CDN |
| `form-action 'self'` | where a `<form>` may submit to | stops an injected form posting a researcher's input to somebody else's server |
| `frame-ancestors 'none'` | **who may put our site in an iframe** | **nobody.** This is the clickjacking control. It was genuinely unavailable on GitHub Pages — `frame-ancestors` is **ignored inside a `<meta>` tag** and only works as a response header. On Vercel it works, so we can now claim clickjacking protection honestly |
| `frame-src 'none'` | what **we** may embed | we embed nothing. Cheap, no downside |
| `base-uri 'none'` | stops an injected `<base href>` | an injected `<base>` silently re-points every relative URL on the page at an attacker's host |
| `object-src 'none'` | no `<object>`/`<embed>` plugins | cheap, no downside |

**`PROJECTREF` is a placeholder. Replace it with our real Supabase project ref** (both
places — `img-src` **and** `connect-src`) before the first deploy, and re-check it on
Wednesday. The ref is the first label of the project URL in `js/config.js`:
`https://abcdefghijklm.supabase.co` → `abcdefghijklm`.

**Do NOT add `upgrade-insecure-requests`.** It rewrites `http://` to `https://` before
the request leaves, so the console goes clean while any host with no HTTPS fails as a
missing file instead. **It converts a loud failure into a silent one, on the exact
night you need the loud one.** Fix the URL; do not paper over it.

#### The meta tag and the header both exist. That is fine — know the rule.

`docs/csp-meta.html` still goes in every page `<head>`. When a page has **both**, the
browser enforces **both**, i.e. the **intersection** — a request must be allowed by
each policy independently. Ours are the same policy, so the intersection is the
policy. **The consequence to remember: loosening only one of them changes nothing.**
If you add an origin, add it to **both files** or you will spend an hour on a block
that "should not be happening".

The meta tag is kept because it still protects the page when someone opens it from
`file://` or a plain local server during a build night, where no header exists.

---

### 2 · `Strict-Transport-Security: max-age=31536000; includeSubDomains`

*"For the next year, never speak to this origin over plain `http://` again — not even
once, not even if a link says so."* The browser upgrades the request itself, before it
goes out, so a first-request downgrade on venue wifi cannot happen twice.

- `max-age=31536000` — one year, in seconds. The common recommendation.
- `includeSubDomains` — applies to subdomains as well.
- **No `preload`, on purpose.** `preload` ships the domain into a list baked into
  browsers, and **getting off it takes months**. You also cannot preload a
  `*.vercel.app` subdomain — the `vercel.app` parent is already preloaded. It is an
  irreversible decision for a four-day prototype. Do not add it.

Honest limit worth saying: HSTS only protects a browser that has **already visited
once** over HTTPS. It is not a first-visit control. It is still real, and it was
genuinely not available to us before.

### 3 · `X-Content-Type-Options: nosniff`

*"Trust the `Content-Type` I sent; do not guess from the bytes."* Without it a browser
may sniff a file we serve as text and decide it is actually a script, and run it. One
word, no downside, and it is the cheapest header in the list.

### 4 · `Referrer-Policy: no-referrer`

*"Never tell the next site where the visitor came from."*

**This one is project-specific, not boilerplate.** `THREAT-MODEL.md` §3b already
admits that our basemap host can infer which area of Kuwait a researcher is panning
over, from the tile requests. Without this header, every one of those tile requests
would **also** carry our page URL as the `Referer` — which can contain a mission id.
`no-referrer` removes that. It does not fix the tile-traffic disclosure (only
self-hosting tiles would), but it stops us from handing over the mission id as well.

Nothing on our site depends on a referrer, so there is no cost.

### 5 · `Permissions-Policy: accelerometer=(), … xr-spatial-tracking=()`

*"This site will never ask for any of these device capabilities."* An empty `()` means
**allowed for nobody, including ourselves**.

Camera, microphone, geolocation, payment, USB, screen capture and the rest are all
turned off. A research dashboard needs none of them, so declaring it costs nothing —
and it means an injected script cannot prompt a judge for their camera on stage.

> **`geolocation=()` deserves a sentence of its own:** our map is about drawing an area
> of Kuwait, not about where the *researcher* is standing. Turning the capability off
> at the platform level makes that a property of the site rather than a promise about
> our code.

### 6 · `X-Frame-Options: DENY`

The **older** clickjacking header. `frame-ancestors 'none'` in the CSP above is the
modern one and does the same job. This is here for browsers old enough to ignore
`frame-ancestors`. Belt and braces, one line, no conflict — where both are understood,
`frame-ancestors` wins.

---

## What `vercel.json` deliberately does **not** contain

- **No `rewrites`, no `redirects`, no `cleanUrls`.** Every one of those changes which
  file answers which URL, and we are two nights from a demo. Headers only.
- **No secrets.** `vercel.json` is committed and public. Nothing goes in it that is not
  already public — see `SECRETS.md`. The Supabase project ref **is** public (it is in
  `js/config.js` by design, safe only because RLS is on). The **secret / service-role
  key never appears here** or anywhere in this repo.
- **No `functions`.** We deploy no serverless function. The browser's only backend is
  Supabase, and the agent path is n8n polling `claim_next_run()` — see `DECISIONS.md`
  **D-1**.

---

## Verify it actually shipped — 60 seconds, do it Tuesday and again Wednesday

1. **Open the live URL in a private window.** Padlock in the address bar.
2. **DevTools → Network → the document request → Response Headers.** All six are
   there. Screenshot → `audit/evidence/se-m4-response-headers.png`.
3. **Console, on the mission page with the map drawn.** No CSP violations, no
   mixed-content warnings. If tiles are missing, the `*.tile.openstreetmap.org` line
   is the first thing to read.
4. **Command line, if you prefer a paste-able artefact** (PowerShell 5.1, and remember
   there is no `&&` in it):

   ```powershell
   $r = Invoke-WebRequest -Uri 'https://<our-app>.vercel.app/' -UseBasicParsing
   $r.Headers.GetEnumerator() | Sort-Object Name | Format-Table -AutoSize
   ```

   Save the output to `audit/evidence/se-m4-response-headers.txt`.
5. **The clickjacking proof, which is new and takes ten seconds.** Make a scratch
   `frame-test.html` **outside** the repo, containing
   `<iframe src="https://<our-app>.vercel.app/"></iframe>`, open it locally, and watch
   it refuse to render with a console message naming `frame-ancestors`. That is a
   control we could not demonstrate at all on the old host.

---

## Hand-offs (things outside `03-security/` that this depends on)

| For | What | Why |
|---|---|---|
| **05 · Ship / whoever owns the deploy** | Create the Vercel project with Framework Preset **Other** and **no build command**, and turn **Deployment Protection** on for Preview deployments | a preview deployment is a public URL of the whole app — see `SUPABASE-SETTINGS.md` §2b |
| **05 · Ship** | Replace `PROJECTREF` in `vercel.json` (two places) with the real project ref, in the same commit that sets `js/config.js` | the site loads but every Supabase call is blocked if this is missed, and it fails **silently** |
| **01 · Front end** | Keep `docs/csp-meta.html` in every page `<head>`, unchanged | the meta and the header are the same policy; they are enforced as an intersection |
| **01 · Front end** | Still **zero `onclick=`** attributes; every handler `addEventListener` | `script-src 'self'` has no `'unsafe-inline'` |
| **Everyone** | Repo READMEs still say "GitHub Pages" | those files are not mine to edit — the host is Vercel now |
