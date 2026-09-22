/* =====================================================================
   ksat-nav.js — THE GROUPED MASTHEAD, SEARCH, AND THE RESEARCH TOOLS
   BAND
   Owner: 01 Front End.  Companion to css/ksat-nav.css.
   Spec sections 2 (global navigation), 3 (researcher quick access) and
   19 (keyboard-first).

   ---------------------------------------------------------------------
   WHAT WAS THERE BEFORE
   ---------------------------------------------------------------------
   index.html declares `const NAV` as a flat list of twelve {id,en,ar}
   objects and renderNav() emits them as plain buttons that call
   scrollIntoView. Counting the declaration is not enough, though: a
   block far below it, down in the research console, does

       NAV.splice(2,0,{id:"console", en:"Console", ar:"الكونسول"});

   so what the page actually renders is THIRTEEN buttons, with #console
   third. Every count in this file is the run-time one, because that is
   the one the DOM agrees with. Thirteen equal labels in one row is a
   list of links; it does not tell a reader that Imagery and Explorer
   are the same body of work, and it does not tell them that Dashboard
   is behind a sign-in until they have already clicked it.

   ---------------------------------------------------------------------
   WHERE THE SIX GROUPS COME FROM, AND WHY THEY ARE NOT NEW
   ---------------------------------------------------------------------
   js/ksat-shell.js already defines six CHAPTERS over the real sections
   — brief / space / intel / planning / agents / record — with names,
   Arabic names, and an authored membership list. A second set of group
   names invented here would be a second taxonomy over the same
   twenty-three sections, and the first time somebody moved a section
   between chapters the masthead would quietly disagree with the chapter
   rail. So this file has NO taxonomy of its own. It reads the shell's.

   The shell does not export CHAPTERS (SH.goToSection, SH.setNav,
   SH.openChapterFor, SH.openGate, SH.strings and SH.panels are the
   whole public surface), and this file may not edit it. It does not
   need to: the shell's stamp() writes data-ksat-ch="<key>" onto every
   node a chapter owns, and buildRail() emits one
   .ksat-ch-item[data-ksat-key] per chapter carrying .ksat-ch-en and
   .ksat-ch-ar. Membership comes from the attribute, order and names
   come from the rail. That is the same data the chapter rail draws
   itself from, read the same way.

   If the rail is not there — the shell failed, or somebody removed it —
   this file builds NOTHING and the page is exactly what it was. A
   masthead that has to guess at its own groups is worse than the flat
   row it replaced.

   ---------------------------------------------------------------------
   THE BUG THIS FILE HAD TO BE DESIGNED AROUND
   ---------------------------------------------------------------------
   index.html's scroll-spy indexes the nav POSITIONALLY:

       const secs = NAV.map(s=>$("#"+s.id)).filter(Boolean);
       ... $$("#nav button").forEach((b,i)=>
             b.setAttribute("aria-current", String(NAV[i].id===id)))

   Two consequences, and both are fatal to the obvious implementation:

   1 · REORDERING THE BUTTONS MISALIGNS EVERY HIGHLIGHT. The chapter
       order is not the flat nav's order — #globe sits at NAV index 8,
       between `simulate` and `system`, but belongs to the `space`
       chapter alongside `imagery` and `explorer` at indices 3 and 4.
       Any grouping that physically moves the buttons puts #globe's
       button at a new index and every button after it inherits the
       wrong id.

   2 · A BUTTON ADDED INSIDE #nav WITH NO NAV ENTRY BEHIND IT THROWS.
       The callback reads NAV[i].id for every button it finds, so a
       fourteenth button makes NAV[13] undefined and NAV[13].id a
       TypeError — raised inside an IntersectionObserver callback, where
       it is swallowed by the console and takes the whole scroll-spy out
       silently. index.html gets away with its thirteenth because the
       splice above adds the array entry and the button together; a
       layer that adds only a button does not, and this is a layer.

   HOW THIS FILE GROUPS WITHOUT BREAKING THAT, stated plainly because
   the task asked for it in a comment:

       The thirteen buttons are never moved, never reordered, never
       removed, and nothing is ever added inside #nav. The grouped
       masthead is built as a SIBLING of .navwrap inside .bar-in, and
       .navwrap is hidden by one CSS rule keyed on
       html[data-ksat-navup="on"]. #nav keeps its children in their
       original order, so $$("#nav button")[i] still means NAV[i]
       and the spy is untouched. It goes on setting aria-current on
       buttons nobody can see, and a MutationObserver here mirrors that
       attribute onto the group it belongs to. The spy stays the single
       source of truth for "where am I"; we only repeat what it says.

   The same reasoning is already written up in js/ksat-shell.js section
   5, which hides locked nav buttons rather than deleting them for
   exactly this reason. This is that lesson applied one layer out.

   ---------------------------------------------------------------------
   AND THE OTHER THING THAT EATS FEATURES ON THIS PAGE
   ---------------------------------------------------------------------
   renderNav() does `n.innerHTML = ""` and rebuilds every button from
   scratch. It runs inside renderAll(), which fires on every
   language switch and on several other paths, so anything written onto
   those buttons is wiped seconds later. An earlier layer lost a whole
   feature to this. Because the grouped nav lives OUTSIDE #nav it
   survives the wipe on its own, but the buttons it mirrors do not — the
   observer below re-reads them, and the group labels repaint on
   ksat:lang.

   ---------------------------------------------------------------------
   WHOSE KEYS ARE WHOSE
   ---------------------------------------------------------------------
   Already bound on this page before we arrive:
     Ctrl/Cmd + /   js/ksat-assistant.js, opens the assistant
     Escape         index.html's intro, js/ksat-tour.js, the assistant,
                    the shell's gate and its chapter sheet
     Arrow L/R      js/ksat-tour.js while the guided tour is running
   Taken here:
     Ctrl/Cmd + K   open search.  The tour's handler returns early on
                    any of alt/ctrl/meta, and the assistant's is on "/"
                    and "?", so this collides with neither.
     /              open search, no modifier.  Distinct from the
                    assistant's Ctrl+/ for the same reason.
   Both are refused while the event target is an input, a textarea, a
   select or contenteditable — which is the guard the spec asked for and
   is also why "/" is safe to take at all, since it is a printable
   character somebody is entitled to type.

   Escape is handled at the CAPTURE phase. js/ksat-tour.js registers its
   document keydown at parse time and index.html's intro registers one
   too, both on bubble, so a bubble listener here would close the
   popover AND exit the guided tour on one press. Capture plus
   stopImmediatePropagation, and only when a popover is actually open.
   js/ksat-assistant.js registers its own capture listener before this
   file loads and stops the event immediately while its panel is open;
   that ordering is correct, not a collision — an open assistant panel
   outranks an open menu.

   ---------------------------------------------------------------------
   MOTION
   ---------------------------------------------------------------------
   There is no requestAnimationFrame loop in this file. Nothing animates
   continuously, so there is nothing to poll for a mid-session change of
   the OS setting. The one scroll this layer causes goes through
   SH.goToSection, which already honours prefers-reduced-motion, and the
   four CSS transitions come off in css/ksat-nav.css section 5.
   ===================================================================== */

(function () {
  'use strict';

  var KS = window.KSAT = window.KSAT || {};
  if (KS.nav) return;

  var root = document.documentElement;

  /* ===================================================================
     1 · SMALL HELPERS
     =================================================================== */

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function lang() {
    var code = root.getAttribute('data-ksat-lang') || root.lang || 'en';
    return String(code).toLowerCase().indexOf('ar') === 0 ? 'ar' : 'en';
  }

  function isRTL() {
    return root.getAttribute('dir') === 'rtl' || lang() === 'ar';
  }

  function reduced() {
    /* Asked at call time, never cached. index.html caches this once at
       load, so a reader who turns the OS setting on mid-session is not
       honoured there; here they are. */
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (e) { return false; }
  }

  function visible(n) {
    if (!n) return false;
    try { return !!(n.offsetWidth || n.offsetHeight || n.getClientRects().length); }
    catch (e) { return false; }
  }

  function inside(node, sel) {
    if (!node || !node.closest) return false;
    try { return !!node.closest(sel); } catch (e) { return false; }
  }

  var TYPING = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';

  /* ===================================================================
     1a · OUR OWN STRINGS, IN BOTH LANGUAGES

     THE PAGE REALLY DOES RENDER RTL ARABIC. js/ksat-i18n.js sets
     <html lang="ar" dir="rtl"> and rewrites 209 nodes. It will not
     translate anything in here — it walks [data-i18n], .badge,
     .ksat-fold-word and the chapter rail, and this layer is none of
     those — so every string this file puts on a screen exists as a
     pair and is repainted on ksat:lang. An earlier pass shipped twelve
     English-only strings on the belief that the page was English-only;
     that is the mistake this table exists to not repeat.

     Strings that are NOT in here on purpose: the six group names, the
     thirteen destination labels and every section heading. Those already
     exist in both languages — in the chapter rail, in index.html's own
     thirteen-entry NAV array, and in the headings themselves — and are
     read live from
     the DOM so they follow the language switch without a second copy
     to keep in step.
     =================================================================== */

  var TXT = {
    navLabel:   { en: 'Site sections, grouped', ar: 'أقسام الموقع، مُجمَّعة' },
    find:       { en: 'Search',                 ar: 'بحث' },
    findLabel:  { en: 'Search this site',       ar: 'ابحث في هذا الموقع' },
    findPh:     { en: 'Section, heading or chapter…',
                  ar: 'قسم أو عنوان أو فصل…' },
    findHint:   { en: 'Type to search the twenty-three sections of this site by name, heading or chapter.',
                  ar: 'اكتب للبحث في أقسام الموقع الثلاثة والعشرين بالاسم أو العنوان أو الفصل.' },
    none:       { en: 'Nothing matches that. Try a chapter name, or part of a heading.',
                  ar: 'لا يوجد ما يطابق ذلك. جرّب اسم فصل أو جزءاً من عنوان.' },
    resultsNone:{ en: 'No results',             ar: 'لا نتائج' },
    resultsOne: { en: '1 result',               ar: 'نتيجة واحدة' },
    resultsTwo: { en: '2 results',              ar: 'نتيجتان' },
    resultsFew: { en: '# results',              ar: '# نتائج' },
    resultsN:   { en: '# results',              ar: '# نتيجة' },
    moreIn:     { en: 'Also in this chapter',   ar: 'أيضاً في هذا الفصل' },
    locked:     { en: 'SIGN-IN',                ar: 'تسجيل دخول' },
    lockedLong: { en: 'requires researcher sign-in',
                  ar: 'يتطلب تسجيل دخول الباحثين' },
    /* Read after a group name, so it has to survive being said next to
       any numeral. A prepositional phrase does that in both languages;
       a counted noun would need the dual and two plurals in Arabic for
       no gain, since the number is right there. */
    lockedN:    { en: '# behind sign-in',       ar: '# خلف تسجيل الدخول' },
    toolsEye:   { en: 'Research tools',         ar: 'أدوات البحث' },
    toolsPub:   { en: 'The seven researcher workspaces. They need an account — open one and it tells you what it does and how to get in.',
                  ar: 'مساحات عمل الباحثين السبع. تحتاج إلى حساب — افتح أيّاً منها وسيوضّح لك ما تفعله وكيفية الدخول.' },
    toolsIns:   { en: 'Your seven workspaces, straight from here.',
                  ar: 'مساحات عملك السبع، من هنا مباشرة.' },
    toolsLabel: { en: 'Researcher workspaces',  ar: 'مساحات عمل الباحثين' },

    /* Six of the seven workspace destinations are named in NAV and are
       read from there, where the page's own short bilingual labels
       already live. `agent` is in no version of that array, so its name
       is ours outright. `console` IS in it — but only because of the
       run-time splice described at the head of this file, which is a
       thinner thread to hang a label on than a literal in the array. So
       the pair below stays as toolLabel()'s fallback: if that splice
       ever moves or goes, the chip reads Console rather than falling
       through to the section's full heading. */
    console:    { en: 'Console',                ar: 'وحدة التحكّم' },
    agent:      { en: 'Agent',                  ar: 'الوكيل' }
  };

  function T(key) {
    var o = TXT[key];
    if (!o) return '';
    return lang() === 'ar' && o.ar ? o.ar : o.en;
  }

  /* index.html's own L(): the Arabic if we are in Arabic and there is
     one, the English otherwise. Copied rather than borrowed because L
     is a const in the page's script scope and a layer should not lean
     on another file's local names for something this small. */
  function L(o) {
    if (!o) return '';
    return lang() === 'ar' && o.ar ? o.ar : (o.en || '');
  }

  function fill(key, n) {
    return T(key).split('#').join(String(n));
  }

  /* ARABIC DOES NOT PLURALISE THE WAY ENGLISH DOES, AND THE FIRST
     VERSION OF THIS PUT "3 نتيجة" ON SCREEN. Arabic takes the dual
     for two, the broken plural for three to ten, and the singular again
     from eleven up; English needs one and many and nothing else. The
     two languages therefore share the call and not the rule, which is
     why this is a function and not a format string. Search caps its
     results at fourteen, so every branch below is reachable. */
  function resultCount(n) {
    if (n === 0) return T('resultsNone');
    if (n === 1) return T('resultsOne');
    if (n === 2) return T('resultsTwo');
    return fill(n <= 10 ? 'resultsFew' : 'resultsN', n);
  }

  /* ===================================================================
     2 · THE MODEL, READ OUT OF THE PAGE

     Nothing in this section is declared. Every part of it is read from
     what js/ksat-shell.js and index.html have already put in the DOM.
     =================================================================== */

  var chapters = [];        // [{key, en, ar, node, ids:[...]}]
  var chOf = {};            // section id -> chapter key
  var navRows = [];         // [{id, i}] parallel to index.html's NAV

  function readChapters() {
    var rail = document.getElementById('ksat-ch-rail');
    if (!rail) return false;

    var items = rail.querySelectorAll('.ksat-ch-item[data-ksat-key]');
    if (!items.length) return false;

    chapters = [];
    chOf = {};

    for (var i = 0; i < items.length; i++) {
      chapters.push({
        key: items[i].getAttribute('data-ksat-key'),
        enNode: items[i].querySelector('.ksat-ch-en'),
        arNode: items[i].querySelector('.ksat-ch-ar'),
        ids: []
      });
    }

    /* MEMBERSHIP COMES FROM THE ATTRIBUTE, IN DOCUMENT ORDER.
       stamp() puts data-ksat-ch on sections, on the invitation panels
       that stand in for locked ones, and on #descent. Only the sections
       are destinations, so the selector says `section`: an invitation
       panel is not somewhere you navigate TO, it is what you are shown
       when you get there, and #descent is a canvas with no heading. */
    var secs = document.querySelectorAll('section[data-ksat-ch]');
    var byKey = {};
    for (var c = 0; c < chapters.length; c++) byKey[chapters[c].key] = chapters[c];

    for (var s = 0; s < secs.length; s++) {
      var key = secs[s].getAttribute('data-ksat-ch');
      var id = secs[s].id;
      if (!id || !byKey[key]) continue;
      byKey[key].ids.push(id);
      chOf[id] = key;
    }

    /* A chapter with no section in the page is not drawn. Nothing in
       index.html is expected to be missing, but the shell's own ids
       array is authored rather than derived and is explicitly allowed
       to name a section that does not exist yet. */
    chapters = chapters.filter(function (c) { return c.ids.length > 0; });
    return chapters.length > 0;
  }

  /* PICK THE NODE BY DIRECTION. DO NOT PICK IT BY WHAT i18n HAS DONE.

     The first version of this read .ksat-ch-en and trusted
     js/ksat-i18n.js to have rewritten it, because translateChapters()
     does exactly that: it matches the English name against CHAPTERS_AR
     and replaces the text in place. Seen in the browser on a page that
     had booted with lang="ar" and dir="rtl" from localStorage, all six
     groups came up in ENGLISH inside an otherwise fully Arabic
     masthead.

     The reason is an ordering one and it is permanent, not a race.
     js/ksat-i18n.js applies the stored language during its own boot;
     js/ksat-shell.js does not build the rail until index.html's
     renderNav() has filled #nav, which is later. So at the moment
     translateChapters() runs there is no rail to translate, and nothing
     re-runs it until a reader actually presses the language toggle.
     .ksat-ch-en therefore holds English on an Arabic first load and
     Arabic only after a manual switch.

     Reading the node that matches the CURRENT DIRECTION is right in
     both states at once: .ksat-ch-ar is never touched by that sweep and
     always holds the Arabic, and .ksat-ch-en holds the English whenever
     the page is in English. No cache, no ordering assumption. */
  function chName(c) {
    var n = isRTL() ? c.arNode : c.enNode;
    var v = n ? (n.textContent || '').trim() : '';
    if (v) return v;
    /* Fall back to the other node rather than to the key: a bare
       "planning" in the masthead would look like a bug, and the other
       name is at least a name. */
    var o = isRTL() ? c.enNode : c.arNode;
    v = o ? (o.textContent || '').trim() : '';
    return v || c.key;
  }

  function chNameAlt(c) {
    /* The Arabic, shown as a second line only while the page is in
       English — in Arabic it is already the first line. */
    if (isRTL()) return '';
    var n = c.arNode;
    return n ? (n.textContent || '').trim() : '';
  }

  /* index.html declares NAV as a top-level `const` in a classic script,
     which puts it in the shared global lexical environment — the same
     reason js/ksat-tour.js can read `const S` and `const DEMO` as bare
     identifiers, and the same guarded read js/ksat-shell.js already
     does in paintNavForTier(). It is not on `window`, so `window.NAV`
     is undefined and typeof is the only safe test. */
  function pageNav() {
    try { return (typeof NAV !== 'undefined' && NAV && NAV.length) ? NAV : null; }
    catch (e) { return null; }
  }

  function navButtons() {
    return document.querySelectorAll('#nav button');
  }

  function readNav() {
    var data = pageNav();
    if (!data) return false;
    navRows = [];
    for (var i = 0; i < data.length; i++) {
      if (!data[i] || !data[i].id) continue;
      navRows.push({ id: data[i].id, i: i, src: data[i] });
    }
    return navRows.length > 0;
  }

  function navRowFor(id) {
    for (var i = 0; i < navRows.length; i++) if (navRows[i].id === id) return navRows[i];
    return null;
  }

  /* IS THIS DESTINATION GATED? ASK THE SHELL, DO NOT KEEP A LIST.
     js/ksat-shell.js holds INSIDER as an array of ten ids and builds
     exactly one invitation panel per entry, with the id
     ksat-invite-<id>. Copying that array here would be a second list to
     keep in step with the first; probing for the panel it built is the
     same answer with no copy. The tier attribute is the shell's too. */
  function isLocked(id) {
    if (root.getAttribute('data-ksat-tier') === 'insider') return false;
    return !!document.getElementById('ksat-invite-' + id);
  }

  function clip(s, n) {
    s = (s || '').trim().replace(/\s+/g, ' ');
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  function headingOf(id) {
    var s = document.getElementById(id);
    if (!s || s.tagName !== 'SECTION') return '';
    var h = s.querySelector('h2.st') || s.querySelector('h1') || s.querySelector('h2');
    return h ? clip(h.textContent, 58) : '';
  }

  function eyebrowOf(id) {
    var s = document.getElementById(id);
    if (!s || s.tagName !== 'SECTION') return '';
    var lab = s.querySelector('.eyebrow .lab');
    return lab ? clip(lab.textContent, 64) : '';
  }

  /* The short label a destination is known by: index.html's own NAV
     word where there is one — it is already bilingual and it is what
     the flat nav has always called it — and the section's heading
     otherwise. */
  function destLabel(id) {
    var row = navRowFor(id);
    if (row) return L(row.src);
    return headingOf(id) || id;
  }

  /* ===================================================================
     3 · GOING SOMEWHERE

     One entry point, exactly as js/ksat-shell.js intends: goToSection()
     opens whichever chapter owns the section, and for a locked one it
     lands on the invitation panel with its lead sentence filled in and
     focus moved to the heading. That is the "let the click land on the
     invitation the shell already builds" requirement, and it is one
     call rather than a reimplementation.
     =================================================================== */

  function go(id) {
    var SH = KS.shell;
    if (SH && typeof SH.goToSection === 'function') {
      if (SH.goToSection(id)) return;
    }
    var n = document.getElementById(id);
    if (n) {
      try { n.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }); }
      catch (e) { n.scrollIntoView(); }
    }
  }

  /* ===================================================================
     4 · THE POPOVERS

     One open at a time. They are children of <body> and position:fixed,
     for the two reasons written up in css/ksat-nav.css section 2: the
     strip they hang off scrolls horizontally, and .bar carries a
     backdrop-filter, which in some engines makes it a containing block
     for fixed descendants. Fixed plus body-parented is the shape that
     behaves the same everywhere.
     =================================================================== */

  var openPop = null;       // the popover element currently down
  var openTrig = null;      // the control that opened it

  function place() {
    if (!openPop || !openTrig) return;
    var r = openTrig.getBoundingClientRect();
    var vw = window.innerWidth || document.documentElement.clientWidth;
    var vh = window.innerHeight || document.documentElement.clientHeight;

    /* Height first: the width measurement below has to happen with the
       final height in place, or a popover that wraps differently once
       it is clamped reports a width it will not keep. */
    openPop.style.maxHeight = Math.max(180, Math.min(560, vh - r.bottom - 18)) + 'px';

    var w = openPop.offsetWidth;
    /* Aligned to the reading edge of its control: the left edge in
       English, the right edge in Arabic. Then clamped into the
       viewport, which is what stops the last group in the row from
       opening half off-screen. */
    var x = isRTL() ? (r.right - w) : r.left;
    x = Math.max(12, Math.min(x, vw - w - 12));

    openPop.style.top = Math.round(r.bottom + 6) + 'px';
    openPop.style.left = Math.round(x) + 'px';
  }

  function closePop(returnFocus) {
    if (!openPop) return;
    var trig = openTrig;
    openPop.hidden = true;
    if (trig) trig.setAttribute('aria-expanded', 'false');
    openPop = null;
    openTrig = null;
    if (returnFocus && trig && document.contains(trig)) {
      try { trig.focus(); } catch (e) {}
    }
  }

  function showPop(pop, trig) {
    if (openPop === pop) { closePop(true); return; }
    closePop(false);
    openPop = pop;
    openTrig = trig;
    pop.hidden = false;
    trig.setAttribute('aria-expanded', 'true');
    place();
  }

  function popItems() {
    if (!openPop) return [];
    return Array.prototype.slice.call(openPop.querySelectorAll('.ksat-nav-item'));
  }

  function focusItem(i) {
    var list = popItems();
    if (!list.length) return;
    if (i < 0) i = 0;
    if (i > list.length - 1) i = list.length - 1;
    try { list[i].focus(); } catch (e) {}
  }

  /* ===================================================================
     5 · THE MASTHEAD ROW
     =================================================================== */

  var navEl = null, strip = null, findBtn = null, findPop = null, findIn = null;
  var findRes = null, findCount = null;
  var triggers = [];        // the six group controls, for roving tabindex

  function buildItem(id, rank) {
    var b = el('button', 'ksat-nav-item');
    b.type = 'button';
    b.setAttribute('data-ksat-id', id);
    if (rank) b.setAttribute('data-ksat-rank', rank);

    b.appendChild(el('span', 'ksat-nav-item-t', destLabel(id)));

    if (isLocked(id)) {
      var k = el('span', 'ksat-nav-item-lock', T('locked'));
      b.appendChild(k);
      /* The accessible name has to carry the gate too. The badge is two
         words of mono capitals; a screen reader user gets the sentence
         instead, because "SIGN-IN" read out after a destination name is
         ambiguous about which of the two it describes. */
      b.setAttribute('aria-label', destLabel(id) + ' — ' + T('lockedLong'));
    }

    var sub = eyebrowOf(id);
    if (sub) b.appendChild(el('span', 'ksat-nav-item-s', sub));

    b.addEventListener('click', function () {
      closePop(false);
      go(id);
    });
    return b;
  }

  function fillGroup(pop, c) {
    pop.textContent = '';

    var head = el('div', 'ksat-nav-pop-head');
    head.appendChild(el('span', 'ksat-nav-pop-en', chName(c)));
    var alt = chNameAlt(c);
    if (alt) {
      var a = el('span', 'ksat-nav-pop-ar', alt);
      a.setAttribute('dir', 'rtl');
      a.setAttribute('lang', 'ar');
      head.appendChild(a);
    }
    pop.appendChild(head);

    /* THE ORDER INSIDE A GROUP IS THE FLAT NAV'S ORDER, THEN THE PAGE'S.
       The thirteen destinations index.html already names come first,
       under the page's own short labels, because those are the words
       the site has always used for them. The rest of the chapter — the
       sections the flat nav never named at all — follow under their own
       headings. Nothing new is written to fill a group out; a group is
       exactly as large as the reading behind it. */
    var named = [], rest = [];
    for (var i = 0; i < c.ids.length; i++) {
      (navRowFor(c.ids[i]) ? named : rest).push(c.ids[i]);
    }
    named.sort(function (a, b) { return navRowFor(a).i - navRowFor(b).i; });

    for (var n = 0; n < named.length; n++) pop.appendChild(buildItem(named[n], 'named'));

    if (rest.length) {
      pop.appendChild(el('div', 'ksat-nav-more', T('moreIn')));
      for (var r = 0; r < rest.length; r++) pop.appendChild(buildItem(rest[r], 'more'));
    }

    markCurrentIn(pop);
  }

  function lockedCount(c) {
    var n = 0;
    for (var i = 0; i < c.ids.length; i++) if (isLocked(c.ids[i])) n++;
    return n;
  }

  function groupName(c) {
    var n = lockedCount(c);
    return n ? chName(c) + ' — ' + fill('lockedN', n) : chName(c);
  }

  function buildGroups() {
    triggers = [];
    strip.textContent = '';

    chapters.forEach(function (c, i) {
      var popId = 'ksat-nav-pop-' + c.key;

      var b = el('button', 'ksat-nav-g');
      b.type = 'button';
      b.setAttribute('data-ksat-g', c.key);
      b.setAttribute('aria-expanded', 'false');
      b.setAttribute('aria-controls', popId);
      /* NO aria-haspopup HERE, DELIBERATELY. aria-haspopup="true" is a
         synonym for "menu", and this is not a menu: the items are
         ordinary buttons, not menuitems, and announcing a menu that
         does not behave like one is worse than announcing nothing.
         aria-expanded plus aria-controls says the true thing — this
         control shows and hides that group of links. The page's only
         other two aria-haspopup are on real dialogs and stay that way. */

      /* ROVING TABINDEX, THE SAME PATTERN THE CHAPTER RAIL USES.
         Six labels are one composite control, so Tab reaches the row
         once and the arrows move within it. js/ksat-shell.js does this
         on .ksat-ch-item with onRailKey; following it keeps one
         keyboard model on the page instead of two. */
      b.setAttribute('tabindex', i === 0 ? '0' : '-1');

      b.appendChild(el('span', 'ksat-nav-g-en', chName(c)));

      var lk = lockedCount(c);
      if (lk) b.appendChild(el('span', 'ksat-nav-lock', String(lk)));
      /* THE NUMERAL ON ITS OWN IS NOT A SENTENCE. Seen with a screen
         reader, a trigger whose content is "Kuwait From Space" and "2"
         announces "Kuwait From Space 2", which sounds like an ordinal
         and tells nobody what the two are. An explicit name on the
         control says the whole thing and, because aria-label replaces
         the subtree, also stops the caret and the badge being read
         twice. groupName() is the single place that builds it, so the
         first build and every relabel() agree. */
      b.setAttribute('aria-label', groupName(c));

      var car = el('span', 'ksat-nav-caret', '▾');
      car.setAttribute('aria-hidden', 'true');
      b.appendChild(car);

      var pop = el('div', 'ksat-nav-pop');
      pop.id = popId;
      pop.hidden = true;
      pop.setAttribute('role', 'group');
      pop.setAttribute('aria-label', chName(c));
      document.body.appendChild(pop);

      b.addEventListener('click', function () {
        if (openPop === pop) { closePop(true); return; }
        fillGroup(pop, c);          // rebuilt on every open: labels,
        showPop(pop, b);            // locks and the current marker are
      });                           // all live state

      b.addEventListener('keydown', function (e) { onTriggerKey(e, b, pop, c); });
      pop.addEventListener('keydown', onPopKey);

      c.trigger = b;
      c.pop = pop;
      triggers.push(b);
      strip.appendChild(b);
    });
  }

  function buildFind() {
    findBtn = el('button', 'ksat-nav-find');
    findBtn.type = 'button';
    findBtn.setAttribute('aria-expanded', 'false');
    findBtn.setAttribute('aria-controls', 'ksat-nav-find-pop');
    findBtn.appendChild(el('span', 'ksat-nav-find-t', T('find')));

    /* The keycap is the platform's, not a translated word: ⌘ on a Mac
       and Ctrl everywhere else. It is aria-hidden because a screen
       reader announcing "command K" as part of the button name is
       noise — the control is called Search and the shortcut is a
       convenience for people who can see it. */
    var mac = false;
    try { mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || ''); }
    catch (e) {}
    var cap = el('span', 'ksat-nav-key', mac ? '⌘K' : 'Ctrl K');
    cap.setAttribute('aria-hidden', 'true');
    findBtn.appendChild(cap);

    findPop = el('div', 'ksat-nav-pop');
    findPop.id = 'ksat-nav-find-pop';
    findPop.hidden = true;
    findPop.setAttribute('data-ksat-find', '1');
    findPop.setAttribute('role', 'group');
    findPop.setAttribute('aria-label', T('findLabel'));

    findIn = el('input', 'ksat-nav-find-in');
    findIn.type = 'search';
    findIn.autocomplete = 'off';
    findIn.setAttribute('spellcheck', 'false');
    findPop.appendChild(findIn);

    findCount = el('div', 'ksat-nav-count');
    findCount.setAttribute('role', 'status');
    findCount.setAttribute('aria-live', 'polite');
    findPop.appendChild(findCount);

    findRes = el('div', 'ksat-nav-res');
    findPop.appendChild(findRes);

    document.body.appendChild(findPop);

    findBtn.addEventListener('click', function () { toggleFind(); });
    findIn.addEventListener('input', function () { paintResults(); });
    findIn.addEventListener('keydown', onFindKey);
    findPop.addEventListener('keydown', onPopKey);

    strip.appendChild(findBtn);
  }

  /* ===================================================================
     6 · SEARCH

     THE CORPUS IS THE PAGE ITSELF. Every section's id, its heading, its
     eyebrow, the short label the flat nav gives it, and the name of the
     chapter that owns it — all read out of the DOM at the moment the
     query is typed, which is why this needs no dictionary and follows
     the language switch for free. Searching "خريطة" and searching "map"
     both find #map, because in Arabic the headings ARE Arabic.
     =================================================================== */

  function corpus() {
    var out = [];
    for (var c = 0; c < chapters.length; c++) {
      var ch = chapters[c];
      var cn = chName(ch), ca = ch.arNode ? (ch.arNode.textContent || '').trim() : '';
      var ce = ch.enNode ? (ch.enNode.textContent || '').trim() : '';
      for (var i = 0; i < ch.ids.length; i++) {
        var id = ch.ids[i];
        var title = destLabel(id);
        var head = headingOf(id);
        var eye = eyebrowOf(id);
        out.push({
          id: id,
          title: title,
          sub: eye || head,
          chKey: ch.key,
          chName: cn,
          hay: (id + ' ' + title + ' ' + head + ' ' + eye + ' ' +
                ce + ' ' + ca).toLowerCase()
        });
      }
    }
    return out;
  }

  function search(q) {
    q = (q || '').trim().toLowerCase();
    if (!q) return [];
    var parts = q.split(/\s+/);
    var rows = corpus(), out = [];
    for (var i = 0; i < rows.length && out.length < 14; i++) {
      var ok = true;
      for (var p = 0; p < parts.length; p++) {
        if (rows[i].hay.indexOf(parts[p]) === -1) { ok = false; break; }
      }
      if (ok) out.push(rows[i]);
    }
    return out;
  }

  /* The matched run is wrapped in <mark> rather than bolded: it keeps
     working in forced-colours mode and it is the element a screen
     reader can be told about. Built with DOM nodes, never innerHTML —
     the needle is whatever the reader typed and this page has a strict
     CSP for a reason. */
  function markUp(node, text, needle) {
    var at = needle ? text.toLowerCase().indexOf(needle) : -1;
    if (at === -1) { node.textContent = text; return; }
    node.textContent = '';
    node.appendChild(document.createTextNode(text.slice(0, at)));
    node.appendChild(el('mark', null, text.slice(at, at + needle.length)));
    node.appendChild(document.createTextNode(text.slice(at + needle.length)));
  }

  function paintResults() {
    var q = findIn.value || '';
    var needle = q.trim().toLowerCase().split(/\s+/)[0] || '';
    var hits = search(q);

    findRes.textContent = '';

    if (!q.trim()) {
      findCount.textContent = '';
      findRes.appendChild(el('p', 'ksat-nav-empty', T('findHint')));
      place();
      return;
    }

    findCount.textContent = resultCount(hits.length);

    if (!hits.length) {
      findRes.appendChild(el('p', 'ksat-nav-empty', T('none')));
      place();
      return;
    }

    hits.forEach(function (h) {
      var b = el('button', 'ksat-nav-item');
      b.type = 'button';
      b.setAttribute('data-ksat-id', h.id);

      var t = el('span', 'ksat-nav-item-t');
      markUp(t, h.title, needle);
      b.appendChild(t);

      if (isLocked(h.id)) {
        b.appendChild(el('span', 'ksat-nav-item-lock', T('locked')));
        b.setAttribute('aria-label', h.title + ' — ' + h.chName + ' — ' + T('lockedLong'));
      } else {
        b.setAttribute('aria-label', h.title + ' — ' + h.chName);
      }

      /* The chapter is part of every result line, because opening a
         result opens its chapter: telling a reader which one AFTER the
         page has jumped is telling them too late. */
      b.appendChild(el('span', 'ksat-nav-item-s', h.chName + (h.sub ? ' · ' + h.sub : '')));

      b.addEventListener('click', function () {
        closePop(false);
        go(h.id);
      });
      findRes.appendChild(b);
    });

    place();
  }

  function toggleFind() {
    if (openPop === findPop) { closePop(true); return; }
    findIn.placeholder = T('findPh');
    findIn.setAttribute('aria-label', T('findLabel'));
    findPop.setAttribute('aria-label', T('findLabel'));
    paintResults();
    showPop(findPop, findBtn);
    setTimeout(function () { try { findIn.focus(); findIn.select(); } catch (e) {} }, 20);
  }

  /* ===================================================================
     7 · KEYBOARD
     =================================================================== */

  function onTriggerKey(e, b, pop, c) {
    var fwd  = isRTL() ? 'ArrowLeft' : 'ArrowRight';
    var back = isRTL() ? 'ArrowRight' : 'ArrowLeft';
    var i = triggers.indexOf(b), next = -1;

    if (e.key === fwd) next = (i + 1) % triggers.length;
    else if (e.key === back) next = (i - 1 + triggers.length) % triggers.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = triggers.length - 1;
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (openPop !== pop) { fillGroup(pop, c); showPop(pop, b); }
      setTimeout(function () { focusItem(0); }, 0);
      return;
    } else {
      return;
    }

    e.preventDefault();
    for (var k = 0; k < triggers.length; k++) {
      triggers[k].setAttribute('tabindex', k === next ? '0' : '-1');
    }
    /* Moving along the row while a group is down closes it. Leaving it
       open would leave a panel hanging under a control that no longer
       has focus, which reads as a rendering fault. */
    if (openPop) closePop(false);
    try { triggers[next].focus(); } catch (err) {}
  }

  function onPopKey(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' ||
        e.key === 'Home' || e.key === 'End') {
      var list = popItems();
      if (!list.length) return;
      var i = list.indexOf(document.activeElement);
      e.preventDefault();
      if (e.key === 'Home') focusItem(0);
      else if (e.key === 'End') focusItem(list.length - 1);
      else if (e.key === 'ArrowDown') focusItem(i < 0 ? 0 : i + 1);
      else {
        /* Up from the first result in the search popover goes back to
           the input rather than nowhere, because the next thing a
           reader wants after running out of results upwards is to edit
           the query. */
        if (i <= 0 && openPop === findPop) { try { findIn.focus(); } catch (err) {} }
        else focusItem(i < 0 ? 0 : i - 1);
      }
    }
  }

  function onFindKey(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); focusItem(0); return; }
    if (e.key === 'Enter') {
      /* Enter in the field opens the first result. With no results it
         does nothing, deliberately: a form that submits to nowhere is
         worse than a key that does not fire. */
      e.preventDefault();
      var list = popItems();
      if (list.length) list[0].click();
    }
  }

  /* THE TWO GLOBAL HOTKEYS. Bubble phase is correct for these: nobody
     else on the page claims Ctrl/Cmd+K or a bare "/", and the guided
     tour's handler returns early on any modifier, so there is nothing
     to get in front of. */
  function onHotkey(e) {
    if (e.defaultPrevented) return;
    if (e.isComposing || e.keyCode === 229) return;

    /* NEVER FIRE WHILE SOMEBODY IS TYPING. "/" is a printable
       character; taking it inside the analyst's question box or the
       research brief would eat the keystroke and look like a broken
       field. The same guard covers Ctrl/Cmd+K for free. */
    if (inside(e.target, TYPING)) return;
    if (e.target && e.target.isContentEditable) return;

    /* The launch-countdown intro is a full-screen overlay that owns the
       whole first few seconds, and the assistant panel owns the
       keyboard while it is open. Neither wants a menu opening behind
       it. */
    if (visible(document.getElementById('intro'))) return;
    if (root.getAttribute('data-ksat-assistant') === 'open') return;

    var isK = (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey &&
              (e.key === 'k' || e.key === 'K');
    var isSlash = !e.ctrlKey && !e.metaKey && !e.altKey && e.key === '/';

    if (!isK && !isSlash) return;
    if (!findPop) return;
    e.preventDefault();
    if (openPop === findPop) { try { findIn.focus(); findIn.select(); } catch (err) {} }
    else toggleFind();
  }

  /* ESCAPE, AT THE CAPTURE PHASE, AND ONLY WHEN WE ACTUALLY HAVE
     SOMETHING OPEN. js/ksat-tour.js and index.html's intro both listen
     on bubble at document/window, so a bubble listener here would close
     the popover and exit the guided tour on the same press.
     stopImmediatePropagation as well as stopPropagation, because
     capture listeners on the same node are not stopped by the latter —
     the assistant's file learned that one first and wrote it down. */
  function onEscape(e) {
    if (e.key !== 'Escape' && e.key !== 'Esc') return;
    if (e.isComposing || e.keyCode === 229) return;
    if (!openPop) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    closePop(true);
  }

  /* ===================================================================
     8 · MIRRORING THE PAGE'S OWN SCROLL-SPY

     index.html sets aria-current="true" on one of the thirteen buttons
     as the reader scrolls — they are still there and still observed,
     it is only their container that this layer folds away. We do not compute "where am I"
     ourselves — two answers to that question on one page is how they
     start disagreeing. We read theirs.
     =================================================================== */

  function currentId() {
    var btns = navButtons();
    for (var i = 0; i < btns.length && i < navRows.length; i++) {
      /* navRows[i] is NAV[i] by construction, and the buttons are in
         NAV order because nothing in this layer ever touches them. */
      if (btns[i].getAttribute('aria-current') === 'true') return navRows[i].id;
    }
    return null;
  }

  function markCurrentIn(pop) {
    var id = currentId();
    var items = pop.querySelectorAll('.ksat-nav-item');
    for (var i = 0; i < items.length; i++) {
      items[i].setAttribute('data-ksat-here',
        items[i].getAttribute('data-ksat-id') === id ? 'true' : 'false');
    }
  }

  function mirrorCurrent() {
    var id = currentId();
    var key = id ? chOf[id] : null;
    for (var i = 0; i < chapters.length; i++) {
      var on = key && chapters[i].key === key;
      if (chapters[i].trigger) {
        chapters[i].trigger.setAttribute('data-ksat-here', on ? 'true' : 'false');
      }
    }
    if (openPop && openPop !== findPop) markCurrentIn(openPop);
  }

  /* renderNav() empties #nav and rebuilds it from scratch on every
     language switch, so the buttons we read are not the buttons we read
     last time. This is the only reliable hook: we do not own that
     function and must not fight it for ownership. childList catches the
     rebuild; the attribute filter catches the scroll-spy's own writes
     and the shell's tier pass. */
  var navObs = null;
  function watchPageNav() {
    var n = document.getElementById('nav');
    if (!n || navObs || typeof MutationObserver === 'undefined') return;
    navObs = new MutationObserver(function () { mirrorCurrent(); });
    navObs.observe(n, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-current', 'hidden']
    });
  }

  /* ===================================================================
     9 · THE RESEARCH TOOLS BAND                        spec section 3

     The seven workspace destinations the spec names, in the order it
     names them. They are the same seven js/ksat-appearance.js marks
     data-ksat-layer="workspace", which is why the band can wear that
     attribute and inherit the workspace register from
     css/ksat-nasa.css section 6 rather than inventing a look.

     WHY IT IS ABOVE THE HERO. "Reachable from the homepage without
     passing through promotional content" — the hero IS the promotional
     content, so the band is the first child of .wrap and sits above it.
     It is a <div> rather than a <section>, so the shell's chapters
     never hide it and it is there under all six. That is the same shape
     as #descent, which stood at its full 400px under every chapter and
     was a bug; the difference is that this is one 30px row and is meant
     to persist. Keep it that size.

     WHY IT SAYS "SIGN-IN" ON SIX OR SEVEN CHIPS RATHER THAN HIDING
     THEM. All seven are insider surfaces, so for a signed-out visitor
     every one of them is gated. A quick-access row that leads a visitor
     into seven walls is worse than no row; one that names the wall
     before they click, and then lands them on the invitation panel
     explaining what is behind it, is the honest version. The click goes
     through SH.goToSection, which builds that landing.
     =================================================================== */

  var TOOLS = ['console', 'explorer', 'dashboard', 'map', 'simulate', 'ai', 'agent'];

  var toolsBand = null, toolsRow = null, toolsNote = null, toolsEye = null;

  function toolLabel(id) {
    var row = navRowFor(id);
    if (row) return L(row.src);          /* the page's own bilingual word */
    if (TXT[id]) return T(id);           /* console and agent, ours       */
    return headingOf(id) || id;
  }

  function buildTools() {
    var wrap = document.querySelector('main .wrap') || document.querySelector('.wrap');
    if (!wrap || document.getElementById('ksat-tools')) return;

    toolsBand = el('div', null);
    toolsBand.id = 'ksat-tools';
    toolsBand.setAttribute('data-ksat-layer', 'workspace');
    toolsBand.setAttribute('role', 'navigation');
    toolsBand.setAttribute('aria-label', T('toolsLabel'));

    var head = el('div', 'ksat-tools-head');
    toolsEye = el('span', 'ksat-tools-eyebrow', T('toolsEye'));
    head.appendChild(toolsEye);
    toolsNote = el('p', 'ksat-tools-note', '');
    head.appendChild(toolsNote);
    toolsBand.appendChild(head);

    toolsRow = el('div', 'ksat-tools-row');
    toolsBand.appendChild(toolsRow);

    wrap.insertBefore(toolsBand, wrap.firstChild);
    paintTools();
  }

  function paintTools() {
    if (!toolsRow) return;
    var insider = root.getAttribute('data-ksat-tier') === 'insider';

    toolsEye.textContent = T('toolsEye');
    toolsNote.textContent = insider ? T('toolsIns') : T('toolsPub');
    toolsBand.setAttribute('aria-label', T('toolsLabel'));

    toolsRow.textContent = '';
    TOOLS.forEach(function (id) {
      if (!document.getElementById(id)) return;   // no-op safely if a
                                                  // section is not there
      var locked = isLocked(id);
      var b = el('button', 'ksat-tools-item');
      b.type = 'button';
      b.setAttribute('data-ksat-id', id);
      b.setAttribute('data-ksat-locked', locked ? 'true' : 'false');

      var dot = el('span', 'ksat-tools-key');
      dot.setAttribute('aria-hidden', 'true');
      b.appendChild(dot);
      b.appendChild(el('span', null, toolLabel(id)));

      if (locked) b.setAttribute('aria-label', toolLabel(id) + ' — ' + T('lockedLong'));

      b.addEventListener('click', function () {
        closePop(false);
        go(id);
      });
      toolsRow.appendChild(b);
    });
  }

  /* ===================================================================
     10 · REPAINTING
     =================================================================== */

  function relabel() {
    if (!strip) return;
    navEl.setAttribute('aria-label', T('navLabel'));
    chapters.forEach(function (c) {
      if (!c.trigger) return;
      var t = c.trigger.querySelector('.ksat-nav-g-en');
      if (t) t.textContent = chName(c);
      /* groupName(), not chName(): an earlier version relabelled with
         the bare chapter name here, so the first language switch threw
         away the "2 behind sign-in" half of every accessible name and
         nothing on screen changed to show it. */
      c.trigger.setAttribute('aria-label', groupName(c));
      if (c.pop) c.pop.setAttribute('aria-label', chName(c));
      var lk = c.trigger.querySelector('.ksat-nav-lock');
      var n = lockedCount(c);
      if (lk && !n) lk.remove();
      else if (lk) lk.textContent = String(n);
      else if (n) {
        var mark = el('span', 'ksat-nav-lock', String(n));
        c.trigger.insertBefore(mark, c.trigger.querySelector('.ksat-nav-caret'));
      }
    });
    var ft = findBtn && findBtn.querySelector('.ksat-nav-find-t');
    if (ft) ft.textContent = T('find');
    if (findIn) {
      findIn.placeholder = T('findPh');
      findIn.setAttribute('aria-label', T('findLabel'));
    }
    /* An open group is rebuilt where it stands, so a language switch
       with a menu down does not leave half of it in the old language. */
    if (openPop && openPop !== findPop) {
      for (var i = 0; i < chapters.length; i++) {
        if (chapters[i].pop === openPop) { fillGroup(openPop, chapters[i]); break; }
      }
      place();
    } else if (openPop === findPop) {
      paintResults();
    }
    paintTools();
    mirrorCurrent();
  }

  /* ===================================================================
     11 · BOOT

     WHY WE WAIT FOR THE SHELL AND NOT JUST FOR THE DOM. Everything this
     layer groups by is written by js/ksat-shell.js: data-ksat-ch comes
     from stamp(), the chapter rail comes from buildRail(), and the
     invitation panels we probe for the lock state come from
     buildAllPanels(). All three happen inside start(), and start()
     itself waits for index.html's renderNav() to have filled #nav. The
     shell announces the end of that with data-ksat-shell="ready", so
     that attribute is the one signal that says every input this file
     needs exists.
     =================================================================== */

  function build() {
    var barIn = document.querySelector('.bar-in');
    var navwrap = document.querySelector('.navwrap');
    if (!barIn || !navwrap) return false;
    if (!readChapters()) return false;
    if (!readNav()) return false;

    navEl = el('nav', null);
    navEl.id = 'ksat-nav';
    navEl.setAttribute('aria-label', T('navLabel'));

    strip = el('div', 'ksat-nav-strip');
    navEl.appendChild(strip);

    buildGroups();
    buildFind();

    /* AFTER .navwrap, NOT INSIDE IT. css/ksat-theme.css gives .navwrap
       order:3 in the two-row masthead; ours takes the same order and
       follows it in document order, so it lands in exactly the row the
       flat nav used to occupy. */
    navwrap.insertAdjacentElement('afterend', navEl);

    /* buildTools() is NOT called any more. It built the RESEARCH TOOLS
       band - the seven workspace chips and the line explaining that they
       need an account. The team's words: "why would an outsider know about
       these Research tools". They are reachable from the grouped nav for
       anyone who signs in, so the band was telling strangers about doors
       they cannot open. The builder stays for the signed-in surface. */
    watchPageNav();
    mirrorCurrent();

    /* Only now. The CSS rule that folds the original nav is keyed on
       this attribute, so if anything above returned false the page
       keeps the row it already had. */
    root.setAttribute('data-ksat-navup', 'on');
    return true;
  }

  function wire() {
    document.addEventListener('keydown', onHotkey);
    document.addEventListener('keydown', onEscape, true);

    /* Click-outside on mousedown rather than click: the shell's chapter
       sheet does the same, and mousedown is the press a reader reads as
       "I have dismissed that". */
    document.addEventListener('mousedown', function (e) {
      if (!openPop) return;
      if (openPop.contains(e.target)) return;
      if (navEl && navEl.contains(e.target)) return;
      closePop(false);
    });

    /* Tabbing out of an open popover closes it. Without this the panel
       stays down behind a reader who has already moved on, and the next
       Escape they press belongs to something else. */
    document.addEventListener('focusin', function (e) {
      if (!openPop) return;
      if (openPop.contains(e.target)) return;
      if (openTrig === e.target) return;
      closePop(false);
    });

    window.addEventListener('resize', function () { place(); });
    /* THE MASTHEAD IS NOT STICKY ON THIS PAGE, WHATEVER index.html SAYS.
       index.html:.bar declares position:sticky, but css/ksat-detail.css
       later sets `main, .bar, footer { position: relative; z-index: 1 }`
       and wins, so the whole bar scrolls away with the page. Measured in
       the browser: at scrollY 1500 the bar's rect top is -1500, not 0.
       js/ksat-tour.css found the same thing and wrote it down; this is
       that note applied to a popover.

       Two consequences, and the handler does both. While the trigger is
       still on screen the panel is re-placed, because position:fixed
       does not follow a control that moves. Once the trigger has left
       the viewport the panel is closed instead: a menu tracking its
       button off the top of the screen is a menu nobody can reach and
       nobody asked to keep open. Focus is deliberately NOT returned on
       that close — the reader is scrolling, and pulling focus back to a
       control above them would drag the page back up with it. */
    window.addEventListener('scroll', function () {
      if (!openPop || !openTrig) return;
      var r = openTrig.getBoundingClientRect();
      var vh = window.innerHeight || document.documentElement.clientHeight || 0;
      if (r.bottom <= 0 || r.top >= vh) closePop(false);
      else place();
    }, { passive: true });

    /* js/ksat-i18n.js dispatches this AFTER its own sweep, including
       the one that rewrites the chapter rail we read our group names
       from. The timeout puts us after js/ksat-shell.js's own repaint,
       which is registered on the same event, so whoever runs last is
       still us. */
    document.addEventListener('ksat:lang', function () { setTimeout(relabel, 0); });

    /* Signing in or out changes which destinations are gated, which
       changes the lock count on three of the six groups and every chip
       in the research band. */
    document.addEventListener('ksat:identity', function () {
      setTimeout(function () { relabel(); }, 0);
    });

    /* A chapter change moves the reader, and the scroll-spy will catch
       up on its own — but not until the next intersection, which on a
       short chapter can be never. */
    document.addEventListener('ksat:chapter', function () {
      setTimeout(mirrorCurrent, 60);
    });
  }

  function boot() {
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      var ready = root.getAttribute('data-ksat-shell') === 'ready';
      if (ready) {
        clearInterval(iv);
        try {
          if (build()) { wire(); KS.nav = { chapters: chapters.length }; }
          else console.warn('[ksat-nav] inputs missing; the original nav is left as it was');
        } catch (e) { console.warn('[ksat-nav]', e); }
        return;
      }
      if (tries > 80) {                 /* ~12 s, then give up quietly */
        clearInterval(iv);
        console.warn('[ksat-nav] js/ksat-shell.js never reported ready; nothing built');
      }
    }, 150);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})();
