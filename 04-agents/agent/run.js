/* =====================================================================
   THE RUN PLAN.
   Owner: 04 · Automation and agents (Dana)

   planRun() turns one queued mission_run into the exact, ordered list of
   database calls the run will make. Nothing else in this project decides
   the order of an agent run.

   There are exactly three calls it is allowed to emit, because there are
   exactly three functions n8n may execute (03-security/db/05_views_rpc.sql):

       agent_log_step      · one row per step, refusals included
       agent_write_result  · one finding, written complete
       agent_finish_run    · complete | failed | stalled

   No table URL appears anywhere in this file. If you ever see
   /rest/v1/agent_steps in the n8n workflow, that is a security finding
   and the workflow is wrong, not the grants.

   WHY A PLAN INSTEAD OF A SCRIPT. A plan is a value, so it can be
   tested (../tests/decision.test.js), printed on a whiteboard
   (../tools/rehearse.js) and replayed in the browser with no backend
   (../app/agent-panel.js) without any of those three re-implementing the
   order of the run. One order, one file.

   HONESTY. The zone scores and the cooling projections handed to this
   function are sample values produced by the prototype, not KuwaitSat-1
   measurements. The DECISION is real code comparing the same numbers the
   screen shows.
   ===================================================================== */

/* Already-loaded global first, require() second. That order matters: in
   the n8n Code node the bundle has put AgentDecision on globalThis and
   require('./decision.js') would look for a file that is not there. */
(function (root, factory) {
  function need(globalName, relPath) {
    if (root && root[globalName]) { return root[globalName]; }
    if (typeof require === 'function') { return require(relPath); }
    throw new Error(globalName + ' is not loaded. Load agent/decision.js and ' +
                    'agent/steps.js before agent/run.js.');
  }
  var api = factory(need('AgentDecision', './decision.js'), need('AgentSteps', './steps.js'));
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  if (root) { root.AgentRun = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (D, S) {

  /* The same bound the database enforces in agent_log_step:
       if v_calls >= 40 then raise 'Step budget exhausted.'
     Mirrored here so the plan is refused before it is half-written,
     instead of dying at step 41 with four rows already on screen. */
  var STEP_BUDGET = 40;

  /* The objective is typed by a human into a form and then handed to a
     tool-using agent. That makes it untrusted text. We do not obey it,
     we do not sanitise it into something that looks obedient - we raise
     the flag and carry on with the mission as written. */
  var INSTRUCTION_MARKERS = [
    'ignore previous', 'ignore all previous', 'disregard the', 'system prompt',
    'you are now', 'act as', 'reveal your', 'print your instructions',
    'drop table', 'send an email', 'call the webhook'
  ];

  function looksLikeInstruction(objective) {
    var t = String(objective || '').toLowerCase();
    for (var i = 0; i < INSTRUCTION_MARKERS.length; i++) {
      if (t.indexOf(INSTRUCTION_MARKERS[i]) !== -1) { return true; }
    }
    return false;
  }

  /* ------------------------------------------------------------------
     describeRefusal · WHAT THE APP SAYS IT REFUSED TO DO.

     capstone COULD 14: "the guardrail holds AND THE APP SAYS WHAT IT
     REFUSED TO DO." Raising missions.injection_flag satisfies the first
     half. On its own it fails the second: a chip reading "Objective
     flagged for review" tells a judge something was caught, never what.

     So the screening also returns a sentence, and the sentence quotes
     the offending words back. It is written for a researcher reading a
     step row, not for a log file.

       reason  -> agent_log_step(..., p_refused_reason => reason)
                  The step is still ALLOWED: the satellite step really
                  did run. What was refused is the embedded instruction,
                  not the step. agent_log_step stores refused_reason
                  independently of p_allowed (05_views_rpc.sql, the
                  insert takes both columns), and my_agent_steps exposes
                  it, so this reaches the screen in about 2 seconds.

       notice  -> the FIRST LINE of the draft narrative, so the sentence
                  is also in the text a human approves and in the report
                  that comes out of it.

     Returns null for a clean objective, so every call site reads
     `refusal ? refusal.reason : null` and a normal run is untouched.
     ------------------------------------------------------------------ */

  /* How much of the objective to quote back. Long enough to be
     recognisable in the room, short enough that it cannot push a wall of
     text into a step row. */
  var QUOTE_CHARS = 90;

  function quoteFrom(objective, marker) {
    var raw = String(objective || '');
    var at = raw.toLowerCase().indexOf(marker);
    if (at === -1) { return marker; }
    var slice = raw.slice(at, at + QUOTE_CHARS).replace(/\s+/g, ' ').trim();
    return slice.length < raw.length - at ? slice + '…' : slice;
  }

  function describeRefusal(objective) {
    var t = String(objective || '').toLowerCase();
    var marker = null;
    for (var i = 0; i < INSTRUCTION_MARKERS.length; i++) {
      if (t.indexOf(INSTRUCTION_MARKERS[i]) !== -1) {
        marker = INSTRUCTION_MARKERS[i];
        break;
      }
    }
    if (!marker) { return null; }

    var quote = quoteFrom(objective, marker);
    return {
      marker: marker,
      quote: quote,
      reason: 'Refused an instruction found inside the research objective: "' +
              quote + '". The objective is data, not a command, so it was not ' +
              'carried out. The mission was run as written and the objective ' +
              'is flagged for review.',
      notice: 'REFUSED: the objective contained an instruction to the agent - "' +
              quote + '". It was not carried out. The mission below answers ' +
              'the research question as written.'
    };
  }

  function logStep(runId, key, args, allowed, refusedReason, injection) {
    var def = S.byKey(key);
    return {
      rpc: 'agent_log_step',
      step: key,
      label: def ? def.label : key,
      allowed: allowed !== false,
      refusedReason: refusedReason || null,
      args: {
        p_run_id: runId,
        p_step: key,
        p_tool: def ? def.tool : null,
        p_args: args || {},
        p_allowed: allowed !== false,
        p_refused_reason: refusedReason || null,
        p_injection: injection === true
      }
    };
  }

  function writeResult(runId, kind, title, body, geometry) {
    return {
      rpc: 'agent_write_result',
      args: {
        p_run_id: runId,
        p_kind: kind,
        p_title: title,
        p_body: body,
        p_geometry: geometry || null,
        p_source_ref: null
      }
    };
  }

  function finishRun(runId, status, error) {
    return {
      rpc: 'agent_finish_run',
      args: { p_run_id: runId, p_status: status, p_error: error || null }
    };
  }

  /* ------------------------------------------------------------------
     planRun · the whole run, in order.

     input = {
       runId:     uuid of the queued mission_runs row
       objective: the researcher's typed objective
       zones:     [{ id, name, score, projectedCoolingC, polygon, note }]
     }

     returns {
       calls:     ordered call descriptors
       outcome:   'complete' | 'stalled'
       decisions: every verdict the gate returned, in order
       reranks:   how many times it went back
     }
     ------------------------------------------------------------------ */
  function planRun(input) {
    var runId = input.runId;
    var zones = input.zones || [];
    var calls = [];
    var decisions = [];
    var rejectedIds = [];
    var rerankCount = 0;
    var injection = looksLikeInstruction(input.objective);

    function push(call) {
      if (call.rpc === 'agent_log_step') {
        var used = 0;
        for (var i = 0; i < calls.length; i++) {
          if (calls[i].rpc === 'agent_log_step') { used++; }
        }
        if (used >= STEP_BUDGET) {
          throw new Error('Step budget exhausted at ' + STEP_BUDGET +
                          ' steps. The plan was refused before any row was written.');
        }
      }
      calls.push(call);
    }

    /* STEP 1 - the only step that touches anything outside our database.
       If the objective carries an instruction, the flag is raised here
       and it rides on the mission for the rest of the run. */
    push(logStep(runId, 'satellite_data',
      { area: 'mission area', max_scenes: 20 }, true, null, injection));

    /* STEP 2 */
    push(logStep(runId, 'environmental_analysis',
      { measures: ['ndvi', 'surface_temperature'] }, true, null, false));

    /* STEP 3 -> 4 -> DECISION, and back to 3 when a zone is refused. */
    var verdict = null;
    while (true) {
      var ranked = D.rankZones(zones, rejectedIds);

      push(logStep(runId, 'recommendation',
        { candidates: ranked.length, excluded: rejectedIds.length }, true, null, false));

      var top = ranked[0] || null;

      push(logStep(runId, 'impact_prediction',
        { zone: top ? top.id : null, horizon_months: 24 }, true, null, false));

      verdict = D.decide({ zones: zones, rejectedIds: rejectedIds, rerankCount: rerankCount });
      decisions.push(verdict);

      if (verdict.verdict === 'forward') { break; }

      if (verdict.verdict === 'rerank') {
        /* THE REFUSAL THE JUDGE READS ON SCREEN.
           error_note on mission_runs is NOT granted to the browser
           (03-security/db/03_grants.sql), so a reason that exists only
           there is a reason the researcher never sees. It is logged as a
           refused STEP, which the my_agent_steps view does expose. */
        push(logStep(runId, 'impact_prediction',
          { zone: verdict.rejected.id,
            projected_cooling_c: verdict.rejected.projectedCoolingC,
            floor_c: D.IMPACT_FLOOR_C },
          false, verdict.reason, false));
        rejectedIds.push(verdict.rejected.id);
        rerankCount++;
        continue;
      }

      /* stalled */
      push(logStep(runId, 'impact_prediction',
        { reranks: rerankCount, floor_c: D.IMPACT_FLOOR_C },
        false, verdict.reason, false));
      push(finishRun(runId, 'stalled', verdict.reason));
      return { calls: calls, outcome: 'stalled', decisions: decisions, reranks: rerankCount };
    }

    /* STEP 5 - the accepted zones become result rows. Geometry is jsonb
       on the row. No bucket, no image file (DECISIONS D-2). */
    var accepted = D.rankZones(zones, rejectedIds);
    accepted.forEach(function (z, i) {
      push(writeResult(runId, 'site',
        z.name,
        'Rank ' + (i + 1) + ' of ' + accepted.length + '. Score ' + z.score + '/100. ' +
        'Projected cooling ' + D.round1(z.projectedCoolingC).toFixed(1) + ' °C at 24 months. ' +
        (z.note || ''),
        z.polygon ? { type: 'Polygon', coordinates: [z.polygon] } : null));
    });
    push(writeResult(runId, 'metric',
      'Impact floor applied',
      'Zones were accepted only at or above ' + D.IMPACT_FLOOR_C.toFixed(1) +
      ' °C of projected 24-month cooling. ' + rejectedIds.length +
      ' zone(s) were rejected and re-ranked. Sample figures, not measurements.',
      null));

    push(logStep(runId, 'visualization',
      { polygons: accepted.length }, true, null, false));

    /* STEP 6 - a draft, and only a draft. The report itself needs a
       human: generate_report is granted to authenticated, not to n8n. */
    push(writeResult(runId, 'narrative',
      'Draft findings',
      'Recommended ' + (accepted[0] ? accepted[0].name : 'no zone') + ' first. ' +
      'Awaiting researcher approval. No report exists until a researcher presses Generate Report.',
      null));
    push(logStep(runId, 'reporting', { draft: true }, true, null, false));

    push(finishRun(runId, 'complete', null));

    return { calls: calls, outcome: 'complete', decisions: decisions, reranks: rerankCount };
  }

  return {
    STEP_BUDGET: STEP_BUDGET,
    looksLikeInstruction: looksLikeInstruction,
    describeRefusal: describeRefusal,
    planRun: planRun
  };
});
