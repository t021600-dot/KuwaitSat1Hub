# THREAT MODEL — KuwaitSat-1 Mission Hub

**Owner:** 03 · Security · **Written:** Sunday 20 September 2026, build night 1 · **Covers:** the prototype as it will be shown on Thursday 24 September 2026 — not a production system.

**Scope:** static front end on a public HTTPS URL, Supabase (Auth + Postgres + Storage), n8n running the six-agent chain, Kuwait basemap. All demo data is invented, per the kit rule "No real customer, patient or worker data in a student demo" (CAPSTONE-GUIDE.md:189).

**This file is the evidence for two SHOULD items:** "the blast radius in one sentence" and "the three biggest threats written down with what you did" (CAPSTONE-GUIDE.md:116).

**Status tags** are on every control: `[SUN]` tonight, `[MON]`, `[TUE]`, `[WED]` = when it lands. **Rule for Thursday: if a tagged line is not actually true by Wednesday night, cross it out in this file rather than say it out loud.** An unticked line costs one SHOULD item. A sentence you say to a judge that turns out to be false costs that item *and* everything else you said.

---

## 1. Blast radius — one sentence

> **If this prototype is fully compromised on demo night, the worst that happens is that a stranger reads, alters or deletes a handful of invented research missions and AI-written vegetation findings about squares of Kuwait we chose ourselves, sees five students' email addresses, and burns our own model credit re-running the agent chain — no real KuwaitSat-1 imagery is exposed, no real researcher is identified, and nothing in this system can send a single instruction to the satellite, because no tasking credential exists anywhere in it.**

**Why it is that small, honestly:** almost entirely because the data is fake. Invented AOIs, invented findings, invented accounts. That is a property of the *week*, not of our engineering, and we should say so rather than let a judge think our controls earned it.

**What the same compromise would cost with real KuwaitSat-1 data and real researcher identities:**

- **Pre-publication research leaks.** The objective sentence plus the area of interest *is* the research. Knowing that a named researcher is studying one square of Kuwait for vegetation stress can reveal a finding before it is published, and can point at the site of a problem before anyone has confirmed it. Row-level data becomes competitively and reputationally sensitive even when the underlying imagery is not.
- **A licence breach, not an embarrassment.** Real scenes and real derived products carry the archive's terms. A leaked file would be the institution redistributing data it was licensed to use, which is the institution's problem, not ours.
- **Accounts that belong to people.** A stolen session becomes a real researcher's institutional identity, and the run log stops being demo decoration and starts being the record somebody relies on — so tampering with it is tampering with evidence.
- **Destruction instead of inconvenience.** Deleting a mission deletes months of somebody's work rather than a seed row.
- **Downstream harm.** A forged or altered recommendation that someone feeds into a planning decision is a harm even where the source imagery was public.

---

## 2. The three biggest threats

Ranked by **what a person standing at our demo table could actually do in 60 seconds**, using the laptop we handed them and nothing else. Every one of these is a real finding against our own current design, not a textbook list.

### T1 — Right-click the report or the map image, paste the URL into a signed-out window (≈10 seconds, no account, no DevTools)

**The threat.** Files are not rows. Supabase Storage has its own permission system, completely separate from the row-level security everything else in our plan is about. If the bucket holding the generated report PDF, the result map image or a cached KuwaitSat-1 scene is left **Public** — the default a beginner picks at 23:00 because `getPublicUrl()` works first try and `createSignedUrl()` does not — then `https://<ref>.supabase.co/storage/v1/object/public/reports/<id>.pdf` opens for anybody, forever, with no session. Our whole "this is not a public data portal" claim dies on one right-click, on the screen our own demo put the judge on, without a single query reaching Postgres. If object ids are sequential, they can walk to other missions' files too.

**What we did.**
- `[SUN]` Bucket is **private**. Files are reached only through short-lived signed URLs (minutes, not days) minted server-side. `[SUN]`
- `[SUN]` Object paths are `missions/<mission_id>/...` with `mission_id` from `gen_random_uuid()` — v4, not guessable, not walkable.
- `[SUN]` `source_ref` (the archive path column) is not granted to `authenticated`, and no signed URL is ever written into a results row or into a generated report.
- `[TUE]` The verification list covers **buckets as well as tables**, run against the live project, because a bucket somebody adds on Monday is invisible to any check written tonight. Evidence: the image address pasted into a private window, error saved to `evidence/`.

**What we consciously did NOT do (the honest gap).** A signed URL is a bearer token: within its lifetime, anyone holding the link can fetch the file, and it is not bound to the researcher who asked for it. A report a researcher downloads and forwards is outside our control completely — no watermark, no expiry once it is a file on a laptop, no per-download audit row. With real imagery that is the first gap we would close.

---

### T2 — Sign in as the second researcher, open the console, ask the API for the first researcher's rows (≈30 seconds)

**The threat.** This is the judge's scripted question to me: "show me account B failing to read account A's record" (CAPSTONE-GUIDE.md:144). The failure is almost never the `missions` table everyone hardens. It is one of two quieter things:
- **A child table created so n8n could write to it, with RLS never enabled** — `mission_runs`, `agent_steps`, `results`, `reports`. Supabase grants ALL on new public tables to `anon` and `authenticated`, and the publishable key is in `config.js` by design, so one forgotten `enable row level security` makes every researcher's Environmental Analysis and Recommendation text world-readable. That text *is* the product.
- **A convenience view without `security_invoker`.** A view created as `create view public.my_missions as select * from public.missions` runs with its **owner's** privileges and bypasses RLS on the table underneath entirely. It looks fine in the dashboard, and it hands every mission to every signed-in account behind a name that says the opposite.

**What we did.**
- `[SUN]` RLS enabled on **all five** tables before any page reads data — this is the Sunday blocker, ahead of everything else. Every predicate is `researcher_id = auth.uid()`; child tables reach the owner through the mission row.
- `[SUN]` `revoke` on `anon`; explicit column grants to `authenticated` (grants decide columns and verbs; RLS decides rows — we need both).
- `[SUN]` Every view is created `with (security_invoker = on)`, carries its own `where` clause, and is granted explicitly.
- `[TUE]` Verification query lists every **table and view** in `public` with its RLS state and invoker mode, run over the **live** schema, not the schema we intended — a table added Monday with RLS off is a total silent leak.
- `[SUN]` The proof runs in the **console against the API**, never through the screen: it prints `auth.getUser().email` first so the judge sees *who is asking*, then one raw `fetch` with the Bearer token so they see **HTTP 200 with a literal `[]`**. Zero rows has to be visibly a refusal, not a logged-out window. Two **private** windows, both account names said out loud.

**What we consciously did NOT do.** No reviewer or mission-lead role, no admin view, no edit-after-create. Mission **sharing** is written (`mission_collaborators`, `is_collaborator()`, `share_mission()`) but it is the **first thing we cut** if Sunday runs long — see `DECISIONS.md` D-5. It buys nothing the judge's test touches (the test is: A owns a mission, B cannot see it) and it costs the two hardest ideas in the schema. If it is cut, `can_read_mission()` reduces to a single ownership check and there is exactly one way to be allowed to read a mission: own it.

And sign-up is open, so "authorized researcher" today honestly means "anyone on the internet who types an email address" — we say that before a judge says it for us. Approved accounts are the first thing added with real researchers.

---

### T3 — Read the n8n webhook out of the Network tab and re-post it with someone else's mission id (≈60 seconds)

**The threat.** Launch Mission has to be triggered from our own front end (au-m1). The beginner wiring is: the browser POSTs straight to the n8n production webhook. That puts the URL in View Source and in the Network tab — and the judge is already in both, because se-m4's test *is* the address bar plus the console. n8n holds the Supabase secret key (it must, to write agent rows), and the secret key **bypasses RLS by definition**. So `curl -X POST <webhook> -d '{"mission_id":"<the id the presenter handed me at 0:08>"}'` starts a run on another researcher's mission from outside every account, writes agent output onto it, and — if the workflow ends in a Respond to Webhook node, which is how everyone debugs n8n — hands back that researcher's objective and findings in the HTTP response. Every policy I wrote stays intact and completely irrelevant, while the two-window demo still passes.

**What we did.**
- `[SUN — written down tonight, because nothing in the kit states it]` **The browser never calls n8n.** Launch Mission calls a `SECURITY DEFINER` Postgres function that verifies `auth.uid()` owns that mission, and only then triggers the workflow. The workflow receives one mission id and nothing else.
- `[MON]` The n8n Webhook node has header authentication **ON**. The header value lives in n8n's credential store and in Supabase Vault (or a `private.app_settings` row with no grants) — never in a literal, never in the repo, never in a screenshot of the canvas.
- `[MON]` n8n writes only through named functions that **re-read the owner off the mission row** for the run id they were passed and touch only that mission. I read the function body, not its comment — the first draft assigned the owner into a variable and then never used it, which verifies nothing.
- `[MON]` The webhook returns status only. Agent output reaches the browser by reading Postgres under RLS.
- `[WED]` Re-verify the n8n credential and the "continue on fail" switch. The realistic way this breaks is not an attacker: it is a teammate pasting the secret key somewhere new at 23:00 Tuesday to turn a red node green.

**What we consciously did NOT do.** n8n still holds a key that bypasses RLS. We chose that over a dedicated least-privilege Postgres role because the role setup is more than one build night holds — so the honest sentence to a judge is **"on the agent path the wall is the function, not the policy"**, and we say exactly that rather than claiming RLS protects it. We also have no rate limiting, no replay protection and no request signing on the webhook beyond the shared header.

---

## 3. The satellite-specific angle

Four things a generic web app never has to answer. Only what we can defend; `[NEEDS CHECK]` marks what we would have to ask someone.

**a. Earth-observation imagery is not one classification.** Sensitivity is driven by **resolution, freshness and location**, not by the word "satellite". A week-old multispectral scene of vegetation is a different object from a fresh high-resolution scene over a port or a restricted site, even though our schema stores both in one column with one access rule. For the prototype we sidestep the question completely — every scene and every polygon is invented and lives in our repo, so there is nothing to classify. `[NEEDS CHECK]` the real ground sample distance, the licence, the redistribution terms, and whether any class of scene is restricted: **the KuwaitSat-1 mission data policy and the team that operates it (KFAS / the operating university) would know; our instructor can route that question.** We assert no Kuwaiti legal restriction we cannot cite. `[NEEDS CHECK]` whether any national data-protection or export/dual-use rule applies to a university research platform holding this imagery — **the university's legal/IT office and the national regulator, not us.**

**b. A research platform is not a public data portal — the access decision is per person, per mission.** A portal answers "is this dataset public?" once, at publication, for everyone. We answer "is *this researcher* allowed *this mission*?" on every single read, and every read is attributable to an account. The thing being protected is not only imagery: **the objective sentence plus the AOI is pre-publication research intent.** That is why our default is private-by-owner rather than public-with-exceptions, and why the landing page is marketing plus a sign-in button with **zero data**, while every mission route is gated — our sh-m1 evidence line reads "a private window reaches the landing page **and is bounced from a mission URL**", not "no sign-in wall". One honest disclosure in the same breath: our basemap tiles come from a third-party host, which therefore sees the bounding box a researcher is panning over, with our referrer attached. On a platform whose premise is that B cannot see A's area of interest, an outside host can infer it from tile traffic. With real AOIs the basemap gets self-hosted or bundled.

**c. Derived products leave the platform, and the platform's controls do not follow them.** The last beat of our own demo is a report a human forwards. A derived product can be **more** revealing than the source scene, because it is the aggregation plus the interpretation — "these squares are the ones that matter, and here is why". What we do this week: no signed URL is ever written into a report or a results row; the report carries a provenance line naming the mission id, the account and the run id; every page and the report carry "Prototype — invented data only". What we do not do: expiry, watermarking, per-download audit, or any control whatsoever once the PDF is on somebody's laptop. `[NEEDS CHECK]` whether derived products from real KuwaitSat-1 scenes may be shared outside the institution, and under what attribution — **the archive licence and the university research office.**

**d. The AI never commands the satellite, and that is structural rather than a promise.** This is a **read-only downstream system**. The agents read stored scenes and write rows. There is no tasking interface, no ground-segment endpoint and **no tasking credential anywhere in this project** — the strong form of the claim is that the capability does not exist to be abused, not that a system prompt asks the model not to. The human checkpoint sits on the other end, exactly where the kit wants it: the agent proposes, the researcher reviews, the researcher clicks Generate Report. Nothing is published or acted upon by the system itself. `[NEEDS CHECK]` who operates KuwaitSat-1 tasking and what separation they would require between a research platform and the ground segment — **the mission operators would know; the answer is a network and credential boundary they own, not a rule in our n8n workflow.**

---

## 4. Said out loud if a judge asks: "what would you do differently with real satellite data and real researchers?"

"Three things change, and none of them is a bigger firewall. First, identity stops being self-serve — accounts get approved against the institution's own directory instead of anyone typing an email address, because with real data 'authorized researcher' has to mean something a person actually signed for. Second, the agent path stops borrowing a key that bypasses our own rules: n8n gets its own database role that can execute four named functions and read nothing, so the sentence I say to you changes from 'the function is the wall' to 'row level security applies to the agents too'. Third, we start treating the derived product as the real export — every download of a scene or a report writes an audit row saying who, when and which mission, report links expire, and what may leave the institution at all is decided by the imagery licence, which is a question for whoever holds the KuwaitSat-1 data policy and not for me. I would also stop sending our areas of interest to a third-party map host. And before any of that, someone would have to own the parts we deliberately cut this week: sharing, roles, and what happens to a researcher's missions when they leave."

---

**Out of scope for this week, stated so it is a decision and not an oversight:** denial of service and load, key rotation procedure, backup and restore, session revocation on the server side, log retention, and anything about a real ground segment. We are a four-day prototype with invented data; these are the right things to defer and the wrong things to pretend we covered.