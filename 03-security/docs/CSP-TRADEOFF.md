# The CSP tradeoff — why `script-src` allows `'unsafe-inline'`

**Owner:** 03 · Security · **Decided:** Monday 21 September 2026
**Status:** accepted, with a stated path out

This is written down because it is a **real reduction in protection**, and a
judge who reads our CSP will spot it. Better to have the answer ready than to
be caught by it.

---

## What changed

The Content-Security-Policy on every page now includes:

```
script-src 'self' 'unsafe-inline'
```

Previously it was `script-src 'self'`, which is meaningfully stronger.

## Why

The product is now Hind's research console. That page contains:

| | |
|---|---|
| inline `<script>` blocks | **27** |
| inline `<style>` blocks | **5** |
| `onclick=` attributes | **51** |

`script-src 'self'` blocks every one of those. Applied to this page it does not
degrade the experience — **it blanks the site entirely.** No globe, no charts,
no agent pipeline, no buttons.

The team's instruction is explicit: nothing in that page may be changed or
removed. Moving 27 script blocks and 51 handlers into external files *is*
changing it, and it is several hours of work with a real chance of breaking a
6,000-line page two nights before the demo.

**So the choice was: a strict CSP on a blank page, or a weaker CSP on a working
product.** We chose the working product, and we say so.

## What it costs, stated plainly

`'unsafe-inline'` means that **if** an attacker can get script text into the
page, the browser will run it. It removes the second wall behind our escaping.

**What still protects us:**

- **The first wall is intact.** Our integration layer renders every piece of
  researcher-typed and AI-written text with `textContent`, never `innerHTML`.
  `'unsafe-inline'` only matters once something has already gone wrong there.
- **Row level security is untouched.** Even a successful script injection runs
  as *that researcher's own session*. It cannot read another researcher's
  missions, because the database decides that, not the page.
- **Everything else in the CSP got stricter**, not looser:
  `frame-ancestors 'none'` · `object-src 'none'` · `base-uri 'none'` ·
  `form-action 'self'` · an explicit allowlist for fonts, tiles, the video
  embed and the Supabase origin — nothing else can be loaded or contacted.
- **HSTS, `nosniff`, `Referrer-Policy` and `Permissions-Policy`** are all set
  as real response headers, which was impossible on our previous host.

## The path out, when the UI is rebuilt

The team plans to rework the interface toward the ESA / NASA visual direction.
**That rebuild is the moment to fix this**, and it costs almost nothing if done
then rather than retrofitted now:

1. Move each inline `<script>` block into a file under `js/`.
2. Replace every `onclick="fn()"` with `addEventListener` in that file.
3. Drop `'unsafe-inline'` from `script-src`.
4. Re-run the page and confirm the console is clean.

Done during a rewrite this is a naming exercise. Done now it is surgery on a
working page under deadline.

## Said out loud to a judge

> "Our content security policy allows inline script, and that is weaker than I
> would like. The page we shipped has twenty-seven inline script blocks and
> fifty-one inline handlers, and a strict policy blanks it completely — so the
> honest choice was a working product with a documented gap rather than a
> perfect header on a blank screen. What it does not weaken is the isolation:
> even a successful injection runs as that researcher's own session, and row
> level security still decides what the database hands back. We know exactly
> how to close it, and it costs nothing once the interface is rebuilt."

---

## The other headers, for reference

| Header | Value | What it does |
|---|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Browser refuses plain HTTP to this site for a year |
| `X-Content-Type-Options` | `nosniff` | Stops the browser guessing a file is script when it isn't |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Third parties see our origin, never the full URL |
| `X-Frame-Options` | `DENY` | Cannot be framed — clickjacking |
| `Permissions-Policy` | camera, mic, geolocation… all `()` | Denies powerful APIs the site never uses |

**None of these were possible on GitHub Pages**, which cannot send response
headers at all. Moving to Vercel is what made them available.
