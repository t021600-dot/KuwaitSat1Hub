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
