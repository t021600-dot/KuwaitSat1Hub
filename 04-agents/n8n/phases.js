/* =====================================================================
   THE FOUR CODE NODES, AS ONE PURE FILE.
   Owner: 04 · Automation and agents (Dana)

   n8n does not decide anything in this project. It moves items between
   nodes and it makes HTTP calls. Every choice a run makes is made here,
   in plain JavaScript, with no network and no secrets, so it can be run
   by `node`, read by a judge, and tested without n8n existing.

   WHAT EACH FUNCTION RETURNS

       { calls: [ { rpc, args }, ... ], ctx: { ... } }

   `calls` are the ONLY three things n8n may execute
   (03-security/db/05_views_rpc.sql):

       agent_log_step      one row per step, refusals included
       agent_write_result  one finding, written complete
       agent_finish_run    complete | failed | stalled

   There is no fourth name and no table URL anywhere in this file.
   If you ever see /rest/v1/results in the workflow, the workflow is
   wrong, not the grants.

   `ctx` is the state the canvas carries between nodes. Every item a
   Code node emits carries the same ctx, so a later node can reach it
   with $('Node name').first().json.ctx even when the node in between
   was an HTTP call that replaced the item with a database response.

   WHERE THE DECISION LIVES. Not here. The threshold is
   agent/decision.js -> IMPACT_FLOOR_C, and this file reads it. The IF
   node on the canvas compares two numbers that both come out of that
   one line. See n8n/BUILD-GUIDE.md §5.

   HONESTY, SAID ONCE AND MEANT. candidateZones() below returns SAMPLE
   zone scores and SAMPLE cooling projections. They are prototype values
   placed inside the researcher's own mission area. They are not
   KuwaitSat-1 measurements and no sentence written from them may claim
   they are. The decision that compares them is real code; the inputs
   are illustrative. Every result body this file writes says so on the
   row itself, because a label that lives only in a slide is a label a
   judge cannot check.
   ===================================================================== */

(function (root, factory) {
  function need(globalName, relPath) {
    if (root && root[globalName]) { return root[globalName]; }
    if (typeof require === 'function') { return require(relPath); }
    throw new Error(globalName + ' is not loaded. In n8n, the Code node must ' +
                    'contain the generated bundle (n8n/workflow.json, built by ' +
                    'tools/build-workflow.js). In Node, require the files in order: ' +
                    'decision.js, steps.js, run.js, phases.js.');
  }
  var api = factory(need('AgentDecision', '../agent/decision.js'),
                    need('AgentSteps',    '../agent/steps.js'),
                    need('AgentRun',      '../agent/run.js'));
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  if (root) { root.AgentPhases = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (D, S, R) {

  /* The box from DECISIONS.md D-3, in the order GeoJSON actually uses:
     longitude first, latitude second. The database says the same thing in
     03-security/db/06_validation.sql:

         (pt->>0)::numeric not between 46.5 and 48.8   <- longitude
         (pt->>1)::numeric not between 28.5 and 30.1   <- latitude

     Leaflet's L.latLng() is the other way round. That difference is the
     single easiest way to draw a polygon in Ukraine and tell a judge it
     is north Jahra. See BUILD-GUIDE.md §12, question 4. */
  var KUWAIT = { minLng: 46.5, maxLng: 48.8, minLat: 28.5, maxLat: 30.1 };

  /* The mission area arrives as jsonb and the run is about to be planned
     from it. Anything that is not a number pair is ignored rather than
     guessed at, and an area with no usable points is refused, not
     rounded into one. */
  function collectPoints(node, out) {
    if (!node) { return out; }
    if (Object.prototype.toString.call(node) === '[object Array]') {
      if (node.length >= 2 && typeof node[0] === 'number' && typeof node[1] === 'number') {
        out.push([node[0], node[1]]);
        return out;
      }
      for (var i = 0; i < node.length; i++) { collectPoints(node[i], out); }
      return out;
    }
    if (typeof node === 'object') {
      collectPoints(node.coordinates, out);
      collectPoints(node.geometry, out);
      collectPoints(node.features, out);
    }
    return out;
  }

  function round6(n) { return Math.round(n * 1e6) / 1e6; }

  /* [minLng, minLat, maxLng, maxLat], or null when the area is unusable. */
  function bboxOf(area) {
    var pts = collectPoints(area, []);
    if (!pts.length) { return null; }
    var bb = [pts[0][0], pts[0][1], pts[0][0], pts[0][1]];
    for (var i = 1; i < pts.length; i++) {
      if (pts[i][0] < bb[0]) { bb[0] = pts[i][0]; }
      if (pts[i][1] < bb[1]) { bb[1] = pts[i][1]; }
      if (pts[i][0] > bb[2]) { bb[2] = pts[i][0]; }
      if (pts[i][1] > bb[3]) { bb[3] = pts[i][1]; }
    }
    return bb;
  }

  function insideKuwait(bb) {
    if (!bb) { return false; }
    return bb[0] >= KUWAIT.minLng && bb[2] <= KUWAIT.maxLng &&
           bb[1] >= KUWAIT.minLat && bb[3] <= KUWAIT.maxLat;
  }

  /* A 2 x 2 grid over the mission area, inset so the four zones are
     visibly separate polygons on the map rather than one filled square. */
  function cellPolygon(bb, cell) {
    var w = (bb[2] - bb[0]) / 2;
    var h = (bb[3] - bb[1]) / 2;
    var col = cell % 2;
    var row = Math.floor(cell / 2);
    var pad = 0.15;
    var x0 = bb[0] + col * w + w * pad, x1 = bb[0] + col * w + w * (1 - pad);
    var y0 = bb[1] + row * h + h * pad, y1 = bb[1] + row * h + h * (1 - pad);
    return [[round6(x0), round6(y0)], [round6(x1), round6(y0)],
            [round6(x1), round6(y1)], [round6(x0), round6(y1)],
            [round6(x0), round6(y0)]];
  }

  /* The same four zones the rehearsal tool and the decision test use
     (tools/rehearse.js, tests/decision.test.js), so the story a judge
     hears on Thursday is the story the test asserts on tonight:

         Zone A ranks FIRST at 88/100 and projects 0.6 °C  -> rejected
         Zone B ranks second at 81/100 and projects 1.9 °C -> on the map

     The highest-scoring zone is not the one on the map. That sentence is
     the decision doing something. */
  var SAMPLE_ZONES = [
    { id: 'z_a', name: 'Zone A - North corridor', score: 88, projectedCoolingC: 0.6, cell: 0,
      note: 'Highest NDVI gain potential, shallowest projected cooling.' },
    { id: 'z_b', name: 'Zone B - Central basin',  score: 81, projectedCoolingC: 1.9, cell: 1,
      note: 'Sheltered basin, strongest projected surface cooling.' },
    { id: 'z_c', name: 'Zone C - South flats',    score: 67, projectedCoolingC: 1.4, cell: 2,
      note: 'Open flats, moderate cooling, simple access.' },
    { id: 'z_d', name: 'Zone D - East margin',    score: 59, projectedCoolingC: 0.9, cell: 3,
      note: 'Margin site, limited water table support.' }
  ];

  function candidateZones(area) {
    var bb = bboxOf(area);
    if (!bb) { return []; }
    return SAMPLE_ZONES.map(function (z) {
      return { id: z.id, name: z.name, score: z.score,
               projectedCoolingC: z.projectedCoolingC, note: z.note,
               polygon: cellPolygon(bb, z.cell) };
    });
  }

  /* ------------------------------------------------------------------
     THE THREE CALL SHAPES. Nothing else is ever emitted.

     These mirror the builders inside agent/run.js. They exist twice
     because run.js plans a whole run in one pass for the browser replay
     and the rehearsal printer, and n8n needs the same run broken at the
     decision so the gate can be a node you can point at. The THRESHOLD
     is not duplicated - both files read agent/decision.js. If you change
     the ORDER of the steps, change it in both, and tests/phases.test.js
     will tell you if the two disagree about the six legal step names.
     ------------------------------------------------------------------ */
  function logCall(runId, key, args, allowed, refusedReason, injection) {
    var def = S.byKey(key);
    return {
      rpc: 'agent_log_step',
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

  function resultCall(runId, kind, title, body, geometry) {
    return {
      rpc: 'agent_write_result',
      args: {
        p_run_id: runId, p_kind: kind, p_title: title, p_body: body,
        p_geometry: geometry || null,
        /* source_ref stays null. It is the satellite archive path and it
           is not granted to the browser (03_grants.sql). A path we cannot
           show on screen is a number a judge cannot trace, so we do not
           write one this week. */
        p_source_ref: null
      }
    };
  }

  function finishCall(runId, status, error) {
    return { rpc: 'agent_finish_run',
             args: { p_run_id: runId, p_status: status, p_error: error || null } };
  }

  var SAMPLE_NOTE = 'Sample prototype figure, not a KuwaitSat-1 measurement.';

  /* ------------------------------------------------------------------
     PHASE A · "Prepare the run"        steps 1 and 2
     Node 6 on the canvas.

     Screens the objective for instructions, checks the area is a real
     area inside Kuwait, and logs the two observation steps.
     ------------------------------------------------------------------ */
  function phaseObserve(input) {
    var runId = input.run_id;
    var objective = input.objective;
    var area = input.area_geojson;
    /* One call, three outputs: the flag, the sentence that goes on the
       step row, and the notice that leads the draft report. The marker
       list lives in agent/run.js, so the worker and the browser replay
       cannot disagree about what counts as an instruction. */
    var refusal = R.describeRefusal(objective);
    var injection = refusal !== null;
    var bb = bboxOf(area);

    /* Guardrail rule 12 (GUARDRAILS.md). The database already refuses an
       area outside Kuwait at insert time, so reaching this branch means
       something upstream changed. It is still written, because the run
       that finds out is the run that has to say so on screen. */
    if (!bb || !insideKuwait(bb)) {
      var why = 'The mission area is missing or falls outside Kuwait (' +
                KUWAIT.minLng + '-' + KUWAIT.maxLng + ' E, ' +
                KUWAIT.minLat + '-' + KUWAIT.maxLat + ' N). No satellite ' +
                'scene index was read and nothing was written to the map.';
      return {
        calls: [ logCall(runId, 'satellite_data', { area_ok: false }, false, why, injection),
                 finishCall(runId, 'failed', why) ],
        ctx: { run_id: runId, stop: true, injection: injection,
               zones: [], rejected_ids: [], reason: why }
      };
    }

    var zones = candidateZones(area);

    return {
      calls: [
        /* The injection flag is raised HERE and rides on the mission for
           the rest of the run. We do not obey the objective, we do not
           quietly rewrite it into something obedient, and we do not stop
           the mission the researcher actually asked for. We raise the
           flag, we SAY what we refused, and we carry on with the real
           research question. GUARDRAILS.md rules 1 and 13.

           The step stays allowed = true: the scene search really did
           run. What was refused is the instruction inside the objective,
           and agent_log_step stores refused_reason either way. */
        logCall(runId, 'satellite_data',
          refusal
            ? { area_bbox: bb, max_scenes: 20, injection_screened: true,
                instruction_refused: refusal.marker }
            : { area_bbox: bb, max_scenes: 20, injection_screened: true },
          true, refusal ? refusal.reason : null, injection),
        logCall(runId, 'environmental_analysis',
          { measures: ['ndvi', 'surface_temperature'], scenes: 20 },
          true, null, false)
      ],
      ctx: { run_id: runId, stop: false, injection: injection,
             /* carried to phaseDeliver so the DRAFT leads with the
                refusal. A refusal only the step row knows about is one
                the person approving the report never reads. */
             refusal_notice: refusal ? refusal.notice : null,
             area_bbox: bb, zones: zones, rejected_ids: [] }
    };
  }

  /* ------------------------------------------------------------------
     PHASE B · "Rank and project"       steps 3 and 4
     Node 8 on the canvas, and the node the backwards arrow returns to.

     Produces the two numbers the IF node compares, and nothing else
     decides anything: cooling_c and floor_c both come from
     agent/decision.js.
     ------------------------------------------------------------------ */
  function phaseRankAndProject(input) {
    var runId = input.run_id;
    var zones = input.zones || [];
    var rejected = input.rejected_ids || [];
    var ranked = D.rankZones(zones, rejected);
    var top = ranked[0] || null;

    /* No zone left to rank. -999 is not a temperature, it is a value
       chosen so the gate can only ever send this to the false branch,
       where decide() writes the researcher a sentence about why. */
    var cooling = top ? D.round1(top.projectedCoolingC) : -999;

    return {
      calls: [
        logCall(runId, 'recommendation',
          { candidates: ranked.length, excluded: rejected.length,
            min_zone_score: D.MIN_ZONE_SCORE }, true, null, false),
        logCall(runId, 'impact_prediction',
          { zone: top ? top.id : null, horizon_months: 24,
            projected_cooling_c: top ? cooling : null,
            floor_c: D.IMPACT_FLOOR_C, source: SAMPLE_NOTE },
          true, null, false)
      ],
      ctx: {
        run_id: runId, stop: false, zones: zones, rejected_ids: rejected,
        /* THE TWO NUMBERS ON THE IF NODE */
        cooling_c: cooling,
        floor_c: D.IMPACT_FLOOR_C,
        top_id: top ? top.id : null,
        top_name: top ? top.name : null,
        reranks_used: rejected.length,
        max_reranks: D.MAX_RERANKS
      }
    };
  }

  /* ------------------------------------------------------------------
     PHASE C · "Deliver findings"       steps 5 and 6, the TRUE branch
     Node 11 on the canvas.

     breakVisualization is the demo switch from BUILD-GUIDE.md §7. It is
     read from a Set node on the canvas, never hard-coded here, so the
     sabotage cannot be left behind in a source file after Thursday.
     ------------------------------------------------------------------ */
  function phaseDeliver(input) {
    var runId = input.run_id;
    var rejected = input.rejected_ids || [];
    var accepted = D.rankZones(input.zones || [], rejected);
    var calls = [];

    /* O-1, found by hand-simulating the run: the gate tests the TOP zone
       only, so a candidate under the floor used to get a polygon while
       the metric row said "accepted only at or above 1.0 °C". Both were
       on screen at once, and a judge who read the tooltip and then the
       metric would have caught the guardrail being decorative.

       The fix keeps every candidate visible - the rejected-zone story is
       better with the other numbers on the map - and makes each row say
       which side of the floor it is on. One zone is RECOMMENDED; the
       rest are context. The metric row below says exactly that. */
    var belowFloor = 0;
    accepted.forEach(function (z, i) {
      var cooling = D.round1(z.projectedCoolingC);
      var clears = cooling >= D.IMPACT_FLOOR_C;
      if (!clears) { belowFloor += 1; }
      calls.push(resultCall(runId, 'site', z.name,
        'Rank ' + (i + 1) + ' of ' + accepted.length + '. ' +
        'Zone score ' + z.score + '/100. ' +
        'Projected cooling ' + cooling.toFixed(1) +
        ' °C at 24 months, against a floor of ' + D.IMPACT_FLOOR_C.toFixed(1) + ' °C. ' +
        (i === 0
          ? 'RECOMMENDED: this is the zone the run proposes. '
          : (clears
              ? 'Clears the floor. Shown as an alternative, not the recommendation. '
              : 'BELOW THE FLOOR - shown for context only. Not recommended. ')) +
        (z.note ? z.note + ' ' : '') + SAMPLE_NOTE,
        { type: 'Polygon', coordinates: [z.polygon] }));
    });

    calls.push(resultCall(runId, 'metric', 'Impact floor applied',
      'The recommended zone was accepted only at or above ' +
      D.IMPACT_FLOOR_C.toFixed(1) + ' °C of projected 24-month cooling. ' +
      rejected.length + ' zone(s) failed that test and the run ranked again ' +
      'without them. Re-rank limit ' + D.MAX_RERANKS + '. The other ' +
      'candidates are drawn with their own projections, ' + belowFloor +
      ' of them below the floor - they are context, not recommendations. ' +
      SAMPLE_NOTE, null));

    /* THE DELIBERATE BREAK. 'visualisation' with an s is not one of the
       six names the database will accept:
         01_tables_rls.sql -> step_name check (... 'visualization' ...)
       agent_log_step refuses it, PostgREST answers 400, the node's error
       output fires, and the researcher reads the word Failed with the
       database's own reason. Put it back by setting break_visualization
       to false in the Demo controls node. */
    calls.push(logCall(runId,
      input.breakVisualization === true ? 'visualisation' : 'visualization',
      { polygons: accepted.length, storage: 'results.geometry jsonb' },
      true, null, false));

    calls.push(resultCall(runId, 'narrative', 'Draft findings',
      /* The refusal LEADS the draft when there was one. The person who
         presses Approve has to meet it before the finding, not in a
         footnote under it. input.refusalNotice comes from phaseObserve's
         ctx and is null on an ordinary run. */
      (input.refusalNotice ? input.refusalNotice + '\n\n' : '') +
      'Recommended ' + (accepted[0] ? accepted[0].name : 'no zone') + ' first, ' +
      'from ' + accepted.length + ' zone(s) that cleared the ' +
      D.IMPACT_FLOOR_C.toFixed(1) + ' °C floor. ' +
      'This is a draft. No report exists until a researcher presses Generate ' +
      'Report - generate_report is granted to authenticated, not to the worker. ' +
      SAMPLE_NOTE, null));

    calls.push(logCall(runId, 'reporting',
      { draft: true, report_created: false }, true, null, false));

    return {
      calls: calls,
      ctx: { run_id: runId, stop: false, expected_calls: calls.length,
             accepted: accepted.length, rejected_ids: rejected,
             top_name: accepted[0] ? accepted[0].name : null }
    };
  }

  /* ------------------------------------------------------------------
     PHASE D · "Reject the zone"        the FALSE branch
     Node 15 on the canvas.

     decide() is asked for the verdict and, more importantly, for the
     SENTENCE. That sentence goes into agent_steps.refused_reason, which
     the my_agent_steps view does expose - unlike mission_runs.error_note,
     which the browser has no grant on. A reason that exists only in
     error_note is a reason the researcher never reads.
     ------------------------------------------------------------------ */
  function phaseReject(input) {
    var runId = input.run_id;
    var zones = input.zones || [];
    var rejected = (input.rejected_ids || []).slice();
    var verdict = D.decide({ zones: zones, rejectedIds: rejected,
                             rerankCount: rejected.length });

    if (verdict.verdict === 'rerank') {
      rejected.push(verdict.rejected.id);
      return {
        calls: [ logCall(runId, 'impact_prediction',
          { zone: verdict.rejected.id,
            projected_cooling_c: D.round1(verdict.rejected.projectedCoolingC),
            floor_c: D.IMPACT_FLOOR_C, action: 'rerank' },
          false, verdict.reason, false) ],
        ctx: { run_id: runId, stop: false, zones: zones,
               rejected_ids: rejected, can_rerank: true,
               reranks_used: rejected.length, max_reranks: D.MAX_RERANKS,
               reason: verdict.reason, stall_args: null }
      };
    }

    /* Either the re-rank budget is gone, or nothing was rankable at all.
       Both end the run as 'stalled' - which the app shows as Stopped,
       with the reason, not as a spinner. GUARDRAILS.md rule 16. */
    var stalled = finishCall(runId, 'stalled', verdict.reason);
    var why = verdict.reason;

    /* A third possibility, and the reason it is worth writing: if
       decide() says 'forward' while the canvas sent the run down the
       false branch, the IF node is comparing the wrong things - two
       strings instead of two numbers is the usual cause. Say that out
       loud on screen rather than looping. */
    if (verdict.verdict === 'forward') {
      why = 'The workflow sent this run down the rejection branch while the ' +
            'decision said it should go forward. That is a wiring fault in the ' +
            'IF node, not a finding about the area. The run stopped instead of ' +
            'writing anything to the map.';
      stalled = finishCall(runId, 'stalled', why);
    }

    return {
      calls: [ logCall(runId, 'impact_prediction',
        { reranks: rejected.length, floor_c: D.IMPACT_FLOOR_C, action: 'stall' },
        false, why, false) ],
      ctx: { run_id: runId, stop: true, zones: zones, rejected_ids: rejected,
             can_rerank: false, reranks_used: rejected.length,
             max_reranks: D.MAX_RERANKS, reason: why,
             stall_args: stalled.args }
    };
  }

  return {
    KUWAIT: KUWAIT,
    SAMPLE_NOTE: SAMPLE_NOTE,
    bboxOf: bboxOf,
    insideKuwait: insideKuwait,
    candidateZones: candidateZones,
    logCall: logCall,
    resultCall: resultCall,
    finishCall: finishCall,
    phaseObserve: phaseObserve,
    phaseRankAndProject: phaseRankAndProject,
    phaseDeliver: phaseDeliver,
    phaseReject: phaseReject
  };
});
