/* =====================================================================
   ksat-portal.js - THE STAFF PORTAL
   Owner: 01 Front end

   Drives portal.html. Reads the same database as the workspace, under
   the same sign-in, through the same RLS.

   >>> WHAT IS LIVE AND WHAT IS NOT, DECIDED BEFORE ANY OF IT WAS
       WRITTEN, BY ASKING THE DATABASE <<<
   Every read below was run against the live project as the signed-in
   researcher first. These succeed:

     my_missions          view, whole-table select
     my_agent_steps       view, whole-table select
     my_mission_results   view, whole-table select
     profiles             select AND update, own row
     reports              named columns
     mission_runs         named columns
     payload_frames       named columns
     monitor_health(7)    rpc

   And these tables do NOT exist, so nothing on this page pretends they
   do: notifications, messages, news, events, rsvps, a directory, a
   service catalogue, a document library, a read/unread store.

   >>> THE FOUR TAGS ARE A CONTRACT <<<
   LIVE means a read happened and this is what came back. If the read
   fails the panel says the read failed; it does not fall back to a
   plausible number. DERIVED means computed here from rows already
   readable. RECORD means written into this file and checkable. NOT
   BUILT means inert on purpose.

   >>> NAMED COLUMNS, NEVER select('*') ON A TABLE <<<
   03-security/db/03_grants.sql grants columns, not tables, and
   PostgREST refuses the whole request if one column is ungranted. The
   three my_* VIEWS are the exception: they carry a table-level select
   and are the intended read path.
   ===================================================================== */

(function () {
  'use strict';

  var doc = document;
  var KS = window.KSAT = window.KSAT || {};
  var ME = null, PROFILE = null;

  function $(s) { return doc.querySelector(s); }
  function $$(s) { return Array.prototype.slice.call(doc.querySelectorAll(s)); }

  function el(tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) { n.className = cls; }
    if (text != null) { n.textContent = text; }
    return n;
  }

  function clear(n) { while (n && n.firstChild) { n.removeChild(n.firstChild); } }

  function say(id, t) {
    var n = doc.getElementById(id);
    if (n) { clear(n); n.appendChild(doc.createTextNode(t || '')); }
  }

  function when(ts) {
    return ts ? String(ts).replace('T', ' ').slice(0, 16) : '—';
  }

  function ago(ts) {
    if (!ts) { return '—'; }
    var ms = Date.now() - new Date(ts).getTime();
    var m = Math.round(ms / 60000);
    if (m < 1) { return 'just now'; }
    if (m < 60) { return m + ' minute' + (m === 1 ? '' : 's') + ' ago'; }
    var h = Math.round(m / 60);
    if (h < 24) { return h + ' hour' + (h === 1 ? '' : 's') + ' ago'; }
    var d = Math.round(h / 24);
    return d + ' day' + (d === 1 ? '' : 's') + ' ago';
  }

  /* ------------------------------------------------------------------
     NAVIGATION
     ------------------------------------------------------------------ */
  function show(id) {
    $$('.view').forEach(function (v) { v.classList.add('hidden'); });
    var v = doc.getElementById(id);
    if (v) { v.classList.remove('hidden'); }
    $$('nav button, aside button').forEach(function (b) { b.classList.remove('active'); });
    $$('[data-go="' + id + '"]').forEach(function (b) { b.classList.add('active'); });
    window.scrollTo(0, 0);
    try { history.replaceState(null, '', '#' + id); } catch (e) {}
    if (id === 'inbox') { buildInbox(); }
    if (id === 'news') { loadHealth(); }
  }

  function wire() {
    doc.addEventListener('click', function (e) {
      var go = e.target.closest ? e.target.closest('[data-go]') : null;
      if (go) { show(go.getAttribute('data-go')); return; }
      var act = e.target.closest ? e.target.closest('[data-act]') : null;
      if (!act) { return; }
      var a = act.getAttribute('data-act');
      if (a === 'refresh-all') { loadToday(); }
      if (a === 'profile-save') { saveProfile(act); }
      if (a === 'profile-reset') { fillProfile(); say('pfMsg', 'Reverted to what is stored.'); }
      if (a === 'mark-seen') { markSeen(); }
    });
    var so = doc.getElementById('signout');
    if (so) {
      so.addEventListener('click', function () {
        if (!window.sb) { return; }
        window.sb.auth.signOut().then(function () { location.href = '/'; });
      });
    }
  }

  /* ------------------------------------------------------------------
     TODAY
     ------------------------------------------------------------------ */
  function greet() {
    var h = new Date().getHours();
    var word = h < 12 ? 'Good morning' : (h < 18 ? 'Good afternoon' : 'Good evening');
    var name = (PROFILE && PROFILE.display_name) || (ME && ME.email) || 'researcher';
    var first = String(name).split(/\s+/).slice(0, 2).join(' ');
    say('greeting', word + ', ' + first);
    var d = new Date();
    try {
      say('pbClock', d.toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        timeZone: 'Asia/Kuwait'
      }).toUpperCase());
    } catch (e) { say('pbClock', d.toDateString().toUpperCase()); }
  }

  function metric(id, v) {
    var n = doc.getElementById(id);
    if (n) { n.textContent = (v === null || v === undefined) ? '—' : String(v); }
  }

  function loadToday() {
    var sb = window.sb;
    if (!sb) { return; }

    sb.from('my_missions').select('id,title,status,created_at,finding_count')
      .order('created_at', { ascending: false })
      .then(function (r) {
        if (r.error) { metric('kMissions', '!'); resumeErr(r.error.message); return; }
        var rows = r.data || [];
        metric('kMissions', rows.length);
        paintResume(rows);
      });

    sb.from('mission_runs').select('id,status')
      .then(function (r) {
        if (r.error) { metric('kOpen', '!'); return; }
        metric('kOpen', (r.data || []).filter(function (x) {
          return x.status === 'running' || x.status === 'queued';
        }).length);
      });

    sb.from('reports').select('id,approved_at')
      .then(function (r) {
        if (r.error) { metric('kReports', '!'); return; }
        metric('kReports', (r.data || []).filter(function (x) { return x.approved_at; }).length);
      });

    sb.from('payload_frames').select('frame_no')
      .then(function (r) {
        if (r.error) { metric('kFrames', '!'); return; }
        metric('kFrames', (r.data || []).length);
      });
  }

  function resumeErr(m) {
    var n = doc.getElementById('resume');
    clear(n);
    n.className = 'empty';
    n.appendChild(doc.createTextNode('Your missions could not be read: ' + m));
  }

  function paintResume(rows) {
    var n = doc.getElementById('resume');
    clear(n);
    if (!rows.length) {
      n.className = 'empty';
      n.appendChild(doc.createTextNode(
        'No missions on this account yet. The research workspace is where one starts.'));
      return;
    }
    n.className = 'resume';
    rows.slice(0, 5).forEach(function (m) {
      var row = el('a', 'resumerow');
      row.href = 'researcher.html#missions';
      var left = el('div');
      left.appendChild(el('b', null, m.title || 'Untitled'));
      left.appendChild(el('small', null,
        'created ' + when(m.created_at) +
        (m.finding_count ? '  ·  ' + m.finding_count + ' finding' + (m.finding_count === 1 ? '' : 's') : '')));
      row.appendChild(left);
      row.appendChild(el('span', 'tag ' + tagClass(m.status), String(m.status || '').toUpperCase()));
      n.appendChild(row);
    });
  }

  function tagClass(s) {
    if (s === 'complete') { return 'green'; }
    if (s === 'failed') { return 'red'; }
    if (s === 'running' || s === 'queued' || s === 'review') { return 'amber'; }
    return '';
  }

  /* ------------------------------------------------------------------
     MY ACCOUNT
     ------------------------------------------------------------------ */
  function fillProfile() {
    if ($('#pfName')) { $('#pfName').value = (PROFILE && PROFILE.display_name) || ''; }
    if ($('#pfOrg')) { $('#pfOrg').value = (PROFILE && PROFILE.org) || ''; }
  }

  function paintFacts() {
    var dl = doc.getElementById('acctFacts');
    if (!dl || !ME) { return; }
    clear(dl);
    [['Email', ME.email],
     ['Account id', ME.id],
     ['Enrolled since', when(PROFILE && PROFILE.created_at)],
     ['Last sign-in', when(ME.last_sign_in_at) + '  (' + ago(ME.last_sign_in_at) + ')'],
     ['Sign-in method', (ME.app_metadata && ME.app_metadata.provider) || 'email']
    ].forEach(function (p) {
      dl.appendChild(el('dt', null, p[0]));
      dl.appendChild(el('dd', null, p[1] || '—'));
    });
  }

  function saveProfile(btn) {
    var sb = window.sb;
    if (!sb || !ME) { return; }
    var name = ($('#pfName').value || '').trim();
    var org = ($('#pfOrg').value || '').trim();
    if (name.length < 2) { say('pfMsg', 'A display name needs at least 2 characters.'); return; }
    btn.disabled = true;
    say('pfMsg', 'Saving…');
    sb.from('profiles').update({ display_name: name, org: org })
      .eq('user_id', ME.id).select('user_id,display_name,org,created_at')
      .then(function (r) {
        btn.disabled = false;
        if (r.error) {
          say('pfMsg', 'The database refused the change: ' + r.error.message);
          return;
        }
        if (!r.data || !r.data.length) {
          /* RLS returning zero rows is not an error and must not read
             as success. It means the policy did not match this row. */
          say('pfMsg', 'Nothing was updated. The row-level policy did not match ' +
                       'your account, so the change was not written.');
          return;
        }
        PROFILE = r.data[0];
        identity();
        greet();
        say('pfMsg', 'Saved. Your name on a future report will read "' +
                     PROFILE.display_name + '".');
      });
  }

  /* ------------------------------------------------------------------
     WHAT CHANGED - derived, never pushed
     ------------------------------------------------------------------ */
  var SEEN_KEY = 'ksat.portal.seen';

  function lastSeen() {
    try { return Number(localStorage.getItem(SEEN_KEY) || 0); } catch (e) { return 0; }
  }

  function markSeen() {
    try { localStorage.setItem(SEEN_KEY, String(Date.now())); } catch (e) {}
    buildInbox();
  }

  function buildInbox() {
    var sb = window.sb;
    var box = doc.getElementById('inboxList');
    if (!sb || !box) { return; }
    var since = lastSeen();
    say('inboxMsg', '');

    Promise.all([
      sb.from('my_missions').select('id,title,status,injection_flag,created_at'),
      sb.from('mission_runs').select('id,mission_id,status,started_at,finished_at'),
      sb.from('my_agent_steps').select('id,run_id,step_name,status,allowed,refused_reason,injection_flag,started_at'),
      sb.from('reports').select('id,mission_id,approved_at')
    ]).then(function (res) {
      var bad = res.filter(function (r) { return r.error; });
      if (bad.length) {
        clear(box); box.className = 'empty';
        box.appendChild(doc.createTextNode(
          'Some of this could not be read: ' + bad[0].error.message));
        return;
      }
      var missions = res[0].data || [], runs = res[1].data || [],
          steps = res[2].data || [], reports = res[3].data || [];
      var title = {};
      missions.forEach(function (m) { title[m.id] = m.title || 'Untitled'; });

      var items = [];

      runs.forEach(function (r) {
        if (r.finished_at) {
          items.push({ t: r.finished_at, kind: 'run',
            text: 'A run finished on "' + (title[r.mission_id] || 'a mission') +
                  '" with status ' + r.status + '.' });
        } else if (r.status === 'running' || r.status === 'queued') {
          items.push({ t: r.started_at, kind: 'open',
            text: 'A run on "' + (title[r.mission_id] || 'a mission') +
                  '" is still open, started ' + ago(r.started_at) +
                  '. It can be closed from the Research Console.' });
        }
      });

      steps.forEach(function (s) {
        if (s.injection_flag) {
          items.push({ t: s.started_at, kind: 'flag',
            text: 'An objective was screened as an instruction rather than a ' +
                  'question, so no tool was called.' });
        } else if (s.status === 'refused') {
          items.push({ t: s.started_at, kind: 'refused',
            text: 'A step was refused at ' + s.step_name + ': ' +
                  String(s.refused_reason || '').slice(0, 130) });
        }
      });

      reports.forEach(function (r) {
        if (r.approved_at) {
          items.push({ t: r.approved_at, kind: 'signed',
            text: 'A report was signed on "' + (title[r.mission_id] || 'a mission') + '".' });
        }
      });

      items.sort(function (a, b) { return new Date(b.t) - new Date(a.t); });

      clear(box);
      if (!items.length) {
        box.className = 'empty';
        box.appendChild(doc.createTextNode('Nothing to report. No runs, no refusals, no signatures.'));
        return;
      }
      box.className = 'inbox';
      items.slice(0, 40).forEach(function (it) {
        var fresh = since && new Date(it.t).getTime() > since;
        var row = el('div', 'ibrow ' + it.kind + (fresh ? ' fresh' : ''));
        row.appendChild(el('span', 'dot'));
        var b = el('div');
        b.appendChild(el('div', 'txt', it.text));
        b.appendChild(el('div', 'sub', when(it.t) + '  ·  ' + ago(it.t)));
        row.appendChild(b);
        box.appendChild(row);
      });
      say('inboxMsg', items.length + ' item' + (items.length === 1 ? '' : 's') +
        ', newest first, worked out from ' + missions.length + ' mission' +
        (missions.length === 1 ? '' : 's') + ', ' + runs.length + ' run' +
        (runs.length === 1 ? '' : 's') + ', ' + steps.length + ' step' +
        (steps.length === 1 ? '' : 's') + ' and ' + reports.length + ' report' +
        (reports.length === 1 ? '' : 's') + ' your account can read. ' +
        (since ? 'Highlighted items are newer than your last "mark as seen", which is ' +
                 'stored in this browser only.'
               : 'Press "Mark all as seen" and anything newer will be highlighted next time.'));
    });
  }

  /* ------------------------------------------------------------------
     SERVICES
     ------------------------------------------------------------------ */
  var LIVE_TILES = [
    ['Research workspace', 'Define a mission, run the pipeline, take the decision.', 'researcher.html#overview'],
    ['Payload archive', 'The eight frames, their geolocation method and confidence.', 'researcher.html#frames'],
    ['New mission', 'Start from a named area or draw one on the map.', 'researcher.html#missions'],
    ['Geospatial layers', 'The real Kuwait: coastline, governorates, 204 areas.', 'researcher.html#geo'],
    ['Reports and exports', 'Signed reports, download and print.', 'researcher.html#reports'],
    ['Provenance and audit', 'Every run, every step, every refusal.', 'researcher.html#audit'],
    ['Access test', 'Four requests this account may not make, against the live database.', 'researcher.html#audit'],
    ['Mission hub', 'The public programme site.', '/']
  ];

  var DEAD_TILES = [
    ['Leave request', 'Needs a requests table and an approver role. Neither exists.'],
    ['IT support ticket', 'Needs a ticketing system and somebody on the other end.'],
    ['Room and equipment booking', 'Needs a resources table and a calendar with locking.'],
    ['Expense claim', 'Needs a finance integration and an approval chain.'],
    ['Document library', 'Needs storage, versioning and a retention policy.'],
    ['Colleague directory', 'Needs consent to publish names. profiles is readable only for your own row.']
  ];

  function paintServices() {
    var live = doc.getElementById('liveTiles');
    if (live && !live.firstChild) {
      LIVE_TILES.forEach(function (t) {
        var a = el('a', 'tile');
        a.href = t[2];
        a.appendChild(el('b', null, t[0]));
        a.appendChild(el('span', null, t[1]));
        live.appendChild(a);
      });
    }
    var dead = doc.getElementById('deadTiles');
    if (dead && !dead.firstChild) {
      DEAD_TILES.forEach(function (t) {
        var d = el('div', 'tile dead');
        d.setAttribute('aria-disabled', 'true');
        d.appendChild(el('b', null, t[0]));
        d.appendChild(el('span', null, t[1]));
        d.appendChild(el('span', 'prov notbuilt', 'NOT BUILT'));
        dead.appendChild(d);
      });
    }
  }

  /* ------------------------------------------------------------------
     PROGRAMME RECORD

     Every item is a fact about THIS repository or THIS mission that a
     reader can check. Nothing here is an invented announcement.
     ------------------------------------------------------------------ */
  var FEED = [
    ['The payload archive holds eight frames, five of them geolocated',
     'Frames 01, 04 and 05 carry no coordinate and are labelled unresolved. ' +
     'The source record sheet left Geolocation empty on all eight rows, so every ' +
     'coordinate in the table was worked out afterwards rather than recorded by ' +
     'the spacecraft.',
     'payload_frames, and the header of 03-security/db/13_payload_archive.sql'],

    ['KuwaitSat-1 has photographed five places, all on the coast',
     'The five geolocated frames sit between 48.10 and 48.50 E. Al-Jahra is at ' +
     '47.65 E, about 43 km west of the westernmost frame, so the archive cannot ' +
     'answer a question about it. That is why the pipeline falls back to public ' +
     'Earth observation and stamps every finding with the sensor that produced it.',
     'measured from payload_frames'],

    ['The real Kuwait shipped as map layers',
     'Fourteen GeoJSON layers, 728 KB: the coastline, 25 islands, the six ' +
     'governorates on two different boundary readings, 204 residential areas, ' +
     'inland water, places, EPA reserves and the maritime zones. Most of it is ' +
     'OpenStreetMap under ODbL, which cannot be relicensed MIT, so it travels ' +
     'with LICENSE-DATA.md and every map credits OpenStreetMap.',
     'assets/geo/ and assets/geo/LICENSE-DATA.md'],

    ['An 893 km2 block is in two governorates depending on who you ask',
     'Um Qudeer and Al Abdiliya are in Al-Jahra in current OpenStreetMap and in ' +
     'Al-Ahmadi in geoBoundaries 2023. One changeset moved it in October 2024. ' +
     'This platform ships both readings and names which one is on screen rather ' +
     'than quietly picking a side.',
     'js/ksat-layers.js, governorateSource()'],

    ['The maritime zones have no legal value, and say so',
     'The EEZ, territorial sea and contiguous zone layers are 12 and 24 nautical ' +
     'mile buffers and median lines, not agreed boundaries. Kuwait-Iran is ' +
     'undelimited and beyond boundary point 162 Kuwait-Iraq is undemarcated. ' +
     'Marine Regions states this themselves and the layer switcher repeats it.',
     'Flanders Marine Institute, via assets/geo/LICENSE-DATA.md'],

    ['The nightly sweep writes a row whether it finds anything or not',
     'It closes runs left open by a browser that went away, at 02:00 Kuwait time, ' +
     'as a scheduled job rather than from anybody laptop. Writing on a quiet night ' +
     'too is deliberate: a missing night is then visible rather than silent. The ' +
     'table it writes to carries counts only, never a mission, run or researcher id.',
     '03-security/db/11_monitoring.sql'],

    ['A researcher cannot rewrite a mission that has run',
     'The title can be corrected. The objective locks the moment anything has ' +
     'run, because agent_steps hold prompts built from that objective and ' +
     'rewriting it afterwards would make the trail describe a question nobody ' +
     'asked. A mission with a signed report cannot be deleted at all.',
     '03-security/db/15_researcher_edit_delete.sql']
  ];

  var TRACKS = [
    ['01 Front end', 'The public site and this workspace. Never edits a page to add a ' +
                     'feature: adds a file and one line that loads it.'],
    ['02 Back end and data', 'The schema, the geodata, the payload archive and what ' +
                             'the agents are allowed to read.'],
    ['03 Security', 'Row level security, the grants, the refusals and the audit trail. ' +
                    'Owns every file in 03-security/db.'],
    ['04 Agents', 'The Orchestrator and the six agents, their thresholds and the ' +
                  'human checkpoint.']
  ];

  function paintRecord() {
    var f = doc.getElementById('feed');
    if (f && !f.firstChild) {
      FEED.forEach(function (it) {
        var d = el('article', 'item');
        d.appendChild(el('h4', null, it[0]));
        d.appendChild(el('p', null, it[1]));
        d.appendChild(el('div', 'src', 'Source: ' + it[2]));
        f.appendChild(d);
      });
    }
    var t = doc.getElementById('tracks');
    if (t && !t.firstChild) {
      TRACKS.forEach(function (x) {
        var d = el('div', 'track');
        d.appendChild(el('b', null, x[0]));
        d.appendChild(el('span', null, x[1]));
        t.appendChild(d);
      });
    }
  }

  function loadHealth() {
    var sb = window.sb;
    var tbl = doc.getElementById('healthTable');
    if (!sb || !tbl) { return; }
    sb.rpc('monitor_health', { p_days: 7 }).then(function (r) {
      while (tbl.rows.length > 1) { tbl.deleteRow(1); }
      if (r.error) { say('healthMsg', 'Platform health could not be read: ' + r.error.message); return; }
      var rows = r.data || [];
      if (!rows.length) { say('healthMsg', 'No nights recorded in the last 7 days.'); return; }
      rows.forEach(function (d) {
        var tr = tbl.insertRow(-1);
        [String(d.day || '').slice(0, 10), d.events, d.sweeps_ok, d.runs_swept,
         d.anomalies, when(d.last_event)].forEach(function (v) {
          tr.insertCell(-1).textContent = (v === null || v === undefined) ? '—' : String(v);
        });
      });
      say('healthMsg', rows.length + ' night' + (rows.length === 1 ? '' : 's') +
        ' read from public.monitor_health. Counts only: this table may never carry ' +
        'a mission, run or researcher id.');
    });
  }

  /* ------------------------------------------------------------------
     IDENTITY AND THE GATE
     ------------------------------------------------------------------ */
  function identity() {
    var shown = (PROFILE && PROFILE.display_name) ||
                (ME && ME.user_metadata && ME.user_metadata.display_name) ||
                (ME && ME.email) || 'Researcher';
    var org = (PROFILE && PROFILE.org) ||
              (ME && ME.user_metadata && ME.user_metadata.org) || 'Authorized researcher';
    var box = doc.getElementById('whoName');
    if (box) {
      clear(box);
      box.appendChild(doc.createTextNode(shown));
      var s = el('small', null, org);
      s.id = 'whoOrg';
      box.appendChild(s);
    }
    var mark = doc.getElementById('whoInitial');
    if (mark) {
      var letter = String(shown).replace(/[^A-Za-z؀-ۿ]/, '').charAt(0);
      mark.textContent = letter || '•';
    }
    say('pbWho', (ME && ME.email) || '—');
  }

  function admit(user) {
    ME = user;
    var entry = doc.getElementById('entry');
    if (entry && entry.parentNode) { entry.parentNode.removeChild(entry); }
    doc.documentElement.classList.add('ksat-ready');

    window.sb.from('profiles').select('user_id,display_name,org,created_at')
      .eq('user_id', user.id).limit(1)
      .then(function (r) {
        PROFILE = (!r.error && r.data && r.data[0]) ? r.data[0] : null;
        identity();
        greet();
        fillProfile();
        paintFacts();
        if (r.error) {
          say('pfMsg', 'Your profile row could not be read: ' + r.error.message);
        }
      });

    paintServices();
    paintRecord();
    loadToday();

    var want = (location.hash.slice(1) || 'today');
    if (!doc.getElementById(want)) { want = 'today'; }
    show(want);
  }

  function refuse(msg) {
    var entry = doc.getElementById('entry');
    if (entry && entry.parentNode) { entry.parentNode.removeChild(entry); }
    var d = doc.getElementById('denied');
    if (d) { d.hidden = false; }
    doc.documentElement.classList.add('ksat-denied');
    if (msg) { console.warn('[portal] ' + msg); }
  }

  function boot() {
    wire();
    if (!window.sb) {
      say('entryMsg', 'The database client did not load, so this page cannot ' +
                      'tell who you are. Nothing is shown rather than something guessed.');
      return;
    }
    window.sb.auth.getUser().then(function (r) {
      var user = r && r.data && r.data.user;
      if (!user) {
        /* Not signed in is not "denied": send them where they sign in. */
        location.href = 'researcher.html';
        return;
      }
      admit(user);
    }).catch(function (e) { refuse(String(e && e.message || e)); });
  }

  KS.portal = { show: show, reload: loadToday };

  if (doc.readyState === 'loading') { doc.addEventListener('DOMContentLoaded', boot); }
  else { boot(); }
})();
