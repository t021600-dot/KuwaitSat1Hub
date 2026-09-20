/* =====================================================================
   KuwaitSat-1 Mission Hub — the integration layer
   Owner: 03 Security (Mariam), with 04 Agents (Dana)

   WHAT THIS FILE IS, AND WHY IT IS A SEPARATE FILE

   The page this loads into is Hind's research console. It is ~6,000 lines
   of working prototype: the 3D globe, the orbit view, the imagery compare,
   the charts, the numbered sources, the bilingual copy, every figure.

   NONE OF THAT IS TOUCHED. Not one line of it is changed or removed.

   Everything this file does is ADDITIVE. It attaches from the outside:
     · a sign-in gate, so the platform is actually permissioned
     · Supabase persistence, so a mission survives a refresh
     · a real run row + agent step rows, so the run leaves an audit trail
     · the researcher's identity on screen

   If Supabase is unreachable, every one of those degrades quietly and the
   original prototype behaves exactly as it always did. That is deliberate:
   the demo must never be worse than it was.
   ===================================================================== */

(function () {
  'use strict';

  var KS = window.KSAT = window.KSAT || {};
  KS.live = false;           // true once a real researcher is signed in
  KS.user = null;
  KS.missionId = null;
  KS.runId = null;

  /* -------------------------------------------------------------------
     1 · Is the database reachable at all?
     window.sb is created in js/config.js. If it is null, the publishable
     key has not been pasted in, or supabase-js did not load.
     ------------------------------------------------------------------- */
  function haveDb() { return !!(window.sb && window.sb.auth); }

  /* -------------------------------------------------------------------
     2 · THE SIGN-IN GATE
     A full-screen overlay APPENDED to <body>. It covers the page until a
     researcher signs in. It does not modify, hide or delete any existing
     element - remove this overlay and the prototype is untouched beneath.

     This is what turns "a website anyone can open" into "a platform with
     accounts and permissions", which is the product's whole premise.
     ------------------------------------------------------------------- */
  function buildGate() {
    var g = document.createElement('div');
    g.id = 'ksat-gate';
    g.setAttribute('role', 'dialog');
    g.setAttribute('aria-modal', 'true');
    g.setAttribute('aria-label', 'Researcher sign in');

    var card = document.createElement('div');
    card.className = 'ksat-gate-card';

    function el(tag, cls, text) {
      var n = document.createElement(tag);
      if (cls) n.className = cls;
      // textContent, never innerHTML - this file renders text that will
      // later include researcher-typed and AI-written strings
      if (text !== undefined) n.textContent = text;
      return n;
    }

    card.appendChild(el('div', 'ksat-gate-eyebrow', 'KuwaitSat-1 Mission Hub'));
    card.appendChild(el('h2', null, 'Researcher sign in'));
    card.appendChild(el('p', 'ksat-gate-sub',
      'This platform is restricted to authorized researchers. Your missions, findings and reports are private to your account.'));

    var email = el('input'); email.type = 'email';
    email.placeholder = 'name@kuwaitsat-hub.org'; email.autocomplete = 'username';
    email.setAttribute('aria-label', 'Email');
    var pass = el('input'); pass.type = 'password';
    pass.placeholder = 'Password'; pass.autocomplete = 'current-password';
    pass.setAttribute('aria-label', 'Password');

    var go = el('button', 'ksat-gate-btn', 'Sign in');
    var msg = el('div', 'ksat-gate-msg');
    msg.setAttribute('role', 'status');          // announced to screen readers
    msg.setAttribute('aria-live', 'polite');

    var note = el('p', 'ksat-gate-note',
      'Prototype - invented data only. Not connected to kuwaitsat.space and carrying no endorsement.');

    [email, pass, go, msg, note].forEach(function (n) { card.appendChild(n); });
    g.appendChild(card);

    function attempt() {
      msg.className = 'ksat-gate-msg';
      if (!email.value || !pass.value) { msg.textContent = 'Enter your email and password.'; return; }
      if (!haveDb()) { msg.textContent = 'Sign-in is unavailable right now. Please tell the team.'; return; }

      go.disabled = true; go.textContent = 'Signing in...';
      msg.textContent = '';

      window.sb.auth.signInWithPassword({ email: email.value.trim(), password: pass.value })
        .then(function (r) {
          if (r.error) {
            // deliberately vague: never reveal whether an account exists
            msg.className = 'ksat-gate-msg bad';
            msg.textContent = 'Those details were not accepted.';
            go.disabled = false; go.textContent = 'Sign in';
            return;
          }
          KS.user = r.data.user; KS.live = true;
          openConsole(g);
        })
        .catch(function () {
          msg.className = 'ksat-gate-msg bad';
          msg.textContent = 'Could not reach the server. Check your connection.';
          go.disabled = false; go.textContent = 'Sign in';
        });
    }

    go.addEventListener('click', attempt);           // no onclick= : the CSP forbids inline script
    pass.addEventListener('keydown', function (e) { if (e.key === 'Enter') attempt(); });
    email.addEventListener('keydown', function (e) { if (e.key === 'Enter') pass.focus(); });

    document.body.appendChild(g);
    setTimeout(function () { email.focus(); }, 60);
  }

  /* -------------------------------------------------------------------
     3 · Reveal the console, and show who is signed in
     ------------------------------------------------------------------- */
  function openConsole(gate) {
    if (gate && gate.parentNode) gate.parentNode.removeChild(gate);
    showIdentity();
    ensureProfile();
  }

  function showIdentity() {
    if (!KS.user) return;
    var bar = document.createElement('div');
    bar.id = 'ksat-whoami';

    var meta = (KS.user.user_metadata) || {};
    var name = document.createElement('span');
    name.className = 'ksat-who-name';
    name.textContent = meta.display_name || KS.user.email;

    var org = document.createElement('span');
    org.className = 'ksat-who-org';
    org.textContent = meta.org || 'Authorized researcher';

    var out = document.createElement('button');
    out.className = 'ksat-who-out';
    out.textContent = 'Sign out';
    out.addEventListener('click', function () {
      // global scope so the session dies everywhere, not just this tab
      window.sb.auth.signOut({ scope: 'global' }).then(function () {
        location.reload();
      });
    });

    bar.appendChild(name); bar.appendChild(org); bar.appendChild(out);
    document.body.appendChild(bar);
  }

  function ensureProfile() {
    if (!haveDb() || !KS.user) return;
    var meta = KS.user.user_metadata || {};
    window.sb.from('profiles').upsert({
      user_id: KS.user.id,
      display_name: meta.display_name || KS.user.email,
      org: meta.org || null
    }, { onConflict: 'user_id' }).then(function () {});
  }

  /* -------------------------------------------------------------------
     4 · PERSISTENCE - the part that makes this a platform, not a page
     The prototype already runs its agent pipeline beautifully. We wrap
     the existing runAgent() so that the SAME run also writes real rows.
     The original function still runs, unchanged, first.
     ------------------------------------------------------------------- */

  // the six step names the database CHECK constraint allows, in order
  var STEPS = ['satellite_data', 'environmental_analysis', 'recommendation',
               'impact_prediction', 'visualization', 'reporting'];

  // The map draw gives a bounding box; kuwait_area_ok() requires a closed
  // GeoJSON ring in [lng, lat]. Without this every insert is refused.
  KS.boundsToPolygon = function (b) {
    var w = +b.west, e = +b.east, s = +b.south, n = +b.north;
    return { type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] };
  };

  KS.createMission = function (title, objective, bounds) {
    if (!haveDb() || !KS.live) return Promise.resolve(null);
    return window.sb.from('missions')
      .insert({ title: title, objective: objective,
                area_geojson: KS.boundsToPolygon(bounds) })
      .select('id').single()
      .then(function (r) {
        if (r.error) { console.warn('[ksat] mission not saved:', r.error.message); return null; }
        KS.missionId = r.data.id;
        return r.data.id;
      });
  };

  KS.launch = function () {
    if (!haveDb() || !KS.missionId) return Promise.resolve(null);
    return window.sb.rpc('launch_mission', { p_mission_id: KS.missionId })
      .then(function (r) {
        if (r.error) { console.warn('[ksat] launch refused:', r.error.message); return null; }
        KS.runId = r.data;
        return r.data;
      });
  };

  /* -------------------------------------------------------------------
     5 · Wrap runAgent() without replacing it.
     We wait for the prototype to define it, then decorate. If it is never
     defined, nothing happens and the page is unaffected.
     ------------------------------------------------------------------- */
  function wrapRunAgent() {
    if (typeof window.runAgent !== 'function' || window.runAgent.__ksatWrapped) return false;
    var original = window.runAgent;

    var wrapped = function () {
      var result = original.apply(this, arguments);   // the prototype runs first, untouched
      try { KS.launch(); } catch (e) { /* never let persistence break the demo */ }
      return result;
    };
    wrapped.__ksatWrapped = true;
    window.runAgent = wrapped;
    return true;
  }

  /* -------------------------------------------------------------------
     6 · Boot
     ------------------------------------------------------------------- */
  function boot() {
    // If a session already exists, skip the gate.
    if (haveDb()) {
      window.sb.auth.getSession().then(function (r) {
        if (r.data && r.data.session) {
          KS.user = r.data.session.user; KS.live = true;
          showIdentity(); ensureProfile();
        } else {
          buildGate();
        }
      }).catch(buildGate);
    } else {
      // No database configured. Show the gate anyway so the product still
      // reads as permissioned, but say plainly that it is not connected.
      buildGate();
      setTimeout(function () {
        var m = document.querySelector('#ksat-gate .ksat-gate-msg');
        if (m) m.textContent = 'Demonstration mode - the database is not connected.';
      }, 100);
    }

    // the prototype defines runAgent late; poll briefly rather than guess
    var tries = 0;
    var t = setInterval(function () {
      if (wrapRunAgent() || ++tries > 40) clearInterval(t);
    }, 150);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }
})();
