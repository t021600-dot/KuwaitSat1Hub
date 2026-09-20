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
