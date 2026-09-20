# SUPABASE DASHBOARD HARDENING — the ten minutes nobody on a student team spends

**Owner:** 03 · Security · **Do it:** Monday 21 Sep, one sitting, laptop plugged in
**What this is:** the controls that live in a web form, not in a `.sql` file. Nothing here can be proven by `sql/99-verify.sql`, nothing here is in the repo, and nothing here costs money. Two of them are the only account-takeover paths in your whole design.

**Honest note on paths:** Supabase renames dashboard sections often (Providers → "Sign In / Providers", Reports → "Advisors"). Where I am not certain a path is current I have written **[CHECK IN DASHBOARD]** and given you the *name of the setting*, which does not change, plus roughly where it lives. If the path is wrong, search the setting name in the dashboard search box (top of the sidebar) — do not go hunting through menus at 23:00.

---

## The list at a glance

| # | Setting | Where | Verdict | Time |
|---|---|---|---|---|
| 1 | **Site URL** | Auth → URL Configuration | **MUST before demo** | 1 min |
| 2 | **Redirect URLs — exact, no wildcard** | Auth → URL Configuration | **MUST before demo** | 2 min |
| 3 | **Confirm email = OFF** (deliberate) | Auth → Providers → Email | **MUST — verify, don't change** | 1 min |
| 4 | **Exposed schemas = `public` only** | Project Settings → Data API | **MUST — verify** | 30 sec |
| 5 | **Storage: zero buckets** | Storage → Buckets | **MUST — verify, it is your T1 evidence** | 30 sec |
| 6 | **Security Advisor run + screenshot** | Advisors → Security | **MUST — this is se-m6 evidence** | 3 min |
| 7 | **Minimum password length = 10** | Auth → Providers → Email | **Monday or never** (hard gate) | 4 min |
| 8 | **MFA on YOUR Supabase login** | Account → Security | **Should — biggest blast radius here** | 3 min |
| 9 | **Leaked-password protection** | Auth → Providers → Email | **Paid tier — say the sentence, change nothing** | 0 min |
| 10 | **JWT / access-token expiry** | Auth → Sessions [CHECK] | **Leave at 3600. Read it, write it down** | 1 min |
| 11 | **Auth rate limits** | Auth → Rate Limits | **Read and record. Do not raise** | 2 min |
| 12 | **Anonymous sign-ins = OFF** | Auth → Providers | **Verify** | 30 sec |
| 13 | **Database password + who is in the org** | Settings → Database / Org → Team | **Should, 5 min** | 5 min |

MUST rows total about **ten minutes**. The whole table is about twenty-five. If you only have ten, do 1–6.

---

## 1 · Site URL

**Path:** Authentication → **URL Configuration** → *Site URL*
**Set it to:** your exact Pages URL, with the trailing slash — `https://<account>.github.io/<repo>/`
**Why:** this is the address Supabase puts in every email link it sends, and the fallback it uses when a requested redirect is not on the allowlist.
**What breaks if wrong:** it is almost certainly still `http://localhost:3000` from the day the project was created. A password-reset link then sends a judge to a page that does not exist — over plain **http**, which also contradicts your own `se-m4` claim that everything is HTTPS.

---

## 2 · Redirect URLs — the one that is account takeover, not a nuisance

**Path:** Authentication → **URL Configuration** → *Redirect URLs*
**Set it to:** exact URLs only, at most two.

```
https://<account>.github.io/<repo>/signin.html
http://localhost:5500/signin.html        ← only if you actually test locally; delete it Wednesday
```

**No `*`. No `**`. Never `https://*.github.io/**`.**

**Why in one sentence:** the redirect URL is where Supabase *delivers a working credential* after a password reset or any email link — so the allowlist is the list of websites you are willing to hand a researcher's session to.

**Why a wildcard is takeover and not sloppiness — the version to say out loud:**
> A recovery link is sent to the victim's own inbox and carries a token in the URL. If the redirect list contains a wildcard, an attacker crafts that link so the token lands on **their** page instead of ours. The victim clicks a genuine Supabase email, and the attacker's page reads the token out of the URL. No policy is involved, no password is guessed, and RLS works perfectly the whole time — it just now believes the attacker is the researcher.

And the project-specific sting: **`*.github.io` is not "our site". It is every GitHub account on earth.** On GitHub Pages the origin is the account, so a wildcard on github.io allowlists the entire internet's free static hosting.

**What breaks if you set it too tight:** a link you actually use isn't on the list, so Supabase silently falls back to the Site URL instead of the page you asked for. That is a broken redirect — annoying, visible, fixable in ten seconds. The wildcard failure is invisible and permanent. Always fail this direction.

**One line into the team chat tonight**, because the person who deploys is the person who will be tempted:
> "Nobody adds a star to the Supabase redirect list. Ask me instead."

**Evidence:** screenshot before and after into `audit/evidence/`. An AI audit found a setting, you changed it, here is the picture — that is an se-m6 exhibit a non-technical judge understands instantly.

---

## 3 · Confirm email — OFF, deliberately, and you must state the cost

**Path:** Authentication → **Providers → Email** (newer dashboards: **Sign In / Providers → Email**) → *Confirm email*
**Set it to:** **OFF** — and you are only here to confirm it is off, not to change it.
**Why:** D-7 says a judge signs up on stage; with confirmation on, they create an account, cannot sign in, and your `se-m1` isolation demo becomes untestable in front of the panel.

**The two costs you accept, both of which you say before you are asked:**
1. **Sign-up becomes an account-existence oracle.** With confirmation off, signing up with an address that already exists gives a *different* answer than a fresh address — so an outsider can test whether a given person has an account here.
2. **Every email address in your system is an unverified claim.** The address printed next to a mission proves nothing about who owns it.

**Verify #1 before you say it — sixty seconds, Monday, as soon as auth exists:** sign up twice with the same address and read what the form actually says. GoTrue's obfuscation behaviour has changed across versions. If your version obfuscates, say nothing about it. A sentence that turns out to be false costs that item *and* everything else you said.

**What breaks if you "harden" it:** turning confirmation on breaks the judge's sign-up, and with built-in SMTP (see §11) the confirmation email may not even arrive. This is the single setting where the secure-looking choice is the wrong one for this week.

---

## 4 · Data API exposed schemas — the 30-second check nobody does

**Path:** Project Settings → **API** / **Data API** → *Exposed schemas* **[CHECK IN DASHBOARD — this moved out of Settings → API into its own Data API page on newer projects]**
**Set it to:** `public` (and `graphql_public` if it is already listed). Nothing else. Never `auth`. Never `storage`.
**Why:** this list decides which Postgres schemas the browser's publishable key can reach at all — it is a bigger switch than any policy you wrote.
**What breaks if wrong:** adding `auth` here exposes `auth.users` to PostgREST, and your whole se-m3 story ("our app never touches that schema") becomes false in one dropdown. If it is already only `public`, you have just earned a free, true sentence: *"the browser can only reach the public schema, and that is a project setting, not something our code chooses."*

---

## 5 · Storage — prove the zero

**Path:** **Storage → Buckets**
**Expect:** an empty list. D-2 says no Storage this week.
**Why:** Storage has its own permission system that RLS has nothing to do with, and a bucket left Public is the ten-second, no-account attack in your own `THREAT-MODEL.md` T1.
**What breaks if you create one "just in case":** nothing breaks — which is the problem. It sits there Public until a judge right-clicks a report.

**Do this:** screenshot the empty bucket list to `audit/evidence/t1-no-buckets.png`. That picture *is* your T1 evidence, and "we have no files, so we have no file permissions to get wrong" is a stronger answer than any signed-URL implementation you could ship this week. If a bucket does exist, uncheck **Public** now and tell the team.

> Note for consistency: `THREAT-MODEL.md` T1 currently describes a private bucket with signed URLs. Under D-2 there is no bucket at all. Fix T1 to match reality Monday, or a judge will ask to see the bucket you described.

---

## 6 · Security Advisor — free, automated, and it is literally your se-m6

**Path:** **Advisors → Security Advisor** (older dashboards: Database → Advisors, or Reports → Linter) **[CHECK IN DASHBOARD]**
**Do:** click *Refresh/Rerun*, read every row, screenshot the result.
**Why:** it is Supabase's own linter, and it finds exactly the four things a beginner gets wrong: **RLS disabled on a public table**, **SECURITY DEFINER views**, **function `search_path` mutable**, and **leaked-password protection off**.
**What breaks if you skip it:** nothing — until the judge opens it on your laptop, live, and finds a row you have never seen. Assume they might.

Run it **after** Sunday's SQL is applied, fix what it flags, run it again, and save **both** images: `audit/evidence/se-m6-advisor-before.png` and `-after.png`. Two screenshots and a sentence is the cleanest "we ran an audit and it changed two things" exhibit in the whole project, and it took three minutes.

Expect it to flag **leaked-password protection disabled** and stay flagged — see §9. Know that before the judge sees it, so you answer instead of flinch.

---

## 7 · Minimum password length — Monday in this exact order, or not at all

**Path:** Authentication → Providers → Email → *Minimum password length* (near *Password Requirements*)
**Set it to:** **10**. Leave **Password Requirements** (uppercase/digit/symbol) at its default — do not add character classes.

**Order matters, do not improvise:**
1. Set minimum length to 10. Save.
2. **Immediately** reset both demo-account passwords (Authentication → Users → the user → *Reset password* / *Change password*) to compliant ones, and write them on the demo checklist card.
3. Re-run `tests/two-window-check.js` and prove both accounts still sign in.

**Why:** the platform default (6) is below anything you would defend out loud, and length is the only password rule that is worth anything.
**What breaks if wrong:** existing accounts are **not** re-validated, so they keep working while you believe the rule is enforced; and character-class rules make the one password a presenter types on a projector harder to type, which is a live-demo failure, not a security win.

**Hard gate:** if this is not finished Monday night, do not touch it Tuesday or Wednesday. Say this instead:
> "Password rules are at the platform defaults for the prototype. On the paid tier Supabase also rejects passwords found in known breaches, which is what we would turn on with real researchers."

---

## 8 · MFA on your own Supabase account — the biggest thing in this document

**Path:** click your avatar → **Account Settings → Security** (or Preferences → Security) → *Multi-factor authentication* **[CHECK IN DASHBOARD]**
**Set it to:** enabled, authenticator app, on the account that owns the project. Save the recovery codes somewhere that is not the repo.
**Why in one sentence:** every control in `sql/` is enforced by a database whose settings can be changed by whoever can log into this dashboard — so your dashboard login is the real blast radius, and it is probably protected by a password you also used somewhere else.
**What breaks if you enable it:** you need your phone to log in. On demo week, that is a feature. Do not enable it on a shared team account nobody can get into on Thursday morning — check who actually holds the login first.

**While you are there:** Organization → **Team / Members**. Everyone who is listed can change everything in §1–§7. Remove anyone who is not on this project, and do not make all five students Owners. (Available roles differ by plan — **[CHECK IN DASHBOARD]**.) One rehearsed line: *"Five people can deploy; one account owns the database, and it has two-factor on it."*

---

## 9 · Leaked-password protection — the setting you will not turn on

**Path:** Authentication → Providers → Email → *Prevent use of leaked passwords* / HaveIBeenPwned check **[CHECK IN DASHBOARD — wording varies]**
**Set it to:** nothing. It is a **paid-plan feature**; on free it shows as available-but-locked, and the Security Advisor will keep flagging it.
**Why it matters anyway:** it is the one row on your Advisor screenshot that stays red, so it must be a sentence you own rather than a surprise:
> "That one is a Pro-tier control. It checks a new password against a breach corpus at sign-up. We are on the free tier for a four-day prototype, so we raised the minimum length instead and wrote the gap down rather than hiding the Advisor screen."

**What breaks if you try to fix it:** upgrading a project's plan mid-week to clear one linter row is money and risk for a student prototype with invented data. Don't.

---

## 10 · JWT / access-token expiry — look, record, leave alone

**Path:** Authentication → **Sessions** on newer dashboards; **Project Settings → API → JWT Settings** on older ones **[CHECK IN DASHBOARD — this one genuinely moved]**
**Set it to:** leave the default, **3600 seconds (1 hour)**. Write the number you actually see into your demo notes.
**Why:** it is how long a stolen token stays useful — and also how often your demo laptop must successfully reach Supabase to refresh.
**What breaks if you shorten it:** you turn venue wifi into an authentication failure. At 5 minutes, a refresh that fails on stage signs a researcher out mid-demo; at 1 hour, a hiccup has 60 minutes of slack to recover. **Shortening it is the classic "I hardened it and broke the demo" move.**
**What breaks if you lengthen it:** a token captured off your screen by a phone camera at rehearsal stays valid longer than the event.

On the same page you will see **Time-box user sessions** and **Inactivity timeout** — both **paid tier**. That is your answer to "how do you revoke a stolen session?":
> "Per user, Authentication → Users → *Sign out user*. Project-wide, rotate the JWT secret and every token dies at once. Time-boxed sessions and inactivity timeout are paid-tier settings we would turn on with real researchers."

That sentence closes, by naming where the switch is, the one gap `THREAT-MODEL.md` already lists as out of scope.

---

## 11 · Auth rate limits — read them, write them down, raise nothing

**Path:** Authentication → **Rate Limits** **[CHECK IN DASHBOARD — a relatively recent page; on older projects the limits exist but are not editable]**
**Set it to:** defaults. Your job here is to **read the numbers off the page and write them into `THREAT-MODEL.md`**, not to change them.

Roughly what you will find (**read the real numbers, do not quote mine**):
- sign-in / sign-up attempts per IP per window
- token refreshes per IP
- OTP / verification attempts per IP
- **emails per hour — very low on the built-in SMTP, on the order of a couple per hour**

**Why this earns marks:** `au-m4` wants guardrails with numbers. You already have DB-side numbers (5 runs/hour, 20/day, 60/day global, 40 steps). Adding *"and the platform rate-limits authentication itself at N per IP, which is a control we did not have to build"* is a free, true, specific sentence — and it is the honest answer to "what stops someone brute-forcing a password?", which is a question your SQL cannot answer.

**Two things that break, both demo-relevant:**
- **The email limit is the reason password reset is not a demo path.** If an account locks out on stage, reset it from **Authentication → Users**, never from the forgot-password form.
- **Everyone at the venue shares one IP.** Five students plus a judge signing in repeatedly during rehearsal can trip a per-IP limit and produce a sign-in failure that looks exactly like a broken app. Know the number so you recognise it. Do not raise the limit to "fix" it.

---

## 12 · Anonymous sign-ins — confirm OFF

**Path:** Authentication → Providers / Sign In → *Allow anonymous sign-ins*
**Set it to:** **OFF** (this is the default; you are confirming).
**Why:** it hands out a real `authenticated` JWT with no email at all.
**What breaks if it is on:** nothing leaks — your policies still key on `auth.uid()` — but anyone can burn your agent budget without leaving an email address, and "an authorized researcher" stops meaning even the little that open sign-up leaves it meaning.

---

## 13 · Database password and the direct connection — five minutes, no code

**Path:** Project Settings → **Database** → *Database password* (reset) — **[CHECK IN DASHBOARD]** for where the connection string and pooler settings sit now.
**Do:** if the database password is anything you invented at 1am, or has ever been pasted into a chat, **reset it to a long random one** and store it in a password manager. It goes in no file, no `.env`, no n8n note.
**Why:** that password is a login to Postgres as a superuser-grade role. It does not go through PostgREST, so it does not care about RLS, grants, policies, or anything in `sql/`. It is the one credential that makes every other control in your role irrelevant.
**What breaks:** resetting it breaks anything holding the old connection string — check with 04 whether n8n connects via Postgres directly or via the API before you rotate, and rotate on **Monday**, not Wednesday.

**Also true and worth naming, not fixing:** the free tier has no IP allowlist (**Network Restrictions** is a paid feature), so the database is reachable from the internet and defended by that password alone. That is an accurate limit to state: *"On the free tier there is no network restriction — the database is on the public internet behind a long random password. With real data we would restrict it to our own network, and that is a paid control."*

**One non-security thing while you are in there:** free projects **pause after ~a week of inactivity**. You are active daily, so this will not bite — but do not let Wednesday be silent and discover a paused project at 14:00 Thursday. Open the dashboard Thursday morning as part of pre-flight.

---

## What NOT to touch this week

- **Do not upgrade the Postgres version** if the dashboard offers it. It is downtime and risk, mid-week, for a prototype with invented data. Name it: *"There is a minor-version upgrade available; we did not take it during the build week because an upgrade window is not something a four-day project can absorb."*
- **Do not turn on Confirm email** to look responsible. It breaks D-7.
- **Do not shorten JWT expiry.** See §10.
- **Do not raise auth rate limits.**
- **Do not add a redirect wildcard** even temporarily "to test". Temporary is how it ships.
- **Do not create a Storage bucket** for anything, including "just the report".

---

## THE 60-SECOND VERIFICATION PASS

Do this Monday right after the sitting, and again at Wednesday rehearsal. It is sixty seconds and it catches the one failure mode that makes all of the above worthless: **a field you edited and never saved.**

1. **(10s) Reload, don't trust.** Hard-refresh Authentication → URL Configuration. Read the Site URL and the Redirect URLs back off the reloaded page. They must be the exact values from §1 and §2, with **no `*` anywhere**. A dashboard form that was edited but not saved looks identical to one that was saved, until you reload.
2. **(10s) Reload Auth → Providers → Email.** Confirm: *Confirm email* OFF, *Minimum password length* 10. Same reason.
3. **(15s) Sign in for real.** Normal window as Researcher A, **private** window as Researcher B (never two private windows — Incognito shares one session, so B replaces A and both windows become B). Run `tests/two-window-check.js` and read the **first line it prints: the account email.** If both accounts sign in after the password-length change, §7 is proven. If the email line is wrong, you are signed in as the wrong account and everything downstream is a lie.
4. **(10s) Storage → Buckets.** Still empty.
5. **(15s) Advisors → Security → Rerun.** Every row is either green or is the leaked-password row you have a sentence for. Screenshot.

**Optional, if you want the exhibit that actually proves the allowlist works** (not part of the 60 seconds — it costs one of your few built-in SMTP emails): from your own site's console, request a password reset for a demo account with a redirect you did *not* allowlist —

```js
sb.auth.resetPasswordForEmail('researcher-a@<your demo domain>', {
  redirectTo: 'https://example.com/steal.html'
});
```

— then open the email and look at the link's `redirect_to`. It should fall back to your Site URL, not `example.com`. Screenshot the link (crop the token out — **an evidence image shows the RESULT, never the REQUEST**) into `audit/evidence/redirect-allowlist-holds.png`. That is a demonstrated control, not a claimed one, and it is the strongest thirty seconds in this entire document.

---

## Evidence this sitting should leave behind

```
audit/evidence/url-config-before.png
audit/evidence/url-config-after.png          ← §2, the se-m6 "we changed a setting" exhibit
audit/evidence/t1-no-buckets.png             ← §5, proves T1 by absence
audit/evidence/se-m6-advisor-before.png
audit/evidence/se-m6-advisor-after.png       ← §6
audit/evidence/redirect-allowlist-holds.png  ← optional, §verification
```

All cropped. No address bar, no Network headers pane, no Local Storage pane, no console line containing `eyJ` or `sb_`. Raw captures go to `audit/evidence/local/` and are never committed.

---

## The three sentences to rehearse out loud

1. **"The redirect allowlist is the list of websites we are willing to hand a researcher's session to, so it contains exactly two URLs and no wildcard — on GitHub Pages a `*.github.io` wildcard would mean every GitHub account on earth."**
2. **"Email confirmation is off on purpose so you can sign up on stage. Two things follow: our sign-up form can tell you whether an address is already registered, and every email address in our system is a claim nobody verified. In a real deployment accounts come from the institution's directory, so there is no public sign-up form to ask."**
3. **"Every rule I wrote is enforced by a database whose settings are changed from a dashboard. So the account that owns that dashboard has two-factor authentication on it, and that is the smallest change in this project with the largest blast radius."**