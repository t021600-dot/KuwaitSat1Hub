/* =====================================================================
   PREFLIGHT  ·  the pre-demo checklist, as something you RUN.
   Owner: 04 · Automation and agents (Dana)

       node 04-agents/tools/preflight.js

   Run it Wednesday night, and again on Thursday twenty minutes before
   the slot. No install, no network, no database. Node only.

   WHAT IT IS FOR. A checklist on paper gets ticked from memory at
   17:55. This one reads the actual files and tells you which claims in
   docs/DEMO-RUNBOOK.md and GUARDRAILS.md are still true. Everything it
   checks is something that has silently broken in this repo at least
   once already: a panel that is not wired in, a generated bundle that
   is a day older than the threshold it contains, two panels with two
   different stall timeouts, a placeholder project URL.

   WHAT IT CANNOT CHECK, and does not pretend to. It has no database
   connection and no n8n session. Whether the SQL has been run, whether
   the workflow is ACTIVE, and whether the dashboard is closed are
   printed at the end as ticks you do by hand, with the exact query or
   click for each. A green run of this file is not a working platform.

   Exit code: 0 if nothing FAILED, 1 otherwise. TODOs do not fail the
   run - they are work that is honestly not done yet, and they are
   listed so nobody claims it is.

   Flags:
     --expect-break   break_visualization is SUPPOSED to be true right
                      now (you are mid deliberate-failure demo)
     --no-tests       skip running the four test files
   ===================================================================== */

var fs    = require('fs');
var path  = require('path');
var cp    = require('child_process');

var ROOT   = path.join(__dirname, '..', '..');            /* repo root */
var AGENTS = path.join(ROOT, '04-agents');
var SEC    = path.join(ROOT, '03-security', 'db');

/* >>> WHERE THE PRODUCT ACTUALLY IS, AND THE BUG THIS LINE FIXES <<<
   This file used to define FRONT = 01-front-end/app and look for
   mission.html and 01-front-end/app/js/config.js inside it. Neither has
   ever existed: 01-front-end/app holds one file, RETAG-NOTES.md, and the
   site that deploys is index.html at the REPO ROOT with its scripts in
   js/. So checks C1 and C2 printed

       TODO  C1  NO automation panel is wired into mission.html
       TODO  C2  js/config.js does not exist, so window.sb is never created

   every single run, and both statements were false. That is worse than
   no check at all: a checklist that is permanently half-orange teaches
   the person reading it to skip the orange, and the day something real
   goes orange nobody looks. Corrected 21 Sep 2026.

   SITE      what Vercel serves, and what the judge opens.
   REFERENCE 04-agents/app — the reference implementation of the panel.
             It is NOT served (see 04-agents/README.md) and nothing in
             index.html loads it. It is still checked, because a rule
             that holds for the shipped panel should hold for the file
             somebody might copy next week. */
var SITE      = ROOT;
var REFERENCE = path.join(AGENTS, 'app');

var argv = process.argv.slice(2);
var EXPECT_BREAK = argv.indexOf('--expect-break') !== -1;
var RUN_TESTS    = argv.indexOf('--no-tests') === -1;

var results = { pass: 0, fail: 0, todo: 0 };

function line(kind, id, text, fix) {
  var tag = kind === 'pass' ? 'PASS' : kind === 'fail' ? 'FAIL' : 'TODO';
  results[kind === 'pass' ? 'pass' : kind === 'fail' ? 'fail' : 'todo'] += 1;
  console.log('  ' + tag + '  ' + id + '  ' + text);
  if (fix && kind !== 'pass') { console.log('        -> ' + fix); }
}
function check(id, text, cond, fix) { line(cond ? 'pass' : 'fail', id, text, fix); }
function todo(id, text, fix)        { line('todo', id, text, fix); }
function head(t) { console.log('\n' + t); }

function read(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch (e) { return null; }
}
function exists(p) { try { fs.statSync(p); return true; } catch (e) { return false; } }
function mtime(p) { try { return fs.statSync(p).mtimeMs; } catch (e) { return 0; } }

/* Strip // and block comments so a check about CODE is not answered by
   a sentence in a comment. Crude on purpose: it over-strips inside
   string literals containing "//", which in this repo is only ever a
   URL - and a URL in code is exactly what some of these checks hunt
   for, so over-stripping would hide a finding. Both URL checks below
   therefore read the RAW text and filter comment lines themselves. */
function decomment(src) {
  return String(src || '')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map(function (l) { return l.replace(/^\s*\/\/.*$/, ''); })
    .join('\n');
}

function numberIn(src, name) {
  var m = new RegExp(name + '\\s*=\\s*([0-9.]+)').exec(String(src || ''));
  return m ? Number(m[1]) : null;
}

console.log('\n=====================================================');
console.log(' PREFLIGHT  ·  04 · Automation and agents');
console.log(' ' + new Date().toString());
console.log('=====================================================');


/* =====================================================================
   A · THE WORKER  (n8n/workflow.json)
   ===================================================================== */
head('A · The n8n workflow file');

var wfPath = path.join(AGENTS, 'n8n', 'workflow.json');
var wfRaw  = read(wfPath);
var wf     = null;
try { wf = JSON.parse(wfRaw); } catch (e) { wf = null; }

check('A1', 'workflow.json exists and parses', !!wf,
      'node 04-agents/tools/build-workflow.js');

if (wf) {
  var http = wf.nodes.filter(function (n) { return /httpRequest/.test(n.type); });
  var badUrl = http.filter(function (n) {
    var u = (n.parameters && n.parameters.url) || '';
    return u.indexOf('/rest/v1/rpc') === -1;
  });
  check('A2', 'every HTTP node calls /rest/v1/rpc/ and no table URL',
        http.length > 0 && badUrl.length === 0,
        badUrl.length ? 'these nodes are wrong: ' +
          badUrl.map(function (n) { return n.name; }).join(', ') +
          '. service_role has NO table grants - a table URL is a 401 mid-run.' : '');

  var ctl = wf.nodes.filter(function (n) { return n.name === 'Demo controls'; })[0];
  var asg = (ctl && ctl.parameters && ctl.parameters.assignments &&
             ctl.parameters.assignments.assignments) || [];
  function field(name) {
    var f = asg.filter(function (a) { return a.name === name; })[0];
    return f ? f.value : undefined;
  }
  var url = String(field('supabase_url') || '');
  check('A3', 'Demo controls has your real project URL',
        /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) && url.indexOf('YOUR-PROJECT-REF') === -1,
        'open the Demo controls node and paste https://<project-ref>.supabase.co ' +
        '(no trailing slash). Current value: ' + (url || '(none)'));

  var brk = field('break_visualization') === true;
  check('A4', EXPECT_BREAK ? 'break_visualization is TRUE (failure demo armed)'
                           : 'break_visualization is false',
        EXPECT_BREAK ? brk : !brk,
        EXPECT_BREAK ? 'set it to true in the Demo controls node'
                     : 'set it back to false in the Demo controls node, or the ' +
                       'main run fails in front of the judge');

  var keyish = /eyJ[A-Za-z0-9_-]{20,}|sb_secret_|service_role_key\s*[:=]\s*["'][^"']+/.test(wfRaw || '');
  check('A5', 'no key-shaped string in the committed workflow', !keyish,
        'a service-role key is in the file. Delete it, ROTATE THE KEY in ' +
        'Supabase, and put it back in the n8n credential store only.');
}

/* Staleness: the generated files must be newer than everything that
   generates them, or the threshold on the canvas is last night's. */
var sources = ['agent/decision.js', 'agent/steps.js', 'agent/run.js',
               'n8n/phases.js', 'n8n/workflow.template.js']
  .map(function (r) { return path.join(AGENTS, r); });
var newestSrc = Math.max.apply(null, sources.map(mtime));
var stale = [];
if (mtime(path.join(AGENTS, 'n8n', 'agent-code-node.js')) < newestSrc) { stale.push('agent-code-node.js'); }
if (mtime(wfPath) < newestSrc) { stale.push('workflow.json'); }
check('A6', 'the generated bundle and workflow are newer than their sources',
      stale.length === 0,
      'stale: ' + stale.join(', ') + '. Run: node 04-agents/tools/bundle.js && ' +
      'node 04-agents/tools/build-workflow.js  - then RE-IMPORT into n8n.');


/* =====================================================================
   B · THE NUMBERS AGREE
   ===================================================================== */
head('B · The numbers, in one place each');

var decision = read(path.join(AGENTS, 'agent', 'decision.js')) || '';
var floorC   = numberIn(decision, 'IMPACT_FLOOR_C');
var reranks  = numberIn(decision, 'MAX_RERANKS');
var minScore = numberIn(decision, 'MIN_ZONE_SCORE');

check('B1', 'decision.js defines the three workflow numbers',
      floorC !== null && reranks !== null && minScore !== null,
      'IMPACT_FLOOR_C / MAX_RERANKS / MIN_ZONE_SCORE must all be in agent/decision.js');

if (wfRaw && floorC !== null) {
  var inWf = new RegExp('IMPACT_FLOOR_C\\s*=\\s*' + String(floorC)).test(wfRaw);
  check('B2', 'the canvas carries the same impact floor (' + floorC.toFixed(1) + ' °C)', inWf,
        'the Code nodes are out of date. Rebuild (A6) and re-import.');
}

/* The step budget is deliberately in two places: the database wall and
   the plan-time fence. They must be the SAME number. */
var runSrc  = read(path.join(AGENTS, 'agent', 'run.js')) || '';
var budget  = numberIn(runSrc, 'STEP_BUDGET');
var rpcSrc  = read(path.join(SEC, '05_views_rpc.sql')) || '';
var sqlWall = (/v_calls\s*>=\s*(\d+)/.exec(rpcSrc) || [])[1];
check('B3', 'the step budget matches the database wall (' + budget + ')',
      budget !== null && sqlWall && Number(sqlWall) === budget,
      'run.js STEP_BUDGET=' + budget + ' but 05_views_rpc.sql refuses at ' + sqlWall);

/* The six legal step names, in three places. */
function names(src, re) {
  var m = re.exec(String(src || ''));
  return m ? m[1].split(',').map(function (s) { return s.trim().replace(/^'|'$/g, ''); }) : [];
}
var sqlNames = names(read(path.join(SEC, '01_tables_rls.sql')),
                     /step_name\s+in\s*\(([^)]+)\)/);
var stepsSrc = read(path.join(AGENTS, 'agent', 'steps.js')) || '';
var jsNames  = (stepsSrc.match(/key:\s*'([a-z_]+)'/g) || [])
  .map(function (s) { return s.replace(/key:\s*'|'/g, ''); });
check('B4', 'agent/steps.js and the database agree on the six step names',
      sqlNames.length === 6 && jsNames.length === 6 &&
      sqlNames.every(function (n, i) { return n === jsNames[i]; }),
      'SQL: ' + sqlNames.join(',') + '\n           JS : ' + jsNames.join(',') +
      '  - a seventh name, or a British spelling, is refused by the CHECK constraint');

/* ---------------------------------------------------------------------
   B5 and B6 are about js/ksat-workflow.js, the panel that SHIPS. Checks
   B1-B4 above are about 04-agents/agent/*.js, which is the engine the
   n8n canvas runs. The two are not the same numbers and must not be
   made the same - see B5. 04-agents/README.md has the full mapping.
   --------------------------------------------------------------------- */
var shipped = read(path.join(ROOT, 'js', 'ksat-workflow.js')) || '';

/* THE NUMBER SOMEBODY WILL "FIX" AND BREAK THE DEMO WITH.
   decision.js rejects a zone below IMPACT_FLOOR_C = 1.0 °C of cooling.
   The page cannot reach that: js/ksat-workflow.js:55-65 records that
   replaying the page's own predictImpact() across all six governorates
   gives a best case of -0.86 °C, so a 1.0 °C floor rejects every
   candidate and every run stalls. The shipped panel therefore states
   its floor in the unit the page actually computes - 4.0 percentage
   points of vegetation cover. Copying IMPACT_FLOOR_C into the panel to
   "make the numbers agree" is the failure this check exists to catch. */
check('B5', 'the shipped panel keeps its own floor, in percentage points',
      /UPLIFT_FLOOR_PP\s*=\s*[0-9.]+/.test(shipped) && !/IMPACT_FLOOR_C/.test(decomment(shipped)),
      'js/ksat-workflow.js must define UPLIFT_FLOOR_PP and must NOT use ' +
      'IMPACT_FLOOR_C. A 1.0 °C floor is arithmetically unreachable in this ' +
      'page: every zone is rejected and every run stalls.');

/* The two pairs js/ksat-workflow.js names in its own header as "must
   never drift apart". Both are a number written in two places on
   purpose: the browser refuses early so the researcher gets a sentence,
   and the database refuses regardless so the browser is not the wall. */
var shippedBudget = numberIn(shipped, 'STEP_BUDGET');
var shippedChars  = numberIn(shipped, 'MIN_REPORT_CHARS');
var viewsSrc      = read(path.join(SEC, '05_views_rpc.sql')) || '';
var sqlChars      = (/char_length\([^;]*p_body_md[^;]*?<\s*(\d+)/.exec(viewsSrc) || [])[1];
check('B6', 'the shipped panel agrees with the database on both walls',
      shippedBudget !== null && sqlWall && Number(sqlWall) === shippedBudget &&
      shippedChars !== null && sqlChars && Number(sqlChars) === shippedChars,
      'panel STEP_BUDGET=' + shippedBudget + ' vs SQL ' + sqlWall +
      ' · panel MIN_REPORT_CHARS=' + shippedChars + ' vs generate_report ' + sqlChars +
      '. A browser limit that is looser than the database one turns a clear ' +
      'sentence into a raw Postgres error in front of the judge.');


/* =====================================================================
   C · THE BROWSER
   ===================================================================== */
head('C · The app the judge actually looks at');

/* index.html is ~500 KB of prototype. Only the <script src=...> lines
   matter here, so read those rather than searching the whole file: the
   page discusses its own architecture in prose, and a plain indexOf on
   a filename matches a sentence about the file as readily as a tag. */
var indexHtml  = read(path.join(SITE, 'index.html')) || '';
var scriptSrcs = (indexHtml.match(/<script[^>]+src=["'][^"']+["']/gi) || [])
  .map(function (t) { return (/src=["']([^"']+)["']/i.exec(t) || [])[1] || ''; });

/* js/ksat-workflow.js IS the shipped automation section: it owns the
   Launch button, calls launch_mission(), writes every agent step through
   researcher_log_step(), and paints the human checkpoint. The other two
   names are panels that must NOT appear here - automation.js is the
   reference implementation in 04-agents/app/js/ (04-agents/README.md
   explains the split) and agent-panel.js was deleted on Sunday night. A
   second panel in the page means two answers to "what launches a run",
   and on Thursday nobody can say which one ran. */
var SHIPPED_PANEL = 'js/ksat-workflow.js';
var wired  = scriptSrcs.filter(function (s) { return s === SHIPPED_PANEL; });
var others = scriptSrcs.filter(function (s) {
  return /(^|\/)automation\.js$|(^|\/)agent-panel\.js$/.test(s);
});

if (wired.length === 1 && others.length === 0) {
  check('C1', 'index.html loads ' + SHIPPED_PANEL + ', and no second panel', true);
} else if (wired.length === 0) {
  check('C1', 'index.html loads ' + SHIPPED_PANEL + ', and no second panel', false,
        'no <script src="' + SHIPPED_PANEL + '"> in index.html. au-m1, au-m2 and ' +
        'au-m6 all fail here: the Launch button is whatever the prototype did ' +
        'before, not launch_mission().');
} else {
  check('C1', 'index.html loads ' + SHIPPED_PANEL + ', and no second panel', false,
        'referenced: ' + wired.concat(others).join(', ') + '. Ship one.');
}

/* THE DUPLICATES STAY DELETED. Three sessions wrote into this folder in
   parallel and left two extra panels, two extra n8n guides and a second
   copy of the worker logic. Each pair drifted - different stall
   timeouts, a table URL in one guide, an injection path that stopped the
   run in the other. If one comes back, the repo has two answers again
   and nobody can say which one Thursday runs. */
var revenants = [
  'app/automation.js', 'app/agent-panel.js',
  'n8n/README.md', 'worker/n8n/WORKFLOW.md', 'worker/agent-run.js',
  'db/REQUEST-TO-03-agent_claim_run.sql'
].filter(function (r) { return exists(path.join(AGENTS, r)); });
check('C1b', 'no deleted duplicate has come back', revenants.length === 0,
      'these are back: ' + revenants.join(', ') +
      '. The survivors are app/js/automation.js, n8n/BUILD-GUIDE.md, ' +
      'agent/run.js + n8n/phases.js, and 03-security/db/08_agent_claim.sql.');

var cfg = path.join(SITE, 'js', 'config.js');
if (exists(cfg)) {
  var cfgSrc = read(cfg) || '';
  /* Two separate facts, and the second one is the one that bites. The
     file can exist, define the client, and still leave window.sb unset -
     which is exactly the state every panel treats as "no database", so
     the page falls back to mock data and looks completely fine. */
  check('C2', 'js/config.js exists, creates the client and exposes window.sb',
        /createClient\s*\(/.test(cfgSrc) && /window\.sb\s*=/.test(cfgSrc),
        'the panel disables itself and says the database client has not loaded');
} else {
  check('C2', 'js/config.js exists, creates the client and exposes window.sb', false,
        'js/config.js is missing from the repo root. One file: ' +
        'createClient(url, publishableKey) -> window.sb. The PUBLISHABLE key ' +
        'only. The service-role key never reaches the browser.');
}

/* No URL that starts an agent may live in anything the browser downloads.
   Comment lines are skipped: this repo explains the rule in comments, and
   the rule is about URLs in code. */
var clientFiles = [];
[SITE, path.join(SITE, 'js'), REFERENCE, path.join(REFERENCE, 'js')]
  .forEach(function (dir) {
    var list = [];
    try { list = fs.readdirSync(dir); } catch (e) { return; }
    list.filter(function (f) { return /\.(js|html)$/.test(f); })
        .forEach(function (f) { clientFiles.push(path.join(dir, f)); });
  });

var leaks = [];
clientFiles.forEach(function (f) {
  decomment(read(f)).split('\n').forEach(function (l, i) {
    if (/https?:\/\/[^\s'"]*n8n[^\s'"]*/.test(l) || /['"][^'"]*\/webhook(-test)?\//.test(l)) {
      leaks.push(path.relative(ROOT, f) + ':' + (i + 1));
    }
  });
});
check('C3', 'no n8n or webhook URL in any file the browser downloads',
      leaks.length === 0,
      'D-1 violated at ' + leaks.join(', ') + '. That URL is in View Source, ' +
      'and behind it is a key that bypasses every RLS policy.');

/* D-2, on BOTH panels. The shipped one is the one that matters on
   Thursday; the reference one is the one somebody copies next week. */
var shippedSrc   = read(path.join(SITE, 'js', 'ksat-workflow.js')) || '';
var referenceSrc = read(path.join(REFERENCE, 'js', 'automation.js')) || '';
var htmlAssign = [];
if (/\.innerHTML\s*=/.test(decomment(shippedSrc)))   { htmlAssign.push('js/ksat-workflow.js'); }
if (/\.innerHTML\s*=/.test(decomment(referenceSrc))) { htmlAssign.push('04-agents/app/js/automation.js'); }
check('C4', 'neither panel ever assigns innerHTML', htmlAssign.length === 0,
      'D-2 violated in: ' + htmlAssign.join(', ') + '. Agent text is displayed ' +
      'with .textContent, never parsed as HTML - the objective is untrusted ' +
      'text that reaches another researcher\'s screen.');

/* Stall timings. The screen must not give up before the sweeper does,
   or a judge sees "Failed - no response" on a run the database still
   believes is healthy, and a contradicting status on the next refresh. */
/* 08_agent_claim.sql lives in 03-security/db/, not here. 04-agents/db/
   held the REQUEST for it; the answer was written, reviewed and kept by
   03, and the request file has been deleted so nobody pastes the older
   draft into the SQL editor. Reading the wrong path made this check
   print TODO for days, which reads exactly like "not important". */
var sweepMin = (/p_idle_minutes\s+int\s+default\s+(\d+)/
  .exec(read(path.join(SEC, '08_agent_claim.sql')) || '') || [])[1];
/* Both panels carry the number, so both can drift from the database.
   The shipped one is checked first because it is the one on the
   projector. */
var stallShipped   = numberIn(shippedSrc,   'STALL_MS');
var stallReference = numberIn(referenceSrc, 'STALL_MS');
if (sweepMin && stallShipped && stallReference) {
  var want = Number(sweepMin) * 60000;
  var drift = [];
  if (stallShipped   !== want) { drift.push('js/ksat-workflow.js=' + (stallShipped / 1000) + 's'); }
  if (stallReference !== want) { drift.push('04-agents/app/js/automation.js=' + (stallReference / 1000) + 's'); }
  check('C5', 'the screen and the sweeper give up at the same moment (' +
        (want / 1000) + 's)', drift.length === 0,
        drift.join(', ') + ' vs sweep_stalled_runs default ' + (want / 1000) +
        's. Pick ONE number and put it everywhere, or the screen says Failed ' +
        'while the row still says running.');
} else {
  todo('C5', 'could not read all three stall timings',
       'wanted p_idle_minutes in 03-security/db/08_agent_claim.sql and STALL_MS ' +
       'in both panels. Check by hand.');
}


/* =====================================================================
   D · THE TESTS
   ===================================================================== */
if (RUN_TESTS) {
  head('D · The test files (run verbatim)');
  ['decision.test.js', 'phases.test.js', 'automation-panel.test.js', 'injection.test.js']
    .forEach(function (t, i) {
      var p = path.join(AGENTS, 'tests', t);
      if (!exists(p)) { todo('D' + (i + 1), t + ' is missing', ''); return; }
      var r = cp.spawnSync(process.execPath, [p], { encoding: 'utf8' });
      var last = String(r.stdout || '').trim().split('\n').pop();
      check('D' + (i + 1), t + '  (' + (last || '').trim() + ')', r.status === 0,
            'run it on its own and read the failures: node 04-agents/tests/' + t);
    });
}


/* =====================================================================
   E · THE THINGS ONLY YOU CAN CHECK
       Printed every time. They are not PASS/FAIL because this script
       cannot see a database, an n8n tab, or your screen.
   ===================================================================== */
head('E · Tick these by hand - no script can see them');
[
  ['E1', 'Mariam has RUN 03-security/db/01 -> 06, then 08, 09, 10 and 11 against the real project. (07 is PHASE2: read, do not run.)',
         "select proname from pg_proc where proname in ('launch_mission','claim_next_run','agent_log_step','generate_report','monitor_record'); -- expect 5 rows once 11 is in"],
  ['E2', 'The n8n workflow is ACTIVE, not just saved. An inactive workflow does not poll, and nothing ever leaves "queued".',
         'n8n -> the workflow -> the Active toggle, top right, is ON. Then Executions shows a new row every 15 seconds.'],
  ['E3', 'The Supabase dashboard tab is CLOSED, and so is the n8n tab.',
         'au-m6 is "a user who never opens the backend sees the outcome". Close them before the judge arrives, not during.'],
  ['E4', 'You are signed in as the demo researcher, on the mission page, one tab.',
         'and the browser is zoomed so the six steps fit without scrolling'],
  ['E5', 'The demo missions are CREATED but NOT LAUNCHED, and you have a spare.',
         'one clean, one for the failure, one for the break test, one spare = 4. TWO hourly limits apply, both 5: missions CREATED (missions_guard) and runs LAUNCHED (launch_mission). Count both from your rehearsal.'],
  ['E6', 'A smoke-test run has completed end to end in the last hour, on a DIFFERENT mission from the demo one.',
         'THREE limits now apply, all in launch_mission(): 3 runs per MISSION per hour, 5 runs per RESEARCHER per hour, and a permanent freeze once a mission has an approved report. Rule 10b is code as of 21 Sep - 05_views_rpc.sql R-1a and R-1b - so a smoke test on the demo mission spends one of its three and can never be re-run after you approve its report.'],
  ['E7', 'You have run the R-1 rehearsal and filled in the table in GUARDRAILS.md section 4.',
         'until that table has real numbers in it, do NOT say the au-m4 sentence "one rule I changed because a rehearsal broke it"']
].forEach(function (r) {
  console.log('  [ ]  ' + r[0] + '  ' + r[1]);
  console.log('        -> ' + r[2]);
});


/* ===================================================================== */
console.log('\n-----------------------------------------------------');
console.log(' ' + results.pass + ' passed   ' + results.fail + ' FAILED   ' +
            results.todo + ' not done yet   (+7 by hand)');
if (results.fail) {
  console.log(' Fix the FAILs before the slot. A FAIL is something that was');
  console.log(' true once and is not true now - that is the kind that bites.');
} else {
  console.log(' Nothing this script can see is broken. It cannot see the');
  console.log(' database, n8n, or whether the workflow is active. Section E.');
}
console.log('-----------------------------------------------------\n');
process.exit(results.fail ? 1 : 0);
