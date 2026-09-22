# Security policy

**KuwaitSat Green Intelligence** — a student capstone prototype.
Owner of this file: **03 · Security**.

Please read *What this project is not* before reporting. A large share of what
looks alarming here is public on purpose, and is documented as such.

---

## Reporting a vulnerability

**Do not open a public issue for a security problem.** Use one of these:

1. **GitHub private vulnerability reporting** — the preferred route.
   Repository → **Security** tab → **Report a vulnerability**. It opens a
   private thread visible only to the maintainers.
2. If that is unavailable to you, contact the **03 · Security** owner through
   GitHub: [@t021600-dot](https://github.com/t021600-dot).

We do not publish an email address here. No address in this repository is an
advertised security contact, and the one that appears inside
`03-security/evidence/se-m2-gitleaks-*.json` is a commit-author address caught
by a scanner, not a mailbox anyone is watching for reports.

**What to include:** what you did, what happened, what you expected, and the
smallest reproduction you have. A URL, a request, or a few lines of SQL is
ideal. Please do not include anyone's credentials.

**What to expect.** This is a four-person student team working to a fixed demo
date, not a staffed security function. We aim to acknowledge a report within a
few days. We cannot promise a fix window, a bounty, or a CVE. If a report lands
after the capstone concludes, it may go unanswered — that is an honest
limitation, not an evasion.

**Please do not**
- run automated scanners or load tests against the live Vercel deployment or
  the Supabase project;
- attempt denial of service;
- access, modify or retain data belonging to another account;
- social-engineer the team, Kuwait University, KFAS, CODED or SACGC.

Reading the client-side source, calling the public RPC surface with your own
account, and trying to reach another researcher's rows **with your own
credentials** are all fair game and are exactly what our own test suite does.

---

## What this project is not

This matters more than the scope list, because it determines whether a finding
is a vulnerability at all.

- **It holds no real KuwaitSat-1 data.** No imagery, no telemetry, no
  acquisition data, no ground-station link. Every mission, figure, cost,
  temperature and vegetation index in the product is **invented for a
  demonstration**.
- **It secures nothing belonging to KFAS, Kuwait University, CITRA or the
  KuwaitSat-1 project.** It is not affiliated with any of them, carries no
  endorsement, and has no planning authority. Compromising this prototype gains
  an attacker access to nothing of theirs.
- **It is not an official government system.** The site says so itself: *"This
  is a decision-support platform. It is not an official government planning
  system, it carries no endorsement, and nothing in it should be acted on
  without review by the competent authorities."*
- **It is not a production service** and has no availability commitment. It may
  be taken down, reset, or have its database wiped without notice.

The user data it does hold is real in one sense only: the accounts are real
Supabase accounts with real email addresses and real sessions. **Anything that
lets one account reach another account's rows is a genuine finding and we want
to hear about it.**

---

## In scope

- Any path by which a signed-in researcher reads, writes or deletes another
  researcher's `missions`, `mission_runs`, `agent_steps`, `results`, `reports`,
  `profiles` or `mission_collaborators` rows.
- Any path by which the `anon` identity reads any table, view or privileged
  function.
- Any path by which the automation engine (`service_role`) reaches
  `generate_report`, or by which a report is created with an `approved_by` that
  is not the signed-in owner of that mission. **An agent must not be able to
  sign its own conclusion** — that is the single property this project exists to
  demonstrate.
- Bypassing the per-researcher, per-mission or per-run rate limits, the
  `accepting_new_missions` kill switch, or the 40-tool-call ceiling on a run.
- Stored or reflected XSS in anything a person or an agent wrote.
- A prompt-injection payload that causes an agent to take an action outside its
  declared tool list, rather than merely being flagged and refused.
- A missing or wrong security response header, or a Content-Security-Policy
  bypass.
- Reaching `GET /api/monitor` without a valid `Authorization: Bearer
  <CRON_SECRET>` header, or making it do anything other than call
  `public.sweep_stalled_runs(3)`.
- Anything reachable on the live deployment that `.vercelignore` is supposed to
  keep off it — the SQL policy files, the per-job documentation, `tools/`, or
  `site-original/`, which is a complete **ungated** second copy of the app and
  would show every researcher-only panel to anyone who guessed the URL.
- A real secret committed to this repository or its history — see below for the
  one that is public on purpose.

## Out of scope

- **The Supabase publishable key in `js/config.js`.** See the next section.
- Findings that depend on already having an account's password or session
  token.
- The **contents** of `site-original/` — its code, its stale text, its missing
  gates. It is a frozen historical copy of the original prototype, kept so that
  nothing from the original page is lost, and it is not part of the product.
  Note the distinction from the scope list above: *what is in that folder* is
  out of scope; *that folder being reachable on the live site* is very much in
  scope, and three separate mechanisms are meant to prevent it.
- Invented data being wrong, implausible, or inconsistent. It is invented. The
  site labels it, `CREDITS-AND-SOURCES.txt` documents which claims are sourced
  and which are not.
- Missing rate limits on Supabase Auth itself, or any other default of a
  third-party platform we do not configure.
- Vendored library versions under `vendor/` without a demonstrated exploit path
  in this application.
- Reports produced by an automated scanner with no reproduction attached.
- Clickjacking on pages with no state-changing control, missing `SameSite` on a
  non-session cookie, and the rest of the well-known low-severity boilerplate.

---

## The public key is public on purpose

`js/config.js` contains a Supabase project URL and a **publishable** key
(`sb_publishable_…`). Both ship to every visitor, because the browser has to
have them in order to talk to the database at all. Hiding them in a `.env`
would be theatre — the file would simply be inlined into the page.

**They are safe only because row-level security is on.** That is not a figure of
speech:

- Row-level security is enabled on all eight tables of the core schema, and on
  both tables in the phase-2 admin/audit schema.
- `anon` holds **no table grants**. `authenticated` holds **column-level**
  grants only — named columns, never `*`.
- If RLS were ever switched off on a table, that file would become a download
  link to every researcher's private work. Turning it off is the incident.

So: finding the key in the page source is not a vulnerability. **Using it to
read a row you do not own is**, and that is the report we want.

The **secret / service-role key must never appear in this repository, in any
commit, or in any chat window.** It lives in the n8n credential store.
`CRON_SECRET`, which authenticates the nightly `GET /api/monitor` sweep, is a
Vercel environment variable and is not in the repository either. `.env.example`
carries the **names** of environment variables and never their values. A
pre-commit hook in `tools/hooks/` blocks any real JWT from being committed,
deliberately, because a legacy `eyJ…` anon key and a service-role key look
identical at a glance. `gitleaks` is run over the full history as part of the
security suite.

**If a secret ever does land in a commit, tell 03 · Security at once.** Deleting
the file is not enough: the value stays in the history. It has to be **rotated**.

---

## What we already test, and what we already admit

`node 03-security/tests/security-check.mjs` runs 36 automated checks against the
live system as an anonymous visitor. It tries the door rather than asking
whether it is locked. Evidence, with the dates the checks were run, is in
[`03-security/evidence/`](03-security/evidence/).

Two things we say before anyone asks:

1. **A researcher with DevTools open can call `generate_report` without
   clicking the Approve card.** We tested that ourselves
   ([`se-m5-checkpoint`](03-security/evidence/se-m5-checkpoint-2026-09-21.md)).
   The card is a UI convention. The enforced guarantee is narrower and more
   useful: no report can exist without a named, signed-in human who owns that
   mission, `approved_by` is read from the verified JWT and cannot be aimed at a
   colleague, and `service_role` is refused the function outright.
2. **The public/researcher tier split in the page is product framing, not
   secrecy.** Every demo constant in the page ships to every visitor and always
   did; the tier can be flipped in DevTools. What cannot be flipped there is
   row-level security — flip the tier and the panels come back empty, because
   the emptiness is enforced in Postgres.

Claiming otherwise in a demo would be disprovable in thirty seconds, so we do
not claim it.
