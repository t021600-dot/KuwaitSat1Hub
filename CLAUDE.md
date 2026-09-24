# Working on this repo

This file loads automatically at the start of every Claude session in this
repository, for everyone on the team. It exists because the rules below used
to live only in one person's chat history, which meant a second laptop knew
none of them.

Read it before changing anything. Most of it is not style preference; it is
a list of things that have already gone wrong once.

---

## STOP and ask a human before any of these four

These are licence questions or live-database changes. They are quick to
answer, they are just not yours to decide alone.

1. **Committing anything from the geospatial data package.** Most of it is
   OpenStreetMap under ODbL. This repository is not ODbL. If it is ever
   committed it has to travel with `LICENSE-DATA.md`, and every map that
   renders it has to credit OpenStreetMap.
2. **Re-hosting the Marine Regions files** (EEZ, territorial sea). Their
   licence permits it, but they ask people not to re-host them.
3. **Choosing between the two Jahra / Ahmadi boundary versions** in that
   package. See its README, "Open questions". The choice changes which
   polygons every analysis runs against.
4. **Changing `kuwait_area_ok()`.** That is a database change, applied by
   hand in the Supabase SQL editor after review, never from here.

## Staging: by name, always

**Never run `git add .` or `git add -A`.** Stage files by name:

```bash
git add index.html js/ksat-report.js       # yes
git add .                                  # NO
```

`git add .` sweeps in whatever is reachable, and the ODbL data package above
is sometimes reachable. Getting it back out of the history means rewriting a
repo several people have already pulled.

## `main` is live

Whatever is on `main` is what the public sees. Never push to it directly.
One branch per piece of work, named `<job>/<what>`, then a pull request that
a teammate looks at:

```bash
git checkout -b front-end/sign-in-error
```

## Turn the secret scanner on, once per clone

Git never installs hooks from a clone, so a fresh checkout has no secret
scanning at all until you run:

```bash
git config core.hooksPath tools/hooks
```

The hook blocks real JWTs and password-shaped strings from entering a commit.

## Secrets

- `js/config.js` holds `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`, and
  they are **committed on purpose**. The browser has to receive them, so
  hiding them would be theatre. They are safe *only* because row level
  security is on every table. If RLS is ever switched off, that file becomes
  a download link to every researcher's private work.
- The **secret / service-role key** must never appear in this repo, in a
  `.env`, or in a chat window. It lives in the n8n credential store.
- The **researcher dataset never enters this repository.** The instruction
  was that the data is available on the researcher page after sign in and
  nowhere else. A public repo is "nowhere else", and so is a CSV somebody
  exported while debugging.

## Adding a feature: add a file, do not edit the page

The house pattern. Rather than editing `index.html` or `researcher.html` to
add behaviour, write a new `js/ksat-<thing>.js` as an IIFE hanging off
`window.KSAT`, and add one line to the page that loads it. Where the page
rebuilds its own DOM, use a `MutationObserver` instead of running once.

This keeps three very large HTML files reviewable, and it means two people
can add features the same evening without colliding.

## No CDN, ever

`vercel.json` sets a Content Security Policy with `script-src 'self'`. A
library loaded from a CDN **works on localhost and silently fails in
production**. Vendor it into `vendor/` instead, the way Leaflet already is,
and commit it.

## A new file also goes in `.vercelignore`

`.vercelignore` denies the whole repo with `*` and re-allows files by name.
That is deliberate: without it the deployment published the RLS policy SQL,
the threat model, and two ungated copies of the app.

The consequence is that **a new script, stylesheet or asset will 404 in
production while working perfectly on localhost** until you add it to the
allow list. This catches everyone exactly once.

## Running it

No build step, no `npm install`, no `.env`. Serve over HTTP:

```bash
python -m http.server 8791
# then http://127.0.0.1:8791/index.html
```

Do **not** open the files with `file://`. Fetches and relative paths fail
under that origin and the page looks broken for reasons unrelated to your
change.

If a CSS or JS edit seems to do nothing, it is the browser cache, not your
code. Hard reload with `Ctrl+Shift+R`. This has cost real hours here.

## Claims the site makes about data

The project's credibility rests on not overclaiming, so these are enforced
in the copy as much as in the code:

- **No NDVI.** The payload has no near-infrared band. The site uses Excess
  Green, `2g - r - b`, and says so.
- **No temperature in degrees.** MODIS arrives as a rendered image, not
  calibrated values. Relative heat only, never a figure in Celsius.
- **No invented coordinates.** Frames that could not be geolocated against
  reference imagery are recorded as having no position. A plausible
  coordinate is worse than a missing one.
- The footer states that KuwaitSat-1 imagery is used **with permission for
  the imagery**, and that the project is otherwise independent and
  unendorsed. Do not upgrade that claim.

## Prose

No em dashes in anything a visitor reads. Use commas, or a hyphen. Links and
code are untouched by this.

## CI

`.github/workflows/ci.yml` runs on every push and needs no secrets. It checks
that every `.js`/`.mjs` and `.json` parses, that every local file
`index.html` references is committed, that the agent test suites in
`04-agents/tests/` pass, and that nothing loads from a CDN.

Note it currently validates `index.html` only. `researcher.html` and
`portal.html` are not machine-checked, so check their references by hand.
