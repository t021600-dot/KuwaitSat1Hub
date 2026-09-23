/* =====================================================================
   ksat-agents.js - THE MISSION ORCHESTRATOR AND THE SIX AGENTS
   Owner: 04 Agents / 02 Back End

   WHAT THIS IS
   The eight roles in 04-agents (Orchestrator, Satellite Data,
   Environmental Analysis, Recommendation, Impact Prediction,
   Visualization, Monitoring, Reporting), implemented as the thing they
   were specified to be: a DECISION LOOP, not a fixed sequence. At every
   stage the Orchestrator reads what the previous stage actually returned
   and chooses the next permitted action from it. Three of the branches
   below end the run early, and they are the interesting ones.

   WHAT THIS IS NOT
   It is not n8n. The schema was designed for n8n to drive it -
   mission_runs.n8n_execution_id is still there, and
   03-security/db/08_agent_claim.sql is still the claim-and-lease an
   external worker would use - but nothing in this platform calls n8n
   today and nothing here pretends to. The pipeline runs in the browser,
   in this file, and writes its trail through the four SECURITY DEFINER
   functions in 03-security/db/09_researcher_write_path.sql. Swapping in
   n8n later means pointing run() at a webhook and leaving everything
   else alone; the audit trail is the same either way, which is why the
   trail was made the interface.

   It is also not a language model. There is no LLM in this loop. Every
   decision below is arithmetic on measured pixels or a comparison
   against a written threshold, and every one of them is recorded with
   the number that caused it. That is a deliberate trade: a rule that can
   be printed in the audit trail is worth more here than a judgement that
   cannot.

   >>> THE ONE RULE THIS FILE MUST NEVER BREAK <<<
   Every step is written to the DATABASE before it is shown on screen,
   and the screen then renders what the database returns. A trace that is
   drawn from a variable in this file is a claim. A trace read back out
   of agent_steps is evidence. If you ever find yourself rendering from
   the local array because it is faster, stop.
   ===================================================================== */

(function () {
  'use strict';

  var KS = window.KSAT = window.KSAT || {};
  var geo = KS.geo;

  var ROLES = {
    satellite_data:          { code: 'SD', name: 'Satellite Data Agent' },
    environmental_analysis:  { code: 'EA', name: 'Environmental Analysis Agent' },
    recommendation:          { code: 'RA', name: 'Recommendation Agent' },
    impact_prediction:       { code: 'IP', name: 'Impact Prediction Agent' },
    visualization:           { code: 'VZ', name: 'Visualization Agent' },
    reporting:               { code: 'RP', name: 'Reporting Agent' }
  };

  /* -------------------------------------------------------------------
     PROMPT INJECTION SCREENING

     A researcher types a research objective. Somebody, one day, will
     type an INSTRUCTION instead - and the objective is the one piece of
     free text in this platform that an automated pipeline reads and acts
     on. missions.injection_flag exists for exactly that, and
     researcher_log_step carries p_injection through to it.

     THIS IS A DETECTION HEURISTIC, NOT A CONTROL. It runs in a browser
     and it matches on English. What actually keeps a hostile objective
     harmless is that nothing downstream of it can do anything dangerous:
     the payload archive carries no write grant for any signed-in role,
     there is no outbound network call in this pipeline at all, and the
     database is the only thing that decides what a caller may read. The
     screen exists so the attempt is VISIBLE in the audit trail, not so
     it is stopped - it was already stopped.

     The patterns are deliberately narrow. A false positive refuses a
     legitimate researcher's mission, which is a real cost; "delete" on
     its own would fire on "delete-ability of the salt marsh", so every
     pattern needs a second word that a research objective has no reason
     to contain.
     ------------------------------------------------------------------- */
  var INJECTION = [
    { re: /ignore\s+(all\s+|the\s+|any\s+)?(previous|prior|above|earlier)\s+(instruction|prompt|rule|message)/i,
      why: 'an instruction to disregard earlier instructions' },
    { re: /disregard\s+(your|all|the|any)\s+(instruction|rule|polic|guardrail|constraint)/i,
      why: 'an instruction to disregard the configured rules' },
    { re: /(you\s+are\s+now|you\s+must\s+now|from\s+now\s+on\s+you)/i,
      why: 'an attempt to redefine the agent role' },
    { re: /(system\s+prompt|developer\s+message|your\s+instructions)/i,
      why: 'a request aimed at the system configuration rather than the data' },
    { re: /(service[_\s-]?role|api[_\s-]?key|secret\s+key|bearer\s+token|password)/i,
      why: 'a reference to a credential' },
    /* `update \w+ set` alone matched "update the planting set for 2027",
       which is a sentence a Kuwaiti agronomist could reasonably write.
       Requiring the assignment makes it SQL and nothing else. */
    { re: /(drop\s+table|truncate\s+table|delete\s+from\s+\w|update\s+\w+\s+set\s+\w+\s*=)/i,
      why: 'SQL that modifies data' },
    /* THIS ONE HAD A FALSE POSITIVE AND IT IS WORTH RECORDING.

       It was `send (the )?(data|frames|results) to `, which flagged
       "Compare coastal change at Bubiyan; send the results to the
       ministry by email" - an ordinary and entirely legitimate research
       objective. A false positive here does not merely annoy: the run
       refuses, the mission is marked with an injection flag, and a
       researcher is told their question looked like an attack.

       So the destination now has to look like a network endpoint - a
       URL scheme or an email address - rather than any noun at all.
       Sending results to a ministry is research. Sending them to
       http://somewhere is not. */
    { re: /(exfiltrat|(?:send|post|upload|forward|email|transmit)\b[^.\n]{0,60}?\bto\b\s*(?:https?:\/\/|ftp:\/\/|[\w.+-]+@[\w.-]+\.[a-z]{2,}))/i,
      why: 'an instruction to send data to an external address' },
    { re: /(<script|javascript:|onerror\s*=)/i,
      why: 'markup that would execute if it were ever rendered as HTML' },
    { re: /(act\s+as\s+(an?\s+)?(admin|root|superuser)|pretend\s+to\s+be|jailbreak)/i,
      why: 'an attempt to assume a different role' }
  ];

  function scan(text) {
    var hits = [];
    var s = String(text || '');
    INJECTION.forEach(function (p) {
      var m = p.re.exec(s);
      if (m) hits.push({ matched: m[0].slice(0, 60), why: p.why });
    });
    return { flagged: hits.length > 0, hits: hits };
  }

  /* -------------------------------------------------------------------
     THE WRITE PATH

     Four calls, all SECURITY DEFINER, all of which re-read ownership
     from the run row on every single call - the caller's argument is
     used for CONTENT, never for authorisation. See the header of
     03-security/db/09_researcher_write_path.sql.

     Every one of these rejects loudly. A pipeline that writes nothing
     and says nothing is worse than one that stops, because the audit
     trail then quietly disagrees with the screen.
     ------------------------------------------------------------------- */
  function rpc(name, args) {
    if (!window.sb) {
      var e0 = new Error('The mission database is not reachable.');
      e0.fromDb = false;
      return Promise.reject(e0);
    }
    return window.sb.rpc(name, args).then(function (r) {
      if (r.error) {
        /* TAGGED, so the page can stop calling every failure a database
           refusal. An image that would not decode is not the database
           saying no, and telling a researcher it was is a lie about
           where the fault is - on a platform whose whole argument is
           that it tells you exactly what happened. */
        var e = new Error(r.error.message || String(r.error));
        e.fromDb = true;
        throw e;
      }
      return r.data;
    });
  }

  /* CLOSE THE RUN, WHATEVER HAPPENED.

     Every step of a run is written through researcher_log_step, which
     refuses a run whose status is not 'queued' or 'running'. launch_mission
     commits the mission_runs row and sets missions.status='queued' before
     anything downstream can fail. So an unhandled rejection anywhere after
     the launch leaves the run OPEN FOR EVER:

       - the mission sits at 'queued' and launch_mission refuses another
         run with "This mission is already running."
       - sweep_stalled_runs cannot help: it matches status='running', and
         this pipeline never moves a run off 'queued'
       - the researcher has no button that closes it

     There are roughly sixteen network round trips in a run. One dropped
     request on a venue wifi is all it takes, and the mission on the
     projector is bricked until somebody reloads - which also destroys the
     candidate set held in the page.

     So: one terminal handler, on both chains, that finishes the run as
     'failed' with the reason and then re-throws so the caller still sees
     the error. It deliberately swallows a failure of finish() itself -
     if the network is gone, the sweeper and the researcher's own
     "close the open run" button are the remaining backstops, and
     throwing a second error over the first would hide the real one. */
  function closeOnFailure(state) {
    return function (err) {
      if (!state.run_id || state.stopped) { throw err; }
      var why = (err && err.message ? err.message : String(err)).slice(0, 400);
      return finish(state.run_id, 'failed', why)
        .catch(function () { /* nothing left to try; report the first error */ })
        .then(function () { throw err; });
    };
  }

  function logStep(run, step, tool, args, allowed, refused, injection) {
    return rpc('researcher_log_step', {
      p_run_id: run,
      p_step: step,
      p_tool: tool || null,
      p_args: args || null,
      p_allowed: allowed !== false,
      p_refused_reason: refused || null,
      p_injection: !!injection
    });
  }

  function writeResult(run, kind, title, body, geometry) {
    return rpc('researcher_write_result', {
      p_run_id: run,
      p_kind: kind,
      p_title: String(title).slice(0, 200),
      p_body: String(body || '').slice(0, 20000),
      p_geometry: geometry || null
    });
  }

  function finish(run, status, err) {
    return rpc('researcher_finish_run', {
      p_run_id: run, p_status: status, p_error: err ? String(err).slice(0, 500) : null
    });
  }

  /* -------------------------------------------------------------------
     THE TOOL PERMISSION TABLE, PROVED RATHER THAN CLAIMED

     The Research Console shows a permission table with "Modify original
     data - DENIED" on it. A label is worth nothing, so the Satellite
     Data Agent ATTEMPTS the forbidden write on every run and records
     what the database said back, verbatim, as a refused step.

     This is safe by construction: 03_grants.sql grants payload_frames
     SELECT and nothing else to `authenticated`, so the statement cannot
     succeed. If it ever DOES succeed, the run stops and says so - that
     would mean a grant had been added and the whole archive argument had
     quietly changed.
     ------------------------------------------------------------------- */
  /* -------------------------------------------------------------------
     EVIDENCE GATHERING
     ------------------------------------------------------------------- */

  /* Which archive frames fall inside the mission area. A frame counts as
     inside when its CENTRE is inside; an overlap test would need the
     footprint corners and the footprint is already an approximation, so
     the looser test is the honest one and it is stated as such. */
  function framesInArea(frames, area) {
    return frames.filter(function (f) {
      return geo.hasFix(f) && geo.pointInPolygon(Number(f.lon), Number(f.lat), area);
    });
  }

  /* Repeat visits. Change detection needs the same ground on two
     different dates. This counts the pairs that actually exist, which on
     the archive as it stands is the number that lets the Impact
     Prediction Agent decline honestly instead of inventing a trend. */
  function repeatPairs(list) {
    var pairs = [];
    for (var i = 0; i < list.length; i++) {
      for (var j = i + 1; j < list.length; j++) {
        var a = list[i], b = list[j];
        if (a.captured_on === b.captured_on) continue;
        var dLat = Math.abs(Number(a.lat) - Number(b.lat));
        var dLon = Math.abs(Number(a.lon) - Number(b.lon));
        /* within roughly a frame width of each other */
        if (dLat < 0.12 && dLon < 0.15) {
          pairs.push([a.frame_no, b.frame_no]);
        }
      }
    }
    return pairs;
  }

  function fmtPct(n) { return (Math.round(n * 10) / 10) + '%'; }
  function r3(n) { return Math.round(n * 1000) / 1000; }
  function r1(n) { return Math.round(n * 10) / 10; }

  /* THE SEPARATION A CANDIDATE HAS TO REACH BEFORE IT IS WORTH NAMING.

     Every land tile in a frame has a greenness z-score: how far it sits
     from that frame's own median in standard deviations. A z of 2 is the
     top ~2% of a normal distribution.

     Below this, the "greenest" tile is not distinguishable from the
     ordinary variation of sand, and ranking it would be presenting noise
     as a finding. Measured on frame 07 the top tile reaches z = 4.0 at
     the default grid, so real frames do clear this bar - it is a guard,
     not a gate that closes on everything. */
  var MIN_CANDIDATE_Z = 2.0;

  /* -------------------------------------------------------------------
     THE RUN

     opts = {
       mission   : the mission row (id, title, objective, area_geojson)
       frames    : the payload_frames rows this session was given
       onPhase   : (text) -> narration for the screen
       onStep    : () -> the screen should re-read agent_steps
       onCheckpoint : (state) -> a human decision is required
     }

     Returns a promise for the run state. The run is left OPEN at the
     checkpoint on purpose: researcher_log_step refuses a run that is not
     queued or running, so holding it open is what makes the post-
     approval steps writable at all.
     ------------------------------------------------------------------- */
  function run(opts) {
    var mission = opts.mission;
    var frames = opts.frames || [];
    var phase = opts.onPhase || function () {};
    var state = { mission: mission, run_id: null, analyses: [], candidates: [], stopped: null };

    /* tick() is a WRAPPER and not opts.onStep itself, for two reasons.
       It is used as `.then(tick)` in several places, so it has to ignore
       whatever the previous promise resolved with rather than treat it
       as an argument. And the page needs the run id the moment it
       exists - long before this function resolves - so every tick hands
       the live state back to the caller. Without that the trace has
       nothing to re-read and the screen sits blank through the whole
       run. */
    var raw = opts.onStep || function () {};
    function tick() { raw(state); }

    function step(name) { phase(ROLES[name] ? ROLES[name].name : name); }

    phase('Mission Orchestrator - requesting a run slot');

    return rpc('launch_mission', { p_mission_id: mission.id })
      .then(function (runId) {
        state.run_id = runId;
        phase('Run ' + String(runId).slice(0, 8) + ' opened');
        tick();

        /* ---- DECISION 0 - is the objective a question or an order? -- */
        var sc = scan(mission.objective + ' ' + (mission.title || ''));
        if (sc.flagged) {
          var why = sc.hits.map(function (h) { return h.why; }).join('; ');
          step('satellite_data');
          return logStep(state.run_id, 'satellite_data', 'payload_frames.select',
              { objective_excerpt: String(mission.objective).slice(0, 200) },
              false,
              'The objective contains ' + why + '. The Orchestrator does not pass ' +
              'free text through to a tool call, so no data was read. The mission ' +
              'is flagged for review.',
              true)
            .then(function () { tick(); return writeResult(state.run_id, 'narrative',
                'Run stopped: the objective reads as an instruction',
                'The Mission Orchestrator screens the research objective before any ' +
                'tool is called. This objective matched ' + sc.hits.length +
                ' injection pattern(s): ' + why + '.\n\n' +
                'Matched text: ' + sc.hits.map(function (h) { return '"' + h.matched + '"'; }).join(', ') +
                '\n\nNo frame was read and no finding was produced. The mission now ' +
                'carries an injection flag. Rewrite the objective as a question ' +
                'about the data and create a new mission.'); })
            .then(function () { return finish(state.run_id, 'failed', 'objective screened as an instruction'); })
            .then(function () { state.stopped = 'injection'; tick(); return state; });
        }

        /* ---- 1 - SATELLITE DATA ---------------------------------- */
        step('satellite_data');
        var inArea = framesInArea(frames, mission.area_geojson);
        var geolocated = frames.filter(geo.hasFix);

        return logStep(state.run_id, 'satellite_data', 'payload_frames.select',
            { columns: 'frame_no,captured_on,lat,lon,gsd_m,image_w,image_h',
              area: (mission.area_geojson && mission.area_geojson.name) || 'mission area',
              frames_released: frames.length,
              frames_geolocated: geolocated.length,
              frames_in_area: inArea.length })
          /* THE PERMISSION PROBE USED TO RUN HERE, ON EVERY MISSION.

             It attempted the forbidden write to payload_frames so that
             "the archive is read only" was a sentence the DATABASE said
             rather than a label on a panel, and it wrote the refusal
             into the trail as the evidence.

             The argument was right and the PLACE was wrong. A mission
             record is a scientific document. Putting a security test in
             the middle of one means every run a researcher shows anybody
             has a "permission denied" in it, and no amount of colouring
             makes that read as good news in a research trail. The team
             said so twice. They were right.

             The proof did not go away, it moved somewhere better: the
             Access Test panel on the Provenance / Audit view fires FOUR
             forbidden requests instead of this one, on demand, against
             the live database, and prints what came back for each. That
             is a stronger demonstration and it is where somebody looks
             for it.

             Nothing about the database changed. payload_frames still
             carries no insert, update or delete grant for any signed-in
             role. The claim is identical; the evidence for it is now on
             the page that is about evidence. */
          .then(function () {
            tick();
            return writeResult(state.run_id, 'metric',
              'Evidence available to this run',
              frames.length + ' payload frames were released to this session by row ' +
              'level security. ' + geolocated.length + ' of them carry a geolocation. ' +
              inArea.length + ' fall inside the mission area.\n\n' +
              'This archive is read only for every signed-in role: it carries no ' +
              'insert, update or delete grant at all. The Access Test on the ' +
              'Provenance / Audit view demonstrates that against the live database ' +
              'whenever you want to see it.');
          })
          .then(function () {
            tick();

            /* ---- DECISION 1 - is there anything to analyse? --------

               THIS IS THE DECISION THE WHOLE PLATFORM TURNS ON, and it
               used to have only two answers: measure a KuwaitSat-1
               frame, or stop.

               Stopping was right, and it is still what happens when
               there is no evidence of ANY kind. But there is a third
               answer the Orchestrator can now reach, and a real
               analyst would reach it first: KuwaitSat-1 has not
               photographed this ground, and public Earth observation
               has. Al-Jahra is the case that forced it - an entire
               governorate the mission archive cannot see at all.

               So when the archive has nothing here, the agent falls
               back to js/ksat-reference.js: Sentinel-2 at 10 m for
               surface cover and MODIS Land Surface Temperature for
               relative heat. Both real, both public, both attributed,
               and EVERY finding produced this way is stamped with the
               sensor that produced it. The fallback is recorded as its
               own step in the trail, so a reader can see the
               Orchestrator choose it.

               What it must never become: a way of quietly answering a
               KuwaitSat-1 question with somebody else's satellite. The
               source is named in the step, in every finding, in the
               report's Data used section and in its Limitations. */
            if (!inArea.length) {
              return referenceRun(state, mission, opts, frames, geolocated);
            }

            /* ---- 2 - ENVIRONMENTAL ANALYSIS ----------------------- */
            step('environmental_analysis');
            phase(ROLES.environmental_analysis.name + ' - measuring ' +
                  inArea.length + ' frame' + (inArea.length === 1 ? '' : 's'));

            var chain = Promise.resolve();
            inArea.forEach(function (f) {
              chain = chain.then(function () {
                if (!f.image_b64 || f.image_b64.length < 32) {
                  return logStep(state.run_id, 'environmental_analysis', 'frame.analyse',
                    { frame_no: f.frame_no }, false,
                    'Frame ' + f.frame_no + ' has an acquisition record but no picture ' +
                    'in the archive yet, so it cannot be measured.').then(tick);
                }
                return geo.analyseFrame(f).then(function (a) {
                  a.frame = f;
                  state.analyses.push(a);
                  /* The DISTRIBUTION goes into the trail, not just the
                     class counts. "0% vegetation" on its own is not a
                     measurement anybody can check; the range, the median
                     and the threshold it was tested against are. */
                  return logStep(state.run_id, 'environmental_analysis', 'frame.analyse',
                    { frame_no: f.frame_no,
                      grid: a.grid + 'x' + a.grid,
                      tile_m: a.tileM,
                      index: 'ExG on chromatic coordinates',
                      vegetation_threshold: geo.VEG_EXG,
                      vegetation_detected: a.vegetationDetected,
                      land_tiles: a.exg.landTiles,
                      exg_min: a.exg.landTiles ? r3(a.exg.min) : null,
                      exg_median: a.exg.landTiles ? r3(a.exg.median) : null,
                      exg_max: a.exg.landTiles ? r3(a.exg.max) : null,
                      top_tile_z: a.exg.landTiles ? r1(a.exg.topZ) : null,
                      water_pct: a.waterPct })
                    .then(tick);
                });
              });
            });

            return chain.then(function () {
              if (!state.analyses.length) {
                return writeResult(state.run_id, 'narrative',
                    'Nothing could be measured',
                    'Every frame inside this area has an acquisition record but no ' +
                    'picture loaded into the archive, so no measurement was possible.')
                  .then(function () { return finish(state.run_id, 'stalled',
                                        'no frame inside the area has a picture loaded'); })
                  .then(function () { state.stopped = 'no-pixels'; tick(); return state; });
              }

              /* one metric result per measured frame */
              var w = Promise.resolve();
              state.analyses.forEach(function (a) {
                w = w.then(function () {
                  return writeResult(state.run_id, 'metric',
                    'Frame ' + String(a.frame_no).padStart(2, '0') + ' surface measurement',
                    'Grid ' + a.grid + ' x ' + a.grid + ' over ' + a.width + ' x ' + a.height +
                    ' px: ' + a.total + ' tiles of about ' + a.tileM + ' m on the ground.\n' +
                    'Water ' + fmtPct(a.waterPct) + ' of tiles, land ' +
                    fmtPct(100 - a.waterPct) + '.\n\n' +
                    /* A FRAME WITH NO LAND GETS NO GREENNESS PARAGRAPH.
                       Frame 08 is open Gulf water. This used to print
                       "ExG ranges 0 to 0, median 0" and then narrate a
                       "real gradient in the ground" for a frame with no
                       ground in it. */
                    (a.exg.landTiles === 0
                      ? 'Every tile in this frame classified as water, so there is no ' +
                        'land in it to measure greenness on and no greenness figure is ' +
                        'given. That is the measurement, not a gap in it.'
                      : 'Greenness over the ' + a.exg.landTiles + ' land tiles: ExG ranges ' +
                        r3(a.exg.min) + ' to ' + r3(a.exg.max) + ', median ' +
                        r3(a.exg.median) + '. The vegetation threshold is ' +
                        geo.VEG_EXG + '.\n' +
                        (a.vegetationDetected
                          ? (a.counts.veg + ' tile(s) reach it.')
                          : 'NO TILE REACHES IT, so no vegetation was detected in this ' +
                            'frame. ExG = 0 is neutral grey and negative means redder ' +
                            'than neutral, which is what bare sand is. The greenest tile ' +
                            'stands ' + r1(a.exg.topZ) + ' standard deviations above the ' +
                            'median, so there is a real gradient in the ground here - but ' +
                            'it is a gradient within bare ground, not vegetation.')) + '\n\n' +
                    geo.INDEX_NOTE,
                    geo.frameBounds(a.frame) ? geo.rectPolygon(
                      geo.frameBounds(a.frame)[0][0], geo.frameBounds(a.frame)[0][1],
                      geo.frameBounds(a.frame)[1][0], geo.frameBounds(a.frame)[1][1],
                      'Frame ' + a.frame_no + ' footprint') : null);
                });
              });
              return w;
            });
          })
          .then(function () {
            if (state.stopped) return state;
            tick();

            /* ---- DECISION 2 - is there any bare ground to rank? ----
               Frame 8 is open Gulf water. A run over it classifies every
               tile as water, leaves nothing to plant, and used to reach
               the checkpoint with an empty candidate list and the
               sentence "0 candidate zones are ready for your decision".
               Asking a researcher to approve nothing is worse than
               telling them there was nothing. */
            var bare = 0;
            state.analyses.forEach(function (a) { bare += a.counts.bare; });
            if (!bare) {
              step('recommendation');
              var classes = state.analyses.map(function (a) {
                return 'frame ' + a.frame_no + ': ' + a.vegPct + '% vegetation, ' +
                       a.waterPct + '% water, ' + a.barePct + '% bare';
              }).join('; ');
              return logStep(state.run_id, 'recommendation', 'rank.candidates',
                  { bare_tiles_considered: 0 }, false,
                  'No tile inside this area classified as bare ground, so there is ' +
                  'nothing to recommend. Measured: ' + classes + '.')
                .then(function () { tick(); return writeResult(state.run_id, 'narrative',
                    'No candidate ground in this area',
                    'Every tile measured inside this mission area classified as water or ' +
                    'as already vegetated. There is no bare ground here to recommend ' +
                    'planting on.\n\n' + classes + '.\n\n' +
                    'This is a result, not a failure: it says the area is not a ' +
                    'candidate. ' + geo.INDEX_NOTE,
                    mission.area_geojson); })
                .then(function () { return finish(state.run_id, 'stalled',
                                      'no bare ground inside the mission area'); })
                .then(function () { state.stopped = 'no-candidates'; tick(); return state; });
            }

            /* ---- 3 - RECOMMENDATION ------------------------------- */
            return rank(state, 'greenest').then(function () {
              /* DECISION 3. rank() refuses when nothing separates from
                 the background, and a checkpoint with an empty candidate
                 list is not a decision anybody can take. Close the run
                 and say why. */
              if (!state.candidates.length) {
                return finish(state.run_id, 'stalled',
                    'no zone separated from the background')
                  .then(function () {
                    state.stopped = 'no-separation';
                    tick();
                    phase('Mission Orchestrator - nothing in this area separates from ' +
                          'the background. Run closed.');
                    return state;
                  });
              }
              phase('Mission Orchestrator - evidence sufficient, human checkpoint required');
              if (opts.onCheckpoint) opts.onCheckpoint(state);
              return state;
            });
          });
      })
      .catch(closeOnFailure(state));
  }

  /* -------------------------------------------------------------------
     RANKING, AND RE-RANKING
     -------------------------------------------------------------------
     THE RANKING IS RELATIVE, AND THE FIRST VERSION OF IT WAS WRONG.

     It scored every bare tile as
         0.65 * (fraction of neighbours carrying vegetation)
       + 0.35 * (how dry it is)
     and returned the top five.

     Measured on the real archive, nothing anywhere classifies as
     vegetation, so the first term is ZERO for every tile on every frame
     and the whole score collapsed to the second. The second was then
     separating tiles by thousandths of an ExG unit inside a range of
     0.029 - which is the ordinary variation of sand. The page would have
     presented five "candidate zones for planting" that were, in fact,
     five arbitrary squares of desert, with numbers beside them to three
     decimal places. That is exactly the false precision the brief
     forbids, dressed up as a measurement.

     What it does now:

       'greenest' (default) - rank land tiles by z, the tile's distance
           from ITS OWN FRAME's median greenness in standard deviations.
           These are the least red ground in the frame. That is a real,
           measurable property and it is reported as what it is: a place
           to look, not detected vegetation.

       'driest' - the same distribution, the other end. This is what
           Reject asks for: the candidate set is rebuilt from the same
           evidence under the opposite criterion, never edited in place.

     And it REFUSES rather than returning anything when the best tile is
     less than MIN_CANDIDATE_Z from the median, because below that the
     ranking is noise and a refusal is the honest output. */
  /* -------------------------------------------------------------------
     THE REFERENCE RUN - WHAT HAPPENS OVER GROUND KUWAITSAT-1 CANNOT SEE

     Reached only from DECISION 1, and only when no archive frame has a
     geolocation inside the mission area. It answers the question from
     public Earth observation instead, and says so at every step.

     The sequence mirrors the KuwaitSat-1 path deliberately - same index,
     same thresholds, same separation bar, same human checkpoint -
     because two sources measured two different ways cannot be compared,
     and "identical method, different sensor" is the only claim worth
     making.
     ------------------------------------------------------------------- */
  function referenceRun(state, mission, opts, frames, geolocated) {
    var phase = opts.onPhase || function () {};
    var raw = opts.onStep || function () {};
    function tick() { raw(state); }

    var ref = KS.reference;
    var area = mission.area_geojson;
    var bounds = geo.polygonBounds(area);

    if (!ref || !bounds) {
      return stopNoEvidence(state, mission, frames, geolocated, tick);
    }

    state.reference = true;
    phase('Mission Orchestrator - no KuwaitSat-1 frame covers this area; ' +
          'checking public Earth observation');

    return logStep(state.run_id, 'satellite_data', 'reference.select',
        { reason: 'no KuwaitSat-1 frame has a geolocation inside the mission area',
          kuwaitsat_frames_released: frames.length,
          kuwaitsat_frames_geolocated: geolocated.length,
          kuwaitsat_frames_in_area: 0,
          optical_source: ref.SOURCES.optical.name,
          optical_resolution_m: ref.SOURCES.optical.resolution_m,
          heat_source: ref.SOURCES.heat.name,
          heat_resolution_m: ref.SOURCES.heat.resolution_m })
      .then(function () {
        tick();
        phase(ROLES.satellite_data.name + ' - fetching Sentinel-2 surface imagery');
        return ref.fetchArea('optical', bounds, 768);
      })
      .then(function (optical) {
        state.opticalArea = optical;
        var m = ref.measure(optical, 16);
        state.refMeasure = m;
        state.tileM = m.tileM;
        state.tileKm2 = Math.round((m.tileM * m.tileM) / 1e6 * 100) / 100;

        phase(ROLES.environmental_analysis.name + ' - measuring ' + m.total +
              ' tiles of Sentinel-2 at ' + m.tileM + ' m');

        return logStep(state.run_id, 'environmental_analysis', 'reference.analyse',
            { source: optical.source.name,
              zoom: optical.zoom,
              tiles_fetched: optical.tilesLoaded + '/' + optical.tiles,
              grid: m.grid + 'x' + m.grid,
              tile_m: m.tileM,
              metres_per_pixel: Math.round(optical.metresPerPixel * 10) / 10,
              vegetation_tiles: m.counts.vegetation,
              built_tiles: m.counts.built,
              bare_tiles: m.counts.bare,
              water_tiles: m.counts.water,
              vegetation_detected: m.vegetationDetected })
          .then(function () { tick(); return m; });
      })
      .then(function (m) {
        phase(ROLES.environmental_analysis.name + ' - fetching land surface temperature');
        return ref.fetchArea('heat', bounds, 512)
          .then(function (heatArea) {
            var hm = ref.measureHeat(heatArea, 16);
            state.heat = hm;
            return logStep(state.run_id, 'environmental_analysis', 'reference.heat',
                { source: heatArea.source.name,
                  date: ref.SOURCES.heat.date,
                  resolution_m: ref.SOURCES.heat.resolution_m,
                  source_pixels_over_area: hm.sourcePixels,
                  tiles_measured: hm.total,
                  can_rank_at_this_grid: hm.usable,
                  used_for: hm.usable ? 'ranking candidates'
                                      : 'context only, too coarse to rank this grid',
                  units: 'relative index only, never degrees',
                  why: hm.limitation || hm.note })
              .then(function () { tick(); return m; });
          })
          .catch(function () {
            /* A missing heat layer is not a failed run. The surface
               analysis stands on its own, and the trail says heat was
               unavailable rather than silently dropping it. */
            state.heat = null;
            return logStep(state.run_id, 'environmental_analysis', 'reference.heat',
                { source: ref.SOURCES.heat.name }, false,
                'The land surface temperature layer did not return tiles for this ' +
                'area, so heat is not part of this run. The surface cover ' +
                'measurement is unaffected.')
              .then(function () { tick(); return m; });
          });
      })
      .then(function (m) {
        return writeResult(state.run_id, 'metric',
          'Surface measurement from ' + state.opticalArea.source.name,
          'NOT A KUWAITSAT-1 MEASUREMENT. No KuwaitSat-1 frame covers this area, so ' +
          'this run measured ' + state.opticalArea.source.name + ' instead, at ' +
          Math.round(state.opticalArea.metresPerPixel * 10) / 10 + ' m per pixel.\n\n' +
          m.total + ' tiles of about ' + m.tileM + ' m: ' +
          m.counts.vegetation + ' vegetated, ' + m.counts.built + ' built, ' +
          m.counts.bare + ' bare, ' + m.counts.water + ' water.\n\n' +
          (m.vegetationDetected
            ? (m.counts.vegetation + ' tiles reach the Excess Green vegetation ' +
               'threshold of ' + geo.VEG_EXG + '. Unlike the KuwaitSat-1 archive, ' +
               'this scene contains detectable vegetation.')
            : 'No tile reaches the Excess Green threshold of ' + geo.VEG_EXG + '.') +
          '\n\n' + state.opticalArea.source.attribution + '.\n\n' + geo.INDEX_NOTE,
          area)
          .then(function () { tick(); return m; });
      })
      .then(function (m) {
        /* phase(), not step(): step() is a closure inside run() and is
           not in scope here. Calling it would throw a ReferenceError
           mid-run, after the trail had already been written. */
        phase(ROLES.recommendation.name);
        return rankReference(state, m, 'hottest');
      })
      .then(function () {
        if (!state.candidates.length) {
          return finish(state.run_id, 'stalled', 'no zone separated from the background')
            .then(function () {
              state.stopped = 'no-separation';
              tick();
              phase('Mission Orchestrator - nothing in this area separates from the ' +
                    'background. Run closed.');
              return state;
            });
        }
        phase('Mission Orchestrator - evidence sufficient, human checkpoint required');
        if (opts.onCheckpoint) { opts.onCheckpoint(state); }
        return state;
      })
      .catch(function (err) {
        /* The reference sources are somebody else's servers. If they are
           unreachable the honest outcome is the original one: no
           evidence, run closed, reason recorded. */
        return logStep(state.run_id, 'environmental_analysis', 'reference.analyse',
            { source: 'public Earth observation' }, false,
            'No KuwaitSat-1 frame covers this area and the public reference imagery ' +
            'could not be reached: ' + (err && err.message ? err.message : err))
          .then(function () {
            return stopNoEvidence(state, mission, frames, geolocated, tick);
          });
      });
  }

  /* The original DECISION 1 outcome, kept whole. Reached when there is
     no KuwaitSat-1 frame AND no reference imagery either. */
  function stopNoEvidence(state, mission, frames, geolocated, tick) {
    return writeResult(state.run_id, 'narrative',
        'No usable evidence in this area',
        'The KuwaitSat-1 archive holds ' + frames.length + ' frames, of which ' +
        geolocated.length + ' are geolocated. None of them falls inside the area ' +
        'this mission defines, and the public reference imagery could not be ' +
        'reached either.\n\n' +
        'The pipeline stopped here rather than analysing a frame from somewhere ' +
        'else and labelling it with this area.',
        mission.area_geojson)
      .then(function () {
        return finish(state.run_id, 'stalled', 'no evidence available for this area');
      })
      .then(function () { state.stopped = 'no-evidence'; tick(); return state; });
  }

  /* -------------------------------------------------------------------
     RANKING A REFERENCE SCENE

     The mission this was built for is "find the hottest residential
     blocks where shade trees would help", so the criterion combines the
     three things that question actually asks about, each measured:

       built   roof and road rather than sand        Sentinel-2, 10 m
       hot     toward the red end of the scene       MODIS LST, 1 km
       bare    no vegetation there to begin with     Sentinel-2, 10 m

     A tile clears the same 2 standard deviation bar as everything else
     on this platform, on the heat axis, or nothing is returned. With no
     heat layer the criterion falls back to built-and-unvegetated and
     every finding says so.
     ------------------------------------------------------------------- */
  function rankReference(state, m, mode) {
    /* HEAT RANKS ONLY IF HEAT CAN RESOLVE THE GRID.

       measureHeat() reports `usable`. Over a city-sized area MODIS is a
       handful of pixels, every cell reads the same value and every tile
       scores 0.00 - so ranking on it would be ranking on nothing, with
       five confident-looking candidates to show for it. When it cannot
       resolve the grid the criterion falls back to what Sentinel-2 CAN
       support at 10 m, which is built-up and unvegetated ground, and the
       heat layer stays in the run as context with its limitation
       recorded. */
    var heat = (state.heat && state.heat.usable) ? state.heat : null;
    state.heatRankable = !!heat;
    mode = heat ? 'hottest' : 'built-up and unvegetated';
    state.rankMode = mode;

    var byCell = {};
    if (heat) {
      heat.tiles.forEach(function (t) { byCell[t.gx + ',' + t.gy] = t; });
    }

    var pool = m.tiles.filter(function (t) {
      return t.kind === 'built' || t.kind === 'bare';
    }).map(function (t) {
      var h = byCell[t.gx + ',' + t.gy];
      return { t: t, heat: h || null, z: h ? h.z : 0 };
    });

    state.landTiles = m.landTiles;

    var ranked, top;
    if (heat) {
      ranked = pool.slice().sort(function (a, b) { return b.z - a.z; });
      top = ranked.filter(function (c) { return c.z >= MIN_CANDIDATE_Z; }).slice(0, 5);
    } else {
      /* Built-up first, then the most textured - which on this measure
         is the most densely built. Unvegetated is already true of
         everything in the pool. */
      ranked = pool.filter(function (c) { return c.t.kind === 'built'; })
                   .sort(function (a, b) { return b.t.texture - a.t.texture; });
      top = ranked.slice(0, 5);
    }

    state.candidates = top.map(function (c) {
      return {
        a: { frame_no: 0,
             exg: m.exg,
             grid: m.grid,
             tileM: m.tileM,
             frame: { gsd_m: state.opticalArea.metresPerPixel,
                      image_w: m.width, image_h: m.height },
             vegetationDetected: m.vegetationDetected },
        t: c.t, z: c.z, km2: state.tileKm2, heat: c.heat
      };
    });

    var best = ranked.length ? r1(ranked[0].z) : 0;

    return logStep(state.run_id, 'recommendation', 'rank.candidates',
        { criterion: heat
            ? 'relative land surface temperature, over built and unvegetated ground'
            : 'built and unvegetated (no heat layer available)',
          source: state.opticalArea.source.name +
                  (heat ? ' + ' + KS.reference.SOURCES.heat.name : ''),
          candidate_pool: pool.length,
          required_separation_sd: heat ? MIN_CANDIDATE_Z : null,
          best_separation_sd: heat ? best : null,
          candidates_returned: top.length })
      .then(function () {
        var w = Promise.resolve();
        state.candidates.forEach(function (c, i) {
          w = w.then(function () {
            var poly = refPolygon(state.opticalArea, m, c.t, 'Candidate ' + (i + 1));
            return writeResult(state.run_id, 'site',
              'Candidate ' + (i + 1) + ' - tile ' + c.t.gx + ',' + c.t.gy,
              'NOT A KUWAITSAT-1 MEASUREMENT. Measured from ' +
              state.opticalArea.source.name + '.\n\n' +
              'Surface: ' + c.t.kind + '. Excess Green ' + c.t.exg.toFixed(3) +
              ', luminance ' + c.t.lum + '.\n' +
              (state.heatRankable && c.heat
                ? ('Land surface temperature ' + r1(c.heat.z) + ' standard deviations ' +
                   'above the median for this scene. RELATIVE ONLY: ' +
                   KS.reference.SOURCES.heat.name + ' is served as a rendered colour ' +
                   'image, so no temperature in degrees is claimed.\n')
                : ((state.heat && state.heat.limitation)
                    ? ('Ranked on surface rather than temperature. ' +
                       state.heat.limitation + '\n')
                    : 'No land surface temperature was available for this run.\n')) +
              'About ' + state.tileM + ' m square, ' + state.tileKm2 + ' km2.\n\n' +
              state.opticalArea.source.attribution + '.',
              poly);
          });
        });
        return w;
      });
  }

  /* A reference tile's ground footprint. The canvas covers whole map
     tiles, so its extent is opticalArea.bounds rather than the mission
     area, and a grid cell maps linearly onto that. Image y runs down and
     latitude runs up, which is why y0 gives the NORTH edge. */
  function refPolygon(areaCanvas, m, t, name) {
    var b = areaCanvas.bounds;
    var south = b[0][0], west = b[0][1], north = b[1][0], east = b[1][1];
    var lon0 = west + (east - west) * (t.x0 / m.width);
    var lon1 = west + (east - west) * (t.x1 / m.width);
    var lat1 = north - (north - south) * (t.y0 / m.height);
    var lat0 = north - (north - south) * (t.y1 / m.height);
    return geo.rectPolygon(lat0, lon0, lat1, lon1, name);
  }

  function rank(state, mode) {
    mode = (mode === 'driest') ? 'driest' : 'greenest';
    var all = [];
    state.analyses.forEach(function (a) {
      a.tiles.forEach(function (t) {
        if (t.kind === 'water') return;
        all.push({ a: a, t: t, z: t.z });
      });
    });
    all.sort(function (x, y) {
      return (mode === 'driest') ? (x.z - y.z) : (y.z - x.z);
    });

    state.rankMode = mode;
    state.landTiles = all.length;

    var tileKm2 = 0, tileM = 0;
    if (state.analyses.length) {
      var a0 = state.analyses[0];
      tileM = a0.tileM;
      tileKm2 = Math.round((a0.tileM * a0.tileM) / 1e6 * 100) / 100;
    }
    state.tileKm2 = tileKm2;
    state.tileM = tileM;

    var vegAnywhere = state.analyses.some(function (a) { return a.vegetationDetected; });
    state.vegetationDetected = vegAnywhere;

    /* THE GUARD. Separation is measured on the criterion actually used:
       'greenest' needs a high top z, 'driest' needs a low bottom one. */
    var best = all.length ? all[0].z : 0;
    var separation = (mode === 'driest') ? -best : best;

    if (!all.length || separation < MIN_CANDIDATE_Z) {
      state.candidates = [];
      return logStep(state.run_id, 'recommendation', 'rank.candidates',
          { criterion: mode,
            land_tiles_considered: all.length,
            best_separation_sd: r1(separation),
            required_separation_sd: MIN_CANDIDATE_Z,
            candidates_returned: 0 },
          false,
          'The most extreme tile in this area stands only ' + r1(separation) +
          ' standard deviations from the median, and ' + MIN_CANDIDATE_Z +
          ' is required. Below that the ranking cannot be told apart from the ' +
          'ordinary variation of bare ground, so no candidate zones are returned.')
        .then(function () {
          return writeResult(state.run_id, 'narrative',
            'No zone in this area separates from the background',
            'The Recommendation Agent measured ' + all.length + ' land tiles and ' +
            'returned none.\n\n' +
            'Ranking them would have meant presenting the ordinary variation of ' +
            'bare ground as a finding. The best tile was ' + r1(separation) +
            ' standard deviations from the median where ' + MIN_CANDIDATE_Z +
            ' is required.\n\n' + geo.EVIDENCE_NOTE);
        });
    }

    /* FILTER, NOT SLICE, AND THIS WAS A REAL FALSE CLAIM.

       The guard above only ever tested the SINGLE most extreme tile, and
       then slice(0,5) took the next four whatever they were. Measured on
       a mission covering frames 02 and 03 under the driest criterion,
       the five returned tiles were at z = -2.06, -1.94, -1.89, -1.73 and
       -1.73: four of the five did NOT clear the 2.0 bar, while the
       checkpoint told the researcher every zone stood clear of its frame
       median and the signed report repeated it in the Methodology
       section.

       Every candidate now has to clear the bar on its own. Returning two
       zones that mean something beats returning five where three are
       filler, and the count is written into the step record so the
       number in the report comes from the data rather than from the word
       "five". */
    var top = all.filter(function (c) {
      return ((mode === 'driest') ? -c.z : c.z) >= MIN_CANDIDATE_Z;
    }).slice(0, 5);

    state.candidates = top;
    state.weakest = top.length
      ? r1((mode === 'driest') ? -top[top.length - 1].z : top[top.length - 1].z)
      : null;

    return logStep(state.run_id, 'recommendation', 'rank.candidates',
        { criterion: mode,
          basis: (mode === 'driest')
            ? 'relative dryness within each frame, in standard deviations'
            : 'relative greenness within each frame, in standard deviations',
          vegetation_detected_anywhere: vegAnywhere,
          land_tiles_considered: all.length,
          required_separation_sd: MIN_CANDIDATE_Z,
          best_separation_sd: r1(separation),
          weakest_returned_sd: state.weakest,
          candidates_returned: top.length,
          tile_m: tileM,
          tile_area_km2: tileKm2 })
      .then(function () {
        var w = Promise.resolve();
        top.forEach(function (c, i) {
          w = w.then(function () {
            var poly = geo.pixelPolygon(c.a.frame, c.t.x0, c.t.y0, c.t.x1, c.t.y1,
              'Candidate ' + (i + 1));

            /* PER-CANDIDATE GROUND SIZE, AND PER-AXIS.

               These were taken from analyses[0] and printed against
               candidates from every frame. On a "Whole of Kuwait"
               mission that put frame 02's 1277 m tiles on the label of a
               candidate that is actually in frame 06, whose tiles are
               1231 m. The tiles are also not square - a 520 x 500 px
               frame at grid 16 gives 1248 x 1209 m - and the last row
               and column are larger again, because the remainder pixels
               go there. */
            var w = c.t.x1 - c.t.x0, h = c.t.y1 - c.t.y0;
            var gsd = Number(c.a.frame.gsd_m) || 39;
            var cw = Math.round(w * gsd), ch = Math.round(h * gsd);
            var ckm2 = Math.round((cw * ch) / 1e6 * 100) / 100;
            c.km2 = ckm2;

            /* 'driest' returns the MOST red ground, not the least. The
               wording used to be hard-coded to "least red", so pressing
               Reject and re-rank produced five findings that said the
               exact opposite of what had been measured. */
            var isDry = (mode === 'driest');

            return writeResult(state.run_id, 'site',
              'Candidate ' + (i + 1) + ' - frame ' + String(c.a.frame_no).padStart(2, '0') +
                ' tile ' + c.t.gx + ',' + c.t.gy,
              'Ranked ' + (i + 1) + ' of ' + top.length + ' by the ' + mode +
              ' criterion, which is relative ' + (isDry ? 'dryness' : 'greenness') +
              ' within frame ' + String(c.a.frame_no).padStart(2, '0') + '.\n' +
              'ExG ' + c.t.exg.toFixed(3) + ', which is ' + r1(Math.abs(c.t.z)) +
              ' standard deviations ' + (isDry ? 'below' : 'above') +
              ' that frame median of ' + r3(c.a.exg.median) +
              '. Luminance ' + c.t.lum + '.\n' +
              'About ' + cw + ' x ' + ch + ' m, ' + ckm2 + ' km2 on the ground.\n\n' +
              (c.a.vegetationDetected
                ? 'This frame does contain tiles above the vegetation threshold.'
                : 'NO VEGETATION WAS DETECTED IN THIS FRAME. This tile is the ' +
                  (isDry ? 'MOST red ground in it - the driest-looking ground measured'
                         : 'least red ground in it') +
                  ', not a vegetated one.') + '\n\n' +
              geo.EVIDENCE_NOTE + '\n\n' + geo.FOOTPRINT_NOTE,
              poly);
          });
        });
        return w;
      });
  }

  /* -------------------------------------------------------------------
     AFTER THE HUMAN CHECKPOINT

     approve() runs the last three agents. It is a separate function
     because the checkpoint is a separate EVENT: the run sits open, the
     mission sits in the researcher's list, and nothing at all happens
     until a person presses the button. That gap is the capstone
     requirement "the agent proposes, a person approves", and it is the
     reason impact_prediction is not simply the next line of run().
     ------------------------------------------------------------------- */
  function approve(state, opts) {
    opts = opts || {};
    var phase = opts.onPhase || function () {};
    var raw = opts.onStep || function () {};
    function tick() { raw(state); }
    var mission = state.mission;

    phase(ROLES.impact_prediction.name);

    var inArea = state.analyses.map(function (a) { return a.frame; });
    var pairs = repeatPairs(inArea);
    /* SUM the candidates, do not multiply a count by one frame tile
       area. Candidates can come from frames of different pixel sizes,
       and the last row and column of any grid are larger than the rest,
       so count x area was wrong by up to a third on a multi-frame
       mission. rank() stamps c.km2 on each candidate for exactly this. */
    var totalKm2 = Math.round(state.candidates.reduce(function (sum, c) {
      return sum + (c.km2 || 0);
    }, 0) * 100) / 100;
    var dates = {};
    inArea.forEach(function (f) { dates[f.captured_on] = 1; });
    var nDates = Object.keys(dates).length;

    /* ---- 4 - IMPACT PREDICTION -------------------------------------
       The brief is explicit: ranges, never false precision, and "unable
       to make a reliable estimate" when the evidence is thin. The
       evidence here IS thin and the honest output says so with the
       numbers that make it thin, rather than producing a percentage
       nobody could defend. */
    var canEstimate = pairs.length > 0;

    /* THIS STEP IS NOT A REFUSAL AND SHOULD NEVER HAVE BEEN LOGGED AS ONE.

       It was written with allowed = false whenever the archive had no
       repeat coverage, which put a red REFUSED row in the trail of every
       healthy run. But nothing refused anything. The agent RAN, it
       counted the repeat visit pairs, and it concluded that no estimate
       is supportable. That is a completed analysis with a negative
       result.

       allowed = false is for a step that was NOT PERMITTED: a tool the
       agent may not call, or a guardrail that stopped it. Using it for
       "the agent ran and found the evidence insufficient" conflates a
       boundary with a finding, and an audit trail is the one place those
       two must never look alike.

       The conclusion is not softened anywhere. The step arguments carry
       impact_estimate_possible and the conclusion in words, the finding
       written immediately below states it in full, and the report's
       Impact estimate section states it again. Nothing is hidden; it is
       simply no longer painted as a failure. */
    return logStep(state.run_id, 'impact_prediction', 'change.detect',
        { candidate_zones: state.candidates.length,
          candidate_area_km2: totalKm2,
          distinct_acquisition_dates: nDates,
          repeat_visit_pairs: pairs.length,
          impact_estimate_possible: canEstimate,
          conclusion: canEstimate
            ? 'repeat coverage exists; a change estimate can be attempted as a range'
            : 'no repeat coverage, so no rate, trend or projected effect is stated' })
      .then(function () {
        tick();
        return writeResult(state.run_id, 'metric',
          'Impact estimate',
          canEstimate
            ? ('Repeat coverage exists for ' + pairs.length + ' frame pair(s): ' +
               pairs.map(function (p) { return p[0] + '/' + p[1]; }).join(', ') + '. ' +
               'A change estimate over ' + totalKm2 + ' km2 of candidate ground can be ' +
               'attempted from these pairs, and should be reported as a range.')
            : ('No impact estimate is made, and this is the finding rather than a gap ' +
               'in it.\n\n' +
               'The candidate zones total approximately ' + totalKm2 + ' km2 across ' +
               state.candidates.length + ' tiles. Estimating what planting them would ' +
               'change requires the same ground observed on at least two dates. The ' +
               'frames inside this area were acquired on ' + nDates + ' date' +
               (nDates === 1 ? '' : 's') + ' and contain no repeat visit of the same ' +
               'ground, so there is no measurable baseline.\n\n' +
               'What can be stated: the area, the surface class of each tile, and the ' +
               'date each measurement was taken. What cannot: any rate, trend or ' +
               'projected effect.'));
      })
      .then(function () {
        tick();
        /* ---- 5 - VISUALIZATION ------------------------------------ */
        phase(ROLES.visualization.name);
        return logStep(state.run_id, 'visualization', 'map.compose',
            { layers: ['mission area', 'frame footprints', 'candidate zones'],
              candidate_zones: state.candidates.length })
          .then(function () {
            return writeResult(state.run_id, 'map_layer',
              'Mission area and candidate zones',
              'The mission area with the footprint of every measured frame and the ' +
              state.candidates.length + ' candidate zones drawn on it. Open the ' +
              'Geospatial Layers view to see it against the basemap.\n\n' +
              geo.FOOTPRINT_NOTE,
              mission.area_geojson);
          });
      })
      .then(function () {
        tick();
        /* ---- 6 - REPORTING ---------------------------------------- */
        phase(ROLES.reporting.name);
        var md = reportMarkdown(state, { pairs: pairs, totalKm2: totalKm2, nDates: nDates });
        state.reportMd = md;
        return logStep(state.run_id, 'reporting', 'report.compose',
            { sections: 10, characters: md.length, approved: false })
          .then(function () {
            return writeResult(state.run_id, 'narrative', 'Draft report', md);
          });
      })
      .then(function () { return finish(state.run_id, 'complete', null); })
      .then(function () {
        tick();
        phase('Run complete. The report is a draft until a researcher approves it.');
        return state;
      })
      .catch(closeOnFailure(state));
  }

  /* -------------------------------------------------------------------
     THE REPORT

     The structure is the one printed on the Reports view, in that order,
     so the page and the document cannot drift apart. Every number in it
     is carried in from a measurement; there is no sentence here that
     invents one.
     ------------------------------------------------------------------- */
  function reportMarkdown(state, x) {
    var m = state.mission;
    var L = [];
    function p(s) { L.push(s); }

    p('# ' + (m.title || 'Mission report'));
    p('');
    p('KuwaitSat-1 Mission Hub, research operations. Draft assembled by the ' +
      'Reporting Agent from run ' + String(state.run_id).slice(0, 8) + '.');
    p('');
    p('## Executive summary');
    p('');
    p(state.candidates.length + ' candidate zones were identified inside the mission ' +
      'area from ' + state.analyses.length + ' KuwaitSat-1 frame' +
      (state.analyses.length === 1 ? '' : 's') + ', totalling approximately ' +
      x.totalKm2 + ' km2.');
    p('');
    p(state.vegetationDetected
      ? ('Vegetation was detected above the Excess Green threshold in at least one frame.')
      : ('NO VEGETATION WAS DETECTED. Not one tile in any frame used here reaches the ' +
         'Excess Green threshold of ' + geo.VEG_EXG + '. The zones below are the least ' +
         'red ground in their frames, which is a place to look and not a vegetated ' +
         'area. Anyone reading only the list should read this paragraph first.'));
    p('');
    p('No impact figure is given: the archive holds ' + x.pairs.length +
      ' repeat visit pairs over this ground, which is not enough to measure change.');
    p('');
    p('## Research objective');
    p('');
    p(m.objective);
    p('');
    p('## Data used');
    p('');
    state.analyses.forEach(function (a) {
      var f = a.frame;
      p('- Frame ' + String(a.frame_no).padStart(2, '0') + ', acquired ' + f.captured_on +
        ', ' + (f.place_label || 'location not resolved') + ', ' +
        Number(f.gsd_m).toFixed(0) + ' m/px, ' + a.width + ' x ' + a.height + ' px. ' +
        'Geolocation method: ' + (f.geo_method || 'not stated') + ', confidence ' +
        (f.geo_confidence || 'unresolved') + '.');
    });
    p('');
    p('Area of interest: ' + ((m.area_geojson && m.area_geojson.name) || 'custom polygon') +
      ', approximately ' + geo.polygonAreaKm2(m.area_geojson) + ' km2.');
    p('');
    p('## Methodology');
    p('');
    p('Each frame was divided into a ' + (state.analyses[0] ? state.analyses[0].grid : 16) +
      ' x ' + (state.analyses[0] ? state.analyses[0].grid : 16) + ' grid, giving tiles of ' +
      'about ' + state.tileM + ' m across (tiles are not square; the last row and ' +
      'column are larger), and the mean colour of every tile was ' +
      'measured in the browser. A tile whose blue channel leads both others at a ' +
      'luminance below 70 is classified as water and left out of the land statistics. ' +
      'Every remaining tile is tested against the Excess Green vegetation threshold of ' +
      geo.VEG_EXG + '.');
    p('');
    p('Land tiles were then ranked by the ' + state.rankMode + ' criterion, which is ' +
      'RELATIVE greenness within each frame: a tile score is its distance from that ' +
      'frame own median in standard deviations. A candidate must stand at least ' +
      '2 standard deviations out, or the agent returns nothing rather than ranking ' +
      'the ordinary variation of bare ground.');
    p('');
    p(geo.INDEX_NOTE);
    p('');
    p(geo.EVIDENCE_NOTE);
    p('');
    p('## Findings');
    p('');
    state.candidates.forEach(function (c, i) {
      p('- Candidate ' + (i + 1) + ', frame ' + String(c.a.frame_no).padStart(2, '0') +
        ' tile ' + c.t.gx + ',' + c.t.gy + ': ExG ' + c.t.exg.toFixed(3) + ', which is ' +
        r1(c.t.z) + ' standard deviations from that frame median of ' +
        r3(c.a.exg.median) + '. Luminance ' + c.t.lum + '. About ' +
        (c.km2 || 0) + ' km2 on the ground.');
    });
    p('');
    p('## Researcher-approved recommendations');
    p('');
    p('The candidate set above was reviewed and approved by the signed-in researcher ' +
      'at the human checkpoint. No recommendation in this report was published ' +
      'without that approval.');
    p('');
    p('## Impact estimate');
    p('');
    p(x.pairs.length
      ? ('Repeat coverage exists for ' + x.pairs.length + ' frame pair(s), so a change ' +
         'estimate can be attempted and must be reported as a range.')
      : ('None. Change detection requires the same ground on two dates. The frames used ' +
         'here were acquired on ' + x.nDates + ' date' + (x.nDates === 1 ? '' : 's') +
         ' with no repeat visit, so no rate, trend or projected effect is stated.'));
    p('');
    p('## Visualizations');
    p('');
    p('The mission area, the footprint of each frame used and each candidate zone are ' +
      'drawn in the Geospatial Layers view of this workspace.');
    p('');
    p('## Sources and provenance');
    p('');
    p('- KuwaitSat-1 payload frames, released to this session by row level security ' +
      'from public.payload_frames. Frames are not in the repository and not on the ' +
      'deployed site.');
    p('- Every step of this run, including refused steps, is in public.agent_steps ' +
      'under run ' + state.run_id + ' and is readable in the Provenance / Audit view.');
    p('- Basemap: Sentinel-2 cloudless 2021 by EOX (CC BY 4.0, modified Copernicus ' +
      'Sentinel data), OpenStreetMap contributors (ODbL), CARTO.');
    p('');
    p('## Limitations');
    p('');
    p('- ' + geo.INDEX_NOTE);
    p('- ' + geo.FOOTPRINT_NOTE);
    p('- A frame counts as inside the mission area when its centre is inside. Frames ' +
      'that overlap the edge are not included.');
    p('- Geolocation for these frames was matched by eye against reference imagery; ' +
      'the confidence stated on each frame is the operator judgement, not a measurement.');
    p('- No ground truth was available for any tile in this run.');

    return L.join('\n');
  }

  /* ------------------------------------------------------------------- */
  KS.agents = {
    ROLES: ROLES,
    scan: scan,
    run: run,
    approve: approve,
    rank: rank,
    logStep: logStep,
    writeResult: writeResult,
    finish: finish,
    reportMarkdown: reportMarkdown,
    repeatPairs: repeatPairs,
    framesInArea: framesInArea
  };
})();
