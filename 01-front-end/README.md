# 01 · Front end — Retag

Everything I build lives here, **except the files GitHub Pages has to serve
from the repo root**: `index.html`, `signin.html`, `dashboard.html`,
`mission.html`, `css/`, `js/`. Those stay at root or the live site breaks.

Use this folder for: screen specs, state tables, wireframes, notes.

## My MUST items
- `fe-m1` a stranger reaches the main result without being told what to click
- `fe-m2` at least four working screens, every link works
- `fe-m3` every form answers: success, error, or loading. Never nothing
- `fe-m4` works on a phone in portrait
- `fe-m5` the result is on the screen, not in the console

## What 03 · Security needs from me
- `textContent`, never `innerHTML`, for anything a person or the AI wrote
- **Remove `maxlength`** from the objective box — it silently truncates the
  judge's 5,000-character paste and a row gets created
- Paste `03-security/docs/csp-meta.html` into every page head
- `window.sb = sb;` after creating the Supabase client
- Read `03-security/docs/DECISIONS.md` before building
