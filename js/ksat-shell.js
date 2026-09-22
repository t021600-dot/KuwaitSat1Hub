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
     THIS PARAGRAPH USED TO END "the page is English-only and isRTL() is
     always false", and it is no longer true. js/ksat-i18n.js now drives
     a real language switch: measured on the running page at
     http://127.0.0.1:8800, <html> carries dir="rtl" lang="ar" and the
     chapter pill reads "فصل 1/6 · السجل" straight out of the TXT table
     in section 1a below. So isRTL() returns true in Arabic and every
     `ar` string in this file is live copy, not dead weight.

     The sentence is called out rather than quietly deleted because of
     what it invited. A maintainer reading "isRTL() is always false"
     has been told, in the file's own voice, that the Arabic half of
     TXT can never render - which is an argument for deleting it, and
     deleting content is the one thing this layer promises never to do.
     A stale comment that argues for removing working bilingual copy is
     worth more than a wrong line number, so it gets a paragraph. */
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
     1a · OUR OWN STRINGS

     js/ksat-i18n.js is not ours to edit, and it translates this layer
     by matching the ENGLISH text of our controls against a table it
     holds (ksat-i18n.js:449). Any label it has no entry for therefore
     comes back in English on a switch to Arabic. Worse, it caches the
     first English it ever saw on each node, and the chapter FAB's
     label changes every time you open a chapter - so that cache goes
     stale within seconds of arriving.

     So the strings this file adds live here, in the {en, ar} shape
     that file already uses, and we repaint after its own pass (see the
     ksat:lang listener in start()). SH.strings exports them so they
     can be folded into the shared catalogue later without a second
     translation pass.
     =================================================================== */
  var TXT = {
    modeChapters: { en: 'Reading in chapters',
                    ar: 'القراءة على هيئة فصول' },
    modeScroll:   { en: 'Continuous scroll',
                    ar: 'تمرير متواصل' },
    toScroll:     { en: 'Switch to continuous scroll',
                    ar: 'التحويل إلى التمرير المتواصل' },
    backToCh:     { en: 'Back to chapters',
                    ar: 'العودة إلى الفصول' },
    modeNote:     { en: 'This choice lasts for this visit only. Chapters come back next time.',
                    ar: 'هذا الاختيار ساري لهذه الزيارة فقط. تعود الفصول في المرة القادمة.' },
    /* {n} IS COUNTED, NEVER TYPED. Both of these said 24 until the
       capstone team section was taken out of index.html, and then they
       said 24 about a page with 23 sections in it. A layer whose entire
       claim is "nothing is removed and everything is reachable" cannot
       be the thing on screen that is out by one, so the number is now
       whatever sectionCount() actually finds in the page. */
    allShown:     { en: 'Continuous scroll. All {n} sections shown.',
                    ar: 'تمرير متواصل. جميع الأقسام الـ{n} معروضة.' },
    /* This one was hard-coded English in buildRail() and js/ksat-i18n.js
       has no entry for it, so it stood in English inside an otherwise
       Arabic rail. It lives here now, which is where our strings go. */
    railNote:     { en: 'All {n} sections are present. Chapters only change what is on screen.',
                    ar: 'جميع الأقسام الـ{n} موجودة. الفصول تغيّر ما يظهر على الشاشة فقط.' },
    chAbbr:       { en: 'Ch', ar: 'فصل' },
    researcherSurface: { en: 'RESEARCHER SURFACE', ar: 'واجهة الباحثين' },
    signInToOpen:      { en: 'Sign in to open this section',
                         ar: 'تسجيل الدخول لفتح هذا القسم' },

    /* ---------------------------------------------------------------
       THE REST OF THIS LAYER'S CHROME, WHICH WAS STILL ENGLISH.

       Everything below was a string literal sitting at its call site.
       That was invisible for as long as the page was English-only —
       which is what the note at the top of this file asserted, and is
       no longer how the page behaves: js/ksat-i18n.js now really does
       put dir="rtl" lang="ar" on <html>. Measured on the running page
       in Arabic before this table was extended, the masthead read
       "Researcher sign in" in Latin script beside an otherwise Arabic
       nav, the orientation note under the hero was a full English
       paragraph, and the chapter rail was headed "Chapters" above a
       list whose own items were already bilingual.

       railNote three entries up has the comment explaining why a
       string belongs here rather than at its call site. This is that
       same fix, finished: it was applied to one string and the other
       nine were left behind, in the same file, in the same pass.

       tierNote's count is {n} for exactly the reason allShown's is.
       It read "Ten working sections" as a typed English word, so it
       would have gone stale the moment an instrument was added or
       taken out - the same failure as the "24 sections" that this
       file's own comments describe at length. It is INSIDER counted
       against the page now, like everything else here.
       --------------------------------------------------------------- */
    tierNote:     { en: 'You are reading the public record. {n} working sections, the dashboards, the maps, the numbers and the agent console, open for signed-in researchers.',
                    ar: 'أنت تطالع السجل العام. {n} أقسام عاملة, اللوحات والخرائط والأرقام وكونسول الوكلاء, تُفتح للباحثين المسجَّلين.' },
    showWhich:    { en: 'Show me which',
                    ar: 'أرِني أيّ الأقسام' },
    dismissNote:  { en: 'Dismiss this note',
                    ar: 'إخفاء هذه الملاحظة' },
    signIn:       { en: 'Researcher sign in',
                    ar: 'دخول الباحثين' },
    signInNoDb:   { en: 'Sign in, database not connected',
                    ar: 'تسجيل الدخول, قاعدة البيانات غير متصلة' },
    signInNoDbWhy:{ en: 'js/config.js has no Supabase project configured.',
                    ar: 'لا يوجد مشروع Supabase مهيّأ في js/config.js.' },
    closeSignIn:  { en: 'Close sign in',
                    ar: 'إغلاق تسجيل الدخول' },
    skipToCh:     { en: 'Skip to chapter content',
                    ar: 'تخطٍّ إلى محتوى الفصل' },
    chapters:     { en: 'Chapters',
                    ar: 'الفصول' },
    siteChapters: { en: 'Site chapters',
                    ar: 'فصول الموقع' },
    behindPanel:  { en: 'Behind this panel',
                    ar: 'خلف هذه اللوحة' },
    /* THE LINE A DEEP LINK WRITES INTO A PANEL — AND THE "the the" IT
       USED TO PRODUCE. goToSection() built this sentence at its call
       site, as 'You were heading for the ' + title.toLowerCase() + '.'
       Five of the ten panel titles begin with "The" themselves, so a
       reader who followed the nav to #console was told "You were
       heading for the the research brief.", and one who followed it to
       #charts got "the reading the record." It was English on an
       Arabic page besides, which is how it comes to be here.

       The title now goes in whole, after an em dash, which is
       grammatical whatever the title says and in either language.

       {x} is a second token beside {n}. The note on tn() below says
       one placeholder is all this layer needs; that stopped being true
       here, because what is substituted is a title rather than a
       count, and a count and a title cannot share a token name and
       still read clearly at the call site. */
    leadFor:      { en: 'You were heading for this section, {x}.',
                    ar: 'كنت متوجهاً إلى هذا القسم, {x}.' },
    closeLabel:   { en: 'Close',
                    ar: 'إغلاق' }
  };

  function t(key) {
    var e = TXT[key];
    if (!e) return key;
    return (isRTL() && e.ar) ? e.ar : e.en;
  }

  /* One placeholder, {n}, for the counts this layer's own chrome says
     out loud. Keeping the numeral inside the sentence rather than
     concatenating it is what lets the Arabic put it after the definite
     article.

     Two other tokens now exist, and they are deliberately not handled
     here: {x} in leadFor, which carries a panel title rather than a
     count, and the named counts {steps}, {gates}, {agents} and
     {regions} in the PANELS table, one sentence of which needs two of
     them at once. panelText() substitutes those. The rule they all
     obey is the one this function exists for — a number that is on
     screen is counted from the page, never typed into the copy. */
  function tn(key, n) {
    return t(key).replace('{n}', String(n));
  }

  /* Counted from the page, not from CHAPTERS: a chapter may list an id
     that no longer exists (that is deliberate - see the note on
     eachNode) and a count that includes a section nobody can see is the
     same lie in the other direction. #descent is not counted; it is a
     transition, not a section, and calling it one is how the old 24
     survived as long as it did. */
  function sectionCount() {
    var n = 0;
    CHAPTERS.forEach(function (c) {
      c.ids.forEach(function (id) { if (sec(id)) n++; });
    });
    return n;
  }

  /* The same discipline as sectionCount(), for the other number this
     layer says out loud. The hero note used to spell "Ten" into its
     English sentence, so it described INSIDER's length as it stood the
     day it was typed rather than as it stands in the page - and an
     insider id that no longer exists would have made it wrong in the
     same silent way the rail's "24" was wrong. */
  function insiderCount() {
    var n = 0;
    INSIDER.forEach(function (id) { if (sec(id)) n++; });
    return n;
  }

  SH.strings = TXT;
  /* PANELS is exported for the same reason TXT is: it is now fifty
     translated strings in the {en, ar} shape js/ksat-i18n.js uses, and
     whoever folds this layer's copy into the shared catalogue should
     not have to re-translate it or copy it out of a source file. It is
     assigned further down, where the table is declared. */

  /* ===================================================================
     1b · EVENTS  -  ksat:chapter and ksat:identity

     Three other files were already listening for these and had never
     once been woken: js/ksat-motion.js:114-115 re-runs its
     IntersectionObserver over elements that have just come into flow,
     js/ksat-i18n.js:672 builds its language toggle when the masthead
     finally settles, and js/ksat-assistant.js:1471 repaints its
     suggestion chips for the new tier. Nothing dispatched either
     event, so revealed sections arrived un-animated, the language
     toggle could be missing outright, and the assistant went on
     offering researcher questions to a public visitor.

     Those two line numbers were 585 and 606 when this was written and
     both files were rewritten later in the same pass, which moved the
     listeners to 672 and 1471. The numbers are corrected rather than
     dropped because they are how the next reader checks that the other
     end of this contract still exists - but check the file, not the
     number: every index.html line cited anywhere in this layer is
     roughly 123 lines low for the same reason.

     The shell is the only layer that knows when a chapter or a tier
     has actually changed, so it is the right place to say so.
     =================================================================== */
  function emit(name, detail) {
    try {
      document.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
      return;
    } catch (e) { /* fall through to the older constructor */ }
    /* The rest of this file is ES5-flavoured on purpose; keep the
       fallback for the same reason. */
    try {
      var ev = document.createEvent('CustomEvent');
      ev.initCustomEvent(name, false, false, detail || {});
      document.dispatchEvent(ev);
    } catch (e2) {}
  }

  /* ===================================================================
     2 · THE TIER MAP

     The boundary is drawn on FUNCTION, not secrecy.
       INSIDER  = a surface that PRODUCES or DISPLAYS work product —
                  a mission, a run, a scored recommendation, a readout.
       PUBLIC   = a surface that EXPLAINS, EVIDENCES or ATTRIBUTES.

     13 public / 10 insider, over the 23 sections the page now has. It
     read "14 public" here for a while after the capstone team section
     was taken out of index.html, which is the same off-by-one that had
     the rail telling readers there were 24 sections. Counts that are
     typed go stale; sectionCount() exists so the ones on SCREEN cannot.

     The public arc is still coherent end to end: who built the
     satellite -> what it really photographed -> what a planning system
     on top of it would look like -> how we govern it -> where every
     fact came from. The insider tier is exactly the instruments.

     sh-m1 ("the public URL opens for a stranger, no login wall on the
     landing page") is satisfied because `top` is public and no dialog
     is built on arrival.
     =================================================================== */

  var INSIDER = ['console', 'explorer', 'dashboard', 'map', 'simulate',
                 'impact', 'charts', 'compare', 'ai', 'agent'];

  function isInsiderSection(id) { return INSIDER.indexOf(id) !== -1; }

  /* ===================================================================
     THE PUBLIC PAGE DOES NOT SHIP THE RESEARCHER'S SECTIONS AT ALL

     The team: "whatever tab that needs to be signed in in order to view
     it, dont put it in the website, it should only be in the page of
     once the researcher signs in".

     Until now those ten sections were in the markup and hidden with CSS.
     That was always a weak answer: hidden content still downloads, still
     matches find-in-page, and reads straight out of view source, so a
     "researcher only" section was one DevTools toggle from anybody. It
     also made the public page carry several hundred kilobytes it never
     drew.

     They are REMOVED from the document for a signed out visitor, and the
     nodes are kept in memory so signing in can put them back in their
     original positions without a reload. A marker comment holds each
     one's place, which is what makes the restore exact rather than
     approximate.

     This is still not an access control. The sections hold demo data and
     the real guarantee is row level security in the database, which is
     where it belongs. What this buys is that the public page is actually
     the public page.
     =================================================================== */
  var PARKED = {};                 /* id -> { node, mark } */

  function parkInsiderSections() {
    INSIDER.forEach(function (id) {
      if (PARKED[id]) return;
      var n = document.getElementById(id);
      if (!n || !n.parentNode) return;
      var mark = document.createComment(' ksat:parked ' + id + ' ');
      n.parentNode.replaceChild(mark, n);
      PARKED[id] = { node: n, mark: mark };
    });
  }

  function restoreInsiderSections() {
    Object.keys(PARKED).forEach(function (id) {
      var p = PARKED[id];
      if (p.mark && p.mark.parentNode) p.mark.parentNode.replaceChild(p.node, p.mark);
      delete PARKED[id];
    });
  }



  /* ===================================================================
     THE TEN BESPOKE INVITATION PANELS

     One shell, ten first lines. `lines` are the three real instruments
     behind each panel, named — an invitation has to be specific or it
     reads as a wall.

     WHY EVERY STRING IN HERE IS NOW A PAIR

     This table used to be English-only, and it is the largest block of
     copy this layer puts on a screen: ten titles, ten paragraphs and
     thirty instrument lines. It is also, for a signed-out visitor,
     exactly what stands where the ten researcher sections would be. So
     on the Arabic page a reader sat inside an RTL layout and met fifty
     lines of English at the precise moment the page was explaining why
     they could not see something.

     The note beside the LANG bridge in section 0 records how that
     happened: an earlier pass believed the page was English-only and
     isRTL() therefore always false. js/ksat-i18n.js really does put
     dir="rtl" lang="ar" on <html>, so it is not, and this table was
     the last large hole left by that belief. Nothing here is removed
     or rewritten to make room — each English string keeps its meaning
     and gains its Arabic beside it.

     THE SHAPE is {en, ar}, which is what TXT in section 1a uses and
     what index.html's own L() helper expects — the page picks Arabic
     out of pairs shaped exactly like these. buildPanel() resolves them
     through pk(), which reads the live document direction rather than
     the LANG primitive, for the reason the bridge note gives.

     REGISTER. Technical Arabic for a researcher, not brochure Arabic,
     and matched term for term against js/ksat-i18n.js so one
     instrument is not called two different things on one page:
     مستكشف الصور, لوحة الذكاء البيئي, إمكانية التشجير, مؤشر الغطاء
     النباتي, كشف التغيّر, المحلّل, مجموعة البيانات المرجعية,
     منشأ البيانات. Latin identifiers that name a real object —
     KuwaitSat-1 — stay in Latin and numerals stay Western (0-9),
     which is the convention that file states and the page follows.
     =================================================================== */
  var PANELS = {
    console: {
      t: { en: 'The research brief',
           ar: 'موجز البحث' },
      p: { en: 'State an objective, set the area and the period, and hand it to the agent pipeline. Every brief becomes a mission that belongs to one account and to no one else’s.',
           ar: 'حدّد هدفاً، واضبط المنطقة والفترة، ثم سلّم الموجز إلى مسار الوكلاء. يصبح كل موجز مهمة تعود إلى حساب واحد دون سواه.' },
      lines: [
        { en: 'The objective, area and period controls',
          ar: 'أدوات تحديد الهدف والمنطقة والفترة' },
        { en: 'The site constraints you supply, which the agents never guess',
          ar: 'قيود الموقع التي تزوّدها بنفسك، ولا يخمّنها الوكلاء أبداً' },
        { en: 'The {agents}-agent rail, each showing its working and its sources',
          ar: 'شريط الوكلاء الـ{agents}، ويعرض كل منهم عمله ومصادره' }
      ]
    },
    explorer: {
      t: { en: 'The imagery explorer',
           ar: 'مستكشف الصور' },
      p: { en: 'Pan, zoom and step back through epochs on a 39 m sampling grid, the KuwaitSat-1 ground sample distance, with the analytical layers switched on.',
           ar: 'حرّك وقرّب وتنقّل رجوعاً بين الحقب الزمنية على شبكة أخذ عيّنات مقدارها 39 م, وهي دقة KuwaitSat-1 الأرضية, مع تشغيل الطبقات التحليلية.' },
      lines: [
        { en: 'True-colour, vegetation and thermal layers',
          ar: 'طبقات اللون الطبيعي والغطاء النباتي والحرارة' },
        { en: 'A per-pixel inspector',
          ar: 'مفتّش يقرأ كل بكسل على حدة' },
        { en: 'A histogram of the selected layer',
          ar: 'مدرّج تكراري للطبقة المحددة' }
      ]
    },
    dashboard: {
      t: { en: 'Environmental intelligence dashboard',
           ar: 'لوحة الذكاء البيئي' },
      p: { en: 'The national picture for a chosen area and period, in the form a researcher actually works from.',
           ar: 'الصورة الوطنية لمنطقة وفترة محددتين، بالشكل الذي يعمل عليه الباحث فعلاً.' },
      lines: [
        { en: 'The KPI grid',
          ar: 'شبكة مؤشرات الأداء' },
        { en: 'Vegetation-index trend and stress by governorate',
          ar: 'اتجاه مؤشر الغطاء النباتي والإجهاد البيئي حسب المحافظة' },
        { en: 'Monthly surface heat and greening potential',
          ar: 'حرارة السطح الشهرية وإمكانية التشجير' }
      ]
    },
    map: {
      t: { en: 'Greening potential map',
           ar: 'خريطة إمكانية التشجير' },
      p: { en: 'Kuwait’s {regions} governorates scored by the greening model, with the evidence behind each score and the recommendation that comes out of it.',
           ar: 'محافظات الكويت الـ{regions}، مُقيَّمة بنموذج التشجير، مع الأدلّة وراء كل درجة والتوصية الناتجة عنها.' },
      lines: [
        { en: 'The scored map and its metric switch',
          ar: 'الخريطة المُقيَّمة ومبدّل المقياس' },
        { en: 'What the model looked at, per region',
          ar: 'ما نظر إليه النموذج في كل منطقة' },
        { en: 'The recommendation card with its options, uncertainty and follow-up',
          ar: 'بطاقة التوصية بخياراتها ودرجة عدم يقينها وخطوة المتابعة' }
      ]
    },
    simulate: {
      t: { en: 'Scenario simulation',
           ar: 'محاكاة السيناريو' },
      p: { en: 'Choose an area and an intervention ambition, run the greening engine, then drag between the current modelled surface and the one the engine proposes.',
           ar: 'اختر منطقة ومستوى طموح التدخّل، وشغّل محرّك التشجير، ثم اسحب بين السطح المُنمذَج الحالي والسطح الذي يقترحه المحرّك.' },
      lines: [
        { en: 'The before/after wipe',
          ar: 'مقبض المسح بين «قبل» و«بعد»' },
        { en: 'The scenario result and its assumptions',
          ar: 'نتيجة السيناريو وافتراضاتها' },
        { en: 'The standing warning that this is not a planning proposal',
          ar: 'التحذير الدائم بأن هذا ليس مقترح تخطيط' }
      ]
    },
    impact: {
      t: { en: 'Impact calculator',
           ar: 'حاسبة الأثر' },
      p: { en: 'Move the inputs and watch the conceptual indicators respond, every assumption open for inspection, because arithmetic you cannot see is not evidence.',
           ar: 'حرّك المُدخَلات وراقب استجابة المؤشرات المفاهيمية, كل افتراض متاح للفحص، لأن حساباً لا تراه ليس دليلاً.' },
      lines: [
        { en: 'The input sliders and presets',
          ar: 'مُنزلِقات المُدخَلات والإعدادات الجاهزة' },
        { en: 'The conceptual indicators',
          ar: 'المؤشرات المفاهيمية' },
        { en: 'The assumptions drawer behind every figure',
          ar: 'لوحة الافتراضات خلف كل رقم' }
      ]
    },
    charts: {
      t: { en: 'Reading the record',
           ar: 'قراءة السجل' },
      p: { en: 'Filter the dataset by area, period and metric. The charts and the table are drawn from the same numbers, so they always agree.',
           ar: 'رشّح مجموعة البيانات حسب المنطقة والفترة والمقياس. تُرسم الرسوم البيانية والجدول من الأرقام نفسها، فتتفق دائماً.' },
      lines: [
        { en: 'The trend chart',
          ar: 'رسم الاتجاه' },
        { en: 'The area comparison',
          ar: 'مقارنة المناطق' },
        { en: 'The underlying row table',
          ar: 'جدول الصفوف الذي تُرسم منه' }
      ]
    },
    compare: {
      t: { en: 'Change detection',
           ar: 'كشف التغيّر' },
      p: { en: 'Put two epochs side by side and wipe between them. The change mask is produced by differencing the scenes, the method is real, the scenes are simulated.',
           ar: 'ضع حقبتين جنباً إلى جنب وامسح بينهما. يُنتَج قناع التغيّر بحساب الفرق بين المشهدين, الطريقة حقيقية، والمشاهد مُحاكاة.' },
      lines: [
        { en: 'Wipe, side-by-side and change-mask views',
          ar: 'عروض المسح وجنباً إلى جنب وقناع التغيّر' },
        { en: 'The change readout',
          ar: 'قراءة التغيّر' },
        { en: 'The interpretation, badged as interpretation',
          ar: 'التفسير، موسوماً بأنه تفسير' }
      ]
    },
    ai: {
      /* THE ONE PLACE THE ENGLISH MOVED. This paragraph said "the same
         five parts", and five is a count of a structure this file has
         no array to count: index.html renders four labelled rows and a
         provenance badge, and the page's own an.lede describes five
         things. A number word typed into copy is exactly what the
         tierNote comment in section 1a is about, so rather than type
         it twice - once in each language - the sentence now names the
         parts it used to count. Nothing is lost; the reader is told
         more than the number was telling them, and there is no figure
         left to go stale when the analyst gains a sixth row. */
      t: { en: 'The analyst',
           ar: 'المحلّل' },
      p: { en: 'Ask a question about the dataset. The answer always comes back in the same parts, what it looked at, what it found, its confidence, what it suggests next, and what class of data the answer rests on.',
           ar: 'اطرح سؤالاً عن مجموعة البيانات. يعود الجواب دائماً بالأجزاء نفسها, ما نظر إليه، وما وجده، ودرجة ثقته، وما يقترحه تالياً، ونوع البيانات التي يستند إليها.' },
      lines: [
        { en: 'The analyst session',
          ar: 'جلسة المحلّل' },
        { en: 'The suggested questions',
          ar: 'الأسئلة المقترحة' },
        { en: 'The guardrail that refuses questions it has no data for',
          ar: 'الضابط الذي يرفض الأسئلة التي لا يملك عنها بيانات' }
      ]
    },
    agent: {
      t: { en: 'The agent console',
           ar: 'كونسول الوكلاء' },
      p: { en: 'The whole route: collect, validate, analyse, decide, recommend, report, with the decision gates, the re-ranking loop, and the approval that a report cannot be written without.',
           ar: 'المسار كاملاً: يجمع، ويتحقق، ويحلّل، ويقرّر، ويوصي، ويكتب التقرير, مع بوابات القرار، وحلقة إعادة الترتيب، والموافقة التي لا يُكتب التقرير بدونها.' },
      lines: [
        { en: 'The {steps}-step pipeline with its {gates} decision nodes',
          ar: 'المسار بخطواته الـ{steps} وعقد القرار الـ{gates} فيه' },
        { en: 'The run output and its provenance labels',
          ar: 'مخرجات التشغيل وعلامات منشأ البيانات' },
        { en: 'The human checkpoint, and the report it releases',
          ar: 'نقطة الموافقة البشرية، والتقرير الذي تُفرج عنه' }
      ]
    }
  };

  /* ===================================================================
     {steps}, {gates}, {agents} AND {regions} ARE COUNTED, NEVER TYPED

     The same rule as allShown, railNote and tierNote in section 1a,
     applied to the numbers this table says out loud. It read "The
     ten-step pipeline with its two decision nodes", "The seven-agent
     rail" and "Kuwait's six governorates" — four counts of three
     arrays that live in index.html, typed as English words on the day
     someone read them off the screen. The file's own history says what
     happens next: the rail told readers there were 24 sections for as
     long as it took someone to notice, and the hero note spelled "Ten"
     while INSIDER decided how many there actually were.

     Translating them made it worse, not better, because Arabic would
     have had the same number typed a second time, in a script the
     English-reading maintainer who adds an eighth agent cannot audit.
     So the numerals come from PIPE, AGENTS and REGIONS at the moment a
     panel is written, and the Arabic puts each numeral behind a
     definite article — الوكلاء الـ7 — which is the trick index.html
     uses for the tour's closing card and js/ksat-i18n.js documents at
     'dm.fin2': it sidesteps Arabic number-noun agreement, which
     changes shape between 3-10 and 11+, without a plural engine.

     The tokens are NAMED rather than the {n} that tn() substitutes
     because one sentence — the agent panel's first instrument line —
     carries two different counts, and a single positional placeholder
     cannot hold both.
     =================================================================== */

  function globalArray(name) {
    /* window first: the bridge at the top of this file put the page's
       arrays there. If it missed one it will be for a real reason —
       the bridge runs at parse time, and a `const` that index.html has
       not evaluated yet sits in its temporal dead zone, where even
       `typeof` throws — so fall back to the bare identifier, which is
       long since initialised by the time a panel is built. */
    try {
      var w = window[name];
      if (w && typeof w.length === 'number') return w;
    } catch (e) {}
    try {
      if (name === 'PIPE'    && typeof PIPE    !== 'undefined') return PIPE;
      if (name === 'AGENTS'  && typeof AGENTS  !== 'undefined') return AGENTS;
      if (name === 'REGIONS' && typeof REGIONS !== 'undefined') return REGIONS;
    } catch (e) {}
    return null;
  }

  function panelCounts() {
    var pipe = globalArray('PIPE') || [];
    var gates = 0;
    for (var i = 0; i < pipe.length; i++) {
      /* `dec:true` is how index.html marks a decision node in PIPE —
         the two branch cards renderPipeline() draws instead of a step.
         Counting the flag rather than the ids means a third gate is
         counted the day it is added. */
      if (pipe[i] && pipe[i].dec) gates++;
    }
    return {
      '{steps}':   pipe.length,
      '{gates}':   gates,
      '{agents}':  (globalArray('AGENTS')  || []).length,
      '{regions}': (globalArray('REGIONS') || []).length
    };
  }

  /* The pair picker. index.html's own L() at the head of its render
     helpers is this function; ours reads the live document direction
     instead of the LANG primitive, because LANG is deliberately not
     bridged — see section 0. A bare string is tolerated so a future
     entry that has not been translated yet renders rather than throws. */
  function pk(o) {
    if (!o) return '';
    if (typeof o === 'string') return o;
    return (isRTL() && o.ar) ? o.ar : (o.en || '');
  }

  SH.panels = PANELS;

  function panelText(o) {
    var s = pk(o);
    if (s.indexOf('{') === -1) return s;      // the common case, untouched
    var c = panelCounts(), k;
    for (k in c) {
      if (Object.prototype.hasOwnProperty.call(c, k)) s = s.split(k).join(String(c[k]));
    }
    return s;
  }

  /* The same footnote on all ten, deliberately. It makes the honesty of
     the security story a visible product feature rather than a slide. */
  var FOOT_EN = 'Nothing here is hidden for secrecy. This is where a signed-in researcher’s own missions, runs and results are drawn, and those live in the database behind row-level security, they were never in this page.';
  var FOOT_AR = 'لا شيء هنا مخفي بدافع السرّية. هنا تُرسم مهام الباحث المسجّل ونتائجه، وهي محفوظة في قاعدة البيانات خلف أمان مستوى الصف, ولم تكن يوماً جزءاً من هذه الصفحة.';

  /* ===================================================================
     3 · THE CHAPTERS

     Six chapters. No node is ever moved, reparented or reordered —
     only the `hidden` attribute changes.

     They are NOT contiguous, and the word "contiguous" stood here for a
     while claiming they were. #console sits at index.html:1102, between
     `builders` and `imagery`, and belongs to chapter 5; several of the
     instrument sections interleave the same way. That is harmless only
     because a collapsed block takes no space at all - which is exactly
     what the transition:none note in css/ksat-shell.css section 3a is
     defending. If that collapse ever regresses, the symptom will be
     gaps INSIDE an open chapter, and this paragraph is the reason why.

     `.chapter` is ALREADY TAKEN: it is the story-card class at
     index.html:488. Everything here namespaces as .ksat-ch-.

     The ids are authored, not derived from DOM order, so this survives a
     future section and says plainly where a new one goes.
     =================================================================== */

  /* WHY 'record' LOST TWO SECTIONS. Measured on the live page the six
     chapters ran 6,769 / 4,930 / 5,118 / 4,402 / 3,671 / 12,375 px.
     'record' was more than twice the next largest, which put the two
     longest reading sections on the page behind a single chapter tab -
     the long scroll these chapters exist to break, reassembled inside
     one of them. Nothing is deleted or reworded; two sections move to
     the chapter that already describes them:

       #vision  'Aligned with Kuwait's sustainability ambitions' is
                national context for a planning system, and now sits
                with the planning system.
       #trust   'What this system will not do' is the guardrail list
                for the agents, and now sits with the agents.

     'record' is then the story, the provenance register and the
     closing statement, which is still exactly Story & Accountability -
     so all six chapter names, and their Arabic, are unchanged. */
  var CHAPTERS = [
    { key: 'brief',    en: 'Mission Record',         ar: 'السجل',
      ids: ['top', 'legend', 'mission', 'builders'],
      extra: ['descent'] },
    { key: 'space',    en: 'Kuwait From Space',      ar: 'من الفضاء',
      ids: ['imagery', 'explorer', 'compare', 'globe', 'orbit'] },
    { key: 'intel',    en: 'Intelligence',           ar: 'التحليل',
      ids: ['dashboard', 'map', 'charts'] },
    { key: 'planning', en: 'Planning',               ar: 'التخطيط',
      ids: ['system', 'simulate', 'impact', 'vision'] },
    { key: 'agents',   en: 'Agents',                 ar: 'الوكلاء',
      ids: ['console', 'ai', 'agent', 'trust'] },
    { key: 'record',   en: 'Story & Accountability', ar: 'القصة والمصداقية',
      ids: ['story', 'sources', 'finale'] }
  ];

  var CH_OF = {};          // section id -> chapter key
  var CH_BY_KEY = {};
  CHAPTERS.forEach(function (c) {
    CH_BY_KEY[c.key] = c;
    c.ids.forEach(function (id) { CH_OF[id] = c.key; });
    (c.extra || []).forEach(function (id) { CH_OF[id] = c.key; });
  });

  /* #descent (index.html:1106) is the one block between the sections
     that is NOT a <section>: a bare <div> holding the downlink
     transition canvas, sitting between #mission and #builders. sec()
     rejects it on tagName, so it belonged to no chapter, was never
     hidden, and stood at its full clamp(240px,34vw,400px) under every
     chapter in turn. Together with the hero that would not hide (see
     css/ksat-shell.css section 3) that was 928px of dead space sitting
     above the dashboard.

     It is a sibling of the sections inside .wrap and behaves like one,
     so `extra` carries it. The parentNode check is deliberate: an id
     that turns out to live INSIDE a section must not be hidden from
     here, because doing so would take content out of a chapter that is
     open, and this layer does not remove anything. */
  function blockNode(id) {
    var n = document.getElementById(id);
    if (!n || n.tagName === 'SECTION') return null;
    var p = n.parentNode;
    return (p && p.classList && p.classList.contains('wrap')) ? n : null;
  }

  /* Every node a chapter owns, in one place: its sections, the
     invitation panel standing in for each locked one, and its `extra`
     blocks. fn is called with null for an id that is not in the page,
     which is how a future section can be listed before it exists. */
  function eachNode(c, fn) {
    c.ids.forEach(function (id) {
      fn(sec(id), id);
      fn(document.getElementById('ksat-invite-' + id), id);
    });
    (c.extra || []).forEach(function (id) { fn(blockNode(id), id); });
  }

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

    box.appendChild(el('div', 'ksat-invite-eyebrow', t('researcherSurface')));

    var h = el('h3', 'ksat-invite-h', panelText(copy.t));
    h.id = 'ksat-invite-h-' + id;
    h.setAttribute('tabindex', '-1');       // focusable target for deep links
    box.appendChild(h);

    /* The lead line an arriving deep link writes into. Empty until then,
       so it never shows as a stray blank row. */
    var lead = el('p', 'ksat-invite-lead');
    lead.id = 'ksat-invite-lead-' + id;
    lead.hidden = true;
    box.appendChild(lead);

    box.appendChild(el('p', 'ksat-invite-p', panelText(copy.p)));

    box.appendChild(el('div', 'ksat-invite-lab', t('behindPanel')));
    var ul = el('ul', 'ksat-invite-list');
    /* The callback parameter was named `t`, which shadowed the
       translator of the same name for the length of this loop. It was
       harmless while the loop body only echoed a string; it stops
       being harmless the moment anything in here needs to translate,
       which is now. Renamed rather than worked around. */
    copy.lines.forEach(function (line) { ul.appendChild(el('li', null, panelText(line))); });
    box.appendChild(ul);

    var btn = el('button', 'ksat-invite-btn', t('signInToOpen'));
    btn.type = 'button';
    btn.addEventListener('click', function () {
      KS.intent = id;                        // where to land after sign-in
      openGate(btn);
    });
    box.appendChild(btn);

    /* BOTH HALVES OF THE FOOTNOTE NEED A DIRECTION, NOT JUST THE
       ARABIC ONE. The Arabic paragraph has carried dir="rtl" since it
       was written; the English one carried nothing and inherited from
       <html>. On the Arabic page that made it an LTR sentence laid out
       right-to-left, and the browser moved its full stop to the left
       edge: measured on the running page at http://127.0.0.1:8800 in
       Arabic, the English footnote read ".level security — they were
       never in this page" with the stop leading the line. It is the
       ordinary bidi failure for an untagged foreign-language run, and
       the fix is the attribute the Arabic half already had. */
    var foot = el('div', 'ksat-invite-foot');
    var en = el('p', 'ksat-invite-foot-en', FOOT_EN);
    en.setAttribute('dir', 'ltr');
    en.setAttribute('lang', 'en');
    foot.appendChild(en);
    var ar = el('p', 'ksat-invite-foot-ar', FOOT_AR);
    ar.setAttribute('dir', 'rtl');
    ar.setAttribute('lang', 'ar');
    foot.appendChild(ar);
    box.appendChild(foot);

    s.parentNode.insertBefore(box, s);
  }

  function buildAllPanels() { INSIDER.forEach(buildPanel); }

  /* THE PANELS HAVE TO FOLLOW THE LANGUAGE TOGGLE, AND NOTHING ELSE
     WILL MOVE THEM.

     js/ksat-i18n.js translates three kinds of node: anything carrying
     data-i18n, anything with class .badge, and our own rail, sheet and
     FAB, which it matches on their exact English. A panel is none of
     those — it has no data-i18n, it is built after that file's first
     pass, and its copy is not in that file's table. So a panel written
     in English at build time would have stayed English through every
     press of AR, and a panel built while the page was already Arabic
     would have stayed Arabic through every press of EN.

     This rewrites the same nodes buildPanel() created, by class inside
     the panel it owns, from the same table. It is called from
     paintStatics(), which the ksat:lang listener in start() already
     runs after that file's pass, so whichever of us runs last is
     still right — the contract paintRailNote() describes.

     The eyebrow, the sign-in button and the footnote are deliberately
     NOT touched: those three are written bilingually, both languages
     at once, and are correct in either direction already. */
  function paintPanels() {
    INSIDER.forEach(function (id) {
      var copy = PANELS[id];
      var box = document.getElementById('ksat-invite-' + id);
      if (!copy || !box) return;

      var h = box.querySelector('.ksat-invite-h');
      if (h) h.textContent = panelText(copy.t);

      var p = box.querySelector('.ksat-invite-p');
      if (p) p.textContent = panelText(copy.p);

      var items = box.querySelectorAll('.ksat-invite-list li');
      for (var i = 0; i < items.length && i < copy.lines.length; i++) {
        items[i].textContent = panelText(copy.lines[i]);
      }

      /* Only if it is on screen. The lead is the line a deep link
         writes; rewriting a hidden one would leave the next arrival
         announcing a section they were not heading for. */
      var lead = document.getElementById('ksat-invite-lead-' + id);
      if (lead && !lead.hidden) lead.textContent = leadFor(id);
    });
  }

  /* The sentence a deep link puts at the top of the panel it landed
     on. It is composed here rather than at the call site in
     goToSection() so that the Arabic and the English are one entry in
     TXT, which is where this layer's strings live. */
  function leadFor(id) {
    var copy = PANELS[id];
    if (!copy) return '';
    return t('leadFor').replace('{x}', panelText(copy.t));
  }

  /* The one-line public-tier orientation note under the hero. */
  function buildHeroNote() {
    var top = sec('top');
    if (!top || document.getElementById('ksat-tier-note')) return;

    var n = el('div', 'ksat-tier-note');
    n.id = 'ksat-tier-note';

    n.appendChild(el('span', 'ksat-tier-note-txt', tn('tierNote', insiderCount())));

    var show = el('button', 'ksat-tier-note-link', t('showWhich'));
    show.type = 'button';
    show.addEventListener('click', function () {
      root.setAttribute('data-ksat-highlight', 'locked');
      openRail();
      setTimeout(function () { root.removeAttribute('data-ksat-highlight'); }, 4200);
    });
    n.appendChild(show);

    var x = el('button', 'ksat-tier-note-x', '×');
    x.type = 'button';
    x.setAttribute('aria-label', t('dismissNote'));
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

  var tierNow = null;           // the last tier we actually announced

  function applyTier(tier) {
    var previous = tierNow;
    tierNow = tier;
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

    if (tier === 'public') parkInsiderSections(); else restoreInsiderSections();

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

    /* Only on a real change. applyTier runs at least twice on every
       load - once from getSession() and again from onAuthStateChange -
       and a listener that repaints the assistant's chips has no reason
       to run for a tier that did not move. */
    if (previous !== tier) {
      emit('ksat:identity', {
        tier: tier,
        previous: previous,
        insider: tier === 'insider'
      });
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
      x.setAttribute('aria-label', t('closeSignIn'));
      x.addEventListener('click', function () { closeGate(); });
      card.appendChild(x);

      var back = el('button', 'ksat-gate-back',
        'Continue without signing in, the public record stays open');
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

    var b = el('button', 'btn sm ksat-signin', t('signIn'));
    b.id = 'ksat-signin';
    b.type = 'button';

    if (!haveDb()) {
      /* No database configured. The public tier still renders completely;
         we say so plainly rather than offering a control that cannot
         work. The demo is never worse than it was. */
      b.textContent = t('signInNoDb');
      b.disabled = true;
      b.title = t('signInNoDbWhy');
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
  var railNote = null, skipLink = null;

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

    /* THE SKIP LINK SKIPS TO THE CHAPTER YOU ARE IN, not to chapter
       one. It pointed permanently at CHAPTERS[0].ids[0] - #top - which
       is fine in chapter one and wrong in the other five: in chapter
       four that href names a section inside a COLLAPSED chapter, and a
       fragment navigation to a hidden="until-found" target makes the
       browser reveal it. So the one control on the page whose whole
       job is "get me past the navigation and into the reading" instead
       changed the chapter under the reader and put them back at the
       hero. The href stays a real anchor - it is what makes this work
       with the script disabled - and paintSkip() keeps it aimed at the
       open chapter. */
    var skip = el('a', 'ksat-ch-skip', t('skipToCh'));
    skipLink = skip;
    skip.addEventListener('click', function (e) {
      e.preventDefault();
      var id = firstVisibleId(openKey);
      var s = sec(id);
      /* A locked section has no box in the public tier, so there is
         nothing to focus. goToSection() already knows to land on the
         invitation panel standing in for it. */
      if (s && !s.classList.contains('ksat-locked')) focusChapterStart(openKey);
      goToSection(id, { silent: true });
    });
    rail.appendChild(skip);
    paintSkip();

    var nav = el('nav', 'ksat-ch-nav');
    nav.setAttribute('aria-label', t('siteChapters'));

    var head = el('div', 'ksat-ch-head', t('chapters'));
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
       canvas mis-measures.

       It is no longer the ONLY way back, though, and that was the
       whole of the complaint. This rail is display:none below 1700px,
       so on a 1424px laptop or on a phone one press of this button
       sent the reader into a 31,052px monolith with no control left on
       screen that could undo it - and the choice was persisted, so it
       survived the reload they tried next. The mode now also lives on
       the FAB and in the bottom sheet, which are present at every
       width. See paintFab() and the mode row in buildSheet(). */
    var toggle = el('button', 'ksat-ch-toggle', '');
    toggle.type = 'button';
    toggle.addEventListener('click', function () { setNav(!navOn); });
    nav.appendChild(toggle);

    railNote = el('p', 'ksat-ch-note', '');
    nav.appendChild(railNote);
    paintRailNote();

    rail.appendChild(nav);

    /* THE LIVE REGION IS NOT PART OF THE RAIL, AND KEEPING IT THERE
       SILENCED IT ON EVERY SCREEN MOST PEOPLE OWN. #ksat-ch-rail is
       display:none below 1700px - see the breakpoint arithmetic in
       css/ksat-shell.css section 3 - and a live region inside a
       display:none subtree announces nothing at all. So "Chapter 3 of
       6, three sections", and the line that confirms continuous scroll
       actually did something, reached a screen reader only on a
       1700px monitor: on a laptop or a phone the chapter buttons
       changed the page in silence. It goes on <body> instead, where
       its own clip keeps it off screen. css/ksat-tour.css:100 records
       the same lesson about #demoHud, which is where this should have
       been read the first time. */
    live = el('div', 'ksat-ch-live');
    live.setAttribute('role', 'status');
    live.setAttribute('aria-live', 'polite');
    document.body.appendChild(live);

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
    /* THE ONE CONTROL THAT IS ALWAYS ON SCREEN.
       Below 1700px this is the entire chapter interface, so it has two
       jobs rather than one. In chapters it names the chapter you are
       in and opens the sheet. In continuous scroll it names the mode
       you are in and, in a single press, puts the chapters back -
       because a reader who has just discovered they are in a 31,052px
       page wants out of it, not a menu. The chapter list is not lost:
       the page's own sticky nav.nav still jumps to every section while
       continuous scroll is on, and the sheet returns with the
       chapters. paintFab() owns both states. */
    fab.addEventListener('click', function () {
      if (!navOn) { setNav(true); return; }
      openSheet();
    });
    document.body.appendChild(fab);

    sheet = el('div', null);
    sheet.id = 'ksat-ch-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-label', t('siteChapters'));
    sheet.hidden = true;

    var inner = el('div', 'ksat-sheet-in');
    var top = el('div', 'ksat-sheet-top');
    top.appendChild(el('span', 'ksat-sheet-title', t('chapters')));
    var x = el('button', 'ksat-sheet-x', t('closeLabel'));
    x.type = 'button';
    x.addEventListener('click', function () { closeSheet(); });
    top.appendChild(x);
    inner.appendChild(top);

    /* The reading-mode row sits ABOVE the chapter list on purpose. The
       sheet is anchored to the bottom of the screen and can scroll, so
       anything below six chapters and their sections is off-screen on
       a short phone - which is how the switch to continuous scroll came
       to exist only in a rail nobody on a phone can see. */
    var mode = el('div', 'ksat-sheet-mode');
    var modeTxt = el('span', 'ksat-sheet-mode-txt', '');
    modeTxt.id = 'ksat-sheet-mode-txt';
    mode.appendChild(modeTxt);
    var modeBtn = el('button', 'ksat-sheet-mode-btn', '');
    modeBtn.id = 'ksat-sheet-mode-btn';
    modeBtn.type = 'button';
    modeBtn.addEventListener('click', function () {
      setNav(!navOn);
      /* Switching to continuous scroll leaves the sheet with nothing
         to show, so it closes behind you. Switching back keeps it
         open, because the next thing you want is a chapter. */
      if (!navOn) closeSheet(); else paintSheet();
    });
    mode.appendChild(modeBtn);
    inner.appendChild(mode);

    var modeNote = el('p', 'ksat-sheet-mode-note', '');
    modeNote.id = 'ksat-sheet-mode-note';
    inner.appendChild(modeNote);

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

    paintSheetMode();
    paintFab();
  }

  /* The mode row, in both languages, in both states. */
  function paintSheetMode() {
    var txt = document.getElementById('ksat-sheet-mode-txt');
    var btn = document.getElementById('ksat-sheet-mode-btn');
    var note = document.getElementById('ksat-sheet-mode-note');
    if (txt) txt.textContent = navOn ? t('modeChapters') : t('modeScroll');
    if (btn) {
      btn.textContent = navOn ? t('toScroll') : t('backToCh');
      /* aria-pressed describes CHAPTERS, not the button's own label:
         pressed = you have left them. */
      btn.setAttribute('aria-pressed', navOn ? 'false' : 'true');
    }
    if (note) note.textContent = t('modeNote');
  }

  /* The FAB in its two states. The English form of the chapter label is
     deliberately 'Ch 3/6 · Intelligence': js/ksat-i18n.js:461 matches
     exactly that shape to translate it, and we do not own that file.
     The Arabic form is ours, from TXT, and we repaint after its pass
     so whichever of us runs last is still right. */
  function paintFab() {
    if (!fab) return;
    var cur = CH_BY_KEY[openKey];
    var idx = CHAPTERS.indexOf(cur) + 1;
    if (navOn) {
      fab.textContent = t('chAbbr') + ' ' + idx + '/' + CHAPTERS.length +
                        ' · ' + (isRTL() ? cur.ar : cur.en);
      fab.setAttribute('aria-haspopup', 'dialog');
      fab.setAttribute('aria-expanded', (sheet && !sheet.hidden) ? 'true' : 'false');
      fab.removeAttribute('data-ksat-mode');
      fab.title = t('modeChapters');
    } else {
      /* Both halves matter: the first says where you are, the second
         says what the press will do. The pill ellipsises, so the title
         carries the full sentence for a narrow screen. */
      fab.textContent = t('modeScroll') + ' · ' + t('backToCh');
      fab.removeAttribute('aria-haspopup');
      fab.removeAttribute('aria-expanded');
      fab.setAttribute('data-ksat-mode', 'scroll');
      fab.title = t('modeScroll') + ' · ' + t('backToCh');
    }
  }

  /* The rail's own toggle says the same thing in the same words. */
  function paintRailToggle() {
    var b = rail ? rail.querySelector('.ksat-ch-toggle') : null;
    if (!b) return;
    b.textContent = navOn ? t('toScroll') : t('backToCh');
    b.setAttribute('aria-pressed', navOn ? 'false' : 'true');
  }

  /* The href follows the open chapter. It is read by the no-JS
     fallback and by anyone who copies the link, so it has to name a
     section that is actually on screen. */
  function paintSkip() {
    if (skipLink) skipLink.href = '#' + firstVisibleId(openKey);
  }

  /* Repainted on a language switch like everything else of ours.
     js/ksat-i18n.js:446 walks `#ksat-ch-rail *` and rewrites every leaf
     it recognises, caching the first English it sees on each node, so a
     string it does NOT recognise - this one - comes back in English and
     then stays English. We run after its pass and set it from TXT. */
  function paintRailNote() {
    if (railNote) railNote.textContent = tn('railNote', sectionCount());
  }

  /* THE LABELS THAT ARE WRITTEN ONCE STILL HAVE TO FOLLOW THE TOGGLE.

     paintRailToggle, paintRailNote and paintSheet already re-run on
     ksat:lang, because their text changes with state anyway. The labels
     below do not change with state, so they were written at build time
     and then never touched again. That is fine until someone presses
     AR, at which point the masthead button and the orientation note
     under the hero are the only Latin script left on an Arabic page.

     This also settles the caching problem paintRailNote describes just
     above. js/ksat-i18n.js walks `#ksat-ch-rail *` and remembers the
     first text it sees on each node as that node's English; on an
     Arabic-first load it would now remember our Arabic and hand it back
     when the reader asks for English. We run after its pass and set
     every one of these from TXT, so whatever it cached is overwritten
     in both directions, which is the same contract paintRailNote
     already relies on. */
  function paintStatics() {
    var b = document.getElementById('ksat-signin');
    if (b) {
      b.textContent = haveDb() ? t('signIn') : t('signInNoDb');
      if (!haveDb()) b.title = t('signInNoDbWhy');
    }

    var note = document.getElementById('ksat-tier-note');
    if (note) {
      var txt  = note.querySelector('.ksat-tier-note-txt');
      var link = note.querySelector('.ksat-tier-note-link');
      var x    = note.querySelector('.ksat-tier-note-x');
      if (txt)  txt.textContent  = tn('tierNote', insiderCount());
      if (link) link.textContent = t('showWhich');
      if (x)    x.setAttribute('aria-label', t('dismissNote'));
    }

    /* The invitation panels are built once and live for the session, so
       their two strings have to be repainted here rather than rebuilt. */
    document.querySelectorAll('.ksat-invite-eyebrow').forEach(function (n) {
      n.textContent = t('researcherSurface');
    });
    document.querySelectorAll('.ksat-invite-btn').forEach(function (n) {
      n.textContent = t('signInToOpen');
    });

    if (skipLink) skipLink.textContent = t('skipToCh');

    var rail = document.getElementById('ksat-ch-rail');
    if (rail) {
      var nv = rail.querySelector('.ksat-ch-nav');
      var hd = rail.querySelector('.ksat-ch-head');
      if (nv) nv.setAttribute('aria-label', t('siteChapters'));
      if (hd) hd.textContent = t('chapters');
    }

    var sheet = document.getElementById('ksat-ch-sheet');
    if (sheet) {
      sheet.setAttribute('aria-label', t('siteChapters'));
      var ti = sheet.querySelector('.ksat-sheet-title');
      var sx = sheet.querySelector('.ksat-sheet-x');
      if (ti) ti.textContent = t('chapters');
      if (sx) sx.textContent = t('closeLabel');
    }

    /* Ten panels, one label each.

       This comment used to say the panel COPY was English-only and not
       ours to invent - ten titles, ten paragraphs and thirty
       instrument lines that the team had to author - and it was true
       when it was written. It is not true now: the PANELS table at the
       top of this file carries Arabic beside every one of those fifty
       strings, so the label below is no longer the only thing on a
       panel that follows the toggle. paintPanels() does the rest, and
       is called here so that one ksat:lang listener still covers
       everything this layer wrote. */
    Array.prototype.forEach.call(
      document.querySelectorAll('.ksat-invite-lab'),
      function (n) { n.textContent = t('behindPanel'); }
    );

    paintPanels();
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
      eachNode(c, function (n) {
        if (n) n.setAttribute('data-ksat-ch', c.key);    // no-op safely
      });
    });
  }

  /* The collapsed geometry that goes with this attribute lives in
     css/ksat-shell.css section 3a, and one line of it - transition:none
     - is the difference between a chapter that takes no space and one
     that leaves 2,400px of blank scroll behind. The comment there says
     why; it is worth reading before touching either file. */
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
        eachNode(c, function (n) { setHidden(n, hide); });
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
    paintSkip();

    /* Reveal ALWAYS dispatches resize. This is the verified mechanism for
       re-measuring every canvas that was hidden. */
    if (navOn) nudgeRedraw();

    if (opts.focus) focusChapterStart(key);
    if (opts.scroll) scrollToId(firstVisibleId(key));
    if (changed && !opts.silent) announce(key);
    if (!opts.silent) pushHash(firstVisibleId(key), opts.replace);

    /* Unconditional, not only when the key changed: setNav(true)
       re-opens the SAME chapter and that still puts five chapters'
       worth of elements back out of flow, which is precisely what
       js/ksat-motion.js needs to hear about. */
    emit('ksat:chapter', {
      key: key,
      index: CHAPTERS.indexOf(CH_BY_KEY[key]) + 1,
      total: CHAPTERS.length,
      en: CH_BY_KEY[key].en,
      ar: CH_BY_KEY[key].ar,
      ids: CH_BY_KEY[key].ids.slice(),
      changed: changed,
      navOn: navOn
    });
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
      /* A screen reader announcing English into an Arabic page is
         worse than silence, so this one is composed rather than
         looked up. */
      live.textContent = isRTL()
        ? (c.ar + '. فصل ' + i + ' من ' + CHAPTERS.length + '، ' + n + ' أقسام.')
        : (c.en + '. Chapter ' + i + ' of ' + CHAPTERS.length + ', ' + n + ' sections.');
    }, 220);                                    // debounced for arrow traversal
  }

  function scrollToId(id) {
    var target = null;
    /* A locked section has no box in the public tier. Land on its
       invitation panel instead: intent preserved, no dead click. */
    if (isInsiderSection(id) && root.getAttribute('data-ksat-tier') === 'public') {
      target = document.getElementById('ksat-invite-' + id);
    }
    if (!target) target = sec(id) || blockNode(id);
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
        /* leadFor() owns the wording in both languages now; the
           sentence that used to be assembled on this line is written
           up beside the TXT entry it moved into. */
        lead.textContent = leadFor(id);
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
  /* Exported so a later layer - or a presenter on stage with the
     console open - can put the chapters back without hunting for a
     button. SH.setNav(true) is the whole recovery. */
  SH.setNav = function (on) { setNav(on); };
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
  /* This wired the sections only. The invitation panels are public-tier
     content in their own right - ten headings and forty lines of copy a
     visitor can legitimately search for - and #descent carries three
     lines of its own, so they are wired too. None of this could fire
     at all until the CSS stopped forcing display:none on every [hidden]
     element; see css/ksat-shell.css section 3. */
  function wireBeforeMatch() {
    if (!UNTIL_FOUND) return;
    CHAPTERS.forEach(function (c) {
      eachNode(c, function (n, id) {
        if (!n) return;
        n.addEventListener('beforematch', function () {
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

  /* WHERE THE READER ACTUALLY IS, rather than where they were when they
     last pressed something. Leaving continuous scroll used to re-open
     whichever chapter happened to be `openKey`, which after ten minutes
     of scrolling was usually chapter one - so the way back cost you
     your place, and a reader who has lost their place once does not
     press the button again. */
  function sectionInView() {
    var best = null, bestTop = Infinity;
    var line = (window.innerHeight || 600) * 0.34;
    CHAPTERS.forEach(function (c) {
      c.ids.forEach(function (id) {
        var s = sec(id);
        if (!s || s.hasAttribute('hidden')) return;
        var r;
        try { r = s.getBoundingClientRect(); } catch (e) { return; }
        if (!r.height) return;                    // locked, or not laid out
        if (r.bottom < line) return;              // already scrolled past
        if (r.top < bestTop) { bestTop = r.top; best = id; }
      });
    });
    return best;
  }

  /* THE PREFERENCE IS PER VISIT, NOT FOREVER.
     This was localStorage, and that is what put the user in a 31,052px
     page for days: one press on a laptop too narrow to show the rail,
     and every later visit in that browser opened the monolith with no
     control on screen to undo it. The brief is that the long scroll is
     the problem, so chapters are the default and staying out of them is
     the deliberate, temporary choice - sessionStorage says exactly that.
     The old key is actively removed rather than ignored, because anyone
     who already pressed the button is still carrying an 'off' that
     would otherwise sit in their browser indefinitely. */
  var NAV_KEY = 'ksat_nav';

  function setNav(on) {
    navOn = !!on;
    root.setAttribute('data-ksat-nav', navOn ? 'on' : 'off');
    try { sessionStorage.setItem(NAV_KEY, navOn ? 'on' : 'off'); } catch (e) {}

    paintRailToggle();

    if (!navOn) {
      /* Restore the original page exactly: every section visible, no
         hidden attribute anywhere we put one. */
      CHAPTERS.forEach(function (c) {
        eachNode(c, function (n) { setHidden(n, false); });
      });
      nudgeRedraw();
      if (live) live.textContent = tn('allShown', sectionCount());
      emit('ksat:chapter', {
        key: openKey,
        index: CHAPTERS.indexOf(CH_BY_KEY[openKey]) + 1,
        total: CHAPTERS.length,
        en: CH_BY_KEY[openKey].en,
        ar: CH_BY_KEY[openKey].ar,
        ids: CH_BY_KEY[openKey].ids.slice(),
        changed: false,
        navOn: false
      });
    } else {
      var here = sectionInView();
      if (here && CH_OF[here]) openKey = CH_OF[here];
      openChapter(openKey, { silent: true });
      /* Land on the section they were reading, not on the top of its
         chapter. After the hide the layout has moved under them, so
         this waits a frame for it to settle. */
      if (here) {
        setTimeout(function () {
          goToSection(here, { silent: true, noFocus: true });
        }, 60);
      }
    }

    paintFab();
    paintSheetMode();
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
    /* buildHeroNote() is NOT called any more. It wrote the orientation
       strip under the hero - "You are reading the public record. N working
       sections ... Show me which" - and the team asked for it gone: the
       public page is meant to open on the planet, not on an explanation of
       what the reader is not being shown. The builder is left in place
       because the copy in it is the clearest statement of what an account
       is for, and the sign-in gate may want it later; one line restores it. */
    stamp();
    buildRail();
    patchScrollIntoView();
    patchAnchors();
    wireBeforeMatch();
    wireHistory();

    root.setAttribute('data-ksat-shell', 'ready');

    /* Chapters are the default, and the stored preference only lasts
       the visit. The legacy localStorage key is cleared on sight: see
       the comment on setNav(). A stored 'off' from the old scheme is
       deliberately NOT honoured, because the people carrying one are
       exactly the people complaining about the long scroll. */
    var want = 'on';
    try { localStorage.removeItem(NAV_KEY); } catch (e) {}
    try { want = sessionStorage.getItem(NAV_KEY) || 'on'; } catch (e) {}

    /* Deep link decides the opening chapter. Native hash scrolling has
       already fired against a still-visible page, so we resolve it
       ourselves after the chapters go on. */
    var hashId = (location.hash || '').slice(1);
    if (hashId && CH_OF[hashId]) openKey = CH_OF[hashId];

    setNav(want !== 'off');

    if (hashId && CH_OF[hashId]) {
      setTimeout(function () { goToSection(hashId, { silent: true, noFocus: true }); }, 80);
    }

    /* js/ksat-i18n.js repaints our controls from a table of English
       strings and then announces itself. Two of our labels are not in
       that table, and the one that is - the FAB - is cached against
       whatever it said the first time, which is a chapter name that has
       almost certainly changed since. So we repaint after it, every
       time, and whichever of us ran last is the one that is right. */
    document.addEventListener('ksat:lang', function () {
      setTimeout(function () { paintRailToggle(); paintRailNote(); paintSheet(); paintStatics(); }, 0);
    });

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
