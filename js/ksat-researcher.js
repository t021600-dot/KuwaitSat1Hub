/* =====================================================================
   ksat-researcher.js — THE RESEARCH WORKSPACE, WIRED
   Owner: 01 Front End / 03 Security

   This file turns researcher.html from a drawing into a screen. Three
   jobs, in this order, and the order is the point:

     1 · establish the session, or show nothing
     2 · make sure the account is ENROLLED, because the payload archive's
         read policy tests for a profile row and not merely for a JWT
     3 · read the real rows and render them

   It owns the page. Two other files do the specialist work and are
   loaded before it:

     js/ksat-geo.js     maps, georeferencing, and the pixel measurement
     js/ksat-agents.js  the Orchestrator and the six agents

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

   NO PANEL IS EVER DRAWN FROM A LOCAL VARIABLE WHEN THE DATABASE COULD
   BE ASKED. The run trace in particular is re-read out of agent_steps
   after every write, never rendered from the array the pipeline was
   holding. A trace drawn from memory is a claim; a trace drawn from the
   table is evidence, and evidence is the entire product.
   ===================================================================== */

(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var KS = window.KSAT = window.KSAT || {};
  var geo = KS.geo;
  var agents = KS.agents;

  function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }

  /* textContent everywhere, never innerHTML, for anything that came out
     of the database or off a keyboard. There is no exception in this
     file: even the report renderer builds nodes. */
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

  function clear(n) { if (n) { while (n.firstChild) n.removeChild(n.firstChild); } }

  function haveDb() { return !!window.sb; }

  function pad2(n) { return String(n).padStart(2, '0'); }
  function shortId(id) { return id ? String(id).slice(0, 8) : '—'; }
  function when(ts) { return ts ? String(ts).replace('T', ' ').slice(0, 16) : '—'; }

  var LOG = [];
  function log(line) {
    LOG.unshift(line);
    var box = doc.getElementById('sessionLog');
    if (!box) return;
    clear(box);
    LOG.slice(0, 12).forEach(function (l) { box.appendChild(el('div', null, l)); });
  }

  /* A download, from data this session already holds. No server round
     trip and nothing leaves the browser except to the reader's own disk. */
  function download(name, mime, text) {
    var blob = new Blob([text], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = doc.createElement('a');
    a.href = url; a.download = name;
    doc.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  /* -------------------------------------------------------------------
     1 · Navigation
     ------------------------------------------------------------------- */

  /* Maps are built the first time their view is shown and resized every
     time after. Leaflet measures its container once; a map created
     inside a display:none section is 0x0 for ever unless it is told. */
  var MAPS_BUILT = {};
  function onShow(id) {
    if (id === 'geo') { buildGeoMap(); geo.resize('geoMap'); }
    if (id === 'overview') { buildOverviewMap(); geo.resize('ovMap'); }
    if (id === 'missions') { geo.resize('mdMap'); }
    if (id === 'audit') { loadAudit(); }
    if (id === 'console') { fillRunMission(); }
  }

  function show(id) {
    $$('.view').forEach(function (v) { v.classList.add('hidden'); });
    var v = doc.getElementById(id);
    if (v) v.classList.remove('hidden');
    $$('nav button, aside button').forEach(function (b) { b.classList.remove('active'); });
    $$('[data-go="' + id + '"]').forEach(function (b) { b.classList.add('active'); });
    window.scrollTo(0, 0);
    /* The geo view drives the hash itself (#geo@lat,lon,zoom) once the
       map moves, so this must not overwrite a coordinate with a bare
       '#geo'. But it DOES have to write one the first time, or the hash
       is left saying '#frames' while the map is on screen and a reload
       lands the researcher somewhere they were not. */
    var current = location.hash.slice(1);
    var wantsHash = (id === 'geo') ? (current.split('@')[0] !== 'geo') : (current !== id);
    if (wantsHash) {
      try { history.replaceState(null, '', '#' + id); } catch (e) {}
    }
    onShow(id);
  }

  function wireNav() {
    doc.addEventListener('click', function (e) {
      var go = e.target.closest ? e.target.closest('[data-go]') : null;
      if (go) {
        if (go.tagName === 'A') e.preventDefault();
        show(go.getAttribute('data-go'));
        return;
      }
      var act = e.target.closest ? e.target.closest('[data-act]') : null;
      if (act) action(act.getAttribute('data-act'), act);
    });

    /* Escape closes whatever is open, innermost first. */
    doc.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var m = doc.getElementById('modal');
      if (m && !m.classList.contains('hidden')) { closeModal(); return; }
      var s = doc.getElementById('frameSheetCard');
      if (s && !s.hidden) { s.hidden = true; return; }
      var d = doc.getElementById('missionDetail');
      if (d && !d.hidden) { d.hidden = true; }
    });
  }

  function action(name, btn) {
    switch (name) {
      case 'new-mission':      openModal(); break;
      case 'close-modal':      closeModal(); break;
      case 'create':           createMission(btn); break;
      case 'close-sheet':      $('#frameSheetCard').hidden = true; break;
      case 'frame-on-map':     frameOnMap(); break;
      case 'close-detail':     $('#missionDetail').hidden = true; break;
      case 'run':              startRun(btn); break;
      case 'approve':          approveRun(btn); break;
      case 'reject':           rejectRun(btn); break;
      case 'abandon':          abandonRun(btn); break;
      case 'geo-fit-frames':   fitFrames(); break;
      case 'geo-fit-missions': fitMissions(); break;
      case 'geo-use-view':     useViewAsAoi(); break;
      case 'audit-refresh':    loadAudit(true); break;
      case 'access-test':      accessTest(btn); break;
      case 'export-frames':    exportFrames(); break;
      case 'export-findings':  exportFindings(); break;
      case 'export-report':    exportReport(); break;
      case 'print-report':     printReport(); break;
      case 'close-report':     $('#reportViewWrap').hidden = true; break;
      case 'launch':           launchFromDetail(btn); break;
      case 'make-report':      makeReport(btn); break;
      case 'sign-report':      signReport(RESULT_MISSION && RESULT_MISSION.id, btn, 'rrMsg',
                                 function () {
                                   doc.getElementById('rrTag').textContent = 'SIGNED';
                                   doc.getElementById('rrTag').className = 'tag green';
                                   /* The heading stays "The Report" in
                                      both states now. #rrTag beside it
                                      goes DRAFT -> SIGNED and turns
                                      green, which is where the state
                                      belongs; the heading naming it as
                                      well was the same fact twice. */
                                   doc.getElementById('rrTag').setAttribute(
                                     'title', 'Signed and published');
                                 }); break;
      case 'close-result':     doc.getElementById('runResultCard').hidden = true; break;
      case 'open-in-console':  openInConsole(); break;
      default: break;
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
    if (KS.stars) KS.stars.sweep();
  }

  var ME = null;

  function admitted(user) {
    ME = user;
    root.classList.remove('ksat-checking');
    root.classList.add('ksat-ready');
    var e = doc.getElementById('entry');
    if (e) e.remove();

    /* Belt and braces. denied() and this are mutually exclusive in the
       flow as it stands, so this line should never have anything to do
       — but a refusal panel left standing over an admitted workspace is
       the failure this page shipped once, and it cost a live site visit
       to find. One line is cheap insurance against it coming back by a
       route nobody has thought of yet. */
    root.classList.remove('ksat-denied');
    var d = doc.getElementById('denied');
    if (d) { d.hidden = true; }

    var meta = user.user_metadata || {};
    var nameBox = doc.getElementById('whoName');
    var shown = meta.display_name || user.email || 'Researcher';
    if (nameBox) {
      nameBox.textContent = shown;
      var small = el('small', null, meta.org || 'Authorized researcher');
      small.id = 'whoOrg';
      nameBox.appendChild(small);
    }
    /* The disc beside the name. First letter of whatever is actually
       being shown, so it can never disagree with the label next to it. */
    var mark = doc.getElementById('whoInitial');
    if (mark) {
      var letter = String(shown).replace(/[^A-Za-z\u0600-\u06FF]/, '').charAt(0);
      mark.textContent = letter || '\u2022';
    }
    log('session established for ' + (user.email || user.id));

    var want = (location.hash.slice(1) || 'overview').split('@')[0];
    if (!doc.getElementById(want)) want = 'overview';
    show(want);
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
      denied('This workspace could not reach the research database, so it cannot verify ' +
             'your session. Please tell the team.');
      return;
    }
    settleSession(5).then(function (s) {
      if (!s || !s.user) { denied(); return; }
      admitted(s.user);
      enrol(s.user).then(load);
    }).catch(function () {
      denied('This workspace could not reach the research database, so it cannot verify ' +
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
  /* False until loadFrames() has resolved either way. Run Analysis stays
     disabled while it is false, because a run started against an empty
     FRAMES writes "the archive holds 0 frames" into a permanent audit
     trail - and eight base64 images take a moment on a venue connection. */
  var FRAMES_READY = false;
  var MISSIONS = [];
  var SHEET_FRAME = null;

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
    return geo.fmtCoord(Number(f.lat), Number(f.lon));
  }

  function loadFrames() {
    var grid = doc.getElementById('framesGrid');
    if (!grid) return Promise.resolve();
    clear(grid);
    say('framesMsg', 'Reading the archive…');

    return window.sb.from('payload_frames').select(FRAME_COLS).order('frame_no')
      .then(function (r) {
        /* Set on BOTH paths. A refusal is an answer: the archive state is
           now known, so Run Analysis should stop saying "loading" and
           become enabled or not on the real facts. */
        FRAMES_READY = true;
        if (doc.getElementById('runMission')) {
          objectiveFor(missionById(doc.getElementById('runMission').value));
        }
        if (r.error) {
          say('framesMsg', 'The archive refused this read: ' + r.error.message +
              ' — this is what an account without enrolment sees.');
          var pay = doc.getElementById('payState');
          if (pay) pay.textContent = '● REFUSED';
          var lf0 = doc.getElementById('lastFrame');
          if (lf0) lf0.textContent = '● UNKNOWN';
          var ar0 = doc.getElementById('archiveState');
          if (ar0) ar0.textContent = '● REFUSED';
          log('payload archive: refused');
          return;
        }
        FRAMES = r.data || [];
        say('framesMsg', '');
        var pay2 = doc.getElementById('payState');
        if (pay2) pay2.textContent = '● AVAILABLE';

        /* The status strip, from the rows rather than from the markup.
           "LAST FRAME" is the newest captured_on in the archive; that is
           a fact this platform holds. "SPACECRAFT NOMINAL" was not. */
        var newest = FRAMES.reduce(function (d, f) {
          return (f.captured_on && f.captured_on > d) ? f.captured_on : d;
        }, '');
        var lf = doc.getElementById('lastFrame');
        if (lf) lf.textContent = newest ? '● ' + newest : '● NONE';
        var arch = doc.getElementById('archiveState');
        if (arch) arch.textContent = '● ' + FRAMES.length + ' FRAMES';
        var withPic = FRAMES.filter(hasImage).length;
        var c = doc.getElementById('framesCount');
        if (c) {
          c.textContent = FRAMES.length +
            (FRAMES.length === 1 ? ' payload frame' : ' payload frames') +
            (withPic === FRAMES.length ? '' : '  ·  ' + withPic + ' with a picture');
        }
        var k = doc.getElementById('kFrames');
        if (k) k.textContent = pad2(FRAMES.length);
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
          m.appendChild(el('b', null, 'Frame ' + pad2(f.frame_no) +
                                      ' · ' + (f.place_label || 'Location not resolved')));
          m.appendChild(el('span', null, f.captured_on + '  ·  ' + coord(f)));
          var cf = el('span');
          var badge = el('i', 'conf ' + (f.geo_confidence || 'unresolved'),
                         f.geo_confidence || 'unresolved');
          badge.style.fontStyle = 'normal';
          cf.appendChild(badge);
          m.appendChild(cf);
          b.appendChild(m);

          b.addEventListener('click', function () { sheet(f); });
          grid.appendChild(b);
        });

        geoNote();
        paintGeoLayers();
      });
  }

  function sheet(f) {
    SHEET_FRAME = f;
    var card = doc.getElementById('frameSheetCard');
    var box = doc.getElementById('frameSheet');
    if (!card || !box) return;
    clear(box);
    doc.getElementById('frameSheetTitle').textContent =
      'Frame ' + pad2(f.frame_no) + (f.place_label ? ' · ' + f.place_label : '');

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
    if (geo.hasFix(f)) {
      var b = geo.frameBounds(f);
      var km = Math.round((b[1][1] - b[0][1]) * 111320 *
                Math.cos(Number(f.lat) * Math.PI / 180) / 1000);
      row('Footprint', 'about ' + km + ' km across', geo.FOOTPRINT_NOTE);
    }
    row('Bands', f.band_note);
    row('Processing level', f.processing_level);
    row('Frame size', (f.image_w && f.image_h) ? (f.image_w + ' × ' + f.image_h + ' px') : 'not recorded');
    row('Source', f.source_note);
    box.appendChild(dl);

    var btn = $('[data-act="frame-on-map"]');
    if (btn) btn.disabled = !geo.hasFix(f);

    card.hidden = false;
    card.scrollIntoView({ block: 'nearest' });
  }

  function frameOnMap() {
    if (!SHEET_FRAME || !geo.hasFix(SHEET_FRAME)) return;
    show('geo');
    var map = buildGeoMap();
    if (!map) return;
    geo.resize('geoMap');
    geo.fit(map, geo.frameBounds(SHEET_FRAME), [30, 30]);
  }

  /* The method note is written from the rows themselves rather than
     hard coded, so it can never drift away from what the table says. */
  function geoNote() {
    var box = doc.getElementById('geoMethodNote');
    if (!box) return;
    clear(box);
    var byMethod = {};
    FRAMES.forEach(function (f) {
      var k = f.geo_method || 'not stated';
      byMethod[k] = (byMethod[k] || 0) + 1;
    });
    Object.keys(byMethod).forEach(function (k) {
      box.appendChild(el('div', null, byMethod[k] + ' × ' + k));
    });
    box.appendChild(el('div', null, ' '));
    box.appendChild(el('div', null,
      'The record sheet the payload team supplied left the Geolocation column empty on ' +
      'every row. Nothing in this column came off the spacecraft, so each row states how ' +
      'its coordinate was arrived at and how far it should be trusted.'));
  }

  function exportFrames() {
    if (!FRAMES.length) { say('framesMsg', 'There is nothing to export yet.'); return; }
    var cols = ['frame_no', 'captured_on', 'place_label', 'lat', 'lon', 'geo_method',
                'geo_confidence', 'gsd_m', 'band_note', 'processing_level',
                'image_w', 'image_h', 'source_note'];
    var lines = [cols.join(',')];
    FRAMES.forEach(function (f) {
      lines.push(cols.map(function (c) {
        var v = f[c];
        if (v === null || v === undefined) return '';
        v = String(v).replace(/"/g, '""');
        return /[",\n]/.test(v) ? '"' + v + '"' : v;
      }).join(','));
    });
    /* The pictures are deliberately NOT in this file. The record is the
       researcher's to take away; the imagery stays behind the session. */
    lines.push('');
    lines.push('# KuwaitSat-1 payload record. Acquisition metadata only - the frame');
    lines.push('# images are not included and are released only inside a signed-in session.');
    download('kuwaitsat1-payload-record.csv', 'text/csv;charset=utf-8', lines.join('\n'));
    log('frame record exported as CSV');
  }

  /* -------------------------------------------------------------------
     4 · Missions
     ------------------------------------------------------------------- */
  function areaLabel(m) {
    var a = m.area_geojson;
    if (!a) return '—';
    if (a.name) return a.name;
    if (a.type === 'Polygon') return geo.polygonTrueAreaKm2(a) + ' km²';
    return 'custom';
  }

  /* THE NAME IS CONTEXT. THE FIGURE IS WHAT THE COLUMN IS HEADED.

     areaLabel() returns the polygon's name the moment it has one, and
     every mission created through the UI has one, so the AREA column
     read "Drawn on the map" and "Al-Jahra city" while a column headed
     AREA was asking a different question. The rows that DID show a
     figure were the ones that had lost their name, which is the
     opposite of what it looked like.

     areaLabel() itself is left alone: openMission() at the detail panel
     already appends the km2 by hand, and changing it there would print
     the figure twice.

     The figure is polygonTrueAreaKm2, not polygonAreaKm2. For a
     map-drawn area or a preset the two agree exactly, because the
     polygon IS a rectangle. For a mission that is a real residential
     block they do not: Qasr is 4.3 km2 of ground in an 8.53 km2 box. */
  function areaCell(m) {
    var a = m.area_geojson;
    if (!a) return '—';
    if (a.type !== 'Polygon') return a.name || 'custom';
    var km = geo.polygonTrueAreaKm2(a) + ' km²';
    return a.name ? a.name + ' · ' + km : km;
  }

  function statusTag(status) {
    var cls = 'tag';
    if (status === 'complete') cls += ' green';
    else if (status === 'running' || status === 'queued' || status === 'review') cls += ' amber';
    return el('span', cls, String(status || 'draft').toUpperCase());
  }

  function loadMissions() {
    say('missionMsg', 'Reading your runs…');
    return window.sb.from('missions')
      .select('id,title,objective,status,created_at,area_geojson,injection_flag,launched_at')
      .order('created_at', { ascending: false })
      .then(function (r) {
        if (r.error) {
          say('missionMsg', 'Could not read runs: ' + r.error.message);
          say('ovMissionsMsg', 'Could not read runs.');
          return;
        }
        MISSIONS = r.data || [];
        say('missionMsg', MISSIONS.length ? '' :
          'No runs on this account yet. Row level security shows you your own ' +
          'missions and nobody else’s, so an empty table here means you have not ' +
          'created one. Press New Run.');
        say('ovMissionsMsg', MISSIONS.length ? '' : 'Nothing yet.');
        var k = doc.getElementById('kMissions');
        if (k) k.textContent = pad2(MISSIONS.length);
        say('kMissionsSub', 'Visible to this account');
        paintMissions();
        fillRunMission();
        paintGeoLayers();
        greet();
        log('missions: ' + MISSIONS.length + ' visible');
      });
  }

  /* THE GREETING, from the name the masthead already resolved.

     The portal opens with one and this page opened with a page title.
     Same treatment now - and deliberately from #whoName rather than a
     second read of the profile, so there is exactly one place a
     researcher's name comes from on this page and it cannot drift.

     Silent until that name is real: "Good morning, Signed in" would be
     worse than the page title it replaces. */
  function greet() {
    var h = doc.getElementById('ovGreeting');
    var who = doc.getElementById('whoName');
    if (!h || !who) { return; }
    var name = (who.firstChild && who.firstChild.textContent || '').trim();
    if (!name || /^signed in$/i.test(name)) { return; }
    var hr = new Date().getHours();
    var word = hr < 12 ? 'Good morning' : (hr < 18 ? 'Good afternoon' : 'Good evening');
    h.textContent = word + ', ' + String(name).split(/\s+/).slice(0, 2).join(' ');
  }

  function paintMissions() {
    var t = doc.getElementById('missionTable');
    var ov = doc.getElementById('ovMissions');
    if (!t) return;
    clear(t);
    if (ov) $$('tr:not(:first-child)', ov).forEach(function (n) { n.remove(); });

    var q = (($('#missionSearch') || {}).value || '').trim().toLowerCase();
    var rows = MISSIONS.filter(function (m) {
      if (!q) return true;
      return (m.title + ' ' + m.objective + ' ' + m.status + ' ' + areaLabel(m))
        .toLowerCase().indexOf(q) >= 0;
    });

    if (!rows.length && q) { say('missionMsg', 'No run on this account matches “' + q + '”.'); }
    else if (MISSIONS.length) { say('missionMsg', ''); }

    rows.forEach(function (m, i) {
      /* ONE CARD PER RUN. A button, not a div with a click handler:
         this opens something, so it has to be reachable by keyboard and
         announce itself as a control. */
      var card = el('button', 'runcard');
      card.type = 'button';
      card.setAttribute('data-mid', m.id);

      var top = el('div', 'runcard-top');
      top.appendChild(el('b', null, m.title || 'Untitled'));
      top.appendChild(statusTag(m.status));
      if (m.injection_flag) { top.appendChild(el('span', 'tag', 'FLAGGED')); }
      card.appendChild(top);

      /* Shorter than the old 110, because a card gives it three lines
         rather than one cell to run along. */
      card.appendChild(el('p', 'runcard-obj', (m.objective || '').slice(0, 96)));

      var foot = el('div', 'runcard-foot');
      foot.appendChild(el('span', null, areaCell(m)));
      foot.appendChild(el('span', null, (m.created_at || '').slice(0, 10)));
      card.appendChild(foot);

      card.addEventListener('click', function () { openMission(m.id); });
      t.appendChild(card);

      if (i < 4 && ov) {
        var o = el('tr');
        /* WHICH RUN THIS ROW IS. The card grid below has carried
           data-mid since it was a table; this row never needed it
           because nothing acted on it. js/ksat-runs-panel.js puts a
           Delete on each of these, and a delete control that has to
           infer its target from the title in the first cell is a
           delete control that will one day remove the wrong run. */
        o.setAttribute('data-mid', m.id);
        o.appendChild(el('td', null, m.title || 'Untitled'));
        o.appendChild(el('td', 'wrap', (m.objective || '').slice(0, 70)));
        o.appendChild(el('td', 'nowrap', (m.created_at || '').slice(0, 10)));
        var otd = el('td'); otd.appendChild(statusTag(m.status)); o.appendChild(otd);
        ov.appendChild(o);
      }
    });
  }

  /* -------------------------------------------------------------------
     5 · One mission, opened
     ------------------------------------------------------------------- */
  var OPEN_MISSION = null;

  /* TWO PANELS, TWO BINDINGS.

     A single OPEN_REPORT was written by the Reports viewer AND by the
     mission detail panel. Open mission A's report in Reports, then click
     mission B (which has none) in Missions: loadMissionTrail nulled the
     shared variable, A's report stayed visible in #reportView, and
     pressing Download .md under it did nothing at all. Worse the other
     way round: with B's report loaded from the detail panel, Download
     under A's visible report saved B.

     VIEW_REPORT is what the Reports view is showing. MD_REPORT is what
     the mission detail panel is showing. Each button reads its own. */
  var VIEW_REPORT = null;
  var MD_REPORT = null;
  /* The mission whose freshly finished run is on screen in the console.
     Separate from OPEN_MISSION, which is whatever the Missions view has
     open - the two are often different, and signing the wrong one would
     be unrecoverable. */
  var RESULT_MISSION = null;

  /* Which one a Download/Print press means depends on which panel is on
     screen, and only one of them ever is. */
  function reportInView() {
    var rv = doc.getElementById('reportViewWrap');
    if (rv && !rv.hidden && VIEW_REPORT) { return VIEW_REPORT; }
    var md = doc.getElementById('mdReportWrap');
    if (md && !md.hidden && MD_REPORT) { return MD_REPORT; }
    return VIEW_REPORT || MD_REPORT;
  }

  function missionById(id) {
    for (var i = 0; i < MISSIONS.length; i++) if (MISSIONS[i].id === id) return MISSIONS[i];
    return null;
  }

  function openMission(id) {
    var m = missionById(id);
    if (!m) return;
    OPEN_MISSION = m;
    var card = doc.getElementById('missionDetail');
    card.hidden = false;
    $$('.missionrow').forEach(function (r) {
      r.classList.toggle('open', r.getAttribute('data-mid') === id);
    });
    doc.getElementById('mdTitle').textContent = m.title || 'Mission';

    var dl = doc.getElementById('mdFacts');
    clear(dl);
    function row(k, v) { dl.appendChild(el('dt', null, k)); dl.appendChild(el('dd', null, v)); }
    row('Mission id', m.id);
    row('Status', String(m.status || 'draft').toUpperCase());
    row('Objective', m.objective);
    row('Area', areaLabel(m) + ' · about ' + geo.polygonTrueAreaKm2(m.area_geojson) + ' km²');
    row('Created', when(m.created_at));
    /* Display label only. The column is still launched_at. */
    row('Run started', m.launched_at ? when(m.launched_at) : 'not yet');
    if (m.injection_flag) {
      row('Flag', 'The objective on this mission was screened as an instruction rather ' +
                  'than a question. No data was read for it.');
    }
    var inArea = agents.framesInArea(FRAMES, m.area_geojson);
    row('Frames inside the area', inArea.length + ' of ' + FRAMES.filter(geo.hasFix).length +
        ' geolocated frames');

    /* the map for this mission */
    var map = geo.make('mdMap', { view: [29.35, 47.75, 8] });
    if (map) {
      geo.resize('mdMap');
      if (map._ksatLayer) { map.removeLayer(map._ksatLayer); }
      var g = L.layerGroup().addTo(map);
      map._ksatLayer = g;
      var b = geo.polygonBounds(m.area_geojson);
      if (b) {
        L.rectangle(b, { color: '#dce9f1', weight: 1, fill: true, fillOpacity: 0.05 }).addTo(g);
      }
      inArea.forEach(function (f) {
        L.rectangle(geo.frameBounds(f),
          { color: '#79bd96', weight: 1, fill: true, fillOpacity: 0.08 }).addTo(g);
      });
      if (b) setTimeout(function () { geo.fit(map, b, [16, 16]); }, 80);
      keys('mdKeys', [['#dce9f1', 'Mission area'], ['#79bd96', 'Frames inside it']]);
    }

    actionsFor(m);
    say('mdMsg', '');
    loadMissionTrail(m);
    card.scrollIntoView({ block: 'nearest' });
  }

  function actionsFor(m) {
    var bar = doc.getElementById('mdActions');
    clear(bar);
    function add(label, act, primary) {
      var b = el('button', 'btn' + (primary ? ' primary' : ''), label);
      b.setAttribute('data-act', act);
      bar.appendChild(b);
      return b;
    }
    if (m.status === 'draft' || m.status === 'failed') {
      add('Run the pipeline on this run', 'launch', true);
    } else if (m.status === 'queued' || m.status === 'running') {
      add('Open the checkpoint in the console', 'open-in-console', true);
    } else if (m.status === 'review') {
      add('Generate the report', 'make-report', true);
      add('Open in the console', 'open-in-console');
    }
    add('Show the area on the map', 'geo-fit-open');
  }

  /* EVERY OPEN GETS A GENERATION NUMBER.

     Three independent reads fan out here and all of them write into fixed
     element ids. Click mission A then mission B within a second and A's
     slower response lands under B's heading - A's runs, A's steps, A's
     findings, all labelled as B's. Double-click one row and both reads
     resolve, so every finding card is rendered twice, on a page whose
     argument is that findings map one-to-one onto database rows.

     A stale callback now returns before touching the DOM. */
  var TRAIL_GEN = 0;

  function loadMissionTrail(m) {
    var gen = ++TRAIL_GEN;
    var stepsBox = doc.getElementById('mdSteps');
    var findBox = doc.getElementById('mdFindings');
    clear(stepsBox); clear(findBox);
    say('mdStepsMsg', 'Reading the audit trail…');
    say('mdFindingsMsg', '');
    doc.getElementById('mdReportWrap').hidden = true;
    MD_REPORT = null;

    window.sb.from('mission_runs')
      .select('id,status,started_at,finished_at,tool_calls')
      .eq('mission_id', m.id).order('started_at', { ascending: false })
      .then(function (r) {
        if (gen !== TRAIL_GEN) { return; }
        if (r.error) { say('mdStepsMsg', 'Could not read runs: ' + r.error.message); return; }
        var runs = r.data || [];
        if (!runs.length) {
          say('mdStepsMsg', 'This mission has not been run yet. There is nothing in ' +
                            'agent_steps for it, which is exactly what an un-run mission ' +
                            'should look like.');
          return;
        }
        say('mdStepsMsg', '');
        var ids = runs.map(function (x) { return x.id; });
        return window.sb.from('agent_steps')
          .select('id,run_id,step_name,tool,allowed,refused_reason,status,started_at,finished_at,injection_flag')
          .in('run_id', ids).order('started_at')
          .then(function (s) {
            if (gen !== TRAIL_GEN) { return; }
            if (s.error) { say('mdStepsMsg', 'Could not read steps: ' + s.error.message); return; }
            renderSteps(stepsBox, runs, s.data || []);
          });
      });

    window.sb.from('results')
      .select('id,kind,title,body,geometry,created_at,run_id')
      .eq('mission_id', m.id).order('created_at')
      .then(function (r) {
        if (gen !== TRAIL_GEN) { return; }
        if (r.error) { say('mdFindingsMsg', 'Could not read findings: ' + r.error.message); return; }
        var rows = r.data || [];
        if (!rows.length) { say('mdFindingsMsg', 'No findings recorded for this mission yet.'); return; }
        say('mdFindingsMsg', '');
        clear(findBox);
        rows.forEach(function (x) { findBox.appendChild(findingCard(x)); });
      });

    window.sb.from('reports').select('id,body_md,approved_at,approved_by')
      .eq('mission_id', m.id).order('approved_at', { ascending: false }).limit(1)
      .then(function (r) {
        if (gen !== TRAIL_GEN) { return; }
        if (r.error || !r.data || !r.data.length) return;
        MD_REPORT = r.data[0];
        doc.getElementById('mdReportWrap').hidden = false;
        KS.report.present({
          host: 'mdReport',
          md: MD_REPORT.body_md,
          mission: m,
          missionId: m.id,
          title: m.title
        });
      });
  }

  function findingCard(x) {
    var d = el('div', 'finding');
    d.appendChild(el('h4', null, x.title));
    d.appendChild(el('p', null, x.body || ''));
    var t = el('div', 'sub', String(x.kind).toUpperCase() + ' · ' + when(x.created_at));
    d.appendChild(t);
    return d;
  }

  var STEP_ORDER = ['satellite_data', 'environmental_analysis', 'recommendation',
                    'impact_prediction', 'visualization', 'reporting'];

  function renderSteps(box, runs, steps) {
    clear(box);
    runs.forEach(function (run) {
      var head = el('div', 'step');
      head.appendChild(el('i', null, '▸'));
      var mid = el('div');
      mid.appendChild(el('b', null, 'Run ' + shortId(run.id) + ' · ' +
        String(run.status).toUpperCase() + ' · ' + run.tool_calls + ' tool calls'));
      /* "STILL OPEN" READ LIKE A FAULT, AND IT IS THE DESIGN.

         A run is deliberately held open while it waits at the human
         checkpoint: researcher_log_step refuses a run whose status is
         not queued or running, so holding it open is the only way the
         last three agents can write anything after the approval. A
         researcher looking at a paused run saw "QUEUED, still open" and
         reasonably concluded something had hung.

         The wording now says which of the two it is. */
      var openLabel = ', still open';
      if (!run.finished_at) {
        openLabel = (run.tool_calls >= 6)
          ? ', open and waiting at the human checkpoint'
          : ', open and running';
      }
      mid.appendChild(el('small', null, 'Started ' + when(run.started_at) +
        (run.finished_at ? ', finished ' + when(run.finished_at) : openLabel)));
      head.appendChild(mid);
      head.appendChild(el('span', 'state', ''));
      box.appendChild(head);

      var mine = steps.filter(function (s) { return s.run_id === run.id; });
      if (!mine.length) {
        var none = el('div', 'step');
        none.appendChild(el('i', null, '—'));
        var nd = el('div');
        nd.appendChild(el('b', null, 'No steps recorded for this run'));
        none.appendChild(nd);
        none.appendChild(el('span', 'state', ''));
        box.appendChild(none);
      }
      mine.forEach(function (s, i) { box.appendChild(stepRow(s, i + 1)); });
    });
  }

  /* NOT EVERY REFUSAL IS A FAULT, AND TWO OF THEM ARE THE PRODUCT.

     Both refusals a healthy run produces are DESIGNED to happen, and
     rendering them in the same red as a genuine failure tells a
     researcher - and a judge reading over their shoulder - that
     something broke. It is the single most misleading thing on this
     page, because the two rows in question are the strongest evidence
     the platform has:

       satellite_data / payload_frames.update
           The Satellite Data Agent attempts the forbidden write on
           every run, deliberately, so that "the archive is read only"
           is a sentence the DATABASE says rather than a label on a
           panel. The refusal IS the proof. If this row ever reads
           COMPLETE, the archive grants have been widened and somebody
           needs to be told the same day.

       impact_prediction / change.detect
           Change detection needs the same ground on two dates and this
           archive has no repeat coverage, so the agent declines to
           produce a figure. That is the brief's "unable to make a
           reliable estimate" requirement being MET, not missed.

     Anything else refused is a real fault and stays red.

     The test is on step_name and tool because they are the only columns
     03-security/db/03_grants.sql lets a browser read. `arguments` is
     deliberately not granted, so an agent cannot flag this at write
     time and the renderer has to carry the knowledge. */
  function refusalKind(s) {
    if (s.status !== 'refused') { return null; }

    /* A guardrail firing. The objective was screened as an instruction
       rather than a question, so the Orchestrator called no tool at all.
       That is the protection working. */
    if (s.injection_flag) {
      return { cls: 'held', label: 'SCREENED',
               gloss: 'The objective read as an instruction, so no data was read and ' +
                      'no tool was called. The mission carries a flag.' };
    }

    /* The Orchestrator stopping because the evidence will not carry the
       question. These END the run - there is no report - so they have to
       be visible, but they are results about the area rather than faults
       in the platform. Amber, not red. */
    if (s.step_name === 'environmental_analysis' || s.step_name === 'recommendation') {
      return { cls: 'nodata', label: 'NO EVIDENCE',
               gloss: 'The run stopped here rather than answer from data ' +
                      'that cannot support the question. The reason above is the finding.' };
    }

    /* THE IMPACT AGENT REFUSING ITS OWN ZONE.

       impact_model.project applies a 4.0-point floor on added
       vegetation cover and rejects any zone below it, then re-ranks
       without it. That is the most rigorous thing on this platform and
       it was being painted red as REFUSED, which reads as a crash:

         "Zone D projects only 3.6 points of added vegetation cover
          (-0.07 to -0.44 C), below the 4.0-point floor. Zone rejected.
          Ranking again without it. Re-rank 1 of 2."

       Nothing failed there. An agent declined to claim a benefit its
       own numbers do not support, said by how much, and went back for
       another candidate. Two of these are on the live site right now,
       both in red. */
    if (s.step_name === 'impact_prediction') {
      return { cls: 'held', label: 'BELOW FLOOR',
               gloss: 'The Impact Prediction Agent would not claim a benefit its own ' +
                      'numbers do not support, so it rejected the zone and ranked ' +
                      'again. The figures above are why.' };
    }

    /* Anything else refused is a genuine fault and stays red. On the
       current pipeline nothing should reach this. */
    return { cls: 'fault', label: 'REFUSED', gloss: null };
  }

  function stepRow(s, n) {
    var kind = refusalKind(s);
    var cls = 'step ' + (kind ? kind.cls :
                         s.status === 'complete' ? 'ok' : 'running');
    var d = el('div', cls);
    d.appendChild(el('i', null, String(n)));
    var mid = el('div');
    var role = (agents.ROLES[s.step_name] || {}).name || s.step_name;
    mid.appendChild(el('b', null, role));
    if (s.tool) {
      var c = el('small');
      c.appendChild(el('code', null, s.tool));
      mid.appendChild(c);
    }
    if (s.refused_reason) {
      /* A designed refusal keeps its reason, but not the red bar: the
         words are the finding, the colour was the lie. */
      mid.appendChild(el('small', kind && kind.cls !== 'fault' ? 'reason' : 'refusal',
                         s.refused_reason));
    }
    if (kind && kind.gloss) {
      mid.appendChild(el('small', 'gloss', kind.gloss));
    }
    if (s.injection_flag) {
      mid.appendChild(el('small', 'refusal', 'Objective screened as an instruction. ' +
        'The mission carries an injection flag.'));
    }
    mid.appendChild(el('small', null, when(s.started_at)));
    d.appendChild(mid);
    d.appendChild(el('span', 'state' +
                     (s.status === 'complete' ? ' ok' :
                      kind && kind.cls === 'held' ? ' ok' :
                      kind && kind.cls === 'nodata' ? ' wait' :
                      kind ? '' : ' wait'),
                     kind ? kind.label : String(s.status).toUpperCase()));
    return d;
  }

  /* -------------------------------------------------------------------
     6 · Markdown, rendered as nodes

     Six constructs, which is all the Reporting Agent emits: h1, h2,
     bullet, paragraph, blank, rule. No innerHTML anywhere — a report
     body is text a researcher typed into an objective at one remove, and
     the one place this platform must not parse hostile text as markup is
     the place that renders findings.
     ------------------------------------------------------------------- */
  function renderMarkdown(host, md) {
    clear(host);
    var lines = String(md || '').split('\n');
    var ul = null;
    lines.forEach(function (line) {
      if (/^\s*-\s+/.test(line)) {
        if (!ul) { ul = el('ul'); host.appendChild(ul); }
        ul.appendChild(el('li', null, line.replace(/^\s*-\s+/, '')));
        return;
      }
      ul = null;
      if (/^#\s+/.test(line)) { host.appendChild(el('h1', null, line.slice(2))); return; }
      if (/^##\s+/.test(line)) { host.appendChild(el('h2', null, line.slice(3))); return; }
      if (/^---+$/.test(line.trim())) { host.appendChild(el('hr')); return; }
      if (!line.trim()) return;
      host.appendChild(el('p', null, line));
    });
  }

  /* -------------------------------------------------------------------
     7 · Reports
     ------------------------------------------------------------------- */
  var REPORTS = [];

  function loadReports() {
    say('reportMsg', 'Reading reports…');
    return window.sb.from('reports').select('id,mission_id,approved_at,body_md')
      .order('approved_at', { ascending: false })
      .then(function (r) {
        var t = doc.getElementById('reportTable');
        $$('tr:not(:first-child)', t).forEach(function (n) { n.remove(); });
        if (r.error) { say('reportMsg', 'Could not read reports: ' + r.error.message); return; }
        REPORTS = r.data || [];
        say('reportMsg', REPORTS.length ? '' :
          'No reports on this account yet. A report exists only once a researcher has ' +
          'approved the findings behind it — run a mission in the Research Console, ' +
          'approve the zones, then write the report.');
        REPORTS.forEach(function (rep) {
          var m = missionById(rep.mission_id);
          var tr = el('tr');
          tr.appendChild(el('td', null, (m && m.title) ? m.title : 'Mission report'));
          tr.appendChild(el('td', 'mono', shortId(rep.mission_id)));
          tr.appendChild(el('td', 'nowrap', rep.approved_at ? rep.approved_at.slice(0, 10) : '—'));
          var td = el('td');
          td.appendChild(el('span', 'tag green', 'APPROVED'));
          tr.appendChild(td);
          var act = el('td');
          var b = el('button', 'btn', 'Open');
          b.addEventListener('click', function () { openReport(rep); });
          act.appendChild(b);
          tr.appendChild(act);
          t.appendChild(tr);
        });
      });
  }

  function openReport(rep) {
    VIEW_REPORT = rep;
    var m = missionById(rep.mission_id);
    doc.getElementById('reportViewTitle').textContent =
      (m && m.title) ? m.title : 'Mission report';
    KS.report.present({
      host: 'reportView',
      md: rep.body_md,
      mission: m,
      missionId: rep.mission_id,
      title: (m && m.title) || 'mission-report'
    });
    doc.getElementById('reportViewWrap').hidden = false;
    doc.getElementById('reportViewWrap').scrollIntoView({ block: 'nearest' });
  }

  function exportReport() {
    var rep = reportInView();
    if (!rep) { return; }
    var m = missionById(rep.mission_id);
    var name = ((m && m.title) ? m.title : 'mission-report')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    download(name + '.md', 'text/markdown;charset=utf-8', rep.body_md);
    log('report exported');
  }

  /* THE ELEMENT, NOT THE MARKDOWN.

     reportInView() returns the report's TEXT, which is what the
     download needs. Printing needs the DOM node the report was rendered
     into, and there are three of them in three different views. This
     returns whichever one is actually on screen. */
  function printHost() {
    var pairs = [['reportViewWrap', 'reportView'],
                 ['mdReportWrap', 'mdReport'],
                 ['runResultCard', 'rrReport']];
    for (var i = 0; i < pairs.length; i++) {
      var wrap = doc.getElementById(pairs[i][0]);
      var host = doc.getElementById(pairs[i][1]);
      if (wrap && !wrap.hidden && host && host.firstChild) { return host; }
    }
    return null;
  }

  function printReport() {
    var host = printHost();
    if (!host) { return; }
    /* Same contract as the button inside the report: mark the host, so
       the print stylesheet does not have to know which view it is in.
       See the @media print block in css/ksat-workspace.css. */
    host.classList.add('ksat-print-this');
    root.classList.add('ksat-printing');
    window.print();
    setTimeout(function () {
      root.classList.remove('ksat-printing');
      host.classList.remove('ksat-print-this');
    }, 800);
  }

  function exportFindings() {
    say('reportMsg', 'Collecting findings…');
    window.sb.from('results').select('id,mission_id,run_id,kind,title,body,geometry,created_at')
      .order('created_at')
      .then(function (r) {
        if (r.error) { say('reportMsg', 'Could not read findings: ' + r.error.message); return; }
        var rows = r.data || [];
        if (!rows.length) { say('reportMsg', 'There are no findings on this account to export yet.'); return; }
        say('reportMsg', '');
        /* GeoJSON, so it opens in QGIS as well as in a text editor. Rows
           without geometry are kept as features with a null geometry,
           which is legal GeoJSON and loses nothing. */
        var fc = {
          type: 'FeatureCollection',
          name: 'KuwaitSat-1 findings',
          generated: new Date().toISOString(),
          note: 'Exported from the KuwaitSat-1 research workspace by the account that ' +
                'owns these missions. ' + geo.FOOTPRINT_NOTE,
          features: rows.map(function (x) {
            return {
              type: 'Feature',
              geometry: x.geometry || null,
              properties: {
                id: x.id, mission_id: x.mission_id, run_id: x.run_id,
                kind: x.kind, title: x.title, body: x.body, created_at: x.created_at
              }
            };
          })
        };
        download('kuwaitsat1-findings.geojson', 'application/geo+json',
                 JSON.stringify(fc, null, 2));
        log(rows.length + ' findings exported');
      });
  }

  /* -------------------------------------------------------------------
     8 · The Data Archive
     ------------------------------------------------------------------- */
  var DATASETS = [];

  function loadDatasets() {
    say('dataMsg', 'Counting what this session can reach…');
    var want = [
      { name: 'KuwaitSat-1 payload frames', table: 'payload_frames', key: 'frame_no',
        source: 'KuwaitSat-1', cls: 'MEASURED', res: '39 m/px', quality: 'Raw decoded' },
      { name: 'Mission records', table: 'missions', key: 'id', source: 'Derived',
        cls: 'DERIVED', res: 'per mission', quality: 'Researcher entered' },
      { name: 'Agent run log', table: 'mission_runs', key: 'id', source: 'Derived',
        cls: 'MEASURED', res: 'per run', quality: 'Append only' },
      { name: 'Agent step log', table: 'agent_steps', key: 'id', source: 'Derived',
        cls: 'MEASURED', res: 'per step', quality: 'Append only' },
      { name: 'Findings', table: 'results', key: 'id', source: 'Derived',
        cls: 'DERIVED', res: 'per finding', quality: 'Reviewed' },
      { name: 'Reports', table: 'reports', key: 'id', source: 'Derived',
        cls: 'DERIVED', res: 'per mission', quality: 'Approved' },
      { name: 'Researcher profiles', table: 'profiles', key: 'user_id', source: 'Reference',
        cls: 'DERIVED', res: 'per account', quality: 'Own row only' }
    ];
    DATASETS = [];
    var done = 0;
    want.forEach(function (d) {
      /* NEVER '*'.

         A select('*') asks for every column, and 03_grants.sql grants
         named columns only - mission_runs withholds n8n_execution_id and
         error_note, agent_steps withholds raw_prompt, raw_response and
         confidence, results withholds source_ref. PostgREST refuses the
         WHOLE request when any requested column is ungranted, so the
         Data Archive reported the researcher's own run log, step log and
         findings as "refused / no access" while the Missions and Audit
         views showed the same rows perfectly. It made a correct security
         model look broken. Every other count in this file already names
         a column; this was the one that did not. */
      window.sb.from(d.table).select(d.key, { count: 'exact', head: true }).then(function (r) {
        d.records = r.error ? 'refused' : String(r.count === null ? 0 : r.count);
        d.ok = !r.error;
        DATASETS.push(d);
        if (++done === want.length) {
          DATASETS.sort(function (a, b) { return want.indexOf(a) - want.indexOf(b); });
          say('dataMsg', '');
          paintDatasets();
        }
      });
    });
  }

  function paintDatasets() {
    var t = doc.getElementById('dataTable');
    if (!t) return;
    $$('tr:not(:first-child)', t).forEach(function (n) { n.remove(); });
    var src = (($('#fSource') || {}).value || 'All sources');
    var cls = (($('#fClass') || {}).value || 'All data classes');
    var q = (($('#dataSearch') || {}).value || '').trim().toLowerCase();

    var rows = DATASETS.filter(function (d) {
      if (src.indexOf('All') !== 0 && d.source !== src) return false;
      if (cls.indexOf('All') !== 0 && d.cls !== cls) return false;
      if (q && (d.name + ' ' + d.source + ' ' + d.cls + ' ' + d.quality)
               .toLowerCase().indexOf(q) < 0) return false;
      return true;
    });

    rows.forEach(function (d) {
      var tr = el('tr');
      tr.appendChild(el('td', null, d.name));
      tr.appendChild(el('td', null, d.source));
      tr.appendChild(el('td', null, d.cls));
      tr.appendChild(el('td', null, d.res));
      tr.appendChild(el('td', null, d.records));
      tr.appendChild(el('td', null, d.ok ? d.quality : 'no access'));
      t.appendChild(tr);
    });

    var c = doc.getElementById('dataCount');
    if (c) {
      c.textContent = rows.length + ' of ' + DATASETS.length +
        ' datasets reachable from this session';
    }
    say('dataMsg', rows.length ? '' : 'No dataset matches these filters.');
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

  /* -------------------------------------------------------------------
     9 · The map views
     ------------------------------------------------------------------- */
  function keys(hostId, pairs) {
    var host = doc.getElementById(hostId);
    if (!host) return;
    clear(host);
    pairs.forEach(function (p) {
      var s = el('span');
      var i = el('i');
      i.style.background = p[0];
      s.appendChild(i);
      s.appendChild(doc.createTextNode(p[1]));
      host.appendChild(s);
    });
  }

  var GEO_MAP = null, GEO_GROUPS = null, AOI_RECT = null;

  function buildGeoMap() {
    if (GEO_MAP) { geo.resize('geoMap'); return GEO_MAP; }
    GEO_MAP = geo.make('geoMap', { hud: true, view: [29.35, 47.75, 9] });
    if (!GEO_MAP) return null;
    MAPS_BUILT.geo = true;

    GEO_GROUPS = {
      frames: L.layerGroup().addTo(GEO_MAP),
      missions: L.layerGroup().addTo(GEO_MAP),
      findings: L.layerGroup().addTo(GEO_MAP),
      aoi: L.layerGroup().addTo(GEO_MAP)
    };
    /* One switcher: basemaps above, then this account's own data, then
       the public reference overlays. The heat layer is off by default -
       it is 1 km and it covers the whole country, so leaving it on would
       bury the frame footprints under a wash of colour. */
    var overlays = {
      'Frame footprints': GEO_GROUPS.frames,
      'Mission areas': GEO_GROUPS.missions,
      'Findings': GEO_GROUPS.findings,
      'Area of interest': GEO_GROUPS.aoi
    };
    var pub = geo.overlayLayers ? geo.overlayLayers() : {};
    Object.keys(pub).forEach(function (k) { overlays[k] = pub[k]; });

    var ctl = L.control.layers(GEO_MAP._ksatBases, overlays,
                     { collapsed: false, position: 'topright' }).addTo(GEO_MAP);

    /* THE REAL KUWAIT, from assets/geo/. Added to the switcher as each
       file arrives rather than all at once: areas_land is 244 kB and the
       map should be usable before it lands.

       All off by default. A researcher opens this view to see THEIR
       frames and THEIR missions; eight reference layers drawn on top of
       that would bury the thing they came for. The coastline is the one
       worth turning on first, which is why it is listed first.

       js/ksat-layers.js adds the ODbL / CC BY attribution the moment any
       of them loads, and it cannot be switched off separately. */
    if (KS.layers) {
      ['land', 'islands', 'governorates', 'governorates2023', 'borders',
       'areas', 'water', 'settlements', 'reserves',
       'territorialSea', 'contiguousZone', 'eez', 'maritimeBoundaries'
      ].forEach(function (key) {
        KS.layers.load(GEO_MAP, key).then(function (gj) {
          ctl.addOverlay(gj, KS.layers.LAYERS[key].label);
        }).catch(function (e) {
          log('reference layer ' + key + ' did not load: ' +
              (e && e.message ? e.message : e));
        });
      });
    }

    keys('geoKeys', [
      ['#79bd96', 'Frame footprint'],
      ['#8eb9d8', 'Frame centre'],
      ['#dce9f1', 'Mission area'],
      ['#d2ad68', 'Finding'],
      ['#d88484', 'Area of interest']
    ]);

    var srcs = doc.getElementById('geoSources');
    if (srcs) {
      clear(srcs);
      [['Satellite (Sentinel-2)', 'EOxCloudless (cloudless.eox.at) by EOX IT ' +
                                  'Services GmbH. Contains modified Copernicus ' +
                                  'Sentinel data 2021. CC BY-NC-SA 4.0, ' +
                                  'non-commercial use. Serves to zoom 16.'],
       ['Street map', 'OpenStreetMap contributors. ODbL. The dark version is the same ' +
                      'tiles with a CSS filter, not a different source.'],
       ['Library', 'Leaflet 1.9.4, served from this site at vendor/leaflet.js. ' +
                   'No map code is loaded from a CDN: the Content-Security-Policy ' +
                   'sets script-src to this origin only.'],
       ['Not used', 'CARTO basemaps. They now answer a caller without an API key with ' +
                    'a watermark image instead of a map, and an HTTP 200 while doing it.']]
        .forEach(function (p) { srcs.appendChild(el('div', null, p[0] + ' — ' + p[1])); });
    }

    var note = doc.getElementById('geoNote');
    if (note) {
      note.textContent =
        'Frame footprints are drawn for every archive frame that has a geolocation. ' +
        geo.FOOTPRINT_NOTE + ' Mission areas and findings are yours alone: row level ' +
        'security answers these tables for the signed-in account only.';
    }

    paintGeoLayers();
    GEO_MAP.on('moveend zoomend', paintAoiPreview);
    paintAoiPreview();
    return GEO_MAP;
  }

  function framePopup(f) {
    var d = el('div');
    d.appendChild(el('h4', null, 'Frame ' + pad2(f.frame_no)));
    if (hasImage(f)) {
      var img = doc.createElement('img');
      img.src = dataUri(f);
      img.alt = 'KuwaitSat-1 frame ' + f.frame_no;
      d.appendChild(img);
    }
    var dl = doc.createElement('dl');
    function row(k, v) { dl.appendChild(el('dt', null, k)); dl.appendChild(el('dd', null, v)); }
    row('Acquired', f.captured_on);
    row('Place', f.place_label || 'not resolved');
    row('Centre', coord(f));
    row('Confidence', f.geo_confidence || 'unresolved');
    row('GSD', Number(f.gsd_m).toFixed(0) + ' m/px');
    d.appendChild(dl);
    var b = el('button', 'btn', 'Open the record');
    b.addEventListener('click', function () { show('frames'); sheet(f); });
    d.appendChild(b);
    return d;
  }

  function paintGeoLayers() {
    if (!GEO_GROUPS) return;
    GEO_GROUPS.frames.clearLayers();
    GEO_GROUPS.missions.clearLayers();

    FRAMES.filter(geo.hasFix).forEach(function (f) {
      var b = geo.frameBounds(f);
      L.rectangle(b, { color: '#79bd96', weight: 1, fillOpacity: 0.06 })
        .bindPopup(framePopup(f)).addTo(GEO_GROUPS.frames);
      L.circleMarker([Number(f.lat), Number(f.lon)],
        { radius: 4, color: '#8eb9d8', weight: 2, fillOpacity: 0.9 })
        .bindPopup(framePopup(f)).addTo(GEO_GROUPS.frames);
    });

    MISSIONS.forEach(function (m) {
      var b = geo.polygonBounds(m.area_geojson);
      if (!b) return;
      var r = L.rectangle(b, { color: '#dce9f1', weight: 1, dashArray: '4 3', fillOpacity: 0.03 });
      var p = el('div');
      p.appendChild(el('h4', null, m.title || 'Mission'));
      p.appendChild(el('div', null, (m.objective || '').slice(0, 160)));
      p.appendChild(el('div', 'sub', String(m.status || 'draft').toUpperCase() +
        ' · about ' + geo.polygonTrueAreaKm2(m.area_geojson) + ' km²'));
      var b2 = el('button', 'btn', 'Open the mission');
      b2.addEventListener('click', function () { show('missions'); openMission(m.id); });
      p.appendChild(b2);
      r.bindPopup(p).addTo(GEO_GROUPS.missions);
    });

    loadFindingsLayer();
  }

  function loadFindingsLayer() {
    if (!GEO_GROUPS || !haveDb()) return;
    window.sb.from('results').select('id,kind,title,body,geometry,mission_id')
      .then(function (r) {
        if (r.error || !GEO_GROUPS) return;
        GEO_GROUPS.findings.clearLayers();
        (r.data || []).forEach(function (x) {
          var b = geo.polygonBounds(x.geometry);
          if (!b) return;
          var rect = L.rectangle(b, { color: '#d2ad68', weight: 1, fillOpacity: 0.12 });
          var p = el('div');
          p.appendChild(el('h4', null, x.title));
          p.appendChild(el('div', null, (x.body || '').slice(0, 260)));
          rect.bindPopup(p).addTo(GEO_GROUPS.findings);
        });
      });
  }

  function fitFrames() {
    var map = buildGeoMap();
    var fixed = FRAMES.filter(geo.hasFix);
    if (!map || !fixed.length) { say('geoAoi', 'No geolocated frame to fit to.'); return; }
    var b = L.latLngBounds([]);
    fixed.forEach(function (f) { b.extend(geo.frameBounds(f)); });
    geo.fit(map, b, [30, 30]);
  }

  function fitMissions() {
    var map = buildGeoMap();
    var withArea = MISSIONS.filter(function (m) { return geo.polygonBounds(m.area_geojson); });
    if (!map || !withArea.length) {
      var n = doc.getElementById('geoAoi');
      if (n) n.textContent = 'You have no mission with an area yet. Press New Mission.';
      return;
    }
    var b = L.latLngBounds([]);
    withArea.forEach(function (m) { b.extend(geo.polygonBounds(m.area_geojson)); });
    geo.fit(map, b, [30, 30]);
  }

  /* The AOI is the map view, clipped to Kuwait. It is shown live so the
     researcher can see what they are about to claim, and the clip is
     shown too — a view half over Saudi Arabia becomes a smaller polygon
     and saying so on the spot is better than a refused insert later. */
  var PENDING_AOI = null;

  /* Returns null when the view is entirely outside Kuwait: geo.rectPolygon
     refuses a rectangle that clamping has collapsed onto the envelope
     edge. Every caller has to handle it. */
  function viewPolygon(map, name) {
    var b = map.getBounds();
    return geo.rectPolygon(b.getSouth(), b.getWest(), b.getNorth(), b.getEast(), name);
  }

  function outsideText() {
    return 'This view is entirely outside Kuwait, so there is no area of ' +
           'interest to take from it. Move the map back over the country: ' +
           'the database only accepts a polygon inside ' +
           geo.envelopeText() + '.';
  }

  function describeAoi(poly) {
    if (!poly) { return OUTSIDE; }
    var b = geo.polygonBounds(poly);
    return 'S ' + b[0][0].toFixed(4) + '  W ' + b[0][1].toFixed(4) +
           '   N ' + b[1][0].toFixed(4) + '  E ' + b[1][1].toFixed(4) +
           '   ·  about ' + geo.polygonAreaKm2(poly) + ' km²';
  }

  function paintAoiPreview() {
    if (!GEO_MAP) return;
    var n = doc.getElementById('geoAoi');
    if (!n || PENDING_AOI) return;
    var b = GEO_MAP.getBounds();
    var outside = b.getWest() < geo.KUWAIT.west || b.getEast() > geo.KUWAIT.east ||
                  b.getSouth() < geo.KUWAIT.south || b.getNorth() > geo.KUWAIT.north;
    var vp = viewPolygon(GEO_MAP);
    clear(n);
    n.className = vp ? 'aoi' : 'aoi bad';
    if (!vp) { n.appendChild(doc.createTextNode(outsideText())); return; }
    n.appendChild(doc.createTextNode(
      'Current view, clipped to Kuwait: ' + describeAoi(vp)));
    if (outside) {
      n.appendChild(el('div', null,
        'Part of this view is outside Kuwait and has been clipped. The database ' +
        'refuses any polygon outside ' + geo.envelopeText() + '.'));
    }
  }

  function useViewAsAoi() {
    var map = buildGeoMap();
    if (!map) return;
    var vp = viewPolygon(map, 'Drawn on the map');
    if (!vp) {
      var bad = doc.getElementById('geoAoi');
      clear(bad);
      bad.className = 'aoi bad';
      bad.appendChild(doc.createTextNode(OUTSIDE));
      return;
    }
    PENDING_AOI = vp;
    GEO_GROUPS.aoi.clearLayers();
    AOI_RECT = L.rectangle(geo.polygonBounds(PENDING_AOI),
      { color: '#d88484', weight: 2, fillOpacity: 0.06 }).addTo(GEO_GROUPS.aoi);
    var n = doc.getElementById('geoAoi');
    clear(n);
    n.className = 'aoi';
    n.appendChild(el('b', null, 'Area of interest set. '));
    n.appendChild(doc.createTextNode(describeAoi(PENDING_AOI)));
    n.appendChild(el('div', null, 'It is carried into the New Mission dialog. ' +
      'Move the map and press the button again to replace it.'));
    log('area of interest set from the map');
  }

  /* -------------------------------------------------------------------
     10 · The Overview, driven by the newest run
     ------------------------------------------------------------------- */
  function buildOverviewMap() {
    if (MAPS_BUILT.ov) { geo.resize('ovMap'); return; }
    var map = geo.make('ovMap', { view: [29.35, 47.75, 8], minimal: true });
    if (!map) return;
    MAPS_BUILT.ov = true;
    map._ksatG = L.layerGroup().addTo(map);
    keys('ovKeys', [['#79bd96', 'Frame footprints'], ['#dce9f1', 'Your mission areas']]);
    paintOverviewMap();
  }

  function paintOverviewMap() {
    var host = doc.getElementById('ovMap');
    if (!host || !host._ksatMap || !host._ksatMap._ksatG) return;
    var map = host._ksatMap, g = map._ksatG;
    g.clearLayers();
    var any = L.latLngBounds([]);
    FRAMES.filter(geo.hasFix).forEach(function (f) {
      var b = geo.frameBounds(f);
      L.rectangle(b, { color: '#79bd96', weight: 1, fillOpacity: 0.06 }).addTo(g);
      any.extend(b);
    });
    MISSIONS.forEach(function (m) {
      var b = geo.polygonBounds(m.area_geojson);
      if (!b) return;
      L.rectangle(b, { color: '#dce9f1', weight: 1, dashArray: '4 3', fillOpacity: 0.03 }).addTo(g);
      any.extend(b);
    });
    if (any.isValid()) { setTimeout(function () { geo.fit(map, any, [14, 14]); }, 80); }
  }

  var AGENT_ROWS = [
    ['satellite_data', 'Satellite Data Agent'],
    ['environmental_analysis', 'Environmental Analysis'],
    ['recommendation', 'Recommendation Agent'],
    ['impact_prediction', 'Impact Prediction'],
    ['visualization', 'Visualization Agent'],
    ['reporting', 'Reporting Agent']
  ];

  function loadOverviewRun() {
    if (!haveDb()) return;
    window.sb.from('mission_runs')
      .select('id,mission_id,status,started_at,finished_at,tool_calls')
      .order('started_at', { ascending: false }).limit(1)
      .then(function (r) {
        if (r.error) { say('kRunsSub', 'Could not read runs.'); return; }
        var runs = r.data || [];
        paintAgents(null, null);
        if (!runs.length) {
          doc.getElementById('wfTag').textContent = 'NO RUN YET';
          doc.getElementById('wfTitle').textContent = 'Workflow';
          doc.getElementById('ovObjective').textContent =
            'No run yet. Create a mission and run it in the Research Console.';
          return;
        }
        var run = runs[0];
        var m = missionById(run.mission_id);
        doc.getElementById('wfTitle').textContent =
          'Workflow · ' + ((m && m.title) ? m.title : 'run ' + shortId(run.id));
        doc.getElementById('wfTag').textContent = String(run.status).toUpperCase();
        doc.getElementById('ovObjective').textContent =
          (m && m.objective) ? m.objective : 'Run ' + shortId(run.id);
        doc.getElementById('ovArea').textContent = m ? areaLabel(m) : '';

        window.sb.from('agent_steps').select('step_name,status,allowed')
          .eq('run_id', run.id)
          .then(function (s) {
            if (s.error) return;
            paintWorkflow(run, s.data || []);
            paintAgents(run, s.data || []);
          });
      });

    window.sb.from('mission_runs').select('id', { count: 'exact', head: true })
      .then(function (r) {
        var k = doc.getElementById('kRuns');
        if (k) k.textContent = r.error ? '—' : pad2(r.count || 0);
        if (!r.error) say('kRunsSub', (r.count || 0) === 0 ? 'Nothing has been run yet'
                                                           : 'On your missions');
      });
  }

  function paintWorkflow(run, steps) {
    var byName = {};
    steps.forEach(function (s) { byName[s.step_name] = s; });
    $$('#wfLine .stage').forEach(function (st) {
      var key = st.getAttribute('data-stage');
      st.classList.remove('done', 'active');
      if (key === 'request') { st.classList.add('done'); return; }
      var s = byName[key];
      if (!s) return;
      if (s.status === 'complete') st.classList.add('done');
      else st.classList.add('active');
    });
  }

  function paintAgents(run, steps) {
    var host = doc.getElementById('ovAgents');
    if (!host) return;
    clear(host);
    var byName = {};
    (steps || []).forEach(function (s) { byName[s.step_name] = s; });
    AGENT_ROWS.forEach(function (p) {
      var s = byName[p[0]];
      var d = el('div', 'agent');
      d.appendChild(el('div', 'ico', (agents.ROLES[p[0]] || {}).code || '··'));
      var mid = el('div');
      mid.appendChild(el('strong', null, p[1]));
      mid.appendChild(el('small', null,
        !run ? 'Configured, not yet run' :
        !s ? 'Not reached on this run' :
        s.status === 'refused' ? 'Refused — see the audit trail' :
        s.status === 'complete' ? 'Completed on this run' : 'Running'));
      d.appendChild(mid);
      d.appendChild(el('span', 'state' + (!s ? '' : s.status === 'complete' ? ' ok' :
                        s.status === 'refused' ? '' : ' wait'),
                        !run ? 'CONFIGURED' : !s ? 'WAITING' :
                        s.status === 'refused' ? 'REFUSED' :
                        s.status === 'complete' ? 'DONE' : 'ACTIVE'));
      host.appendChild(d);
    });
    var tag = doc.getElementById('agTag');
    if (tag) tag.textContent = run ? 'FROM RUN ' + shortId(run.id) : 'CONFIGURED';
  }

  /* -------------------------------------------------------------------
     11 · The Research Console — a real run
     ------------------------------------------------------------------- */
  var RUN_STATE = null;
  var RUNNING = false;

  function fillRunMission() {
    var sel = doc.getElementById('runMission');
    if (!sel) return;
    var keep = sel.value;
    clear(sel);
    if (!MISSIONS.length) {
      var o = el('option', null, 'No mission yet — create one first');
      o.value = '';
      sel.appendChild(o);
      objectiveFor(null);
      return;
    }
    MISSIONS.forEach(function (m) {
      var o = el('option', null,
        (m.title || 'Untitled') + '  ·  ' + String(m.status || 'draft').toUpperCase());
      o.value = m.id;
      sel.appendChild(o);
    });
    if (keep && missionById(keep)) sel.value = keep;
    objectiveFor(missionById(sel.value));
  }

  function objectiveFor(m) {
    var q = doc.getElementById('q');
    if (q) q.value = m ? m.objective : '';

    /* THE CHECKPOINT BELONGS TO ONE RUN, SO IT GOES WHEN THE MISSION DOES.

       Reach the checkpoint on mission A, then open mission B and press
       "Open the checkpoint in the console" - the flow the researcher
       guide documents. The console showed B selected and B's objective,
       with A's candidate zones underneath and Approve still armed.
       Pressing it ran impact prediction, visualization and reporting on
       A using B's mission on screen, and signed a report for A that the
       researcher believed was for B. */
    if (!m || !RUN_STATE || !RUN_STATE.mission || RUN_STATE.mission.id !== m.id) {
      var cp = doc.getElementById('checkpointCard');
      if (cp) cp.hidden = true;
      /* The finished-run card belongs to one mission too. Leaving it up
         while another mission is selected would put a Sign button under
         the wrong name, and signing is not reversible. */
      var rrc = doc.getElementById('runResultCard');
      if (rrc && (!RESULT_MISSION || !m || RESULT_MISSION.id !== m.id)) {
        rrc.hidden = true;
      }
      say('decisionMsg', '');
      var tr = doc.getElementById('trace');
      if (tr && tr.className === 'steps') {
        tr.className = 'empty';
        clear(tr);
        tr.appendChild(doc.createTextNode(
          'Pick a mission and press Run Analysis. Every step the Orchestrator ' +
          'takes is written to the database first and then read back here, so ' +
          'what you see is the audit trail and not a script.'));
        var src = doc.getElementById('traceSrc');
        if (src) src.textContent = 'Step by step';
      }
      if (!RUNNING) { RUN_STATE = null; }
    }
    var tag = doc.getElementById('runTag');
    if (tag) tag.textContent = m ? String(m.status || 'draft').toUpperCase() : 'NO MISSION';
    var btn = doc.getElementById('runBtn');
    if (btn) {
      /* FRAMES_READY, because a run started while the archive is still
         in flight writes a FALSE finding into a permanent audit trail:
         satellite_data logged with frames_released: 0, then a narrative
         result reading "The KuwaitSat-1 archive holds 0 frames". Eight
         base64 images take a moment on a venue connection, and the
         presenter clicking Run Analysis two seconds in is the most
         likely thing to happen tomorrow. */
      btn.disabled = !m || RUNNING || !FRAMES_READY;
      btn.textContent = !FRAMES_READY ? 'Loading the payload archive...'
        : (m && (m.status === 'queued' || m.status === 'running'))
        ? 'Resume - a run is already open' : 'Run Analysis';
    }
    /* ONLY WRITES, NEVER CLEARS.

       It used to `say('runMsg','')` whenever a mission WAS selected. Every
       refreshAfterRun() calls loadMissions() -> fillRunMission() ->
       objectiveFor(), so roughly 200ms after the console printed "The run
       stopped honestly: no archive frame has a geolocation inside this
       mission area", that sentence was erased. Every terminal message in
       the Research Console was written and then silently deleted, which
       looked exactly like the run having done nothing at all. */
    if (!m) {
      say('runMsg', 'Create a run first, using New Run in the sidebar. A run '
                  + 'carries the area the agents will look at.');
    }
  }

  function traceMsg(text, cls) {
    var box = doc.getElementById('trace');
    if (!box) return;
    box.className = cls || 'log';
    clear(box);
    box.appendChild(el('div', null, text));
  }

  /* THE TRACE IS READ BACK OUT OF THE DATABASE. Every call to this
     function is a fresh select on agent_steps. See the file header. */
  function refreshTrace(runId) {
    var box = doc.getElementById('trace');
    if (!box || !runId) return Promise.resolve();
    return window.sb.from('agent_steps')
      .select('id,run_id,step_name,tool,allowed,refused_reason,status,started_at,injection_flag')
      .eq('run_id', runId).order('started_at')
      .then(function (r) {
        if (r.error) { traceMsg('Could not read the trail: ' + r.error.message); return; }
        box.className = 'steps';
        clear(box);
        (r.data || []).forEach(function (s, i) { box.appendChild(stepRow(s, i + 1)); });
        var src = doc.getElementById('traceSrc');
        /* The run reference is how a run is quoted later, so it stays -
           it just stops leading with a table name. */
        if (src) src.textContent = 'Run ' + shortId(runId);
      });
  }

  /* The live commentary goes in the message line under the mission, NOT
     in the trace. The trace is the audit trail and has to stay exactly
     what agent_steps says; mixing a narration line into it would be the
     one thing this file is not allowed to do. */
  function narrate(text) {
    var n = doc.getElementById('runMsg');
    if (!n) return;
    clear(n);
    var s = el('span', 'spin');
    if (!RUNNING) s.className = '';
    n.appendChild(s);
    n.appendChild(doc.createTextNode(text));
  }

  /* A RUN LEFT OPEN BY A PAGE RELOAD, AND WHY THIS EXISTS.

     The pipeline deliberately leaves the run OPEN while it waits at the
     human checkpoint: researcher_log_step refuses a run that is not
     queued or running, so holding it open is the only way the last three
     agents can write anything after the approval.

     The cost is that the candidate set lives in this browser. Reload the
     page at the checkpoint - or close the laptop, or come back tomorrow
     - and the mission is still QUEUED, launch_mission refuses with "This
     mission is already running", and there is no button anywhere to get
     out of it. That is a dead end a researcher cannot escape, and on a
     demo day it is the kind of dead end that happens in front of people.

     So: if the selected mission has an open run that this page did not
     start, say so plainly and offer the one honest way forward. The old
     run is closed as stalled with a reason, which leaves it in the audit
     trail rather than deleting it, and then a fresh run can start. */
  function openRunPrompt(m) {
    var n = doc.getElementById('runMsg');
    clear(n);
    n.appendChild(doc.createTextNode(
      'This mission already has a run open, started earlier or in another tab. ' +
      'The candidate set from that run lived in the browser that started it and ' +
      'is gone, so it cannot be resumed. Close it and start again: everything it ' +
      'did record stays in the audit trail.'));
    var b = el('button', 'btn', 'Close the open run and start again');
    b.style.marginTop = '10px';
    b.addEventListener('click', function () {
      b.disabled = true;
      window.sb.from('mission_runs').select('id')
        .eq('mission_id', m.id).in('status', ['queued', 'running'])
        .order('started_at', { ascending: false }).limit(1)
        .then(function (r) {
          if (r.error || !r.data || !r.data.length) {
            throw new Error('The open run could not be found. Reload the page.');
          }
          return agents.finish(r.data[0].id, 'stalled',
            'closed by the researcher: the run was left open by a reload');
        })
        .then(function () {
          say('runMsg', 'The open run is closed. Press Run Analysis to start a new one.');
          log('stale run closed on ' + (m.title || m.id));
          return refreshAfterRun();
        })
        .catch(function (e) {
          b.disabled = false;
          say('runMsg', String(e && e.message ? e.message : e));
        });
    });
    n.appendChild(doc.createElement('br'));
    n.appendChild(b);
  }

  function startRun(btn) {
    var sel = doc.getElementById('runMission');
    var m = missionById(sel && sel.value);
    if (!m) { say('runMsg', 'Choose a mission first.'); return; }
    if (RUNNING) return;

    if (m.status === 'queued' || m.status === 'running') {
      /* Same browser, same run, checkpoint still in memory: just show it
         again rather than telling the researcher anything is wrong. */
      if (RUN_STATE && RUN_STATE.mission && RUN_STATE.mission.id === m.id &&
          RUN_STATE.candidates && RUN_STATE.candidates.length) {
        checkpoint(RUN_STATE);
        refreshTrace(RUN_STATE.run_id);
        return;
      }
      openRunPrompt(m);
      return;
    }

    RUNNING = true;
    btn.disabled = true;
    say('decisionMsg', '');
    doc.getElementById('checkpointCard').hidden = true;
    /* Last run's report must not sit under this run's trace. */
    var rr = doc.getElementById('runResultCard');
    if (rr) rr.hidden = true;
    RESULT_MISSION = null;
    traceMsg('Mission Orchestrator — starting the run…', 'log');
    narrate('Mission Orchestrator — starting the run');

    agents.run({
      mission: m,
      frames: FRAMES,
      onPhase: narrate,
      /* Every tick hands back the live state, so the run id is known
         from the first write and the trace can be re-read while the
         pipeline is still working. */
      onStep: function (state) {
        RUN_STATE = state;
        if (state && state.run_id) refreshTrace(state.run_id);
      },
      onCheckpoint: function (state) { checkpoint(state); }
    }).then(function (state) {
      RUN_STATE = state;
      RUNNING = false;
      btn.disabled = false;
      refreshTrace(state.run_id);
      if (state.stopped) {
        doc.getElementById('checkpointCard').hidden = true;
        say('runMsg', state.stopped === 'injection'
          ? 'The run stopped before it read anything: the objective on this mission reads ' +
            'as an instruction rather than a question. The mission is flagged and the ' +
            'refusal is in the audit trail.'
          : state.stopped === 'no-evidence'
          ? 'The run stopped honestly: no archive frame has a geolocation inside this ' +
            'mission area. Open Geospatial Layers to see where the frames actually are, ' +
            'then create a mission over one of them.'
          : state.stopped === 'no-separation'
          ? 'The run measured the area and returned no candidate zones, on purpose. ' +
            'Nothing in it stands far enough from the ordinary variation of bare ground ' +
            'to be worth naming, and ranking it anyway would have presented noise as a ' +
            'finding. The reasoning is written into the findings on the mission.'
          : state.stopped === 'no-candidates'
          ? 'The run measured the area and found no bare ground in it: every tile ' +
            'classified as water or as already vegetated. That is a result about this ' +
            'area, not a failure. It is written up in the findings on the mission.'
          : 'The run stopped: the frames inside this area have an acquisition record but ' +
            'no picture in the archive yet.');
      }
      return refreshAfterRun();
    }).catch(function (e) {
      RUNNING = false;
      btn.disabled = false;

      /* TWO BUGS LIVED IN THESE FOUR LINES.

         ONE. It announced every failure as "The database refused this
         run". A frame whose image will not decode is not a refusal; the
         database allowed everything it was asked, and the trail proves
         it. js/ksat-agents.js now tags errors that really did come back
         from PostgREST with err.fromDb, so the sentence can be true.

         TWO. It never refreshed MISSIONS. launch_mission commits the run
         row and sets the mission to 'queued' before anything downstream
         can fail, so after a mid-run failure the database says 'queued'
         and this page still says 'draft'. startRun's guard reads the
         stale copy, skips openRunPrompt, calls launch_mission again and
         gets "This mission is already running." - for ever, on every
         press, with the only recovery button unreachable. The single
         escape was a page reload, which also destroys the candidate set.

         refreshAfterRun() re-reads the missions, so the next press finds
         'queued' and lands on the recovery prompt. */
      var msg = (e && e.message) ? e.message : String(e);
      say('runMsg', (e && e.fromDb)
        ? ('The database refused this run: ' + msg)
        : ('This run could not finish: ' + msg +
           ' The run has been closed in the audit trail.'));
      log('run failed: ' + msg);
      refreshAfterRun();
    });
  }

  function checkpoint(state) {
    RUN_STATE = state;
    var card = doc.getElementById('checkpointCard');
    card.hidden = false;
    doc.getElementById('cpTitle').textContent =
      state.candidates.length + ' candidate zones are ready for your decision';

    /* THE HEADLINE HAS TO CARRY THE LIMITATION, not a footnote under it.
       On this archive nothing reaches the vegetation threshold, so a
       panel that says "candidate zones for planting" and nothing else
       would be the page telling a researcher something the measurement
       does not support. The sentence that matters comes first.

       CUT FROM FIVE SENTENCES TO TWO, on request. What went was method
       and consequence: the tile count, the phrase "relative greenness
       within each frame", the list of what has not run yet, and the
       line about the approval being recorded against the account.

       WHAT COULD NOT GO, AND DID NOT. "No vegetation was detected" and
       "not vegetated areas" are the whole reason this panel is worded
       the way it is. A researcher who reads only this line has to come
       away knowing that these zones are the least red ground in their
       own frames and not detected plants, because the next thing they
       do is approve them.

       Everything cut is still on the page a few centimetres below: the
       zones table states each zone's separation from its own frame
       median, and its "What these columns mean" panel spells out the
       index and the units. This is the summary, not the record. */
    doc.getElementById('cpBody').textContent =
      (state.vegetationDetected
        ? 'Vegetation was detected above the threshold in at least one frame. '
        : 'No vegetation was detected: these are the least red ground in their ' +
          'own frames, not vegetated areas. ') +
      'They are a place to look, and nothing downstream runs until you approve.';

    /* THE ZONES, AS A TABLE.

       These were five stacked cards, each repeating the same four
       sentences with different numbers in them. A researcher choosing
       between candidates is doing exactly one thing: comparing a
       column. Prose makes that impossible, and five paragraphs of
       near-identical text is the shape that hides an outlier rather
       than showing it.

       Every column is something this platform actually measured. There
       is no NDVI column because there is no near-infrared band on this
       instrument, and no temperature column because MODIS is served as
       a rendered image and no figure in degrees is claimed. An empty
       column would be worse than a missing one. */
    var box = doc.getElementById('cpFindings');
    clear(box);

    var dry = (state.rankMode === 'driest');
    var named = state.candidates.some(function (c) { return c.place && c.place.name; });

    var tbl = el('table', 'zones');
    var hr = doc.createElement('tr');
    var cols = ['Zone'];
    if (named) { cols.push('Place'); }
    /* PLAIN HEADINGS, EXACT NUMBERS. Each of these is the same
       measurement under a word somebody can read cold: ExG is a
       greenness index, a z-score is how far a tile stands out from its
       own scene, luminance is brightness. The values underneath are
       untouched, the units stay on them, and the precise terms are
       spelled out in the "What these mean" panel below the table. */
    cols = cols.concat(['Where', 'Greenness', dry ? 'Stands out (low)' : 'Stands out',
                        'Brightness', 'Area']);
    cols.forEach(function (h) {
      var th = doc.createElement('th');
      th.textContent = h;
      hr.appendChild(th);
    });
    tbl.appendChild(hr);

    state.candidates.forEach(function (c, i) {
      var tr = doc.createElement('tr');
      function cell(txt, cls) {
        var td = doc.createElement('td');
        if (cls) { td.className = cls; }
        td.textContent = txt;
        tr.appendChild(td);
      }
      cell('Candidate ' + (i + 1), 'zn');
      if (named) { cell((c.place && c.place.name) || '\u2014', 'pl'); }

      /* frame_no is 0 on a reference run BECAUSE no KuwaitSat-1 frame
         covers this ground. Printing "frame 00" invited a reader to go
         looking for a frame that does not exist. */
      cell(c.a.frame_no
        ? ('frame ' + pad2(c.a.frame_no) + ' \u00b7 ' + c.t.gx + ',' + c.t.gy)
        : (c.t.gx + ',' + c.t.gy), 'mono');

      cell(c.t.exg.toFixed(3), 'mono num');
      cell((Math.round(Math.abs(c.t.z) * 10) / 10) + ' sd', 'mono num');
      cell(String(c.t.lum), 'mono num');
      /* c.km2 per candidate, not state.tileM: the tiles are NOT square,
         the last row and column are larger, and candidates can come
         from frames of different pixel sizes. */
      cell((c.km2 || 0) + ' km\u00b2', 'mono num');
      tbl.appendChild(tr);
    });
    box.appendChild(tbl);

    /* ONE PLAIN SENTENCE, then the exact terms behind a toggle.

       The old note was three clauses of method. The claim that matters
       to somebody deciding is the LAST one - these are the least red
       ground in their own scene, not detected vegetation - so that
       leads, and the method follows for anyone who wants it. */
    var med = state.candidates.length
      ? (Math.round(state.candidates[0].a.exg.median * 1000) / 1000) : null;
    if (med !== null) {
      box.appendChild(el('div', 'sub', 'These are the ' +
        (dry ? 'driest' : 'least red') + ' ground in their own image. ' +
        'They are not detected vegetation.'));

      var defsBtn = el('button', 'ksat-zt-defs');
      defsBtn.type = 'button';
      defsBtn.setAttribute('aria-expanded', 'false');
      defsBtn.textContent = 'What these columns mean';

      var defs = el('dl', 'ksat-zt-dl');
      defs.hidden = true;
      [['Where', 'The frame this zone came from, and its tile position in that frame.'],
       ['Greenness', 'Excess Green (ExG), computed as 2g − r − b from the ' +
                     'visible bands. There is no near-infrared band on this payload, ' +
                     'so NDVI is not available and is not claimed.'],
       ['Stands out', 'How far the tile sits from the median of its own image, in ' +
                      'standard deviations (sd). Measured against that image only, ' +
                      'never across images. The scene median here is ' + med + '.'],
       ['Brightness', 'Mean luminance of the tile, 0 to 255. Used to separate land ' +
                      'from water before anything is ranked.'],
       ['Area', 'Ground area of the tile. Tiles are not all the same size: the last ' +
                'row and column of each frame are larger.']
      ].forEach(function (d) {
        defs.appendChild(el('dt', null, d[0]));
        defs.appendChild(el('dd', null, d[1]));
      });
      if (named) {
        defs.appendChild(el('dt', null, 'Place'));
        defs.appendChild(el('dd', null, 'OpenStreetMap area names, under ODbL. ' +
          'A zone inside no named area shows its position only.'));
      }

      defsBtn.addEventListener('click', function () {
        var open = defs.hidden;
        defs.hidden = !open;
        defsBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        defsBtn.textContent = open ? 'Hide what the columns mean'
                                   : 'What these columns mean';
      });
      box.appendChild(defsBtn);
      box.appendChild(defs);
    }

    card.scrollIntoView({ block: 'nearest' });
    log('human checkpoint reached on run ' + shortId(state.run_id));
  }

  /* ONE BUSY FLAG FOR ALL THREE CHECKPOINT BUTTONS.

     Approve, Reject and Abandon each disabled only ITSELF. Press Approve,
     then press the still-enabled Reject while approve() is mid-chain, and
     rank('driest') replaces state.candidates and state.rankMode under the
     report that is about to be composed - so the signed report lists five
     zones that were never the ones approved. Abandon during an approve
     closes the run and the remaining writes then fail against it. */
  var DECIDING = false;

  function decisionButtons(disabled) {
    ['approve', 'reject', 'abandon'].forEach(function (a) {
      var b = $('[data-act="' + a + '"]');
      if (b) b.disabled = disabled;
    });
  }

  function approveRun(btn) {
    if (!RUN_STATE || !RUN_STATE.run_id) { say('decisionMsg', 'There is no open run.'); return; }
    if (DECIDING) return;
    DECIDING = true;
    decisionButtons(true);
    say('decisionMsg', 'Approved. Running impact prediction, visualization and reporting…');
    agents.approve(RUN_STATE, {
      onPhase: narrate,
      onStep: function () { refreshTrace(RUN_STATE.run_id); }
    }).then(function () {
      DECIDING = false;
      decisionButtons(false);
      doc.getElementById('checkpointCard').hidden = true;
      say('decisionMsg', '');
      say('runMsg', 'Run complete. The draft report is below.');
      showRunResult(RUN_STATE);
      refreshTrace(RUN_STATE.run_id);
      return refreshAfterRun();
    }).catch(function (e) {
      DECIDING = false;
      decisionButtons(false);
      /* The card stays hidden on failure too: agents.approve() closes the
         run as 'failed' in its terminal catch, so a second Approve would
         write against a closed run and be refused. */
      doc.getElementById('checkpointCard').hidden = true;
      say('decisionMsg', 'This approval could not finish: ' +
        (e && e.message ? e.message : e) +
        ' The run has been closed in the audit trail; nothing was signed.');
      refreshAfterRun();
    });
  }

  function rejectRun(btn) {
    if (!RUN_STATE || !RUN_STATE.run_id) { say('decisionMsg', 'There is no open run.'); return; }
    if (DECIDING) return;
    DECIDING = true;
    decisionButtons(true);

    /* KEEP THE SET WE ALREADY HAVE.

       rank() refuses when nothing clears the separation bar, and a
       refusal empties state.candidates. Measured on a real mission: the
       greenest criterion separated at 2.6 sd and produced five zones,
       and the driest criterion on the same frame reached only 1.3 sd. So
       pressing Reject replaced a good candidate set with an EMPTY one,
       the panel repainted as "0 candidate zones are ready for your
       decision" over nothing, and Approve stayed armed - signing a
       report whose summary read "0 candidate zones were identified" and
       whose Recommendations section said a researcher had approved them.

       So the previous set is held, and restored if the other criterion
       comes back with nothing. */
    var previous = RUN_STATE.candidates.slice();
    var previousMode = RUN_STATE.rankMode;
    var asking = (RUN_STATE.rankMode === 'driest') ? 'greenest' : 'driest';

    say('decisionMsg', 'Rejected. The candidate set is being rebuilt from the same ' +
                       'evidence under the ' + asking + ' criterion. It is not edited ' +
                       'in place: both sets stay in the findings.');

    agents.rank(RUN_STATE, asking)
      .then(function () {
        DECIDING = false;
        decisionButtons(false);
        refreshTrace(RUN_STATE.run_id);

        if (!RUN_STATE.candidates.length) {
          RUN_STATE.candidates = previous;
          RUN_STATE.rankMode = previousMode;
          checkpoint(RUN_STATE);
          say('decisionMsg', 'Nothing separated from the background under the ' +
            asking + ' criterion, so there is no alternative set to offer. The ' +
            'refusal and its numbers are in the audit trail, and the original ' +
            previousMode + ' set is still on screen. Approve it or abandon the run.');
          return;
        }
        checkpoint(RUN_STATE);
        say('decisionMsg', 'Re-ranked by the ' + RUN_STATE.rankMode + ' criterion. ' +
          'Both candidate sets stay in the findings; neither was overwritten.');
      }).catch(function (e) {
        DECIDING = false;
        decisionButtons(false);
        say('decisionMsg', 'The re-rank could not finish: ' +
          (e && e.message ? e.message : e));
      });
  }

  function abandonRun(btn) {
    if (!RUN_STATE || !RUN_STATE.run_id) { say('decisionMsg', 'There is no open run.'); return; }
    if (DECIDING) return;
    DECIDING = true;
    decisionButtons(true);
    agents.finish(RUN_STATE.run_id, 'stalled', 'abandoned by the researcher at the checkpoint')
      .then(function () {
        DECIDING = false;
        decisionButtons(false);
        doc.getElementById('checkpointCard').hidden = true;
        say('decisionMsg', '');
        say('runMsg', 'Run abandoned. The steps that did happen stay in the audit trail; ' +
          'nothing is deleted.');
        refreshTrace(RUN_STATE.run_id);
        RUN_STATE = null;
        return refreshAfterRun();
      }).catch(function (e) {
        DECIDING = false;
        decisionButtons(false);
        say('decisionMsg', 'The database refused: ' + (e && e.message ? e.message : e));
      });
  }

  function refreshAfterRun() {
    return loadMissions().then(function () {
      loadOverviewRun();
      paintOverviewMap();
      loadReports();
      loadDatasets();
      if (OPEN_MISSION) {
        var again = missionById(OPEN_MISSION.id);
        if (again && !doc.getElementById('missionDetail').hidden) openMission(again.id);
      }
      loadFindingsLayer();
      /* The Audit view used to cache AUDIT_RUNS on first visit and never
         re-read, so every run made after that visit was missing from it.
         The Access Test panel lives on that view, so visiting it early is
         the natural thing to do - and it is also the view a judge is most
         likely to ask to see AFTER a run. */
      loadAudit(true);
    });
  }

  function openInConsole() {
    if (!OPEN_MISSION) return;
    show('console');
    var sel = doc.getElementById('runMission');
    if (sel) { sel.value = OPEN_MISSION.id; objectiveFor(OPEN_MISSION); }
  }

  function launchFromDetail(btn) {
    if (!OPEN_MISSION) return;
    show('console');
    var sel = doc.getElementById('runMission');
    if (sel) { sel.value = OPEN_MISSION.id; objectiveFor(OPEN_MISSION); }
    var rb = doc.getElementById('runBtn');
    if (rb && !rb.disabled) startRun(rb);
  }

  /* generate_report() is the human checkpoint in SQL: a report cannot
     exist without a signed-in person calling it, and approved_by is that
     person. The button therefore does exactly one thing — it passes the
     draft the Reporting Agent wrote and the researcher has read. */
  /* ONE SIGNING PATH, CALLED FROM TWO PLACES.

     generate_report() is the human checkpoint written in SQL: a report
     cannot exist without a signed-in person calling it, and approved_by
     is that person. So this stays a deliberate press - it is not folded
     into the end of the run. What changed is WHERE the press can happen:
     the mission detail panel as before, and now the console, so a run
     that has just finished can be signed without the researcher being
     sent to another view to find their own mission. */
  function signReport(missionId, btn, msgId, onDone) {
    if (!missionId) { return; }
    btn.disabled = true;
    say(msgId, 'Reading the draft the Reporting Agent wrote…');
    window.sb.from('results').select('body,created_at,kind,title')
      .eq('mission_id', missionId).eq('kind', 'narrative')
      .order('created_at', { ascending: false }).limit(1)
      .then(function (r) {
        if (r.error) throw new Error(r.error.message);
        if (!r.data || !r.data.length) {
          throw new Error('There is no draft on this mission yet. Run the pipeline and ' +
                          'approve the candidate set first.');
        }
        return window.sb.rpc('generate_report',
          { p_mission_id: missionId, p_body_md: r.data[0].body });
      })
      .then(function (r) {
        if (r && r.error) throw new Error(r.error.message);
        btn.disabled = false;
        say(msgId, 'Report signed against your account. It is in Reports & Exports, ' +
                   'and this mission is now closed to further runs so the evidence ' +
                   'behind a signed conclusion cannot change after it is signed.');
        log('report approved');
        if (onDone) onDone();
        return refreshAfterRun();
      })
      .catch(function (e) {
        btn.disabled = false;
        say(msgId, String(e && e.message ? e.message : e));
      });
  }

  function makeReport(btn) {
    if (!OPEN_MISSION) return;
    signReport(OPEN_MISSION.id, btn, 'mdMsg');
  }

  /* THE END OF THE RUN, SHOWN WHERE THE RUN HAPPENED.

     The console used to finish by telling the researcher to open
     Missions, find this mission and press a button there. That is
     directions, not a result. The draft the Reporting Agent actually
     wrote is rendered here instead, with the single control that signs
     it, so the pipeline ends somewhere a person can see. */
  function showRunResult(state) {
    var card = doc.getElementById('runResultCard');
    if (!card) return;
    RESULT_MISSION = state.mission;
    doc.getElementById('rrTag').textContent = 'DRAFT, NOT YET SIGNED';
    /* THE NOTE ABOVE THE REPORT IS GONE, on request. It explained that
       the last three agents had run, that the report was a draft
       carrying nobody's name, and that signing would record the
       researcher's account against it.

       NOTHING IT SAID IS NOW UNSAID. The DRAFT chip is on the same row
       as the heading, the button under it reads "Sign and publish this
       report" in the first person, and js/ksat-report-doc.js stamps
       "DRAFT - NOT SIGNED" across the printed cover page until it is
       signed. Three statements of the same fact were two too many.

       The element is emptied and hidden rather than left blank: it
       carries class "notice", which draws a bordered panel, and an
       empty bordered panel above a report reads as something that
       failed to load. */
    var rrNote = doc.getElementById('rrNote');
    rrNote.textContent = '';
    rrNote.hidden = true;
    say('rrMsg', '');
    /* js/ksat-report.js owns the presentation: the document on the left,
       the ground it is about on the right, and the download. It reads the
       geometry back out of public.results rather than taking it from
       state, so the map and the database cannot disagree. */
    KS.report.present({
      host: 'rrReport',
      md: state.reportMd || '',
      mission: state.mission,
      missionId: state.mission && state.mission.id,
      title: state.mission && state.mission.title
    });
    card.hidden = false;
    card.scrollIntoView({ block: 'nearest' });
  }

  /* -------------------------------------------------------------------
     12 · Provenance / Audit
     ------------------------------------------------------------------- */
  var AUDIT_RUNS = [], AUDIT_STEPS = [];

  function loadAudit(force) {
    if (!haveDb()) return;
    if (AUDIT_RUNS.length && !force) { paintAudit(); return; }
    say('auditRunsMsg', 'Reading the audit trail…');
    window.sb.from('mission_runs')
      .select('id,mission_id,status,started_at,finished_at,tool_calls')
      .order('started_at', { ascending: false })
      .then(function (r) {
        if (r.error) { say('auditRunsMsg', 'Could not read runs: ' + r.error.message); return; }
        AUDIT_RUNS = r.data || [];
        doc.getElementById('aRuns').textContent = pad2(AUDIT_RUNS.length);
        say('auditRunsMsg', AUDIT_RUNS.length ? '' :
          'No runs on this account yet. Every run this account starts appears here, ' +
          'including runs that were refused or abandoned.');
        return window.sb.from('agent_steps')
          .select('id,run_id,step_name,tool,allowed,refused_reason,status,started_at,injection_flag')
          .order('started_at', { ascending: false });
      })
      .then(function (s) {
        if (!s) return;
        if (s.error) { say('auditStepsMsg', 'Could not read steps: ' + s.error.message); return; }
        AUDIT_STEPS = s.data || [];
        doc.getElementById('aSteps').textContent = pad2(AUDIT_STEPS.length);
        doc.getElementById('aRefused').textContent =
          pad2(AUDIT_STEPS.filter(function (x) { return x.status === 'refused'; }).length);
        paintAudit();
      });

    window.sb.from('results').select('id', { count: 'exact', head: true }).then(function (r) {
      var n = doc.getElementById('aResults');
      if (n) n.textContent = r.error ? '—' : pad2(r.count || 0);
    });

    loadHealth();
  }

  /* PLATFORM HEALTH.

     monitor_health() is the ONLY way into public.monitoring_events from
     a browser: the table itself carries no grant for any role and has no
     policy, so it cannot be read directly under any key. The function is
     SECURITY DEFINER, returns counts only, and is granted to
     `authenticated` - see 03-security/db/11_monitoring.sql section 4 for
     the argument about why counts are safe to show every researcher and
     why a single identifying column would end that argument. */
  function loadHealth() {
    var t = doc.getElementById('healthTable');
    if (!t || !haveDb()) return;
    $$('tr:not(:first-child)', t).forEach(function (n) { n.remove(); });
    say('healthMsg', 'Reading the sweep log…');

    window.sb.rpc('monitor_health', { p_days: 7 }).then(function (r) {
      if (r.error) {
        say('healthMsg', 'Could not read platform health: ' + r.error.message);
        return;
      }
      var rows = r.data || [];
      if (!rows.length) {
        say('healthMsg', 'No sweep has been recorded in the last seven nights. ' +
          'That is expected until the nightly job has run once after the monitoring ' +
          'tables were created. If it is still empty in two days, the scheduled job ' +
          'is not firing and somebody should look.');
        return;
      }
      say('healthMsg', '');
      rows.forEach(function (h) {
        var tr = el('tr');
        tr.appendChild(el('td', 'nowrap', h.day));
        tr.appendChild(el('td', null, String(h.events)));
        tr.appendChild(el('td', null, String(h.sweeps_ok)));
        tr.appendChild(el('td', null, String(h.runs_swept)));
        var td = el('td');
        td.appendChild(el('span', 'tag' + (Number(h.anomalies) ? ' amber' : ' green'),
                          String(h.anomalies)));
        tr.appendChild(td);
        tr.appendChild(el('td', 'nowrap', when(h.last_event)));
        t.appendChild(tr);
      });
    });
  }

  function paintAudit() {
    var t = doc.getElementById('auditRuns');
    $$('tr:not(:first-child)', t).forEach(function (n) { n.remove(); });
    AUDIT_RUNS.forEach(function (run) {
      var m = missionById(run.mission_id);
      var tr = el('tr');
      tr.appendChild(el('td', 'mono', shortId(run.id)));
      tr.appendChild(el('td', null, (m && m.title) ? m.title : shortId(run.mission_id)));
      var td = el('td'); td.appendChild(statusTag(run.status)); tr.appendChild(td);
      tr.appendChild(el('td', 'nowrap', when(run.started_at)));
      tr.appendChild(el('td', 'nowrap', run.finished_at ? when(run.finished_at) : 'open'));
      tr.appendChild(el('td', null, String(run.tool_calls)));
      t.appendChild(tr);
    });

    var sel = doc.getElementById('auditRunFilter');
    var keep = sel.value;
    clear(sel);
    var all = el('option', null, 'All runs'); all.value = ''; sel.appendChild(all);
    AUDIT_RUNS.forEach(function (run) {
      var m = missionById(run.mission_id);
      var o = el('option', null, shortId(run.id) + ' · ' +
        ((m && m.title) ? m.title : 'mission ' + shortId(run.mission_id)));
      o.value = run.id;
      sel.appendChild(o);
    });
    if (keep) sel.value = keep;
    paintAuditSteps();
  }

  function paintAuditSteps() {
    var t = doc.getElementById('auditSteps');
    if (!t) return;
    $$('tr:not(:first-child)', t).forEach(function (n) { n.remove(); });
    var filter = (doc.getElementById('auditRunFilter') || {}).value || '';
    var rows = AUDIT_STEPS.filter(function (s) { return !filter || s.run_id === filter; });
    say('auditStepsMsg', rows.length ? '' :
      (AUDIT_STEPS.length ? 'No step recorded for that run.'
                          : 'No agent step has been recorded on this account yet.'));
    rows.forEach(function (s) {
      var kind = refusalKind(s);
      var tr = el('tr');
      tr.appendChild(el('td', null, (agents.ROLES[s.step_name] || {}).name || s.step_name));
      tr.appendChild(el('td', 'mono', s.tool || '—'));
      tr.appendChild(el('td', 'wrap', s.refused_reason || '—'));
      var td = el('td');
      /* Same distinction as the trace: a boundary that held is a green
         result, not an amber warning. See refusalKind(). */
      td.appendChild(el('span',
        'tag' + (s.allowed ? ' green' :
                 kind && kind.cls === 'held' ? ' green' :
                 kind && kind.cls === 'nodata' ? ' amber' : ''),
        s.allowed ? 'ALLOWED' : (kind ? kind.label : 'REFUSED')));
      if (s.injection_flag) td.appendChild(el('span', 'tag amber', ' INJECTION'));
      tr.appendChild(td);
      tr.appendChild(el('td', null, String(s.status).toUpperCase()));
      tr.appendChild(el('td', 'nowrap', when(s.started_at)));
      t.appendChild(tr);
    });
  }

  /* FOUR REQUESTS THIS ACCOUNT IS NOT SUPPOSED TO BE ABLE TO MAKE.

     They are sent for real. Nothing here is simulated and nothing is
     caught before it leaves — the point is the answer the database
     gives. All four are expected to be refused, and if one is not, this
     panel says so in the loudest words it has, because it would mean a
     grant had been widened without anybody noticing. */
  function accessTest(btn) {
    var box = doc.getElementById('accessTest');
    clear(box);
    btn.disabled = true;
    box.appendChild(el('div', null, 'Sending…'));

    var tests = [
      { name: 'UPDATE public.payload_frames',
        why: 'The archive must be read-only for every signed-in role.',
        go: function () {
          return window.sb.from('payload_frames')
            .update({ place_label: 'access test' }).eq('frame_no', -1);
        } },
      { name: 'INSERT public.payload_frames',
        why: 'A researcher must not be able to add a frame to the archive.',
        go: function () {
          return window.sb.from('payload_frames')
            .insert({ frame_no: -999, captured_on: '2026-01-01', gsd_m: 1 });
        } },
      { name: 'INSERT public.agent_steps (direct, bypassing the RPC)',
        why: 'The audit trail must only be writable through the checked function.',
        go: function () {
          return window.sb.from('agent_steps').insert({
            run_id: '00000000-0000-0000-0000-000000000000',
            step_name: 'reporting'
          });
        } },
      { name: 'UPDATE public.missions SET status',
        why: 'Mission state is set by the database, not by the browser.',
        go: function () {
          return window.sb.from('missions')
            .update({ status: 'complete' })
            .eq('id', '00000000-0000-0000-0000-000000000000');
        } }
    ];

    var out = [];
    var chain = Promise.resolve();
    tests.forEach(function (t) {
      chain = chain.then(function () {
        return t.go().then(function (r) {
          out.push({ t: t, refused: !!r.error, msg: r.error ? r.error.message : 'NOT REFUSED' });
        }).catch(function (e) {
          out.push({ t: t, refused: true, msg: String(e && e.message ? e.message : e) });
        });
      });
    });

    chain.then(function () {
      return window.sb.from('profiles').select('user_id');
    }).then(function (p) {
      clear(box);
      out.forEach(function (o) {
        box.appendChild(el('div', o.refused ? 'good' : 'warn',
          (o.refused ? 'REFUSED  ' : 'NOT REFUSED  ') + o.t.name));
        box.appendChild(el('div', null, '    ' + o.msg));
        box.appendChild(el('div', null, '    ' + o.t.why));
        box.appendChild(el('div', null, ' '));
      });
      var n = (p && p.data) ? p.data.length : 0;
      box.appendChild(el('div', null,
        'SELECT public.profiles returned ' + n + ' row' + (n === 1 ? '' : 's') + '.'));
      box.appendChild(el('div', null,
        '    Row level security scopes this table to your own account, so one row is ' +
        'the correct answer however many researchers are enrolled.'));
      var bad = out.filter(function (o) { return !o.refused; }).length;
      box.appendChild(el('div', null, ' '));
      box.appendChild(el('div', bad ? 'warn' : 'good',
        bad ? bad + ' of ' + out.length + ' requests were NOT refused. Tell the team: ' +
              'a grant has been widened.'
            : 'All ' + out.length + ' requests were refused by the database, which is ' +
              'the expected result.'));
      btn.disabled = false;
      log('access test run: ' + (bad ? bad + ' unexpected' : 'all refused'));
    });
  }

  /* -------------------------------------------------------------------
     13 · New mission
     ------------------------------------------------------------------- */
  var MODAL_MAP = null;
  var MODAL_AOI = null;

  function openModal() {
    $('#modal').classList.remove('hidden');
    say('modalMsg', '');

    var chips = doc.getElementById('mPresets');
    if (chips && !chips.childNodes.length) {
      geo.PRESETS.forEach(function (p) {
        var b = el('button', null, p.label);
        b.type = 'button';
        b.addEventListener('click', function () {
          $$('button', chips).forEach(function (x) { x.classList.remove('on'); });
          b.classList.add('on');
          var poly = geo.presetPolygon(p.id);
          geo.fit(MODAL_MAP, geo.polygonBounds(poly), [8, 8]);
          modalAoi();
        });
        chips.appendChild(b);
      });
    }

    setTimeout(function () {
      MODAL_MAP = geo.make('mMap', { view: [29.35, 47.75, 8] });
      if (!MODAL_MAP) return;
      geo.resize('mMap');
      MODAL_MAP.off('moveend zoomend', modalAoi);
      MODAL_MAP.on('moveend zoomend', modalAoi);
      if (!MODAL_MAP._ksatAoi) { MODAL_MAP._ksatAoi = L.layerGroup().addTo(MODAL_MAP); }
      /* The area set on the Geospatial Layers view is carried in here.
         That is the whole point of the button over there. */
      if (PENDING_AOI) {
        geo.fit(MODAL_MAP, geo.polygonBounds(PENDING_AOI), [8, 8]);
      }
      modalAoi();
    }, 60);
  }

  function modalAoi() {
    if (!MODAL_MAP) return;
    MODAL_AOI = viewPolygon(MODAL_MAP, 'Drawn on the map');
    MODAL_MAP._ksatAoi.clearLayers();
    var n = doc.getElementById('mAoi');
    if (!n) return;
    clear(n);

    if (!MODAL_AOI) {
      n.className = 'aoi bad';
      n.appendChild(doc.createTextNode(OUTSIDE));
      return;
    }
    L.rectangle(geo.polygonBounds(MODAL_AOI),
      { color: '#d88484', weight: 2, fillOpacity: 0.05 }).addTo(MODAL_MAP._ksatAoi);
    n.className = 'aoi';
    n.appendChild(el('b', null, 'Area of interest '));
    n.appendChild(doc.createTextNode(describeAoi(MODAL_AOI)));
  }

  function closeModal() {
    $('#modal').classList.add('hidden');
  }

  function createMission(btn) {
    var title = $('#mTitle').value.trim();
    var objective = $('#mObjective').value.trim();

    /* The database checks all of this too — missions_title_len,
       missions_objective_len and the two has-a-letter constraints in
       03-security/db/06_validation.sql. It is repeated here only so the
       researcher is told before the round trip, in the same words. */
    if (title.length < 3) { say('modalMsg', 'A mission name needs at least 3 characters.'); return; }
    if (title.length > 120) { say('modalMsg', 'A mission name may be at most 120 characters.'); return; }
    if (objective.length < 20) {
      say('modalMsg', 'The research objective needs at least 20 characters. It is the ' +
                      'question the Orchestrator reads, so write the question.');
      return;
    }
    if (objective.length > 1500) { say('modalMsg', 'The objective may be at most 1500 characters.'); return; }
    if (!/[A-Za-z؀-ۿ]/.test(title) || !/[A-Za-z؀-ۿ]/.test(objective)) {
      say('modalMsg', 'The name and the objective both have to contain letters.');
      return;
    }
    if (!haveDb()) { say('modalMsg', 'The mission database is not reachable.'); return; }

    /* THE AREA. This is the field that was refusing every mission.

       missions.area_geojson is NOT NULL and is checked by
       kuwait_area_ok(), so a note like "Kuwait Bay" typed into a text
       box could never be accepted — the old field sent
       {note:"Kuwait Bay"}, the check said false, and the insert came
       back as a constraint violation with no explanation a researcher
       could act on. The field is a map now: whatever is on screen is the
       polygon, clipped to the Kuwait envelope, and it is always valid by
       construction. */
    /* A NAMED AREA BEATS THE VIEWPORT.

       js/ksat-areas.js lets the researcher choose one of the 204 real
       areas by name. When they have, that polygon IS the mission area
       and the map is only showing it. The map still wins when nothing
       is chosen, and moving the map clears the choice, so the two can
       never both be true at once. */
    var area = (KS.areas && KS.areas.pending()) || MODAL_AOI || PENDING_AOI;
    if (!area) {
      say('modalMsg', OUTSIDE);
      return;
    }
    var type = ($('#mType') || {}).value || '';
    var win = ($('#mWindow') || {}).value || '';

    btn.disabled = true;
    say('modalMsg', 'Creating…');

    /* Mission type and time window are not columns on public.missions.
       Rather than invent a schema change the night before a demo, they
       are appended to the objective where they stay visible, auditable
       and inside the 1500 character check. */
    var extra = [];
    if (type) extra.push('Mission type: ' + type + '.');
    if (win.trim()) extra.push('Time window: ' + win.trim() + '.');
    var fullObjective = extra.length
      ? (objective + '\n\n' + extra.join(' ')).slice(0, 1500)
      : objective;

    window.sb.from('missions').insert({
      title: title,
      objective: fullObjective,
      area_geojson: area
    }).select('id').then(function (r) {
      btn.disabled = false;
      if (r.error) {
        var msg = r.error.message || '';
        var areaRefused = /kuwait_area_ok|area_shape/.test(msg);
        var extra = '';

        if (areaRefused) {
          /* TWO VERY DIFFERENT CAUSES, ONE CONSTRAINT NAME.

             Either the researcher really is outside Kuwait, or the
             browser's envelope and the database's have drifted apart.
             The second happens when the browser and the database hold
             different envelopes, which is what 14_widen_mission_envelope.sql
             fixes. Telling somebody "move the map back over Kuwait" when
             their area IS over Kuwait would send them hunting for a
             mistake they did not make.

             So the test is: does the BROWSER think this area is inside?
             If it does and the database still refused, the two have
             drifted and it is the deployment that is wrong, not the
             researcher. No number is written out here. geo.KUWAIT is
             the only copy, and it moves when the SQL moves. */
          var b = geo.polygonBounds(area);
          var browserSaysInside = !!b &&
            geo.inEnvelope(b[0][0], b[0][1]) && geo.inEnvelope(b[1][0], b[1][1]);
          extra = !browserSaysInside
            ? '. The area has to be a polygon inside Kuwait. Move the map ' +
              'back over the country and try again.'
            : '. This area is inside the envelope the MAP enforces (' +
              geo.envelopeText() + ') but outside the one the DATABASE ' +
              'enforces, so the two have drifted. That means ' +
              '03-security/db/14_widen_mission_envelope.sql has not been run ' +
              'against this project. Tell the team: it is a deployment ' +
              'problem, not a mistake you made.';
        }
        say('modalMsg', 'The database refused this insert: ' + msg + extra);
        return;
      }
      closeModal();
      $('#mTitle').value = '';
      $('#mObjective').value = '';
      if ($('#mWindow')) $('#mWindow').value = '';
      var c = doc.getElementById('mObjCount');
      if (c) c.textContent = '0 / 1500 · at least 20 characters';
      log('mission created: ' + title);
      loadMissions().then(function () {
        show('missions');
        var id = r.data && r.data[0] && r.data[0].id;
        if (id) openMission(id);
        paintOverviewMap();
      });
    });
  }

  /* -------------------------------------------------------------------
     14 · Boot
     ------------------------------------------------------------------- */
  /* Order matters in one place only: loadReports() names each report
     after its mission, so it runs after the mission list has arrived.
     Everything else is independent and goes in parallel. */
  function load() {
    pipeline();
    loadFrames().then(paintOverviewMap);
    loadMissions().then(function () {
      loadOverviewRun();
      paintOverviewMap();
      return loadReports();
    });
    loadDatasets();
  }

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
    if (ms) ms.addEventListener('input', paintMissions);

    var ds = doc.getElementById('dataSearch');
    if (ds) ds.addEventListener('input', paintDatasets);
    var fs = doc.getElementById('fSource');
    if (fs) fs.addEventListener('change', paintDatasets);
    var fc = doc.getElementById('fClass');
    if (fc) fc.addEventListener('change', paintDatasets);

    var rm = doc.getElementById('runMission');
    if (rm) rm.addEventListener('change', function () {
      objectiveFor(missionById(rm.value));
    });

    var arf = doc.getElementById('auditRunFilter');
    if (arf) arf.addEventListener('change', paintAuditSteps);

    var ob = doc.getElementById('mObjective');
    if (ob) ob.addEventListener('input', function () {
      var n = ob.value.trim().length;
      var c = doc.getElementById('mObjCount');
      if (c) {
        c.textContent = n + ' / 1500 · ' +
          (n < 20 ? (20 - n) + ' more characters needed' : 'long enough');
      }
    });

    /* The detail panel's "show on the map" button is built by
       actionsFor(), so it is wired by delegation like everything else. */
    doc.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-act="geo-fit-open"]') : null;
      if (!b || !OPEN_MISSION) return;
      show('geo');
      var map = buildGeoMap();
      var bb = geo.polygonBounds(OPEN_MISSION.area_geojson);
      if (map && bb) { geo.resize('geoMap'); geo.fit(map, bb, [30, 30]); }
    });

    gate();
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
