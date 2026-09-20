/* =====================================================================
   PROOF THAT THE AUTOMATION PANEL DOES WHAT WE SAY IT DOES.
   Owner: 04 · Automation and agents (Dana)

   Run it:   node 04-agents/tests/automation-panel.test.js
   No install, no framework, no network, no browser. Node only.

   app/js/automation.js is browser code, so this file builds the two
   things a browser would give it and nothing else:

     1. a nine-method fake DOM (createElement, appendChild, textContent,
        addEventListener ... ) so the panel can draw itself into memory
     2. a fake Supabase client whose rpc() and from() return canned rows

   Then it drives a whole mission through the panel and reads the text
   back off the page. Nothing here mocks the panel's own logic — the file
   under test is loaded verbatim.

   These are the checks to re-run after ANY edit to the panel, and they
   are what to run in front of a teammate who asks "does the failure path
   really work". They cover: the launch RPC (au-m1), the six-step strip
   (au-m2), the re-rank being visible (au-m3), the refusal and injection
   chip, the visible failure and the stall timeout (SHOULD 9), the human
   checkpoint (SHOULD 8), the database-error translation, and the refusal
   to fake a run when the database client is missing.
   ===================================================================== */

var fs = require("fs");
var path = require("path");


function El(tag) {
  this.tagName = tag;
  this.children = [];
  this.style = {};
  this.attrs = {};
  this._text = '';
  this._listeners = {};
  this.hidden = false;
  this.className = '';
}
Object.defineProperty(El.prototype, 'firstChild', {
  get: function () { return this.children.length ? this.children[0] : null; }
});
Object.defineProperty(El.prototype, 'textContent', {
  get: function () {
    return this._text + this.children.map(function (c) { return c.textContent; }).join('');
  },
  set: function (v) { this.children = []; this._text = String(v); }
});
El.prototype.appendChild = function (c) { this.children.push(c); return c; };
El.prototype.removeChild = function (c) {
  var i = this.children.indexOf(c);
  if (i >= 0) this.children.splice(i, 1);
  return c;
};
El.prototype.setAttribute = function (k, v) { this.attrs[k] = v; };
El.prototype.getAttribute = function (k) { return this.attrs[k]; };
El.prototype.addEventListener = function (k, fn) {
  (this._listeners[k] = this._listeners[k] || []).push(fn);
};
El.prototype.click = function () {
  (this._listeners.click || []).forEach(function (f) { f(); });
};
El.prototype.find = function (pred) {
  if (pred(this)) return this;
  for (var i = 0; i < this.children.length; i++) {
    var hit = this.children[i].find && this.children[i].find(pred);
    if (hit) return hit;
  }
  return null;
};
El.prototype.findAll = function (pred, acc) {
  acc = acc || [];
  if (pred(this)) acc.push(this);
  for (var i = 0; i < this.children.length; i++) {
    if (this.children[i].findAll) this.children[i].findAll(pred, acc);
  }
  return acc;
};

global.document = {
  createElement: function (t) { return new El(t); },
  createTextNode: function (s) { var n = new El('#text'); n._text = String(s); return n; }
};
global.window = {};

/* capture the poll callback instead of really waiting 2 seconds */
var polls = [];
global.setInterval = function (fn) { polls.push(fn); return polls.length; };
global.clearInterval = function (h) { polls = []; };

/* ---- fake supabase ---- */
function makeDb() {
  return { runs: [], steps: [], results: [], reports: [], rpcCalls: [] };
}
function makeClient(db, behaviour) {
  behaviour = behaviour || {};
  var TABLE = { mission_runs: 'runs', my_agent_steps: 'steps', results: 'results', reports: 'reports' };
  function table(rawName) {
    var name = TABLE[rawName] || rawName;
    var filters = [];
    var b = {
      select: function () { return b; },
      eq: function (col, val) { filters.push([col, val]); return b; },
      order: function () { return b; },
      limit: function (n) { b._limit = n; return b; },
      maybeSingle: function () { b._single = true; return b; },
      then: function (ok, bad) {
        var rows = (db[name] || []).filter(function (r) {
          return filters.every(function (f) { return r[f[0]] === f[1]; });
        });
        if (b._limit) rows = rows.slice(0, b._limit);
        var payload = b._single
          ? { data: rows[0] || null, error: null }
          : { data: rows, error: null };
        if (behaviour.readError && behaviour.readError[rawName]) {
          payload = { data: null, error: behaviour.readError[rawName] };
        }
        return Promise.resolve(payload).then(ok, bad);
      }
    };
    return b;
  }
  return {
    from: table,
    rpc: function (fn, args) {
      db.rpcCalls.push({ fn: fn, args: args });
      if (behaviour.rpcError && behaviour.rpcError[fn]) {
        return Promise.resolve({ data: null, error: behaviour.rpcError[fn] });
      }
      if (fn === 'launch_mission') {
        db.runs.push({ id: 'run-1', mission_id: args.p_mission_id, status: 'queued', tool_calls: 0, started_at: '2026-09-20T20:00:00Z' });
        return Promise.resolve({ data: 'run-1', error: null });
      }
      if (fn === 'generate_report') {
        db.reports.push({ id: 'rep-1', mission_id: args.p_mission_id, approved_at: '2026-09-20T20:10:00Z' });
        return Promise.resolve({ data: 'rep-1', error: null });
      }
      return Promise.resolve({ data: null, error: { message: 'Unknown run.' } });
    }
  };
}

var src = fs.readFileSync(path.join(__dirname, "..", "app", "js", "automation.js"), "utf8");
eval(src);

var pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  <<< ' + extra : '')); }
}
function text(host) { return host.textContent; }
function btn(host, label) {
  return host.find(function (n) { return n.tagName === 'button' && n.textContent.indexOf(label) === 0; });
}
function wait() { return new Promise(function (r) { setImmediate(function () { setImmediate(r); }); }); }

function newHost() { return new El('section'); }

(function tests() {
  var db, sb, host, api;

  /* ---------- 1 · fresh mission, nothing started ---------- */
  db = makeDb(); sb = makeClient(db); host = newHost();
  api = Automation.mount({ el: host, missionId: 'm1', client: sb });

  wait().then(function () {
    console.log('\n1 · Fresh mission');
    ok('shows the Automation heading', text(host).indexOf('Automation') >= 0);
    ok('shows a Launch Mission button', !!btn(host, 'Launch Mission'));
    ok('says Not started', text(host).indexOf('Not started') >= 0);
    ok('draws all six steps', Automation.STEPS.every(function (s) {
      return text(host).indexOf(s[1]) >= 0;
    }));
    ok('names the decision point on screen', text(host).indexOf('THE DECISION POINT') >= 0);

    /* ---------- 2 · launch calls the RPC, never a webhook ---------- */
    btn(host, 'Launch Mission').click();
    return wait();
  }).then(function () {
    console.log('\n2 · Launch');
    ok('called launch_mission', db.rpcCalls[0] && db.rpcCalls[0].fn === 'launch_mission');
    ok('passed p_mission_id', db.rpcCalls[0].args.p_mission_id === 'm1');
    ok('started polling', polls.length === 1);
    ok('shows queued', text(host).indexOf('Queued') >= 0);

    /* ---------- 3 · steps tick in ---------- */
    db.runs[0].status = 'running';
    db.runs[0].tool_calls = 2;
    db.steps.push({ id: 's1', run_id: 'run-1', step_name: 'satellite_data', status: 'complete', allowed: true, started_at: '1' });
    db.steps.push({ id: 's2', run_id: 'run-1', step_name: 'environmental_analysis', status: 'complete', allowed: true, started_at: '2' });
    return polls[0]();
  }).then(function () {
    console.log('\n3 · Steps ticking');
    ok('counts 2 of 6 complete', text(host).indexOf('2 of 6 steps complete') >= 0);
    ok('shows the tool-call budget', text(host).indexOf('2 of 40 tool calls used') >= 0);
    ok('third step shows Running', text(host).indexOf('Running…') >= 0);

    /* ---------- 4 · the decision point ran twice ---------- */
    db.steps.push({ id: 's3', run_id: 'run-1', step_name: 'recommendation', status: 'complete', allowed: true, started_at: '3' });
    db.steps.push({ id: 's4', run_id: 'run-1', step_name: 'impact_prediction', status: 'complete', allowed: true, started_at: '4' });
    db.steps.push({ id: 's5', run_id: 'run-1', step_name: 'recommendation', status: 'complete', allowed: true, started_at: '5' });
    return polls[0]();
  }).then(function () {
    console.log('\n4 · Re-rank is visible');
    ok('says the step ran twice', text(host).indexOf('ran 2 times') >= 0);
    ok('explains why it ranked again', text(host).indexOf('impact gate rejected') >= 0);

    /* ---------- 5 · refusal is readable ---------- */
    db.steps.push({ id: 's6', run_id: 'run-1', step_name: 'visualization', status: 'refused',
                    allowed: false, refused_reason: 'Area outside Kuwait.', injection_flag: true, started_at: '6' });
    return polls[0]();
  }).then(function () {
    console.log('\n5 · Refusal + injection flag');
    ok('prints the refusal reason', text(host).indexOf('Area outside Kuwait.') >= 0);
    ok('shows the injection chip', text(host).indexOf('Objective flagged for review') >= 0);

    /* ---------- 6 · failure is visible ---------- */
    db.runs[0].status = 'failed';
    return polls[0]();
  }).then(function () {
    console.log('\n6 · Failure');
    ok('uses the word Failed', text(host).indexOf('Failed') >= 0);
    ok('gives a reason', text(host).indexOf('Area outside Kuwait.') >= 0);
    ok('says nothing was published', text(host).indexOf('Nothing was published') >= 0);
    ok('stopped polling', polls.length === 0);
    ok('re-enables the button', btn(host, 'Launch Mission') && !btn(host, 'Launch Mission').disabled);

    /* ---------- 7 · human checkpoint ---------- */
    db = makeDb(); sb = makeClient(db); host = newHost();
    db.runs.push({ id: 'run-9', mission_id: 'm9', status: 'complete', tool_calls: 8, started_at: 'x' });
    Automation.STEPS.forEach(function (s, i) {
      db.steps.push({ id: 'k' + i, run_id: 'run-9', step_name: s[0], status: 'complete', allowed: true, started_at: String(i) });
    });
    db.results.push({ id: 'r1', mission_id: 'm9', kind: 'narrative', title: 'Draft report',
      body: 'Zone B ranks 81/100 and projects 1.9 C of cooling over 24 months. MEASURED: NDVI 0.12 from scene KS1-0042.',
      status: 'complete', created_at: '2026-09-20T20:05:00Z' });
    api = Automation.mount({ el: host, missionId: 'm9', client: sb });
    return wait().then(wait).then(wait);
  }).then(function () {
    console.log('\n7 · Human checkpoint');
    ok('asks for approval', text(host).indexOf('Your approval is needed') >= 0);
    ok('visibly waits', text(host).indexOf('Waiting for you') >= 0);
    ok('shows the proposed draft', text(host).indexOf('Zone B ranks 81/100') >= 0);
    ok('has not published yet', db.reports.length === 0);
    var approve = btn(host, 'Approve and generate report');
    ok('offers an Approve button', !!approve);
    approve.click();
    return wait();
  }).then(function () {
    ok('approval called generate_report', db.rpcCalls.some(function (c) { return c.fn === 'generate_report'; }));
    var call = db.rpcCalls.filter(function (c) { return c.fn === 'generate_report'; })[0];
    ok('sent the draft body', call.args.p_body_md.indexOf('Zone B ranks 81/100') >= 0);
    ok('shows approved state', text(host).indexOf('Approved') >= 0);

    /* ---------- 8 · error mapping, no raw postgres ---------- */
    db = makeDb(); host = newHost();
    sb = makeClient(db, { rpcError: { launch_mission: { message: 'permission denied for column raw_prompt', code: '42501' } } });
    api = Automation.mount({ el: host, missionId: 'm2', client: sb });
    return wait().then(function () { btn(host, 'Launch Mission').click(); return wait(); });
  }).then(function () {
    console.log('\n8 · Error mapping');
    ok('hides the raw postgres text', text(host).indexOf('raw_prompt') === -1, text(host).slice(0, 200));
    ok('shows a human sentence', text(host).indexOf('not allowed to do that') >= 0);

    db = makeDb(); host = newHost();
    sb = makeClient(db, { rpcError: { launch_mission: { message: 'This mission is already running.' } } });
    Automation.mount({ el: host, missionId: 'm3', client: sb });
    return wait().then(function () { btn(host, 'Launch Mission').click(); return wait(); });
  }).then(function () {
    ok('maps "already running" to guidance', text(host).indexOf('no need to launch it twice') >= 0);

    /* ---------- 9 · stall timeout ---------- */
    db = makeDb(); host = newHost(); sb = makeClient(db);
    db.runs.push({ id: 'run-s', mission_id: 'm4', status: 'running', tool_calls: 1, started_at: 'x' });
    db.steps.push({ id: 'z', run_id: 'run-s', step_name: 'satellite_data', status: 'complete', allowed: true, started_at: '1' });
    api = Automation.mount({ el: host, missionId: 'm4', client: sb });
    return wait().then(wait).then(function () {
      var realNow = Date.now;
      /* Jump past STALL_MS, whatever it is set to. Reading the number
         off the panel instead of typing it here means the stall timeout
         can be re-agreed with the database sweeper (it moved from 120s
         to 180s to match sweep_stalled_runs) without this test failing
         for a reason that has nothing to do with the behaviour. */
      Date.now = function () { return realNow() + Automation.limits.stallMs + 20000; };
      return api.refresh().then(function () { Date.now = realNow; });
    });
  }).then(function () {
    console.log('\n9 · Stall timeout');
    ok('says failed, not spinning', text(host).indexOf('Failed — no response') >= 0);
    ok('names the timeout in seconds',
       text(host).indexOf(Math.round(Automation.limits.stallMs / 1000) + ' seconds') >= 0);
    ok('stopped polling', polls.length === 0);

    /* ---------- 10 · no client at all ---------- */
    host = newHost();
    Automation.mount({ el: host, missionId: 'm5', client: null });
    return wait();
  }).then(function () {
    console.log('\n10 · No database client');
    ok('says so plainly', text(host).indexOf('database client has not loaded') >= 0);
    ok('disables launch', btn(host, 'Launch Mission').disabled === true);
    ok('does not fake a run', text(host).indexOf('Complete') === -1);

    console.log('\n' + pass + ' passed, ' + fail + ' failed');
    process.exit(fail ? 1 : 0);
  })['catch'](function (e) { console.error('HARNESS ERROR', e); process.exit(2); });
})();
