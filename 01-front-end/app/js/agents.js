/* The six agents, in fixed order.
   Every number below is SAMPLE DATA for the demo. Nothing here is a real
   KuwaitSat-1 measurement. */

const AGENTS = [
  {
    key: 'satellite_data',
    name: 'Satellite Data Agent',
    role: 'Collects the imagery for the selected area.',
    summary: 'Retrieved 14 KuwaitSat-1 scenes covering the selected area.'
  },
  {
    key: 'environmental',
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
    key: 'impact',
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
    role: 'Assembles the draft report for researcher approval.',
    summary: 'Draft report assembled. Awaiting researcher approval.'
  }
];

function agentByKey(key) {
  return AGENTS.find(function (a) { return a.key === key; }) || null;
}
