// =====================================================================
// KuwaitSat-1 Mission Hub · tests/two-window-check.js
// THE se-m1 PROOF. This is the 40 seconds the whole security role is
// graded on. Owner: 03 · Security
//
// The judge's question, word for word:
//     "Show me account B failing to read account A's record."
//
// ---------------------------------------------------------------------
// WHY THIS SCRIPT EXISTS AND THE SCREEN DOES NOT COUNT
//
// If you prove it by clicking around the app, you have proved that our
// JavaScript chose not to draw a row. That is not security. This script
// skips our page entirely and asks the database directly, so a zero here
// is the API refusing, not the UI hiding.
//
// ---------------------------------------------------------------------
// >>> THE TRAP THAT MAKES THIS SCRIPT PROVE NOTHING <<<
//
// A signed-OUT window produces almost the SAME OUTPUT as a correct pass:
// zeros and permission errors everywhere. Private-window sessions drop
// all the time on a borrowed laptop.
//
// So the FIRST thing this script prints is WHO IS ASKING. If it does not
// say "signed in as researcher-b@...", stop and sign in again. A zero
// from nobody proves nothing at all.
//
// ---------------------------------------------------------------------
// SETUP (ask 01 · Front end for this tonight — it is one line):
//     window.sb = sb;        // after they create the Supabase client
//
// Using their client, not a new one, is the point: it carries the real
// session, so this test runs as a genuinely signed-in researcher.
//
// RUN IT IN RESEARCHER B'S WINDOW, WHICH IS THE **PRIVATE** ONE.
// The setup is: A in a NORMAL window, B in a PRIVATE window.
// NOT two private windows - every Incognito window in one browser shares a
// single session, so signing in as B replaces A and both become B.
// NOT two normal tabs - same problem. One of each = two real sessions.
//
// NEVER paste a secret / service-role key in here. It bypasses RLS and
// every test passes for the wrong reason.
// =====================================================================

const sb = window.sb;
if (!sb) throw new Error('window.sb is missing — ask 01 to expose the client.');

// ---- BEAT 0 · WHO AM I. Without this the rest is worthless. ----------
const { data: { user } } = await sb.auth.getUser();
console.log('%c signed in as: ' + (user?.email ?? 'NOT SIGNED IN — STOP'),
            'font-size:16px;font-weight:bold');
if (!user) throw new Error('No session. Sign in as Researcher B and run again.');

// Paste the mission id the judge just watched you copy off A's screen.
const A_MISSION = '<paste Researcher A mission id>';

console.log('--- asking the database directly, as ' + user.email + ' ---');

// ---- BEAT 1 · every table B owns nothing in --------------------------
for (const t of ['missions', 'mission_runs', 'agent_steps', 'results', 'reports']) {
  const { data, error } = await sb.from(t).select('id').limit(50);
  console.log(t.padEnd(14), '| rows:', data?.length ?? 0,
              '| error:', error?.message ?? 'none');
}

// ---- BEAT 2 · A's mission, BY ID, in B's hand ------------------------
const one = await sb.from('missions').select('id,title,objective').eq('id', A_MISSION);
// THE BUG THIS AVOIDS, on the one beat the whole role is graded on:
// if the query ERRORS - wrong table name, dead session, a typo - then
// one.data is null, `?? 0` turns that into 0, and the line prints a
// confident green "rows: 0" that looks exactly like a perfect pass.
// A check that errors is NOT a pass. So read the error FIRST.
if (one.error) {
  console.log('%cNOT A PASS - the query errored: ' + one.error.message,
              'font-size:16px;font-weight:bold;color:#c00');
  throw new Error('Beat 2 errored. Read the message above. Do not tick this box.');
}
console.log('%cA's mission by id | rows: ' + one.data.length,
            'font-size:16px;font-weight:bold;color:' + (one.data.length === 0 ? '#0a0' : '#c00'));

// ---- BEAT 3 · the contrast: B's OWN missions still work --------------
// Proves the database is filtering, not simply broken.
const mine = await sb.from('my_missions').select('id,title');
console.log('my own missions   | rows:', mine.data?.length ?? 0);

// ---- BEAT 4 · the raw HTTP answer, for the judge who asks ------------
// Shows a literal HTTP 200 with an empty array [] — the server answered,
// it did not error, and it had nothing to give. This is the difference
// between "refused" and "broken" and it is worth 10 seconds on stage.
//
// NOTE: sb.supabaseUrl / sb.supabaseKey exist at runtime but are marked
// protected in supabase-js v2 and are NOT part of the public API — a
// future version can remove them and this beat dies mid-demo. So take the
// values from the same config the app uses, and only fall back to the
// client's own properties.
// >>> Ask 01 to expose these alongside window.sb:
//        window.SUPABASE_URL = SUPABASE_URL;
//        window.SUPABASE_KEY = SUPABASE_PUBLISHABLE_KEY;
const URL_ = window.SUPABASE_URL ?? sb.supabaseUrl;
const KEY_ = window.SUPABASE_KEY ?? sb.supabaseKey;

const { data: { session } } = await sb.auth.getSession();
if (!session) throw new Error('Session gone between beats — sign in and re-run.');

const raw = await fetch(
  URL_ + '/rest/v1/missions?select=id,title&id=eq.' + A_MISSION,
  { headers: { apikey: KEY_,
               Authorization: 'Bearer ' + session.access_token } });
console.log('raw HTTP', raw.status, '->', await raw.text());
// Expected on stage:  raw HTTP 200 -> []
// 200 + empty array = the database refused.  401/403 = the session died,
// which is the WRONG kind of zero — say so out loud and sign in again.

// =====================================================================
// HOW TO READ THE OUTPUT
//
//   REAL PASS  · "signed in as: researcher-b@..." at the top, AND
//                A's mission by id | rows: 0, AND
//                raw HTTP 200 -> []
//                (200 with an empty array = the database refused)
//
//   FAKE PASS  · "NOT SIGNED IN" at the top. You proved nothing.
//                Sign in and run it again.
//
//   FAIL       · any row at all from A's mission id.
//                Also a FAIL: an error naming a table or a column —
//                that is information disclosure. Write it up and map it.
//
// A check that errors because you typed the table name wrong is NOT a
// pass. Read the error text before you tick the box.
// =====================================================================
