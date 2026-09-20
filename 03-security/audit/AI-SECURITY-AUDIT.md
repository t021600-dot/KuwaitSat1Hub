# AI SECURITY AUDIT — se-m6

**Owner:** 03 · Security · **Run:** Monday 21 September 2026, evening
**Proves:** *"The team ran an AI security audit and can show two things it changed"*
**The judge's test:** they **open the audit output**, then you **point at the two fixes, live**.

> ⚠️ **THIS FILE IS A TEMPLATE UNTIL MONDAY NIGHT.**
> Fill it with a **real run**. An audit nobody ran is a claim, not evidence — and
> this is the one security item that is scored on a *document a judge opens*.
> If this file still says TEMPLATE on Thursday, `se-m6` is **NOT PROVEN** and the
> team does not pass.

---

## Two rules that decide whether this ticks

1. **Paste the FILE, not a description of the file.** Describe it and you get a
   generic OWASP lecture with nothing you can point at on demo night.
2. **The two shipped fixes must be ones you can SHOW ON SCREEN.** A fix a judge
   cannot see does not tick `se-m6`. Prefer a fix that is visible in View Source
   or in a two-line diff over one buried in a config.

Save the output **the night you run it**. `05 · Ship` marks this NOT PROVEN
unless it is committed and reachable from the repo front page.

---

## The prompt to run

Paste **one or two whole files** underneath it. Not four. Every card that broke
for a team broke because somebody pasted four.

```
You are a security reviewer doing a short audit of a student team's own
prototype before it is demonstrated in public. You are blunt and specific.
You rank by what someone sitting at our demo table could actually do in
60 seconds, not by what is theoretically bad.

OUR APP: KuwaitSat-1 Mission Hub — a secure research platform for
KuwaitSat-1 satellite data. A static front end on a public HTTPS URL
(plain HTML and JS, no build step), Supabase Postgres behind it, and an
n8n workflow the browser NEVER calls directly. Signed-in researchers
create a research mission over a Kuwait map, launch a six-agent chain
(Satellite Data, Environmental Analysis, Recommendation, Impact
Prediction, Visualization, Reporting), review the findings, and click
Generate Report. The browser holds only the project URL and the
publishable key, which is safe ONLY because row level security is on.
Everything in the demo is invented data.

Our own rules that you should check we actually kept:
- No text a researcher typed, and no text an AI agent wrote, is ever
  rendered with innerHTML.
- No key, token or password anywhere in the repo.
- The Content-Security-Policy ships as a REAL HTTP RESPONSE HEADER from
  vercel.json (we host on Vercel), and the same policy is repeated as a
  meta tag in every page head as a fallback for local file:// viewing.
  script-src is 'self' with NO 'unsafe-inline'. frame-ancestors is
  'none'. We also send Strict-Transport-Security, X-Content-Type-Options,
  Referrer-Policy: no-referrer and Permissions-Policy.
- HTTPS only, no mixed content.
- The browser never calls the n8n webhook; it calls launch_mission().
- No Supabase Storage bucket exists; the map draws from results.geometry.
- The report is shown as PLAIN TEXT (textContent + white-space: pre-wrap).
  reports.body_md is NEVER parsed as markdown and never assigned with
  innerHTML - it is written by the AI from a researcher-typed objective,
  so treating it as markup lets one researcher put live script into a
  report another researcher opens.
- Map popups are built from DOM nodes with textContent, never from an
  HTML string - Leaflet's bindPopup() takes HTML.

GROUNDING RULE: report only what you can see in the pasted text. Quote the
line you are talking about. If you suspect something that is not visible
in what I pasted, put it in a separate list headed "NOT VISIBLE -
[NEEDS CHECK]" and say which file we should paste next. Do not invent
CVEs, version numbers or vulnerabilities you cannot point at.

HERE ARE THE FILES:
<PASTE ONE OR TWO WHOLE FILES — the <head> of mission.html plus the JS
that renders anything a researcher typed or an agent wrote>

OUTPUT - three parts:

PART 1 - a table:
| # | Finding | File + the exact line | What someone could do with it | Severity for OUR demo |
Severity is one of: SHIP FIX TONIGHT / FIX IF TIME / NOTED, NOT FOR THIS WEEK.

PART 2 - for the top two findings only, the fix, as a code block we can
paste. Before and after. Each fix small enough to do in under 20 minutes.

PART 3 - the two-sentence version we will say out loud to a judge:
"We ran an AI audit, it found X, we changed Y and Z." No exaggeration; do
not claim we fixed anything you did not just write the fix for.

Then the "NOT VISIBLE - [NEEDS CHECK]" list.
```

**Run it twice, on two different pastes.** Pass 1: the mission page head plus the
render function. Pass 2: the SQL — `04-policies.sql` and `05-views-and-write-path.sql`.
Pass 2 is where the expensive findings are, and it is the one teams skip.

---

## PART 1 · Findings — *fill in Monday*

| # | Finding | File + exact line | What someone could do with it | Severity |
|---|---|---|---|---|
| 1 |  |  |  |  |
| 2 |  |  |  |  |
| 3 |  |  |  |  |
| 4 |  |  |  |  |

---

## PART 2 · The two fixes we shipped — *fill in Monday*

### Fix 1 — ______________________

```
// BEFORE

// AFTER
```

Commit: `____________`  ·  Shipped at: `____:____`  ·  Visible on screen at: ______________

### Fix 2 — ______________________

```
// BEFORE

// AFTER
```

Commit: `____________`  ·  Shipped at: `____:____`  ·  Visible on screen at: ______________

---

## PART 3 · Said out loud to the judge — *fill in Monday*

> "We ran an AI security audit on our own repo on Monday night. It found
> ________________________ and ________________________. We changed both —
> ________________________ and ________________________."

**Do not claim a fix you did not ship.** Two real fixes beat five described ones.

---

## NOT VISIBLE — [NEEDS CHECK] — *fill in Monday*

Files the reviewer could not see and asked for. Paste them next time.

- [ ]
- [ ]

---

## PART 4 · The beat that makes this a security audit and not a document review

Three of the beats above are *files and diffs*, and those are genuinely real —
a file is a file. But **nothing in them ever queries the API**, so every claim is
a claim about what our JavaScript drew.

Add one beat, 12 seconds, rehearsed in a **private** window:

```js
const { data: { user } } = await sb.auth.getUser();
console.log('signed in as:', user?.email ?? 'NOT SIGNED IN');
const { data, error } = await sb.from('my_missions').select('id,title');
console.log('rows:', data?.length ?? 0, '| error:', error?.message ?? 'none');
```

Signed in as the **second** researcher, that prints `rows: 0` — the API
answering as the wrong account. That is the difference between a security owner
and a narrator.

---

## Before you commit this file to a public repo

The two shipped fixes go in **verbatim** — that is the evidence.

For the **NOT FIXED** and **NOT VISIBLE** rows, keep the finding and the
severity but **cut the payload**. "agent_steps read path not yet audited — FIX
IF TIME" is honest and useful. A working attack string for an unfixed hole,
sitting in a public repo from Monday until Thursday, is not.
