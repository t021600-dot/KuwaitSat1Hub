/* =====================================================================
   THE AUTOMATION SECTION  ·  capstone items au-m1, au-m2, au-m6
   Owner: 04 · Automation and agents (Dana)

   One panel. Start, status, result, and the decision - in that order,
   in the first screenful of mission.html. See ../docs/AU-M3-PROCESS.md
   section 5 for why it sits there and the three lines Retag adds.

   au-m1  The button calls launch_mission() in Postgres. There is no
          webhook URL in this file, because there is no webhook URL in
          any file the browser downloads (DECISIONS.md D-1). Close n8n
          and press the button: a queued mission_runs row still appears.
   au-m2  Start, status and result are one panel, not three screens.
   au-m6  Everything on screen comes from my_agent_steps and
          my_mission_results. Nobody has to open n8n or Supabase.

   Polling, not Realtime (DECISIONS.md D-6): a Realtime payload is built
   from the write-ahead log and can carry raw_prompt and confidence,
   which we deliberately never granted.

   Agent-written text - a refusal reason, a step name - is put on screen
   with textContent, never innerHTML. Same rule as the report (D-2).
   ===================================================================== */

(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  if (root) { root.AgentPanel = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {

  var POLL_MS = 2000;          /* D-6: every 2 seconds */
  var STEP_ORDER = ['satellite_data', 'environmental_analysis', 'recommendation',
                    'impact_prediction', 'visualization', 'reporting'];
  var STEP_LABEL = {
    satellite_data: 'Satellite data',
    environmental_analysis: 'Environmental analysis',
    recommendation: 'Recommendation',
    impact_prediction: 'Impact prediction',
    visualization: 'Visualization',
    reporting: 'Reporting'
  };
  var RUN_LABEL = {
    idle: 'Not started', queued: 'Queued', running: 'Running',
    complete: 'Complete', failed: 'Failed', stalled: 'Stopped'
  };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text !== undefined && text !== null) { n.textContent = String(text); }
    return n;
  }

  /* ==================================================================
     THE PANEL
     ================================================================== */

  function mount(opts) {
    var host = opts.el;
    var missionId = opts.missionId;
    var source = opts.source;
    var onChange = opts.onChange || function () {};

    var timer = null;
    var lastStatus = null;

    host.innerHTML = '';
    host.className = 'card section';
    host.id = 'automation';

    var head = el('div', 'pipeline-head');
    head.appendChild(el('h2', null, 'Automation'));
    var statusChip = el('span', 'chip', RUN_LABEL.idle);
    head.appendChild(statusChip);
    host.appendChild(head);

    host.appendChild(el('p', 'small muted',
      'Six research assistants run in order. One of them can send the work back. ' +
      'Nothing is published until you approve it.'));

    var btnRow = el('div', 'btn-row');
    var btn = el('button', 'btn btn-primary', 'Launch Mission');
    btn.type = 'button';
    var btnNote = el('span', 'small muted', 'You decide when the agents start.');
    btnRow.appendChild(btn);
    btnRow.appendChild(btnNote);
    host.appendChild(btnRow);

    var list = el('ol', 'timeline');
    list.setAttribute('aria-live', 'polite');
    host.appendChild(list);

    var resultLine = el('p', 'small');
    host.appendChild(resultLine);

    /* ---------------- render ---------------- */

    function renderSteps(state) {
      list.innerHTML = '';
      var steps = state.steps || [];
      var live = state.run && (state.run.status === 'queued' || state.run.status === 'running');
      var nextPending = true;   /* the first step with no completed row is the running one */

      STEP_ORDER.forEach(function (key) {
        var rows = steps.filter(function (s) { return s.step_name === key; });
        var allowed = rows.filter(function (s) { return s.allowed !== false; });
        var refusals = rows.filter(function (s) { return s.allowed === false; });

        var status;
        if (allowed.length) {
          status = 'complete';
        } else if (live && nextPending) {
          status = 'running';
          nextPending = false;
        } else {
          status = 'queued';
        }

        var li = el('li', 'agent ' + status);
        var node = el('span', 'node', status === 'complete' ? '✓' : String(STEP_ORDER.indexOf(key) + 1));
        node.setAttribute('aria-hidden', 'true');
        li.appendChild(node);

        var body = el('span', 'body');
        var nameLine = el('span', 'nm', STEP_LABEL[key]);
        if (allowed.length > 1) {
          nameLine.textContent = STEP_LABEL[key] + ' · ran ' + allowed.length + ' times';
        }
        body.appendChild(nameLine);
        body.appendChild(el('span', 'st',
          status === 'complete' ? 'Complete' : status === 'running' ? 'Running…' : 'Queued'));

        /* THE DECISION, ON SCREEN. A refused step is not an error to
           hide - it is the evidence that the agent was told no, and the
           only place the researcher can read the reason, because
           mission_runs.error_note is not granted to the browser. */
        refusals.forEach(function (r) {
          var d = el('span', 'sm');
          d.appendChild(el('strong', null, 'Decision: '));
          d.appendChild(document.createTextNode(r.refused_reason || 'Refused.'));
          body.appendChild(d);
        });

        li.appendChild(body);
        list.appendChild(li);
      });
    }

    function renderResult(state) {
      var run = state.run;
      resultLine.className = 'small';
      if (!run) { resultLine.textContent = ''; return; }

      if (run.status === 'complete') {
        resultLine.textContent = state.resultCount + ' finding(s) on the map below. ' +
          'Review them, then press Generate Report.';
      } else if (run.status === 'stalled' || run.status === 'failed') {
        /* SHOULD item 9: the word, and a reason. Never a spinner that
           runs forever. The reason is the refused step's text. */
        var last = (state.steps || []).filter(function (s) { return s.allowed === false; }).pop();
        resultLine.className = 'small';
        resultLine.textContent = (run.status === 'failed' ? 'Failed. ' : 'Stopped. ') +
          (last && last.refused_reason ? last.refused_reason
            : 'The run did not finish. Nothing was written to the map.');
      } else {
        resultLine.textContent = '';
      }
    }

    function render(state) {
      var status = state.run ? state.run.status : 'idle';
      statusChip.textContent = RUN_LABEL[status] || status;
      statusChip.className = 'chip chip-' + (status === 'complete' ? 'high'
                          : status === 'stalled' || status === 'failed' ? 'low' : 'medium');

      btn.disabled = (status === 'queued' || status === 'running');
      if (status === 'idle') {
        btn.textContent = 'Launch Mission';
        btnNote.textContent = 'You decide when the agents start.';
      } else if (status === 'queued' || status === 'running') {
        btn.textContent = 'Running…';
        btnNote.textContent = 'Watching the run. This screen updates every 2 seconds.';
      } else {
        btn.textContent = 'Launch Mission';
        btn.disabled = true;
        btnNote.textContent = 'This mission has already been run.';
      }

      renderSteps(state);
      renderResult(state);

      if (status !== lastStatus) { lastStatus = status; onChange(state); }
      if (status === 'complete' || status === 'failed' || status === 'stalled') { stop(); }
    }

    /* ---------------- poll ---------------- */

    function tick() {
      return source.state(missionId).then(render).catch(function (err) {
        resultLine.textContent = 'Could not read the run: ' + err.message;
      });
    }

    function start() { if (!timer) { timer = setInterval(tick, POLL_MS); } }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }

    btn.addEventListener('click', function () {
      btn.disabled = true;
      btn.textContent = 'Launching…';
      source.launch(missionId).then(function () {
        return tick();
      }).then(start).catch(function (err) {
        btn.disabled = false;
        btn.textContent = 'Launch Mission';
        btnNote.textContent = err.message;
      });
    });

    tick().then(function () {
      if (lastStatus === 'queued' || lastStatus === 'running') { start(); }
    });

    return { refresh: tick, stop: stop };
  }

  /* ==================================================================
     SOURCE A · SUPABASE. The real one.
     ================================================================== */

  function supabaseSource(sb) {
    return {
      /* au-m1 in one line. Not a webhook. A database function that
         re-reads auth.uid() and refuses a mission you do not own. */
      launch: function (missionId) {
        return sb.rpc('launch_mission', { p_mission_id: missionId })
          .then(function (res) {
            if (res.error) { throw new Error(res.error.message); }
            return res.data;
          });
      },

      state: function (missionId) {
        /* Column list, never select('*'): the browser is granted
           (id, mission_id, status, started_at, finished_at, tool_calls)
           on mission_runs and nothing else. */
        return sb.from('mission_runs')
          .select('id,status,started_at,finished_at,tool_calls')
          .eq('mission_id', missionId)
          .order('started_at', { ascending: false })
          .limit(1)
          .then(function (res) {
            if (res.error) { throw new Error(res.error.message); }
            var run = (res.data && res.data[0]) || null;
            if (!run) { return { run: null, steps: [], resultCount: 0 }; }

            return Promise.all([
              sb.from('my_agent_steps').select('*').eq('run_id', run.id).order('started_at'),
              sb.from('my_mission_results').select('id').eq('mission_id', missionId)
            ]).then(function (out) {
              if (out[0].error) { throw new Error(out[0].error.message); }
              return {
                run: run,
                steps: out[0].data || [],
                resultCount: (out[1].data || []).length
              };
            });
          });
      }
    };
  }

  /* ==================================================================
     SOURCE B · LOCAL REPLAY. No backend, no n8n, no network.

     Runs agent/run.js in the browser and reveals one call every
     REVEAL_MS, so the panel can be demonstrated on GitHub Pages today,
     before Supabase is live. It produces the SAME sequence the real run
     produces, from the same file - it is not a second implementation.

     Say so out loud in the demo if the backend is not up yet. Do not let
     a judge believe this is the database.
     ================================================================== */

  function mockSource(zones, objective) {
    var REVEAL_MS = 1200;
    var plan = null, startedAt = 0;
    var g = (typeof globalThis !== 'undefined') ? globalThis : window;

    return {
      launch: function (missionId) {
        plan = g.AgentRun.planRun({
          runId: 'local_' + missionId,
          objective: objective || 'Identify areas where increasing vegetation could help.',
          zones: zones
        });
        startedAt = Date.now();
        return Promise.resolve(plan.calls.length);
      },

      state: function () {
        if (!plan) { return Promise.resolve({ run: null, steps: [], resultCount: 0 }); }
        var revealed = Math.min(plan.calls.length,
          Math.floor((Date.now() - startedAt) / REVEAL_MS) + 1);
        var shown = plan.calls.slice(0, revealed);
        var done = revealed >= plan.calls.length;

        return Promise.resolve({
          run: { id: 'local', status: done ? plan.outcome : 'running' },
          steps: shown.filter(function (c) { return c.rpc === 'agent_log_step'; })
            .map(function (c, i) {
              return {
                id: 'local_' + i,
                step_name: c.args.p_step,
                tool: c.args.p_tool,
                allowed: c.args.p_allowed,
                refused_reason: c.args.p_refused_reason,
                injection_flag: c.args.p_injection,
                status: c.args.p_allowed ? 'complete' : 'refused'
              };
            }),
          resultCount: shown.filter(function (c) { return c.rpc === 'agent_write_result'; }).length
        });
      }
    };
  }

  return {
    POLL_MS: POLL_MS,
    mount: mount,
    supabaseSource: supabaseSource,
    mockSource: mockSource
  };
});
