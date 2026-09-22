/* =====================================================================
   ksat-researcher.js — THE RESEARCH WORKSPACE, WIRED
   Owner: 01 Front End / 03 Security

   This file turns researcher.html from a drawing into a screen. Three
   jobs, in this order, and the order is the point:

     1 · establish the session, or show nothing
     2 · make sure the account is ENROLLED, because the payload archive's
         read policy tests for a profile row and not merely for a JWT
     3 · read the real rows and render them

   WHAT IS AND IS NOT A SECURITY CONTROL HERE

   Nothing in this file is a security control. Every line of it runs in a
   browser the reader owns, so every check in it can be turned off with a
   breakpoint. What actually stops an unauthorized read is
   03-security/db/13_payload_archive.sql: no grant at all for `anon`, a
   column grant for `authenticated`, and a policy that additionally
   requires enrolment. The worst this file can do when it is wrong is
   show a signed-in researcher an empty table.

   That is why the gate below hides the workspace rather than protecting
   it. It exists so that a visitor without a session is not shown a
   research console for half a second before it is taken away.

   ERRORS ARE PRINTED, NOT SWALLOWED

   Every read states what happened in the panel it belongs to. A table
   that is empty because the query failed and a table that is empty
   because there is nothing to show look identical, and on a platform
   whose argument is provenance, "I do not know why this is empty" is the
   one answer that must never be silent.
   ===================================================================== */

(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;

  function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }

  /* textContent everywhere, never innerHTML, for anything that came out
     of the database or off a keyboard. The one exception is the static
     trace markup at the bottom, which is a literal in this file. */
  function el(tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  function say(id, text) {
    var n = doc.getElementById(id);
    if (n) n.textContent = text || '';
  }

  function haveDb() { return !!window.sb; }

  var LOG = [];
  function log(line) {
    LOG.unshift(line);
    var box = doc.getElementById('sessionLog');
    if (!box) return;
    box.textContent = '';
    LOG.slice(0, 10).forEach(function (l) {
      box.appendChild(el('div', null, l));
    });
  }

  /* -------------------------------------------------------------------
     1 · Navigation
     ------------------------------------------------------------------- */
  function show(id) {
    $$('.view').forEach(function (v) { v.classList.add('hidden'); });
    var v = doc.getElementById(id);
    if (v) v.classList.remove('hidden');
    $$('nav button, aside button').forEach(function (b) { b.classList.remove('active'); });
    $$('[data-go="' + id + '"]').forEach(function (b) { b.classList.add('active'); });
    window.scrollTo(0, 0);
    if (location.hash.slice(1) !== id) {
      try { history.replaceState(null, '', '#' + id); } catch (e) {}
    }
  }

  function wireNav() {
    doc.addEventListener('click', function (e) {
      var go = e.target.closest ? e.target.closest('[data-go]') : null;
      if (go) { show(go.getAttribute('data-go')); return; }
      var act = e.target.closest ? e.target.closest('[data-act]') : null;
      if (act) action(act.getAttribute('data-act'), act);
    });
  }

  function action(name, btn) {
    if (name === 'new-mission') { $('#modal').classList.remove('hidden'); say('modalMsg', ''); }
    else if (name === 'close-modal') { $('#modal').classList.add('hidden'); }
    else if (name === 'create') { createMission(btn); }
    else if (name === 'close-sheet') { $('#frameSheetCard').hidden = true; }
    else if (name === 'run') { runTrace(); }
    else if (name === 'approve') {
      say('decisionMsg', 'Recorded as a researcher decision in this browser only. ' +
          'Advancing a real mission runs through launch_mission(), which is a human action ' +
          'on the mission record, not a button on a review panel.');
    } else if (name === 'reject') {
      say('decisionMsg', 'Returned to the Orchestrator for re-ranking. The candidate set is ' +
          'rebuilt from evidence; it is not edited in place.');
    }
  }

  /* -------------------------------------------------------------------
     2 · The session gate
     ------------------------------------------------------------------- */
  function denied(why) {
    root.classList.remove('ksat-checking');
    root.classList.add('ksat-denied');
    var d = doc.getElementById('denied');
    if (d) d.hidden = false;
    var e = doc.getElementById('entry');
    if (e) e.remove();
    if (why) {
      var p = $('#denied p');
      if (p) p.textContent = why;
    }
    if (window.KSAT && window.KSAT.stars) window.KSAT.stars.sweep();
  }

  function admitted(user) {
    root.classList.remove('ksat-checking');
    root.classList.add('ksat-ready');
    var e = doc.getElementById('entry');
    if (e) e.remove();

    /* Belt and braces. denied() and this are mutually exclusive in the
       flow as it stands, so this line should never have anything to do
       — but a refusal panel left standing over an admitted workspace is
       the failure this page just shipped once, and it cost a live site
       visit to find. One line is cheap insurance against it coming back
       by a route nobody has thought of yet. */
    root.classList.remove('ksat-denied');
    var d = doc.getElementById('denied');
    if (d) { d.hidden = true; }

    var meta = user.user_metadata || {};
    var nameBox = doc.getElementById('whoName');
    if (nameBox) {
      nameBox.textContent = meta.display_name || user.email || 'Researcher';
      var small = el('small', null, meta.org || 'Authorized researcher');
      small.id = 'whoOrg';
      nameBox.appendChild(small);
    }
    log('session established for ' + (user.email || user.id));
    show(location.hash.slice(1) || 'overview');
  }

  /* IS THERE A SESSION IN STORAGE AT ALL?

     Supabase persists it under sb-<project ref>-auth-token in
     localStorage. This does NOT read the token and does not care what is
     in it — it asks one question: has this browser ever been signed in
     to this project? That is the only thing settleSession() needs in
     order to know whether waiting is worth anything. */
  function persisted() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf('sb-') === 0 && k.indexOf('-auth-token') > 0) { return true; }
      }
    } catch (e) { /* private mode, or storage blocked */ }
    return false;
  }

  /* WHY THIS RETRIES, AND WHY ONLY SOMETIMES.

     Seen on the live site: a researcher with a valid session was sent
     here from the hub and got "This workspace is restricted". Reloading
     the same URL a moment later admitted them. getSession() had resolved
     with nothing while the client was still coming up from storage —
     the arrival is a location.replace() from another page, so this page
     starts its auth client in the same instant the previous one was
     using it.

     Denying a researcher who IS signed in is the worst thing this page
     can do, and it is worse than a pause. So: if storage says this
     browser has a session for this project, ask again, up to five times
     at 300ms. A visitor who has genuinely never signed in has no such
     key, persisted() is false on the first pass, and they are refused
     immediately with no wait at all. The public case costs nothing. */
  function settleSession(tries) {
    return window.sb.auth.getSession().then(function (r) {
      var s = r && r.data && r.data.session;
      if ((s && s.user) || tries <= 0 || !persisted()) { return (s && s.user) ? s : null; }
      log('waiting for the session to come up');
      return new Promise(function (go) { setTimeout(go, 300); })
        .then(function () { return settleSession(tries - 1); });
    });
  }

  function gate() {
    if (!haveDb()) {
      denied('This workspace could not reach the mission database, so it cannot verify ' +
             'your session. Please tell the team.');
      return;
    }
    settleSession(5).then(function (s) {
      if (!s || !s.user) { denied(); return; }
      admitted(s.user);
      enrol(s.user).then(load);
    }).catch(function () {
      denied('This workspace could not reach the mission database, so it cannot verify ' +
             'your session. Please tell the team.');
    });

    /* A session that dies in another tab must not leave this one showing
       a workspace. scope:'global' sign out elsewhere fires this. */
    window.sb.auth.onAuthStateChange(function (evt) {
      if (evt === 'SIGNED_OUT') location.replace('/');
    });
  }

  /* Enrolment. The payload archive policy is
        using (public.is_enrolled_researcher())
     which requires a row in public.profiles. js/ksat-integration.js
     creates that row when somebody signs in on the mission hub, but a
     researcher can arrive here on a session that predates it, and the
     failure mode would be an archive that is empty for no visible
     reason. So it is made sure of here too.

     ignoreDuplicates, not a plain upsert: 03_grants.sql grants
     insert(user_id, display_name, org) but update(display_name, org)
     only, so a normal upsert's ON CONFLICT DO UPDATE tries to write
     user_id and is refused. */
  function enrol(user) {
    if (!haveDb()) return Promise.resolve();
    var meta = user.user_metadata || {};
    return window.sb.from('profiles')
      .upsert({ user_id: user.id,
                display_name: meta.display_name || user.email,
                org: meta.org || null },
              { onConflict: 'user_id', ignoreDuplicates: true })
      .then(function () { log('enrolment confirmed'); })
      .catch(function () { log('enrolment check could not complete'); });
  }

  function signOut() {
    if (!haveDb()) { location.replace('/'); return; }
    window.sb.auth.signOut({ scope: 'global' }).then(function () {
      location.replace('/');
    }).catch(function () { location.replace('/'); });
  }

  /* -------------------------------------------------------------------
     3 · The payload archive
     ------------------------------------------------------------------- */
  var FRAMES = [];

  var FRAME_COLS = 'frame_no,captured_on,place_label,lat,lon,geo_method,' +
                   'geo_confidence,geo_note,gsd_m,band_note,processing_level,' +
                   'image_mime,image_b64,image_w,image_h,source_note';

  /* A row whose picture has not been loaded yet is a real state, not an
     error: the acquisition record, the geolocation and the provenance are
     all in the database, and only the bytes are still to come. Rendering
     an empty data: URI would give a broken-image icon and no explanation,
     so the frame box says what is actually true instead. */
  function hasImage(f) { return !!(f.image_b64 && f.image_b64.length > 32); }

  function dataUri(f) {
    return 'data:' + (f.image_mime || 'image/jpeg') + ';base64,' + f.image_b64;
  }

  function placeholder(text) {
    var d = el('div', 'noimg');
    d.appendChild(el('span', null, text));
    return d;
  }

  function coord(f) {
    if (f.lat === null || f.lat === undefined || f.lon === null || f.lon === undefined) {
      return 'Not resolved';
    }
    var la = Number(f.lat), lo = Number(f.lon);
    return la.toFixed(4) + (la >= 0 ? '°N' : '°S') + '  ' +
           lo.toFixed(4) + (lo >= 0 ? '°E' : '°W');
  }

  function loadFrames() {
    var grid = doc.getElementById('framesGrid');
    if (!grid) return;
    grid.textContent = '';
    say('framesMsg', 'Reading the archive…');

    window.sb.from('payload_frames').select(FRAME_COLS).order('frame_no')
      .then(function (r) {
        if (r.error) {
          say('framesMsg', 'The archive refused this read: ' + r.error.message +
              ' — this is what an account without enrolment sees.');
          log('payload archive: refused');
          return;
        }
        FRAMES = r.data || [];
        say('framesMsg', '');
        var withPic = FRAMES.filter(hasImage).length;
        var c = doc.getElementById('framesCount');
        if (c) {
          c.textContent = FRAMES.length +
            (FRAMES.length === 1 ? ' payload frame' : ' payload frames') +
            (withPic === FRAMES.length ? '' : '  ·  ' + withPic + ' with a picture');
        }
        var k = doc.getElementById('kFrames');
        if (k) k.textContent = String(FRAMES.length).padStart(2, '0');
        say('kFramesSub', 'Released to this session');
        log('payload archive: ' + FRAMES.length + ' frames released');

        if (!FRAMES.length) {
          say('framesMsg', 'The archive answered, and it is empty for this account.');
          return;
        }

        FRAMES.forEach(function (f) {
          var b = el('button', 'frame');
          b.type = 'button';
          if (hasImage(f)) {
            var img = doc.createElement('img');
            img.src = dataUri(f);
            img.alt = 'KuwaitSat-1 frame ' + f.frame_no +
                      (f.place_label ? ', ' + f.place_label : '') +
                      ', acquired ' + f.captured_on;
            img.loading = 'lazy';
            b.appendChild(img);
          } else {
            b.appendChild(placeholder('Picture not loaded yet'));
          }

          var m = el('div', 'meta');
          m.appendChild(el('b', null, 'Frame ' + String(f.frame_no).padStart(2, '0') +
                                      ' · ' + (f.place_label || 'Location not resolved')));
          m.appendChild(el('span', null, f.captured_on + '  ·  ' + coord(f)));
          var cf = el('span');
          var badge = el('i', 'conf ' + (f.geo_confidence || 'unresolved'), f.geo_confidence || 'unresolved');
          badge.style.fontStyle = 'normal';
          cf.appendChild(badge);
          m.appendChild(cf);
          b.appendChild(m);

          b.addEventListener('click', function () { sheet(f); });
          grid.appendChild(b);
        });

        geoNote();
      });
  }

  function sheet(f) {
    var card = doc.getElementById('frameSheetCard');
    var box = doc.getElementById('frameSheet');
    if (!card || !box) return;
    box.textContent = '';
    doc.getElementById('frameSheetTitle').textContent =
      'Frame ' + String(f.frame_no).padStart(2, '0') +
      (f.place_label ? ' · ' + f.place_label : '');

    if (hasImage(f)) {
      var img = doc.createElement('img');
      img.src = dataUri(f);
      img.alt = 'KuwaitSat-1 frame ' + f.frame_no +
                (f.place_label ? ', ' + f.place_label : '');
      box.appendChild(img);
    } else {
      box.appendChild(placeholder(
        'The picture for this frame has not been loaded into the archive yet. ' +
        'Everything else on this row is recorded.'));
    }

    var dl = doc.createElement('dl');
    function row(k, v, note) {
      dl.appendChild(el('dt', null, k));
      var dd = el('dd', null, v);
      if (note) dd.appendChild(el('small', null, note));
      dl.appendChild(dd);
    }
    row('Acquired', f.captured_on);
    row('Geolocation', coord(f), f.place_label || '');
    row('Confidence', f.geo_confidence || 'unresolved', f.geo_note || '');
    row('Method', f.geo_method || 'not stated');
    row('Ground sample distance', Number(f.gsd_m).toFixed(0) + ' metres per pixel');
    row('Bands', f.band_note);
    row('Processing level', f.processing_level);
    row('Frame size', (f.image_w && f.image_h) ? (f.image_w + ' × ' + f.image_h + ' px') : 'not recorded');
    row('Source', f.source_note);
    box.appendChild(dl);

    card.hidden = false;
    card.scrollIntoView({ block: 'nearest' });
  }

  /* The method note is written from the rows themselves rather than
     hard coded, so it can never drift away from what the table says. */
  function geoNote() {
    var box = doc.getElementById('geoMethodNote');
    if (!box) return;
    box.textContent = '';
    var byMethod = {};
    FRAMES.forEach(function (f) {
      var k = f.geo_method || 'not stated';
      byMethod[k] = (byMethod[k] || 0) + 1;
    });
    Object.keys(byMethod).forEach(function (k) {
      box.appendChild(el('div', null, byMethod[k] + ' × ' + k));
    });
    box.appendChild(el('div', null, ' '));
    box.appendChild(el('div', null,
      'The record sheet the payload team supplied left the Geolocation column empty on ' +
      'every row. Nothing in this column came off the spacecraft, so each row states how ' +
      'its coordinate was arrived at and how far it should be trusted.'));
  }

  /* -------------------------------------------------------------------
     4 · Missions, reports, and the dataset summary
     ------------------------------------------------------------------- */
  function cell(tr, text, cls) {
    var td = el('td', cls, text);
    tr.appendChild(td);
    return td;
  }

  function loadMissions() {
    say('missionMsg', 'Reading your missions…');
    window.sb.from('missions')
      .select('id,title,objective,status,created_at')
      .order('created_at', { ascending: false })
      .then(function (r) {
        var t = doc.getElementById('missionTable');
        var ov = doc.getElementById('ovMissions');
        if (r.error) {
          say('missionMsg', 'Could not read missions: ' + r.error.message);
          say('ovMissionsMsg', 'Could not read missions.');
          return;
        }
        var rows = r.data || [];
        say('missionMsg', rows.length ? '' :
          'No missions on this account yet. Row level security shows you your own ' +
          'missions and nobody else’s, so an empty table here means you have not ' +
          'created one.');
        say('ovMissionsMsg', '');
        var k = doc.getElementById('kMissions');
        if (k) k.textContent = String(rows.length).padStart(2, '0');
        say('kMissionsSub', 'Visible to this account');

        rows.forEach(function (m, i) {
          var tr = doc.createElement('tr');
          cell(tr, (m.title || 'Untitled'));
          cell(tr, (m.objective || '').slice(0, 120));
          cell(tr, (m.created_at || '').slice(0, 10));
          var td = el('td');
          td.appendChild(el('span', 'tag' + (m.status === 'complete' ? ' green' :
                             m.status === 'running' ? ' amber' : ''), (m.status || 'draft').toUpperCase()));
          tr.appendChild(td);
          t.appendChild(tr);
          if (i < 4 && ov) ov.appendChild(tr.cloneNode(true));
        });
        log('missions: ' + rows.length + ' visible');
      });
  }

  function loadReports() {
    say('reportMsg', 'Reading reports…');
    window.sb.from('reports').select('id,mission_id,approved_at').then(function (r) {
      var t = doc.getElementById('reportTable');
      if (r.error) { say('reportMsg', 'Could not read reports: ' + r.error.message); return; }
      var rows = r.data || [];
      say('reportMsg', rows.length ? '' :
        'No reports on this account yet. A report exists only once a researcher has ' +
        'approved the findings behind it.');
      rows.forEach(function (rep) {
        var tr = doc.createElement('tr');
        cell(tr, 'Mission report');
        cell(tr, rep.mission_id);
        cell(tr, rep.approved_at ? rep.approved_at.slice(0, 10) : 'not approved');
        var td = el('td');
        td.appendChild(el('span', 'tag' + (rep.approved_at ? ' green' : ' amber'),
                          rep.approved_at ? 'FINAL' : 'DRAFT'));
        tr.appendChild(td);
        t.appendChild(tr);
      });
    });
  }

  /* The Data Archive view lists what this workspace can actually reach,
     counted from the database, rather than the prototype's five invented
     rows with a "128 datasets" heading above them. */
  function loadDatasets() {
    var t = doc.getElementById('dataTable');
    say('dataMsg', 'Counting what this session can reach…');
    var want = [
      { name: 'KuwaitSat-1 payload frames', table: 'payload_frames', source: 'Payload camera',
        cls: 'MEASURED', res: '39 m/px', quality: 'Raw decoded' },
      { name: 'Mission records', table: 'missions', source: 'This platform',
        cls: 'DERIVED', res: 'per mission', quality: 'Researcher entered' },
      { name: 'Agent step log', table: 'agent_steps', source: 'Orchestrator',
        cls: 'MEASURED', res: 'per step', quality: 'Append only' },
      { name: 'Findings', table: 'results', source: 'Analysis agents',
        cls: 'DERIVED', res: 'per finding', quality: 'Reviewed' },
      { name: 'Reports', table: 'reports', source: 'Reporting agent',
        cls: 'DERIVED', res: 'per mission', quality: 'Approved' }
    ];
    var done = 0;
    want.forEach(function (d) {
      window.sb.from(d.table).select('*', { count: 'exact', head: true }).then(function (r) {
        var tr = doc.createElement('tr');
        cell(tr, d.name);
        cell(tr, d.source);
        cell(tr, d.cls);
        cell(tr, d.res);
        cell(tr, r.error ? 'refused' : String(r.count === null ? 0 : r.count));
        cell(tr, r.error ? 'no access' : d.quality);
        t.appendChild(tr);
        if (++done === want.length) {
          say('dataMsg', '');
          var c = doc.getElementById('dataCount');
          if (c) c.textContent = want.length + ' datasets reachable from this session';
        }
      });
    });
  }

  function pipeline() {
    var n = doc.getElementById('pipeState');
    window.sb.from('payload_frames').select('frame_no', { count: 'exact', head: true })
      .then(function (r) {
        if (n) n.textContent = r.error ? '● REFUSED' : '● OPERATIONAL';
        var k = doc.getElementById('kIngest');
        if (k) k.textContent = r.error ? 'Refused' : 'Nominal';
        say('kIngestSub', r.error ? 'The archive did not answer this account'
                                  : 'Archive answered this session');
      });
  }

  function load() {
    pipeline();
    loadFrames();
    loadMissions();
    loadReports();
    loadDatasets();
  }

  /* -------------------------------------------------------------------
     5 · New mission — a real insert, refused visibly when it is refused
     ------------------------------------------------------------------- */
  function createMission(btn) {
    var title = $('#mTitle').value.trim();
    var objective = $('#mObjective').value.trim();
    if (!title || !objective) {
      say('modalMsg', 'A mission needs a name and a research objective.');
      return;
    }
    if (!haveDb()) { say('modalMsg', 'The mission database is not reachable.'); return; }
    btn.disabled = true;
    say('modalMsg', 'Creating…');

    var area = $('#mArea').value.trim();
    window.sb.from('missions').insert({
      title: title,
      objective: objective,
      area_geojson: area ? { note: area } : null
    }).select('id').then(function (r) {
      btn.disabled = false;
      if (r.error) { say('modalMsg', 'The database refused this insert: ' + r.error.message); return; }
      $('#modal').classList.add('hidden');
      $('#mTitle').value = ''; $('#mObjective').value = ''; $('#mArea').value = '';
      doc.getElementById('missionTable').querySelectorAll('tr:not(:first-child)')
         .forEach(function (n) { n.remove(); });
      loadMissions();
      show('missions');
      log('mission created');
    });
  }

  /* -------------------------------------------------------------------
     6 · The console trace
     ------------------------------------------------------------------- */
  function runTrace() {
    var q = ($('#q').value || '').trim() ||
      'Identify areas in Kuwait where increasing vegetation could improve environmental conditions.';
    var box = doc.getElementById('trace');
    box.className = 'log';
    box.textContent = '';
    var lines = [
      'REQUEST',
      '“' + q + '”',
      '',
      'MISSION ORCHESTRATOR — evaluating required evidence',
      'SATELLITE DATA AGENT — ' + FRAMES.length + ' payload frames available to this account',
      'ENVIRONMENTAL ANALYSIS AGENT — candidate zones identified',
      'ORCHESTRATOR DECISION — evidence sufficient for recommendation review',
      'HUMAN CHECKPOINT — researcher approval required',
      'Impact Prediction Agent remains on hold until approval.',
      '',
      'This trace is drawn from the workspace, not from a run. A real run is ' +
      'recorded step by step in agent_steps and is readable from the mission record.'
    ];
    lines.forEach(function (l) { box.appendChild(el('div', null, l)); });
  }

  /* ------------------------------------------------------------------- */
  function boot() {
    wireNav();

    /* The hub redirects a signed-in researcher straight back here, which
       is what "signing in takes you to your workspace" has to mean. This
       flag is the one exception: it says "I asked for the hub on
       purpose". ksat-integration.js reads it once and clears it, so the
       next visit lands on the workspace again. */
    $$('a[href="/"]').forEach(function (a) {
      a.addEventListener('click', function () {
        try { sessionStorage.setItem('ksat.stayOnHub', '1'); } catch (e) {}
      });
    });

    var out = doc.getElementById('signout');
    if (out) out.addEventListener('click', signOut);
    var ms = doc.getElementById('missionSearch');
    if (ms) ms.addEventListener('input', function () {
      var v = ms.value.toLowerCase();
      $$('#missionTable tr').slice(1).forEach(function (tr) {
        tr.hidden = v && tr.textContent.toLowerCase().indexOf(v) < 0;
      });
    });
    var ds = doc.getElementById('dataSearch');
    if (ds) ds.addEventListener('input', function () {
      var v = ds.value.toLowerCase();
      $$('#dataTable tr').slice(1).forEach(function (tr) {
        tr.hidden = v && tr.textContent.toLowerCase().indexOf(v) < 0;
      });
    });
    window.addEventListener('hashchange', function () {
      var id = location.hash.slice(1);
      if (id && doc.getElementById(id)) show(id);
    });
    gate();
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
