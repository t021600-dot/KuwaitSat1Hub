<!--
  Keep it small. CONTRIBUTING.md: small pull requests merged the same evening
  beat one giant one on Wednesday. Delete any section that does not apply
  rather than writing "n/a" ten times.
-->

## What this changes

<!-- One or two sentences, in plain English, aimed at a teammate who has not
     seen the code. Not a list of files. -->

## Why

<!-- The problem, or the issue number. "Closes #12" links and closes it. -->

## Branch prefix

<!-- Tick the one your branch starts with. One branch per piece of work:
     <job>/<what>, e.g. security/rls-on-reports -->

- [ ] `front-end/` — 01 · Front end
- [ ] `data/` — 02 · Back end and data
- [ ] `security/` — 03 · Security
- [ ] `agent/` — 04 · Automation and agents
- [ ] `ship/` — shipping and demo work, anyone

## How to check it

<!-- What the reviewer should do to see it working. A URL, a click path, or the
     exact command. -->

```bash
# e.g.
node --check js/ksat-shell.js
node 04-agents/tests/injection.test.js
```

## Screenshots

<!-- For anything visual, including Arabic. Two images: English and العربية.
     A right-to-left layout that was never looked at is a right-to-left layout
     that is broken. -->

---

## Before you ask for review

- [ ] **Nothing was removed.** No section, chart, number, image or paragraph is
      gone. Content may be folded, routed, re-grouped or re-worded — not deleted.
- [ ] **No secret.** No key, token or password in the diff. Variable *names* go
      in `.env.example`; values never do. The pre-commit hook in `tools/hooks/`
      blocks a JWT, but it is a net, not a substitute for looking.
- [ ] **No new dependency and no build step.** Plain browser JavaScript,
      hand-written CSS. Any library is vendored under `vendor/`, never a CDN —
      the Content-Security-Policy in `vercel.json` would block it anyway.
- [ ] **Bilingual.** Every user-visible string I added exists in English and in
      Arabic, and I looked at the page with the language switched.
- [ ] **Motion is optional.** Any animation I added is off under
      `@media (prefers-reduced-motion: reduce)`, and any `requestAnimationFrame`
      loop checks it.
- [ ] **It runs.** `node --check` passes on every `.js` file I touched, and the
      tests in `04-agents/tests/` still pass. CI runs both on this pull request.
- [ ] **One teammate has been asked to review**, and it is not being merged
      until they have. What is on `main` is what is live.

<!-- If this touches the database grants, the row-level security policies, the
     agent tool list, or the human checkpoint, 03 · Security reviews it — not
     because of ceremony, but because those four are the only things in this
     project that a judge can disprove in thirty seconds. -->
