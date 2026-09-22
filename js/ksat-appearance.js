/* =====================================================================
   ksat-appearance.js — THE THEME CONTROL, AND THE EDITORIAL/WORKSPACE
   SPLIT
   Owner: 01 Front End.  Companion to css/ksat-nasa.css.

   ---------------------------------------------------------------------
   WHY THIS FILE EXISTS
   ---------------------------------------------------------------------
   Two things the page had no way to express, and both of them are
   ATTRIBUTES rather than behaviour. CSS cannot ask "what did this
   visitor choose" and it cannot ask "is this section a dashboard or an
   essay", so something has to write the answer onto the DOM and then
   get out of the way. That is all this file does. Every visual
   consequence lives in css/ksat-nasa.css.

     html[data-theme]           "light" | "dark"   — the RESOLVED theme
     html[data-theme-choice]    "light" | "dark" | "system"
     section[data-ksat-layer]   "workspace"        — on the tool sections

   ---------------------------------------------------------------------
   THE NAME COLLISION, STATED UP FRONT BECAUSE IT WILL CATCH SOMEBODY
   ---------------------------------------------------------------------
   js/ksat-theme.js is NOT a theme switch and never was. It is a
   CanvasRenderingContext2D fillStyle/strokeStyle intercept that
   retranslates a handful of hard-coded brand hexes on their way into
   the canvas. It is called "theme" because it follows css/ksat-theme.css.
   This file is the actual light/dark control. The two cooperate: this
   one flips the attribute, that one re-reads the live accent token and
   repaints the canvases to match.

   ---------------------------------------------------------------------
   WHAT IT DELIBERATELY DOES NOT DO
   ---------------------------------------------------------------------
   · It does not add, remove, reorder or reword any page content.
   · It does not default to the operating system setting. The site's
     identity is the near-black mission ground, and a visitor whose
     laptop happens to be in light mode should not be shown a white
     KuwaitSat on their first visit and left wondering whether something
     failed to load. DARK is the default; "system" is one of the three
     states and it is an explicit choice. See THE DEFAULT below.
   · It runs no animation loop of its own, so there is nothing here for
     prefers-reduced-motion to switch off. The one transition the
     control has is declared — and disabled under reduced motion — in
     css/ksat-nasa.css.
   · If anything it depends on is missing, every step is skipped
     silently and the page behaves exactly as it did before.
   ===================================================================== */

(function () {
  'use strict';

  var KS = window.KSAT = window.KSAT || {};
  if (KS.appearance) { return; }

  var root = document.documentElement;
  if (!root) { return; }

  /* -------------------------------------------------------------------
     1 · STORAGE

     Same family as ksat.lang, which js/ksat-i18n.js already writes, and
     as ksat_nav in js/ksat-shell.js. localStorage is wrapped every time:
     Safari in private mode throws on setItem rather than failing quietly,
     and an exception here would take the whole boot down with it.
     ------------------------------------------------------------------- */
  var KEY = 'ksat.theme';
  var CHOICES = { light: 1, dark: 1, system: 1 };

  function readChoice() {
    var v = null;
    try { v = localStorage.getItem(KEY); } catch (e) { /* storage denied */ }
    return (v && CHOICES[v]) ? v : null;
  }

  function writeChoice(choice) {
    try { localStorage.setItem(KEY, choice); } catch (e) { /* storage denied */ }
  }

  /* -------------------------------------------------------------------
     2 · THE DEFAULT

     Dark, not system. This is a deliberate departure from the usual
     advice and the reason is the product rather than the pattern: this
     page opens on a full-screen launch sequence over black and a
     cinematic hero over black, and both of those stay black in light
     mode because they are pictures of space. A visitor arriving in
     "system → light" would therefore meet a white masthead wrapped
     round a black title card before they had chosen anything. Dark
     first, and the control is right there in the masthead.
     ------------------------------------------------------------------- */
  var DEFAULT_CHOICE = 'dark';

  function systemPrefersLight() {
    try {
      return window.matchMedia &&
             window.matchMedia('(prefers-color-scheme: light)').matches;
    } catch (e) { return false; }
  }

  function resolve(choice) {
    if (choice === 'light') { return 'light'; }
    if (choice === 'dark') { return 'dark'; }
    return systemPrefersLight() ? 'light' : 'dark';
  }

  /* -------------------------------------------------------------------
     3 · APPLYING IT

     BEFORE FIRST PAINT, IF THE TAG ALLOWS IT. This runs at the moment
     the script executes, not at DOMContentLoaded, so if the <script>
     lands in <head> the attribute is on <html> before the body is even
     parsed and there is no flash at all. If the tag is instead added to
     the block of scripts at the foot of <body> — where every other
     script on this page lives — the browser will already have painted
     several screenfuls of a 496KB document by then, and a visitor whose
     stored choice is "light" will see a dark flash first. That is not a
     bug in this file and it cannot be fixed from here; it is a property
     of where the tag goes. The handoff for this change asks for <head>.
     ------------------------------------------------------------------- */
  var current = { choice: null, theme: null };

  function paintDocument(choice, theme) {
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-theme-choice', choice);
    current.choice = choice;
    current.theme = theme;
  }

  function announce() {
    /* js/ksat-theme.js listens for this and re-reads --accent-canvas off
       :root, then repaints the 26 canvases so the charts agree with the
       page. Anything else that caches a colour can listen too. The event
       is on `document` because that is where ksat:lang, ksat:chapter and
       ksat:identity already are. */
    try {
      document.dispatchEvent(new CustomEvent('ksat:theme', {
        detail: { choice: current.choice, theme: current.theme }
      }));
    } catch (e) { /* no CustomEvent constructor; nothing to announce to */ }
  }

  function apply(choice, persist) {
    if (!CHOICES[choice]) { choice = DEFAULT_CHOICE; }
    var theme = resolve(choice);
    var changed = (choice !== current.choice) || (theme !== current.theme);

    paintDocument(choice, theme);
    if (persist) { writeChoice(choice); }
    paintControl();
    if (changed) { announce(); }
  }

  /* Boot state, applied immediately. */
  apply(readChoice() || DEFAULT_CHOICE, false);

  /* The operating system can change under us — a scheduled night shift,
     or somebody toggling it while the page is open. That only matters
     while the CHOICE is "system"; an explicit light or dark is an
     instruction and must not be overridden by the machine. */
  (function watchSystem() {
    var mq;
    try { mq = window.matchMedia('(prefers-color-scheme: light)'); }
    catch (e) { return; }
    if (!mq) { return; }

    function onChange() {
      if (current.choice === 'system') { apply('system', false); }
    }
    /* addEventListener on a MediaQueryList is the modern form; addListener
       is the only one older WebKit has. Feature-check rather than assume. */
    if (mq.addEventListener) { mq.addEventListener('change', onChange); }
    else if (mq.addListener) { mq.addListener(onChange); }
  })();


  /* -------------------------------------------------------------------
     4 · THE STRINGS

     js/ksat-i18n.js is not ours to edit in this pass, so the labels live
     here in the shape that file uses. They are exported on
     KSAT.appearance.strings so they can be folded into the shared
     catalogue later without being retyped.
     ------------------------------------------------------------------- */
  var STRINGS = {
    'ksat.appearance':        { en: 'Appearance',   ar: 'المظهر' },
    'ksat.appearance.light':  { en: 'Light',        ar: 'فاتح' },
    'ksat.appearance.dark':   { en: 'Dark',         ar: 'داكن' },
    'ksat.appearance.system': { en: 'System',       ar: 'حسب النظام' }
  };

  function lang() {
    var v = root.getAttribute('data-ksat-lang') || root.lang || 'en';
    return v.toLowerCase().indexOf('ar') === 0 ? 'ar' : 'en';
  }

  function t(key) {
    var s = STRINGS[key];
    if (!s) { return key; }
    return s[lang()] || s.en;
  }


  /* -------------------------------------------------------------------
     5 · THE CONTROL

     Built here so index.html gains no markup, which is the same bargain
     js/ksat-i18n.js struck for the EN/AR switch.

     It carries BOTH classes: `ksat-appearance` for the few rules that
     are its own, and `lang ksat-lang` so that every rule already written
     for the language switch — the hairline group in css/ksat-theme.css,
     the square corners css/ksat-agency.css forces, the focus ring
     css/ksat-detail.css gives it — applies without being restated. Two
     controls that look identical should not be described twice.

     The glyphs are inline SVG: sun, moon, half disc. Three words would
     not fit a masthead that already carries fourteen navigation items
     and a signed-in identity, so the whole word goes on aria-label and
     title instead, in the current language, and is re-written when the
     language changes.
     ------------------------------------------------------------------- */
  var ICONS = {
    light:
      '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
      '<circle cx="8" cy="8" r="3.1"/>' +
      '<path d="M8 1v1.6M8 13.4V15M1 8h1.6M13.4 8H15' +
      'M3.05 3.05l1.13 1.13M11.82 11.82l1.13 1.13' +
      'M12.95 3.05l-1.13 1.13M4.18 11.82l-1.13 1.13"/></svg>',
    dark:
      '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
      '<path d="M13.2 9.9A5.6 5.6 0 0 1 6.1 2.8 5.6 5.6 0 1 0 13.2 9.9Z"/></svg>',
    system:
      '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
      '<circle cx="8" cy="8" r="5.7"/>' +
      '<path class="ks-half" d="M8 2.3a5.7 5.7 0 0 1 0 11.4Z"/></svg>'
  };

  var ORDER = ['light', 'dark', 'system'];
  var control = null;

  function buildControl() {
    var act = document.querySelector('.bar-act');
    if (!act || document.getElementById('ksat-appearance')) { return; }

    var wrap = document.createElement('div');
    wrap.id = 'ksat-appearance';
    wrap.className = 'lang ksat-lang ksat-appearance';
    wrap.setAttribute('role', 'group');

    ORDER.forEach(function (choice) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('data-theme-set', choice);
      /* Static markup, no interpolation of anything a user supplied. */
      b.innerHTML = ICONS[choice];
      b.addEventListener('click', function () { apply(choice, true); });
      wrap.appendChild(b);
    });

    place(act, wrap);
    control = wrap;
    paintControl();
  }

  /* AFTER the language switch, never before it.
     Position is not only visual here. js/ksat-i18n.js finds its own
     control by id, but anything written later that reaches for
     `.ksat-lang` with querySelector would get whichever comes FIRST in
     the document — and since this control borrows that class, putting it
     ahead of the real one would hand a future maintainer the wrong
     element with no error to explain it. */
  function place(act, wrap) {
    var langSwitch = document.getElementById('ksat-lang');
    if (langSwitch && langSwitch.parentNode === act) {
      act.insertBefore(wrap, langSwitch.nextSibling);
      return;
    }
    var signin = document.getElementById('ksat-signin');
    if (signin && signin.parentNode === act) { act.insertBefore(wrap, signin); return; }
    act.appendChild(wrap);
  }

  function paintControl() {
    if (!control) { return; }
    control.setAttribute('aria-label', t('ksat.appearance'));
    var buttons = control.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      var choice = b.getAttribute('data-theme-set');
      var label = t('ksat.appearance.' + choice);
      b.setAttribute('aria-pressed', choice === current.choice ? 'true' : 'false');
      b.setAttribute('aria-label', label);
      b.setAttribute('title', label);
    }
  }


  /* -------------------------------------------------------------------
     6 · EDITORIAL vs WORKSPACE

     The page is 23 sections in one <main>, and until now every one of
     them was handed the same treatment: a 72px headline and 132px of
     section padding, whether it was a manifesto or a chart with six
     dropdowns above it.

     The split is declared here as data, applied as one attribute, and
     styled entirely in css/ksat-nasa.css. Changing which side a section
     falls on is a one-line edit to the array below and no CSS at all.
     ------------------------------------------------------------------- */
  var WORKSPACE = [
    /* Named in the spec as workspace, and unambiguous: every one of
       these is an instrument with controls, a canvas or a live readout. */
    'console',     /* the research brief and the agent rail             */
    'explorer',    /* the imagery viewer: pan, zoom, layers, epochs     */
    'dashboard',   /* KPI tiles and four charts                         */
    'map',         /* the choropleth and the region inspector           */
    'simulate',    /* the before/after simulator                        */
    'ai',          /* the model panel                                   */
    'agent',       /* the agent run log                                 */

    /* A JUDGEMENT CALL, recorded as one. The spec names the seven above
       as workspace and names twelve others as editorial; these three are
       in neither list. Every one of them is a row of selects over a
       canvas — the impact calculator, the reference-data charts, the
       change-detection wipe — which is the definition of the workspace
       register, so they go here. If that is wrong, delete the three
       lines and nothing else changes. */
    'impact',
    'charts',
    'compare'
  ];

  /* DELIBERATELY EDITORIAL, listed so the reasoning survives:
     top, legend, mission, builders, imagery, globe, orbit, story,
     vision, trust, sources, finale — and `system`, which is not in
     either of the spec's lists but is prose about how the platform
     works rather than an instrument you operate. */

  function markSections() {
    var marked = 0;
    for (var i = 0; i < WORKSPACE.length; i++) {
      var el = document.getElementById(WORKSPACE[i]);
      if (!el) { continue; }               /* a section that is not there */

      /* index.html carries ONE duplicate id: "explorer" is on both the
         <section> at line 1184 and the viewer <div> inside it at 1192.
         getElementById returns the first in document order, which is the
         section, so this is right today — but a reorder would silently
         hand us the canvas box instead and the workspace skin would be
         applied to a 500px image viewer. Check what we were given rather
         than trust an id that is not unique. */
      if (el.tagName !== 'SECTION') { continue; }

      if (el.getAttribute('data-ksat-layer') === 'workspace') { continue; }
      el.setAttribute('data-ksat-layer', 'workspace');
      marked++;
    }
    return marked;
  }


  /* -------------------------------------------------------------------
     7 · BOOT

     The theme is already applied — that happened at the top of the file,
     synchronously, which is the whole point. What is left needs the DOM:
     the masthead to hang the control on, and the sections to mark.

     js/ksat-shell.js builds part of the masthead asynchronously and
     js/ksat-i18n.js inserts the language switch on its own schedule, so
     .bar-act can exist before the switch does. Rather than race it, we
     poll briefly for the container, then re-check on the two events the
     other layers already fire when the masthead settles.
     ------------------------------------------------------------------- */
  function start() {
    buildControl();
    markSections();

    /* Identity changes rebuild .bar-act, and the tier reveal brings ten
       more sections into view. Both are idempotent here. */
    document.addEventListener('ksat:identity', function () {
      setTimeout(function () { buildControl(); markSections(); }, 60);
    });

    /* Language changes rewrite most of the page; our labels go with it.
       This also runs after js/ksat-i18n.js has inserted its own switch,
       which is the moment `place()` finally has something to sit after. */
    document.addEventListener('ksat:lang', function () {
      if (!control) { buildControl(); return; }
      var act = document.querySelector('.bar-act');
      var langSwitch = document.getElementById('ksat-lang');
      /* If the language switch arrived after us, move behind it. */
      if (act && langSwitch && langSwitch.compareDocumentPosition &&
          (langSwitch.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_PRECEDING)) {
        act.insertBefore(control, langSwitch.nextSibling);
      }
      paintControl();
    });

    KS.appearance = {
      set: function (choice) { apply(choice, true); },
      choice: function () { return current.choice; },
      theme: function () { return current.theme; },
      sections: WORKSPACE.slice(),
      strings: STRINGS
    };
  }

  function boot() {
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (document.querySelector('.bar-act') || tries > 60) {
        clearInterval(iv);
        start();
      }
    }, 120);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
