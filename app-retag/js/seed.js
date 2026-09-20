/* Seed data for DEMO MODE ONLY (used when no Supabase project is connected).
   Two researchers so the screens have something to draw before the project
   exists. Every figure here is SAMPLE DATA.

   >>> THERE IS NO PASSWORD FIELD IN THIS FILE, AND THERE NEVER WILL BE. <<<
   se-m3: Supabase Auth holds the password hash in auth.users. We never copy
   it, never store one of our own, and never print one on a screen. Demo mode
   therefore cannot check a password — it only pretends to have a session, and
   the footer says so in plain language on every page.

   Shapes here match exactly what the live Supabase path returns, so a screen
   cannot accidentally work in demo mode and break against the database. */

/* Demo ids are uuid-shaped because every id in the schema is a uuid (D-4).
   A demo url must look like the real one or the "paste the other
   researcher's link" test proves nothing. */
function _uuid() {
  if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function _iso(daysAgo, hour) {
  var d = new Date();
  d.setDate(d.getDate() - (daysAgo || 0));
  d.setHours(hour == null ? 10 : hour, 24, 0, 0);
  return d.toISOString();
}

/* Five result rows inside a mission's area, in the shape the results table
   stores them: kind / title / body / geometry, geometry being a GeoJSON
   Polygon in [lng, lat] order with a closed ring. */
function makeResults(mission, runId) {
  var a = mission.area;
  var w = a.east - a.west;
  var h = a.north - a.south;

  var spec = [
    { title: 'Zone A — North corridor', score: 88,
      note: 'Low existing canopy, road access on two sides, treated-water line within 3 km.' },
    { title: 'Zone B — Central basin', score: 81,
      note: 'Shallow depression retains runoff. Strong candidate for native shrub planting.' },
    { title: 'Zone C — South flats', score: 67,
      note: 'Workable, but soil salinity in the sample scenes is higher than Zones A and B.' },
    { title: 'Zone D — East margin', score: 59,
      note: 'Moderate benefit. Wind exposure would need a shelter belt first.' },
    { title: 'Zone E — West margin', score: 42,
      note: 'Lowest ranked. Thin soil cover and no nearby water line in the sample data.' }
  ];

  var cells = [
    [0.06, 0.55], [0.38, 0.55], [0.70, 0.55],
    [0.14, 0.10], [0.56, 0.10]
  ];

  var rows = spec.map(function (s, i) {
    var x0 = a.west + w * cells[i][0], y0 = a.south + h * cells[i][1];
    var x1 = x0 + w * 0.24, y1 = y0 + h * 0.33;
    return {
      id: _uuid(),
      missionId: mission.id,
      runId: runId,
      kind: 'site',
      title: s.title,
      body: 'Rank ' + (i + 1) + ' of ' + spec.length + '. Zone score ' + s.score +
            '/100. ' + s.note + ' Sample data — not a KuwaitSat-1 measurement.',
      // [lng, lat], ring closed by repeating the first point.
      geometry: {
        type: 'Polygon',
        coordinates: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]]
      },
      createdAt: _iso(3, 10)
    };
  });

  rows.push({
    id: _uuid(),
    missionId: mission.id,
    runId: runId,
    kind: 'narrative',
    title: 'Draft findings',
    body: 'Recommended ' + spec[0].title + ' first, from ' + spec.length +
          ' zones that cleared the projected cooling floor. This is a draft: no report ' +
          'exists until a researcher presses Generate Report. Sample data — not a ' +
          'KuwaitSat-1 measurement.',
    geometry: null,
    createdAt: _iso(3, 10)
  });

  return rows;
}

/* The report body. PLAIN TEXT, not markdown and not HTML (DECISIONS D-2):
   report.html prints it with textContent, so whatever an agent wrote can only
   ever be read as words. The same builder runs in live mode, and its output
   is what goes to generate_report(p_mission_id, p_body_md). */
function makeReportBody(mission, results, user) {
  var lines = [];
  var sites = results.filter(function (r) { return r.kind === 'site'; });

  lines.push(mission.title);
  lines.push('');
  lines.push('RESEARCH OBJECTIVE');
  lines.push(mission.objective);
  lines.push('');
  lines.push('AREA OF INTEREST');
  lines.push(boundsText(mission.area) + ' — approx. ' +
             areaKm2(mission.area).toLocaleString('en-GB') + ' km². Selected by ' +
             ((user && user.name) ? user.name : 'the researcher') + ' on the mission map.');
  lines.push('');
  lines.push('AGENT STEPS');
  AGENTS.forEach(function (a, i) {
    lines.push((i + 1) + '. ' + a.name + ' — ' + a.role);
  });
  lines.push('');
  lines.push('FINDINGS');
  if (sites.length === 0) {
    lines.push('No mapped sites were written for this mission.');
  } else {
    sites.forEach(function (r, i) {
      lines.push((i + 1) + '. ' + r.title);
      lines.push('   ' + (r.body || ''));
    });
  }
  results.filter(function (r) { return r.kind !== 'site'; }).forEach(function (r) {
    lines.push('');
    lines.push((KIND_LABELS[r.kind] || r.kind).toUpperCase() + ' — ' + r.title);
    lines.push(r.body || '');
  });
  lines.push('');
  lines.push('RESEARCHER REVIEW');
  lines.push('Reviewed and approved by ' +
             ((user && user.name) ? user.name : 'the mission owner') +
             ((user && user.org) ? ', ' + user.org : '') +
             '. The agents produced this analysis; the researcher approved its release.');
  lines.push('');
  lines.push('All figures above are sample data produced for a demonstration and must be ' +
             're-derived from live data before any operational use.');

  return lines.join('\n');
}

/* The full seeded demo database. No password column anywhere. */
function buildSeed() {
  var userA = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'researcher.a@kuwaitsat.kw',
    name: 'Layla Al-Rashid', org: 'Kuwait Institute for Scientific Research',
    createdAt: _iso(40)
  };
  var userB = {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'researcher.b@kuwaitsat.kw',
    name: 'Omar Al-Sabah', org: 'Kuwait University',
    createdAt: _iso(30)
  };

  var missionA = {
    id: '33333333-3333-4333-8333-333333333333',
    researcherId: userA.id,
    title: 'Vegetation potential — Jahra corridor',
    objective: 'Identify areas in the Jahra corridor where increasing vegetation could improve ' +
               'environmental conditions, and rank them by expected cooling benefit.',
    area: { north: 29.62, south: 29.18, east: 47.91, west: 47.34 },
    status: 'complete', injectionFlag: false,
    createdAt: _iso(3, 9), launchedAt: _iso(3, 9)
  };

  var missionB = {
    id: '44444444-4444-4444-8444-444444444444',
    researcherId: userB.id,
    title: 'Coastal turbidity baseline — Kuwait Bay',
    objective: 'Establish a turbidity baseline for Kuwait Bay across the winter months so later ' +
               'dredging activity can be compared against it.',
    area: { north: 29.55, south: 29.30, east: 48.20, west: 47.75 },
    status: 'draft', injectionFlag: false,
    createdAt: _iso(1, 14), launchedAt: null
  };

  // One run per launch, exactly as mission_runs records it.
  var runA = {
    id: '55555555-5555-4555-8555-555555555555',
    missionId: missionA.id, status: 'complete',
    startedAt: _iso(3, 9), finishedAt: _iso(3, 10), toolCalls: AGENTS.length
  };

  // One agent_steps row per agent, using the six step_name values the
  // database CHECK constraint accepts.
  var stepsA = AGENTS.map(function (a) {
    return {
      id: _uuid(), runId: runA.id, stepName: a.key,
      status: 'complete', allowed: true, refusedReason: null, injectionFlag: false,
      startedAt: _iso(3, 9), finishedAt: _iso(3, 10)
    };
  });

  var resultsA = makeResults(missionA, runA.id);

  var reportA = {
    id: '66666666-6666-4666-8666-666666666666',
    missionId: missionA.id,
    bodyMd: makeReportBody(missionA, resultsA, userA),
    approvedBy: userA.id,
    approvedAt: _iso(3, 11)
  };

  return {
    version: 2,
    sessionUserId: null,
    users: [userA, userB],
    missions: [missionA, missionB],
    runs: [runA],
    steps: stepsA,
    results: resultsA,
    reports: [reportA]
  };
}
