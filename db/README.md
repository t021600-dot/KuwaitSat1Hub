# db/ — the database · owners: **02 · Back end and data** + **03 · Security**

SQL files, numbered, run **in order, one block at a time**.
If a block errors you need to know which one.

- `01_...` tables
- `02_...` onwards: helpers, permissions, policies, validation
- `99_verify.sql` — proves it actually took effect

## Two rules that outlive whoever wrote them
1. **Every new table ends with `alter table ... enable row level security;`**
   in the same paste that creates it.
2. **Every new view is created `with (security_invoker = on)`.**
   A view without it runs as *its owner* and bypasses row level security
   entirely — it hands every row to every account while everything still
   looks correct.

Ask 03 · Security before changing a policy, a grant or a constraint.
