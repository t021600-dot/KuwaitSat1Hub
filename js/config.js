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

const SUPABASE_URL = '<PASTE PROJECT URL>';
const SUPABASE_PUBLISHABLE_KEY = '<PASTE PUBLISHABLE KEY>';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// Exposed so the isolation test can run with a real signed-in session.
// Already public - this just gives the test a stable way to read them.
window.sb = sb;
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_KEY = SUPABASE_PUBLISHABLE_KEY;
