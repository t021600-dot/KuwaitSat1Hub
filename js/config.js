// =====================================================================
// KuwaitSat-1 Mission Hub - client configuration
//
// THESE TWO VALUES ARE PUBLIC BY DESIGN. The browser has to receive
// them, so hiding them in a .env would be theatre.
//
// They are safe ONLY because row level security is enabled on every
// table. If RLS is ever off, this file becomes a download link to every
// researcher's private work.
//
// The SECRET / service-role key must NEVER appear here, in this repo,
// or in any chat window. It lives in the n8n credential store.
// =====================================================================

const SUPABASE_URL = 'https://kqboenytmzagdiweqygl.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_EdgMqS23EnQSKxghh7nYgw_5V1SM7TQ';

// USE THE sb_publishable_... KEY FORMAT, NOT THE LEGACY eyJ... ANON KEY.
// Our own pre-commit hook blocks any real JWT in a commit - including in
// this file, deliberately, because a legacy anon key and a service-role key
// look identical at a glance. With the new format the hook costs you nothing.
// Supabase dashboard -> Project Settings -> API Keys.

// FAIL LOUDLY, NOT SILENTLY.
// This file used to call createClient() at the top level. If supabase-js was
// missing, that threw - but because it throws inside its own <script> tag,
// every later script still loaded and the app carried on against mock data
// LOOKING COMPLETELY FINE. That is the worst possible failure shape: a demo
// that passes on stage while touching no database at all.
var sb = null;

if (typeof supabase === 'undefined') {
  console.error('[config] supabase-js did not load. Check vendor/supabase.js.');
} else if (SUPABASE_URL.indexOf('<PASTE') === 0) {
  console.warn('[config] Supabase is not configured yet - running on local ' +
               'mock data. Nothing is being saved. Paste the project URL and ' +
               'publishable key into js/config.js.');
} else {
  sb = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
}

// Exposed so the isolation test can run with a real signed-in session.
// Already public - this just gives the test a stable way to read them.
window.sb = sb;
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_KEY = SUPABASE_PUBLISHABLE_KEY;
