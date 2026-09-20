/* ===================================================================
   GENERATED FILE - DO NOT EDIT.
   Built by 04-agents/tools/bundle.js from:
     agent/decision.js
     agent/steps.js
     agent/run.js
   Rebuild:  node 04-agents/tools/bundle.js

   Paste the whole file into the n8n Code node named "Plan the run".
   The threshold it uses is the one in agent/decision.js. There is no
   second copy of that number anywhere.
   =================================================================== */

/* ===== agent/decision.js ===== */
/* =====================================================================
   THE DECISION POINT  ·  capstone item au-m3
   Owner: 04 · Automation and agents (Dana)

   ONE NUMBER DECIDES THE WHOLE RUN:

       projected 24-month cooling of the top-ranked zone
           >= 1.0 °C  ->  forward, draw it on the map
           <  1.0 °C  ->  reject that zone, go back and rank again

   That number is IMPACT_FLOOR_C, twelve lines below. It is written
   once, in this file, and nowhere else. The n8n Code node runs this
   exact file (see ../n8n/README.md); the browser panel imports it; the
   test in ../tests/decision.test.js asserts on it. If a judge asks
   "where does the threshold live", the answer is one file and one line.

   WHY THE LOOP TERMINATES. The re-rank is not the same question asked
   twice. Recommendation ranks on what was OBSERVED (NDVI, surface
   temperature, access). Impact Prediction then MODELS each zone forward
   24 months, which is information the ranking did not have. A zone that
   fails the floor is removed from the candidate list, so every loop has
   one fewer zone to consider. MAX_RERANKS stops it anyway.

   No framework. No import. Runs in the browser, in Node, and pasted
   into an n8n Code node.
   ===================================================================== */

(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  if (root) { root.AgentDecision = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {

  /* ------------------------------------------------------------------
     THE THRESHOLD. This is the line to point at.
     ------------------------------------------------------------------ */

  /* Degrees Celsius of projected local cooling at 24 months. A planting
     zone that cannot reach this is not worth a researcher's attention,
     so the agent refuses it and ranks again without it. */
  var IMPACT_FLOOR_C = 1.0;

  /* How many times the run may go back to Recommendation. Two. On the
     third refusal the run stops as 'stalled' and says why on screen.
     An agent that can loop without a bound is an agent that can bill
     you all night. */
  var MAX_RERANKS = 2;

  /* A zone ranked below this is never proposed in the first place, so
     the decision gate never has to see it. This is a guardrail, not the
     decision — do not confuse the two when a judge asks. */
  var MIN_ZONE_SCORE = 40;

  /* ------------------------------------------------------------------
     Comparison precision.

     The report prints cooling to one decimal place. So the gate compares
     to one decimal place too. Without this, a zone printed as "1.0 °C"
     could be refused for being 0.9999, and the screen and the decision
     would disagree in front of a judge.
     ------------------------------------------------------------------ */
  function round1(n) {
    return Math.round((Number(n) + Number.EPSILON) * 10) / 10;
  }

  /* ------------------------------------------------------------------
     rankZones · what Recommendation proposes.

     Highest score first, ties broken by the larger projected cooling so
     the order is stable and reproducible. Anything already rejected, or
     under the score floor, is gone.
     ------------------------------------------------------------------ */
  function rankZones(zones, rejectedIds) {
    var out = [];
    var rejected = rejectedIds || [];
    (zones || []).forEach(function (z) {
      if (rejected.indexOf(z.id) !== -1) { return; }
      if (Number(z.score) < MIN_ZONE_SCORE) { return; }
      out.push(z);
    });
    out.sort(function (a, b) {
      if (b.score !== a.score) { return b.score - a.score; }
      return round1(b.projectedCoolingC) - round1(a.projectedCoolingC);
    });
    return out;
  }

  /* ------------------------------------------------------------------
     decide · THE DECISION POINT.

     state = {
       zones:       [{ id, name, score, projectedCoolingC }, ...]
       rejectedIds: ['zone_a', ...]     zones already refused this run
       rerankCount: 0                   how many times we went back
     }

     returns one of three verdicts, and nothing else ever:

       { verdict: 'forward', next: 'visualization',  zone,     reason }
       { verdict: 'rerank',  next: 'recommendation', rejected, reason }
       { verdict: 'stall',   next: null,                       reason }

     `reason` is written straight into agent_steps.refused_reason and
     read straight onto the screen, so it is written for a researcher,
     not for a log file.
     ------------------------------------------------------------------ */
  function decide(state) {
    var rejected = state.rejectedIds || [];
    var rerankCount = state.rerankCount || 0;
    var ranked = rankZones(state.zones, rejected);
    var top = ranked[0] || null;

    if (!top) {
      return {
        verdict: 'stall',
        next: null,
        ranked: ranked,
        reason: 'No planting zone in this area scored above ' + MIN_ZONE_SCORE +
                '/100, so there was nothing to rank. Nothing was written to the map.'
      };
    }

    var cooling = round1(top.projectedCoolingC);

    if (cooling >= IMPACT_FLOOR_C) {
      return {
        verdict: 'forward',
        next: 'visualization',
        zone: top,
        ranked: ranked,
        reason: top.name + ' projects ' + cooling.toFixed(1) + ' \u00B0C of cooling at ' +
                '24 months, at or above the ' + IMPACT_FLOOR_C.toFixed(1) +
                ' \u00B0C floor. Accepted.'
      };
    }

    if (rerankCount < MAX_RERANKS) {
      return {
        verdict: 'rerank',
        next: 'recommendation',
        rejected: top,
        ranked: ranked,
        reason: top.name + ' projects only ' + cooling.toFixed(1) + ' \u00B0C of cooling at ' +
                '24 months, below the ' + IMPACT_FLOOR_C.toFixed(1) + ' \u00B0C floor. ' +
                'Zone rejected. Ranking again without it.'
      };
    }

    return {
      verdict: 'stall',
      next: null,
      ranked: ranked,
      reason: 'No zone reached the ' + IMPACT_FLOOR_C.toFixed(1) + ' \u00B0C cooling floor ' +
              'after ' + MAX_RERANKS + ' re-ranks. The run stopped instead of ' +
              'recommending a zone that would not help. Nothing was written to the map.'
    };
  }

  return {
    IMPACT_FLOOR_C: IMPACT_FLOOR_C,
    MAX_RERANKS: MAX_RERANKS,
    MIN_ZONE_SCORE: MIN_ZONE_SCORE,
    round1: round1,
    rankZones: rankZones,
    decide: decide
  };
});


/* ===== agent/steps.js ===== */
/* =====================================================================
   THE SIX STEPS, AND THE ONE EDGE THAT GOES BACKWARDS.
   Owner: 04 · Automation and agents (Dana)

   `key` is not a label we chose for the screen. It is checked by the
   database:

     03-security/db/01_tables_rls.sql
       step_name text not null check (step_name in
         ('satellite_data','environmental_analysis','recommendation',
          'impact_prediction','visualization','reporting'))

   Invent a seventh name and agent_log_step throws. That is deliberate:
   the set of things this agent may claim to have done is fixed in the
   schema, not in the workflow.

   `tool` is the au-m5 answer. One line per step, and the limit is in
   ../docs/AU-M3-PROCESS.md and enforced where it is named below.
   ===================================================================== */

(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  if (root) { root.AgentSteps = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {

  var STEPS = [
    {
      key: 'satellite_data',
      label: 'Satellite data',
      tool: 'scene_index.search',
      /* THE APPROVED TOOL. Read only. It searches a stored scene index
         inside the Kuwait box (46.5-48.8 E, 28.5-30.1 N, DECISIONS D-3)
         and returns at most 20 scenes. It cannot command the satellite,
         cannot task a new capture, and cannot write anywhere. */
      limit: 'Reads a stored scene index inside Kuwait only. Returns at most 20 scenes. It never tasks the satellite and never writes.'
    },
    {
      key: 'environmental_analysis',
      label: 'Environmental analysis',
      tool: 'ndvi_thermal.summarise',
      limit: 'Computes NDVI and surface-temperature means over the scenes the previous step returned. No new data is fetched.'
    },
    {
      key: 'recommendation',
      label: 'Recommendation',
      tool: 'zone_ranker.rank',
      limit: 'Ranks candidate planting zones 0-100. It proposes. It never writes a result row and never approves anything.',
      /* the step the backwards edge returns to */
      loopTarget: true
    },
    {
      key: 'impact_prediction',
      label: 'Impact prediction',
      tool: 'impact_model.project',
      limit: 'Projects 24-month cooling and NDVI change for the top zone. Its output is the number the decision gate compares.',
      /* THE DECISION POINT HANGS OFF THIS STEP. See decision.js. */
      decisionGate: true
    },
    {
      key: 'visualization',
      label: 'Visualization',
      tool: 'geometry.write',
      limit: 'Writes zone polygons as results.geometry jsonb through agent_write_result. No file, no bucket, no image (DECISIONS D-2).'
    },
    {
      key: 'reporting',
      label: 'Reporting',
      tool: 'draft.compose',
      limit: 'Composes a draft narrative. It cannot create a report: generate_report is granted to authenticated, not to n8n.'
    }
  ];

  function byKey(key) {
    for (var i = 0; i < STEPS.length; i++) {
      if (STEPS[i].key === key) { return STEPS[i]; }
    }
    return null;
  }

  return { STEPS: STEPS, byKey: byKey };
});


/* ===== agent/run.js ===== */
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
    planRun: planRun
  };
});

/* ---- n8n tail -------------------------------------------------------
   Input item:  { run_id, objective, zones }
   Output:      one item per database call, in order, each shaped
                { rpc: "agent_log_step" | "agent_write_result" |
                       "agent_finish_run", args: { ... } }

   The next node POSTs each item to
     {{$env.SUPABASE_URL}}/rest/v1/rpc/{{ $json.rpc }}
   with {{ $json.args }} as the body. Three function names, no table
   URL, ever. See n8n/README.md.
   ------------------------------------------------------------------ */
const __g = globalThis;
const __in = $json;
const __plan = __g.AgentRun.planRun({
  runId: __in.run_id,
  objective: __in.objective,
  zones: __in.zones || []
});
return __plan.calls.map(function (c) { return { json: c }; });
