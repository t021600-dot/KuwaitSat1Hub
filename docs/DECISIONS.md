# SECURITY DECISIONS — KuwaitSat-1 Mission Hub

**Owner:** 03 · Security · **Written:** Sunday 20 September 2026

Every decision here is **free tonight and expensive on Wednesday**. They are
architecture, not polish — each one changes what the other four people build.
Send D-1 to D-5 to the team chat before you write any SQL.

A decision is only made when it is **written here and acknowledged in chat**.
"We said it on a call" is not a decision.

| # | Decision | Status | Who must agree |
|---|---|---|---|
| D-1 | The browser never calls n8n | **LOCKED** | 04, 01 |
| D-2 | No Supabase Storage this week | **LOCKED** | 01, 02, 04 |
| D-3 | Mission areas must be inside Kuwait | **LOCKED** | 01, 04 |
| D-4 | Every id is a uuid | **LOCKED** | 02 |
| D-5 | Mission sharing is the first cut | **OPEN — decide by 23:00 Sunday** | you alone |
| D-6 | Agent steps are polled, not Realtime | **LOCKED** | 01 |
| D-7 | Sign-up is open, and we say so | **LOCKED** | 05 |

---

## D-1 · The browser never calls n8n

**Decision.** "Launch Mission" calls the Postgres function `launch_mission()`.
That function checks `auth.uid()` owns the mission and writes a `mission_runs`
row with status `queued`. n8n picks queued runs up. **No webhook URL ever
appears in our JavaScript.**

**Why.** The capstone requires the automation to be triggered from our own front
end (`au-m1`). The obvious wiring is `fetch('https://…n8n.cloud/webhook/…')`
from the browser. That puts the URL in View Source **and in the Network tab** —
and the judge is already in both, because the `se-m4` test is literally *"the
address bar, plus the console"*.

Then: n8n holds a key that **bypasses RLS by definition**. So

```
curl -X POST <the webhook> -d '{"mission_id":"<the id you handed the judge>"}'
```

starts a run on another researcher's mission from outside every account. Every
policy in `sql/04-policies.sql` stays perfectly intact and completely
irrelevant, while the two-window demo still passes.

**Cost of deciding late:** 04 builds a Webhook trigger on Tuesday and it is
their whole evening to change.

---

## D-2 · No Supabase Storage this week

**Decision.** No bucket. No PDF file. No raster file.
- The Kuwait map draws from `results.geometry` (jsonb, already RLS-protected).
- "Generate Report" shows `reports.body_md` as **plain text** in the page
  (`textContent` + `white-space: pre-wrap`), and the researcher uses the
  browser's Print to PDF.

  > **Correction.** An earlier version of this line said "renders as HTML",
  > which contradicted the `textContent`-never-`innerHTML` rule in `HANDOFF.md`
  > and would have opened the exact hole that rule exists to close. `body_md` is
  > written by the AI from a researcher-typed objective, so treating it as markup
  > means one researcher can put live script into a report another researcher
  > opens. Most markdown libraries pass raw HTML through by default, so parsing
  > it as "just markdown" is not a fix. Plain text is the decision. See
  > `docs/PAGE-AND-APP-SECURITY.md`.
- **Nobody calls `getPublicUrl()`.** Ever.

**Why.** Files are not rows. Storage has its own permission system, completely
separate from RLS. A bucket left **Public** — the default a beginner picks at
23:00 because `getPublicUrl()` works first try and `createSignedUrl()` does not
— means

```
https://<ref>.supabase.co/storage/v1/object/public/reports/<id>.pdf
```

opens for anybody, forever, with no session. The judge right-clicks the report
on *your own demo screen*, picks Copy image address, pastes it into the
signed-out window, and your entire security story dies in ten seconds without a
single query reaching Postgres.

**If a bucket already exists:** uncheck Public **tonight**, store objects under
`missions/<mission_id>/…`, and add a `storage.objects` policy keyed to the
mission owner. But the cheapest correct answer is to not have one this week —
and it makes the build simpler, not harder.

---

## D-3 · Mission areas must be inside Kuwait

**Decision.** `kuwait_area_ok()` in `sql/06-validation.sql` refuses any polygon
with a point outside 46.5–48.8 E / 28.5–30.1 N.

**Why.** Two reasons, and the second is the better one.
1. It gives `se-m5` a *wrong-place* refusal you can demonstrate live, not just
   a too-long one.
2. It bounds what the Satellite Data Agent can ever be pointed at. That makes it
   a **guardrail**, which `au-m4` asks for with numbers, not just validation.

**The alternative** is to drop the clause and let a researcher request any area
on Earth. Choose that only if someone on the team has a real regional mission in
mind. Either way the choice is written down, because it changes one row of
`tests/VALIDATION-MATRIX.md`.

**Ask 01 before you trust the point count.** Leaflet's `getLatLngs()` returns
`{lat, lng}` **objects**, not `[lng, lat]` arrays. If the front end feeds that
through raw, every single mission is refused and it looks like your constraint
is broken. It is not — the shape is wrong. Agree the exact emitted format
tonight.

---

## D-4 · Every id is a uuid

**Decision.** `id uuid primary key default gen_random_uuid()`. No `bigserial`,
no `serial`, anywhere.

**Why.** With integer ids, `mission.html?id=1`, `2`, `3` … `50` walks your entire
mission table. RLS makes every one of those pages empty, so no data leaks — but
the judge has just learned exactly how many missions exist and that they are
sequential, and you spend your answer explaining why that is fine instead of
showing something that works.

`gen_random_uuid()` is v4 and not guessable, which is also why handing the judge
a mission id in the demo is safe and impressive rather than risky.

**One line tonight. Impossible on Wednesday.** Confirm it with 02 while their
schema is still open.

---

## D-5 · Mission sharing is the first cut — **DECIDE BY 23:00 SUNDAY**

**The situation.** `mission_collaborators`, `is_collaborator()`,
`share_mission()` and the `or public.is_collaborator(...)` branch in three
policies are all written and ready in `sql/`. They match the project brief,
which says Supabase stores "users, missions, workflows, results and
**permissions**".

**But** they buy nothing the judge's test touches. The test is: *A owns a
mission, B cannot see it.* Sharing is the opposite of that test.

What they cost is the two hardest ideas in the whole schema — a SECURITY
DEFINER function called from inside a policy on the table it reads, and a
second read path that must stay consistent across three policies and two views.
Both are real sources of a 1am "everything is empty" panic.

**The rule for tonight.** If RLS, grants, policies, views and the proof script
are all working by **23:00**, keep sharing — it is a genuine differentiator and
it is already written. If anything is still broken at 23:00, **cut it**:

```sql
-- the cut, in full. Three edits.
drop table if exists public.mission_collaborators cascade;
drop function if exists public.is_collaborator(uuid);
drop function if exists public.share_mission(uuid,text,text);

create or replace function public.can_read_mission(p_mission_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $fn$
  select exists (select 1 from public.missions m
                 where m.id = p_mission_id
                   and m.researcher_id = (select auth.uid()));
$fn$;

-- then in 04-policies.sql: missions_select_own_or_shared becomes
--   using ( researcher_id = (select auth.uid()) )
-- and both views in 05 lose their "or public.is_collaborator(m.id)" branch.
```

Write the outcome here tonight: **DECIDED: ______ at ______**

---

## D-6 · Agent steps are polled, not Realtime

**Decision.** The six-step agent strip updates by polling the `my_agent_steps`
**view** every 2 seconds. Not Supabase Realtime, not `postgres_changes`.

**Why.** Column grants are a **PostgREST-layer** control. A Realtime payload is
assembled from the write-ahead log, not from a `SELECT` — so the columns we
deliberately never granted (`raw_prompt`, `raw_response`, `confidence`) **can
ride along in the websocket frame** even though `select *` on the table is
denied. The DevTools WS tab shows them in plain text.

Second reason, which matters more on the night: six steps over ninety seconds is
about 45 requests. Nothing. And a poll cannot drop mid-demo the way a websocket
on venue wifi can.

**If Realtime is already built:** keep it, but open DevTools → WS → Messages on
Monday and confirm `raw_prompt` is absent before Thursday. If it is present,
that is a `se-m6` finding and a good one to have caught.

---

## D-7 · Sign-up is open, and we say so first

**Decision.** Anyone can create an account. We do not pretend otherwise, and we
say it before a judge says it for us.

**Why.** The project premise is *"this is not supposed to be a public website
where anyone can download KuwaitSat-1 data — researchers would have accounts and
permissions."* Open sign-up is in tension with that, and a judge will spot it.

It is also **required for the demo**: the judge must be able to create a brand
new account in front of you and watch it start empty (`be-m4`). A closed invite
list makes your own best demo impossible.

**The rehearsed sentence (say it, don't wait to be asked):**

> "Sign-up is open on purpose for this demo, so you can make an account right
> now and watch it start empty. In a real deployment that is an invite list or a
> domain restriction — it is a setting, not a rebuild."

Also tell 02: **Authentication → Providers → Email → Confirm email = OFF.** If
it is on, the judge creates an account on stage, never gets the email, cannot
sign in, and your isolation demo becomes untestable.
