/* =====================================================================
   ksat-tour.js — the guided tour, offered, spotlit, keyed and announced
   Owner: 01 Front End

   THE TOUR ALREADY EXISTS AND THIS FILE DOES NOT REPLACE IT.
   index.html carries the whole engine: the DEMO array, renderDemo(),
   goDemo(), the #demoHud / #demoPan markup and the three entry points —
   #demoBtn in the masthead, #heroTour in the hero, #finTour in the
   finale. All of that keeps working. Delete this file and
   css/ksat-tour.css and the tour is byte-for-byte what it was.

   NAMES, NOT LINE NUMBERS, AND THAT IS NOT A HOUSE-STYLE PREFERENCE.
   The first draft of this header cited index.html:4241 for the DEMO
   array, :4254 for renderDemo(), :4281 for goDemo() and :1743 for the
   HUD markup. Every one of those four was re-read on 2026-09-22 and
   every one of them now holds something else: 4241 is a line of agent
   charter prose, 4254 a security rule string, 4281 the head of a
   different array entirely, and 1743 is blank. index.html has moved
   several hundred lines during these passes and took every line
   citation in this file with it — sixteen of them, into index.html,
   js/ksat-shell.js and js/ksat-assistant.js, and not one still landed
   on the thing it named. Each is retired at the place it used to sit,
   with what that line holds now, so the next reader can tell a
   corrected citation from one nobody has checked yet. A name survives
   a file moving underneath it; a number does not, and a number that
   has quietly gone wrong is worse than no number at all, because a
   reader still trusts it and lands somewhere plausible.

   WHAT WAS MISSING, five things, all of them from outside:

   1 · IT WAS NEVER OFFERED. The brief was "a guided tour the user can go
       through or skip", and go-through-or-skip means somebody asks. The
       page had three click handlers and nothing that ever invited
       anyone. There is now a corner card on a first visit. It is not a
       modal: an institutional research platform does not get to trap a
       reader on arrival, and it must not fight the cinematic intro, so
       it waits for #intro to leave the DOM first.

   2 · A SKIP WAS NOT REMEMBERED. There was no tour key at all. The page
       already keeps ks_intro (session), ks_audio, ksat_nav and
       ksat.lang, so this one is ksat_tour, same family, same try/catch,
       holding 'done' or 'skipped'. Neither is re-offered. Nothing is
       taken away by remembering: all three entry points stay live and
       the finish card still offers "Run it again".

   3 · NOTHING WAS POINTED AT. goDemo() scrolls to the SECTION and runs
       the step's side effect 420 ms later. On the explorer step the
       sentence is "switch layers" and the layer chips are 40 px tall in
       a 900 px section, at the other end of the screen from the HUD
       doing the narrating. There is now a spotlight: the page dims, a
       hole is cut around the thing the step is about, and the hole
       tracks the target through the smooth scroll and through every
       later scroll and resize.

   4 · NO KEYBOARD. Spec section 19 asks for Esc to close, arrows to
       navigate, Enter to confirm. The hard part is not binding them, it
       is NOT STEALING THEM: this page has a range slider on the agent
       thresholds, #baHandle (the role="slider" before/after wipe handle
       in the imagery section), a roving-tabindex chapter rail, three
       text inputs and a sign-in form. Every one of those wants the same
       keys. See section 11.

       — the citation here used to read "index.html:4338", which today
       is the head of renderTrust(). "See onKey()" was the other half of
       the same sentence and there has never been a function called
       onKey() in this file; the handler is the anonymous listener in
       section 11.

   5 · NO ARIA. #demoHud had no role, no label, no live region, and
       focus was never moved into it or restored out of it — and worse,
       every press of Next destroyed the button that was focused, so a
       keyboard reader lost focus to <body> on every single step.

   HOW IT ATTACHES
   renderDemo() rewrites #demoPan.innerHTML on every step, so anything
   put inside #demoPan is destroyed by the next render. This file
   therefore watches #demoPan with a MutationObserver and keeps its own
   nodes OUTSIDE it — the same shape js/ksat-density.js and
   js/ksat-shell.js use for a page that rebuilds its own DOM.

   WHAT IS DELIBERATELY NOT DONE HERE
   The eleven steps are one script for everyone, and nine of them target
   sections a signed-out visitor cannot see, so a public visitor's tour
   is mostly the shell's invitation panels. Branching the step list means
   changing DEMO, which lives in index.html and belongs to another owner
   this phase. Mutating that array from out here at runtime would work
   until the day somebody adds a twelfth step, and then it would fail
   silently in front of a room. It is written up as a handoff instead.
   What this file does do is make the redirect legible: when a step lands
   on a locked section the spotlight follows the shell's own redirect to
   #ksat-invite-<id> and a strip above the HUD says why.
   ===================================================================== */

(function () {
  'use strict';

  var KS = window.KSAT = window.KSAT || {};
  if (KS.tour) return;

  var root = document.documentElement;
  var STORE = 'ksat_tour';          /* 'done' | 'skipped' — see ksat_nav */

  var hud = document.getElementById('demoHud');
  var pan = document.getElementById('demoPan');
  /* No HUD means no tour to upgrade. Every other layer in this codebase
     bails the same way rather than half-mounting. */
  if (!hud || !pan) return;

  /* ===================================================================
     1 · SMALL HELPERS.  textContent only, never innerHTML.

     Same rule as js/ksat-shell.js: every string this file writes is
     either ours or read back out of the page, and neither has any
     business being parsed as markup.
     =================================================================== */

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  function reduced() {
    /* Read at call time, not cached at load. index.html evaluates this
       once into its top-level `reduceMotion` const, so a reader who
       turns the OS setting on mid-session is not honoured there. Here
       they are. (This comment used to cite that const as ":1917", which
       is now a line of the spec table's data.) */
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (e) { return false; }
  }

  function lang() {
    var a = root.getAttribute('data-ksat-lang');
    if (a) return a === 'ar' ? 'ar' : 'en';
    return root.getAttribute('lang') === 'ar' ? 'ar' : 'en';
  }

  function isRTL() {
    return root.getAttribute('dir') === 'rtl' || root.getAttribute('lang') === 'ar';
  }

  function now() {
    try { return performance.now(); } catch (e) { return Date.now(); }
  }

  /* ===================================================================
     1b · WHERE THE MASTHEAD ENDS

     css/ksat-tour.css docks the offer card under the masthead, and to do
     that it needs the masthead's height. It cannot have it from CSS.

     --bar-h is the obvious candidate and it is not trustworthy for this.
     index.html declares it 58px, css/ksat-theme.css redeclares it 64px
     and then 101px above 860px, and it is supposed to move with the bar.
     Measured in Chrome at a 1424px viewport during this work:
     getComputedStyle(root)['--bar-h'] was '101px' while
     document.querySelector('.bar').getBoundingClientRect().height was
     180px — the bar had wrapped to a third row and the variable had
     stayed where it was. A card placed at calc(var(--bar-h) + 12px)
     starts at y=113 in that state, which is inside the masthead and on
     top of #demoBtn and #ksat-signin. Fixing an overlap by creating a
     different overlap is not a fix.

     So: measure the element, publish the number, let the stylesheet do
     the arithmetic. getBoundingClientRect().height rather than
     offsetHeight because it is fractional and does not round a 100.5px
     bar down into the card.

     Only ever written when the value CHANGES. Writing an inline style on
     <html> is an attribute mutation, and this page has several
     MutationObservers on the root element — this file has one of its own
     at section 10. Re-writing the same string on every scroll frame
     would be a mutation storm for no pixels.

     The bar is not sticky in the current build (css/ksat-detail.css sets
     `main, .bar, footer { position: relative }`, which overrides the
     `position: sticky` in index.html), so it scrolls away. That is fine
     and it is why this measures the bar's HEIGHT rather than where its
     bottom edge currently is on screen: the offer is only ever shown at
     the top of the page, where the two are the same number, and it must
     not then crawl up the screen as the reader scrolls.
     =================================================================== */

  var barEl = null;
  var dockPx = '';

  function dock() {
    if (!barEl || !document.contains(barEl)) {
      barEl = document.querySelector('.bar');
    }
    if (!barEl) return;
    var h = 0;
    try { h = barEl.getBoundingClientRect().height; } catch (e) { return; }
    /* A zero height is a bar that is display:none or not laid out yet.
       Keeping the last good value beats docking the card to the very top
       of the screen for one frame and then dropping it. */
    if (!(h > 0)) return;
    var v = Math.ceil(h) + 'px';
    if (v === dockPx) return;
    dockPx = v;
    try { root.style.setProperty('--ksat-tour-dock', v); } catch (e) {}
  }

  /* ===================================================================
     2 · THE STRINGS

     js/ksat-i18n.js is not ours this phase, so these live here in the
     shape that file already uses — {en, ar} — and are listed in the
     handoff so they can be folded into ARABIC_OURS and translateOurs()
     later without a rewrite. Everything user-visible has both halves,
     and paint() re-runs on the ksat:lang event.
     =================================================================== */

  var STR = {
    'tour.label':     { en: 'Guided tour',
                        ar: 'الجولة الإرشادية' },
    'tour.step':      { en: 'Step',      ar: 'الخطوة' },
    'tour.of':        { en: 'of',        ar: 'من' },

    'tour.locked':    { en: 'Behind sign-in. What you are looking at is a description of the instrument, not the instrument itself — nothing has been removed.',
                        ar: 'خلف تسجيل الدخول. ما تراه الآن وصف للأداة وليس الأداة نفسها — لم يُحذف أي شيء.' },

    'tour.offer.eye': { en: 'GUIDED TOUR',
                        ar: 'جولة إرشادية' },
    'tour.offer.h':   { en: 'Would you like a walk through?',
                        ar: 'هل تريد جولة في المنصة؟' },
    'tour.offer.p':   { en: 'A short guided walk through the platform, step by step. You can leave at any point, and it stays in the top bar if you would rather start later.',
                        ar: 'جولة إرشادية قصيرة في المنصة خطوة بخطوة. يمكنك الخروج في أي لحظة، وتبقى متاحة في الشريط العلوي إن فضّلت البدء لاحقاً.' },
    'tour.offer.go':  { en: 'Start the tour',
                        ar: 'ابدأ الجولة' },
    'tour.offer.no':  { en: 'Not now',
                        ar: 'ليس الآن' },
    'tour.offer.x':   { en: 'Dismiss the guided tour offer',
                        ar: 'إغلاق عرض الجولة الإرشادية' },
    'tour.offer.say': { en: 'A guided tour of the platform is available.',
                        ar: 'تتوفر جولة إرشادية في المنصة.' },

    'tour.keys':      { en: 'Left and right arrows move between steps, Enter goes forward, Escape leaves the tour.',
                        ar: 'السهمان الأيمن والأيسر للتنقل بين الخطوات، ومفتاح الإدخال للتقدّم، ومفتاح الخروج لإنهاء الجولة.' }
  };

  function t(k) {
    var s = STR[k];
    if (!s) return '';
    return s[lang()] || s.en;
  }

  /* ===================================================================
     3 · READING THE PAGE'S OWN TOUR STATE

     index.html declares `const S` and `const DEMO` at the top level of a
     CLASSIC script, which binds them into the global declarative record
     and NOT onto window — the bug js/ksat-shell.js documents at length
     in its bridge. This file is a classic script too, so it shares that
     record and can read the bare identifiers. `typeof` first, always:
     naming an identifier that was never declared throws ReferenceError
     and would take the whole layer down with it.
     =================================================================== */

  function demoState() {
    var s = null;
    try { s = window.S || (typeof S !== 'undefined' ? S : null); } catch (e) { s = null; }
    if (s && s.demo) return s.demo;
    /* Fall back to the DOM: #demoHud.on is the same truth, one frame
       later. `i` is then unknown, which only costs us the spotlight. */
    return { on: hud.classList.contains('on'), i: -1 };
  }

  function steps() {
    try {
      if (typeof DEMO !== 'undefined' && DEMO && DEMO.length) return DEMO;
    } catch (e) {}
    try {
      if (window.DEMO && window.DEMO.length) return window.DEMO;
    } catch (e) {}
    return null;
  }

  /* ===================================================================
     4 · WHAT EACH STEP IS ACTUALLY ABOUT

     goDemo() scrolls to the SECTION, and a section here is 600-1400 px
     tall. A hole that size is not a spotlight, it is a slightly smaller
     window. These are the instruments the eleven sentences refer to,
     named one by one, because a spotlight that points at roughly the
     right half of the screen is worse than none: it asserts precision it
     does not have.

     The three `agent` steps share one section id and mean three
     different things, so they are keyed by id plus their position among
     the steps carrying that id — 'agent#0', 'agent#1', 'agent#2'.

     Every entry is a LIST. #reportPanel is hidden until showReport()
     runs, #baCmp does not exist until the simulation has been run, and
     a candidate with no box on screen is skipped for the next one.
     =================================================================== */

  var FOCUS = {
    'mission':   ['#specTable'],
    'console':   ['#rcBrief'],
    'imagery':   ['#imgGrid', '#footprintWrap'],
    'explorer':  ['#exLayers', '.explorer'],
    'dashboard': ['#kpiGrid'],
    'map':       ['#mapWrap'],
    'simulate':  ['#baCmp', '#simStatePanel', '#simRun'],
    'impact':    ['#calcOut', '#calcSliders'],
    'agent#0':   ['#pipeline'],
    'agent#1':   ['#agThresh', '#agGp'],
    'agent#2':   ['#reportPanel', '#agOut', '#pipeline']
  };

  function visible(n) {
    if (!n) return false;
    try {
      if (n.hasAttribute('hidden')) return false;
      if (!n.getClientRects().length) return false;
      var r = n.getBoundingClientRect();
      return r.width > 4 && r.height > 4;
    } catch (e) { return false; }
  }

  function lockedInPublic(id) {
    var s = document.getElementById(id);
    return !!s && s.classList.contains('ksat-locked') &&
           root.getAttribute('data-ksat-tier') === 'public';
  }

  /* The heading block is the last-resort target and also the escape
     hatch when the real target turns out to be taller than the screen.
     A union of the eyebrow and the heading is a tighter, more honest
     thing to point at than a 1,200 px section.

     It takes any node, not just a section, and it knows the shell's
     invitation panels by name. Measured: with a 513 px viewport the
     dashboard step resolved to #ksat-invite-dashboard, which is taller
     than the screen, so the hole was clamped to the whole viewport and
     the dim said nothing at all. An invitation panel is not inside a
     section.sec — it is a sibling of one — so looking only at
     closest('section.sec') found no heading to fall back to. */
  function headRect(node) {
    if (!node || !node.querySelector) return null;
    var parts = [];
    var eye = node.querySelector('.eyebrow, .ksat-invite-eyebrow');
    var h = node.querySelector('.ksat-invite-h') || node.querySelector('h2.st') ||
            node.querySelector('h2') || node.querySelector('h3');
    if (visible(eye)) parts.push(eye.getBoundingClientRect());
    if (visible(h)) parts.push(h.getBoundingClientRect());
    if (!parts.length) return null;
    var r = { top: Infinity, left: Infinity, right: -Infinity, bottom: -Infinity };
    for (var i = 0; i < parts.length; i++) {
      r.top = Math.min(r.top, parts[i].top);
      r.left = Math.min(r.left, parts[i].left);
      r.right = Math.max(r.right, parts[i].right);
      r.bottom = Math.max(r.bottom, parts[i].bottom);
    }
    return r;
  }

  function targetFor(index) {
    var list = steps();
    if (!list || index < 0 || index >= list.length) return null;
    var step = list[index];
    if (!step || !step.id) return null;

    /* THE SHELL GETS THE FIRST WORD. A locked section has no box in the
       public tier, and ksat-shell.js patches scrollIntoView so the tour
       lands on #ksat-invite-<id> instead. If the spotlight did not
       follow that redirect it would cut a hole around nothing. */
    if (lockedInPublic(step.id)) {
      var inv = document.getElementById('ksat-invite-' + step.id);
      if (visible(inv)) return inv;
    }

    /* getElementById, never querySelectorAll.

       THE REASON GIVEN HERE HAS STOPPED BEING TRUE AND THE LINE STAYS
       ANYWAY. It used to read: "<section id="explorer"> at
       index.html:1184 contains <div class="explorer" id="explorer">, a
       duplicate id that ksat-shell.js documents". Re-checked on
       2026-09-22 and none of that holds. index.html:1184 is an
       anonymous <div> in another section; the explorer section is now
       further down; the inner viewer has been renamed to
       id="exViewer" with a comment above it in index.html saying so in
       as many words; and ksat-shell.js no longer mentions the clash at
       all, because there is no longer a clash to mention.

       So the duplicate is gone and this call no longer has to survive
       it. It is still getElementById, because step.id is a SECTION id
       by construction — it is the same string goDemo() hands to its own
       lookup — and resolving it any other way would let a later
       class-name collision decide what the spotlight points at. The old
       reason was a bug being worked around; this is the rule the lookup
       actually follows. */
    var section = document.getElementById(step.id);
    if (!section) return null;

    var occ = 0;
    for (var j = 0; j < index; j++) if (list[j] && list[j].id === step.id) occ++;
    var sels = FOCUS[step.id + '#' + occ] || FOCUS[step.id] || [];

    for (var k = 0; k < sels.length; k++) {
      var cand = null;
      try { cand = section.querySelector(sels[k]); } catch (e) { cand = null; }
      if (!visible(cand)) continue;
      /* A range input or a select is a 20 px sliver, and pointing at one
         of the two agent thresholds implies the other one is not part of
         the step. Climb to the control row that holds both. */
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(cand.tagName)) {
        var up = cand.closest('.rowf') || cand.closest('.fld');
        if (visible(up)) cand = up;
      }
      return cand;
    }
    return section;
  }

  /* ===================================================================
     5 · THE SPOTLIGHT

     One layer, one hole, both pointer-events:none. The reader has to be
     able to click the thing being pointed at — that is the entire point
     of pointing at it.
     =================================================================== */

  var layer = null, hole = null;
  var holeRect = null;
  var rafId = 0;
  var settleUntil = 0;
  var settleDeadline = 0;
  var scrollIdle = 0;
  var current = null;               /* the element the hole is cut around */

  /* HAS A REAL HOLE EVER BEEN CUT FOR THE CURRENT TARGET?

     This exists because of a failure that looks exactly like a rendering
     bug and is not one. The dim is a box-shadow ON the hole, so a hole
     that has never been given a width and a height still paints the full
     100vmax shadow: the page goes dark and nothing is lit. Reproduced at
     a 630px viewport on step 1 — #specTable is 683px tall, so measure()
     falls back to the section heading, the heading was above the top of
     the screen, place() correctly refused a rectangle with a negative
     bottom, and the hole was left at its CSS size of 0x0. The reader
     gets a dimmed page with no spotlight on it, which is worse than no
     spotlight at all, and there is nothing on screen to explain it.

     place() already refuses to collapse a hole that HAS a position —
     "keep the last position rather than collapsing to a dot" — but on
     the first placement for a target there is no last position to keep.
     So the dim is now held back until there is a hole to put in it. */
  var placed = false;

  function shown(on) {
    if (!layer) return;
    if (on) layer.setAttribute('data-on', '');
    else layer.removeAttribute('data-on');
  }

  function buildSpot() {
    if (layer) return;
    layer = el('div');
    layer.id = 'ksat-tour-spot';
    layer.setAttribute('aria-hidden', 'true');   /* decoration, never content */
    hole = el('div', 'ksat-tour-hole');
    layer.appendChild(hole);
    document.body.appendChild(layer);
  }

  function place(r) {
    var pad = 10, inset = 8;
    var vw = window.innerWidth || root.clientWidth;
    var vh = window.innerHeight || root.clientHeight;

    var top = Math.max(inset, r.top - pad);
    var left = Math.max(inset, r.left - pad);
    var bottom = Math.min(vh - inset, r.bottom + pad);
    var right = Math.min(vw - inset, r.right + pad);

    /* Scrolled entirely off screen: keep the last position rather than
       collapsing the hole to a dot, which reads as a glitch. */
    if (bottom <= top || right <= left) return false;

    var next = top + '|' + left + '|' + (right - left) + '|' + (bottom - top);
    if (next === holeRect) return false;
    holeRect = next;

    hole.style.top = Math.round(top) + 'px';
    hole.style.left = Math.round(left) + 'px';
    hole.style.width = Math.round(right - left) + 'px';
    hole.style.height = Math.round(bottom - top) + 'px';
    placed = true;
    return true;
  }

  function measure() {
    if (!current || !layer) return false;
    if (!visible(current)) return false;
    var r = current.getBoundingClientRect();

    /* Taller than the screen means the hole would cover the screen and
       the dim would say nothing. Point at the heading instead and be
       honest about the resolution we actually have. */
    var vh = window.innerHeight || root.clientHeight;
    if (r.height > vh * 0.88) {
      /* Look inside the target first — an invitation panel carries its
         own eyebrow and heading — and only then at the section around
         it. Falling back to the whole section would be a bigger hole
         than the one we are trying to shrink. */
      var hr = headRect(current);
      if (!hr) {
        var section = current.closest ? current.closest('section.sec') : null;
        if (section) hr = headRect(section);
      }
      /* AND ONLY IF THAT HEADING IS ACTUALLY ON THE SCREEN.
         goDemo() scrolls the SECTION to the top of the viewport, so on a
         short screen the instrument the step is about can be in view
         while the heading above it has already gone past the top edge.
         Measured at 630px: #specTable sat at y=120 with the mission
         section's heading block at y=-613, and swapping to that heading
         handed place() a rectangle whose bottom was above the top of the
         screen. place() refused it — correctly — and the result was a
         dimmed page with no hole in it at all. A heading that is not on
         screen is not a thing to point at; keep the target and let
         place() clamp it to the viewport instead. */
      if (hr && hr.bottom > 0 && hr.top < vh) r = hr;
    }
    return place(r);
  }

  /* THIS rAF LOOP IS A POSITION TRACKER, NOT AN ANIMATION. It exists
     because goDemo() smooth-scrolls and then fires the step's side
     effect 420 ms later, and a side effect like runSim() changes the
     height of everything under it. So the hole has to be re-measured for
     a while after every step change, not once.

     prefers-reduced-motion still changes it: with reduced motion the
     page's scrollIntoView uses behavior:'auto', the scroll is finished
     in one frame, and a 1.5 s tracking window would be 90 frames of
     measuring nothing. The budget drops to a quarter of a second. */
  function frame() {
    rafId = 0;
    var moved = measure();
    /* The dim follows the hole, not the other way round: see `placed`.
       This is checked every frame rather than once, because the common
       case is a target that is off screen when the step starts and
       arrives during the smooth scroll. */
    shown(placed);
    var n = now();
    if (n < settleUntil && n < settleDeadline) {
      /* A target that is still moving buys a little more time — the
         explorer canvas finishes drawing after its section has already
         stopped scrolling. But only up to settleDeadline: something on
         this page animates permanently (heroOrbit(), the rAF loop that
         draws #heroOrb, never stops — this used to cite it as ":4458",
         which is now a comment inside renderDemo()), and an rAF loop
         that keeps renewing itself on a page
         carrying 26 canvases is the dropped-frame machine that
         js/ksat-motion.js exists to avoid. */
      if (moved) settleUntil = Math.max(settleUntil, n + 220);
      schedule();
    }
  }

  function schedule() {
    if (rafId || !layer) return;
    try { rafId = requestAnimationFrame(frame); }
    catch (e) { measure(); }
  }

  function settle() {
    var n = now();
    settleUntil = n + (reduced() ? 260 : 1500);
    settleDeadline = n + (reduced() ? 600 : 4000);
    schedule();
  }

  function spotOn(target) {
    buildSpot();
    if (!target) { spotOff(); return; }
    current = target;
    holeRect = null;                 /* force a write even if the box matches */
    placed = false;                  /* a new target has no hole yet          */
    measure();
    shown(placed);                   /* dim only once there is a hole to dim  */
    settle();
  }

  function spotOff() {
    current = null;
    holeRect = null;
    placed = false;
    settleUntil = 0;
    settleDeadline = 0;
    shown(false);
  }

  /* A scroll means the hole must be repainted every frame, and a 0.42 s
     transition on top of per-frame repositioning reads as lag. Turn the
     transition off while scrolling and back on 140 ms after it stops, so
     a step change with no scroll still glides. */
  function onScroll() {
    offerDrift();
    if (!current || !hole) return;
    hole.setAttribute('data-tracking', '');
    clearTimeout(scrollIdle);
    scrollIdle = setTimeout(function () {
      if (hole) hole.removeAttribute('data-tracking');
    }, 140);
    schedule();
  }

  function onResize() { dock(); settle(); }

  try {
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
  } catch (e) {
    window.addEventListener('scroll', onScroll);
    window.addEventListener('resize', onResize);
  }

  /* A resize event is not the only way the masthead changes height. The
     nav wraps when its own contents change — a language switch swaps
     every label, the shell adds and removes the sign-in and identity
     controls on the tier change — and none of that fires `resize`.
     Watching the element itself is the only signal that covers all of
     them, and it is one observer on one node. */
  try {
    if (typeof ResizeObserver !== 'undefined') {
      var bar0 = document.querySelector('.bar');
      if (bar0) new ResizeObserver(function () { dock(); }).observe(bar0);
    }
  } catch (e) { /* no ResizeObserver: resize and ksat:lang still call dock() */ }

  /* ===================================================================
     6 · THE LIVE REGION

     On <body>, not inside #demoHud. #demoHud is display:none whenever
     the tour is off, and a live region inside a display:none subtree is
     not a live region — nothing in it is ever announced. It is needed
     while the tour is off, too: the offer has to say it exists.
     =================================================================== */

  var live = null;

  function buildLive() {
    if (live) return;
    live = el('div', 'ksat-tour-live');
    live.id = 'ksat-tour-live';
    live.setAttribute('role', 'status');
    live.setAttribute('aria-live', 'polite');
    document.body.appendChild(live);
  }

  var sayTimer = 0;
  function say(text) {
    buildLive();
    if (!text) return;
    clearTimeout(sayTimer);
    /* Debounced, and cleared first: a screen reader that is handed the
       same string twice says nothing the second time, and stepping Back
       then Next through one step is exactly that case. */
    live.textContent = '';
    sayTimer = setTimeout(function () { live.textContent = text; }, 180);
  }

  /* ===================================================================
     7 · THE STRIP ABOVE THE HUD

     A sibling of #demoPan, never a child: renderDemo() sets
     pan.innerHTML on every step and would delete a child on the next
     press of Next. As a sibling it is also invisible to our own
     MutationObserver, which watches #demoPan only — otherwise writing
     this strip would re-trigger the observer that wrote it.
     =================================================================== */

  var note = null, noteTxt = null;

  function buildNote() {
    if (note) return;
    note = el('div', 'ksat-tour-note');
    note.id = 'ksat-tour-note';
    note.hidden = true;
    note.appendChild(el('span', 'ksat-tour-note-mark', '●'));
    noteTxt = el('span', 'ksat-tour-note-txt');
    note.appendChild(noteTxt);
    hud.insertBefore(note, pan);
  }

  function paintNote(id) {
    buildNote();
    if (id && lockedInPublic(id)) {
      noteTxt.textContent = t('tour.locked');
      note.hidden = false;
    } else {
      note.hidden = true;
    }
  }

  /* ===================================================================
     8 · STATE, AND WHAT WE REMEMBER

     Same shape as ksat_nav in js/ksat-shell.js: one short string, one
     try/catch, and a page that behaves correctly when storage throws —
     private-mode Safari throws on setItem, not on getItem, so the
     failure lands in the middle of a working tour.
     =================================================================== */

  function remembered() {
    try { return localStorage.getItem(STORE); } catch (e) { return null; }
  }
  function remember(v) {
    try { localStorage.setItem(STORE, v); } catch (e) {}
  }
  function forget() {
    try { localStorage.removeItem(STORE); } catch (e) {}
  }

  var active = false;        /* the tour is running, as far as we know   */
  var finished = false;      /* the completion card has been reached      */
  var restoreTo = null;      /* what had focus when the tour started      */
  var lastFocusInHud = false;

  /* WAS THE READER IN THE HUD WHEN THIS RENDER WAS TRIGGERED?
     paint() cannot ask document.activeElement, because by the time it
     runs renderDemo() has already replaced the focused button with a
     new one and the browser has dropped focus to <body>. So the answer
     has to be recorded BEFORE the render, from two sources:

     · focusin, which covers Tab and programmatic focus, and
     · pointerdown in the CAPTURE phase, which covers the mouse and
       fires before the button's own onclick rewrites the panel.

     Both, not either. Measured in a window that does not have focus:
     element.focus() updates document.activeElement and fires no focus
     event at all, so focusin alone is a flag that can silently go
     stale — and "silently stale" is how a keyboard reader ends up
     somewhere they did not ask to be. */
  document.addEventListener('focusin', function (e) {
    try { lastFocusInHud = hud.contains(e.target); } catch (err) {}
  });
  document.addEventListener('pointerdown', function (e) {
    try { lastFocusInHud = hud.contains(e.target); } catch (err) {}
  }, true);

  function enter() {
    active = true;
    finished = false;
    hideOffer(false);

    var a = document.activeElement;
    restoreTo = (a && a !== document.body && document.contains(a)) ? a : null;

    /* A non-modal dialog. aria-modal="false" is the honest description:
       the page behind is still reachable, on purpose. Trapping focus in
       a panel whose whole job is to make you look at something else
       would be the wrong kind of correct. */
    pan.setAttribute('role', 'dialog');
    pan.setAttribute('aria-modal', 'false');
    pan.setAttribute('aria-label', t('tour.label'));
    pan.setAttribute('tabindex', '-1');

    buildSpot();
    buildLive();

    /* Move focus into the panel once, so a keyboard reader starts inside
       the thing that is now driving the page. They can Tab straight out
       into the section it is pointing at, which is the point. */
    setTimeout(function () {
      if (!active) return;
      try { pan.focus({ preventScroll: true }); } catch (e) {
        try { pan.focus(); } catch (e2) {}
      }
    }, 60);
  }

  function leave() {
    active = false;
    spotOff();
    paintNote(null);

    /* Hand #demoPan back exactly as index.html left it. Removing only
       the tabindex and keeping role="dialog" was measured after an
       Escape: the panel is display:none by then so nothing announces
       it, but a panel that is permanently a dialog is a lie waiting for
       the day somebody makes the HUD visible for another reason. All
       four attributes go on together in enter(); all four come off
       together here. */
    pan.removeAttribute('tabindex');
    pan.removeAttribute('role');
    pan.removeAttribute('aria-modal');
    pan.removeAttribute('aria-label');

    /* Exited before the end is a skip. Reaching the completion card has
       already written 'done', and #dmClose on that card must not
       downgrade it.

       `finished` only covers the run that is ending. A COMPLETION FROM
       AN EARLIER RUN HAS TO BE READ BACK OUT OF STORAGE, because of this
       sequence, which the finale invites by having a button for it:
       walk the whole tour (paint() writes 'done' on the completion
       card), close it, then press #finTour — or "Run it again" — and
       leave at step three. enter() has reset `finished` to false by
       then, so the old code wrote 'skipped' over a tour this reader
       genuinely finished, and 'skipped' is what the next visit reads.
       Nothing user-visible depended on the difference on the day this
       was written; both values only stop the offer being made again. It
       is the record of what the reader actually did, it is the obvious
       thing for a later "you have already been through this" state to
       read, and a record that can move backwards is worse than no
       record. 'done' is a high-water mark: only forget() clears it.

       WALKED THROUGH ON THE LIVE PAGE, 2026-09-22, because the whole
       value of this line is in a sequence rather than in a state:

         · ksat_tour cleared, #demoBtn, one Next, #dmExit
           -> 'skipped'.  The ordinary case, and proof the write still
              happens at all.
         · ksat_tour set to 'done', #finTour (the re-run the finale
           invites), two Nexts, #dmExit
           -> still 'done'.  This is the sequence the guard exists for;
              without `remembered() !== 'done'` it wrote 'skipped' here,
              because enter() had already reset `finished` to false.
         · ksat_tour cleared, #demoBtn, Next until #dmRestart appeared
           (eleven of eleven)
           -> 'done' on the completion card, and still 'done' after
              #dmClose, which is the other half of the same rule.

       Same exit control, same step, two different stored values in and
       two different values out: the condition is load-bearing, not
       decoration. */
    if (!finished && remembered() !== 'done') remember('skipped');

    if (restoreTo && document.contains(restoreTo)) {
      try { restoreTo.focus({ preventScroll: true }); } catch (e) {
        try { restoreTo.focus(); } catch (e2) {}
      }
    }
    restoreTo = null;
  }

  /* ===================================================================
     9 · PAINT — runs after every render of #demoPan
     =================================================================== */

  function panelText() {
    var h = pan.querySelector('h4');
    var p = pan.querySelector('p');
    var out = [];
    if (h && h.textContent) out.push(h.textContent.trim());
    if (p && p.textContent) out.push(p.textContent.trim());
    return out.join('. ');
  }

  function paint() {
    if (!active) return;

    var st = demoState();
    var list = steps();
    var total = list ? list.length : 0;
    var i = st.i;
    var onFinish = !!pan.querySelector('#dmRestart');

    if (onFinish) {
      /* The completion card. There is nothing on the page to point at,
         and dimming the whole page behind a congratulation is noise. */
      finished = true;
      remember('done');
      spotOff();
      paintNote(null);
      say(panelText());
    } else {
      var target = targetFor(i);
      var id = (list && list[i]) ? list[i].id : null;
      paintNote(id);
      spotOn(target);

      var said = panelText();
      if (i >= 0 && total) {
        said = t('tour.step') + ' ' + (i + 1) + ' ' + t('tour.of') + ' ' + total + '. ' + said;
      }
      /* The shortcuts are said once, on the first step, and never again.
         A screen reader that repeats "left and right arrows move between
         steps" eleven times is the reason people turn tours off. */
      if (i === 0) said += ' ' + t('tour.keys');
      say(said);
    }

    pan.setAttribute('aria-label', t('tour.label'));

    /* THE FOCUS BUG THIS PAGE HAS ALWAYS HAD. renderDemo() replaces
       pan.innerHTML, which destroys #dmNext — the button that was just
       pressed. The browser then drops focus to <body>, so a keyboard
       reader pressing Next four times ends up with no focus at all and
       no way back except Tab from the top of the document. Put focus on
       the new Next button, but ONLY if focus was inside the HUD before
       the render: a reader who has tabbed out into the section must not
       be yanked back every time the tour advances. */
    if (lastFocusInHud) {
      var a = document.activeElement;
      if (!a || a === document.body) {
        var b = pan.querySelector('#dmNext') || pan.querySelector('#dmRestart') || pan;
        try { b.focus({ preventScroll: true }); } catch (e) {
          try { b.focus(); } catch (e2) {}
        }
      }
    }
  }

  function sync() {
    var st = demoState();
    if (st.on && !active) enter();
    else if (!st.on && active) { leave(); return; }
    if (active) paint();
  }

  /* ===================================================================
     10 · THE OBSERVERS

     #demoPan: childList + subtree + characterData, and DELIBERATELY NOT
     attributes — paint() writes role, aria-label and tabindex onto
     #demoPan itself, and observing attributes here would make this file
     answer its own writes in a loop.

     #demoHud: attributes/class only. renderDemo() toggles .on there
     before it fills the panel, so this is what tells us the tour has
     started or ended.
     =================================================================== */

  try {
    new MutationObserver(function () { sync(); })
      .observe(pan, { childList: true, subtree: true, characterData: true });
    new MutationObserver(function () { sync(); })
      .observe(hud, { attributes: true, attributeFilter: ['class'] });
  } catch (e) { /* no MutationObserver: the tour is simply un-upgraded */ }

  /* The tier flips on sign-in and on sign-out, and that changes whether
     the current step's section has a box at all. Re-resolve the target
     rather than leaving a hole cut around a section that just vanished. */
  try {
    new MutationObserver(function () { if (active) paint(); })
      .observe(root, { attributes: true, attributeFilter: ['data-ksat-tier'] });
  } catch (e) {}

  /* A chapter change moves the target in or out of flow. */
  document.addEventListener('ksat:chapter', function () {
    if (active) setTimeout(function () { settle(); }, 80);
  });

  /* A language switch re-runs renderAll(), which re-runs renderDemo(),
     so the panel repaints itself — but our own strings do not. */
  document.addEventListener('ksat:lang', function () {
    if (active) setTimeout(paint, 140);
    paintOffer();
    /* Arabic labels are not the same width as English ones, so the nav
       can wrap to a different number of rows and the masthead changes
       height under a card that is docked to it. Re-measure after the
       page has re-rendered, not during. */
    setTimeout(dock, 160);
  });

  /* ===================================================================
     11 · THE KEYBOARD

     Bound on document in the BUBBLE phase, never capture. Three other
     layers already own Escape — the assistant panel (onEscape() in
     js/ksat-assistant.js), the sign-in gate (closeGate() in
     js/ksat-shell.js) and the chapter sheet (closeSheet(), same file) —
     and the gate and the sheet are element-scoped and call
     stopPropagation, so a bubble-phase listener here loses to them
     automatically, which is the correct outcome: whichever overlay you
     are inside closes first. The assistant is the one that is NOT
     element-scoped; that is what section 11's guard order is about, and
     it is spelt out at the guard itself rather than here. The intro's
     Escape is a window listener guarded on its own `done` flag, but the
     intro also sits at z-index 200 over everything, so we stand down
     entirely while #intro is still in the DOM.

     The four citations that used to be in that paragraph —
     ksat-assistant.js:379, ksat-shell.js:540, :803 and index.html:2398
     — were re-read on 2026-09-22 and all four now land on unrelated
     prose. They have been replaced by the function names, which is what
     a reader would have had to grep for anyway.

     ARROWS ARE THE DANGEROUS ONES.
     · Up and Down are how a reader SCROLLS, and the entire point of the
       tour is that they look at the page. They are not bound here.
     · Left and Right invert under RTL, the same way the chapter rail
       does — js/ksat-shell.js computes the same `fwd`/`back` pair from
       isRTL() for its roving tabindex. The site is bilingual; a
       hard-coded Left = previous is backwards in Arabic.
     · #baHandle is a role="slider" wipe handle carrying aria-valuenow,
       and the agent thresholds are range inputs. Both want Left and
       Right and neither calls stopPropagation, so they are excluded by
       target.

     ENTER is only ours when the reader is not on a control. Enter on a
     focused button must press that button, not skip a step.
     =================================================================== */

  var TYPING = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';
  var OWN_KEYS = '[role="slider"], [aria-valuenow], .ksat-ch-item, #ksat-ch-rail, ' +
                 '#ksat-ch-sheet, #ksat-gate, .ksat-as-panel';
  var PRESSABLE = 'button, a[href], [role="button"], summary';

  function inside(node, sel) {
    if (!node || !node.closest) return false;
    try { return !!node.closest(sel); } catch (e) { return false; }
  }

  /* IS THE ASSISTANT PANEL OPEN?

     Two questions in one, because the panel is an overlay and not a
     container: the reader can have the panel open with focus anywhere on
     the page — clicking a chip inside it moves focus, but so does
     clicking the page behind it, and the panel stays open either way.
     `inside(tgt, OWN_KEYS)` only answers the first half.

     js/ksat-assistant.js writes data-ksat-assistant="open" on <html> for
     exactly this and calls it a contract for whoever rebuilds the tour:
     "while the assistant panel is open, <html> carries
     data-ksat-assistant='open' and Escape belongs to the assistant".
     The attribute is the cheap answer and the panel itself is the
     fallback, in case a future version of that file stops writing it —
     an attribute that quietly disappears must not silently hand Escape
     back to us. */
  function assistantOpen() {
    if (root.getAttribute('data-ksat-assistant') === 'open') return true;
    var p = document.querySelector('.ksat-as-panel');
    if (!p || p.hidden) return false;
    try { return !!(p.offsetWidth || p.offsetHeight || p.getClientRects().length); }
    catch (e) { return false; }
  }

  function press(sel) {
    var b = pan.querySelector(sel);
    if (!b || b.disabled) return false;
    b.click();
    return true;
  }

  document.addEventListener('keydown', function (e) {
    if (!active) return;
    if (e.defaultPrevented) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (document.getElementById('intro')) return;     /* the intro is still up */

    var tgt = e.target;
    if (inside(tgt, TYPING)) return;                  /* never swallow typing  */

    /* THE "SOMEBODY ELSE OWNS THESE KEYS" GUARD RUNS BEFORE EVERY BRANCH,
       ESCAPE INCLUDED. It used to sit below the Escape branch, which meant
       .ksat-as-panel was listed here and never consulted for the one key
       that matters most to it.

       THE BUG THAT MOTIVATED THE MOVE, quoted from the file that found
       it. js/ksat-assistant.js, section 13: with the tour running, the
       assistant panel open and focus anywhere outside the panel, Escape
       pressed the tour's #dmExit and called preventDefault, and the
       assistant's own handler then bailed on its e.defaultPrevented
       line. "The visitor lost the guided tour and the assistant stayed
       open - exactly backwards." Both files documented the opposite
       behaviour while the code did that.

       That file has since moved its listener to the CAPTURE phase, which
       stops the event before this handler ever runs, so the visible
       symptom is already gone. This is not therefore a fix on top of a
       fix, it is the ordering being made true on our side as well: their
       capture listener deliberately declines while a higher overlay is
       up (the intro, the sign-in gate, the chapter sheet), and in those
       states the keystroke still arrives here with the panel open. It
       also means neither file now depends on the other keeping a
       particular listener phase or registration order for Escape to go
       to the right place, which is what made the first version of this
       silently wrong rather than loudly wrong.

       WHAT THE MOVE COSTS, stated rather than glossed. With focus inside
       one of the OWN_KEYS widgets, Escape no longer exits the tour. For
       #ksat-gate and #ksat-ch-sheet that is already true and correct —
       both bind Escape on their own element and stop propagation, so
       whichever overlay you are inside closes first. The chapter rail is
       the one member of the list that does not handle Escape itself, so
       Escape with focus on a chapter chip is now inert instead of
       leaving the tour: the HUD's own Exit button is still there, and so
       is Escape from anywhere else on the page. Inert is the right
       failure here — the alternative is a keystroke whose meaning
       depends on which of two widgets the reader last clicked.

       The assistant check sits here rather than inside the Escape
       branch, so while that panel is open it takes the arrows and Enter
       as well. That is deliberate and it is a change: the panel is drawn
       at z-index 134 over the HUD's 120, so with it open the narration
       the arrows drive is partly behind it, and a reader who has the
       assistant open is talking to the assistant. Close it and every key
       comes straight back.

       EXERCISED, NOT JUST ARGUED, ON 2026-09-22. Three runs against the
       live page with the tour running, Escape dispatched on <body> —
       that is, outside every OWN_KEYS widget, which is the case the two
       lines below are for:

         · no assistant at all: the HUD went from on to off and the
           event came back defaultPrevented — the control, proving
           Escape still reaches the tour when nothing else wants it.
         · data-ksat-assistant="open" set by hand with the panel left
           CLOSED, so js/ksat-assistant.js's capture listener declines
           on its own guards and the keystroke genuinely arrives here:
           the HUD stayed on and defaultPrevented came back false. That
           is this file's own guard doing the work, with the other
           file's listener taken out of the question.
         · the panel really open: the panel closed, data-ksat-assistant
           went away and the HUD stayed on. The old bug was the exact
           inverse of that sentence.

       The middle one is the reason both lines are here rather than one.
       The attribute check alone would be enough for a reader with focus
       anywhere; the OWN_KEYS check alone would miss them entirely, and
       missing them is how this went wrong the first time. */
    if (inside(tgt, OWN_KEYS)) return;                /* another widget's keys */
    if (assistantOpen()) return;                      /* the panel has the floor */

    if (e.key === 'Escape') {
      /* Click the page's own control so the page's own handler runs and
         S.demo stays the single source of truth. */
      if (press('#dmExit') || press('#dmClose')) { e.preventDefault(); return; }
      var btn = document.getElementById('demoBtn');
      if (btn) { btn.click(); e.preventDefault(); }
      return;
    }

    var fwd = isRTL() ? 'ArrowLeft' : 'ArrowRight';
    var back = isRTL() ? 'ArrowRight' : 'ArrowLeft';

    if (e.key === fwd) {
      if (press('#dmNext')) e.preventDefault();
      return;
    }
    if (e.key === back) {
      if (press('#dmPrev')) e.preventDefault();
      return;
    }
    if (e.key === 'Enter') {
      if (inside(tgt, PRESSABLE)) return;             /* that button's Enter   */
      if (press('#dmNext')) e.preventDefault();
    }
  });

  /* ===================================================================
     12 · THE OFFER

     "A guided tour the user can go through or skip" needs somebody to
     ask. This is that. What it is not:
       · not a modal, and not a focus trap
       · not shown over the cinematic intro — it waits for #intro to be
         removed from the DOM, which Intro's finish() does on a timer
         after its fade
       · not shown twice: skipping it and finishing the tour both write
         ksat_tour and neither is re-offered
       · not shown to a reader who is already deep in the page, because
         an invitation to start at the beginning is noise by then
     =================================================================== */

  var offer = null;

  function buildOffer() {
    if (offer) return;
    offer = el('div');
    offer.id = 'ksat-tour-offer';
    offer.setAttribute('role', 'dialog');
    offer.setAttribute('aria-modal', 'false');
    offer.setAttribute('aria-label', t('tour.label'));

    var eye = el('div', 'ksat-tour-offer-eyebrow');
    var h = el('h2', 'ksat-tour-offer-h');
    var p = el('p', 'ksat-tour-offer-p');

    var acts = el('div', 'ksat-tour-offer-acts');
    var go = el('button', 'ksat-tour-btn ksat-tour-btn-go');
    go.type = 'button';
    var no = el('button', 'ksat-tour-btn');
    no.type = 'button';
    acts.appendChild(go);
    acts.appendChild(no);

    var x = el('button', 'ksat-tour-offer-x', '×');
    x.type = 'button';

    offer.appendChild(x);
    offer.appendChild(eye);
    offer.appendChild(h);
    offer.appendChild(p);
    offer.appendChild(acts);

    offer._parts = { eye: eye, h: h, p: p, go: go, no: no, x: x };

    go.addEventListener('click', function () { start(); });
    no.addEventListener('click', function () { hideOffer(true); });
    x.addEventListener('click', function () { hideOffer(true); });

    /* Escape dismisses the offer, and only the offer, and only while
       focus is inside it — so it cannot compete with the tour's own
       Escape or with any other overlay. */
    offer.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.stopPropagation(); hideOffer(true); }
    });

    document.body.appendChild(offer);
    paintOffer();
  }

  function paintOffer() {
    if (!offer || !offer._parts) return;
    var q = offer._parts;
    offer.setAttribute('aria-label', t('tour.label'));
    q.eye.textContent = t('tour.offer.eye');
    q.h.textContent = t('tour.offer.h');
    q.p.textContent = t('tour.offer.p');
    q.go.textContent = t('tour.offer.go');
    q.no.textContent = t('tour.offer.no');
    q.x.setAttribute('aria-label', t('tour.offer.x'));
  }

  /* WHERE THE PAGE WAS WHEN THE CARD APPEARED.  See offerDrift(). */
  var offerY = 0;

  /* THE ONE THING A FIXED CARD CANNOT PROMISE.
     The card is docked under the masthead and css/ksat-tour.css checks,
     with elementFromPoint on an 8px grid at 1424, 1024 and 400, that
     nothing interactive sits under it in the hero. That check is only
     true at the top of the page. Scroll down and the explorer's layer
     chips, the agent thresholds and the impact sliders all pass under a
     card that is still sitting there — and unlike the hero buttons,
     those are controls the reader went looking for.

     boot() already refuses to offer the tour to somebody who arrives two
     screens down, on the grounds that an invitation to start at the
     beginning is noise by then. This is the same rule applied while the
     card is open: leave the screen it was offered on and it withdraws.

     It does NOT remember anything. A reader who scrolled past an offer
     was never asked, so the next visit still gets to ask — the same
     distinction boot() makes for the deep-arrival case. Only "Not now",
     the cross and finishing the tour write ksat_tour.

     A full viewport of travel, not a few pixels: a trackpad nudge, a
     rubber-band bounce on a Mac, or the browser restoring a scroll
     position must not count as walking away. */
  function offerDrift() {
    if (!offer) return;
    var vh = window.innerHeight || root.clientHeight || 800;
    var y = window.pageYOffset || root.scrollTop || 0;
    if (Math.abs(y - offerY) > vh) hideOffer(false);
  }

  function showOffer() {
    if (remembered()) return;
    if (demoState().on) return;
    if (offer) return;
    /* Measure the masthead one more time before the card is placed
       against it: the shell and the language layer both finish writing
       the bar well after DOMContentLoaded, and this runs about 1.7s in. */
    dock();
    offerY = window.pageYOffset || root.scrollTop || 0;
    buildOffer();
    /* The card needs one style recalculation at opacity:0 before the
       attribute goes on, or there is no start state and the transition
       does not run.

       A TIMER, NOT requestAnimationFrame. Measured in a background tab:
       rAF does not fire at all while document.hidden is true, so a
       double-rAF here left the offer built, announced and permanently
       invisible until the reader came back to the tab. A timeout fires
       either way — throttled to about a second in the background, which
       is exactly when nobody is looking. Under reduced motion the CSS
       drops the transition and this is simply the moment it appears. */
    setTimeout(function () {
      if (offer) offer.setAttribute('data-on', '');
    }, 30);
    say(t('tour.offer.say'));
  }

  function hideOffer(andRemember) {
    if (andRemember) remember('skipped');
    if (!offer) return;
    var o = offer;
    offer = null;
    o.removeAttribute('data-on');
    var wait = reduced() ? 0 : 420;
    setTimeout(function () { if (o.parentNode) o.parentNode.removeChild(o); }, wait);
  }

  /* Start through the page's own entry points, so the page's own
     handlers set S.demo and call goDemo(). Nothing here reaches into
     that state directly — if this file ever disagreed with renderDemo()
     about which step is showing, the spotlight would point at the wrong
     thing and be believed. */
  function start() {
    hideOffer(false);
    var b = document.getElementById('heroTour') ||
            document.getElementById('finTour') ||
            document.getElementById('demoBtn');
    if (b) b.click();
  }

  /* ===================================================================
     13 · BOOT

     The intro owns the screen for up to about twelve seconds and removes
     itself from the DOM when it is done — Intro's finish() fades #intro
     and calls wrap.remove() 820 ms later. Polling for that is the only
     signal available from out here: Intro exposes
     start/finish/begin/replay and dispatches no event. ks_intro is
     checked too, because a second page view in the same session removes
     #intro before init() ever runs.
     =================================================================== */

  function pageIsDeep() {
    var vh = window.innerHeight || root.clientHeight || 800;
    return (window.pageYOffset || root.scrollTop || 0) > vh * 2;
  }

  function boot() {
    buildLive();
    dock();                              /* before anything can be placed */
    sync();                              /* in case the tour is already on */

    if (remembered()) return;

    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (document.getElementById('intro') && tries <= 240) return;   /* 60 s */
      clearInterval(iv);
      setTimeout(function () {
        if (remembered()) return;
        if (demoState().on) return;
        /* Already reading, two screens down: do NOT offer, and do NOT
           write ksat_tour either. They were not asked, so the next visit
           still gets to ask. */
        if (pageIsDeep()) return;
        showOffer();
      }, 1400);
    }, 250);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  /* ===================================================================
     14 · THE PUBLIC HANDLE

     Same shape as KSAT.shell and KSAT.assistant. `forget()` is here so
     the offer can be re-tested without clearing the whole origin's
     storage, which would also drop ksat.lang and ksat_nav.
     =================================================================== */

  KS.tour = {
    start: start,
    offer: showOffer,
    forget: forget,
    remembered: remembered,
    /* Exposed so the docking can be re-measured and read back from the
       console without reloading — it is the number the offer's position
       depends on, and "the card is in the wrong place" is much faster to
       diagnose when you can see what it was told the masthead measured. */
    dock: dock,
    strings: STR,
    state: function () {
      var st = demoState();
      return {
        on: !!st.on,
        i: st.i,
        total: (steps() || []).length,
        target: current ? (current.id || current.className) : null,
        remembered: remembered(),
        dock: dockPx,
        offerOpen: !!offer
      };
    }
  };
})();
