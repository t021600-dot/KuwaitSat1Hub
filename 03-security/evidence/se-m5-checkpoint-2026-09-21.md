# Evidence · the human checkpoint, tested five ways

**Owner:** 03 · Security · **Run:** Monday 21 September 2026
**Target:** `kqboenytmzagdiweqygl` — the live database, not a copy
**Method:** each role assumed with `set local role`, identity supplied the way
PostgREST supplies it (`request.jwt.claims`). Every accepting test inside a
transaction that was rolled back; the table count was checked afterwards and
is unchanged at 1 report.

---

## The question this answers

> *"The workflow pauses. The UI shows 'Agent proposes report — awaiting
> researcher approval.' Only then does the Report Agent finalise."*

A judge's first move is: **can I skip the button?** So we asked it ourselves,
before anyone else could.

---

## Result

| # | Who, doing what | Verdict |
|---|---|---|
| **A** | The mission's owner calls `generate_report` **straight from the console — no Approve button** | ⚠️ **ACCEPTED** |
| **B** | …and who did the database record as approver? | `approved_by` = **the caller himself** — could not be pointed elsewhere |
| **C** | A researcher aims it at **a colleague's mission** | ✅ **REFUSED** — `Mission not found.` |
| **D** | **`service_role`** — the automation engine, holding the service key | ✅ **REFUSED** — `permission denied for function generate_report` |
| **E** | **`anon`** — a signed-out visitor | ✅ **REFUSED** — `permission denied for function generate_report` |

---

## What this means, stated honestly

**A researcher with DevTools open can produce a report without clicking
Approve.** That is true, we tested it, and we say it out loud. Any claim that
the card itself stops them is disprovable in thirty seconds.

**The guarantee is narrower and worth more:**

> **No report can exist without a named, signed-in human who owns that mission.**

The researcher who skips the card is still a person putting **their own name**
on **their own mission's** report. That is approval through a different
keyboard, not an escape from it — `approved_by` is `(select auth.uid())`, read
from the verified JWT and never from a function argument, so it cannot be
aimed at a colleague (**B**), and `owns_mission()` is re-checked inside the
transaction, so it cannot reach across accounts (**C**).

**The part that genuinely cannot happen is the part that matters:**

> **The agent cannot approve itself.**

`generate_report` is deliberately absent from the `service_role` grant list
that carries `agent_log_step` / `agent_write_result` / `agent_finish_run`
(**D**). The automation engine has three write paths and is refused this one
outright. An unattended pipeline cannot manufacture a signed conclusion —
which is the entire reason a human checkpoint exists in an AI system.

**Separation of duties, as the grants actually stand:**

| Function | `anon` | `authenticated` | `service_role` |
|---|---|---|---|
| `generate_report` | ✗ | **✓** | **✗** ← the agent is locked out |
| `launch_mission` | ✗ | ✓ | ✗ |
| `researcher_log_step` / `_write_result` / `_finish_run` | ✗ | ✓ | ✗ |
| `agent_log_step` / `_write_result` / `_finish_run` | ✗ | ✗ | ✓ |
| `claim_next_run`, `sweep_stalled_runs` | ✗ | ✗ | ✓ |

Neither side can perform the other's job. The browser cannot claim a run; the
engine cannot sign a report.

---

## Said out loud to a judge

> "Yes — if you sign in as the owner and open the console, you can call the
> report function without pressing our button, and we tested exactly that
> rather than waiting for you to. What you cannot do is write a report onto a
> colleague's mission, approve as somebody else, or approve as the agent: the
> automation engine is refused that function outright, so no unattended
> pipeline can ever sign its own conclusion. The card makes the pause visible
> and the draft reviewable. The grant is what makes the accountability true."

---

## Reproducing it

`03-security/db/99_verify.sql` §checkpoint, or paste the block from this
file's companion run. The accepting case **must** be wrapped in
`begin … rollback;` — it writes a real report row otherwise.
