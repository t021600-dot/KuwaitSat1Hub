/* =====================================================================
   KuwaitSat-1 Mission Hub · 04 · Automation and agents
   THE AUTOMATION SECTION — this file is au-m2 and au-m6.

   Owner: Dana (04). Drop-in: 01 · Front end adds ONE <div> and ONE
   <script> line. See app/INTEGRATION.md. This file touches nothing else,
   defines exactly one global (Automation), and writes no CSS of its own
   beyond the classes 01 already ships.

   What it does, in order:
     start   the Launch button calls the Postgres function launch_mission()
             — never an n8n URL. There is no webhook address in this file,
             and there must never be one (DECISIONS.md D-1).
     status  polls the my_agent_steps view every 2 s (D-6: polled, not
             Realtime) and shows the six steps ticking, including refusals.
     result  reads the finished results back out of the database and puts
             them on the page. A researcher who never opens n8n or the
             Supabase dashboard sees the whole outcome here.

   Everything on screen is written with textContent. Nothing that came
   out of the database is ever assigned to innerHTML (D-2).
   ===================================================================== */

var Automation = (function () {
  'use strict';

  var POLL_MS = 2000;
  var STALL_MS = 180000;   // 3 minutes with no new step = say so, don't spin

  var STEP_LABELS = [
    ['satellite_data',        'Satellite data',         'Finds the scenes over your area'],
    ['environmental_analysis','Environmental analysis', 'Measures NDVI and temperature'],
    ['recommendation',        'Recommendation',         'THE DECISION: enough evidence?'],
    ['impact_prediction',     'Impact prediction',      'Projects the effect of acting'],
    ['visualization',         'Visualization',          'Draws the zones on the map'],
    ['reporting',             'Reporting',              'Writes the draft for you to approve']
  ];

  /* ---------- tiny DOM helpers · no innerHTML anywhere ---------- */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = String(text);
    return n;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function mount(opts) {
    var host = opts.el;
    var missionId = opts.missionId;
    var sb = opts.client || window.sb;
    var onResults = opts.onResults || function () {};

    var runId = null;
    var timer = null;
    var lastStepAt = 0;
    var stepCount = 0;

    /* ---------- the shell: start · status · result ---------- */
    host.setAttribute('aria-labelledby', 'automation-h');

    var head = el('div', 'pipeline-head');
    var h2 = el('h2', null, 'Automation');
    h2.id = 'automation-h';
    h2.style.margin = '0';
    var counter = el('span', 'small muted', '');
    head.appendChild(h2); head.appendChild(counter);

    var lede = el('p', 'small muted',
      'Six research assistants read the area you drew and propose where work would ' +
      'help most. They never command the satellite, and nothing is published until ' +
      'you approve it.');

    var startRow = el('div', 'btn-row');
    var launchBtn = el('button', 'btn btn-primary', 'Launch Mission');
    launchBtn.type = 'button';
    var startNote = el('span', 'small muted', 'You decide when the assistants start.');
    startRow.appendChild(launchBtn); startRow.appendChild(startNote);

    var statusLine = el('p', 'small', 'Not started.');
    statusLine.setAttribute('role', 'status');
    statusLine.setAttribute('aria-live', 'polite');

    var stepList = el('ol', 'timeline');
    var resultBox = el('div', null);

    host.appendChild(head);
    host.appendChild(lede);
    host.appendChild(startRow);
    host.appendChild(statusLine);
    host.appendChild(stepList);
    host.appendChild(resultBox);

    if (!sb || typeof sb.rpc !== 'function') {
      setStatus('The database client has not loaded, so the automation cannot start. ' +
                'Check that js/config.js is included before this file.', 'bad');
      launchBtn.disabled = true;
      return api();
    }

    /* ---------- painting ---------- */

    function setStatus(text, tone) {
      statusLine.textContent = text;
      statusLine.className = 'small' + (tone === 'bad' ? ' bad' : (tone === 'good' ? ' good' : ' muted'));
    }

    function paintSteps(rows, runStatus) {
      var byName = {};
      rows.forEach(function (r) { byName[r.step_name] = r; });

      var nextExpected = null;
      for (var i = 0; i < STEP_LABELS.length; i++) {
        if (!byName[STEP_LABELS[i][0]]) { nextExpected = STEP_LABELS[i][0]; break; }
      }
      var live = (runStatus === 'queued' || runStatus === 'running');

      clear(stepList);
      STEP_LABELS.forEach(function (s, idx) {
        var row = byName[s[0]];
        var state = row ? (row.allowed === false ? 'refused' : 'complete')
                        : (live && s[0] === nextExpected ? 'running' : 'queued');

        var li = el('li', 'agent ' + state);
        li.appendChild(el('span', 'node',
          state === 'complete' ? '✓' : (state === 'refused' ? '✗' : String(idx + 1))));

        var body = el('span', 'body');
        body.appendChild(el('span', 'nm', s[1]));
        body.appendChild(el('span', 'st',
          state === 'complete' ? 'Complete'
          : state === 'refused' ? 'Refused'
          : state === 'running' ? 'Running…' : 'Waiting'));
        body.appendChild(el('span', 'sm',
          state === 'refused' ? (row.refused_reason || 'Refused.') : s[2]));
        if (row && row.injection_flag) {
          body.appendChild(el('span', 'chip chip-high', 'Objective flagged'));
        }
        li.appendChild(body);
        li.setAttribute('aria-label', s[1] + ', ' + state);
        stepList.appendChild(li);
      });

      var done = rows.length;
      counter.textContent = done + ' of ' + STEP_LABELS.length + ' steps written';
    }

    function paintResults(rows) {
      clear(resultBox);
      if (!rows || !rows.length) return;

      var h3 = el('h3', null, 'Result');
      h3.style.marginBottom = '6px';
      resultBox.appendChild(h3);

      rows.forEach(function (r) {
        var card = el('div', 'card');
        card.appendChild(el('h4', null, r.title));
        if (r.kind === 'narrative' || r.kind === 'metric' || r.kind === 'site') {
          var pre = el('p', 'small', r.body || '');
          pre.style.whiteSpace = 'pre-wrap';   // plain text, never markdown (D-2)
          card.appendChild(pre);
        } else {
          card.appendChild(el('p', 'small muted', r.body || ''));
        }
        resultBox.appendChild(card);
      });

      var geo = rows.filter(function (r) { return r.geometry; })
                    .map(function (r) { return r.geometry; });
      try { onResults(rows, geo); } catch (e) { /* the map is optional; the text is not */ }
    }

    /* ---------- reading ---------- */

    function loadResults() {
      // The my_mission_results VIEW truncates body to 240 characters, which
      // would cut the provenance lines off the finding. The grant on the
      // results TABLE already allows these columns by name, and the status
      // gate in the policy still applies, so we name them.
      return sb.from('results')
        .select('id,kind,title,body,geometry,created_at')
        .eq('mission_id', missionId)
        .order('created_at', { ascending: true })
        .then(function (res) {
          if (res.error) throw res.error;
          paintResults(res.data || []);
          return res.data || [];
        });
    }

    function tick() {
      return Promise.all([
        sb.from('mission_runs')
          .select('id,status,started_at,finished_at,tool_calls')
          .eq('id', runId).maybeSingle(),
        sb.from('my_agent_steps')
          .select('id,run_id,step_name,status,allowed,refused_reason,injection_flag,started_at,finished_at')
          .eq('run_id', runId)
          .order('started_at', { ascending: true })
      ]).then(function (out) {
        var run = out[0].data;
        var steps = (out[1].data) || [];
        if (out[0].error) throw out[0].error;
        if (out[1].error) throw out[1].error;
        if (!run) { stop(); setStatus('That run is not visible to this account.', 'bad'); return; }

        if (steps.length !== stepCount) { stepCount = steps.length; lastStepAt = Date.now(); }
        paintSteps(steps, run.status);

        if (run.status === 'complete') {
          stop();
          setStatus('Done. The assistants finished and are waiting for your review.', 'good');
          launchBtn.disabled = true;
          launchBtn.textContent = 'Mission run complete';
          loadResults();
          return;
        }
        if (run.status === 'stalled') {
          stop();
          var refused = steps.filter(function (s) { return s.allowed === false; })[0];
          setStatus('Stopped. ' + (refused && refused.refused_reason
            ? refused.refused_reason
            : 'The workflow stopped before it could recommend anything.'), 'bad');
          launchBtn.disabled = false;
          launchBtn.textContent = 'Launch Mission';
          loadResults();
          return;
        }
        if (run.status === 'failed') {
          stop();
          setStatus('Failed. The run ended without finishing. Nothing was published.', 'bad');
          launchBtn.disabled = false;
          launchBtn.textContent = 'Launch Mission';
          loadResults();
          return;
        }

        // still queued or running
        if (Date.now() - lastStepAt > STALL_MS) {
          stop();
          setStatus('Failed — the run stopped responding after 3 minutes ' +
                    '(run ' + String(runId).slice(0, 8) + '). Nothing was published. ' +
                    'You can launch it again.', 'bad');
          launchBtn.disabled = false;
          launchBtn.textContent = 'Launch Mission';
          return;
        }
        setStatus(run.status === 'queued'
          ? 'Queued — waiting for a worker to pick this run up…'
          : 'Running — ' + steps.length + ' of 6 steps written, ' +
            run.tool_calls + ' tool calls used of 40 allowed…');
      }).catch(function (err) {
        stop();
        setStatus('Could not read the run: ' + (err && err.message ? err.message : 'unknown error'), 'bad');
      });
    }

    function start() {
      if (timer) return;
      lastStepAt = Date.now();
      tick();
      timer = setInterval(tick, POLL_MS);
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }

    /* ---------- the button ---------- */

    launchBtn.addEventListener('click', function () {
      launchBtn.disabled = true;
      launchBtn.textContent = 'Launching…';
      setStatus('Queueing the run…');

      // THE TRIGGER. A Postgres function, called by our own page, as the
      // signed-in researcher. No webhook, no key, no third-party URL.
      sb.rpc('launch_mission', { p_mission_id: missionId }).then(function (res) {
        if (res.error) throw res.error;
        runId = res.data;
        launchBtn.textContent = 'Running…';
        start();
      }).catch(function (err) {
        launchBtn.disabled = false;
        launchBtn.textContent = 'Launch Mission';
        // The database refusals are already written as sentences a
        // researcher can read ("This mission is already running.").
        setStatus(err && err.message ? err.message : 'The run could not be started.', 'bad');
      });
    });

    /* ---------- on load: pick up a run that is already going ---------- */

    sb.from('mission_runs')
      .select('id,status,started_at,finished_at,tool_calls')
      .eq('mission_id', missionId)
      .order('started_at', { ascending: false })
      .limit(1)
      .then(function (res) {
        if (res.error) throw res.error;
        var run = (res.data || [])[0];
        if (!run) { setStatus('Not started. Press Launch Mission when you are ready.'); return; }
        runId = run.id;
        if (run.status === 'queued' || run.status === 'running') {
          launchBtn.disabled = true;
          launchBtn.textContent = 'Running…';
          start();
        } else {
          tick();
        }
      }).catch(function (err) {
        setStatus('Could not check for an existing run: ' +
                  (err && err.message ? err.message : 'unknown error'), 'bad');
      });

    function api() {
      return { refresh: function () { return tick(); }, stop: stop, runId: function () { return runId; } };
    }
    return api();
  }

  return { mount: mount, STEP_LABELS: STEP_LABELS };
})();
