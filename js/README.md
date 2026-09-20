# js/ — client code · owner: **01 · Front end**

What goes here: the JavaScript that runs the screens.

- `config.js` — the Supabase project URL and **publishable** key.
  Public by design; safe only because row level security is on.
  **The secret / service-role key never goes here.**
- `app.js` — shared helpers, the sign-in check, sign out
- one file per screen is fine

## House rules
- `textContent`, never `innerHTML`, for anything a person or the AI wrote
- no `onclick=` attributes — `addEventListener` only (a CSP will ban inline script)
- self-host libraries in `/vendor/` — no CDN
- every form answers: success, error, or loading. Never nothing
