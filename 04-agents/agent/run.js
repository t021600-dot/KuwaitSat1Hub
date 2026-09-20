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
   (../app/demo.html, which fakes the DATABASE and drives the real panel)
   without any of those three re-implementing the order of the run.
   One order, one file.

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
    'ignore all previous', 'ignore previous', 'disregard the', 'system prompt',
    'you are now', 'act as', 'reveal your', 'print your instructions',
    'drop table', 'send an email', 'call the webhook'
  ];
  /* Longest phrase first inside a family, on purpose. 'ignore previous'
     would also match the attack objective, and then the refusal on screen
     would name a marker narrower than the thing it actually caught. */

  /* How much of the objective we quote back on screen. Long enough for a
     judge to recognise the attack they typed, short enough that a
     1,500-character objective cannot push the step description off the
     strip. */
  var QUOTE_MAX = 92;

  /* ------------------------------------------------------------------
     describeRefusal · guardrail rules 1 and 13 in one function, because
     the two halves of the break test fail separately:

       (a) the guardrail HOLDS - the instruction is not carried out and
           the mission is flagged;
       (b) the app SAYS WHAT IT REFUSED TO DO - a sentence, on our own
           screen, naming the thing it would not do.

     Raising missions.injection_flag satisfies (a). On its own it fails
     (b): a chip reading "Objective flagged" tells a judge something was
     caught, never what. So this returns the SENTENCES as well, and every
     caller puts them where the researcher can read them:

       reason -> agent_steps.refused_reason (the my_agent_steps view
                 exposes it; mission_runs.error_note does not reach the
                 browser at all)
       notice -> the first line of the draft report
       quote  -> the researcher's own words, bounded

     Returns null for an ordinary research question.
     ------------------------------------------------------------------ */
  function describeRefusal(objective) {
    var raw = String(objective || '');
    var lower = raw.toLowerCase();

    for (var i = 0; i < INSTRUCTION_MARKERS.length; i++) {
      var at = lower.indexOf(INSTRUCTION_MARKERS[i]);
      if (at === -1) { continue; }

      /* Quote from where the instruction starts, stop at the end of that
         line, and never run past QUOTE_MAX. We slice the ORIGINAL text,
         not the lowercased copy, so the screen shows what was typed. */
      var quote = raw.slice(at, at + QUOTE_MAX + 40).split('\n')[0]
                     .replace(/\s+/g, ' ').trim();
      if (quote.length > QUOTE_MAX) {
        quote = quote.slice(0, QUOTE_MAX - 1).trim() + '…';
      }

      return {
        marker: INSTRUCTION_MARKERS[i],
        quote: quote,

        /* Written for a researcher, not for a log file - it is displayed
           verbatim on the step row. The instruction is only ever inside
           quotation marks, and the sentence around it says what was NOT
           done, so nothing downstream can read this as a command. */
        reason: 'Refused an instruction found inside the research objective: ' +
                '“' + quote + '”. It was not carried out. A mission ' +
                'objective is data, not a command.',

        /* The draft report leads with this, so the refusal is the first
           thing the human approver reads. */
        notice: 'REFUSED: the objective contained an instruction (“' + quote +
                '”). It was not carried out, and nothing outside this ' +
                'mission was read. The findings below answer the research ' +
                'question that was in the objective.'
      };
    }
    return null;
  }

  function looksLikeInstruction(objective) {
    return describeRefusal(objective) !== null;
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
    var refusal = describeRefusal(input.objective);   /* null when clean */
    var injection = refusal !== null;

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
       and it rides on the mission for the rest of the run.

       The step itself stays ALLOWED. The satellite step really did run;
       what was refused is the instruction inside the objective, and
       agent_log_step stores refused_reason either way. Marking the step
       refused would say the scene search failed, which is not true. */
    push(logStep(runId, 'satellite_data',
      refusal
        ? { area: 'mission area', max_scenes: 20,
            instruction_refused: refusal.marker }
        : { area: 'mission area', max_scenes: 20 },
      true, refusal ? refusal.reason : null, injection));

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
    /* O-1: the gate tests the TOP zone only, so a candidate under the
       floor still gets a polygon. Keeping them is the better story - but
       then every row has to say which side of the floor it is on, or the
       map and the metric row contradict each other on screen. Same fix,
       same words, as n8n/phases.js -> phaseDeliver(). */
    var accepted = D.rankZones(zones, rejectedIds);
    var belowFloor = 0;
    accepted.forEach(function (z, i) {
      var cooling = D.round1(z.projectedCoolingC);
      var clears = cooling >= D.IMPACT_FLOOR_C;
      if (!clears) { belowFloor += 1; }
      push(writeResult(runId, 'site',
        z.name,
        'Rank ' + (i + 1) + ' of ' + accepted.length + '. Score ' + z.score + '/100. ' +
        'Projected cooling ' + cooling.toFixed(1) + ' °C at 24 months. ' +
        (i === 0
          ? 'RECOMMENDED: this is the zone the run proposes. '
          : (clears
              ? 'Clears the floor. Shown as an alternative, not the recommendation. '
              : 'BELOW THE FLOOR - shown for context only. Not recommended. ')) +
        (z.note || ''),
        z.polygon ? { type: 'Polygon', coordinates: [z.polygon] } : null));
    });
    push(writeResult(runId, 'metric',
      'Impact floor applied',
      'The recommended zone was accepted only at or above ' +
      D.IMPACT_FLOOR_C.toFixed(1) + ' °C of projected 24-month cooling. ' +
      rejectedIds.length + ' zone(s) failed that test and were re-ranked out. ' +
      'The other candidates are drawn with their own projections, ' + belowFloor +
      ' of them below the floor - context, not recommendations. ' +
      'Sample figures, not measurements.',
      null));

    push(logStep(runId, 'visualization',
      { polygons: accepted.length }, true, null, false));

    /* STEP 6 - a draft, and only a draft. The report itself needs a
       human: generate_report is granted to authenticated, not to n8n. */
    push(writeResult(runId, 'narrative',
      'Draft findings',
      /* The refusal LEADS the draft. A human approving a report has to
         read what the agent refused to do before they read the finding,
         not after it - so it goes first, not in a footnote. */
      (refusal ? refusal.notice + '\n\n' : '') +
      'Recommended ' + (accepted[0] ? accepted[0].name : 'no zone') + ' first. ' +
      'Awaiting researcher approval. No report exists until a researcher presses Generate Report.',
      null));
    push(logStep(runId, 'reporting', { draft: true }, true, null, false));

    push(finishRun(runId, 'complete', null));

    return { calls: calls, outcome: 'complete', decisions: decisions, reranks: rerankCount };
  }

  return {
    STEP_BUDGET: STEP_BUDGET,
    INSTRUCTION_MARKERS: INSTRUCTION_MARKERS,
    describeRefusal: describeRefusal,
    looksLikeInstruction: looksLikeInstruction,
    planRun: planRun
  };
});
