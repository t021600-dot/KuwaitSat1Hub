# api/ — the one server-side thing this site has

Owner: deployment. Everything else in this repository runs in a browser
or in the database. This folder holds a single Vercel serverless
function, and it exists because the spec's step 5 asks for a monitoring
agent on a nightly cron.

- `monitor.js` → `GET /api/monitor`, run at 02:00 UTC by the `crons`
  entry in `vercel.json`. It makes two POSTs and decides nothing:
  `public.sweep_stalled_runs(3)` to close runs that died overnight, then
  `public.monitor_record(...)` to leave a row saying it happened. Read
  the header comment in that file before changing it; it explains why
  the sweeper is called from two places on purpose, and why the record
  is written even when the sweep failed.

The second call depends on `03-security/db/11_monitoring.sql` having
been run against the project. Until it has, the endpoint still sweeps
and still returns `200`, with `"recorded": false` and a `record_error`
that says so — see section 2.

This README is **not deployed** — `.vercelignore` excludes it, along
with `js/README.md` and `assets/README.md`, so that the only things on
the live origin are the app and the function.

---

## 1 · Environment variables — set these in the Vercel dashboard

Settings → Environment Variables → **Production** (tick Preview too if
you want the endpoint to work on preview deployments; it is not
required for the demo).

| Variable | Value | What breaks without it |
| --- | --- | --- |
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` — no trailing slash needed, one is stripped anyway | 500, naming the variable |
| `SUPABASE_SERVICE_ROLE_KEY` | The **service role** key from Supabase → Settings → API | 500, naming the variable |
| `CRON_SECRET` | A random string you generate (below) | 500, naming the variable — the endpoint refuses to run rather than run unauthenticated |

All three are required. The function fails closed with a 500 and names
the missing variable, because a monitoring endpoint that returns 200
when it is not configured manufactures the evidence that everything is
fine.

### Where the service-role key goes, and where it must never go

**The Vercel dashboard, and nowhere else.** Not `js/config.js` — that
file holds the *publishable* key, which is public by design and, quite
correctly, cannot execute `sweep_stalled_runs` at all: the SQL revokes
it from `anon` and `authenticated` and grants it to `service_role`
only (`03-security/db/08_agent_claim.sql`). Not a committed `.env`, not
a Slack message, not a slide, and not on screen during the demo. It is
read only from `process.env`, and no value from `process.env` is ever
logged or returned — the error paths redact any environment value that
appears in a response body before it reaches a log.

If the key is ever pasted anywhere else, rotate it in Supabase before
doing anything else. The old one keeps working until you do.

### Generating `CRON_SECRET`

No install needed:

```
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Vercel sends this value back as `Authorization: Bearer <CRON_SECRET>`
on every cron invocation, which is what the function checks. The
comparison is constant-time. Without it, `/api/monitor` would be a
button the whole internet can press.

---

## 2 · Testing the endpoint

Replace the secret with the one you set. On Windows PowerShell 5.1 write
`curl.exe`, not `curl` — the bare name is an alias for
`Invoke-WebRequest` and does not take these flags.

```
curl.exe -i -H "Authorization: Bearer <CRON_SECRET>" https://kuwait-sat1-hub.vercel.app/api/monitor
```

| What you send | What you should get |
| --- | --- |
| The header above, correct secret | `200` and `{"ok":true,"swept":0,"idle_minutes":3,"recorded":true,...}` |
| No header, or a wrong secret | `401` `{"ok":false,"error":"Unauthorised."}` |
| `POST` instead of `GET` | `405`, with `Allow: GET` |
| Correct secret, a variable unset | `500`, naming the variable |
| Correct secret, the **sweep** refused | `502`, carrying the database's own sentence |
| Correct secret, the **record** refused | still `200`; `"recorded": false` and the reason in `record_error` |

The status code reports the sweep, because the sweep is the part that
protects the demo. A `monitor_record` that is merely not installed yet
would otherwise paint the cron red every night and send whoever opens
the deployments tab on demo morning hunting for a fault in a sweeper
that is working. So check `recorded` in the body, not only the colour of
the row. If you would rather know loudly, the single place to change it
is the status line at the end of `monitor.js`.

`"swept":0` is the normal, healthy answer. It means no run has been
sitting `running` with no activity for three minutes, and it is what you
should expect every night. To see a non-zero answer on purpose you need a
genuinely dead run in the database — section **5.6** of
`03-security/db/08_agent_claim.sql` sets one up and shows that the
sweeper leaves healthy runs alone while catching it. Note that
`node 04-agents/tools/rehearse.js --stall` does **not** do this: it is an
offline simulation and never touches Supabase, so it cannot move this
endpoint off zero.

### Checking the cron itself

The `crons` entry only takes effect on a **production** deployment —
preview deployments never run crons. After deploying, Vercel dashboard →
the project → Cron Jobs should list `/api/monitor` with the schedule
`0 2 * * *`. If the list is empty, the deployment did not pick up
`vercel.json`; check Settings → General → Root Directory points at the
repository root.

On the Hobby plan crons fire **once a day and within the hour** of the
stated time, not on the minute. That is fine for this job — it exists
to catch a run that died overnight, not to be punctual.

---

## 3 · Why there is no `package.json`

Adding one would give this static site an install step, and the build is
not allowed to grow one. Consequences worth knowing:

- `monitor.js` is CommonJS (`module.exports`). With no
  `"type": "module"` above it, Node reads every `.js` file as CommonJS,
  and `export default` would be a syntax error — `node --check
  api/monitor.js` refuses it before Vercel ever sees the commit.
- There is no `@supabase/supabase-js` here. The function uses the global
  `fetch`, which Node has had since 18 and Vercel's Node runtime is 18
  or newer. The function still checks for it and says so if it is
  missing, rather than throwing a bare `ReferenceError` at 02:00.

---

## 4 · Why `vercel.json` looks the way it does

`vercel.json` cannot carry comments. It is strict JSON and Vercel's
schema sets `additionalProperties: false`, so a `"//"` note key would
fail the deployment. The reasoning lives here instead, and the rest of
it — which files are uploaded at all — is commented at the top of
`.vercelignore`.

### Headers added

- **`Cross-Origin-Resource-Policy: same-origin`** — our own assets can
  no longer be pulled into somebody else's page as subresources.
- **`X-DNS-Prefetch-Control: off`** — no speculative DNS lookups for
  links the visitor has not clicked.

### Cross-Origin-Embedder-Policy: deliberately absent

`COEP: require-corp` was considered and rejected on evidence, not on
taste. Under it, every cross-origin subresource must either carry
`Cross-Origin-Resource-Policy` or be fetched with CORS, and every nested
iframe must itself send an **enforcing** COEP. Response headers as
observed on 21 September 2026:

| Origin | What it sends | Survives COEP? |
| --- | --- | --- |
| `fonts.googleapis.com` | `Cross-Origin-Resource-Policy: cross-origin` | yes |
| `fonts.gstatic.com` | `Cross-Origin-Resource-Policy: cross-origin` | yes |
| `tile.openstreetmap.org` | `Access-Control-Allow-Origin: *`, **no CORP** | no — plain `<img>` tiles are a no-cors load and would be blocked |
| `*.basemaps.cartocdn.com` | `Access-Control-Allow-Origin: *`, **no CORP** | no, same reason |
| `www.youtube-nocookie.com/embed/…` | `Cross-Origin-Embedder-Policy-**Report-Only**: require-corp` | no — report-only does not satisfy an enforcing parent, so the launch clip would go blank |

Google Fonts would have been fine. The map tiles and the launch-clip
iframe would not. Blanking the video on demo night to gain a header
nothing here needs — COEP buys cross-origin isolation, which matters
for `SharedArrayBuffer` and high-resolution timers, and this site uses
neither — is a bad trade. If that changes, re-run the checks above
before adding it; the header values are somebody else's to change and
this table will go stale.

### The `/site-original/(.*)` header rule is now aimed at a path that is not deployed

It sets `X-Robots-Tag: noindex, nofollow` on a directory that
`.vercelignore` no longer uploads, so it will not match anything on a
normal deployment. It is left in place rather than deleted, on purpose:
it costs nothing, and it still does its job in the one case that
matters — somebody deploying from the CLI in a way that misses the
ignore file. Delete it only together with the matching redirect below.

### The `redirects` block

Belt and braces for the same problem. `.vercelignore` stops those paths
being uploaded; the redirects send them back to `/` **before** the
filesystem is consulted, for the case where a deployment route we did
not predict ignores the file. Until this pass, every one of these was
HTTP 200 on the live site: the full RLS policy text, the threat model,
two complete ungated copies of the app, and `app-retag/login.html`,
which accepts any password because `js/config.js` 404s from that path.

Neither mechanism should be removed on the strength of the other. If you
add a directory to the app later, it needs a `!` pair in `.vercelignore`
and it must not collide with a redirect source here.
