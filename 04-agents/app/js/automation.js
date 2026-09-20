/* =====================================================================
   KuwaitSat-1 Mission Hub
   04 · AUTOMATION AND AGENTS — the automation section in the app.

   Owner: Dana (04).  Drop-in for 01 · Front end: this file adds ONE
   <script> tag and ONE <section> to mission.html. It defines exactly one
   global (`Automation`), writes no CSS of its own, and imports nothing.
   Plain browser JavaScript in the same style as js/data.js and js/ui.js:
   `var`, `function`, Promises. No build step. No framework.

   ---------------------------------------------------------------------
   WHAT THIS FILE IS, IN RUBRIC TERMS
   ---------------------------------------------------------------------
   au-m1  The trigger lives HERE, in our own front end. The button calls a
          Postgres function, `launch_mission()`. There is no n8n URL in
          this file and there must never be one — see WHY below.
   au-m2  One box on the mission screen with three parts in this order:
          START (the button) · STATUS (the six steps ticking) · RESULT
          (what the run produced, readable without opening anything else).
   au-m6  A researcher who never opens n8n and never opens the Supabase
          dashboard sees the whole outcome on this screen, including the
          final report text.
   SHOULD 8   The human checkpoint. The agent PROPOSES a draft report.
              This panel visibly WAITS. Nothing is published until the
              researcher presses Approve, which calls generate_report().
   SHOULD 9   Failure is visible: the word "failed" plus a reason. There is
              a stall timeout, so a run that goes quiet SAYS SO instead of
              spinning forever.

   ---------------------------------------------------------------------
   WHY THE BUTTON DOES NOT CALL n8n  (03 · Security, DECISIONS.md D-1)
   ---------------------------------------------------------------------
   If this file did `fetch('https://....n8n.cloud/webhook/...')`, that URL
   would sit in View Source and in the Network tab — and the judge's own
   security test is "the address bar, plus the console". Worse: n8n holds
   a service key that bypasses Row Level Security by definition, so anyone
   who read that URL could start a run on ANOTHER researcher's mission
   from outside every account.

   So the chain is:

       this button  ->  launch_mission()  ->  a row in mission_runs
                                              with status 'queued'
                                                    |
                        n8n comes to us and picks queued runs up  <- not us
                                                    |
                        n8n writes back through three named functions
                                                    |
       this panel polls the database and shows what happened  <- us again

   The browser never talks to the automation engine. It talks to our own
   database, as the signed-in researcher, and reads the result back.

   ---------------------------------------------------------------------
   TWO RULES THIS FILE NEVER BREAKS
   ---------------------------------------------------------------------
   1. NOTHING FROM THE DATABASE IS EVER PUT INTO innerHTML.
      Every piece of text on screen is set with .textContent. The agent
      writes this text, and the agent was reading a researcher's typed
      objective when it wrote it — so it is untrusted input that made a
      round trip. `textContent` means a <script> tag in an objective is
      displayed as the characters "<script>", not executed. Search this
      file for "innerHTML": you will not find it. (DECISIONS.md D-2.)

   2. RAW DATABASE ERRORS NEVER REACH THE SCREEN.
      "permission denied for column raw_prompt" tells an attacker our
      column names. Every error goes through humanError() below, which
      turns known messages into sentences a researcher can act on.

   ---------------------------------------------------------------------
   HOW TO USE IT (one call — see the wiring note at the bottom of this file)
   ---------------------------------------------------------------------
       Automation.mount({
         el:        document.getElementById('automation'),
         missionId: mission.id,
         client:    window.sb,        // optional, defaults to window.sb
         onResults: function (rows) { ... },   // optional: draw the map
         onApproved: function (report) { ... } // optional: refresh the page
       });

   Returns a small api: { refresh(), stop(), runId() }.
   ===================================================================== */

var Automation = (function () {
  'use strict';

  /* ===================================================================
     1 · THE NUMBERS.  au-m5 asks: "point at the tool, state its limit in
     one sentence, and show where that limit is written down in the code."
     This is where. Every number the panel obeys is in this one block, so
     nobody has to hunt through the file to answer a judge.

     IMPORTANT HONESTY NOTE: the limits that actually PROTECT anything are
     enforced in the database, not here. A number in browser JavaScript is
     a courtesy — anyone can edit it in DevTools. The ones marked MIRROR
     are copies of a server-side rule, kept here only so the screen can
     explain itself before the server refuses. The server is the authority.
     =================================================================== */

  var POLL_MS = 2000;
  /* Ask the database for new steps every 2 seconds.
     Decision D-6: we POLL, we do not use Supabase Realtime. Two reasons.
     (a) A Realtime message is built from the database's write-ahead log,
         not from a SELECT — so columns we deliberately never granted
         (raw_prompt, raw_response, confidence) can ride along inside the
         websocket frame and show up in DevTools. A poll can only ever
         return the columns the grant allows.
     (b) Six steps over ninety seconds is about 45 requests. That is
         nothing, and a poll cannot silently drop on venue wifi the way a
         websocket can. */

  var QUEUE_WARN_MS = 20000;
  /* If the run is still 'queued' after 20 seconds, nothing has picked it
     up yet. We say so, gently, and keep waiting. On demo night this is
     the line that tells you the workflow is switched off, instead of
     leaving you staring at a spinner wondering. */

  var STALL_MS = 120000;
  /* THE STALL TIMEOUT — this is SHOULD 9. If 2 minutes pass with no new
     step written, we stop polling and say the run FAILED, with a reason.
     A run that dies quietly must never look the same as a run that is
     thinking. Raise this number if a real step legitimately takes longer;
     it is the only place it is written. */

  var STEP_BUDGET = 40;
  /* MIRROR of the database. agent_log_step() refuses step 41 with
     "Step budget exhausted." (03-security/db/05_views_rpc.sql, and the
     CHECK constraint on mission_runs.tool_calls in 01_tables_rls.sql).
     We show "x of 40 used" so the budget is visible while it is being
     spent, not only at the moment it runs out. */

  var MIN_REPORT_CHARS = 50;
  /* MIRROR of generate_report(), which refuses a body under 50
     characters. We check first so the Approve button can explain itself
     instead of producing a database error. */

  var MAX_DRAFT_ON_SCREEN = 20000;
  /* MIRROR of agent_write_result(), which refuses a result body over
     20,000 characters. Nothing longer can exist, so nothing longer can
     arrive here; this is the belt to that braces. */

  /* Set Automation.debug = true in the console to log raw errors while
     you are building. OFF by default: on demo night the console is a
     place a judge looks, and raw database text does not belong there. */
  var debug = false;


  /* ===================================================================
     2 · THE SIX STEPS.

     These names are not ours to choose. They are the six values the
     CHECK constraint on agent_steps.step_name allows
     (03-security/db/01_tables_rls.sql). If a name here does not match a
     name there, the step silently never appears — so if a step is missing
     on screen, compare these strings to that constraint FIRST.

     Third column is the one-line description a researcher reads. Step 3
     is labelled as the decision point on purpose: au-m3 asks for one
     decision the team can point at, and a judge should be able to find it
     on the screen, not only on a whiteboard.
     =================================================================== */

  var STEPS = [
    ['satellite_data',         'Satellite data',
     'Finds the KuwaitSat-1 scenes covering the area you drew.'],
    ['environmental_analysis', 'Environmental analysis',
     'Reads vegetation and surface temperature from those scenes.'],
    ['recommendation',         'Recommendation',
     'Ranks candidate zones 0–100 for where work would help most.'],
    ['impact_prediction',      'Impact prediction',
     'THE DECISION POINT: projects 24-month cooling. Under the floor, the ' +
     'zone is rejected and the run ranks again without it.'],
    ['visualization',          'Visualization',
     'Draws the surviving zones on the Kuwait map.'],
    ['reporting',              'Reporting',
     'Writes a DRAFT report. A draft is not a report until you approve it.']
  ];


  /* ===================================================================
     3 · ERROR TRANSLATION.

     Left side: the exact sentence the database raises (these strings are
     copied from 03-security/db/05_views_rpc.sql — if Mariam edits one,
     edit it here too).
     Right side: what the researcher reads.

     Most of ours are already written as human sentences, which is good
     security practice AND good UX. We still route them through here so
     that there is exactly one place where "what the screen says" is
     decided, and so an unexpected internal error can never fall through
     onto the page.
     =================================================================== */

  var DB_MESSAGES = {
    'Mission not found.':
      'This mission is not available on your account. Open it again from ' +
      'My missions.',

    'This mission is already running.':
      'This mission is already running. The steps below are live — there is ' +
      'no need to launch it twice.',

    'The prototype is not accepting new missions right now.':
      'New runs are switched off right now. This is a deliberate setting, ' +
      'not a fault. Ask the team to switch it back on.',

    'Mission settings are unavailable.':
      'The platform could not confirm it is accepting runs, so it refused to ' +
      'start one. Nothing was changed.',

    'A report needs at least 50 characters.':
      'The draft is too short to approve. The reporting step did not produce ' +
      'enough text — run the mission again rather than approving this.',

    'Run is not active.':
      'That run has already finished. It cannot take new steps.',

    'Step budget exhausted.':
      'The run reached its limit of ' + STEP_BUDGET + ' steps and stopped. ' +
      'That limit exists so a loop cannot run forever.',

    'Result body too long.':
      'The agent tried to write a result larger than the platform allows, ' +
      'and it was refused.',

    'Unknown run.':
      'That run no longer exists.'
  };

  function humanError(err) {
    /* Never returns raw database text. Always returns a sentence. */
    if (!err) return 'Something went wrong, and we could not tell what.';

    var msg  = (err && err.message) ? String(err.message) : '';
    var code = (err && err.code)    ? String(err.code)    : '';

    if (debug) { try { console.warn('[Automation] raw error', err); } catch (e) {} }

    /* (a) One of our own written sentences — use the mapped version. */
    if (DB_MESSAGES[msg]) return DB_MESSAGES[msg];

    /* (b) No network. This is the most common one on venue wifi, and it
       is worth naming exactly, because it is not our bug and the fix is
       "check the connection", not "run it again". */
    if (msg === 'Failed to fetch' || msg === 'NetworkError when attempting to fetch resource.' ||
        msg === 'Load failed' || code === 'ECONNREFUSED') {
      return 'Could not reach the database. Check the connection and try again — ' +
             'nothing was started.';
    }

    /* (c) Known PostgREST / Postgres conditions, by code. */
    if (code === 'PGRST202' || /Could not find the function/i.test(msg)) {
      return 'The platform is not finished setting up: the launch function does ' +
             'not exist in the database yet.';
    }
    if (code === 'PGRST301' || code === '401' || /JWT|token is expired/i.test(msg)) {
      return 'Your session has expired. Sign in again, then launch the mission.';
    }
    if (code === '42501' || /permission denied/i.test(msg)) {
      return 'This account is not allowed to do that. If you believe it should ' +
             'be, ask the team — nothing was changed.';
    }
    if (code === '22P02' || /invalid input syntax for type uuid/i.test(msg)) {
      return 'That mission link is not valid. Open the mission from My missions.';
    }
    if (code === '23514' || /violates check constraint/i.test(msg)) {
      return 'The database refused that because it breaks one of our rules ' +
             '(for example, an area outside Kuwait). Nothing was saved.';
    }
    if (code === '23505' || /duplicate key/i.test(msg)) {
      return 'That has already been recorded once. Nothing was duplicated.';
    }

    /* (d) Anything else. A short reference code helps the team find it in
       the logs; the message itself stays off the screen. */
    var ref = (code && code.length <= 12 && code.indexOf(' ') === -1) ? code : 'unknown';
    return 'Something went wrong and the run was not changed. ' +
           'Reference: ' + ref + '.';
  }


  /* ===================================================================
     4 · TINY DOM HELPERS.

     el('p', 'small muted', 'text')  ->  <p class="small muted">text</p>
     The text always goes in through .textContent, which is the whole
     point: there is no code path in this file that can turn database
     text into markup.
     =================================================================== */

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
  }

  function fmtWhen(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch (e) { return String(iso); }
  }


  /* ===================================================================
     5 · MOUNT. Everything below runs once per mission screen.
     =================================================================== */

  function mount(opts) {
    opts = opts || {};

    var host      = opts.el;
    var missionId = opts.missionId;
    var sb        = opts.client || window.sb;          /* the Supabase client */
    var onResults = opts.onResults  || function () {};
    var onApproved= opts.onApproved || function () {};

    if (!host) { throw new Error('Automation.mount needs opts.el'); }

    /* If this element was mounted before (a re-render), kill the old
       timer first. Two intervals polling the same run is the classic way
       a demo screen starts flickering. */
    if (host.__automationStop) { try { host.__automationStop(); } catch (e) {} }

    /* ---- state for this panel ------------------------------------- */
    var runId        = null;   /* the mission_runs row we are watching     */
    var timer        = null;   /* the setInterval handle                   */
    var lastChangeAt = 0;      /* when the step count last changed         */
    var seenSteps    = -1;     /* how many step rows we saw last tick      */
    var draftText    = '';     /* the reporting step's proposed report     */
    var approved     = false;  /* has a human pressed Approve?             */


    /* ===============================================================
       5a · BUILD THE BOX: start · status · result.
       Order matters for au-m2: a judge reading top to bottom must meet
       the button before the steps, and the steps before the result.
       =============================================================== */

    clear(host);
    host.setAttribute('aria-labelledby', 'automation-h');

    var head = el('div', 'pipeline-head');
    var h2 = el('h2', null, 'Automation');
    h2.id = 'automation-h';
    h2.style.margin = '0';
    var counter = el('span', 'small muted', '');
    head.appendChild(h2);
    head.appendChild(counter);

    var lede = el('p', 'small muted',
      'Six research assistants read the area you drew and propose where work ' +
      'would help most. They never command the satellite, and nothing is ' +
      'published until you approve it.');

    /* ---- START ---------------------------------------------------- */
    var startRow  = el('div', 'btn-row');
    var launchBtn = el('button', 'btn btn-primary', 'Launch Mission');
    launchBtn.type = 'button';
    launchBtn.id = 'automation-launch';
    var startNote = el('span', 'small muted', 'You decide when the assistants start.');
    startRow.appendChild(launchBtn);
    startRow.appendChild(startNote);

    /* ---- STATUS --------------------------------------------------- */
    /* role="status" + aria-live="polite" means a screen reader announces
       each change without interrupting. It costs two lines and it is the
       difference between an accessible status area and a decorative one. */
    var statusLine = el('p', 'small muted', 'Not started.');
    statusLine.setAttribute('role', 'status');
    statusLine.setAttribute('aria-live', 'polite');

    var bar = el('div', 'progress');
    var barFill = el('i');
    barFill.style.width = '0%';
    bar.appendChild(barFill);

    var stepList = el('ol', 'timeline');

    /* ---- the failure banner (hidden until there is a failure) ------ */
    var failBox = el('div', 'banner banner-error');
    failBox.setAttribute('role', 'alert');
    failBox.hidden = true;

    /* ---- HUMAN CHECKPOINT (hidden until the agent proposes) -------- */
    var checkBox = el('section', 'review');
    checkBox.hidden = true;

    /* ---- RESULT --------------------------------------------------- */
    var resultBox = el('div');

    host.appendChild(head);
    host.appendChild(lede);
    host.appendChild(startRow);
    host.appendChild(statusLine);
    host.appendChild(bar);
    host.appendChild(failBox);
    host.appendChild(stepList);
    host.appendChild(checkBox);
    host.appendChild(resultBox);

    paintSteps([], null);   /* draw the six greyed steps immediately, so the
                               section is never an empty box */

    /* ---------------------------------------------------------------
       If the Supabase client is not on the page, say so plainly and
       disable the button.

       There is deliberately NO simulated fallback here. A panel that
       fakes a successful run when the database is missing is the single
       worst thing we could ship: it would look identical on demo night
       whether the platform worked or not, and we would not know which.
       If you want to click through the flow without a database, use
       04-agents/app/demo.html, which is clearly labelled as a replay.
       --------------------------------------------------------------- */
    if (!sb || typeof sb.rpc !== 'function') {
      launchBtn.disabled = true;
      setStatus('The database client has not loaded, so the automation cannot ' +
                'start. Check that js/config.js is included before this file.', 'bad');
      host.__automationStop = function () {};
      return { refresh: function () { return Promise.resolve(); },
               stop: function () {}, runId: function () { return null; } };
    }


    /* ===============================================================
       5b · PAINTING. Every function below only reads state and writes
       to the DOM. None of them talk to the network.
       =============================================================== */

    function setStatus(text, tone) {
      statusLine.textContent = text;
      statusLine.className = 'small';
      /* The stylesheet has no .good / .bad, so colour is set directly
         from the same CSS variables the rest of the app uses. */
      statusLine.style.color =
        tone === 'bad'  ? 'var(--danger)' :
        tone === 'good' ? 'var(--accent)' :
        tone === 'warn' ? 'var(--warn)'   : 'var(--muted)';
    }

    function showFailure(headline, reason) {
      /* SHOULD 9: the word "failed" (or "stopped"), plus a reason, in a
         box the eye lands on. Never a spinner that goes on forever. */
      clear(failBox);
      failBox.hidden = false;
      var strong = el('strong', null, headline);
      failBox.appendChild(strong);
      failBox.appendChild(document.createTextNode(' '));
      failBox.appendChild(document.createTextNode(reason));
      var note = el('div', 'small');
      note.style.marginTop = '6px';
      note.textContent = 'Nothing was published. You can launch this mission again.';
      failBox.appendChild(note);
    }

    function hideFailure() { failBox.hidden = true; clear(failBox); }

    /* Group the step rows by name. The agent can write the SAME step more
       than once — that is the decision point doing its job: when the
       impact gate rejects the top zone, the run goes back and ranks
       again, so 'recommendation' appears twice. We show the latest row
       and say how many times it ran, because "ran twice" on screen is the
       visible proof that the decision changed the path. */
    function groupSteps(rows) {
      var byName = {};
      rows.forEach(function (r) {
        var key = r.step_name;
        if (!byName[key]) byName[key] = { rows: [], count: 0 };
        byName[key].rows.push(r);
        byName[key].count += 1;
      });
      return byName;
    }

    function paintSteps(rows, runStatus) {
      var byName = groupSteps(rows || []);
      var live = (runStatus === 'queued' || runStatus === 'running');

      /* The first step with no row yet is the one currently being worked
         on — we show it as "Running…" while the run is live. */
      var nextExpected = null;
      for (var i = 0; i < STEPS.length; i++) {
        if (!byName[STEPS[i][0]]) { nextExpected = STEPS[i][0]; break; }
      }

      clear(stepList);

      STEPS.forEach(function (step, idx) {
        var name  = step[0];
        var label = step[1];
        var blurb = step[2];
        var group = byName[name];
        var row   = group ? group.rows[group.rows.length - 1] : null;

        var state =
          row ? (row.allowed === false ? 'refused' : 'complete') :
          (live && name === nextExpected ? 'running' : 'queued');

        var li = el('li', 'agent ' + state);

        var node = el('span', 'node',
          state === 'complete' ? '✓' :        /* ✓ */
          state === 'refused'  ? '✕' :        /* ✕ */
          String(idx + 1));
        node.setAttribute('aria-hidden', 'true');
        if (state === 'refused') {
          node.style.borderColor = 'var(--danger)';
          node.style.color = 'var(--danger)';
        }
        li.appendChild(node);

        var body = el('span', 'body');
        body.appendChild(el('span', 'nm', label));

        var stateText =
          state === 'complete' ? 'Complete' :
          state === 'refused'  ? 'Refused'  :
          state === 'running'  ? 'Running…' : 'Waiting';
        if (group && group.count > 1) {
          stateText = stateText + ' · ran ' + group.count + ' times';
        }
        var st = el('span', 'st', stateText);
        if (state === 'refused') st.style.color = 'var(--danger)';
        body.appendChild(st);

        /* The one line of text under the step name. When the step was
           refused, the REASON replaces the description — a refusal the
           researcher cannot read is not a refusal they can trust.
           .textContent, always: this string was written by the agent. */
        body.appendChild(el('span', 'sm',
          (state === 'refused' && row && row.refused_reason)
            ? row.refused_reason
            : blurb));

        /* The run flagged the objective as containing an instruction
           rather than a research question. It is raised once and never
           lowered, and the researcher is told. */
        if (row && row.injection_flag) {
          var chip = el('span', 'chip chip-medium', 'Objective flagged for review');
          chip.style.marginTop = '6px';
          chip.style.display = 'inline-flex';
          body.appendChild(chip);
        }

        if (group && group.count > 1 && name === 'recommendation') {
          var why = el('span', 'sm',
            'Ranked again because the impact gate rejected the top zone.');
          why.style.color = 'var(--warn)';
          body.appendChild(why);
        }

        li.appendChild(body);
        li.setAttribute('aria-label', label + ', ' + stateText);
        stepList.appendChild(li);
      });

      var done = 0;
      for (var k = 0; k < STEPS.length; k++) { if (byName[STEPS[k][0]]) done += 1; }
      counter.textContent = done + ' of ' + STEPS.length + ' steps complete';
      barFill.style.width = Math.round((done / STEPS.length) * 100) + '%';
    }

    function paintResults(rows) {
      clear(resultBox);
      if (!rows || !rows.length) return;

      var h3 = el('h3', null, 'Result');
      h3.style.marginTop = '18px';
      resultBox.appendChild(h3);

      resultBox.appendChild(el('p', 'small muted',
        'Read straight out of our own database. You do not need to open the ' +
        'automation tool or the database dashboard to see any of this.'));

      rows.forEach(function (r) {
        var card = el('div', 'card');

        var titleRow = el('div', 'btn-row');
        titleRow.style.justifyContent = 'space-between';
        titleRow.appendChild(el('h4', null, r.title || 'Untitled finding'));
        titleRow.appendChild(el('span', 'chip chip-low', r.kind || 'result'));
        card.appendChild(titleRow);

        /* white-space: pre-wrap keeps the agent's line breaks — including
           the provenance lines under each number — without ever treating
           the text as markup. Plain text, by decision D-2. */
        var body = el('p', 'small', String(r.body || '').slice(0, MAX_DRAFT_ON_SCREEN));
        body.style.whiteSpace = 'pre-wrap';
        body.style.margin = '10px 0 0';
        card.appendChild(body);

        if (r.created_at) {
          card.appendChild(el('p', 'small muted', 'Written ' + fmtWhen(r.created_at)));
        }
        resultBox.appendChild(card);
      });

      /* Hand the geometry to whoever owns the map. Wrapped in try/catch
         on purpose: if the map throws, the TEXT of the result must still
         be on screen. The findings tell the whole story without a map. */
      try { onResults(rows); } catch (e) {}
    }


    /* ===============================================================
       5c · THE HUMAN CHECKPOINT (SHOULD 8).

       The agent PROPOSES: the reporting step writes a result of kind
       'narrative' — a DRAFT. The panel then visibly WAITS. The word
       "waiting" is on screen and the Approve button is the only way
       forward. Only when a person presses it do we call
       generate_report(), which is the function granted to
       `authenticated` and NOT to the automation engine — so in this
       system a report literally cannot exist unless a human clicked.
       =============================================================== */

    function paintCheckpoint(state, extra) {
      clear(checkBox);
      checkBox.hidden = false;

      var heading = el('h2', null,
        state === 'approved' ? 'Approved' : 'Your approval is needed');
      heading.style.marginTop = '0';
      checkBox.appendChild(heading);

      if (state === 'approved') {
        checkBox.appendChild(el('p', 'small',
          'You approved this report' + (extra ? ' on ' + fmtWhen(extra) : '') +
          '. It is published under your name.'));
        var link = el('a', 'btn btn-primary', 'View report');
        link.href = 'report.html?id=' + encodeURIComponent(missionId);
        checkBox.appendChild(link);
        return;
      }

      if (state === 'nodraft') {
        checkBox.appendChild(el('p', 'small',
          'The run finished but did not leave a draft report, so there is ' +
          'nothing to approve. Launch the mission again.'));
        return;
      }

      /* state === 'waiting' */
      checkBox.appendChild(el('p', 'small',
        'The assistants have PROPOSED the report below. It is a draft. It is ' +
        'not saved, not published, and not visible to anyone else until you ' +
        'approve it.'));

      var draftWrap = el('div', 'card');
      draftWrap.style.maxHeight = '260px';
      draftWrap.style.overflow = 'auto';
      var draftP = el('p', 'small', draftText);
      draftP.style.whiteSpace = 'pre-wrap';   /* plain text, never markdown */
      draftP.style.margin = '0';
      draftWrap.appendChild(draftP);
      checkBox.appendChild(draftWrap);

      var row = el('div', 'btn-row');
      row.style.marginTop = '14px';

      var approveBtn = el('button', 'btn btn-primary', 'Approve and generate report');
      approveBtn.type = 'button';

      var reason = el('span', 'small muted',
        'Waiting for you. Nothing happens until you press this.');

      /* MIRROR of the database rule, so the button can explain itself. */
      if (draftText.length < MIN_REPORT_CHARS) {
        approveBtn.disabled = true;
        reason.textContent = 'This draft is only ' + draftText.length +
          ' characters. A report needs at least ' + MIN_REPORT_CHARS + '.';
      }

      approveBtn.addEventListener('click', function () {
        approveBtn.disabled = true;
        approveBtn.textContent = 'Publishing…';
        reason.textContent = '';

        /* The one write a human makes in this whole flow. */
        sb.rpc('generate_report', {
          p_mission_id: missionId,
          p_body_md: draftText
        }).then(function (res) {
          if (res.error) throw res.error;
          approved = true;
          paintCheckpoint('approved', new Date().toISOString());
          setStatus('Report approved and published.', 'good');
          try { onApproved(res.data); } catch (e) {}
        })['catch'](function (err) {
          approveBtn.disabled = false;
          approveBtn.textContent = 'Approve and generate report';
          reason.textContent = humanError(err);
          reason.style.color = 'var(--danger)';
        });
      });

      row.appendChild(approveBtn);
      row.appendChild(reason);
      checkBox.appendChild(row);
    }


    /* ===============================================================
       5d · READING THE DATABASE.

       Note every query NAMES ITS COLUMNS. `select('*')` now ERRORS on
       these tables — the grants in 03-security/db/03_grants.sql take
       everything back and hand out named columns only, so `*` asks for
       columns like raw_prompt that we are not allowed to see. That is
       correct and deliberate, not a bug to work around.
       =============================================================== */

    function loadResults() {
      /* We read the results TABLE, not the my_mission_results VIEW.
         The view truncates body to 240 characters, which would cut the
         provenance lines off the bottom of every finding — and SHOULD 11
         is "every number in agent-written text is traceable on screen".
         Every column named below is in the grant. */
      return sb.from('results')
        .select('id,kind,title,body,geometry,status,created_at')
        .eq('mission_id', missionId)
        .eq('status', 'complete')
        .order('created_at', { ascending: true })
        .then(function (res) {
          if (res.error) throw res.error;
          var rows = res.data || [];
          paintResults(rows);

          /* The DRAFT report is the narrative the reporting step wrote.
             Last one wins, so a re-run replaces an earlier draft. */
          var narratives = rows.filter(function (r) { return r.kind === 'narrative'; });
          if (narratives.length) {
            draftText = String(narratives[narratives.length - 1].body || '');
          }
          return rows;
        });
    }

    function loadExistingReport() {
      /* Did a human already approve this mission, perhaps in an earlier
         session? Then the checkpoint is already past and the screen must
         say so on load rather than asking for approval twice. */
      return sb.from('reports')
        .select('id,mission_id,approved_at')
        .eq('mission_id', missionId)
        .order('approved_at', { ascending: false })
        .limit(1)
        .then(function (res) {
          if (res.error) throw res.error;
          return (res.data || [])[0] || null;
        });
    }

    function tick() {
      /* One poll: the run's own row, plus its steps. Both in parallel. */
      return Promise.all([
        sb.from('mission_runs')
          .select('id,mission_id,status,started_at,finished_at,tool_calls')
          .eq('id', runId)
          .maybeSingle(),
        sb.from('my_agent_steps')
          .select('id,run_id,step_name,status,allowed,refused_reason,' +
                  'injection_flag,started_at,finished_at')
          .eq('run_id', runId)
          .order('started_at', { ascending: true })
      ]).then(function (out) {
        if (out[0].error) throw out[0].error;
        if (out[1].error) throw out[1].error;

        var run   = out[0].data;
        var steps = out[1].data || [];

        if (!run) {
          stop();
          setStatus('That run is not visible on this account.', 'bad');
          return;
        }

        /* Stall detection: we only reset the clock when the number of
           steps actually CHANGES. A run that keeps answering the poll
           while writing nothing is exactly the silent failure SHOULD 9
           is about. */
        if (steps.length !== seenSteps) {
          seenSteps = steps.length;
          lastChangeAt = Date.now();
        }

        paintSteps(steps, run.status);

        /* ---- terminal states: stop polling -------------------------- */

        if (run.status === 'complete') {
          stop();
          hideFailure();
          launchBtn.disabled = true;
          launchBtn.textContent = 'Run complete';
          setStatus('Done. The assistants finished and are waiting for your review.', 'good');
          return loadResults().then(function () {
            if (approved) return;
            paintCheckpoint(draftText ? 'waiting' : 'nodraft');
          })['catch'](function (err) {
            setStatus(humanError(err), 'bad');
          });
        }

        if (run.status === 'failed') {
          stop();
          launchBtn.disabled = false;
          launchBtn.textContent = 'Launch Mission';
          var refused = steps.filter(function (s) { return s.allowed === false; }).pop();
          showFailure('Failed.',
            refused && refused.refused_reason
              ? refused.refused_reason
              : 'The run ended before it finished the six steps.');
          setStatus('Failed. See the reason above.', 'bad');
          return loadResults()['catch'](function () {});
        }

        if (run.status === 'stalled') {
          stop();
          launchBtn.disabled = false;
          launchBtn.textContent = 'Launch Mission';
          var stopReason = steps.filter(function (s) { return s.allowed === false; }).pop();
          showFailure('Stopped.',
            stopReason && stopReason.refused_reason
              ? stopReason.refused_reason
              : 'The run stopped before it could recommend anything.');
          setStatus('Stopped before finishing. See the reason above.', 'bad');
          return loadResults()['catch'](function () {});
        }

        /* ---- still going: queued or running ------------------------- */

        var quietFor = Date.now() - lastChangeAt;

        if (quietFor > STALL_MS) {
          /* THE STALL TIMEOUT. We give up and say so. We do NOT mark the
             run failed in the database — this panel has no write access
             to that, and guessing on the server's behalf would put a lie
             in the audit trail. What we say is exactly what we know:
             nothing has happened here for two minutes. */
          stop();
          launchBtn.disabled = false;
          launchBtn.textContent = 'Launch Mission';
          showFailure('Failed — no response.',
            'No new step has been written for ' + Math.round(STALL_MS / 1000) +
            ' seconds, so we stopped waiting. The automation may be switched off.');
          setStatus('Failed — the run stopped responding.', 'bad');
          return;
        }

        if (run.status === 'queued') {
          setStatus(quietFor > QUEUE_WARN_MS
            ? 'Queued — still waiting for the workflow to pick this run up…'
            : 'Queued — the run is written and waiting to be picked up…',
            quietFor > QUEUE_WARN_MS ? 'warn' : 'muted');
        } else {
          setStatus('Running — ' + steps.length + ' of ' + STEPS.length +
                    ' steps written, ' + (run.tool_calls || 0) + ' of ' +
                    STEP_BUDGET + ' tool calls used…');
        }
      })['catch'](function (err) {
        /* A failed poll stops the polling. Retrying into a wall four
           times a minute for the rest of the demo helps nobody. */
        stop();
        launchBtn.disabled = false;
        launchBtn.textContent = 'Launch Mission';
        showFailure('Failed to read the run.', humanError(err));
        setStatus('Failed to read the run.', 'bad');
      });
    }

    function startPolling() {
      if (timer) return;
      lastChangeAt = Date.now();
      tick();
      timer = setInterval(tick, POLL_MS);
    }

    function stop() {
      if (timer) { clearInterval(timer); timer = null; }
    }
    host.__automationStop = stop;


    /* ===============================================================
       5e · THE TRIGGER (au-m1).

       One RPC call, made by our own page, as the signed-in researcher.
       No webhook. No key. No third-party URL anywhere in this file.
       In the Network tab this is a POST to /rest/v1/rpc/launch_mission
       on our own Supabase project — which is the thing to show a judge
       who asks how the automation starts.
       =============================================================== */

    launchBtn.addEventListener('click', function () {
      launchBtn.disabled = true;
      launchBtn.textContent = 'Launching…';
      hideFailure();
      checkBox.hidden = true;
      setStatus('Queueing the run…');

      sb.rpc('launch_mission', { p_mission_id: missionId })
        .then(function (res) {
          if (res.error) throw res.error;
          runId = res.data;              /* the new mission_runs id */
          seenSteps = -1;
          launchBtn.textContent = 'Running…';
          startPolling();
        })['catch'](function (err) {
          launchBtn.disabled = false;
          launchBtn.textContent = 'Launch Mission';
          setStatus(humanError(err), 'bad');
        });
    });


    /* ===============================================================
       5f · ON LOAD: pick up whatever is already true.

       A researcher may reload the page mid-run, or come back tomorrow.
       The screen must show the truth either way, which means asking the
       database rather than assuming "not started".
       =============================================================== */

    loadExistingReport()
      .then(function (report) {
        if (report) { approved = true; }

        return sb.from('mission_runs')
          .select('id,mission_id,status,started_at,finished_at,tool_calls')
          .eq('mission_id', missionId)
          .order('started_at', { ascending: false })
          .limit(1)
          .then(function (res) {
            if (res.error) throw res.error;
            var run = (res.data || [])[0];

            if (report) {
              launchBtn.disabled = true;
              launchBtn.textContent = 'Mission complete';
              setStatus('This mission is complete and the report is approved.', 'good');
              paintCheckpoint('approved', report.approved_at);
              return loadResults();
            }

            if (!run) {
              setStatus('Not started. Press Launch Mission when you are ready.');
              return null;
            }

            runId = run.id;
            if (run.status === 'queued' || run.status === 'running') {
              launchBtn.disabled = true;
              launchBtn.textContent = 'Running…';
              startPolling();
            } else {
              /* finished, failed or stalled — one tick paints the final
                 state and stops, no interval needed */
              tick();
            }
            return null;
          });
      })['catch'](function (err) {
        setStatus(humanError(err), 'bad');
      });


    /* The small api the page gets back. */
    return {
      refresh: function () { return runId ? tick() : Promise.resolve(); },
      stop: stop,
      runId: function () { return runId; }
    };
  }

  /* One global, three things on it. STEPS and the limits are exposed so
     the demo page and the tests can read the same numbers rather than
     keeping a second copy that drifts. */
  return {
    mount: mount,
    STEPS: STEPS,
    limits: {
      pollMs: POLL_MS,
      stallMs: STALL_MS,
      queueWarnMs: QUEUE_WARN_MS,
      stepBudget: STEP_BUDGET,
      minReportChars: MIN_REPORT_CHARS
    },
    set debug(v) { debug = !!v; },
    get debug() { return debug; }
  };
})();
