/* =====================================================================
   MONITOR  ·  the nightly sweep, run by the platform instead of by a
   person remembering to.
   Owner: deployment · calls into 04 · agents' and 03 · security's SQL

       GET /api/monitor     Authorization: Bearer <CRON_SECRET>

   Scheduled at 02:00 UTC by the "crons" entry in vercel.json. It makes
   two POSTs and decides nothing:

       /rest/v1/rpc/sweep_stalled_runs   {"p_minutes": 3}          -> n
       /rest/v1/rpc/monitor_record       {"p_source":"vercel_cron",
                                          "p_action":"sweep_stalled_runs",
                                          "p_runs_swept": n, "p_ok": …}

   Every rule about what a stalled run is lives in
   03-security/db/08_agent_claim.sql, and every rule about what a
   monitoring row may contain lives in 03-security/db/11_monitoring.sql.
   Those are the only places those rules should ever live.

   >>> WHY THIS EXISTS — the hole that was left open on purpose <<<
   08_agent_claim.sql section 4 had to pick who calls the sweeper and
   chose Option A: the worker calls it at the top of every poll. That
   file states the limitation out loud rather than hiding it — "if the
   worker is down, nothing sweeps. A run that died at the same moment
   the worker did stays 'running' until the worker comes back." Option B
   was pg_cron, rejected because it is a second scheduler to explain to
   a judge and a second thing that can be silently off.

   This file is Option B without pg_cron. The scheduler is the platform
   the site is already deployed to, there is nothing extra to install or
   enable, and when it fails it fails in the same deployment log the
   team already reads. Option A stays exactly as it is; this is a second
   belt, not a replacement. Both callers can fire in the same second
   without arguing, because the sweeper selects FOR UPDATE SKIP LOCKED
   and only ever touches rows that have had no activity for three
   minutes — calling it twice sweeps the same rows once.

   >>> THE NUMBER <<<
   Three minutes. The same three as the default in
   03-security/db/08_agent_claim.sql and as STALL_MS = 180000 in
   04-agents/app/automation.js. The screen, the database and this cron
   have to give up at the same moment or they disagree in front of a
   judge. CHANGE ONE, CHANGE ALL THREE, and say which three files.

   >>> WHY THE RECORD IS WRITTEN EVEN WHEN THE SWEEP FAILED <<<
   11_monitoring.sql section 3 asks for exactly this, in those words: "a
   monitoring writer whose only failure mode is silence is not
   monitoring". A night with no row is indistinguishable from a night
   the cron never ran, which is the one thing the table exists to rule
   out. So monitor_record is called on both paths, with p_ok false and
   the reason in p_anomaly when the sweep threw.

   >>> AND WHY A FAILED RECORD DOES NOT FAIL THE REQUEST <<<
   The HTTP status reports THE SWEEP, because the sweep is the part that
   protects the demo. If monitor_record itself fails — most likely
   because 11_monitoring.sql has not been run against the project yet,
   which answers 404 — this still returns 200 with "recorded": false,
   the reason in "record_error", and a console.error line. Otherwise a
   table that is merely not installed yet would paint the cron red every
   night and send whoever opens the deployments tab on demo morning
   hunting for a fault in the sweeper, which is working. If you would
   rather know loudly, the single place to change that is the status
   line at the end of run().

   >>> CommonJS, not an ES module — this is not a style preference <<<
   The repository has no package.json, so Node reads every .js file as
   CommonJS. `export default` in a .js file with no "type": "module"
   above it is a syntax error, and `node --check api/monitor.js` refuses
   it before Vercel ever sees the commit. module.exports is also what a
   zero-config api/ directory has always accepted. Adding a package.json
   purely to say "type": "module" would give this static site an install
   step, which is the one thing the build is not allowed to grow.

   >>> fetch, with no client library <<<
   fetch has been a global in Node since 18, and Vercel's Node runtime
   is 18 or newer (22.x for a project created now). So there is no
   @supabase/supabase-js here, no vendored client, nothing to install.
   There is still an explicit guard below, because a bare ReferenceError
   at 02:00 in a log nobody is watching is worse than a 500 that names
   the problem.

   >>> KEYS <<<
   SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are read from process.env
   and from nowhere else. Never from js/config.js — that file holds the
   PUBLISHABLE key, which is public by design and, quite correctly,
   cannot execute either of these functions: both are revoked from
   public, anon and authenticated and granted to service_role only. No
   value from process.env is ever logged or returned; every error path
   runs its text through scrub() first, because a service-role key that
   reaches a deployment log is a key you have to rotate, at the worst
   possible moment.
   ===================================================================== */

var crypto = require('crypto');

/* See THE NUMBER above before touching this. */
var IDLE_MINUTES = 3;

/* Ten seconds per call. A cron that hangs holds the function open until
   the platform kills it, and the log then reads "timed out", which looks
   like a Vercel fault and sends the next person to the wrong dashboard.
   Give up early, and say which call gave up. */
var RPC_TIMEOUT_MS = 10000;

/* The two function names this file is allowed to post to. There is no
   third, and there is no /rest/v1/<table> URL anywhere in here:
   service_role has `all` revoked on every table
   (03-security/db/03_grants.sql), so a table URL would be a 401 every
   night and the first sign of it would be a red cron nobody can
   explain. Writes go through functions or they do not go. */
var SWEEP = 'sweep_stalled_runs';
var RECORD = 'monitor_record';

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  /* A monitoring answer a CDN is allowed to keep is not a monitoring
     answer. */
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

/* Remove anything that came out of process.env from text that is about
   to be logged or returned. PostgREST error bodies normally contain only
   the database's own sentence, but "normally" is not a security control,
   and this costs two string replaces on a path that runs once a night.
   Short values are left alone so that a one-character secret in a broken
   preview environment cannot blank out the whole message. */
function scrub(text, secrets) {
  var out = String(text === null || text === undefined ? '' : text);
  for (var i = 0; i < secrets.length; i++) {
    var s = secrets[i];
    if (s && String(s).length > 8) { out = out.split(String(s)).join('[redacted]'); }
  }
  return out;
}

/* timingSafeEqual throws when the two buffers differ in length, so the
   lengths have to be compared first. That leaks the LENGTH of the
   secret, which is the standard and accepted cost of this pattern. What
   it must not leak is the position of the first wrong byte, and that is
   exactly what timingSafeEqual is for. */
function constantTimeEqual(a, b) {
  var ba = Buffer.from(String(a), 'utf8');
  var bb = Buffer.from(String(b), 'utf8');
  if (ba.length !== bb.length) { return false; }
  return crypto.timingSafeEqual(ba, bb);
}

/* One sentence for a call that did not work. The database's refusals
   are already sentences ("Idle minutes must be at least 1."), so they
   are carried rather than rewritten — but scrubbed first, and capped so
   that one enormous HTML error page from a proxy in front of the
   project cannot fill the log. status 0 means the call never got an
   answer at all, and rpc() has already written a sentence naming the
   function, so it is not named twice. */
function describe(fn, result, redact) {
  var body = scrub(result.text, redact).slice(0, 300);
  if (!result.status) { return body; }
  return fn + ' failed with HTTP ' + result.status + ': ' + body;
}

/* One RPC, with its own timeout. Returns a plain object rather than
   throwing, because both call sites here have to carry on and report
   afterwards — the second call exists precisely to record that the
   first one failed. */
async function rpc(base, key, fn, args) {
  var controller = new AbortController();
  var timer = setTimeout(function () { controller.abort(); }, RPC_TIMEOUT_MS);
  try {
    var response = await fetch(base + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': 'Bearer ' + key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(args),
      signal: controller.signal
    });
    var text = await response.text();
    return { ok: response.ok, status: response.status, text: text };
  } catch (e) {
    var aborted = e && e.name === 'AbortError';
    return {
      ok: false,
      status: 0,
      text: aborted
        ? (fn + ' did not answer within ' + (RPC_TIMEOUT_MS / 1000) + ' seconds.')
        : (fn + ' could not be reached: ' + String((e && e.message) || e))
    };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = async function monitor(req, res) {
  var started = Date.now();

  /* Vercel cron issues a GET. Anything else is a person exploring or a
     scanner, and neither should be able to make the database work. */
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return send(res, 405, {
      ok: false,
      error: 'Method not allowed. Vercel cron sends GET.'
    });
  }

  var url = process.env.SUPABASE_URL;
  var key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  var secret = process.env.CRON_SECRET;

  /* Absent, present-but-blank, or set. Three states that the dashboard
     renders identically and that `if (!x)` collapses into one. */
  function envState(name, withLength) {
    var v = process.env[name];
    if (v === undefined || v === null) { return 'not set on this deployment'; }
    if (String(v).trim() === '') { return 'SET BUT EMPTY'; }
    return withLength ? ('set, ' + String(v).length + ' characters') : 'set';
  }

  /* Fail closed, and name the variable. A monitoring endpoint that
     quietly returns 200 when it is not configured is worse than no
     monitoring endpoint, because it manufactures the evidence that
     everything is fine. CRON_SECRET is in this list for the same
     reason: with no secret set there is nothing to check a caller
     against, and the endpoint would be a free button for the internet
     to press. */
  var missing = [];
  if (!url) { missing.push('SUPABASE_URL'); }
  if (!key) { missing.push('SUPABASE_SERVICE_ROLE_KEY'); }
  if (!secret) { missing.push('CRON_SECRET'); }
  if (missing.length) {
    console.error('monitor: refusing to run. Missing: ' + missing.join(', '));
    return send(res, 500, {
      ok: false,
      error: 'Not configured. Missing environment variable' +
             (missing.length > 1 ? 's' : '') + ': ' + missing.join(', ') +
             '. Set ' + (missing.length > 1 ? 'them' : 'it') + ' in the Vercel ' +
             'dashboard, Settings -> Environment Variables, Production. ' +
             'See api/README.md.',

      /* WHY THIS DIAGNOSTIC IS HERE, AND WHY IT LEAKS NOTHING.

         "Missing SUPABASE_URL" and a variable sitting plainly in the
         dashboard is a contradiction with three possible causes, and
         from outside you cannot tell them apart:

           1. the variable was added AFTER this build, and Vercel
              resolves them at BUILD time, so the running deployment
              cannot see it
           2. it exists with an empty value, which `if (!url)` treats
              as missing and the dashboard shows as a row like any other
           3. it is scoped to an environment this deployment is not

         We burned a redeploy and several minutes of a demo eve guessing.
         So the endpoint answers it instead: which commit is actually
         running, which environment it thinks it is, and for each
         variable whether it is absent, present-but-empty, or set.

         NO VALUE IS EVER RETURNED. The two secrets report only their
         state. SUPABASE_URL reports its length as well, because it is a
         public project URL printed in js/config.js already - and a
         length is how you catch a trailing space or a truncated paste. */
      diagnostic: {
        running_commit: (process.env.VERCEL_GIT_COMMIT_SHA || 'unknown').slice(0, 7),
        vercel_env: process.env.VERCEL_ENV || 'unknown',
        SUPABASE_URL: envState('SUPABASE_URL', true),
        SUPABASE_SERVICE_ROLE_KEY: envState('SUPABASE_SERVICE_ROLE_KEY', false),
        CRON_SECRET: envState('CRON_SECRET', false)
      }
    });
  }

  /* Vercel sends "Authorization: Bearer <CRON_SECRET>" on a cron
     invocation when CRON_SECRET is set on the project. The same header
     is how a human tests this by hand — see api/README.md. */
  var auth = req.headers['authorization'] || '';
  if (!constantTimeEqual(auth, 'Bearer ' + secret)) {
    return send(res, 401, { ok: false, error: 'Unauthorised.' });
  }

  if (typeof fetch !== 'function') {
    return send(res, 500, {
      ok: false,
      error: 'No global fetch in this runtime. This function needs Node 18 ' +
             'or newer; check Settings -> General -> Node.js Version.'
    });
  }

  /* Trailing slashes on SUPABASE_URL are the classic paste error: they
     turn the path into //rest/v1/rpc/... and PostgREST answers 404 with
     nothing helpful in it. */
  var base = String(url).replace(/\/+$/, '');
  var redact = [key, secret];

  /* --------------------------------------------------------------
     CALL 1 · the sweep. This is the one that matters.
     -------------------------------------------------------------- */
  /* p_minutes, NOT p_idle_minutes.

     PostgREST resolves an RPC by its ARGUMENT NAMES, so a wrong name is
     not a wrong value - it is a 404, "Could not find the function
     public.sweep_stalled_runs(p_idle_minutes) in the schema cache". The
     deployed signature is sweep_stalled_runs(p_minutes integer);
     checked against pg_proc, not against the comment at the top of this
     file, which said p_idle_minutes and was wrong.

     Nothing caught it because nothing had ever run: the three
     environment variables were unset until 23 Sep 2026, so every
     invocation failed at the config check before reaching this line. The
     first real run would have been 02:00 the morning of the demo, and it
     would have written ok=false with a 404 anomaly straight into the
     Platform Health panel on the Audit view.

     The name is changed HERE rather than in the database on purpose:
     `create or replace function` cannot rename an input parameter (it
     raises "cannot change name of input parameter"), so aligning the SQL
     would mean a drop and recreate, which is not a thing to do to a live
     database the night before a demo. */
  var sweep = await rpc(base, key, SWEEP, { p_minutes: IDLE_MINUTES });

  var swept = null;
  var sweepError = null;

  if (sweep.ok) {
    /* PostgREST returns a bare scalar for a function that RETURNS
       integer, so the body is `0` or `4`. It is read defensively rather
       than trusted: the shape becomes an array the day somebody
       redefines the function as RETURNS TABLE, and a monitoring endpoint
       that throws while parsing its own success case reports the wrong
       thing about a night when nothing was wrong. */
    var parsed = null;
    try { parsed = sweep.text ? JSON.parse(sweep.text) : 0; } catch (e) { parsed = null; }
    swept = typeof parsed === 'number'
      ? parsed
      : (Array.isArray(parsed) && typeof parsed[0] === 'number' ? parsed[0] : null);
    if (swept === null) {
      sweepError = SWEEP + ' answered in a shape this function does not ' +
                   'recognise: ' + scrub(sweep.text, redact).slice(0, 120);
    }
  } else {
    sweepError = describe(SWEEP, sweep, redact);
  }

  /* --------------------------------------------------------------
     CALL 2 · the record. Written on BOTH paths, on purpose — see the
     header. p_detail stays small; monitor_record drops anything over
     4096 bytes and says so in the row, which would be a worse row than
     one that was small to begin with.
     -------------------------------------------------------------- */
  var elapsed = Date.now() - started;
  var record = await rpc(base, key, RECORD, {
    p_source: 'vercel_cron',
    p_action: SWEEP,
    p_runs_swept: swept === null ? 0 : swept,
    p_ok: sweepError === null,
    p_anomaly: sweepError,
    p_detail: { ms: elapsed, idle_minutes: IDLE_MINUTES }
  });

  var recordError = null;
  if (!record.ok) {
    recordError = describe(RECORD, record, redact);
    /* 404 here almost always means one thing, and saying so saves
       somebody half an hour at a bad time. */
    if (record.status === 404) {
      recordError += ' (a 404 here usually means 03-security/db/' +
                     '11_monitoring.sql has not been run against this project yet)';
    }
    console.error('monitor: ' + recordError);
  }

  if (sweepError) {
    console.error('monitor: ' + sweepError);
    return send(res, 502, {
      ok: false,
      error: sweepError,
      recorded: record.ok,
      record_error: recordError,
      ms: Date.now() - started,
      at: new Date().toISOString()
    });
  }

  console.log('monitor: swept ' + swept + ' stalled run(s) in ' + elapsed +
              ' ms; recorded=' + record.ok);
  return send(res, 200, {
    ok: true,
    swept: swept,
    idle_minutes: IDLE_MINUTES,
    recorded: record.ok,
    record_error: recordError,
    ms: Date.now() - started,
    at: new Date().toISOString()
  });
};
