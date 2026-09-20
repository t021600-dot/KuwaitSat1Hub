/* The six agents, in fixed order.

   WHY THE KEYS LOOK LIKE THIS: `key` is not ours to choose. It is written
   into agent_steps.step_name, and 01_tables_rls.sql has a CHECK constraint
   that accepts exactly these six spellings:
     satellite_data, environmental_analysis, recommendation,
     impact_prediction, visualization, reporting
   Anything else (even 'visualisation' with an s) is refused by the database,
   so the step never appears and the strip stalls with no explanation.

   `summary` is SAMPLE DATA, shown only in demo mode. A live run has no
   summary column — the database gives us a status and, if the agent was
   refused, a reason. */

const AGENTS = [
  {
    key: 'satellite_data',
    name: 'Satellite Data Agent',
    role: 'Collects the imagery for the selected area.',
    summary: 'Retrieved 14 KuwaitSat-1 scenes covering the selected area.'
  },
  {
    key: 'environmental_analysis',
    name: 'Environmental Analysis',
    role: 'Reads vegetation and surface temperature signals.',
    summary: 'Mean NDVI 0.12 · surface temperature anomaly +2.4 °C across 3 zones.'
  },
  {
    key: 'recommendation',
    name: 'Recommendation',
    role: 'Ranks where intervention would help most.',
    summary: '3 candidate zones ranked for vegetation intervention.'
  },
  {
    key: 'impact_prediction',
    name: 'Impact Prediction',
    role: 'Projects the effect of acting on the recommendation.',
    summary: 'Projected −1.8 °C local cooling and +0.21 NDVI over 24 months.'
  },
  {
    key: 'visualization',
    name: 'Visualization',
    role: 'Draws the result zones on the map.',
    summary: '5 result polygons rendered on the area map.'
  },
  {
    key: 'reporting',
    name: 'Reporting',
    role: 'Assembles the draft findings for researcher approval.',
    summary: 'Draft findings assembled. Awaiting researcher approval.'
  }
];

function agentByKey(key) {
  return AGENTS.find(function (a) { return a.key === key; }) || null;
}
