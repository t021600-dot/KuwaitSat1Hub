/* =====================================================================
   MOCK DATA LAYER.

   Replace THIS FILE with real Supabase calls. No other file in the
   project imports localStorage or the seed data. Every function below
   carries a comment naming the Supabase call that replaces it.

   Access rule: every read and write filters by the signed-in user's id
   INSIDE this file. Researcher B cannot reach Researcher A's rows even
   by typing the mission id straight into the address bar. When Supabase
   takes over, the same rule lives in Row Level Security policies.
   ===================================================================== */

var Data = (function () {
  var KEY = 'ksat_hub_v1';
  var db = null;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function load() {
    if (db) return db;
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.users && parsed.missions) { db = parsed; return db; }
      }
    } catch (e) { /* private mode, blocked storage, corrupt json */ }
    db = buildSeed();
    save();
    return db;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* ignore */ }
  }

  function wait() {
    var ms = 200 + Math.floor(Math.random() * 200);
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  function newId(p) { return p + '_' + Math.random().toString(36).slice(2, 10); }
  function now() { return new Date().toISOString(); }

  function me() {
    var d = load();
    if (!d.sessionUserId) return null;
    return d.users.find(function (u) { return u.id === d.sessionUserId; }) || null;
  }

  /* Returns the mission ONLY if the signed-in user owns it. */
  function ownedMission(id) {
    var d = load(), u = me();
    if (!u) return null;
    var m = d.missions.find(function (x) { return x.id === id; });
    if (!m || m.ownerId !== u.id) return null;
    return m;
  }

  return {

    /* -> supabase.auth.signInWithPassword({ email, password }) */
    signIn: function (email, password) {
      return wait().then(function () {
        var d = load();
        var u = d.users.find(function (x) {
          return x.email.toLowerCase() === String(email).trim().toLowerCase() &&
                 x.password === password;
        });
        if (!u) throw new Error('Email or password is incorrect.');
        d.sessionUserId = u.id; save();
        return clone(u);
      });
    },

    /* -> supabase.auth.signUp({ email, password, options: { data: { name, org } } }) */
    signUp: function (email, password, name, org) {
      return wait().then(function () {
        var d = load();
        var mail = String(email).trim().toLowerCase();
        if (d.users.some(function (x) { return x.email.toLowerCase() === mail; })) {
          throw new Error('An account with that email already exists.');
        }
        var u = {
          id: newId('usr'), email: mail, password: password,
          name: name, org: org, createdAt: now()
        };
        d.users.push(u); d.sessionUserId = u.id; save();
        return clone(u);
      });
    },

    /* -> supabase.auth.signOut() */
    signOut: function () {
      return wait().then(function () {
        var d = load(); d.sessionUserId = null; save();
      });
    },

    /* -> supabase.auth.getUser() */
    getCurrentUser: function () {
      return wait().then(function () {
        var u = me();
        return u ? clone(u) : null;
      });
    },

    /* -> supabase.from('missions').select('*').eq('owner_id', user.id)
            .order('created_at', { ascending: false })                      */
    listMissions: function () {
      return wait().then(function () {
        var d = load(), u = me();
        if (!u) return [];
        return clone(d.missions
          .filter(function (m) { return m.ownerId === u.id; })
          .sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); }));
      });
    },

    /* -> supabase.from('missions').select('*').eq('id', id).single()
          RLS returns nothing when the row belongs to another researcher. */
    getMission: function (id) {
      return wait().then(function () {
        var m = ownedMission(id);
        return m ? clone(m) : null;
      });
    },

    /* -> supabase.from('missions').insert({ ... }).select().single() */
    createMission: function (input) {
      return wait().then(function () {
        var d = load(), u = me();
        if (!u) throw new Error('Not signed in.');
        var m = {
          id: newId('msn'), ownerId: u.id,
          title: input.title, objective: input.objective, area: input.area,
          status: 'draft', createdAt: now(), completedAt: null
        };
        d.missions.push(m); save();
        return clone(m);
      });
    },

    /* -> supabase.from('agent_runs').insert(six rows) +
          supabase.from('missions').update({ status: 'running' })            */
    startPipeline: function (missionId) {
      return wait().then(function () {
        var d = load(), m = ownedMission(missionId);
        if (!m) throw new Error('Mission not found, or you do not have access to it.');
        var existing = d.agentRuns.filter(function (r) { return r.missionId === m.id; });
        if (existing.length === 0) {
          AGENTS.forEach(function (a, i) {
            d.agentRuns.push({
              id: newId('run'), missionId: m.id, agentKey: a.key, order: i + 1,
              status: i === 0 ? 'running' : 'queued', summary: null, finishedAt: null
            });
          });
        }
        if (m.status === 'draft') m.status = 'running';
        save();
      });
    },

    /* -> supabase.from('agent_runs').select('*').eq('mission_id', id).order('order') */
    getAgentRuns: function (missionId) {
      return wait().then(function () {
        var d = load();
        if (!ownedMission(missionId)) return [];
        return clone(d.agentRuns
          .filter(function (r) { return r.missionId === missionId; })
          .sort(function (a, b) { return a.order - b.order; }));
      });
    },

    /* Completes the running agent and starts the next one. Returns the agent
       that just completed, or null when the pipeline has already finished.
       -> supabase.from('agent_runs').update({ status, summary }).eq('id', run.id)
          (in production this is driven by the workflow, not the browser)    */
    advanceAgent: function (missionId) {
      return new Promise(function (resolve) {
        var d = load(), m = ownedMission(missionId);
        if (!m) return resolve(null);

        var runs = d.agentRuns
          .filter(function (r) { return r.missionId === missionId; })
          .sort(function (a, b) { return a.order - b.order; });

        var running = runs.find(function (r) { return r.status === 'running'; });
        if (!running) return resolve(null);

        var def = agentByKey(running.agentKey);
        running.status = 'complete';
        running.summary = def ? def.summary : 'Complete.';
        running.finishedAt = now();

        if (running.agentKey === 'visualization') {
          var has = d.zones.some(function (z) { return z.missionId === missionId; });
          if (!has) { makeZones(m).forEach(function (z) { d.zones.push(z); }); }
        }

        var next = runs.find(function (r) { return r.status === 'queued'; });
        if (next) next.status = 'running';

        save();
        resolve(clone(running));
      });
    },

    /* -> supabase.from('zones').select('*').eq('mission_id', id) */
    getZones: function (missionId) {
      return wait().then(function () {
        var d = load();
        if (!ownedMission(missionId)) return [];
        return clone(d.zones.filter(function (z) { return z.missionId === missionId; }));
      });
    },

    /* -> supabase.from('reports').insert({ ... }) +
          supabase.from('missions').update({ status: 'complete' })           */
    generateReport: function (missionId) {
      return wait().then(function () {
        var d = load(), u = me(), m = ownedMission(missionId);
        if (!m) throw new Error('Mission not found, or you do not have access to it.');

        var runs = d.agentRuns
          .filter(function (r) { return r.missionId === missionId; })
          .sort(function (a, b) { return a.order - b.order; });
        if (runs.length === 0 || runs.some(function (r) { return r.status !== 'complete'; })) {
          throw new Error('All six agents must finish before a report can be generated.');
        }

        var existing = d.reports.find(function (r) { return r.missionId === missionId; });
        if (existing) return clone(existing);

        var zones = d.zones.filter(function (z) { return z.missionId === missionId; });
        var rep = makeReport(m, runs, zones, u);
        d.reports.push(rep);
        m.status = 'complete';
        m.completedAt = now();
        save();
        return clone(rep);
      });
    },

    /* -> supabase.from('reports').select('*').eq('mission_id', id).single() */
    getReport: function (missionId) {
      return wait().then(function () {
        var d = load();
        if (!ownedMission(missionId)) return null;
        var r = d.reports.find(function (x) { return x.missionId === missionId; });
        return r ? clone(r) : null;
      });
    },

    /* Demo convenience only. Not part of the Supabase contract. */
    resetDemoData: function () {
      try { localStorage.removeItem(KEY); } catch (e) {}
      db = null;
      load();
    }
  };
})();
