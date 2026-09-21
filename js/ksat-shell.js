/* =====================================================================
   ksat-shell.js — THE SHELL
   Owner: 01 Front End, with 03 Security (tier provenance)

   Three jobs, one file, zero edits to index.html:

     0 · THE BRIDGE     publish the prototype's own globals onto window
     A · TWO TIERS      a public visitor sees the record; a signed-in
                        researcher sees the instruments
     B · CHAPTERS       six chapters instead of one 6,000-line scroll,
                        with nothing removed and everything reachable

   THE ABSOLUTE CONSTRAINT
   index.html is not changed or removed from. Not the 3D, not a number,
   not a source. This file attaches from the outside: it stamps runtime
   attributes, appends new elements, and toggles the `hidden` attribute.
   Delete this file and css/ksat-shell.css and the original 6,000-line
   page is back, byte for byte. site-original/index.html proves it.

   WHAT IS AND IS NOT A SECURITY CONTROL — say this out loud
   The tier layer is PRODUCT FRAMING, not secrecy. Every demo constant,
   REG, PIPE and simulated scene in this page ships to every visitor and
   always did; you can undo the tier in DevTools in four seconds. What
   you cannot undo there is row-level security: missions, runs, agent
   steps, results and reports live in Postgres, `anon` holds zero table
   grants, and a signed-in researcher sees only their own rows. Flip the
   class and you get EMPTY panels, because the emptiness is enforced in
   the database, not in this page.
   ===================================================================== */

(function () {
  'use strict';

  /* ===================================================================
     0 · THE BRIDGE  —  and the bug it fixes

     index.html declares its state with top-level `const`:
         index.html:2713   const S = { ... }
         index.html:1926   const REG = ...
         index.html:3858   const PIPE = [ ... ]
     In a CLASSIC script, top-level `const`/`let`/`class` bind into the
     global *declarative* environment record, NOT onto the global object.
     So `window.S`, `window.REG` and `window.PIPE` are all `undefined`.

     That silently disabled the audit trail. js/ksat-integration.js opens
     recordRun() with:
         var S = window.S; if (!S || !S.ag) return;
     ...which returned on its first line every single time. No mission,
     no run, no step and no result has ever been written by a browser
     run. It looked healthy because `window.runAgent` IS defined —
     function declarations do go on the global object — so the wrapper
     fired and then did nothing.

     THE FIX: this file is also a classic script, so it shares that same
     global lexical environment and can simply read the bare identifiers
     and copy them across. `typeof` first, because referencing a name
     that was never declared throws ReferenceError.
     =================================================================== */

  var bridged = [];
  function lift(name, value) {
    try {
      if (typeof value !== 'undefined') { window[name] = value; bridged.push(name); }
    } catch (e) { /* never let the bridge break the page */ }
  }

  try { if (typeof S             !== 'undefined') lift('S', S); } catch (e) {}
  try { if (typeof REG           !== 'undefined') lift('REG', REG); } catch (e) {}
  try { if (typeof REGIONS       !== 'undefined') lift('REGIONS', REGIONS); } catch (e) {}
  try { if (typeof PIPE          !== 'undefined') lift('PIPE', PIPE); } catch (e) {}
  try { if (typeof AGENTS        !== 'undefined') lift('AGENTS', AGENTS); } catch (e) {}
  try { if (typeof RC            !== 'undefined') lift('RC', RC); } catch (e) {}
  try { if (typeof SPECIES       !== 'undefined') lift('SPECIES', SPECIES); } catch (e) {}
  try { if (typeof COEFF         !== 'undefined') lift('COEFF', COEFF); } catch (e) {}
  try { if (typeof SOURCES       !== 'undefined') lift('SOURCES', SOURCES); } catch (e) {}
  try { if (typeof KW_RAIN       !== 'undefined') lift('KW_RAIN', KW_RAIN); } catch (e) {}
  /* LANG is deliberately NOT bridged. `let LANG = "en"` is a PRIMITIVE:
     window.LANG would be a frozen snapshot that never follows a language
     switch, sitting on window next to live object references that do.
     Read the live `document.documentElement.dir` instead - see isRTL().
     (In this build applyLang() hardcodes lang="en"/dir="ltr", so the page
     is English-only and isRTL() is always false. That is the prototype's
     own behaviour and we do not change it.) */
  /* These are function declarations and are already on window. Asserting
     them costs nothing and documents what the workflow layer depends on. */
  try { if (typeof zonesFor      === 'function') lift('zonesFor', zonesFor); } catch (e) {}
  try { if (typeof predictImpact === 'function') lift('predictImpact', predictImpact); } catch (e) {}
  try { if (typeof matchSpecies  === 'function') lift('matchSpecies', matchSpecies); } catch (e) {}
  try { if (typeof regName       === 'function') lift('regName', regName); } catch (e) {}

  var KS = window.KSAT = window.KSAT || {};
  var SH = KS.shell = KS.shell || {};
  SH.bridged = bridged;

  var root = document.documentElement;

  /* ===================================================================
     1 · Small helpers.  textContent ONLY.

     Every string this file renders is, or will become, researcher-typed
     or agent-written. There is no innerHTML in this file and no onclick=
     anywhere; containers are cleared with textContent = ''.
     =================================================================== */

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  /* #explorer is a DUPLICATE ID: <section id="explorer"> at index.html:1129
     contains <div class="explorer" id="explorer"> at index.html:1137.
     getElementById returns the first in document order — the section —
     which is what we want. querySelectorAll('#explorer') returns TWO
     nodes and would stamp the inner div as well. So: getElementById,
     everywhere, with no exceptions. */
  function sec(id) {
    var n = document.getElementById(id);
    return (n && n.tagName === 'SECTION') ? n : null;
  }

  function reduced() {
    /* Evaluated at call time, not cached at load: the page caches this
       once at index.html:1860, so a mid-session OS change is not
       honoured there. Here it is. */
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (e) { return false; }
  }

  function isRTL() {
    return (root.getAttribute('dir') === 'rtl') ||
           (root.getAttribute('lang') === 'ar');
  }

  /* ===================================================================
     2 · THE TIER MAP

     The boundary is drawn on FUNCTION, not secrecy.
       INSIDER  = a surface that PRODUCES or DISPLAYS work product —
                  a mission, a run, a scored recommendation, a readout.
       PUBLIC   = a surface that EXPLAINS, EVIDENCES or ATTRIBUTES.

     14 public / 10 insider. The public arc is coherent end to end:
     who built the satellite -> what it really photographed -> what a
     planning system on top of it would look like -> how we govern it ->
     who we are -> where every fact came from. The insider tier is
     exactly the instruments.

     sh-m1 ("the public URL opens for a stranger, no login wall on the
     landing page") is satisfied because `top` is public and no dialog
     is built on arrival.
     =================================================================== */

  var INSIDER = ['console', 'explorer', 'dashboard', 'map', 'simulate',
                 'impact', 'charts', 'compare', 'ai', 'agent'];

  function isInsiderSection(id) { return INSIDER.indexOf(id) !== -1; }

  /* The ten bespoke invitation panels. One shell, ten first lines.
     `lines` are the three real instruments behind each panel, named —
     an invitation has to be specific or it reads as a wall. */
  var PANELS = {
    console: {
      t: 'The research brief',
      p: 'State an objective, set the area and the period, and hand it to the agent pipeline. Every brief becomes a mission that belongs to one account and to no one else’s.',
      lines: ['The objective, area and period controls',
              'The site constraints you supply, which the agents never guess',
              'The seven-agent rail, each showing its working and its sources']
    },
    explorer: {
      t: 'The imagery explorer',
      p: 'Pan, zoom and step back through epochs on a 39 m sampling grid — the KuwaitSat-1 ground sample distance — with the analytical layers switched on.',
      lines: ['True-colour, vegetation and thermal layers',
              'A per-pixel inspector',
              'A histogram of the selected layer']
    },
    dashboard: {
      t: 'Environmental intelligence dashboard',
      p: 'The national picture for a chosen area and period, in the form a researcher actually works from.',
      lines: ['The KPI grid',
              'Vegetation-index trend and stress by governorate',
              'Monthly surface heat and greening potential']
    },
    map: {
      t: 'Greening potential map',
      p: 'Kuwait’s six governorates scored by the greening model, with the evidence behind each score and the recommendation that comes out of it.',
      lines: ['The scored map and its metric switch',
              'What the model looked at, per region',
              'The recommendation card with its options, uncertainty and follow-up']
    },
    simulate: {
      t: 'Scenario simulation',
      p: 'Choose an area and an intervention ambition, run the greening engine, then drag between the current modelled surface and the one the engine proposes.',
      lines: ['The before/after wipe',
              'The scenario result and its assumptions',
              'The standing warning that this is not a planning proposal']
    },
    impact: {
      t: 'Impact calculator',
      p: 'Move the inputs and watch the conceptual indicators respond — every assumption open for inspection, because arithmetic you cannot see is not evidence.',
      lines: ['The input sliders and presets',
              'The conceptual indicators',
              'The assumptions drawer behind every figure']
    },
    charts: {
      t: 'Reading the record',
      p: 'Filter the dataset by area, period and metric. The charts and the table are drawn from the same numbers, so they always agree.',
      lines: ['The trend chart',
              'The area comparison',
              'The underlying row table']
    },
    compare: {
      t: 'Change detection',
      p: 'Put two epochs side by side and wipe between them. The change mask is produced by differencing the scenes — the method is real, the scenes are simulated.',
      lines: ['Wipe, side-by-side and change-mask views',
              'The change readout',
              'The interpretation, badged as interpretation']
    },
    ai: {
      t: 'The analyst',
      p: 'Ask a question about the dataset. The answer always comes back in the same five parts, and one of them is what class of data the answer rests on.',
      lines: ['The analyst session',
              'The suggested questions',
              'The guardrail that refuses questions it has no data for']
    },
    agent: {
      t: 'The agent console',
      p: 'The whole route: collect, validate, analyse, decide, recommend, report — with the decision gates, the re-ranking loop, and the approval that a report cannot be written without.',
      lines: ['The ten-step pipeline with its two decision nodes',
              'The run output and its provenance labels',
              'The human checkpoint, and the report it releases']
    }
  };

  /* The same footnote on all ten, deliberately. It makes the honesty of
     the security story a visible product feature rather than a slide. */
  var FOOT_EN = 'Nothing here is hidden for secrecy. This is where a signed-in researcher’s own missions, runs and results are drawn, and those live in the database behind row-level security — they were never in this page.';
  var FOOT_AR = 'لا شيء هنا مخفي بدافع السرّية. هنا تُرسم مهام الباحث المسجّل ونتائجه، وهي محفوظة في قاعدة البيانات خلف أمان مستوى الصف — ولم تكن يوماً جزءاً من هذه الصفحة.';

  /* ===================================================================
     3 · THE CHAPTERS

     Six contiguous chapters, in TRUE DOM ORDER. No node is ever moved,
     reparented or reordered — only the `hidden` attribute changes.

     `.chapter` is ALREADY TAKEN: it is the story-card class at
     index.html:488. Everything here namespaces as .ksat-ch-.

     The ids are authored, not derived from DOM order, so this survives a
     future section and says plainly where a new one goes.
     =================================================================== */

  var CHAPTERS = [
    { key: 'brief',    en: 'Mission Record',         ar: 'السجل',
      ids: ['top', 'legend', 'mission', 'builders'] },
    { key: 'space',    en: 'Kuwait From Space',      ar: 'من الفضاء',
      ids: ['imagery', 'explorer', 'compare', 'globe', 'orbit'] },
    { key: 'intel',    en: 'Intelligence',           ar: 'التحليل',
      ids: ['dashboard', 'map', 'charts'] },
    { key: 'planning', en: 'Planning',               ar: 'التخطيط',
      ids: ['system', 'simulate', 'impact'] },
    { key: 'agents',   en: 'Agents',                 ar: 'الوكلاء',
      ids: ['console', 'ai', 'agent'] },
    { key: 'record',   en: 'Story & Accountability', ar: 'القصة والمصداقية',
      ids: ['story', 'vision', 'trust', 'team', 'sources', 'finale'] }
  ];

  var CH_OF = {};          // section id -> chapter key
  var CH_BY_KEY = {};
  CHAPTERS.forEach(function (c) {
    CH_BY_KEY[c.key] = c;
    c.ids.forEach(function (id) { CH_OF[id] = c.key; });
  });

  /* Feature detection for hidden="until-found". Where it exists, closed
     chapters still match Ctrl+F and fire `beforematch`, which we use to
     open the owning chapter. Where it does not, plain `hidden` plus the
     rail's filter box is the fallback. */
  var UNTIL_FOUND = false;
  try { UNTIL_FOUND = ('onbeforematch' in document.body); } catch (e) {}

  var openKey = CHAPTERS[0].key;
  var navOn = false;          // false = original continuous scroll

  /* ===================================================================
     4 · BUILD THE INVITATION PANELS

     Inserted BEFORE the section, as a sibling inside .wrap. The section
     itself is never emptied, never unmounted and never has a child
     removed — it is hidden by a class, and the class comes off on
     sign-in. That is the whole mechanism.
     =================================================================== */

  function buildPanel(id) {
    var copy = PANELS[id];
    var s = sec(id);
    if (!copy || !s || document.getElementById('ksat-invite-' + id)) return;

    var box = el('aside', 'ksat-invite');
    box.id = 'ksat-invite-' + id;
    box.setAttribute('data-ksat-for', id);

    box.appendChild(el('div', 'ksat-invite-eyebrow',
      'RESEARCHER SURFACE · واجهة الباحثين'));

    var h = el('h3', 'ksat-invite-h', copy.t);
    h.id = 'ksat-invite-h-' + id;
    h.setAttribute('tabindex', '-1');       // focusable target for deep links
    box.appendChild(h);

    /* The lead line an arriving deep link writes into. Empty until then,
       so it never shows as a stray blank row. */
    var lead = el('p', 'ksat-invite-lead');
    lead.id = 'ksat-invite-lead-' + id;
    lead.hidden = true;
    box.appendChild(lead);

    box.appendChild(el('p', 'ksat-invite-p', copy.p));

    box.appendChild(el('div', 'ksat-invite-lab', 'Behind this panel'));
    var ul = el('ul', 'ksat-invite-list');
    copy.lines.forEach(function (t) { ul.appendChild(el('li', null, t)); });
    box.appendChild(ul);

    var btn = el('button', 'ksat-invite-btn',
      'Sign in to open this section · تسجيل الدخول لفتح هذا القسم');
    btn.type = 'button';
    btn.addEventListener('click', function () {
      KS.intent = id;                        // where to land after sign-in
      openGate(btn);
    });
    box.appendChild(btn);

    var foot = el('div', 'ksat-invite-foot');
    foot.appendChild(el('p', 'ksat-invite-foot-en', FOOT_EN));
    var ar = el('p', 'ksat-invite-foot-ar', FOOT_AR);
    ar.setAttribute('dir', 'rtl');
    ar.setAttribute('lang', 'ar');
    foot.appendChild(ar);
    box.appendChild(foot);

    s.parentNode.insertBefore(box, s);
  }

  function buildAllPanels() { INSIDER.forEach(buildPanel); }

  /* The one-line public-tier orientation note under the hero. */
  function buildHeroNote() {
    var top = sec('top');
    if (!top || document.getElementById('ksat-tier-note')) return;

    var n = el('div', 'ksat-tier-note');
    n.id = 'ksat-tier-note';

    n.appendChild(el('span', 'ksat-tier-note-txt',
      'You are reading the public record. Ten working sections — the dashboards, the maps, the numbers and the agent console — open for signed-in researchers.'));

    var show = el('button', 'ksat-tier-note-link', 'Show me which');
    show.type = 'button';
    show.addEventListener('click', function () {
      root.setAttribute('data-ksat-highlight', 'locked');
      openRail();
      setTimeout(function () { root.removeAttribute('data-ksat-highlight'); }, 4200);
    });
    n.appendChild(show);

    var x = el('button', 'ksat-tier-note-x', '×');
    x.type = 'button';
    x.setAttribute('aria-label', 'Dismiss this note');
    x.addEventListener('click', function () {
      n.remove();
      try { localStorage.setItem('ksat_tier_note', 'off'); } catch (e) {}
    });
    n.appendChild(x);

    var off = false;
    try { off = localStorage.getItem('ksat_tier_note') === 'off'; } catch (e) {}
    if (!off) top.appendChild(n);
  }

  /* ===================================================================
     5 · APPLYING THE TIER

     The tier is derived ONLY from the Supabase session. Never from a URL
     parameter, never from a localStorage flag, never from a cookie the
     visitor controls. Flipping the attribute in DevTools yields the
     shipped demo HTML you already had — not a session, and not a row.
     =================================================================== */

  function applyTier(tier) {
    root.setAttribute('data-ksat-tier', tier);

    paintNavForTier(tier);

    /* THE BAR MUST NOT OFFER BOTH STATES AT ONCE.
       Until 21 Sep the masthead showed "SIGN OUT" beside "Researcher
       sign in" for a signed-in researcher, because applyTier moved the
       sections but never touched the button that opens the gate. It read
       as a broken session and it was the first thing visible in the
       bar. The identity chip is the signed-in affordance; the sign-in
       button belongs only to the public tier. */
    if (signInBtn) signInBtn.hidden = (tier === 'insider');

    INSIDER.forEach(function (id) {
      var s = sec(id);
      if (!s) return;                        // no-op safely if an id is missing
      if (tier === 'public') s.classList.add('ksat-locked');
      else s.classList.remove('ksat-locked');
    });

    paintRailLocks();

    if (tier === 'insider') {
      var note = document.getElementById('ksat-tier-note');
      if (note) note.remove();
      /* Every canvas that was inside a locked section measured 0 while it
         was hidden. This is the page's OWN debounced master redraw
         (index.html:4425 -> drawExplorer, drawCompare, draw3D, drawOrbit,
         renderDashboard, renderViz, drawBA, renderCalcOut, drawDescent).
         We re-measure by asking for it, rather than by writing drawing
         code of our own. */
      nudgeRedraw();
      if (KS.intent) { var want = KS.intent; KS.intent = null; goToSection(want); }
    }
  }


  /* ===================================================================
     THE NAVIGATION IS PART OF THE TIER

     The nav listed all fourteen destinations to everyone. Ten of them
     are instruments a visitor cannot use, so a stranger was shown a
     menu that was three-quarters unavailable, and every one of those
     clicks landed on an invitation rather than on the thing named. That
     reads as a site that is broken, not as one that is restricted.

     A public visitor now gets the four public destinations. Signing in
     adds the other ten, which is also the clearest possible statement
     of what an account is FOR - the menu itself grows.

     The buttons are hidden, not removed: index.html's own scroll-spy
     indexes them positionally (`$$("#nav button").forEach((b,i)=> …
     NAV[i].id)`), so deleting one would misalign every highlight after
     it. Hiding preserves the index.
     =================================================================== */
  /* index.html's renderNav() does `n.innerHTML = ""` and rebuilds every
     button from scratch. It runs inside renderAll(), which fires on
     every language switch and several other paths — so flags set here
     were being wiped seconds later, and the first build of this simply
     did not hold. A MutationObserver re-applies them whenever the nav
     is rebuilt, which is the only reliable hook: we do not own that
     function and must not fight it for ownership. */
  var navWatch = null;
  function watchNav() {
    if (navWatch) return;
    var nav = document.querySelector('nav.nav');
    if (!nav || typeof MutationObserver === 'undefined') return;
    navWatch = new MutationObserver(function () {
      paintNavForTier(root.getAttribute('data-ksat-tier') || 'public');
    });
    navWatch.observe(nav, { childList: true });
  }

  function paintNavForTier(tier) {
    watchNav();
    var buttons = document.querySelectorAll('nav.nav button');
    if (!buttons.length) return;
    var nav = (typeof NAV !== 'undefined') ? NAV : null;
    for (var i = 0; i < buttons.length; i++) {
      var id = nav && nav[i] ? nav[i].id : null;
      if (!id) continue;
      var locked = isInsiderSection(id) && tier === 'public';
      buttons[i].hidden = locked;
      buttons[i].setAttribute('aria-hidden', locked ? 'true' : 'false');
      buttons[i].tabIndex = locked ? -1 : 0;
    }
  }

  function nudgeRedraw() {
    /* Force layout first so clientWidth is real before the handler runs. */
    try { void document.body.offsetHeight; } catch (e) {}
    try { window.dispatchEvent(new Event('resize')); } catch (e) {}
    /* The page debounces at 220 ms; a second nudge covers a chapter and a
       tier change landing in the same frame. */
    setTimeout(function () {
      try { window.dispatchEvent(new Event('resize')); } catch (e) {}
    }, 320);
  }

  /* ===================================================================
     6 · THE GATE  —  on demand, never on arrival

     js/ksat-integration.js builds a full-screen role="dialog" overlay
     whenever there is no session. That covers the landing page, which
     fails sh-m1. We do NOT edit that file and we do NOT duplicate its
     working Supabase sign-in: we intercept the element it appends,
     detach it, and re-show it only when a PERSON asks.

     The same observer relocates #ksat-whoami from <body> into the
     header's .bar-act, so identity sits in the bar and nothing floats.
     =================================================================== */

  var gateEl = null;         // the detached gate, held for re-use
  var gateOpen = false;
  var gateTrigger = null;    // focus returns here on close
  var signInBtn = null;

  function haveDb() { return !!(window.sb && window.sb.auth); }

  function captureGate(g) {
    gateEl = g;
    if (g.parentNode) g.parentNode.removeChild(g);
    enhanceGate(g);
  }

  /* Turn the integration layer's overlay into a proper modal: a visible
     close control, Escape, a focus trap, and <main> made inert while it
     is open. The sign-in logic inside it is untouched. */
  function enhanceGate(g) {
    if (g.__ksatEnhanced) return;
    g.__ksatEnhanced = true;

    var card = g.querySelector('.ksat-gate-card');
    if (card) {
      var x = el('button', 'ksat-gate-x', '×');
      x.type = 'button';
      x.setAttribute('aria-label', 'Close sign in');
      x.addEventListener('click', function () { closeGate(); });
      card.appendChild(x);

      var back = el('button', 'ksat-gate-back',
        'Continue without signing in — the public record stays open');
      back.type = 'button';
      back.addEventListener('click', function () { closeGate(); });
      card.appendChild(back);
    }

    g.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.stopPropagation(); closeGate(); return; }
      if (e.key !== 'Tab') return;
      var f = g.querySelectorAll('input, button, a[href], [tabindex]:not([tabindex="-1"])');
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    /* Clicking the backdrop (not the card) closes it. */
    g.addEventListener('mousedown', function (e) {
      if (e.target === g) closeGate();
    });
  }

  function openGate(trigger) {
    if (!gateEl || gateOpen) return;
    gateTrigger = trigger || signInBtn || null;
    gateOpen = true;
    document.body.appendChild(gateEl);
    var m = document.querySelector('main');
    if (m) m.setAttribute('inert', '');
    var input = gateEl.querySelector('input[type="email"]') || gateEl.querySelector('input');
    setTimeout(function () { if (input) input.focus(); }, 40);
  }

  function closeGate() {
    if (!gateOpen || !gateEl) return;
    gateOpen = false;
    if (gateEl.parentNode) gateEl.parentNode.removeChild(gateEl);
    var m = document.querySelector('main');
    if (m) m.removeAttribute('inert');
    if (gateTrigger && document.contains(gateTrigger)) gateTrigger.focus();
    gateTrigger = null;
  }

  SH.openGate = openGate;

  function buildSignInButton() {
    var act = document.querySelector('.bar-act');
    if (!act || document.getElementById('ksat-signin')) return;

    var b = el('button', 'btn sm ksat-signin', 'Researcher sign in');
    b.id = 'ksat-signin';
    b.type = 'button';

    if (!haveDb()) {
      /* No database configured. The public tier still renders completely;
         we say so plainly rather than offering a control that cannot
         work. The demo is never worse than it was. */
      b.textContent = 'Sign in — database not connected';
      b.disabled = true;
      b.title = 'js/config.js has no Supabase project configured.';
    } else {
      b.addEventListener('click', function () { openGate(b); });
    }

    act.appendChild(b);
    signInBtn = b;
    /* The tier may already have been applied before this button existed
       (the identity bar arrives asynchronously), so settle it now rather
       than waiting for the next tier change. */
    b.hidden = root.getAttribute('data-ksat-tier') === 'insider';
  }

  /* Watch <body> for the two elements the integration layer appends. */
  function watchBody() {
    function scan() {
      var g = document.getElementById('ksat-gate');
      if (g && !gateOpen && g.parentNode === document.body) captureGate(g);

      var who = document.getElementById('ksat-whoami');
      var act = document.querySelector('.bar-act');
      if (who && act && who.parentNode !== act) {
        /* Identity belongs in the header, replacing the sign-in control. */
        var btn = document.getElementById('ksat-signin');
        if (btn) btn.remove();
        signInBtn = null;
        act.appendChild(who);
      }
    }
    scan();
    try {
      new MutationObserver(scan).observe(document.body, { childList: true });
    } catch (e) {}
  }

  /* ===================================================================
     7 · THE CHAPTER RAIL

     Honest navigation, not an ARIA tablist: a chapter is 3-6 sibling
     sections with no wrapper element, and inventing one would mean
     moving DOM. So this is <nav> with real <a href="#id"> links, which
     is also what makes the no-JS fallback correct.
     =================================================================== */

  var rail = null, railList = null, live = null, fab = null, sheet = null, sheetList = null;

  function lockCount(c) {
    if (root.getAttribute('data-ksat-tier') === 'insider') return 0;
    var n = 0;
    c.ids.forEach(function (id) { if (isInsiderSection(id) && sec(id)) n++; });
    return n;
  }

  function buildRail() {
    if (document.getElementById('ksat-ch-rail')) return;

    rail = el('div', null);
    rail.id = 'ksat-ch-rail';

    var skip = el('a', 'ksat-ch-skip', 'Skip to chapter content');
    skip.href = '#' + CHAPTERS[0].ids[0];
    rail.appendChild(skip);

    var nav = el('nav', 'ksat-ch-nav');
    nav.setAttribute('aria-label', 'Site chapters');

    var head = el('div', 'ksat-ch-head', 'Chapters');
    nav.appendChild(head);

    railList = el('div', 'ksat-ch-list');
    nav.appendChild(railList);

    CHAPTERS.forEach(function (c, i) {
      var a = el('a', 'ksat-ch-item');
      a.href = '#' + c.ids[0];
      a.setAttribute('data-ksat-key', c.key);
      a.setAttribute('tabindex', i === 0 ? '0' : '-1');

      a.appendChild(el('span', 'ksat-ch-num', String(i + 1)));

      var body = el('span', 'ksat-ch-body');
      body.appendChild(el('span', 'ksat-ch-en', c.en));
      var arn = el('span', 'ksat-ch-ar', c.ar);
      arn.setAttribute('dir', 'rtl');
      arn.setAttribute('lang', 'ar');
      body.appendChild(arn);
      a.appendChild(body);

      var lock = el('span', 'ksat-ch-lock', '');
      lock.setAttribute('data-ksat-lockfor', c.key);
      a.appendChild(lock);

      a.addEventListener('click', function (e) {
        e.preventDefault();
        openChapter(c.key, { scroll: true, focus: true });
      });
      a.addEventListener('keydown', onRailKey);

      railList.appendChild(a);
    });

    /* "Continuous scroll" is both the accessibility fallback and the
       proof that nothing was removed: it restores the original
       6,000-line page exactly. It is also what you use on stage if any
       canvas mis-measures. */
    var toggle = el('button', 'ksat-ch-toggle', 'Continuous scroll');
    toggle.type = 'button';
    toggle.setAttribute('aria-pressed', 'false');
    toggle.addEventListener('click', function () {
      setNav(!navOn ? true : false);
    });
    nav.appendChild(toggle);

    var note = el('p', 'ksat-ch-note',
      'All 24 sections are present. Chapters only change what is on screen.');
    nav.appendChild(note);

    rail.appendChild(nav);

    live = el('div', 'ksat-ch-live');
    live.setAttribute('role', 'status');
    live.setAttribute('aria-live', 'polite');
    rail.appendChild(live);

    document.body.appendChild(rail);

    buildSheet();
    paintRailLocks();
  }

  function paintRailLocks() {
    if (!railList) return;
    CHAPTERS.forEach(function (c) {
      var n = lockCount(c);
      var node = railList.querySelector('[data-ksat-lockfor="' + c.key + '"]');
      if (!node) return;
      node.textContent = n ? (String(n) + ' locked') : '';
      var item = node.closest('.ksat-ch-item');
      if (item) item.setAttribute('data-ksat-haslock', n ? 'yes' : 'no');
    });
    if (sheetList) paintSheet();
  }

  /* Roving tabindex: the rail is ONE tab stop. Arrow keys move between
     chapters, and the direction INVERTS under RTL — the page is
     bilingual and html[lang="ar"] already flips layout at index.html:499,
     so a hard-coded Left = previous would be backwards in Arabic. */
  function onRailKey(e) {
    var items = Array.prototype.slice.call(railList.querySelectorAll('.ksat-ch-item'));
    var i = items.indexOf(e.currentTarget);
    if (i === -1) return;
    var fwd = isRTL() ? 'ArrowLeft' : 'ArrowRight';
    var back = isRTL() ? 'ArrowRight' : 'ArrowLeft';
    var next = -1;

    if (e.key === fwd || e.key === 'ArrowDown') next = Math.min(items.length - 1, i + 1);
    else if (e.key === back || e.key === 'ArrowUp') next = Math.max(0, i - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openChapter(e.currentTarget.getAttribute('data-ksat-key'), { scroll: true, focus: true });
      return;
    } else return;

    e.preventDefault();
    items.forEach(function (n, k) { n.setAttribute('tabindex', k === next ? '0' : '-1'); });
    items[next].focus();
  }

  /* ===================================================================
     8 · PHONE PORTRAIT  —  one button and a bottom sheet

     Not a second horizontal strip: the page already has a horizontally
     scrolling .navwrap that shrinks at <=700px (index.html:629), and two
     competing swipe targets in 44px of screen is not navigation.

     The sheet is the one place a focus trap is correct, because it
     genuinely is a modal.
     =================================================================== */

  function buildSheet() {
    fab = el('button', null, '');
    fab.id = 'ksat-ch-fab';
    fab.type = 'button';
    fab.setAttribute('aria-haspopup', 'dialog');
    fab.setAttribute('aria-expanded', 'false');
    fab.addEventListener('click', function () { openSheet(); });
    document.body.appendChild(fab);

    sheet = el('div', null);
    sheet.id = 'ksat-ch-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-label', 'Site chapters');
    sheet.hidden = true;

    var inner = el('div', 'ksat-sheet-in');
    var top = el('div', 'ksat-sheet-top');
    top.appendChild(el('span', 'ksat-sheet-title', 'Chapters'));
    var x = el('button', 'ksat-sheet-x', 'Close');
    x.type = 'button';
    x.addEventListener('click', function () { closeSheet(); });
    top.appendChild(x);
    inner.appendChild(top);

    sheetList = el('div', 'ksat-sheet-list');
    inner.appendChild(sheetList);
    sheet.appendChild(inner);

    sheet.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.stopPropagation(); closeSheet(); return; }
      if (e.key !== 'Tab') return;
      var f = sheet.querySelectorAll('button, a[href]');
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    sheet.addEventListener('mousedown', function (e) { if (e.target === sheet) closeSheet(); });

    document.body.appendChild(sheet);
    paintSheet();
  }

  /* The sheet lists the six chapters and, under the open one, its
     sections — so a five-section chapter is still ONE tap from #orbit
     rather than a scroll. It doubles as the mobile find-a-section box. */
  function paintSheet() {
    if (!sheetList) return;
    sheetList.textContent = '';

    CHAPTERS.forEach(function (c, i) {
      var row = el('button', 'ksat-sheet-ch');
      row.type = 'button';
      row.setAttribute('data-ksat-key', c.key);
      if (c.key === openKey) row.setAttribute('aria-current', 'true');

      row.appendChild(el('span', 'ksat-sheet-n', String(i + 1)));
      row.appendChild(el('span', 'ksat-sheet-name', c.en));
      var n = lockCount(c);
      if (n) row.appendChild(el('span', 'ksat-sheet-lock', String(n) + ' locked'));
      row.addEventListener('click', function () {
        openChapter(c.key, { scroll: true, focus: true });
        closeSheet();
      });
      sheetList.appendChild(row);

      if (c.key !== openKey) return;

      var sub = el('div', 'ksat-sheet-subs');
      c.ids.forEach(function (id) {
        if (!sec(id)) return;
        var b = el('button', 'ksat-sheet-sub');
        b.type = 'button';
        b.appendChild(el('span', null, sectionLabel(id)));
        if (isInsiderSection(id) && root.getAttribute('data-ksat-tier') === 'public') {
          b.appendChild(el('span', 'ksat-sheet-sublock', 'locked'));
        }
        b.addEventListener('click', function () {
          closeSheet();
          goToSection(id);
        });
        sub.appendChild(b);
      });
      sheetList.appendChild(sub);
    });

    var cur = CH_BY_KEY[openKey];
    var idx = CHAPTERS.indexOf(cur) + 1;
    if (fab) fab.textContent = 'Ch ' + idx + '/' + CHAPTERS.length + ' · ' + cur.en;
  }

  /* The section's own <h2 class="st"> is the honest label, and it is
     whatever the real data puts there later. Harvested, never hard-coded. */
  function sectionLabel(id) {
    var s = sec(id);
    if (!s) return id;
    var h = s.querySelector('h2.st') || s.querySelector('h1') || s.querySelector('h2');
    var t = h ? (h.textContent || '').trim() : '';
    if (!t) t = id;
    return t.length > 58 ? t.slice(0, 56) + '…' : t;
  }

  var sheetTrigger = null;
  function openSheet() {
    if (!sheet || !sheet.hidden) return;
    sheetTrigger = document.activeElement;
    paintSheet();
    sheet.hidden = false;
    if (fab) fab.setAttribute('aria-expanded', 'true');
    var f = sheet.querySelector('button');
    if (f) setTimeout(function () { f.focus(); }, 30);
  }
  function closeSheet() {
    if (!sheet || sheet.hidden) return;
    sheet.hidden = true;
    if (fab) fab.setAttribute('aria-expanded', 'false');
    if (sheetTrigger && document.contains(sheetTrigger)) sheetTrigger.focus();
    else if (fab) fab.focus();
    sheetTrigger = null;
  }

  /* ===================================================================
     9 · OPENING A CHAPTER
     =================================================================== */

  function stamp() {
    CHAPTERS.forEach(function (c) {
      c.ids.forEach(function (id) {
        var s = sec(id);
        if (!s) return;                                  // no-op safely
        s.setAttribute('data-ksat-ch', c.key);
        var inv = document.getElementById('ksat-invite-' + id);
        if (inv) inv.setAttribute('data-ksat-ch', c.key);
      });
    });
  }

  function setHidden(node, hide) {
    if (!node) return;
    if (!hide) { node.removeAttribute('hidden'); return; }
    if (UNTIL_FOUND) node.setAttribute('hidden', 'until-found');
    else node.setAttribute('hidden', '');
  }

  function openChapter(key, opts) {
    opts = opts || {};
    if (!CH_BY_KEY[key]) return;
    var changed = (key !== openKey);
    openKey = key;

    if (!navOn) { /* continuous scroll: nothing is hidden */ }
    else {
      CHAPTERS.forEach(function (c) {
        var hide = (c.key !== key);
        c.ids.forEach(function (id) {
          setHidden(sec(id), hide);
          setHidden(document.getElementById('ksat-invite-' + id), hide);
        });
      });
    }

    root.setAttribute('data-ksat-open', key);

    if (railList) {
      Array.prototype.forEach.call(railList.querySelectorAll('.ksat-ch-item'), function (a) {
        var on = a.getAttribute('data-ksat-key') === key;
        a.setAttribute('aria-current', on ? 'true' : 'false');
        a.setAttribute('tabindex', on ? '0' : '-1');
      });
    }
    paintSheet();

    /* Reveal ALWAYS dispatches resize. This is the verified mechanism for
       re-measuring every canvas that was hidden. */
    if (navOn) nudgeRedraw();

    if (opts.focus) focusChapterStart(key);
    if (opts.scroll) scrollToId(firstVisibleId(key));
    if (changed && !opts.silent) announce(key);
    if (!opts.silent) pushHash(firstVisibleId(key), opts.replace);
  }

  function firstVisibleId(key) {
    var c = CH_BY_KEY[key];
    for (var i = 0; i < c.ids.length; i++) if (sec(c.ids[i])) return c.ids[i];
    return c.ids[0];
  }

  function focusChapterStart(key) {
    var id = firstVisibleId(key);
    var s = sec(id);
    if (!s) return;
    /* Point the section's runtime aria-labelledby at its own heading, so
       the focus move announces the real heading rather than "section". */
    var h = s.querySelector('h2.st') || s.querySelector('h1');
    if (h) {
      if (!h.id) h.id = 'ksat-h-' + id;
      s.setAttribute('aria-labelledby', h.id);
    }
    s.setAttribute('tabindex', '-1');
    try { s.focus({ preventScroll: true }); } catch (e) { try { s.focus(); } catch (e2) {} }
    s.addEventListener('blur', function onb() {
      s.removeAttribute('tabindex');            // never a phantom tab stop
      s.removeEventListener('blur', onb);
    });
  }

  function announce(key) {
    if (!live) return;
    var c = CH_BY_KEY[key];
    var i = CHAPTERS.indexOf(c) + 1;
    var n = c.ids.filter(function (id) { return !!sec(id); }).length;
    clearTimeout(announce._t);
    announce._t = setTimeout(function () {
      live.textContent = c.en + '. Chapter ' + i + ' of ' + CHAPTERS.length + ', ' + n + ' sections.';
    }, 220);                                    // debounced for arrow traversal
  }

  function scrollToId(id) {
    var target = null;
    /* A locked section has no box in the public tier. Land on its
       invitation panel instead: intent preserved, no dead click. */
    if (isInsiderSection(id) && root.getAttribute('data-ksat-tier') === 'public') {
      target = document.getElementById('ksat-invite-' + id);
    }
    if (!target) target = sec(id);
    if (!target) return;
    try { void target.offsetTop; } catch (e) {}

    /* LAND ON THE CONTENT, NOT ON THE PADDING.
       Sections carry a large top padding - that air is what makes the
       page read as an agency document rather than a dashboard. But
       scrollIntoView on the SECTION lands at the top of that padding,
       so arriving from the nav put the first heading 284px down a 630px
       viewport: nearly half the screen empty, which reads as a broken
       link rather than as generous spacing.

       Scrolling to the section's own eyebrow or heading instead keeps
       the air when a reader scrolls naturally, and puts the content
       where they expect it when they navigate. */
    var anchor = target.querySelector('.eyebrow, h2, h3') || target;
    try {
      anchor.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
    } catch (e) { anchor.scrollIntoView(); }
  }

  function pushHash(id, replace) {
    try {
      var h = '#' + id;
      if (location.hash === h) return;
      if (replace) history.replaceState(null, '', h);
      else history.pushState(null, '', h);
    } catch (e) {}
  }

  /* Open whichever chapter owns a section, then land on it. This is the
     single entry point every cross-chapter jump funnels into. */
  function goToSection(id, opts) {
    opts = opts || {};
    var key = CH_OF[id];
    if (!key) return false;
    if (navOn && key !== openKey) openChapter(key, { silent: true });

    var locked = isInsiderSection(id) && root.getAttribute('data-ksat-tier') === 'public';
    if (locked) {
      var lead = document.getElementById('ksat-invite-lead-' + id);
      var copy = PANELS[id];
      if (lead && copy) {
        lead.textContent = 'You were heading for the ' + copy.t.toLowerCase() + '.';
        lead.hidden = false;
      }
      var h = document.getElementById('ksat-invite-h-' + id);
      if (h && !opts.noFocus) setTimeout(function () { try { h.focus(); } catch (e) {} }, 60);
    }

    scrollToId(id);
    if (!opts.silent) pushHash(id, true);
    return true;
  }

  SH.goToSection = goToSection;
  SH.openChapterFor = function (id) { var k = CH_OF[id]; if (k) openChapter(k, { silent: true }); };

  /* ===================================================================
     10 · REACHABILITY  —  every existing jump keeps working

     index.html has seven cross-chapter jumps built before chapters
     existed: #heroSim -> #simulate (4323), #rpSim / #rpAsk (3109-3110),
     #simToAgent / #simToCalc (3188-3189), goDemo()'s guided tour (4255)
     and the footer #ftNav anchors (1664). All of them call
     scrollIntoView on an element that may now be hidden, where it is a
     SILENT no-op. One patch fixes all seven, from outside.
     =================================================================== */

  function patchScrollIntoView() {
    if (Element.prototype.scrollIntoView.__ksatPatched) return;
    var native = Element.prototype.scrollIntoView;

    var patched = function () {
      try {
        var s = this.closest ? this.closest('section.sec') : null;
        if (s && s.id) {
          var hiddenByChapter = s.hasAttribute('hidden');
          var lockedByTier = s.classList.contains('ksat-locked') &&
                             root.getAttribute('data-ksat-tier') === 'public';
          if (hiddenByChapter) {
            var k = CH_OF[s.id];
            if (k && k !== openKey) openChapter(k, { silent: true });
          }
          if (lockedByTier) {
            /* The section itself has no box. Redirect to its invitation
               panel so the click means something. */
            var inv = document.getElementById('ksat-invite-' + s.id);
            if (inv) {
              goToSection(s.id, { silent: true });
              return;
            }
          }
        }
      } catch (e) {}
      return native.apply(this, arguments);
    };
    patched.__ksatPatched = true;
    Element.prototype.scrollIntoView = patched;
  }

  /* Real href="#id" anchors (the footer #ftNav) never call
     scrollIntoView at all, so they need their own delegated handler. */
  function patchAnchors() {
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null;
      if (!a) return;
      if (a.classList.contains('ksat-ch-item') || a.classList.contains('ksat-ch-skip')) return;
      var id = a.getAttribute('href').slice(1);
      if (!id || !CH_OF[id]) return;
      e.preventDefault();
      goToSection(id);
    }, true);
  }

  /* Ctrl+F into a closed chapter: the browser fires beforematch on the
     hidden section, we open its chapter, and then let the browser finish
     its own scroll. */
  function wireBeforeMatch() {
    if (!UNTIL_FOUND) return;
    CHAPTERS.forEach(function (c) {
      c.ids.forEach(function (id) {
        var s = sec(id);
        if (!s) return;
        s.addEventListener('beforematch', function () {
          if (CH_OF[id] !== openKey) openChapter(CH_OF[id], { silent: true });
        });
      });
    });
  }

  function wireHistory() {
    function fromHash() {
      var id = (location.hash || '').slice(1);
      if (!id) return;
      if (CH_OF[id]) goToSection(id, { silent: true, noFocus: true });
    }
    window.addEventListener('popstate', fromHash);
    window.addEventListener('hashchange', fromHash);
  }

  /* ===================================================================
     11 · CONTINUOUS SCROLL  —  the escape hatch and the proof
     =================================================================== */

  function setNav(on) {
    navOn = !!on;
    root.setAttribute('data-ksat-nav', navOn ? 'on' : 'off');
    try { localStorage.setItem('ksat_nav', navOn ? 'on' : 'off'); } catch (e) {}

    var t = rail ? rail.querySelector('.ksat-ch-toggle') : null;
    if (t) {
      t.textContent = navOn ? 'Continuous scroll' : 'Back to chapters';
      t.setAttribute('aria-pressed', navOn ? 'false' : 'true');
    }

    if (!navOn) {
      /* Restore the original page exactly: every section visible, no
         hidden attribute anywhere we put one. */
      CHAPTERS.forEach(function (c) {
        c.ids.forEach(function (id) {
          setHidden(sec(id), false);
          setHidden(document.getElementById('ksat-invite-' + id), false);
        });
      });
      nudgeRedraw();
      if (live) live.textContent = 'Continuous scroll. All 24 sections shown.';
    } else {
      openChapter(openKey, { silent: true });
    }
  }

  function openRail() {
    if (!rail) return;
    rail.setAttribute('data-ksat-peek', 'on');
    setTimeout(function () { rail.removeAttribute('data-ksat-peek'); }, 4200);
  }

  /* ===================================================================
     12 · BOOT

     WHY WE WAIT. The page's canvases measure clientWidth at init
     (fit(), index.html:1996, falls back to parentElement.clientWidth,
     which is 0 while hidden). Hiding a section BEFORE the prototype has
     booted produces zero-width canvases. So: the tier ATTRIBUTE is set
     synchronously — no flash of the wrong chrome — but the CSS that
     actually hides anything is gated on data-ksat-shell="ready", which
     is set only once init() has run and every canvas has measured at
     full width. The launch-countdown intro covers this on a first visit.
     =================================================================== */

  root.setAttribute('data-ksat-tier', 'public');   // public-first, deliberately
  root.setAttribute('data-ksat-nav', 'off');

  function pageIsUp() {
    /* init() -> bind() -> applyLang() -> renderNav() fills #nav. When it
       has buttons, the prototype has rendered and measured. */
    var n = document.getElementById('nav');
    return !!(n && n.children.length);
  }

  function start() {
    watchBody();
    buildSignInButton();
    buildAllPanels();
    buildHeroNote();
    stamp();
    buildRail();
    patchScrollIntoView();
    patchAnchors();
    wireBeforeMatch();
    wireHistory();

    root.setAttribute('data-ksat-shell', 'ready');

    var want = 'on';
    try { want = localStorage.getItem('ksat_nav') || 'on'; } catch (e) {}

    /* Deep link decides the opening chapter. Native hash scrolling has
       already fired against a still-visible page, so we resolve it
       ourselves after the chapters go on. */
    var hashId = (location.hash || '').slice(1);
    if (hashId && CH_OF[hashId]) openKey = CH_OF[hashId];

    setNav(want !== 'off');

    if (hashId && CH_OF[hashId]) {
      setTimeout(function () { goToSection(hashId, { silent: true, noFocus: true }); }, 80);
    }

    wireTier();
  }

  /* The tier comes from the session and from nothing else. */
  function wireTier() {
    if (!haveDb()) { applyTier('public'); return; }

    window.sb.auth.getSession().then(function (r) {
      applyTier(r && r.data && r.data.session ? 'insider' : 'public');
    }).catch(function () { applyTier('public'); });

    try {
      window.sb.auth.onAuthStateChange(function (evt, session) {
        applyTier(session ? 'insider' : 'public');
        if (session) closeGate();
      });
    } catch (e) {}
  }

  function boot() {
    var tries = 0;
    var t = setInterval(function () {
      if (pageIsUp() || ++tries > 60) {     // ~9 s ceiling, then go anyway
        clearInterval(t);
        try { start(); } catch (e) { console.warn('[ksat-shell]', e); }
      }
    }, 150);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})();
