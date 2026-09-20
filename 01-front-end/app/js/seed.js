/* Seed data for the demo.
   Two researchers so the data-isolation demo works before Supabase exists.
   All coordinates are inside Kuwait (lat 28.5-30.1, lon 46.5-48.4).
   Every figure here is SAMPLE DATA. */

function _id(prefix) {
  return prefix + '_' + Math.random().toString(36).slice(2, 10);
}

function _iso(daysAgo, hour) {
  var d = new Date();
  d.setDate(d.getDate() - (daysAgo || 0));
  d.setHours(hour == null ? 10 : hour, 24, 0, 0);
  return d.toISOString();
}

/* Build five result zones inside a mission's area rectangle. */
function makeZones(mission) {
  var a = mission.area;
  var w = a.east - a.west;
  var h = a.north - a.south;

  var spec = [
    { name: 'Zone A — North corridor', level: 'high', score: 88,
      note: 'Highest projected benefit. Low existing canopy, road access on two sides, treated-water line within 3 km.' },
    { name: 'Zone B — Central basin', level: 'high', score: 81,
      note: 'Shallow depression retains runoff. Strong candidate for native shrub planting.' },
    { name: 'Zone C — South flats', level: 'medium', score: 67,
      note: 'Workable, but soil salinity in the sample scenes is higher than Zones A and B.' },
    { name: 'Zone D — East margin', level: 'medium', score: 59,
      note: 'Moderate benefit. Wind exposure would need a shelter belt first.' },
    { name: 'Zone E — West margin', level: 'low', score: 42,
      note: 'Lowest ranked. Thin soil cover and no nearby water line in the sample data.' }
  ];

  var cells = [
    [0.06, 0.55], [0.38, 0.55], [0.70, 0.55],
    [0.14, 0.10], [0.56, 0.10]
  ];

  return spec.map(function (s, i) {
    var fx = cells[i][0], fy = cells[i][1];
    var x0 = a.west + w * fx, y0 = a.south + h * fy;
    var x1 = x0 + w * 0.24, y1 = y0 + h * 0.33;
    return {
      id: _id('zone'),
      missionId: mission.id,
      name: s.name,
      level: s.level,
      score: s.score,
      note: s.note,
      polygon: [[y0, x0], [y0, x1], [y1, x1], [y1, x0]]
    };
  });
}

/* Build the report document from a mission, its agent runs and its zones. */
function makeReport(mission, runs, zones, user) {
  var sections = [];

  sections.push({
    heading: 'Research objective',
    body: mission.objective
  });

  sections.push({
    heading: 'Area of interest',
    body: 'Bounding box — N ' + mission.area.north.toFixed(2) +
          ' · S ' + mission.area.south.toFixed(2) +
          ' · E ' + mission.area.east.toFixed(2) +
          ' · W ' + mission.area.west.toFixed(2) +
          '. Selected by ' + (user ? user.name : 'the researcher') + ' on the mission map.'
  });

  runs.forEach(function (r) {
    var a = agentByKey(r.agentKey);
    sections.push({
      heading: a ? a.name : r.agentKey,
      body: (r.summary || '—') + ' ' + (a ? a.role : '')
    });
  });

  var ranked = zones.slice().sort(function (x, y) { return y.score - x.score; });
  sections.push({
    heading: 'Recommendations',
    body: ranked.map(function (z, i) {
      return (i + 1) + '. ' + z.name + ' (score ' + z.score + '/100, ' + z.level + ' priority). ' + z.note;
    }).join('\n')
  });

  sections.push({
    heading: 'Predicted impact',
    body: 'If the two highest-ranked zones are planted, the Impact Prediction agent projects a local ' +
          'surface temperature reduction of about 1.8 °C and an NDVI increase of about 0.21 over ' +
          '24 months, with the largest change in the first planting season. These are sample figures ' +
          'produced for a demonstration and must be re-derived from live data before any operational use.'
  });

  sections.push({
    heading: 'Researcher review',
    body: 'Reviewed and approved by ' + (user ? user.name + ', ' + user.org : 'the mission owner') +
          '. The agents produced this analysis; the researcher approved its release.'
  });

  return {
    id: _id('rep'),
    missionId: mission.id,
    generatedAt: new Date().toISOString(),
    sections: sections
  };
}

/* The full seeded database. */
function buildSeed() {
  var userA = {
    id: 'usr_a', email: 'researcher.a@kuwaitsat.kw', password: 'demo1234',
    name: 'Layla Al-Rashid', org: 'Kuwait Institute for Scientific Research',
    createdAt: _iso(40)
  };
  var userB = {
    id: 'usr_b', email: 'researcher.b@kuwaitsat.kw', password: 'demo1234',
    name: 'Omar Al-Sabah', org: 'Kuwait University',
    createdAt: _iso(30)
  };

  var missionA = {
    id: 'msn_jahra', ownerId: userA.id,
    title: 'Vegetation potential — Jahra corridor',
    objective: 'Identify areas in the Jahra corridor where increasing vegetation could improve ' +
               'environmental conditions, and rank them by expected cooling benefit.',
    area: { north: 29.62, south: 29.18, east: 47.91, west: 47.34 },
    status: 'complete', createdAt: _iso(3, 9), completedAt: _iso(3, 11)
  };

  var missionB = {
    id: 'msn_bay', ownerId: userB.id,
    title: 'Coastal turbidity baseline — Kuwait Bay',
    objective: 'Establish a turbidity baseline for Kuwait Bay across the winter months so later ' +
               'dredging activity can be compared against it.',
    area: { north: 29.55, south: 29.30, east: 48.20, west: 47.75 },
    status: 'draft', createdAt: _iso(1, 14), completedAt: null
  };

  var runsA = AGENTS.map(function (a, i) {
    return {
      id: _id('run'), missionId: missionA.id, agentKey: a.key, order: i + 1,
      status: 'complete', summary: a.summary, finishedAt: _iso(3, 10)
    };
  });

  var zonesA = makeZones(missionA);
  var reportA = makeReport(missionA, runsA, zonesA, userA);
  reportA.generatedAt = _iso(3, 11);

  return {
    version: 1,
    sessionUserId: null,
    users: [userA, userB],
    missions: [missionA, missionB],
    agentRuns: runsA,
    zones: zonesA,
    reports: [reportA]
  };
}
