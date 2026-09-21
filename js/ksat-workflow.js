/* =====================================================================
   ksat-workflow.js — THE AGENT WORKFLOW
   Owner: 04 Agents, with 03 Security (the write path and the grant)

   The team's spec, mapped onto what genuinely exists here. Additive:
   this file appends ONE container inside <section id="agent"> and never
   touches #pipeline, #agOut, #reportPanel or anything else in the page.

   ------------------------------------------------------------------
   THE SPEC ASSUMES A STACK THAT DOES NOT EXIST. Say so plainly.
   ------------------------------------------------------------------
   It names Next.js route handlers (/api/automation/launch), a Vercel
   cron and Supabase Realtime. There is NO Next.js app and NO server
   code here: this is a static page on Vercel plus Supabase. Nothing
   below invents one.

     SPEC                          WHAT IT IS HERE
     POST /api/automation/launch   launch_mission(p_mission_id), a
                                   SECURITY DEFINER rpc granted to
                                   `authenticated`. Stronger than a route
                                   handler: it re-reads ownership inside
                                   the transaction, and the browser never
                                   holds a webhook URL or a service key.
     table `agent_runs`            three tables: mission_runs (the run),
                                   agent_steps (the steps), results (the
                                   findings). Use the real names.
     status 'waiting'              'queued'. Use the real word on screen.
     Realtime status stream        refused on purpose (decision D-6): a
                                   Realtime payload is built from the WAL
                                   and can carry columns that were never
                                   granted. Here the browser IS the agent,
                                   so it renders each step as it writes
                                   it, and then READS THE ROWS BACK from
                                   agent_steps as proof they landed.
     Vercel cron monitoring        not possible: a Vercel cron invokes a
                                   serverless function and this project
                                   has none. The scheduler that fits is
                                   pg_cron inside Supabase, calling the
                                   existing sweep_stalled_runs(3). It is
                                   NOT enabled — so it is not claimed.
                                   There is also no monitoring table.

   ------------------------------------------------------------------
   THE ONE DECISION YOU CAN DRAW ON A WHITEBOARD
   ------------------------------------------------------------------
   Candidate zones are evaluated one at a time, in score order, against
   a projected cover-uplift floor. Below the floor the zone is REJECTED,
   a re-ranking subroutine drops it and the next candidate comes
   forward. Accept forwards to visualisation and then to a DRAFT report
   that a person must approve.

   Verified against the page's own engine before the number was chosen:
   replaying zonesFor() -> predictImpact() for every AOI (rng is seeded
   at 4200, so this is reproducible, not a sample) gives Al Asimah
   zone D 3.6 pp REJECT, zone C 3.6 pp REJECT, zone B 4.1 pp ACCEPT.
   Two re-ranks, then accepted — exactly the budget, and the
   highest-ranked zone is not the one that reaches the map.

   WHY NOT IMPACT_FLOOR_C = 1.0 from 04-agents/agent/decision.js:
   it is arithmetically unreachable here. predictImpact() scales source
   [15]'s 0.6-3.7 °C-per-30-points coefficient, and across all six
   governorates the best case upper bound is -0.86 °C. A 1.0 °C floor
   rejects every candidate in Kuwait and every run stalls. The floor is
   therefore expressed in the unit the page actually computes and the
   source actually publishes: percentage points of vegetation cover.
   ===================================================================== */

(function () {
  'use strict';

  var KS = window.KSAT = window.KSAT || {};
  var WF = KS.workflow = KS.workflow || {};

  /* ===================================================================
     1 · THE ONLY PLACE THESE NUMBERS ARE WRITTEN
     =================================================================== */

  var UPLIFT_FLOOR_PP  = 4.0;    // percentage points of vegetation cover
  var SPECIES_FLOOR    = 1;      // best matchSpecies() score — a GUARDRAIL
  var MAX_RERANKS      = 2;      // three candidates looked at, at most
  var STEP_BUDGET      = 40;     // mission_runs.tool_calls check (0..40)
  var MIN_REPORT_CHARS = 50;     // mirrors generate_report's own rule
  var STALL_MS         = 180000; // mirrors sweep_stalled_runs(3 minutes)

  /* Two pairs that must never drift apart:
       STALL_MS 180000        <-> sweep_stalled_runs(3)
       MIN_REPORT_CHARS 50    <-> generate_report's char_length(...) < 50
     04-agents/tools/preflight.js check C5 already guards the first. */

  /* ===================================================================
     2 · SMALL HELPERS. textContent ONLY, everywhere.
     There is no innerHTML in this file and no onclick= anywhere.
     =================================================================== */

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }
  function haveDb() { return !!(window.sb && window.sb.auth); }
  function signedIn() { return !!(KS.live && haveDb()); }
  function pause(ms) {
    var reduce = false;
    try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
    return new Promise(function (r) { setTimeout(r, reduce ? 40 : ms); });
  }
  function n1(v) { return Math.round(v * 10) / 10; }

  /* Never let a raw Postgres string reach a researcher. The RPCs raise
     deliberately human sentences; anything else is generic. */
  var SAFE = [
    /^Limit reached: \d+ agent runs per (hour|day)\.$/,
    /^Limit reached: \d+ runs per mission per hour\.$/,
    /^Limit reached: \d+ missions per (hour|day)\.$/,
    /^This mission has an approved report\. Start a new mission\.$/,
    /^Sign in before launching a mission\.$/,
    /^A report needs at least 50 characters\.$/,
    /^Mission not found\.$/,
    /^Run is not active\.$/,
    /^Step budget exhausted\.$/,
    /^This mission is already running\.$/,
    /^Mission settings are unavailable\.$/,
    /^The prototype is not accepting new missions right now\.$/,
    /^Unknown run status\.$/,
    /^Result body too long\.$/
  ];

  /* KEEP THIS LIST HONEST - it is one half of a contract with the SQL.
     Every sentence above is raised verbatim by a function in
     03-security/db/. A message the database raises that is NOT matched
     here does not reach the researcher: they get the generic line
     instead, which is safe but tells them nothing they can act on.

     Four of these were added on 21 Sep 2026, and two of those had been
     missing since before the R-1 work:
       'Limit reached: N missions per hour./per day.'  missions_guard()
       'Sign in before launching a mission.'           missions_guard()
     Both are raised by the INSERT trigger rather than by an RPC, which is
     why they were overlooked - the allowlist had been written by reading
     05_views_rpc.sql alone. Read 06_validation.sql too.

     If you add a `raise exception` to the schema, add its shape here in
     the same sitting. The pairing is checked by hand; nothing enforces it. */
  function humanError(e) {
    var m = (e && (e.message || e.msg || e.error_description)) || '';
    for (var i = 0; i < SAFE.length; i++) if (SAFE[i].test(m)) return m;
    if (/JWT|not authenticated|401/i.test(m)) return 'Your session has expired. Sign in again.';
    if (/Failed to fetch|NetworkError/i.test(m)) return 'Could not reach the database. Check your connection.';
    console.warn('[ksat-workflow] suppressed:', m);
    return 'Something went wrong writing this step. Nothing was saved for it.';
  }

  /* ===================================================================
     3 · EXTENDING THE WRITE PATH, NOT DUPLICATING IT

     js/ksat-integration.js already owns KS.logStep / KS.writeResult /
     KS.finishRun. KS.logStep maps the prototype's ten PIPE ids onto the
     six step_name values the CHECK constraint allows, and passes the
     PIPE id as `tool`. This workflow needs the opposite: an explicit
     step_name with the TRUE agent identity in `tool` ('spec.match',
     'impact_model.project', 'zone_reranker.next'). So we add the general
     form to the same namespace and reuse KS.runId and its guards.

     agent_steps.step_name is fixed by a CHECK to exactly six values.
     Inventing a seventh throws — which is why the re-ranking loop shows
     up as REPEATED `recommendation` and `impact_prediction` rows. That
     repetition IS the audit trail of the loop, and it is a good thing to
     point at.
     =================================================================== */

  var STEP_NAMES = ['satellite_data', 'environmental_analysis', 'recommendation',
                    'impact_prediction', 'visualization', 'reporting'];

  var used = 0;   // local mirror of mission_runs.tool_calls

  KS.logStepAs = function (stepName, tool, opts) {
    opts = opts || {};
    if (!haveDb() || !KS.runId) return Promise.resolve(null);
    if (STEP_NAMES.indexOf(stepName) === -1) {
      return Promise.reject(new Error('Unknown step name.'));
    }
    if (used >= STEP_BUDGET) {
      return Promise.reject(new Error('Step budget exhausted.'));
    }
    used++;
    return window.sb.rpc('researcher_log_step', {
      p_run_id: KS.runId,
      p_step: stepName,
      p_tool: tool || null,
      /* READ refused_reason, NOT arguments. `arguments` is not in the
         browser grant (03_grants.sql:98) and not in my_agent_steps, so a
         number written only there is a number the researcher can never
         see. Everything traceable goes in refused_reason or results.body. */
      p_args: opts.args || null,
      p_allowed: opts.allowed !== false,
      p_refused_reason: opts.reason || null,
      p_injection: !!opts.injection
    }).then(function (r) {
      if (r.error) throw r.error;
      return r.data || null;
    });
  };

  /* The real governorate outline, closed into a ring. Verified against
     the CHECK: kuwait_area_ok() needs one ring of 4-200 points, every
     point [number, number], every lng in 46.5..48.8 and lat in
     28.5..30.1. All six regions pass, and the largest serialises to
     216 bytes against an 8192 limit.

     ksat-integration.js's recordRun() falls back to a fixed default box
     because REGIONS carry `poly`, not `bounds` — so every mission got
     the same rectangle. This is the real footprint instead. */
  function regionRing(r) {
    if (!r || !r.poly || !r.poly.length) return null;
    var ring = r.poly.map(function (p) { return [p[0], p[1]]; });
    ring.push([r.poly[0][0], r.poly[0][1]]);
    if (ring.length < 4) return null;
    return { type: 'Polygon', coordinates: [ring] };
  }

  /* ===================================================================
     4 · THE SPECIES AGENT'S TWO CONSTRAINTS

     CONSTRAINT A — planting viability. A GUARDRAIL, NOT THE DECISION.
     matchSpecies(zone, c) NEVER READS ITS `zone` ARGUMENT — verified at
     index.html:5335: it scores the register against the researcher's
     site constraints and Kuwait's 121 mm/yr rainfall, and nothing else.
     So it cannot vary between zones and can never by itself cause a
     re-rank. What it CAN do is stop the run when the researcher's
     constraints have eliminated the whole register. Presenting a
     constant as a decision is the thing that loses the room, so it is
     presented as what it is.

     CONSTRAINT B — the Uplift Gate. THE decision, and the one that
     varies. See the header for why 4.0 points and not 1.0 °C.
     =================================================================== */

  function bestSpeciesScore(zone, c) {
    if (typeof window.matchSpecies !== 'function') return SPECIES_FLOOR;
    try {
      var m = window.matchSpecies(zone, c || {});
      return (m && m[0] && typeof m[0].sc === 'number') ? m[0].sc : -99;
    } catch (e) { return -99; }
  }

  function nextCandidate(zones, rejectedIds, c) {
    for (var i = 0; i < zones.length; i++) {
      if (rejectedIds.indexOf(zones[i].id) !== -1) continue;
      if (bestSpeciesScore(zones[i], c) < SPECIES_FLOOR) continue;
      return zones[i];              // zonesFor() already returns score-descending
    }
    return null;
  }

  /* Re-ranking is not a re-run of the same question. zonesFor() ranks on
     OBSERVED proxies (lst, veg, urb). predictImpact() then models the
     zone FORWARD — information the ranking never had. A rejected zone is
     removed, so every loop has strictly one fewer candidate: the loop is
     monotone and terminates even without MAX_RERANKS. */
  function decideZone(zone) {
    var p = window.predictImpact(zone);
    var pass = p.uplift >= UPLIFT_FLOOR_PP;
    return { pass: pass, p: p };
  }

  function rejectSentence(zone, p, rerank) {
    return zone.short + ' projects only ' + n1(p.uplift) +
      ' points of added vegetation cover (−' + p.lstLo + ' to −' + p.lstHi +
      ' °C), below the ' + UPLIFT_FLOOR_PP.toFixed(1) +
      '-point floor. Zone rejected. Ranking again without it. Re-rank ' +
      rerank + ' of ' + MAX_RERANKS + '.';
  }
  function acceptSentence(zone, p) {
    return zone.short + ' projects ' + n1(p.uplift) + ' points of added cover (−' +
      p.lstLo + ' to −' + p.lstHi + ' °C), at or above the ' +
      UPLIFT_FLOOR_PP.toFixed(1) + '-point floor. Forwarded to visualisation.';
  }
  var STALL_SENTENCE = 'No candidate zone reached the ' + UPLIFT_FLOOR_PP.toFixed(1) +
    '-point cover uplift floor after ' + MAX_RERANKS +
    ' re-ranks. The run stopped rather than recommend a site that would not measurably help. Nothing was written to the map.';
  var REGISTER_SENTENCE = 'No species in the register clears the constraints you set, so no candidate zone can be planted as specified. The run stopped rather than recommend a site it cannot plant.';

  /* The sentence the page's own provenance register (PROV row 14)
     obliges us to carry: species selection is DELIBERATELY NOT PRODUCED.
     The agent narrows the register. It must never read as a choice. */
  var NOT_A_CHOICE = 'Final species selection, planting density, soil preparation and irrigation design require an agronomist and a site survey. This agent narrows the field; it does not close it.';

  /* ===================================================================
     5 · PROVENANCE — every figure carries its label

     The page's own legend teaches five badges and the PROV register
     classifies every dataset. The spec's three labels are expressed in
     THAT vocabulary rather than a sixth one:
       MEASURED  = published, attributable, sourced   (badges real / pub)
       MODELLED  = a model written for this prototype (badge sim)
       ESTIMATED = an interpretation, or a published coefficient scaled
                   to this site                        (badge ai)
     The bracket convention matches what recordRun() already writes, so
     old and new rows read alike.
     =================================================================== */

  function figure(label, value, cls, derived, coefficient, caveat) {
    var L = ['FIGURE · ' + label + ' · ' + value + ' · ' + cls];
    if (derived)     L.push('  derived from: ' + derived);
    if (coefficient) L.push('  coefficient:  ' + coefficient);
    if (caveat)      L.push('  caveat:       ' + caveat);
    return L.join('\n');
  }

  var COEF_LINE = '0.6–3.7 °C per 30 points · MEASURED · source [15] Yin et al. 2024';
  var COEF_CAVEAT = 'source states the relationship is non-linear; treat as an order of magnitude to design a measurement around';

  /* ===================================================================
     6 · THE PANEL

     Appended INSIDE <section id="agent">, after everything already
     there. #pipeline, #agOut, #agReport and #reportPanel are untouched
     and keep working exactly as they did.
     =================================================================== */

  var ui = {};

  function mount() {
    var host = document.getElementById('agent');
    if (!host || document.getElementById('ksat-wf')) return false;

    var box = el('section', 'ksat-wf');
    box.id = 'ksat-wf';
    box.setAttribute('aria-label', 'Mission workflow');

    var head = el('div', 'ksat-wf-head');
    head.appendChild(el('span', 'ksat-wf-eyebrow', 'MISSION WORKFLOW · سير المهمة'));
    ui.state = el('span', 'ksat-wf-state', 'IDLE');
    head.appendChild(ui.state);
    box.appendChild(head);

    box.appendChild(el('h3', 'ksat-wf-h', 'Launch a mission, and watch the agent refuse a zone'));
    box.appendChild(el('p', 'ksat-wf-p',
      'This is the persisted workflow: it writes a real mission, a real run and a real agent step for every pass, including every refusal. The Run agent control above is the in-page pipeline demonstration and is unchanged.'));

    /* controls */
    var ctl = el('div', 'ksat-wf-ctl');

    var lab = el('label', 'ksat-wf-lab', 'Area of interest');
    lab.setAttribute('for', 'ksat-wf-aoi');
    ctl.appendChild(lab);

    ui.aoi = el('select');
    ui.aoi.id = 'ksat-wf-aoi';
    ctl.appendChild(ui.aoi);

    ui.launch = el('button', 'btn pri ksat-wf-launch', 'Launch Mission');
    ui.launch.type = 'button';
    ui.launch.addEventListener('click', function () { start(); });
    ctl.appendChild(ui.launch);

    box.appendChild(ctl);

    ui.gateNote = el('p', 'ksat-wf-gate', '');
    box.appendChild(ui.gateNote);

    /* the rail of passes */
    ui.log = el('div', 'ksat-wf-log');
    ui.log.setAttribute('role', 'log');
    ui.log.setAttribute('aria-live', 'polite');
    box.appendChild(ui.log);

    ui.budget = el('div', 'ksat-wf-budget', '');
    box.appendChild(ui.budget);

    /* the checkpoint lives here */
    ui.check = el('div', 'ksat-wf-check');
    ui.check.hidden = true;
    box.appendChild(ui.check);

    host.appendChild(box);

    fillAreas();
    refreshGate();
    return true;
  }

  function fillAreas() {
    if (!ui.aoi) return;
    ui.aoi.textContent = '';
    var regions = window.REGIONS || [];
    var all = el('option', null, 'All Kuwait');
    all.value = 'all';
    ui.aoi.appendChild(all);
    regions.forEach(function (r) {
      var o = el('option', null, r.n);
      o.value = r.id;
      ui.aoi.appendChild(o);
    });
    /* Al Asimah is the demo default on purpose: it is the AOI whose
       highest-scoring zone is rejected twice before one is accepted,
       because the capital's best site scores high partly by being
       already the greenest — so it has the least room to improve. The
       other AOIs going straight through is correct, not a bug: a
       decision that fires every time is not a decision. */
    ui.aoi.value = 'asimah';
  }

  function refreshGate() {
    if (!ui.gateNote) return;
    if (!haveDb()) {
      ui.gateNote.textContent = 'The database is not connected, so nothing can be persisted. The in-page pipeline above still runs.';
      ui.launch.disabled = true;
      return;
    }
    if (!signedIn()) {
      ui.gateNote.textContent = 'Sign in to launch a mission. A mission belongs to one account: the run, its steps, its results and its report are visible to you and to nobody else.';
      ui.launch.disabled = true;
      return;
    }
    ui.gateNote.textContent = '';
    ui.launch.disabled = false;
  }

  /* ------------------------------------------------------------------
     rendering one pass of the loop
     ------------------------------------------------------------------ */

  function row(kind, head, body) {
    var r = el('div', 'ksat-wf-row ksat-wf-' + kind);
    r.appendChild(el('span', 'ksat-wf-rk', head));
    r.appendChild(el('span', 'ksat-wf-rb', body));
    ui.log.appendChild(r);
    return r;
  }
  function clearLog() { if (ui.log) ui.log.textContent = ''; }
  function setState(s) { if (ui.state) ui.state.textContent = s; }
  function paintBudget() {
    if (ui.budget) ui.budget.textContent = used + ' of ' + STEP_BUDGET + ' tool calls used.';
  }

  /* ===================================================================
     7 · THE RUN
     =================================================================== */

  var running = false;
  var ctx = null;     // {missionId, runId, zone, impact, draft, area}

  function start() {
    if (running) return;
    if (!signedIn()) { refreshGate(); return; }
    if (typeof window.zonesFor !== 'function' || typeof window.predictImpact !== 'function') {
      row('bad', 'UNAVAILABLE', 'The page’s zone and impact engines were not reachable. Nothing was launched.');
      return;
    }

    running = true;
    used = 0;
    ctx = null;
    clearLog();
    if (ui.check) { ui.check.hidden = true; ui.check.textContent = ''; }
    ui.launch.disabled = true;
    ui.launch.textContent = 'Running…';
    setState('QUEUED');
    paintBudget();

    run().catch(function (e) {
      row('bad', 'STOPPED', humanError(e));
      setState('FAILED');
    }).then(function () {
      running = false;
      ui.launch.textContent = 'Launch Mission';
      ui.launch.disabled = !signedIn();
      paintBudget();
    });
  }

  function run() {
    var aoi = ui.aoi.value;
    var REG = window.REG || {};
    var region = REG[aoi] || null;
    var areaName = region ? region.n : 'All Kuwait';
    var constraints = (window.RC && window.RC.brief && window.RC.brief.c) ||
                      { saline: false, irrigation: true, shade: true, sand: false };

    var objective = 'Identify where increasing vegetation cover in ' + areaName +
      ' could measurably reduce land surface temperature, and shortlist a candidate planting zone. ' +
      'Zones are rejected below a ' + UPLIFT_FLOOR_PP.toFixed(1) +
      '-point projected cover uplift.';

    /* THE GUARDRAIL, BEFORE ANYTHING IS WRITTEN. */
    var screen = (KS.screenObjective ? KS.screenObjective(objective) : { flagged: false });

    /* All Kuwait yields one zone per governorate and so has no real
       geometry of its own; a single governorate gives a true outline. */
    var geom = region ? regionRing(region) : null;

    row('step', 'STEP 1 · LAUNCH',
      'Creating the mission and requesting a run from the database.');

    return window.sb.from('missions').insert({
      title: ('Greening candidate — ' + areaName).slice(0, 120),
      objective: objective.slice(0, 1500),
      area_geojson: geom || (KS.boundsToPolygon
        ? KS.boundsToPolygon({ west: 47.60, east: 47.82, south: 29.30, north: 29.44 })
        : null)
    }).select('id').single().then(function (m) {
      if (m.error) throw m.error;
      KS.missionId = m.data.id;
      return window.sb.rpc('launch_mission', { p_mission_id: KS.missionId });
    }).then(function (r) {
      if (r.error) throw r.error;
      KS.runId = r.data;
      ctx = { missionId: KS.missionId, runId: KS.runId, area: areaName, aoi: aoi, region: region };

      row('ok', 'RUN QUEUED',
        'mission_runs row created with status “queued”. Run id ' + short(KS.runId) + '.');
      setState('RUNNING');
      paintBudget();

      if (!screen.flagged) return null;
      /* Record the refusal FIRST so the trail shows the guardrail firing
         before any work was done. */
      return KS.logStepAs('satellite_data', 'guard.injection_screen', {
        allowed: false, reason: screen.reason, injection: true
      }).then(function () {
        row('bad', 'REFUSED', screen.reason);
      });

    }).then(function () {
      return step2(aoi, areaName);
    }).then(function (zones) {
      return step3(zones, constraints, areaName);
    });
  }

  function short(id) { return String(id || '').slice(0, 8); }

  /* ---- STEP 2 · Data Collection + Environmental Analysis ---------- */
  function step2(aoi, areaName) {
    var zones = window.zonesFor(aoi);

    row('step', 'STEP 2 · SATELLITE DATA',
      zones.length + ' candidate zones delineated on the 39 m grid for ' + areaName + '. [MEASURED] grid, [MODELLED] zone statistics.');

    return pause(520).then(function () {
      return KS.logStepAs('satellite_data', 'acq.zones', {
        args: { aoi: aoi, zones: zones.length, gsd_m: 39 }
      });
    }).then(function () {
      paintBudget();
      row('step', 'STEP 3 · ENVIRONMENTAL ANALYSIS',
        'Vegetation index, surface temperature and dust load combined; zones ranked by observed stress.');
      return pause(520);
    }).then(function () {
      return KS.logStepAs('environmental_analysis', 'env.rank', {
        args: { ranked: zones.length, top_score: zones[0] ? zones[0].score : null }
      });
    }).then(function () {
      paintBudget();
      return zones;
    });
  }

  /* ---- STEP 3 · THE SPECIES AGENT, AND ITS RE-RANKING LOOP -------- */
  function step3(zones, constraints, areaName) {
    var rejected = [];
    var rerank = 0;

    function attempt() {
      var zone = nextCandidate(zones, rejected, constraints);

      if (!zone) {
        /* The register guardrail, or nothing left to look at. */
        row('bad', 'STOPPED', REGISTER_SENTENCE);
        return KS.logStepAs('recommendation', 'spec.match', {
          allowed: false, reason: REGISTER_SENTENCE
        }).then(function () {
          paintBudget();
          return KS.finishRun('stalled', 'Species register exhausted under the stated constraints.');
        }).then(function () {
          setState('STALLED');
          stalledNote();
          return null;
        });
      }

      var n = rejected.length + 1;
      var d = decideZone(zone);
      var p = d.p;

      row('cand', 'CANDIDATE ' + n,
        zone.short + ' · score ' + zone.score + '/100 · cover ' +
        n1(p.from) + '% → ' + n1(p.to) + '% · uplift ' + n1(p.uplift) + ' pp');

      /* the shortlist pass */
      return KS.logStepAs('recommendation', 'spec.match', {
        args: { candidate: zone.id, rank: n, score: zone.score }
      }).then(function () {
        paintBudget();
        return pause(480);
      }).then(function () {
        if (d.pass) {
          row('ok', 'ACCEPTED', acceptSentence(zone, p));
          ctx.examined = n + ' of ' + zones.length + ' ranked candidates, ' +
                         rejected.length + ' rejected below the floor';
          return KS.logStepAs('impact_prediction', 'impact_model.project', {
            args: { candidate: zone.id, uplift_pp: p.uplift,
                    lst_lo: p.lstLo, lst_hi: p.lstHi, floor_pp: UPLIFT_FLOOR_PP }
          }).then(function () {
            paintBudget();
            return accept(zone, p, areaName);
          });
        }

        /* REJECT -> re-ranking subroutine -> loop back */
        rerank++;
        var reason = rejectSentence(zone, p, Math.min(rerank, MAX_RERANKS));
        row('bad', 'REJECTED', reason);
        rejected.push(zone.id);

        return KS.logStepAs('impact_prediction', 'impact_model.project', {
          allowed: false, reason: reason,
          args: { candidate: zone.id, uplift_pp: p.uplift, floor_pp: UPLIFT_FLOOR_PP }
        }).then(function () {
          paintBudget();
          if (rerank > MAX_RERANKS) {
            row('bad', 'STALLED', STALL_SENTENCE);
            return KS.logStepAs('impact_prediction', 'zone_reranker.next', {
              allowed: false, reason: STALL_SENTENCE
            }).then(function () {
              paintBudget();
              return KS.finishRun('stalled', 'Uplift floor not reached after ' + MAX_RERANKS + ' re-ranks.');
            }).then(function () {
              setState('STALLED');
              stalledNote();
              return null;
            });
          }
          row('rerank', 'RE-RANK ' + rerank + ' OF ' + MAX_RERANKS,
            'Zone removed from the candidate list. Ranking again — every loop has one fewer zone, so the loop terminates.');
          return pause(420).then(attempt);
        });
      });
    }

    return attempt();
  }

  /* A stall is a success of the guardrail. Say that. */
  function stalledNote() {
    var n = el('div', 'ksat-wf-note',
      'The run stalled, and that is the guardrail working. No report was drafted, nothing was written to the map, and every refusal above is a row in agent_steps with its numbers in refused_reason.');
    ui.log.appendChild(n);
    verifyRows();
  }

  /* ---- STEP 4 · Visualisation, then a DRAFT report ---------------- */
  function accept(zone, p, areaName) {
    row('step', 'STEP 4 · VISUALISATION',
      'Writing the accepted zone and its footprint to the results table.');

    var geom = ctx.region ? regionRing(ctx.region) : null;

    var siteBody = [
      'Accepted candidate: ' + zone.id,
      'Governorate: ' + zone.gov,
      '',
      figure('current vegetation cover', n1(p.from) + '%', 'MODELLED',
             'zonesFor() on the 39 m grid, seeded rng(4200) — demonstration dataset, not an observation'),
      '',
      figure('cover uplift', n1(p.uplift) + ' points', 'ESTIMATED',
             'zone ' + zone.short + ' cover ' + n1(p.from) + '% MODELLED (zonesFor, seed 4200)',
             COEF_LINE, COEF_CAVEAT),
      '',
      figure('projected surface temperature change',
             '−' + p.lstLo + ' to −' + p.lstHi + ' °C', 'ESTIMATED',
             n1(p.uplift) + ' points of cover uplift ESTIMATED',
             COEF_LINE, COEF_CAVEAT),
      '',
      figure('decision floor', UPLIFT_FLOOR_PP.toFixed(1) + ' points', 'SET BY RESEARCHER',
             'the smallest uplift this project will put a temperature number against; below ~4 points the published curve is being extrapolated to about 13% of its studied range'),
      '',
      'GEOMETRY NOTE: the polygon attached to this result is the ' + zone.gov +
        ' governorate outline [MODELLED, schematic]. Candidate zones carry no surveyed boundary of their own and none is implied.',
      '',
      NOT_A_CHOICE
    ].join('\n');

    return KS.logStepAs('visualization', 'vis.overlay', {
      args: { candidate: zone.id }
    }).then(function () {
      paintBudget();
      return KS.writeResult('site', 'Accepted candidate — ' + zone.id, siteBody, geom);
    }).then(function () {
      row('ok', 'OVERLAY WRITTEN',
        'results row of kind “site”, with the ' + zone.gov + ' footprint as GeoJSON.');
      return pause(480);
    }).then(function () {
      row('step', 'STEP 5 · REPORTING',
        'Composing a DRAFT. Nothing is published by this step.');
      var draft = buildDraft(zone, p, areaName);
      ctx.zone = zone; ctx.impact = p; ctx.draft = draft;

      return KS.logStepAs('reporting', 'draft.compose', {
        args: { chars: draft.length }
      }).then(function () {
        paintBudget();
        return KS.writeResult('narrative',
          'Draft report — ' + zone.id + ' (awaiting approval)', draft, null);
      });
    }).then(function () {
      /* The run is finished. The REPORT is not. Two different facts, and
         the UI must not merge them: researcher_finish_run sets
         mission_runs.status='complete' and missions.status='review'.
         Only generate_report makes missions.status='complete'. */
      return KS.finishRun('complete', null);
    }).then(function () {
      setState('AWAITING APPROVAL');
      row('ok', 'RUN COMPLETE',
        'The run is finished. The report is not — it is a draft until a person approves it.');
      verifyRows();
      return paintCheckpoint();
    });
  }

  function buildDraft(zone, p, areaName) {
    var d = new Date();
    return [
      'KUWAITSAT GREEN INTELLIGENCE — DECISION-SUPPORT DRAFT',
      '================================================================',
      'Prepared: ' + d.toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
      'Area of interest: ' + areaName,
      'Run id: ' + short(ctx.runId),
      '',
      '1. RECOMMENDED CANDIDATE',
      '   ' + zone.id + ' · observed stress score ' + zone.score + '/100',
      '',
      '2. FIGURES, EACH WITH ITS PROVENANCE',
      figure('cover uplift', n1(p.uplift) + ' points', 'ESTIMATED',
             'zone cover ' + n1(p.from) + '% → ' + n1(p.to) + '% MODELLED (zonesFor, seed 4200)',
             COEF_LINE, COEF_CAVEAT),
      '',
      figure('projected surface temperature change',
             '−' + p.lstLo + ' to −' + p.lstHi + ' °C', 'ESTIMATED',
             n1(p.uplift) + ' points of cover uplift ESTIMATED',
             COEF_LINE, COEF_CAVEAT),
      '',
      figure('ground sample distance', '39 m', 'MEASURED',
             'KuwaitSat-1 published mission record, sources [3][4]'),
      '',
      '3. DECISION PATH',
      '   Floor: ' + UPLIFT_FLOOR_PP.toFixed(1) + ' points of projected cover uplift.',
      '   Candidates examined: ' + (ctx.examined || 'see the agent step log'),
      '   Every rejected zone is an agent_steps row with its numbers in refused_reason.',
      '',
      '4. LIMITS',
      '   ' + NOT_A_CHOICE,
      '   The zone statistics are a demonstration dataset, not an observation.',
      '   No recommendation may be acted on without human review and',
      '   competent-authority approval.'
    ].join('\n');
  }

  /* ===================================================================
     8 · READ THE ROWS BACK

     The spec wanted a live status stream. Realtime is refused (D-6), and
     polling a run the browser itself is performing would be theatre. So
     instead: after the run, SELECT the steps back with NAMED COLUMNS and
     show the count. That is evidence the rows landed and that RLS let
     this researcher read their own — which is the thing worth proving.

     Never select('*'): `*` requests ungranted columns like raw_prompt and
     raw_response and errors, correctly. `tool` IS in the grant
     (03_grants.sql:98) but is NOT in the my_agent_steps view, so this
     reads the table directly.
     =================================================================== */

  function verifyRows() {
    if (!haveDb() || !ctx || !ctx.runId) return;
    window.sb.from('agent_steps')
      .select('id,step_name,tool,allowed,refused_reason,status,started_at')
      .eq('run_id', ctx.runId)
      .order('started_at', { ascending: true })
      .then(function (r) {
        if (r.error) { console.warn('[ksat-workflow] readback:', r.error.message); return; }
        var rows = r.data || [];
        var refused = rows.filter(function (x) { return x.allowed === false; }).length;
        var n = el('div', 'ksat-wf-verify',
          'Read back from the database: ' + rows.length + ' agent_steps rows for this run, ' +
          refused + ' of them refusals. Row-level security returned them because this run belongs to you.');
        ui.log.appendChild(n);
      });
  }

  /* ===================================================================
     9 · THE HUMAN CHECKPOINT

     Reached when the run is complete, a narrative draft exists, and no
     reports row exists for the mission.

     WHICH ONE IS THE REAL GUARANTEE: the grant, not this card.
       revoke execute on generate_report from public, anon;
       grant  execute on generate_report to authenticated;

     DO NOT OVERCLAIM THIS. Tested against the live database on
     21 Sep 2026, five ways (03-security/evidence/se-m5-checkpoint-*.md):

       the owner, straight to the RPC, no button   ACCEPTED
       ...and approved_by came back as him         cannot be forged
       a researcher -> a colleague's mission       REFUSED Mission not found.
       service_role (the automation engine)        REFUSED permission denied
       anon (signed out)                           REFUSED permission denied

     So a signed-in researcher with DevTools open CAN produce a report
     without pressing this button. Saying otherwise is a claim a judge
     can disprove in thirty seconds, so we do not make it.

     What the checkpoint actually guarantees is narrower and worth more:
     NO REPORT EXISTS WITHOUT A NAMED, SIGNED-IN HUMAN WHO OWNS THE
     MISSION. The researcher who skips the card is still a person putting
     their own name on their own mission's report - approval through a
     different keyboard, not an escape from it. approved_by is
     (select auth.uid()), read from the verified JWT and never from an
     argument, so it cannot be pointed at somebody else.

     What is genuinely impossible is the part that matters: the agent
     cannot approve itself. generate_report is deliberately absent from
     the service_role grant list that carries agent_log_step /
     agent_write_result / agent_finish_run, so n8n, an Edge Function, or
     anything else holding the service key is refused outright.

     The grant makes the accountability TRUE; this card makes it VISIBLE
     and makes the draft reviewable before it is signed.
     =================================================================== */

  function paintCheckpoint() {
    if (!ui.check || !ctx) return Promise.resolve();

    /* Resumable and idempotent: if a report already exists, never ask
       again. Reloading the page is not a way past the checkpoint, and
       leaving the tab wrote nothing. */
    return existingReport(ctx.missionId).then(function (rep) {
      ui.check.textContent = '';
      ui.check.hidden = false;

      if (rep) { paintApproved(rep); return; }

      var head = el('div', 'ksat-wf-ck-head');
      head.appendChild(el('span', 'ksat-wf-ck-icon', '⏸'));
      head.appendChild(el('span', 'ksat-wf-ck-title',
        'Agent proposes report — awaiting researcher approval.'));
      ui.check.appendChild(head);

      var ar = el('p', 'ksat-wf-ck-ar',
        'الوكيل يقترح تقريراً — بانتظار موافقة الباحث.');
      ar.setAttribute('dir', 'rtl');
      ar.setAttribute('lang', 'ar');
      ui.check.appendChild(ar);

      ui.check.appendChild(el('p', 'ksat-wf-ck-p',
        'The agents have proposed the report below. It is a draft. It is not saved, not published, and not visible to anyone else until you approve it. Your name goes on it.'));

      var pre = el('pre', 'ksat-wf-draft', ctx.draft);
      pre.setAttribute('tabindex', '0');
      pre.setAttribute('aria-label', 'Draft report');
      ui.check.appendChild(pre);

      var msg = el('div', 'ksat-wf-ck-msg');
      msg.setAttribute('role', 'status');
      msg.setAttribute('aria-live', 'polite');

      var acts = el('div', 'ksat-wf-ck-acts');

      var ok = el('button', 'btn pri ksat-wf-approve', 'Approve and generate report');
      ok.type = 'button';

      /* Pre-flight mirror of generate_report's own rule, so the button
         explains itself instead of surfacing a Postgres error. */
      if (!ctx.draft || ctx.draft.length < MIN_REPORT_CHARS) {
        ok.disabled = true;
        msg.textContent = 'This draft is only ' + (ctx.draft ? ctx.draft.length : 0) +
          ' characters. A report needs at least ' + MIN_REPORT_CHARS + '.';
      }

      ok.addEventListener('click', function () { approve(ok, msg); });
      acts.appendChild(ok);

      var no = el('button', 'btn sm ksat-wf-decline', 'Decline');
      no.type = 'button';
      no.addEventListener('click', function () { decline(); });
      acts.appendChild(no);

      ui.check.appendChild(acts);
      ui.check.appendChild(el('p', 'ksat-wf-ck-wait',
        'Waiting for you. Nothing happens until you press this.'));
      ui.check.appendChild(msg);

      try { head.scrollIntoView({ block: 'nearest' }); } catch (e) {}
    });
  }

  function existingReport(missionId) {
    if (!haveDb() || !missionId) return Promise.resolve(null);
    return window.sb.from('reports')
      .select('id,created_at')
      .eq('mission_id', missionId)
      .limit(1)
      .then(function (r) {
        if (r.error) { console.warn('[ksat-workflow] reports:', r.error.message); return null; }
        return (r.data && r.data[0]) || null;
      });
  }

  function approve(btn, msg) {
    btn.disabled = true;
    btn.textContent = 'Publishing…';
    msg.textContent = '';

    /* The single write a human makes in the whole flow. */
    window.sb.rpc('generate_report', {
      p_mission_id: ctx.missionId,
      p_body_md: ctx.draft
    }).then(function (r) {
      if (r.error) throw r.error;
      setState('MISSION COMPLETE');
      paintApproved({ id: r.data, created_at: new Date().toISOString() });
    }).catch(function (e) {
      btn.disabled = false;
      btn.textContent = 'Approve and generate report';
      msg.textContent = humanError(e);
    });
  }

  function paintApproved(rep) {
    ui.check.textContent = '';
    var head = el('div', 'ksat-wf-ck-head ksat-wf-ck-ok');
    head.appendChild(el('span', 'ksat-wf-ck-icon', '✓'));
    head.appendChild(el('span', 'ksat-wf-ck-title', 'Mission Complete — report approved'));
    ui.check.appendChild(head);

    var when = '';
    try { when = new Date(rep.created_at).toISOString().slice(0, 16).replace('T', ' ') + ' UTC'; }
    catch (e) { when = 'just now'; }

    ui.check.appendChild(el('p', 'ksat-wf-ck-p',
      'You approved this report on ' + when + '. It is published under your name: reports.approved_by is your account id, taken from your session and not from anything this page sent.'));

    if (ctx && ctx.draft) {
      var pre = el('pre', 'ksat-wf-draft', ctx.draft);
      pre.setAttribute('tabindex', '0');
      pre.setAttribute('aria-label', 'Approved report');
      ui.check.appendChild(pre);
    }

    ui.check.appendChild(el('p', 'ksat-wf-ck-trace',
      'Trace any figure: run id ' + short(ctx && ctx.runId) + ', report id ' + short(rep && rep.id) +
      '. The steps behind it are in agent_steps for that run, the rejected zones with their numbers in refused_reason.'));
    ui.check.hidden = false;
  }

  /* Decline writes NOTHING. The findings and the agent log are kept —
     the audit trail recording that a human looked and said no is a
     feature, not a gap. */
  function decline() {
    ui.check.textContent = '';
    var head = el('div', 'ksat-wf-ck-head');
    head.appendChild(el('span', 'ksat-wf-ck-icon', '⊘'));
    head.appendChild(el('span', 'ksat-wf-ck-title', 'Report declined'));
    ui.check.appendChild(head);
    ui.check.appendChild(el('p', 'ksat-wf-ck-p',
      'You declined this report. The findings and the agent log are kept; no report was written. Launch the mission again to produce a new draft.'));
    setState('DECLINED');
  }

  /* ===================================================================
     10 · BOOT
     =================================================================== */

  function boot() {
    var tries = 0;
    var t = setInterval(function () {
      if (mount() || ++tries > 60) clearInterval(t);
    }, 150);

    /* The tier and the sign-in state both come from the session. */
    if (haveDb()) {
      try {
        window.sb.auth.onAuthStateChange(function (evt, session) {
          KS.live = !!session;
          refreshGate();
        });
      } catch (e) {}
      window.sb.auth.getSession().then(function (r) {
        KS.live = !!(r && r.data && r.data.session);
        refreshGate();
      }).catch(function () {});
    }

    /* Exposed for the console and for anybody testing the loop without
       the UI. Nothing here grants anything the caller did not have. */
    WF.UPLIFT_FLOOR_PP = UPLIFT_FLOOR_PP;
    WF.SPECIES_FLOOR = SPECIES_FLOOR;
    WF.MAX_RERANKS = MAX_RERANKS;
    WF.decideZone = decideZone;
    WF.nextCandidate = nextCandidate;
    WF.start = start;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})();
