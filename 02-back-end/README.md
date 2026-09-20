# 02 · Back end and data — Hind

My SQL, the table map, and the seed data.

## My MUST items
- `be-m1` data survives a refresh and a new browser
- `be-m2` the app reads from the database, not a list typed in the code
- `be-m3` any member can say what one row of any table is
- `be-m4` real accounts: two people sign up separately, each starts empty
- `be-m5` every automated run leaves a row

## Two rules from 03 · Security that outlive whoever writes the SQL
1. **Every new table ends with `alter table ... enable row level security;`**
   in the same paste that creates it. A table added later with RLS off is a
   total silent leak and nothing in the app will tell us.
2. **Every new view is created `with (security_invoker = on)`.** Without it a
   view runs as *its owner* and bypasses row level security entirely — it hands
   every row to every account while every check still reports green.

Also: Supabase → Authentication → Providers → Email → **Confirm email = OFF**,
or the judge cannot create an account on stage.
