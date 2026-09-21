# Evidence · `se-m1` — the isolation matrix

**Owner:** 03 · Security · **Run:** Monday 21 September 2026, after a real
browser run wrote a real audit trail
**Where:** the live database `kqboenytmzagdiweqygl`

---

## Why this version is stronger than the earlier one

The first `se-m1` run had Dr Yousef at **0 / 0 / 0 / 0** — an empty
account. An empty account proves very little: it is indistinguishable
from a query that is simply broken.

Now **both researchers hold real work**, produced by actually using the
site: Dr Yousef launched a mission through the workflow, the agents ran,
two zones were refused on the record, and he approved the report.

---

## The matrix

**The database holds:** 3 missions · 2 runs · 16 agent steps · 5 results
· 2 reports.

| Signed in as | missions | runs | steps | results | reports | `auth.users` |
|---|---|---|---|---|---|---|
| **Dr Noura Al-Khaled** | 1 | 1 | 6 | 3 | 1 | **refused** |
| **Dr Yousef Al-Rashid** | 2 | 1 | 10 | 2 | 1 | **refused** |
| **sum** | **3** | **2** | **16** | **5** | **2** | |
| **actually in the database** | **3** | **2** | **16** | **5** | **2** | |

**The sums are exact.** Every row in the database belongs to exactly one
researcher's view, and no row appears in both. That is a *partition*, not
merely a filter — which is a stronger statement than "each of them saw
something plausible."

Neither can read `auth.users` at all. Not a filtered list of colleagues:
the query is refused.

---

## Also proven from the browser, signed in as Dr Yousef

| Question | Answer |
|---|---|
| `my_missions` | his own mission |
| Dr Noura's mission **by its exact id** | **0 rows** |
| `mission_runs` queried as a table | **REFUSED** — permission denied |
| `reports` | **1** — his own, while the table holds 2 |
| Is his report's `approved_by` his own account? | **yes** |

Knowing the id is worth nothing. He is not guessing at a name — he has
the exact primary key of a row that exists, and the database returns
nothing.

---

## What makes it true

- **Grants first.** `anon` holds zero table grants; `authenticated` holds
  column-level `SELECT` on what a researcher may see, and nothing else.
  RLS decides *which rows*; grants decide *whether you may ask*.
- **`security_invoker = on`** on all three `my_*` views — verified live.
  Their owner is `postgres`, which **bypasses RLS**. With that setting
  off, every researcher would read every row through them.
- **`service_role` holds no access to the views at all**, so the
  automation engine cannot read a researcher's work either.
- **Every write path re-reads ownership inside the transaction**
  (`owns_mission()`), rather than trusting anything the browser sent.

---

## Reproducing it

`03-security/db/99_verify.sql`. The matrix is the block that assumes each
researcher's JWT the way PostgREST does, with `set local role
authenticated` and `request.jwt.claims`.
