# HTTPS AND CONTENT SECURITY POLICY — se-m4

**Owner:** 03 · Security · **Build:** Monday · **Re-verify:** Tuesday, on the borrowed laptop
**The judge's test:** the address bar, plus the console for mixed-content warnings.

> ### ⚠️ THE HOST CHANGED. READ THIS BEFORE YOU QUOTE ANYTHING BELOW.
>
> We deploy to **Vercel**, not GitHub Pages. Vercel **can send HTTP response
> headers**; GitHub Pages could not. Everything this file used to write down as
> *"unavailable to us, not misconfigured"* is now **available and shipped**:
>
> - the CSP is a **real `Content-Security-Policy` response header**, from
>   [`../../vercel.json`](../../vercel.json)
> - **`frame-ancestors 'none'` works**, so we *do* have clickjacking protection
> - **HSTS (`Strict-Transport-Security`) is set**
> - plus `X-Content-Type-Options`, `Referrer-Policy: no-referrer` and
>   `Permissions-Policy`
>
> Line-by-line explanation of every header: [`VERCEL-HEADERS.md`](VERCEL-HEADERS.md).
> **Do not say "our host cannot send headers" to a judge — it has not been true
> since we moved.**

---

## Why this is not a five-minute tick for us

`se-m4` is trivial for a project whose pages load nothing but their own text.
**Ours is the opposite.** The mission page is a **map with overlays**: basemap
tiles from one origin, agent-step rows from Supabase, result geometry drawn on
top. That is three or four outside origins on the single page our whole demo
lands on.

And a blocked subresource produces **no error on the screen** — just a blank map
at 2:15pm on Thursday.

**Do it Monday, re-verify Tuesday.** Tuesday is when 05 runs `sh-m4` ("the demo
runs from the public URL, on a machine that did not build it"), and that is the
first time our HTTPS story meets a machine that is not ours.

---

## Three layers, because a URL reaches the browser three ways

| Layer | Stops | Where |
|---|---|---|
| Repo scan | an `http://` somebody **typed** | `check-mixed-content.ps1` below |
| CSP, as a response **header** (and the same policy in the page head) | an `http://` anything builds **at runtime** | [`../../vercel.json`](../../vercel.json), plus the meta tag below |
| CHECK constraint | an `http://` **the AI agent writes into a row** | `db/` addition below |

**The third one is ours alone and nobody else will think of it.** The
Visualization or Reporting agent writes a row. If that row carries
`http://…`, every line of our code is correct, every scan passes, and the page
still breaks — for exactly one mission, possibly the demo one. **Data is an
input surface too.**

---

## 1 · The CSP — one policy, shipped two ways

**The authoritative copy is the response header** in
[`../../vercel.json`](../../vercel.json). Vercel sends it on every response,
including preview deployments, with no build step.

Paste the **same** policy as a `<meta>` tag into the `<head>` of **every** page:
`index.html`, `signin.html`, `dashboard.html`, `mission.html`, `report.html`.
Replace `PROJECTREF` with our Supabase project ref **in both files**.

**Why keep the meta tag at all, now that we have the header?** Because a header
only exists when a server sends one. Open a page from `file://` or a bare local
static server on a build night and the header is gone; the meta tag still
protects the page. It is a belt for the nights the braces are not there.

**The rule that will cost you an hour if you do not know it:** when a page has
**both** a CSP header and a CSP meta tag, the browser enforces **both** — a
request must satisfy each policy independently. So **loosening only one of them
changes nothing.** Add an origin to `vercel.json` *and* to `csp-meta.html`, in
the same commit, or you will debug a block that "should not be happening".

```html
<!-- Content Security Policy · owner: 03 Security · one source of truth -->
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self';
               script-src 'self';
               style-src 'self' 'unsafe-inline';
               img-src 'self' data: https://PROJECTREF.supabase.co
                       https://tile.openstreetmap.org
                       https://*.tile.openstreetmap.org;
               connect-src 'self' https://PROJECTREF.supabase.co;
               font-src 'self';
               form-action 'self';
               base-uri 'none';
               object-src 'none'">
```

**Line by line, so you can defend it:**

- **`script-src 'self'` — no `'unsafe-inline'`.** This means **zero `onclick=`
  attributes** anywhere; every handler is `addEventListener` in a JS file. Tell
  01 on **Monday**, not Wednesday — retrofitting this is an evening's work.
- **`style-src` keeps `'unsafe-inline'`** because an inline `<style>` block needs
  it. Inline *style* is a far weaker risk than inline *script*. If a judge asks,
  that is the honest answer. **Do not let anyone "tidy" the same allowance onto
  `script-src`.**
- **`img-src` lists BOTH `tile.openstreetmap.org` and `*.tile.openstreetmap.org`.**
  CSP host sources do **not** match subdomains without an explicit wildcard, and
  Leaflet's standard tile template is `https://{s}.tile.openstreetmap.org/...`
  where `{s}` becomes `a`, `b`, `c`. List only the bare host and **the map is
  blank** with a CSP violation in the console that nobody reads until Thursday.
  (Using MapLibre or Mapbox GL instead? Add `worker-src 'self' blob:`.)
- **`connect-src`** must include the Supabase origin or **every read on the site
  fails silently.** Add `wss://PROJECTREF.supabase.co` **only** if we use
  Realtime — per `DECISIONS.md` D-6 we poll instead, so it is deliberately
  absent. A `ws://` (no `s`) is mixed content and is blocked anyway.
- **`object-src 'none'`, `base-uri 'none'`** — cheap, no downside.

### Two things that USED to be limitations and are now controls

Both of these were written down as honest gaps while we were on GitHub Pages.
On Vercel they are real, shipped, and demonstrable. **Update the sentence you
rehearsed.**

- **`frame-ancestors 'none'` is in the header, so clickjacking protection is
  real.** It is still **ignored inside a `<meta>` tag** — that part never
  changed, and it is why the header matters. So the directive lives in
  `vercel.json` only, and the meta tag deliberately does not carry it (a meta
  policy containing it is not an error; the browser just drops that directive).
  `X-Frame-Options: DENY` rides along for older browsers.
  **Ten-second proof:** an `<iframe>` pointing at our live URL, in a scratch
  file outside the repo, refuses to render.
- **`Strict-Transport-Security` is set** —
  `max-age=31536000; includeSubDomains`, deliberately **without `preload`**
  (preload is effectively irreversible, and you cannot preload a `*.vercel.app`
  subdomain anyway). If asked: *"HSTS is on for a year; we left preload off
  because it is a decision you cannot take back in a four-day project."*
  The honest limit: HSTS protects a browser that has **already** visited once
  over HTTPS. It is not a first-visit control.

Three more headers ship alongside them — `X-Content-Type-Options: nosniff`,
`Referrer-Policy: no-referrer` and `Permissions-Policy`. `no-referrer` is the
project-specific one: without it, every basemap tile request would carry our
page URL — which contains a mission id — to a third-party host.
See [`VERCEL-HEADERS.md`](VERCEL-HEADERS.md) for all six, line by line.

### Do NOT add `upgrade-insecure-requests`

It rewrites `http://` to `https://` **before the request goes out**, so the
console goes clean and you think you passed — while any host with no HTTPS just
fails as a missing file instead. **It converts a loud failure into a silent
one, on the exact night you need the loud one.** Fix the URLs; do not paper over
them.

### Self-host the libraries

`script-src 'self'` means **no CDN**. Download `supabase-js` and the map library
into `vendor/` and commit them. Leaflet is already there
(`01-front-end/app/vendor/leaflet.js` + `leaflet.css` + `vendor/images/`);
**`supabase-js` still needs doing** — that is the one outstanding item on this
line. Ten minutes, tonight, and it removes the
question permanently — otherwise the CSP blanks the page and somebody "fixes" it
by adding `'unsafe-inline'` at 23:00.

---

## 2 · The repo scan — `check-mixed-content.ps1`

PowerShell 5.1, Windows 11. Remember: **no `&&`** in PS 5.1.

```powershell
# se-m4 repo scan. Run from the repo root. ~3 seconds. Owner: 03 Security.

# (a) every plain-http URL in anything the browser parses. The main hit list.
git grep -nE "http://" -- "*.html" "*.js" "*.css" "*.json"

# (b) same scan if the folder is not a git checkout yet
Select-String -Path .\*.html,.\js\*.js,.\*.css -Pattern "http://" -AllMatches |
  Select-Object Path,LineNumber,Line

# (c) protocol-relative URLs: //cdn.example.com/x.js inherits the page scheme.
#     Safe on https today; a live mixed-content bug the moment the file is
#     opened locally. Write them out in full.
git grep -nE '(src|href)="//' -- "*.html" "*.js"

# (d) hosts assembled at runtime. A scan of static strings cannot see these.
#     Every hit must be read by eye.
git grep -nE "'http|\"http|\+ *host|concat\(" -- "*.js"

# (e) proof the CSP is on EVERY page, not just the one you edited.
Get-ChildItem -Filter *.html | ForEach-Object {
  $hit = Select-String -Path $_.FullName -Pattern "Content-Security-Policy" -Quiet
  "{0,-20} CSP: {1}" -f $_.Name, $hit
}
```

### Triage — the false positive that eats twenty minutes

| Hit | Verdict |
|---|---|
| `xmlns="http://www.w3.org/2000/svg"` | **FALSE POSITIVE.** An XML namespace identifier. Nothing is fetched. Leave it. |
| `http-equiv="Content-Security-Policy"` | **FALSE POSITIVE.** Your own CSP line matching its own scan. |
| `http://…tile…`, any `<img src="http://`, any `fetch("http://` | **REAL.** Fix to https. If the host has no https, the resource is **cut**, not shipped. |
| `//unpkg.com/leaflet…` | **REAL** (protocol-relative) *and* it breaks the self-host rule. Download it. |

Save the raw output to `audit/evidence/se-m4-repo-scan.txt` the night you run it.

---

## 3 · The layer only we will think of — HTTPS in the database

Per `DECISIONS.md` D-2 we ship **no Supabase Storage** this week, so there
should be **no URL columns at all**. That is the cheapest possible version of
this control.

But if a URL column appears — someone adds a preview image, a tile source, an
external scene reference — add the constraint the same evening:

```sql
-- se-m4 in the database: no row may carry a URL the browser would load
-- over http. Also a guardrail: the agent can only point at our own origin.
alter table public.results
  add constraint results_asset_url_https
  check (asset_url is null or asset_url ~ '^https://[a-z0-9-]+\.supabase\.co/');
```

**Confirm the real column name with 02 first.** A constraint against a column
that does not exist errors immediately; a constraint against the *wrong* column
is worse — it passes and protects nothing.

### The verification query, and the bug in the obvious version

```sql
-- WRONG — case-sensitive, and misses protocol-relative URLs
select count(*) from public.results where asset_url like 'http://%';

-- RIGHT — reports anything that is not an https URL
select count(*) from public.results where coalesce(asset_url,'') !~* '^https://';
```

The `like 'http://%'` version misses `HTTP://evil/x.png` and misses
`//evil.example/x.png` (protocol-relative, which inherits the page scheme).
Use the negative match.

### A scheduling warning

The constraint is a **whitelist**, so a rejected insert is not a broken image —
it is a **failed mission**. The Visualization agent tries to write its row,
Postgres refuses, the n8n node goes red. Do not weaken the constraint; instead
get the real column names from 02 **Monday evening, not Tuesday at 23:40**, and
run the `select` above over existing rows before you add it.

---

## Proof for the judge — 20 seconds

1. **The address bar.** The padlock, on the live public URL, in a private
   window. Not localhost.
2. **The console, on the mission page with the map drawn.** No mixed-content
   warnings, no CSP violations. Scroll it so they can see it is empty.
3. **DevTools → Network → the document request → Response Headers.** All six
   headers are listed: `Content-Security-Policy`, `Strict-Transport-Security`,
   `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`,
   `X-Frame-Options`. **This is the strongest beat in `se-m4`** — a response
   header cannot be faked by the page, the way a meta tag in View Source can.
   Evidence: `audit/evidence/se-m4-response-headers.png`.
4. **View Source** on any page — the same CSP is there as a meta tag too, for
   the nights the page is opened without a server.
   This one is worth having as a `se-m6` fix too, if the audit finds the CSP
   missing or weak on Monday.

Run it on a **freshly launched mission**, not just a completed one — the whole
reason `se-m4` is hard here is that the agent writes rows at runtime, and a
completed mission only proves the URLs written by a run that already happened.

Evidence: `audit/evidence/se-m4-console-clean.png`,
`audit/evidence/se-m4-response-headers.png` and
`audit/evidence/se-m4-view-source-csp.png`.
