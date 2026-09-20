/* =====================================================================
   THE DATA LAYER. The only file in the app that talks to storage.

   TWO PATHS, AND IT IS ALWAYS OBVIOUS WHICH ONE IS RUNNING:

     LIVE  — window.sb exists (js/config.js created the Supabase client).
             Every read and write below goes to Postgres. The footer says
             nothing; this is the real thing.

     DEMO  — window.sb is absent. The app still opens, backed by this
             browser's localStorage, and EVERY PAGE FOOTER SAYS "DEMO
             MODE" out loud. Demo mode proves nothing about access
             control: it is our JavaScript choosing what to draw.

   THE RULE THAT MATTERS MOST (se-m1):
   the LIVE path NEVER filters by owner in JavaScript. There is no
   .eq('researcher_id', …) anywhere below. Row Level Security decides who
   sees which row, in the database, where a stranger with our publishable
   key still hits it. A client-side filter would make a fake pass look
   exactly like a real one — which is the failure mode the two-window test
   exists to catch.

   THE OTHER RULE (03_grants.sql):
   select('*') on missions / mission_runs / agent_steps / results ERRORS,
   because the grants are column-level. So we read the VIEWS —
   my_missions, my_mission_results, my_agent_steps — or name columns.
   ===================================================================== */

var Data = (function () {

  /* Decided ONCE at load, so a page cannot be half live and half demo. */
  var LIVE = !!(window.sb && window.sb.auth);
  var sb = window.sb;

  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  /* -------------------------------------------------------------------
     ERROR TRANSLATION
     06_validation.sql raises its rules as P0001 with sentences written
     for this screen, so those pass straight through. The rest are
     Postgres constraint names, which a researcher cannot act on.
     >>> If 03 changes a constraint name or a message, this table is what
     >>> has to change with it. That is agreed in 06_validation.sql.
     ------------------------------------------------------------------- */
  function mapError(err) {
    var raw = (err && (err.message || err.error_description || err.msg)) || '';
    var text = String(raw);

    if (/missions_title_len/.test(text))
      return 'The title must be between 3 and 120 characters.';
    if (/missions_objective_len/.test(text))
      return 'The objective must be between 20 and 1500 characters. Nothing was saved.';
    if (/missions_(title|objective)_has_letter/.test(text))
      return 'Write the title and objective in words, not only digits or punctuation.';
    if (/missions_area_shape|kuwait_area_ok/.test(text))
      return 'The selected area must be a closed polygon inside Kuwait (46.5–48.8 E, 28.5–30.1 N).';
    if (/missions_area_size/.test(text))
      return 'The selected area has too many points. Draw a simpler box.';
    if (/permission denied for column|permission denied for table|42501/.test(text))
      return 'The database refused that read. A screen is asking for a column it is not granted — tell 03 · Security which screen.';
    if (/row-level security|violates row-level security/.test(text))
      return 'The database refused that write. You can only write to your own missions.';
    if (/invalid input syntax for type uuid|22P02/.test(text))
      return 'That mission id is not a valid id.';
    if (/Invalid login credentials/i.test(text))
      return 'Email or password is incorrect.';
    if (/Email not confirmed/i.test(text))
      return 'Confirm your email address before signing in. Check your inbox.';
    if (/User already registered/i.test(text))
      return 'An account with that email already exists.';
    if (/Failed to fetch|NetworkError|fetch/i.test(text))
      return 'The database could not be reached. Check the connection and try again.';

    return text || 'The server did not say why.';
  }

  /* Every Supabase call comes back as { data, error } — it does not throw.
     Forgetting to check .error is how a screen ends up showing an empty
     list instead of a refusal. This wrapper makes that impossible. */
  function unwrap(res) {
    if (res && res.error) throw new Error(mapError(res.error));
    return res ? res.data : null;
  }

  /* -------------------------------------------------------------------
     ROW MAPPERS · database column names in, screen field names out.
     The column names here are the SCHEMA'S, checked against
     01_tables_rls.sql and 05_views_rpc.sql. researcher_id, never owner_id.
     ------------------------------------------------------------------- */

  function missionFromRow(r) {
    if (!r) return null;
    return {
      id: r.id,
      title: r.title,
      objective: r.objective,
      // The screens draw a rectangle; the column holds a GeoJSON Polygon.
      areaGeojson: r.area_geojson,
      area: polygonToBounds(r.area_geojson),
      status: r.status,
      injectionFlag: r.injection_flag === true,
      createdAt: r.created_at,
      launchedAt: r.launched_at,
      // my_missions computes these two in SQL so the screen never has to
      // compare user ids itself (and so can never get it wrong).
      isOwner: r.is_owner !== false,
      findingCount: typeof r.finding_count === 'number' ? r.finding_count : null
    };
  }

  function resultFromRow(r) {
    return {
      id: r.id,
      missionId: r.mission_id,
      runId: r.run_id,
      kind: r.kind,                       // site | metric | map_layer | narrative
      title: r.title,
      // my_mission_results returns `preview`: the first 240 characters,
      // truncated in SQL so the full text never crosses the wire.
      body: r.preview !== undefined ? r.preview : r.body,
      geometry: r.geometry,               // GeoJSON Polygon, [lng, lat]
      createdAt: r.created_at
    };
  }

  /* One row per agent, in the fixed order of AGENTS, whether or not the
     database has written that step yet. */
  function buildSteps(run, stepRows) {
    var written = {};
    (stepRows || []).forEach(function (s) { written[s.step_name || s.stepName] = s; });

    var runActive = !!run && (run.status === 'queued' || run.status === 'running');
    var markedRunning = false;

    return AGENTS.map(function (a, i) {
      var s = written[a.key];
      var status;

      if (s) {
        status = s.status;                 // running | complete | refused | failed
      } else if (runActive && !markedRunning) {
        // agent_log_step writes a step that is ALREADY finished, so a step
        // is either written or not yet written. Calling the next unwritten
        // one "Running" is inference, and it is honest: the row appears the
        // moment the step really finished.
        status = 'running';
        markedRunning = true;
      } else if (run && !runActive) {
        // The run ended and this step was never written — usually because
        // an earlier step was refused. Saying "Queued" for ever would be a
        // spinner that never resolves.
        status = 'missing';
      } else {
        status = 'queued';
      }

      return {
        stepName: a.key,
        name: a.name,
        role: a.role,
        order: i + 1,
        status: status,
        allowed: s ? s.allowed !== false : null,
        refusedReason: s ? (s.refused_reason || s.refusedReason || null) : null,
        injectionFlag: s ? (s.injection_flag === true || s.injectionFlag === true) : false,
        finishedAt: s ? (s.finished_at || s.finishedAt || null) : null,
        // Sample summaries belong to demo mode only. A live step has no
        // summary column — it has a status, and a reason when refused.
        summary: null
      };
    });
  }

  /* =====================================================================
     THE LIVE PATH · Supabase
     ===================================================================== */
  var Live = {

    signIn: function (email, password) {
      return sb.auth.signInWithPassword({
        email: String(email).trim(), password: password
      }).then(function (res) {
        unwrap(res);
        return Live.getCurrentUser();
      });
    },

    /* Supabase Auth hashes and stores the password. We never see it, never
       store it, never print it. That is the whole of se-m3. */
    signUp: function (email, password, name, org) {
      var mail = String(email).trim();
      return sb.auth.signUp({
        email: mail, password: password,
        options: { data: { display_name: name, org: org } }
      }).then(function (res) {
        var data = unwrap(res);
        if (!data || !data.session) {
          // Email confirmation is on: there is no session yet, so we
          // cannot write the profile row. Say so instead of redirecting
          // to a page that will bounce straight back to login.
          return { needsConfirmation: true };
        }
        return ensureProfile(data.user, name, org).then(function () {
          return Live.getCurrentUser();
        });
      });
    },

    signOut: function () {
      return sb.auth.signOut().then(unwrap);
    },

    getCurrentUser: function () {
      return sb.auth.getUser().then(function (res) {
        // No session is not an error — it is a signed-out visitor.
        if (res.error || !res.data || !res.data.user) return null;
        var u = res.data.user;
        var meta = u.user_metadata || {};
        return sb.from('profiles')
          .select('user_id, display_name, org')
          .eq('user_id', u.id)
          .maybeSingle()
          .then(function (p) {
            var row = p.error ? null : p.data;
            if (!row) {
              // First sign-in after confirming an email: the profile row
              // could not be written at sign-up time. Write it now.
              return ensureProfile(u, meta.display_name, meta.org).then(function () {
                return {
                  id: u.id, email: u.email,
                  name: meta.display_name || u.email, org: meta.org || ''
                };
              });
            }
            return {
              id: u.id, email: u.email,
              name: row.display_name || meta.display_name || u.email,
              org: row.org || meta.org || ''
            };
          });
      });
    },

    /* my_missions already contains only rows this researcher may see.
       NO .eq('researcher_id', …) — RLS does that, in the database. */
    listMissions: function () {
      return sb.from('my_missions')
        .select('*')
        .order('created_at', { ascending: false })
        .then(unwrap)
        .then(function (rows) { return (rows || []).map(missionFromRow); });
    },

    getMission: function (id) {
      // PostgREST answers a malformed uuid with a 400, which would read on
      // screen as a database fault rather than "no such mission".
      if (!id || !UUID_RE.test(id)) return Promise.resolve(null);
      return sb.from('my_missions')
        .select('*')
        .eq('id', id)
        .maybeSingle()
        .then(unwrap)
        .then(missionFromRow);
    },

    /* The browser may write exactly three columns (03_grants.sql):
       title, objective, area_geojson. researcher_id and status are not
       ours to send — the trigger sets them. */
    createMission: function (input) {
      var polygon = boundsToPolygon(input.area);
      if (!polygon) {
        return Promise.reject(new Error('Select an area on the map before launching.'));
      }
      return sb.from('missions')
        .insert({
          title: String(input.title).trim(),
          objective: String(input.objective).trim(),
          area_geojson: polygon
        })
        .select('id, title, objective, area_geojson, status, injection_flag, created_at, launched_at')
        .single()
        .then(unwrap)
        .then(missionFromRow);
    },

    /* D-1 · THE BROWSER NEVER CALLS n8n. It calls this function, and n8n
       polls for queued runs with claim_next_run(). There is no webhook URL
       in this repository's JavaScript, and there must never be one. */
    startPipeline: function (missionId) {
      return sb.rpc('launch_mission', { p_mission_id: missionId })
        .then(unwrap);
    },

    /* The run and its six steps, for the pipeline strip. */
    getRunState: function (missionId) {
      if (!missionId || !UUID_RE.test(missionId)) {
        return Promise.resolve({ run: null, steps: buildSteps(null, []) });
      }
      return sb.from('mission_runs')
        .select('id, mission_id, status, started_at, finished_at, tool_calls')
        .eq('mission_id', missionId)
        .order('started_at', { ascending: false })
        .limit(1)
        .then(unwrap)
        .then(function (rows) {
          var row = (rows && rows[0]) || null;
          if (!row) return { run: null, steps: buildSteps(null, []) };
          var run = {
            id: row.id, missionId: row.mission_id, status: row.status,
            startedAt: row.started_at, finishedAt: row.finished_at,
            toolCalls: row.tool_calls
          };
          return sb.from('my_agent_steps')
            .select('*')
            .eq('run_id', run.id)
            .order('started_at', { ascending: true })
            .then(unwrap)
            .then(function (steps) {
              return { run: run, steps: buildSteps(run, steps || []) };
            });
        });
    },

    getAgentRuns: function (missionId) {
      return Live.getRunState(missionId).then(function (state) { return state.steps; });
    },

    /* D-6 · the strip is POLLED, not Realtime. In live mode a tick is just
       "read again" — the browser never writes an agent step. */
    tick: function () { return Promise.resolve(false); },

    getResults: function (missionId) {
      if (!missionId || !UUID_RE.test(missionId)) return Promise.resolve([]);
      return sb.from('my_mission_results')
        .select('*')
        .eq('mission_id', missionId)
        .order('created_at', { ascending: true })
        .then(unwrap)
        .then(function (rows) { return (rows || []).map(resultFromRow); });
    },

    /* The human checkpoint. The body is built here, in plain text, and
       handed to generate_report, which records WHO approved it. */
    generateReport: function (missionId) {
      return Promise.all([
        Live.getMission(missionId),
        Live.getResults(missionId),
        Live.getCurrentUser()
      ]).then(function (parts) {
        var mission = parts[0], results = parts[1], user = parts[2];
        if (!mission) throw new Error('Mission not found, or you do not have access to it.');
        var body = makeReportBody(mission, results, user);
        return sb.rpc('generate_report', {
          p_mission_id: missionId, p_body_md: body
        }).then(unwrap);
      }).then(function () {
        return Live.getReport(missionId);
      });
    },

    getReport: function (missionId) {
      if (!missionId || !UUID_RE.test(missionId)) return Promise.resolve(null);
      return sb.from('reports')
        .select('id, mission_id, body_md, approved_by, approved_at')
        .eq('mission_id', missionId)
        .order('approved_at', { ascending: false })
        .limit(1)
        .then(unwrap)
        .then(function (rows) {
          var r = rows && rows[0];
          if (!r) return null;
          return {
            id: r.id, missionId: r.mission_id, bodyMd: r.body_md,
            approvedBy: r.approved_by, approvedAt: r.approved_at
          };
        });
    },

    /* Sharing is a written row, made by the owner only (05_views_rpc). */
    shareMission: function (missionId, email, role) {
      return sb.rpc('share_mission', {
        p_mission_id: missionId, p_email: String(email).trim(),
        p_role: role || 'viewer'
      }).then(unwrap);
    }
  };

  function ensureProfile(user, name, org) {
    if (!user) return Promise.resolve(null);
    return sb.from('profiles')
      .insert({
        user_id: user.id,
        display_name: name || (user.user_metadata && user.user_metadata.display_name) || user.email,
        org: org || (user.user_metadata && user.user_metadata.org) || null
      })
      .then(function (res) {
        // A duplicate here just means the row already existed. Everything
        // else is worth surfacing.
        if (res.error && !/duplicate key/i.test(res.error.message || '')) {
          throw new Error(mapError(res.error));
        }
        return null;
      });
  }

  /* =====================================================================
     THE DEMO PATH · localStorage. NOT LIVE. NOT SECURITY.

     Everything below runs only when no Supabase project is connected, so
     the team can open the app on a laptop with no network. The owner
     checks in here are our JavaScript deciding what to draw — which is
     exactly what does NOT count as access control. The footer says so on
     every page.
     ===================================================================== */
  var Demo = (function () {
    var KEY = 'ksat_hub_v2';
    var db = null;

    function clone(o) { return JSON.parse(JSON.stringify(o)); }
    function now() { return new Date().toISOString(); }

    function load() {
      if (db) return db;
      try {
        var raw = localStorage.getItem(KEY);
        if (raw) {
          var parsed = JSON.parse(raw);
          if (parsed && parsed.version === 2 && parsed.users && parsed.missions) {
            db = parsed; return db;
          }
        }
      } catch (e) { /* private mode, blocked storage, corrupt json */ }
      db = buildSeed();
      save();
      return db;
    }

    function save() {
      try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* ignore */ }
    }

    function wait(value) {
      var ms = 150 + Math.floor(Math.random() * 150);
      return new Promise(function (r) { setTimeout(function () { r(value); }, ms); });
    }

    function me() {
      var d = load();
      if (!d.sessionUserId) return null;
      return d.users.find(function (u) { return u.id === d.sessionUserId; }) || null;
    }

    /* DEMO-ONLY stand-in for Row Level Security. The live path has no
       equivalent line, on purpose. */
    function readable(missionId) {
      var d = load(), u = me();
      if (!u) return null;
      var m = d.missions.find(function (x) { return x.id === missionId; });
      if (!m || m.researcherId !== u.id) return null;
      return m;
    }

    function shape(m) {
      var d = load();
      return {
        id: m.id, title: m.title, objective: m.objective,
        areaGeojson: boundsToPolygon(m.area), area: m.area,
        status: m.status, injectionFlag: m.injectionFlag === true,
        createdAt: m.createdAt, launchedAt: m.launchedAt,
        isOwner: true,
        findingCount: d.results.filter(function (r) { return r.missionId === m.id; }).length
      };
    }

    function runFor(missionId) {
      var d = load();
      var rows = d.runs.filter(function (r) { return r.missionId === missionId; });
      return rows.length ? rows[rows.length - 1] : null;
    }

    return {
      signIn: function (email) {
        /* DEMO MODE CANNOT CHECK A PASSWORD, because no password is stored
           anywhere in this project — Supabase Auth holds the hash (se-m3).
           So this accepts any password, and the footer says out loud that
           demo mode proves nothing. Connect the project and the real
           signInWithPassword() above takes over. */
        return wait().then(function () {
          var d = load();
          var mail = String(email).trim().toLowerCase();
          var u = d.users.find(function (x) { return x.email.toLowerCase() === mail; });
          if (!u) {
            u = { id: _uuid(), email: mail, name: mail.split('@')[0], org: 'Demo organization', createdAt: now() };
            d.users.push(u);
          }
          d.sessionUserId = u.id; save();
          return clone(u);
        });
      },

      signUp: function (email, password, name, org) {
        return wait().then(function () {
          var d = load();
          var mail = String(email).trim().toLowerCase();
          if (d.users.some(function (x) { return x.email.toLowerCase() === mail; })) {
            throw new Error('An account with that email already exists.');
          }
          // No password field. There is nothing here to store it in.
          var u = { id: _uuid(), email: mail, name: name, org: org, createdAt: now() };
          d.users.push(u); d.sessionUserId = u.id; save();
          return clone(u);
        });
      },

      signOut: function () {
        return wait().then(function () { var d = load(); d.sessionUserId = null; save(); });
      },

      getCurrentUser: function () {
        return wait().then(function () { var u = me(); return u ? clone(u) : null; });
      },

      listMissions: function () {
        return wait().then(function () {
          var d = load(), u = me();
          if (!u) return [];
          return d.missions
            .filter(function (m) { return m.researcherId === u.id; })
            .sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); })
            .map(shape);
        });
      },

      getMission: function (id) {
        return wait().then(function () {
          var m = readable(id);
          return m ? shape(m) : null;
        });
      },

      createMission: function (input) {
        return wait().then(function () {
          var d = load(), u = me();
          if (!u) throw new Error('Not signed in.');
          if (!boundsToPolygon(input.area)) {
            throw new Error('Select an area on the map before launching.');
          }
          var m = {
            id: _uuid(), researcherId: u.id,
            title: input.title, objective: input.objective,
            area: clampToKuwait(input.area),
            status: 'draft', injectionFlag: false,
            createdAt: now(), launchedAt: null
          };
          d.missions.push(m); save();
          return shape(m);
        });
      },

      startPipeline: function (missionId) {
        return wait().then(function () {
          var d = load(), m = readable(missionId);
          if (!m) throw new Error('Mission not found.');
          var open = d.runs.some(function (r) {
            return r.missionId === missionId && (r.status === 'queued' || r.status === 'running');
          });
          if (open) throw new Error('This mission is already running.');
          var run = {
            id: _uuid(), missionId: missionId, status: 'queued',
            startedAt: now(), finishedAt: null, toolCalls: 0
          };
          d.runs.push(run);
          m.status = 'queued';
          m.launchedAt = now();
          save();
          return run.id;
        });
      },

      getRunState: function (missionId) {
        return wait().then(function () {
          var d = load();
          if (!readable(missionId)) return { run: null, steps: buildSteps(null, []) };
          var run = runFor(missionId);
          if (!run) return { run: null, steps: buildSteps(null, []) };
          var steps = d.steps.filter(function (s) { return s.runId === run.id; });
          var rows = buildSteps(run, steps);
          // Demo mode is allowed its sample sentences; live mode is not,
          // because the database has no such column.
          rows.forEach(function (r) {
            if (r.status === 'complete') {
              var def = agentByKey(r.stepName);
              r.summary = def ? def.summary + ' (sample data)' : null;
            }
          });
          return { run: clone(run), steps: rows };
        });
      },

      getAgentRuns: function (missionId) {
        return Demo.getRunState(missionId).then(function (s) { return s.steps; });
      },

      /* DEMO ONLY. In live mode n8n writes the steps and the browser just
         re-reads them (D-6). Here, one tick writes the next step. */
      tick: function (missionId) {
        return new Promise(function (resolve) {
          var d = load(), m = readable(missionId);
          if (!m) return resolve(false);
          var run = runFor(missionId);
          if (!run || (run.status !== 'queued' && run.status !== 'running')) return resolve(false);

          run.status = 'running';
          var written = d.steps.filter(function (s) { return s.runId === run.id; });
          var next = AGENTS[written.length];

          if (!next) {
            run.status = 'complete';
            run.finishedAt = now();
            m.status = 'review';
            save();
            return resolve(false);
          }

          d.steps.push({
            id: _uuid(), runId: run.id, stepName: next.key,
            status: 'complete', allowed: true, refusedReason: null,
            injectionFlag: false, startedAt: now(), finishedAt: now()
          });
          run.toolCalls = written.length + 1;

          if (next.key === 'visualization') {
            var already = d.results.some(function (r) { return r.missionId === missionId; });
            if (!already) {
              makeResults(m, run.id).forEach(function (r) { d.results.push(r); });
            }
          }
          if (written.length + 1 === AGENTS.length) {
            run.status = 'complete';
            run.finishedAt = now();
            m.status = 'review';
          }
          save();
          resolve(true);
        });
      },

      getResults: function (missionId) {
        return wait().then(function () {
          var d = load();
          if (!readable(missionId)) return [];
          return clone(d.results.filter(function (r) { return r.missionId === missionId; }));
        });
      },

      generateReport: function (missionId) {
        return wait().then(function () {
          var d = load(), u = me(), m = readable(missionId);
          if (!m) throw new Error('Mission not found, or you do not have access to it.');

          var run = runFor(missionId);
          var steps = run ? d.steps.filter(function (s) { return s.runId === run.id; }) : [];
          if (!run || steps.length < AGENTS.length) {
            throw new Error('All six agents must finish before a report can be generated.');
          }

          var existing = d.reports.find(function (r) { return r.missionId === missionId; });
          if (existing) return clone(existing);

          var results = d.results.filter(function (r) { return r.missionId === missionId; });
          var rep = {
            id: _uuid(), missionId: missionId,
            bodyMd: makeReportBody(shape(m), results, u),
            approvedBy: u.id, approvedAt: now()
          };
          d.reports.push(rep);
          m.status = 'complete';
          save();
          return clone(rep);
        });
      },

      getReport: function (missionId) {
        return wait().then(function () {
          var d = load();
          if (!readable(missionId)) return null;
          var r = d.reports.find(function (x) { return x.missionId === missionId; });
          return r ? clone(r) : null;
        });
      },

      shareMission: function () {
        return Promise.reject(new Error('Sharing needs the database. Connect the project first.'));
      },

      resetDemoData: function () {
        try { localStorage.removeItem(KEY); } catch (e) {}
        db = null;
        load();
      }
    };
  })();

  var api = LIVE ? Live : Demo;

  return {
    /* Every screen can ask which path it is on, and the footer does. */
    isLive: function () { return LIVE; },

    signIn: api.signIn,
    signUp: api.signUp,
    signOut: api.signOut,
    getCurrentUser: api.getCurrentUser,

    listMissions: api.listMissions,
    getMission: api.getMission,
    createMission: api.createMission,

    startPipeline: api.startPipeline,
    getRunState: api.getRunState,
    getAgentRuns: api.getAgentRuns,
    tick: api.tick,
    /* Old name, kept so nothing that still calls it breaks. In live mode
       the browser advances nothing — it polls (D-6). */
    advanceAgent: api.tick,

    getResults: api.getResults,
    /* Old name from when results were called zones. Same rows. */
    getZones: api.getResults,

    generateReport: api.generateReport,
    getReport: api.getReport,
    shareMission: api.shareMission,

    resetDemoData: Demo.resetDemoData
  };
})();
