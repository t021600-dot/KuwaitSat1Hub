/* =====================================================================
   KuwaitSat-1 Mission Hub · 04 · Automation and agents
   THE WORKER LOGIC — one file, pure, no network, no secrets, no imports.

   This file decides. It never talks to anything. The runtime around it
   (n8n Code node, or the Edge Function fallback in worker/edge/) does
   every HTTP call, and it can only call the four functions that
   03 · Security granted to service_role:

       agent_claim_run()     read one queued run   (REQUESTED — see db/)
       agent_log_step()      write one step row
       agent_write_result()  write one finding
       agent_finish_run()    close the run

   Keeping the decisions here and the calls out there is why the same
   logic runs in n8n and in an Edge Function without being rewritten.
   See docs/DECISION-A1-ENGINE.md.

   >>> HOW TO PASTE THIS INTO AN n8n CODE NODE:
   >>> copy the whole file EXCEPT the last line (the `export`), then add
   >>> the three-line tail printed in worker/n8n/WORKFLOW.md, node 4.

   EVERY NUMBER BELOW IS INVENTED SAMPLE DATA. There is no KuwaitSat-1
   feed in this build and this file does not pretend there is one. The
   scene catalogue is generated from the area the researcher drew, so the
   same mission always produces the same figures — which is what makes
   "where did that number come from" answerable on stage.
   ===================================================================== */

/* ---------------------------------------------------------------------
   1 · THE NUMBERS. Every guardrail with a figure in GUARDRAILS.md points
   at a line in this block, or at the SQL named beside it.
   --------------------------------------------------------------------- */
const LIMITS = {
  // hard, enforced in the database — we stay well under both
  TOOL_CALL_BUDGET: 40,        // agent_log_step: 'Step budget exhausted.'
  RESULT_BODY_MAX: 20000,      // agent_write_result: 'Result body too long.'
  OBJECTIVE_MAX: 1500,         // missions_objective_len CHECK

  // ours, enforced here
  PLANNED_TOOL_CALLS: 10,      // what one healthy run actually spends
  RUN_MAX_SECONDS: 120,        // past this the runtime finishes 'stalled'
  MIN_USABLE_SCENES: 3,        // ← THE DECISION, left half
  MAX_CLOUD_PCT: 20,           // a scene above this is not usable
  NDVI_BAR: 0.15,              // ← THE DECISION, right half: dry enough
  TEMP_ANOMALY_BAR: 1.5,       // ← ...and hot enough (°C)
  KM2_PER_SCENE: 300,          // how many scenes cover a drawn area
  MAX_ZONES: 3                 // we never propose more than three
};

/* Kuwait, as 03 · Security wrote it into kuwait_area_ok() (06_validation.sql).
   The database already refused anything outside this before the mission
   row existed. We re-check because a guardrail you only enforce in one
   place is a guardrail you cannot demonstrate. */
const KUWAIT = { west: 46.5, east: 48.8, south: 28.5, north: 30.1 };

/* The only six step names the database will accept (agent_steps CHECK). */
const STEPS = ['satellite_data', 'environmental_analysis', 'recommendation',
               'impact_prediction', 'visualization', 'reporting'];

/* ---------------------------------------------------------------------
   2 · GUARDRAIL 4 · the objective is DATA, never instructions.
   ─────────────────────────────────────────────────────────────────────
   >>> THIS IS RULE 4 VERSION 1 AND IT IS EXPECTED TO BE WRONG. <<<
   The rehearsal in GUARDRAILS.md is built to break it with a LEGITIMATE
   research objective ("show me every area north of Jahra where vegetation
   declined since 2023" trips the last pattern below). Run the rehearsal,
   write down what really happened, and only then apply the v2 pattern in
   worker/n8n/WORKFLOW.md §5. Patch it first and you have nothing true to
   say when a judge asks which rule your rehearsal changed.
   --------------------------------------------------------------------- */
const INJECTION_PATTERNS_V1 = [
  /ignore\s+(all\s+|any\s+|the\s+)?(previous|prior|above|earlier)/i,
  /disregard\s+(all\s+|any\s+|the\s+)?(previous|prior|above|rules|instructions)/i,
  /(system\s+prompt|developer\s+message|your\s+instructions|your\s+rules)/i,
  /\b(you\s+must|you\s+should\s+now|from\s+now\s+on\s+you)\b/i,
  /(other|another|every|all)\s+researcher'?s?\b/i,
  /(service[_\s-]?role|api\s+key|secret\s+key|publishable\s+key|bypass)/i,
  /\b(drop|delete|truncate|update)\s+(table|from|missions|reports|results)\b/i,
  /\b(show|list|give|tell)\s+me\s+(all|every|each)\b/i   // ← R breaks this one
];

function detectInjection(objective) {
  const text = String(objective || '');
  for (let i = 0; i < INJECTION_PATTERNS_V1.length; i++) {
    const m = text.match(INJECTION_PATTERNS_V1[i]);
    if (m) {
      return {
        flagged: true,
        rule: 'G-4',
        matched: m[0].slice(0, 60),
        reason: 'The objective contains an instruction to the system ' +
                '("' + m[0].slice(0, 60) + '"). A mission objective is a ' +
                'research question, not a command. Nothing was run.'
      };
    }
  }
  return { flagged: false, rule: 'G-4', matched: null, reason: null };
}

/* ---------------------------------------------------------------------
   3 · Deterministic sample data.
   Same mission id + same drawn area => same numbers, every single run.
   A judge can press Launch twice and get the same report, and every
   figure on screen can be traced back to a line here.
   --------------------------------------------------------------------- */
function hashString(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function seeded(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function round(n, dp) { const f = Math.pow(10, dp || 0); return Math.round(n * f) / f; }
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

/* GeoJSON Polygon -> bounding box. The database already guaranteed the
   shape (one ring, 4..200 points, every point [number, number]), but a
   worker that trusts its input is a worker you cannot reason about. */
function bboxOf(areaGeojson) {
  const ring = areaGeojson && areaGeojson.coordinates && areaGeojson.coordinates[0];
  if (!Array.isArray(ring) || ring.length < 4) return null;
  let w = 180, e = -180, s = 90, n = -90;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i];
    if (!Array.isArray(p) || p.length !== 2) return null;
    const lng = Number(p[0]), lat = Number(p[1]);
    if (!isFinite(lng) || !isFinite(lat)) return null;
    if (lng < w) w = lng; if (lng > e) e = lng;
    if (lat < s) s = lat; if (lat > n) n = lat;
  }
  return { west: w, east: e, south: s, north: n };
}

function insideKuwait(b) {
  return b && b.west >= KUWAIT.west && b.east <= KUWAIT.east &&
         b.south >= KUWAIT.south && b.north <= KUWAIT.north;
}

function areaKm2(b) {
  const latKm = (b.north - b.south) * 111;
  const midLat = (b.north + b.south) / 2;
  const lonKm = (b.east - b.west) * 111 * Math.cos(midLat * Math.PI / 180);
  return Math.max(0, Math.round(latKm * lonKm));
}

/* Cloud cover is a FIXED cycle, not random: "three of the eleven scenes
   were over 20% cloud, so eight were usable" has to be the same sentence
   every time the judge asks. */
const CLOUD_CYCLE = [8, 14, 62, 11, 35, 7, 19, 71, 12, 4, 28, 9, 55, 16];

function buildCatalogue(seedKey, bbox) {
  const km2 = areaKm2(bbox);
  const total = clamp(Math.floor(km2 / LIMITS.KM2_PER_SCENE), 0, 14);
  const rand = seeded(hashString(seedKey));
  const scenes = [];
  for (let i = 0; i < total; i++) {
    const day = 2 + Math.floor(rand() * 26);
    scenes.push({
      scene_id: 'KS1-2026-03-' + String(day).padStart(2, '0') + '-' + String(i + 1).padStart(2, '0'),
      captured: '2026-03-' + String(day).padStart(2, '0'),
      cloud_pct: CLOUD_CYCLE[i % CLOUD_CYCLE.length],
      usable: CLOUD_CYCLE[i % CLOUD_CYCLE.length] <= LIMITS.MAX_CLOUD_PCT
    });
  }
  return { area_km2: km2, scenes: scenes,
           usable: scenes.filter(function (s) { return s.usable; }) };
}

/* Split the drawn box into a 2x2 grid and measure each quarter. Three
   candidate zones, ranked. Two sentences on a whiteboard. */
const QUARTER_NAMES = ['North-west quarter', 'North-east quarter',
                       'South-west quarter', 'South-east quarter'];

function measureZones(seedKey, bbox) {
  const rand = seeded(hashString(seedKey + '|zones'));
  const midLat = (bbox.north + bbox.south) / 2;
  const midLng = (bbox.east + bbox.west) / 2;
  const boxes = [
    { name: QUARTER_NAMES[0], w: bbox.west, e: midLng, s: midLat, n: bbox.north },
    { name: QUARTER_NAMES[1], w: midLng, e: bbox.east, s: midLat, n: bbox.north },
    { name: QUARTER_NAMES[2], w: bbox.west, e: midLng, s: bbox.south, n: midLat },
    { name: QUARTER_NAMES[3], w: midLng, e: bbox.east, s: bbox.south, n: midLat }
  ];
  return boxes.map(function (b) {
    const ndvi = round(0.05 + rand() * 0.23, 2);            // 0.05 .. 0.28
    const anomaly = round(0.4 + rand() * 2.8, 1);           // +0.4 .. +3.2 °C
    const overBar = (ndvi <= LIMITS.NDVI_BAR && anomaly >= LIMITS.TEMP_ANOMALY_BAR);
    // score: 60% dryness, 40% heat. Printed in the narrative so the
    // researcher can re-do the arithmetic on screen.
    const score = clamp(Math.round(100 * (0.6 * (1 - ndvi / 0.30) +
                                          0.4 * (anomaly / 3.5))), 1, 100);
    return {
      name: b.name, bbox: b, ndvi: ndvi, temp_anomaly_c: anomaly,
      over_bar: overBar, score: score,
      level: score >= 70 ? 'high' : (score >= 45 ? 'medium' : 'low'),
      polygon: [[b.w, b.s], [b.e, b.s], [b.e, b.n], [b.w, b.n], [b.w, b.s]]
    };
  });
}

/* MODELLED, not measured. The label goes on screen with the number. */
function predictImpact(zone) {
  return {
    cooling_c: round(-(zone.temp_anomaly_c * 0.6), 1),
    ndvi_gain: round((0.30 - zone.ndvi) * 0.55, 2),
    horizon_months: 24
  };
}

/* ---------------------------------------------------------------------
   4 · THE DECISION POINT. One function, six lines, so that the answer to
   "where does it decide?" is a place you can point at.
   --------------------------------------------------------------------- */
function decide(catalogue, zones) {
  const usable = catalogue.usable.length;
  const overBar = zones.filter(function (z) { return z.over_bar; });
  if (usable < LIMITS.MIN_USABLE_SCENES) {
    return { proceed: false, usable_scenes: usable, zones_over_bar: overBar.length,
             because: 'Only ' + usable + ' usable scene(s) cover this area. ' +
                      'The bar is ' + LIMITS.MIN_USABLE_SCENES + '.' };
  }
  if (overBar.length === 0) {
    return { proceed: false, usable_scenes: usable, zones_over_bar: 0,
             because: 'No quarter of this area is both dry enough (NDVI at or below ' +
                      LIMITS.NDVI_BAR + ') and hot enough (anomaly at or above +' +
                      LIMITS.TEMP_ANOMALY_BAR + ' °C) to recommend work there.' };
  }
  return { proceed: true, usable_scenes: usable, zones_over_bar: overBar.length,
           because: usable + ' usable scenes and ' + overBar.length +
                    ' quarter(s) over the evidence bar.' };
}

/* ---------------------------------------------------------------------
   5 · The text the researcher reads. Plain text — reports.body_md and
   results.body are rendered with textContent, never innerHTML
   (DECISIONS.md D-2). Every figure carries its provenance label.
   --------------------------------------------------------------------- */
function provenanceKey() {
  return 'How to read the labels:\n' +
         '  MEASURED  — read from a scene in the catalogue listed above.\n' +
         '  MODELLED  — computed from the measured figures by the formula shown.\n' +
         '  ESTIMATED — a bounded guess; the bound is printed beside it.\n' +
         'This is a student prototype. The scene catalogue is invented and no\n' +
         'figure here is an operational KuwaitSat-1 measurement.';
}

function narrativeForProceed(claim, catalogue, ranked, verdict) {
  const top = ranked[0];
  const impact = predictImpact(top);
  const lines = [];
  lines.push('DRAFT FINDING — awaiting researcher approval');
  lines.push('Mission: ' + claim.title);
  lines.push('Objective (as written by the researcher): ' + claim.objective);
  lines.push('');
  lines.push('EVIDENCE');
  lines.push('  Area drawn: ' + catalogue.area_km2.toLocaleString('en-GB') + ' km2  [MEASURED · the polygon you drew]');
  lines.push('  Scenes over this area: ' + catalogue.scenes.length + '  [MEASURED · catalogue 2026-03]');
  lines.push('  Usable (cloud at or below ' + LIMITS.MAX_CLOUD_PCT + '%): ' +
             catalogue.usable.length + '  [MEASURED]');
  lines.push('  Scene ids used: ' + catalogue.usable.map(function (s) { return s.scene_id; }).join(', '));
  lines.push('');
  lines.push('RANKED ZONES (bar: NDVI at or below ' + LIMITS.NDVI_BAR +
             ' AND anomaly at or above +' + LIMITS.TEMP_ANOMALY_BAR + ' C)');
  ranked.forEach(function (z, i) {
    lines.push('  ' + (i + 1) + '. ' + z.name + ' — score ' + z.score + '/100 (' + z.level + ')');
    lines.push('     NDVI ' + z.ndvi + '  [MEASURED]   surface temperature anomaly +' +
               z.temp_anomaly_c + ' C  [MEASURED]');
    lines.push('     score = round(100 x (0.6 x (1 - ' + z.ndvi + '/0.30) + 0.4 x (' +
               z.temp_anomaly_c + '/3.5))) = ' + z.score + '  [MODELLED]');
  });
  lines.push('');
  lines.push('PROJECTED EFFECT OF WORK IN ' + top.name.toUpperCase());
  lines.push('  Local cooling ' + impact.cooling_c + ' C over ' + impact.horizon_months +
             ' months  [MODELLED · anomaly x 0.6]');
  lines.push('  NDVI change +' + impact.ndvi_gain + '  [MODELLED · (0.30 - NDVI) x 0.55]');
  lines.push('');
  lines.push('DECISION TAKEN BY THE WORKFLOW');
  lines.push('  Proceeded. ' + verdict.because);
  lines.push('');
  lines.push('WHAT THIS IS NOT');
  lines.push('  No satellite was commanded. Nothing here is published. This draft');
  lines.push('  exists until you press Generate Report, and only you can do that.');
  lines.push('');
  lines.push(provenanceKey());
  return lines.join('\n').slice(0, LIMITS.RESULT_BODY_MAX);
}

function narrativeForStop(claim, catalogue, zones, verdict) {
  const lines = [];
  lines.push('STOPPED — not enough usable evidence');
  lines.push('Mission: ' + claim.title);
  lines.push('');
  lines.push('WHY IT STOPPED');
  lines.push('  ' + verdict.because);
  lines.push('');
  lines.push('WHAT IT FOUND FIRST');
  lines.push('  Area drawn: ' + catalogue.area_km2.toLocaleString('en-GB') + ' km2  [MEASURED]');
  lines.push('  Scenes over this area: ' + catalogue.scenes.length + '  [MEASURED]');
  lines.push('  Usable (cloud at or below ' + LIMITS.MAX_CLOUD_PCT + '%): ' +
             catalogue.usable.length + '  [MEASURED]');
  if (zones && zones.length) {
    zones.forEach(function (z) {
      lines.push('  ' + z.name + ': NDVI ' + z.ndvi + ', anomaly +' + z.temp_anomaly_c +
                 ' C  [MEASURED]');
    });
  }
  lines.push('');
  lines.push('WHAT YOU CAN DO');
  lines.push('  Draw a larger area (about ' +
             (LIMITS.MIN_USABLE_SCENES * LIMITS.KM2_PER_SCENE * 1.4).toLocaleString('en-GB') +
             ' km2 or more usually clears the scene bar), or choose a');
  lines.push('  different month. Nothing was written to the map and no report exists.');
  lines.push('');
  lines.push(provenanceKey());
  return lines.join('\n').slice(0, LIMITS.RESULT_BODY_MAX);
}

function narrativeForRefusal(claim, injection) {
  return [
    'REFUSED — the objective was read as an instruction, not a question',
    'Mission: ' + claim.title,
    '',
    'Guardrail ' + injection.rule + ' fired before any tool ran.',
    injection.reason,
    '',
    'The objective is stored exactly as the researcher typed it and has not',
    'been acted on. No scene was read, no zone was scored, no report exists.',
    'This mission is flagged. Edit the objective into a question and launch again.',
    '',
    provenanceKey()
  ].join('\n').slice(0, LIMITS.RESULT_BODY_MAX);
}

/* ---------------------------------------------------------------------
   6 · THE PLAN. Returns every call the runtime must make, in order, with
   the exact body each one needs. The runtime adds no arguments of its
   own — it cannot, because it does not know anything this file did not
   tell it. That is what keeps n8n and the Edge fallback identical.
   --------------------------------------------------------------------- */
function logStep(run_id, step, tool, args, allowed, refused, injection) {
  return { fn: 'agent_log_step', body: {
    p_run_id: run_id, p_step: step, p_tool: tool, p_args: args,
    p_allowed: !!allowed, p_refused_reason: refused || null,
    p_injection: !!injection } };
}

function writeResult(run_id, kind, title, body, geometry, sourceRef) {
  return { fn: 'agent_write_result', body: {
    p_run_id: run_id, p_kind: kind, p_title: title,
    p_body: String(body || '').slice(0, LIMITS.RESULT_BODY_MAX),
    p_geometry: geometry || null, p_source_ref: sourceRef || null } };
}

function analyse(claim) {
  const run_id = claim.run_id;
  const seedKey = String(claim.mission_id) + '|' + JSON.stringify(claim.area_geojson);

  /* G-4 first, before any tool. An objective that tries to give orders
     never reaches the catalogue. */
  const injection = detectInjection(claim.objective);
  if (injection.flagged) {
    return {
      run_id: run_id, proceed: false, outcome: 'refused',
      evidence: { guardrail: injection.rule, matched: injection.matched },
      calls_common: [
        logStep(run_id, 'satellite_data', 'objective_screen',
                { rule: injection.rule, matched: injection.matched },
                false, injection.reason, true)
      ],
      calls_next: [
        writeResult(run_id, 'narrative', 'Refused: the objective gave instructions',
                    narrativeForRefusal(claim, injection), null, 'guardrail:' + injection.rule)
      ],
      finish: { p_run_id: run_id, p_status: 'stalled',
                p_error: 'Guardrail ' + injection.rule + ' refused the objective.' }
    };
  }

  /* G-3 re-check. The CHECK constraint already refused anything outside
     Kuwait; this is the same rule enforced where the agent can show it. */
  const bbox = bboxOf(claim.area_geojson);
  if (!bbox || !insideKuwait(bbox)) {
    const why = 'The drawn area is not inside Kuwait (' + KUWAIT.west + '-' +
                KUWAIT.east + ' E, ' + KUWAIT.south + '-' + KUWAIT.north +
                ' N). Guardrail G-3.';
    return {
      run_id: run_id, proceed: false, outcome: 'refused',
      evidence: { guardrail: 'G-3', bbox: bbox },
      calls_common: [logStep(run_id, 'satellite_data', 'area_screen', { bbox: bbox },
                             false, why, false)],
      calls_next: [writeResult(run_id, 'narrative', 'Refused: area outside Kuwait',
                               why, null, 'guardrail:G-3')],
      finish: { p_run_id: run_id, p_status: 'stalled', p_error: why }
    };
  }

  /* STEP 1 — what imagery exists over the drawn area. */
  const catalogue = buildCatalogue(seedKey, bbox);

  /* STEP 2 — measure each quarter of it. */
  const zones = measureZones(seedKey, bbox);

  /* THE DECISION. */
  const verdict = decide(catalogue, zones);

  const common = [
    logStep(run_id, 'satellite_data', 'scene_catalogue',
            { area_km2: catalogue.area_km2, scenes: catalogue.scenes.length,
              usable: catalogue.usable.length, max_cloud_pct: LIMITS.MAX_CLOUD_PCT },
            true, null, false),
    logStep(run_id, 'environmental_analysis', 'zone_metrics',
            { zones: zones.length,
              ndvi: zones.map(function (z) { return z.ndvi; }),
              anomaly_c: zones.map(function (z) { return z.temp_anomaly_c; }) },
            true, null, false)
  ];

  if (!verdict.proceed) {
    return {
      run_id: run_id, proceed: false, outcome: 'stopped',
      evidence: verdict, calls_common: common,
      calls_next: [
        logStep(run_id, 'recommendation', 'evidence_bar',
                { usable_scenes: verdict.usable_scenes,
                  zones_over_bar: verdict.zones_over_bar,
                  min_usable_scenes: LIMITS.MIN_USABLE_SCENES },
                false, verdict.because, false),
        writeResult(run_id, 'narrative', 'Stopped: not enough usable evidence',
                    narrativeForStop(claim, catalogue, zones, verdict), null,
                    'catalogue:2026-03')
      ],
      finish: { p_run_id: run_id, p_status: 'stalled', p_error: verdict.because }
    };
  }

  /* The proceed path: rank, predict, draw, write up. */
  const ranked = zones.filter(function (z) { return z.over_bar; })
                      .sort(function (a, b) { return b.score - a.score; })
                      .slice(0, LIMITS.MAX_ZONES);
  const top = ranked[0];
  const impact = predictImpact(top);
  const sceneRef = 'archive:/ks1/2026-03/' +
                   catalogue.usable.map(function (s) { return s.scene_id; }).join(',');

  const geometry = {
    type: 'FeatureCollection',
    features: ranked.map(function (z) {
      return { type: 'Feature',
               properties: { name: z.name, level: z.level, score: z.score,
                             ndvi: z.ndvi, temp_anomaly_c: z.temp_anomaly_c },
               geometry: { type: 'Polygon', coordinates: [z.polygon] } };
    })
  };

  const next = [];
  next.push(logStep(run_id, 'recommendation', 'evidence_bar',
                    { ranked: ranked.map(function (z) { return z.name + ':' + z.score; }) },
                    true, null, false));
  ranked.forEach(function (z) {
    next.push(writeResult(run_id, 'site', z.name + ' — ' + z.level + ' priority (' + z.score + '/100)',
      z.name + '\n' +
      'Score ' + z.score + '/100 (' + z.level + ' priority)  [MODELLED]\n' +
      'NDVI ' + z.ndvi + '  [MEASURED]\n' +
      'Surface temperature anomaly +' + z.temp_anomaly_c + ' C  [MEASURED]\n' +
      'Over the evidence bar: yes (NDVI at or below ' + LIMITS.NDVI_BAR +
      ', anomaly at or above +' + LIMITS.TEMP_ANOMALY_BAR + ' C)',
      { type: 'Polygon', coordinates: [z.polygon] }, sceneRef));
  });
  next.push(logStep(run_id, 'impact_prediction', 'impact_model',
                    { zone: top.name, cooling_c: impact.cooling_c,
                      ndvi_gain: impact.ndvi_gain, horizon_months: impact.horizon_months },
                    true, null, false));
  next.push(writeResult(run_id, 'metric',
    'Projected effect in ' + top.name,
    'If work goes ahead in ' + top.name + ':\n' +
    '  local cooling ' + impact.cooling_c + ' C over ' + impact.horizon_months +
    ' months  [MODELLED · anomaly ' + top.temp_anomaly_c + ' x 0.6]\n' +
    '  NDVI change +' + impact.ndvi_gain + '  [MODELLED · (0.30 - ' + top.ndvi + ') x 0.55]',
    null, sceneRef));
  next.push(logStep(run_id, 'visualization', 'map_layer',
                    { features: geometry.features.length }, true, null, false));
  next.push(writeResult(run_id, 'map_layer', 'Ranked zones on the Kuwait map',
    ranked.length + ' zone(s) drawn from the measured figures above.',
    geometry, sceneRef));
  next.push(logStep(run_id, 'reporting', 'draft_report',
                    { awaiting: 'researcher approval' }, true, null, false));
  next.push(writeResult(run_id, 'narrative', 'Draft finding — awaiting your approval',
    narrativeForProceed(claim, catalogue, ranked, verdict), null, sceneRef));

  return {
    run_id: run_id, proceed: true, outcome: 'complete',
    evidence: verdict, calls_common: common, calls_next: next,
    finish: { p_run_id: run_id, p_status: 'complete', p_error: null }
  };
}

/* n8n Code node: DELETE THE LINE BELOW before pasting. Deno keeps it. */
export { LIMITS, KUWAIT, STEPS, detectInjection, bboxOf, insideKuwait, areaKm2,
         buildCatalogue, measureZones, predictImpact, decide, analyse };
