/* =====================================================================
   ksat-session.js — THE RESEARCH SESSION BAR
   Owner: 03 Security

   WHAT WAS MISSING

   Signing in to this platform changed exactly two things: ten hidden
   sections became visible, and an identity chip appeared in the
   masthead. That is the whole of the insider experience. Grep the repo
   for "current analysis", "research session", "quick access" or
   "workspace" and the only hit is the data-ksat-layer attribute
   js/ksat-appearance.js puts on ten sections — there is no researcher
   chrome at all.

   Two consequences, and they are the two the spec names.

   SECTION 21 · A researcher working down this page sets an area on the
   dashboard, a layer in the explorer, a region on the map and an
   ambition in the simulator, and then scrolls two thousand pixels to
   somewhere those four controls are not on screen. Nothing anywhere
   says what they are currently looking at. The charts do not say it,
   the map legend does not say it, and the numbers in the KPI tiles are
   just numbers. A person who loses track of their own filter reads a
   figure for the wrong governorate and believes it.

   SECTION 20 · Every one of those selections resets on reload, and the
   chapter navigation in js/ksat-shell.js means "reload" is a thing that
   happens on any deep link a reader shares or bookmarks. Theme
   (ksat.theme, js/ksat-appearance.js) and language (ksat.lang,
   js/ksat-i18n.js) already survive; the analysis does not.

   WHAT THIS FILE IS

   A sticky bar at the top of <main>, insider tier only, that STATES the
   current analysis and PERSISTS it. Both halves read and write the
   page's own controls and the page's own state object. There is no
   second copy of anything: pressing a field in the bar takes you to the
   select or the chip row that sets it, and restoring a visit sets
   index.html's `S` and calls index.html's own renderAll().

   A parallel state was the obvious build and it is the wrong one. Two
   stores of "which area" drift apart within one session — the page's
   own #rpSim handler writes `S.sim.area` AND `$("#simArea").value`
   together for exactly this reason — and the first time they disagree
   the bar is lying about what the charts are showing, which is worse
   than having no bar.

   WHAT THIS FILE DOES NOT TOUCH

   index.html gains no markup and no script. The bar is built here and
   inserted at the head of <main>. The two tags that have to be added
   to index.html are named in the handoff, and until they are added
   nothing in this layer runs at all.

   NAMES, NOT LINE NUMBERS. index.html has moved several hundred lines
   across the last two passes and took every line citation in this repo
   with it — js/ksat-tour.js retires sixteen of its own and explains
   why. Every reference below is a selector, a function name or an id.
   ===================================================================== */

(function () {
  'use strict';

  var KS = window.KSAT = window.KSAT || {};
  if (KS.session) return;                  /* never build twice */

  var root = document.documentElement;

  /* ===================================================================
     0 · THE STRINGS

     js/ksat-i18n.js is not ours, so these live here in the shape that
     file already uses — { en, ar } — and are listed in the handoff so
     they can be folded into ARABIC_OURS later without a rewrite.

     THE ARABIC IS NOT OPTIONAL AND IT IS NOT DECORATION. An earlier
     agent on this repo believed the page was English-only and shipped
     twelve English-only strings on the strength of it. It is not:
     js/ksat-i18n.js puts dir="rtl" lang="ar" on <html> and the shell's
     chapter pill reads "فصل 1/6 · السجل" on the running page. A bar
     that names the current analysis in English inside an RTL layout is
     the single worst place on this page for that mistake, because the
     whole purpose of the bar is to be read at a glance.

     REGISTER matches the catalogue in js/ksat-i18n.js term for term, so
     one control is not called two different things on one page:
     المنطقة (dash.area), الفترة (dash.period), المشهد (exp.scene),
     الحقبة (exp.epoch), المنطقة المستهدفة (sim.area),
     طموح التدخّل (sim.amb), المقياس (viz.metric),
     المدى الزمني (viz.range).
     =================================================================== */

  var STR = {
    'ss.eyebrow':   { en: 'Current analysis',
                      ar: 'التحليل الحالي' },

    'ss.location':  { en: 'Location',   ar: 'المنطقة' },
    'ss.dataset':   { en: 'Dataset',    ar: 'مجموعة البيانات' },
    'ss.period':    { en: 'Period',     ar: 'الفترة' },
    'ss.metric':    { en: 'Metric',     ar: 'المقياس' },

    'ss.region':    { en: 'Map region',        ar: 'منطقة الخريطة' },
    'ss.epoch':     { en: 'Epoch',             ar: 'الحقبة' },
    'ss.simarea':   { en: 'Target area',       ar: 'المنطقة المستهدفة' },
    'ss.simamb':    { en: 'Intervention ambition', ar: 'طموح التدخّل' },
    'ss.vizmetric': { en: 'Chart metric',      ar: 'مقياس الرسوم البيانية' },
    'ss.vizrange':  { en: 'Chart range',       ar: 'المدى الزمني للرسوم' },
    'ss.vizarea':   { en: 'Chart areas',       ar: 'مناطق الرسوم البيانية' },
    'ss.cmp':       { en: 'Change detection',  ar: 'كشف التغيّر' },

    'ss.none':      { en: 'not set',    ar: 'غير محدّد' },

    'ss.more':      { en: 'More',       ar: 'المزيد' },
    'ss.fewer':     { en: 'Fewer',      ar: 'أقل' },
    'ss.moreAria':  { en: 'Show the rest of the current analysis',
                      ar: 'عرض بقية تفاصيل التحليل الحالي' },

    'ss.fold':      { en: 'Collapse the current analysis bar',
                      ar: 'طيّ شريط التحليل الحالي' },
    'ss.unfold':    { en: 'Expand the current analysis bar',
                      ar: 'توسيع شريط التحليل الحالي' },

    'ss.editAria':  { en: 'Change {x}. Goes to the control that sets it.',
                      ar: 'تغيير {x}. ينتقل إلى الأداة التي تضبطه.' },

    'ss.barAria':   { en: 'Current analysis',
                      ar: 'التحليل الحالي' },

    /* The restored notice. Section 20 asks for persistence; making it
       VISIBLE is the part that matters. A researcher who returns to a
       filtered dashboard and does not know it was filtered for them has
       been misled by this layer rather than helped by it, and they will
       read every number on the screen as the national figure. */
    'ss.restoredH': { en: 'Carried over from your last visit',
                      ar: 'مُستعادة من زيارتك السابقة' },
    'ss.restoredP': { en: 'These were set the last time you used this platform on this device: {x}.',
                      ar: 'ضُبطت هذه في آخر مرة استخدمت فيها المنصة على هذا الجهاز: {x}.' },
    'ss.keep':      { en: 'Keep them',  ar: 'الإبقاء عليها' },
    'ss.reset':     { en: 'Start fresh', ar: 'البدء من جديد' },
    'ss.resetAria': { en: 'Forget the saved selections and put every control back to its default',
                      ar: 'نسيان الاختيارات المحفوظة وإعادة كل أداة إلى وضعها الافتراضي' },
    'ss.cleared':   { en: 'Saved selections forgotten. Every control is back to its default.',
                      ar: 'نُسيت الاختيارات المحفوظة. عادت كل أداة إلى وضعها الافتراضي.' },

    /* The line under the MORE panel. It is a promise about this
       device, so it is written plainly and it is specific about the
       boundary — see section 3. */
    'ss.fine':      { en: 'Your selections are remembered on this device only, and only the selections: which area, which dataset, which period, which metric. Nothing you write, run or produce is kept here.',
                      ar: 'تُحفظ اختياراتك على هذا الجهاز فقط، والاختيارات وحدها: أي منطقة، وأي مجموعة بيانات، وأي فترة، وأي مقياس. لا يُحفظ هنا أي شيء تكتبه أو تشغّله أو تنتجه.' },
    'ss.fineNo':    { en: 'This browser is not letting the platform store anything, so these selections will reset when you leave.',
                      ar: 'هذا المتصفح لا يسمح للمنصة بتخزين أي شيء، لذا ستُعاد هذه الاختيارات إلى وضعها الافتراضي عند مغادرتك.' },

    /* --- the three lists index.html never translated ------------------

       Measured on the running page at http://127.0.0.1:8800 with
       <html dir="rtl" lang="ar">: of the fourteen controls this bar
       reads, eleven come back in Arabic and three come back in English.

           #dashPeriod   Last 12 months / Last 24 months / Full record
           #vRange       the same three
           #cmpMode      Wipe slider / Side by side / Change mask

       Every other list is built by index.html's fillSelect(), which
       writes its option text through L() and is therefore re-rendered
       in the reader's language on every switch. These three are static
       <option> markup sitting in index.html's body instead, so
       fillSelect() never touches them and neither does the language
       switch. Governorates translate; periods do not.

       That is index.html's bug and index.html is not ours to edit, so
       it is named in the handoff. The question here is only what THIS
       bar does about it, and "mirror the DOM faithfully" is the wrong
       answer: it would put "Last 12 months" next to "الفترة" in the
       most-read strip on an otherwise fully Arabic page. The whole
       point of the bar is to be read at a glance, so it is the single
       worst place on the page to surface that leak — and shipping
       English into RTL is the exact mistake an earlier agent already
       made here twelve times over.

       So these three lists, and only these three, are translated from
       their VALUE rather than read from their option text. By value,
       not by matching the English string: matching text would break
       the moment somebody fixes index.html, whereas "12" and "wipe"
       are the stable identifiers the page stores in S either way.
       Anything not in this table falls through to the DOM text, so a
       fourth option added to any of them degrades to English rather
       than to blank.

       DELETE THIS BLOCK, and localSel() below, once index.html builds
       these three through fillSelect() like the other eleven. It is a
       patch over somebody else's defect, not a design.

       The digits are Arabic-Indic to match the register the page
       already uses: #cmpA renders "أبريل ٢٠٢٣", not "أبريل 2023". */

    'ss.p.12':   { en: 'Last 12 months',           ar: 'آخر ١٢ شهراً' },
    'ss.p.24':   { en: 'Last 24 months',           ar: 'آخر ٢٤ شهراً' },
    'ss.p.36':   { en: 'Full record (36 months)',  ar: 'السجل الكامل (٣٦ شهراً)' },

    'ss.m.wipe': { en: 'Wipe slider',  ar: 'شريط المسح' },
    'ss.m.side': { en: 'Side by side', ar: 'جنباً إلى جنب' },
    'ss.m.diff': { en: 'Change mask',  ar: 'قناع التغيّر' }
  };

  /* Which select ids need that rescue, and how a value maps to a key.
     Keyed by id so localSel() can ask one question and get one answer. */
  var EN_ONLY = {
    dashPeriod: function (v) { return 'ss.p.' + v; },
    vRange:     function (v) { return 'ss.p.' + v; },
    cmpMode:    function (v) { return 'ss.m.' + v; }
  };

  /* The live document direction is the source of truth, not a cached
     language primitive. index.html declares `let LANG` and
     js/ksat-shell.js explains at length why a primitive must not be
     bridged onto window: it would be a snapshot that never follows a
     switch. <html lang> is rewritten by js/ksat-i18n.js on every
     switch, so it is always current. */
  function lang() {
    try {
      if ((root.getAttribute('lang') || '').indexOf('ar') === 0) return 'ar';
      if (root.getAttribute('data-ksat-lang') === 'ar') return 'ar';
      if ((root.getAttribute('dir') || '') === 'rtl') return 'ar';
    } catch (e) {}
    return 'en';
  }
  function isRTL() { return lang() === 'ar'; }

  function t(k) {
    var s = STR[k];
    if (!s) return '';
    return s[lang()] || s.en;
  }
  function tx(k, x) { return t(k).replace('{x}', x); }

  /* Arabic uses its own comma. A list joined with a Latin comma inside
     an RTL sentence is the small tell that a string was translated and
     its punctuation was not. */
  function listJoin(parts) {
    return parts.join(isRTL() ? '، ' : ', ');
  }

  /* ===================================================================
     1 · READING THE PAGE'S REAL CONTROLS

     Every value in the bar comes out of a control that already exists
     in index.html. The LABEL comes out of the DOM rather than out of a
     table of our own, which is not laziness: index.html's fillSelect()
     writes each option's text through L() or metricName(), so the
     option text is ALREADY in the reader's language and is already
     re-rendered on every language switch. Copying those names into a
     table here would mean maintaining a second Arabic translation of
     every governorate, layer and epoch, and being wrong about one of
     them the first time somebody renames it.

     The chip rows are read the same way. index.html's
     renderExplorerControls() and renderMap() both write
     aria-pressed="true" on the active chip, so the selected layer and
     the selected map metric are legible from the DOM with no access to
     LAYERS or MAP_METRICS at all.
     =================================================================== */

  function $(id) { return document.getElementById(id); }

  function txt(node) {
    return node ? (node.textContent || '').replace(/\s+/g, ' ').trim() : '';
  }

  /* The rescue for the three untranslated lists. Returns '' for every
     select that does not need it, which is all of them but three, so
     the DOM text stays the source of truth everywhere it is honest. */
  function localSel(id, value) {
    var f = EN_ONLY[id];
    if (!f) return '';
    var s = STR[f(value)];
    if (!s) return '';            /* an option we do not know: use the DOM */
    return s[lang()] || s.en;
  }

  /* A <select>: its current value and the text of the chosen option.

     The option text is preferred because index.html already writes it
     in the reader's language through fillSelect(). localSel() overrides
     it only for #dashPeriod, #vRange and #cmpMode — see the note beside
     EN_ONLY for why those three are different and when this comes out. */
  function sel(id) {
    var s = $(id);
    if (!s || !s.options || !s.options.length) return null;
    var o = s.options[s.selectedIndex];
    if (!o) return null;
    return { v: s.value, t: localSel(id, s.value) || txt(o), el: s };
  }

  /* A chip row: the one button carrying aria-pressed="true". */
  function chip(id) {
    var c = $(id);
    if (!c) return null;
    var b = c.querySelector('[aria-pressed="true"]');
    if (!b) return null;
    return { v: null, t: txt(b), el: c };
  }

  /* The map has no select. Its region lives in S.map.sel and is set by
     a click or an Enter keypress on an SVG <g> inside #mapWrap, so
     there is no option element to read the name off.

     The name is looked up in #dashArea's options, which carry exactly
     the same governorate ids and are already translated — the page
     builds both lists from areaOptions(), which builds them from
     REGIONS. regName() is the fallback for the frame before the
     dashboard select has been filled; js/ksat-shell.js bridges it onto
     window for us. */
  function mapRegion() {
    var S = pageState();
    if (!S || !S.map) return null;
    var id = S.map.sel;
    if (!id) return null;
    var name = optionText('dashArea', id);
    if (!name) {
      try {
        if (typeof window.regName === 'function' && window.REG && window.REG[id]) {
          name = window.regName(window.REG[id]);
        }
      } catch (e) {}
    }
    return { v: id, t: name || String(id), el: $('mapWrap') };
  }

  function optionText(selectId, value) {
    var s = $(selectId);
    if (!s || !s.options) return '';
    for (var i = 0; i < s.options.length; i++) {
      if (String(s.options[i].value) === String(value)) return txt(s.options[i]);
    }
    return '';
  }

  /* index.html declares `const S` at the top level of a CLASSIC script,
     which binds it into the global declarative record and NOT onto
     window — the bug js/ksat-shell.js documents in its bridge, and the
     reason js/ksat-integration.js silently never recorded a run. The
     shell lifts it onto window for us. We read window.S first and fall
     back to the bare identifier, exactly as js/ksat-tour.js does, so
     this layer still works if it is ever loaded before the shell.

     `typeof` first, always: naming an identifier that was never
     declared throws ReferenceError, and an exception here would take
     the whole bar down. */
  function pageState() {
    try { return window.S || (typeof S !== 'undefined' ? S : null); }
    catch (e) { return null; }
  }

  /* A separator that does not pretend to be direction-neutral. The two
     epochs in the change-detection row are ordered — "2016 to 2024" is
     not the same comparison as "2024 to 2016" — and an arrow drawn
     left-to-right inside an RTL line points at the wrong one. */
  function arrow() { return isRTL() ? ' ← ' : ' → '; }

  /* ===================================================================
     2 · THE FIELDS

     FOUR in the bar, because section 21 names four — location,
     dataset, period, metric — and because four chips is what fits on a
     390px screen in two rows. The rest go in the MORE panel rather
     than being dropped: this layer does not remove anything, and a
     researcher who has set a simulation ambition needs to be able to
     find out what it currently is.

     `edit` is the id of the control the bar sends you to. It is the
     real control every time. There is no case where the bar edits a
     value itself.
     =================================================================== */

  var FIELDS = [
    { key: 'location', label: 'ss.location', edit: 'dashArea',
      read: function () { return sel('dashArea'); } },

    /* "Dataset" is the scene plus the analytical layer drawn over it.
       Either one alone is an incomplete answer to "what am I looking
       at": the same scene under True colour and under Vegetation index
       is two different readings. */
    { key: 'dataset', label: 'ss.dataset', edit: 'exScene',
      read: function () {
        var scene = sel('exScene');
        var layer = chip('exLayers');
        if (!scene && !layer) return null;
        var parts = [];
        if (scene && scene.t) parts.push(scene.t);
        if (layer && layer.t) parts.push(layer.t);
        return { v: scene ? scene.v : null, t: parts.join(' · '), el: $('exScene') };
      } },

    { key: 'period', label: 'ss.period', edit: 'dashPeriod',
      read: function () { return sel('dashPeriod'); } },

    { key: 'metric', label: 'ss.metric', edit: 'mapMetrics',
      read: function () { return chip('mapMetrics'); } }
  ];

  var MORE = [
    { key: 'region',    label: 'ss.region',    edit: 'mapWrap',  read: mapRegion },
    { key: 'epoch',     label: 'ss.epoch',     edit: 'exEpoch',  read: function () { return sel('exEpoch'); } },
    { key: 'simarea',   label: 'ss.simarea',   edit: 'simArea',  read: function () { return sel('simArea'); } },
    { key: 'simamb',    label: 'ss.simamb',    edit: 'simAmb',   read: function () { return sel('simAmb'); } },
    { key: 'vizarea',   label: 'ss.vizarea',   edit: 'vArea',    read: function () { return sel('vArea'); } },
    { key: 'vizmetric', label: 'ss.vizmetric', edit: 'vMetric',  read: function () { return sel('vMetric'); } },
    { key: 'vizrange',  label: 'ss.vizrange',  edit: 'vRange',   read: function () { return sel('vRange'); } },
    { key: 'cmp',       label: 'ss.cmp',       edit: 'cmpA',
      read: function () {
        var a = sel('cmpA'), b = sel('cmpB'), m = sel('cmpMode');
        if (!a || !b) return null;
        var s = a.t + arrow() + b.t;
        if (m && m.t) s += ' · ' + m.t;
        return { v: a.v + '|' + b.v, t: s, el: $('cmpA') };
      } }
  ];

  /* ===================================================================
     3 · WHAT IS WRITTEN TO THE DEVICE, AND WHERE THE LINE IS

     THE LINE: a value is persisted only if it was CHOSEN FROM A FIXED
     LIST THE PAGE ITSELF DEFINES — a <select> option, or a chip in a
     chip row. Nothing else. Not a number typed into a field, not a
     slider position, not a result, not a report, not a mission name.

     WHY THE LINE IS THERE. This platform's entire security story is
     that no researcher can see another researcher's work: `anon` holds
     zero table grants and row-level security in Postgres means a
     signed-in researcher sees only their own rows. localStorage is on
     the other side of that line completely. It is per-DEVICE, not
     per-account: it is not cleared on sign-out, it is not scoped to a
     session, and the next person to open this browser reads whatever
     the last person left in it.

     So the question for every candidate field is not "is this secret",
     it is "if a colleague opened this laptop tomorrow, would this tell
     them something about the person who used it yesterday". "Farwaniya,
     last 12 months, vegetation index" does not: it is a view of a
     published reference dataset and it is the same four words for
     everyone who looks at Farwaniya. "Plant 42,000 trees in Al Jahra at
     a 15% corridor" is a proposal somebody is working on, and it is
     theirs.

     Which is why #calcTrees, #calcCover and #calcCorridor (S.calc), the
     agent's thresholds (S.ag.thresh, S.ag.gp), every simulation result
     (S.sim.ran, S.sim.res), the agent's output and report (S.ag.out,
     S.ag.report) and the pass log (S.orb.log) are all absent from the
     list below, and are absent on purpose rather than by oversight. A
     number a researcher chose is an intention. A row they generated is
     work product. Neither belongs in a key that outlives their session
     on a shared machine.

     S.ex.view (the explorer's pan and zoom) is also left out, for a
     different and smaller reason: restoring a viewer to a deep zoom on
     a corner of a scene, with no visible explanation, looks like a
     broken canvas rather than like a restored preference.

     THEME AND LANGUAGE are named in section 20 and are deliberately NOT
     here. js/ksat-appearance.js already persists the theme under
     ksat.theme and js/ksat-i18n.js already persists the language under
     ksat.lang. A second writer for either would be two sources of truth
     for one setting, which is the bug this layer exists to avoid.

     THE KEY NAME follows the family the other layers use — ksat_nav
     (js/ksat-shell.js), ksat_tour (js/ksat-tour.js), ksat_tier_note
     (js/ksat-shell.js). One key, one JSON object, one version number,
     so a later shape change can be recognised and dropped rather than
     half-applied.
     =================================================================== */

  var KEY = 'ksat_session';
  var VERSION = 1;

  /* `path` addresses index.html's own S. `opts` is the id of the select
     whose options are the value's whitelist. `table` is the name of the
     page's data array for the chip rows, which have no option elements
     to validate against; both are checked before anything is written
     back into S, so a stored id that no longer exists is dropped rather
     than restored into a state nothing can render. */
  var PERSIST = [
    { path: 'dash.area',   opts: 'dashArea',  field: 'location' },
    { path: 'dash.period', opts: 'dashPeriod', num: true, field: 'period' },
    { path: 'ex.scene',    opts: 'exScene',   field: 'dataset' },
    { path: 'ex.epoch',    opts: 'exEpoch',   field: 'epoch' },
    { path: 'ex.layer',    table: 'LAYERS',   field: 'dataset' },
    { path: 'map.sel',     table: 'REGIONS',  field: 'region' },
    { path: 'map.metric',  table: 'MAP_METRICS', field: 'metric' },
    { path: 'sim.area',    opts: 'simArea',   field: 'simarea' },
    { path: 'sim.amb',     opts: 'simAmb',    field: 'simamb' },
    { path: 'viz.area',    opts: 'vArea',     field: 'vizarea' },
    { path: 'viz.metric',  opts: 'vMetric',   field: 'vizmetric' },
    { path: 'viz.range',   opts: 'vRange',    num: true, field: 'vizrange' },
    { path: 'cmp.a',       opts: 'cmpA',      field: 'cmp' },
    { path: 'cmp.b',       opts: 'cmpB',      field: 'cmp' },
    { path: 'cmp.mode',    opts: 'cmpMode',   field: 'cmp' }
  ];

  function getPath(S, p) {
    var a = p.split('.');
    var o = S[a[0]];
    return o ? o[a[1]] : undefined;
  }
  function setPath(S, p, v) {
    var a = p.split('.');
    if (S[a[0]]) S[a[0]][a[1]] = v;
  }

  /* Is this stored value still a thing the page can render? */
  function valid(rule, v) {
    if (v === undefined || v === null || v === '') return false;
    if (rule.opts) {
      var s = $(rule.opts);
      if (!s || !s.options || !s.options.length) return false;
      for (var i = 0; i < s.options.length; i++) {
        if (String(s.options[i].value) === String(v)) return true;
      }
      return false;
    }
    if (rule.table) {
      /* Same classic-script trick as pageState(): these are top-level
         `const` arrays in index.html and are not on window. */
      var arr = null;
      try { arr = window[rule.table]; } catch (e) {}
      if (!arr) {
        /* REGIONS is bridged onto window by js/ksat-shell.js; LAYERS
           and MAP_METRICS are not, so they are read as bare
           identifiers out of the shared global declarative record.
           Each is named explicitly rather than looked up dynamically,
           because there is no way to `typeof` a name held in a
           variable without eval, and eval is not going near a page
           with this CSP. */
        try { if (rule.table === 'LAYERS'      && typeof LAYERS      !== 'undefined') arr = LAYERS; } catch (e) {}
        try { if (rule.table === 'REGIONS'     && typeof REGIONS     !== 'undefined') arr = REGIONS; } catch (e) {}
        try { if (rule.table === 'MAP_METRICS' && typeof MAP_METRICS !== 'undefined') arr = MAP_METRICS; } catch (e) {}
      }
      if (!arr || !arr.length) return false;   /* cannot check it, do not restore it */
      for (var j = 0; j < arr.length; j++) {
        if (arr[j] && String(arr[j].id) === String(v)) return true;
      }
      return false;
    }
    return false;
  }

  /* Every read and write in try/catch. A browser with site data blocked
     throws on the ACCESSOR, not on the value, so `localStorage` itself
     is inside the try. */
  var storageOK = true;

  function load() {
    var raw = null;
    try { raw = localStorage.getItem(KEY); }
    catch (e) { storageOK = false; return null; }
    if (!raw) return null;
    var data = null;
    try { data = JSON.parse(raw); } catch (e) { return null; }
    if (!data || data.v !== VERSION) {
      /* A shape from another version is dropped whole rather than
         half-applied. Half a restored filter is the worst of the three
         outcomes: it is wrong AND it looks deliberate. */
      try { localStorage.removeItem(KEY); } catch (e2) {}
      return null;
    }
    return data;
  }

  function save() {
    if (!storageOK) return;
    var S = pageState();
    if (!S) return;
    var out = { v: VERSION, sel: {} };
    var allDefault = !!DEFAULTS;
    PERSIST.forEach(function (rule) {
      var cur = getPath(S, rule.path);
      if (cur === undefined || cur === null) return;
      out.sel[rule.path] = cur;
      if (DEFAULTS && String(DEFAULTS[rule.path]) !== String(cur)) allDefault = false;
    });
    out.fold = folded ? 1 : 0;
    out.more = moreOpen ? 1 : 0;

    /* A record that says "everything is where the page put it" is a
       record of nothing, and keeping one has a real cost: the next
       visit would restore fifteen values that were never chosen and
       announce them as carried over, which is the exact lie section 9
       exists to prevent. So an untouched state removes the key instead.

       It is also what makes "Start fresh" hold. That button writes the
       defaults back into S, which repaints the page, which trips the
       watcher in section 8, which calls save() a moment later — if
       this branch were not here, pressing "Start fresh" would forget
       the record and immediately write a fresh one. */
    if (allDefault && !folded && !moreOpen) { forget(); return; }

    try { localStorage.setItem(KEY, JSON.stringify(out)); }
    catch (e) { storageOK = false; }
  }

  function forget() {
    try { localStorage.removeItem(KEY); } catch (e) {}
  }

  /* Writes are debounced. Dragging the change-detection wipe or
     clicking through five map metrics in three seconds should not be
     five JSON serialisations and five synchronous storage writes on a
     page that is already holding twenty-six canvases. */
  var saveTimer = null;
  function saveSoon() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { saveTimer = null; save(); }, 400);
  }

  /* ===================================================================
     4 · THE BAR

     Built once, on the first insider tier, and inserted as the first
     child of <main>. It is not built for a public visitor at all — not
     built and hidden, not built. The tier check is in section 8.
     =================================================================== */

  var bar = null;
  var elFields = null, elMore = null, elPanel = null, elNote = null,
      elNoteTxt = null, elSum = null, elFoldBtn = null, elMoreBtn = null,
      elFine = null;
  var folded = false;
  var moreOpen = false;
  var restoredKeys = {};     /* field key -> true, while the mark is up */
  var lastSig = '';          /* the whole bar as one string, to skip no-op repaints */

  function el(tag, cls) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }

  function chevron() {
    /* Inline SVG rather than a glyph: "▾" renders at wildly different
       sizes across the three font stacks this page loads, and the
       Arabic face does not carry it at all. */
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 16 16');
    s.setAttribute('width', '12');
    s.setAttribute('height', '12');
    s.setAttribute('fill', 'none');
    s.setAttribute('aria-hidden', 'true');
    var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', 'M4 6.2 8 10.2l4-4');
    p.setAttribute('stroke', 'currentColor');
    p.setAttribute('stroke-width', '1.6');
    p.setAttribute('stroke-linecap', 'round');
    p.setAttribute('stroke-linejoin', 'round');
    s.appendChild(p);
    return s;
  }

  function build() {
    if (bar) return bar;
    var main = document.querySelector('main');
    if (!main) return null;

    bar = el('div', 'ksat-ss');
    bar.id = 'ksat-ss';
    /* A region, because it is persistent page chrome a screen-reader
       user needs to be able to jump to and back out of, and it is not
       navigation. */
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', t('ss.barAria'));

    var inn = el('div', 'ksat-ss-in');

    var eye = el('span', 'ksat-ss-eye');
    eye.id = 'ksat-ss-eye';
    inn.appendChild(eye);

    elFields = el('ul', 'ksat-ss-fields');
    inn.appendChild(elFields);

    elSum = el('div', 'ksat-ss-sum');
    inn.appendChild(elSum);

    var acts = el('div', 'ksat-ss-acts');

    elMoreBtn = el('button', 'ksat-ss-btn ksat-ss-more');
    elMoreBtn.type = 'button';
    elMoreBtn.setAttribute('aria-expanded', 'false');
    elMoreBtn.addEventListener('click', function () { setMore(!moreOpen); });
    acts.appendChild(elMoreBtn);

    elFoldBtn = el('button', 'ksat-ss-btn ksat-ss-fold');
    elFoldBtn.type = 'button';
    elFoldBtn.setAttribute('aria-expanded', 'true');
    elFoldBtn.appendChild(chevron());
    elFoldBtn.addEventListener('click', function () { setFold(!folded); });
    acts.appendChild(elFoldBtn);

    inn.appendChild(acts);
    bar.appendChild(inn);

    /* The restored notice. role="status" rather than role="alert":
       nothing has gone wrong, and an alert interrupts. */
    elNote = el('div', 'ksat-ss-note');
    elNote.hidden = true;
    elNote.setAttribute('role', 'status');
    var noteIn = el('div', 'ksat-ss-note-in');
    elNoteTxt = el('div', 'ksat-ss-note-txt');
    noteIn.appendChild(elNoteTxt);
    var noteActs = el('div', 'ksat-ss-note-acts');

    var keep = el('button', 'ksat-ss-btn ksat-ss-keep');
    keep.type = 'button';
    keep.addEventListener('click', function () { dismissNote(); });
    noteActs.appendChild(keep);

    var reset = el('button', 'ksat-ss-btn ksat-ss-reset');
    reset.type = 'button';
    reset.addEventListener('click', function () { startFresh(); });
    noteActs.appendChild(reset);

    noteIn.appendChild(noteActs);
    elNote.appendChild(noteIn);
    bar.appendChild(elNote);

    elPanel = el('div', 'ksat-ss-panel');
    elPanel.hidden = true;
    elPanel.id = 'ksat-ss-panel';
    elMoreBtn.setAttribute('aria-controls', 'ksat-ss-panel');
    var panIn = el('div', 'ksat-ss-panel-in');
    elMore = panIn;
    elPanel.appendChild(panIn);
    bar.appendChild(elPanel);

    elFine = el('p', 'ksat-ss-fine');
    panIn.appendChild(elFine);

    /* FIRST child of <main>, so it is in flow above every section and
       can be sticky without being fixed. index.html's <main> holds a
       single <div class="wrap">; inserting before it gives the bar the
       full width of main, which is what a full-bleed strip wants, and
       the inner element re-applies --maxw and --gut so the content
       lines up with the page. */
    main.insertBefore(bar, main.firstChild);

    root.setAttribute('data-ksat-session', 'on');
    measure();
    place();
    observeSize();
    return bar;
  }

  function destroy() {
    if (!bar) return;
    unobserveSize();
    try { bar.remove(); } catch (e) {}
    bar = null;
    elFields = elMore = elPanel = elNote = elNoteTxt = elSum = null;
    elFoldBtn = elMoreBtn = elFine = null;
    lastSig = '';
    lastH = '';
    /* The next bar is a different element with a blank style attribute,
       so the remembered value would suppress the write that positions
       it and it would sit at top:0 over the masthead. */
    lastTop = '';
    root.removeAttribute('data-ksat-session');
    /* removeProperty, not setProperty('0px'): the stylesheet's own
       0px default is the right value for a page with no bar, and
       leaving an inline custom property on <html> after the element it
       described is gone is a stale fact waiting to mislead. */
    try { root.style.removeProperty('--ksat-ss-h'); } catch (e) {}
  }

  /* ===================================================================
     5 · MEASURING THE BAR

     css/ksat-session.css adds --ksat-ss-h to the page's two
     scroll-margin-top rules so a deep link does not land behind the
     bar. The height cannot be written as a constant: the bar wraps to
     two rows below 460px, the notice row and the MORE panel both change
     it, and the Arabic strings are a different length from the English
     ones so the wrap point moves with the language.

     getBoundingClientRect().height rather than offsetHeight, for the
     reason js/ksat-tour.js gives: it is fractional and does not round a
     44.5px bar down into the section below it.

     Written only when the value CHANGES. An inline style write on
     <html> is an attribute mutation and this page carries several
     MutationObservers on the root element, including one in
     js/ksat-tour.js. Re-writing the same string would be a mutation
     storm for no pixels.
     =================================================================== */

  /* ---------------------------------------------------------------
     PLACING THE BAR, which is the job `position: sticky` would have
     done if it worked on this page. It does not, and css/ksat-session.css
     section 1 carries the measurement: css/ksat-editorial.css ships
     `html, body { overflow-x: hidden }`, that forces body's overflow-y
     to compute to `auto`, body becomes a scrollport that never scrolls,
     and a sticky child of <main> therefore never sticks. The bar is
     fixed instead, and this writes the one number fixed needs.

     The number is the masthead's live lower edge: its height while it
     is on screen, 0 once it has scrolled away. Reading the rect rather
     than --bar-h is deliberate — the masthead wraps to two rows on a
     narrow viewport and the Arabic strings change where it wraps, so
     the constant is wrong exactly when it matters.

     ON <main>, NOT ON <html>. measure() explains why an inline style
     write on the root element is expensive here: several layers watch
     that element. This writes to the bar's own style, so a scroll
     costs one property on one element nobody is observing.

     IS THIS A rAF LOOP? Section 8 promises the file has none, and this
     does not break that promise: there is no free-running loop. The
     listener is passive and event-driven, one frame is requested only
     when a scroll actually happened, and the write is skipped when the
     value has not moved — a page sitting still schedules nothing.

     It is also NOT gated on prefers-reduced-motion, and that is
     correct rather than an oversight. This is not an animation; it is
     where the element IS. Freezing it under reduced motion would leave
     the bar sitting over the masthead, which is not less motion, it is
     a layout bug. */
  var lastTop = '';
  function place() {
    if (!bar) return;
    var t = 0;
    try {
      var mast = document.querySelector('.bar');
      if (mast) {
        var r = mast.getBoundingClientRect();
        /* Only while it is genuinely on screen. A masthead scrolled
           above the fold has a negative bottom and must not pull the
           bar up off the top of the viewport with it. */
        if (r.height > 0 && r.bottom > 0) t = r.bottom;
      }
    } catch (e) { return; }
    var v = Math.max(0, Math.round(t)) + 'px';
    if (v === lastTop) return;
    lastTop = v;
    try { bar.style.top = v; } catch (e) {}
  }

  var placeQueued = false;
  function placeSoon() {
    if (placeQueued) return;
    placeQueued = true;
    var run = function () { placeQueued = false; place(); };
    try { requestAnimationFrame(run); } catch (e) { setTimeout(run, 16); }
  }

  var lastH = '';
  function measure() {
    if (!bar) return;
    var h = 0;
    try { h = bar.getBoundingClientRect().height; } catch (e) { return; }
    if (!(h > 0)) return;
    var v = Math.ceil(h) + 'px';
    if (v === lastH) return;
    lastH = v;
    try { root.style.setProperty('--ksat-ss-h', v); } catch (e) {}
  }

  /* ===================================================================
     6 · PAINTING

     One function reads every field and writes the bar. It builds a
     signature string first and returns without touching the DOM if
     nothing moved, because this runs on every click anywhere on the
     page (section 7) and a repaint per click on a page with this many
     canvases is not free.
     =================================================================== */

  function fieldValue(def) {
    var got = null;
    try { got = def.read(); } catch (e) { got = null; }
    return got;
  }

  /* Returns true when it actually rewrote the bar. The watcher in
     section 8 uses that as its "something changed" signal, so a click
     that moved nothing costs one signature string and no storage
     write. */
  function paint() {
    if (!bar) return false;

    var vals = {};
    var sig = lang() + '|';
    FIELDS.concat(MORE).forEach(function (def) {
      var g = fieldValue(def);
      vals[def.key] = g;
      sig += def.key + '=' + (g ? g.t : '') + ';';
    });
    sig += 'f' + (folded ? 1 : 0) + 'm' + (moreOpen ? 1 : 0);
    sig += 'r' + Object.keys(restoredKeys).join(',');
    if (sig === lastSig) return false;
    lastSig = sig;

    var eye = $('ksat-ss-eye');
    if (eye) eye.textContent = t('ss.eyebrow');

    bar.setAttribute('aria-label', t('ss.barAria'));

    /* --- the four chips ------------------------------------------ */
    elFields.innerHTML = '';
    FIELDS.forEach(function (def) {
      var g = vals[def.key];
      var li = el('li');
      var b = el('button', 'ksat-ss-f');
      b.type = 'button';
      b.setAttribute('data-ksat-ss-field', def.key);
      if (!g || !g.t) b.setAttribute('data-ksat-ss-empty', 'true');
      if (restoredKeys[def.key]) b.setAttribute('data-ksat-ss-restored', 'true');
      b.setAttribute('aria-label', tx('ss.editAria', t(def.label)));

      var k = el('span', 'k');
      k.textContent = t(def.label);
      b.appendChild(k);

      var v = el('span', 'v');
      v.textContent = (g && g.t) ? g.t : t('ss.none');
      b.appendChild(v);

      b.addEventListener('click', function () { goEdit(def); });
      li.appendChild(b);
      elFields.appendChild(li);
    });

    /* --- the folded summary -------------------------------------- */
    var sum = [];
    FIELDS.forEach(function (def) {
      var g = vals[def.key];
      if (g && g.t) sum.push(g.t);
    });
    elSum.textContent = sum.length ? sum.join(' · ') : t('ss.none');

    /* --- the MORE panel ------------------------------------------ */
    elMoreBtn.textContent = moreOpen ? t('ss.fewer') : t('ss.more');
    elMoreBtn.setAttribute('aria-label', t('ss.moreAria'));
    elFoldBtn.setAttribute('aria-label', folded ? t('ss.unfold') : t('ss.fold'));

    /* The fine print is re-appended rather than rebuilt so the rows
       above it can be replaced wholesale. */
    elMore.innerHTML = '';
    MORE.forEach(function (def) {
      var g = vals[def.key];
      var r = el('button', 'ksat-ss-row');
      r.type = 'button';
      r.setAttribute('data-ksat-ss-field', def.key);
      if (restoredKeys[def.key]) r.setAttribute('data-ksat-ss-restored', 'true');
      r.setAttribute('aria-label', tx('ss.editAria', t(def.label)));
      var k = el('span', 'k');
      k.textContent = t(def.label);
      r.appendChild(k);
      var v = el('span', 'v');
      v.textContent = (g && g.t) ? g.t : t('ss.none');
      r.appendChild(v);
      r.addEventListener('click', function () { goEdit(def); });
      elMore.appendChild(r);
    });
    elFine = el('p', 'ksat-ss-fine');
    elFine.textContent = storageOK ? t('ss.fine') : t('ss.fineNo');
    elMore.appendChild(elFine);

    /* The notice's own two buttons carry live strings too. */
    var keep = bar.querySelector('.ksat-ss-keep');
    var reset = bar.querySelector('.ksat-ss-reset');
    if (keep) keep.textContent = t('ss.keep');
    if (reset) {
      reset.textContent = t('ss.reset');
      reset.setAttribute('aria-label', t('ss.resetAria'));
    }

    measure();
    return true;
  }

  function setFold(on) {
    folded = !!on;
    if (bar) bar.setAttribute('data-ksat-ss-fold', folded ? 'true' : 'false');
    if (elFoldBtn) elFoldBtn.setAttribute('aria-expanded', folded ? 'false' : 'true');
    lastSig = '';
    paint();
    saveSoon();
  }

  function setMore(on) {
    moreOpen = !!on;
    if (elPanel) elPanel.hidden = !moreOpen;
    if (elMoreBtn) elMoreBtn.setAttribute('aria-expanded', moreOpen ? 'true' : 'false');
    lastSig = '';
    paint();
    saveSoon();
  }

  /* ===================================================================
     7 · THE EDIT AFFORDANCE

     Goes to the real control and focuses it, then rings it for two
     seconds. The ring matters: the reader has just travelled several
     screens and is looking for one 180px dropdown among six of them,
     and a focus outline on a page with this much chrome is easy to
     miss.

     scrollIntoView rather than KS.shell.goToSection, and that is not a
     shortcut. js/ksat-shell.js PATCHES Element.prototype.scrollIntoView
     so that scrolling to an element inside a hidden chapter opens that
     chapter first, and scrolling to a locked section redirects to its
     invitation panel. Calling the patched native method gets all of
     that for free and keeps working if the shell is not loaded.
     =================================================================== */

  var ringTimer = null;

  function goEdit(def) {
    var target = $(def.edit);
    if (!target) {
      /* The section is not in the document — it can happen while a
         chapter is mid-swap. Repaint and say nothing: a button that
         silently does nothing is better than one that throws. */
      lastSig = '';
      paint();
      return;
    }

    /* The mark on a restored field is a "you did not choose this"
       flag. The moment the reader goes to that control they know, so
       the flag has done its job and comes off. */
    if (restoredKeys[def.key]) {
      delete restoredKeys[def.key];
      if (!Object.keys(restoredKeys).length) dismissNote();
      lastSig = '';
    }

    /* SMOOTH WITHIN A CHAPTER, INSTANT ACROSS ONE, and this is measured.

       If the control is in a chapter that is currently closed, the
       patched scrollIntoView in js/ksat-shell.js opens it first. That
       open is cheap in itself — the whole synchronous call measured 1ms
       — but it ends in nudgeRedraw(), which re-measures and repaints
       every canvas that had no box while it was hidden. There are 27
       canvases on this page, and that work lands on the main thread a
       tick later.

       A smooth scroll issued into that is starved: the animation is
       driven by the same thread that is busy drawing, so it stutters,
       and on a slower machine it is dropped altogether. Measured here,
       the map-metric jump from the top of the page simply never
       arrived — the reader pressed a field and the page stayed where it
       was, which reads as a dead button.

       So a jump that reveals a chapter is instant. That is also the
       honest choice rather than merely the working one: the reveal has
       already changed the whole page, and gliding through four thousand
       pixels of content that is still painting communicates nothing.
       A jump within the open chapter keeps its smooth scroll, because
       there the movement is what tells the reader where they went. */
    var instant = reduced() || sectionHidden(target);

    try { target.scrollIntoView({ behavior: instant ? 'auto' : 'smooth', block: 'center' }); }
    catch (e) { try { target.scrollIntoView(); } catch (e2) {} }

    afterScrollSettles(instant, function () {
      try {
        /* A chip row is a <div>: focus its first chip, not the row. */
        var f = target;
        if (!f.matches('select, button, input, textarea, a[href]')) {
          f = target.querySelector('button, select, [tabindex]') || target;
        }
        if (f.focus) f.focus({ preventScroll: true });
      } catch (e) {}

      clearOfChrome(target, instant);
      ring(target);
    });

    paint();
  }

  /* WAIT FOR THE SCROLL TO STOP, rather than guessing how long it takes.

     This replaced a flat 420ms delay, and the bug it fixes was measured
     rather than theorised. Pressing the map-metric field from the top of
     the page is a cross-chapter jump: the patched scrollIntoView in
     js/ksat-shell.js opens the "intel" chapter, four thousand pixels of
     content come back into flow, and a smooth scroll of ~4,600px starts.
     420ms later that scroll is nowhere near finished — so the correction
     below read a rect from the middle of a moving page and issued a
     scrollBy against it. A smooth scrollBy during an in-flight smooth
     scroll REPLACES it in Chrome rather than queueing behind it, so the
     two fought and the reader ended up somewhere neither had asked for.
     Four of the six fields tested landed nowhere near their control.

     There is no event for "programmatic smooth scroll finished"
     (scrollend is still not in every engine this page supports), so the
     position is sampled until it stops moving.

     THIS IS NOT A STATE POLL, which matters because section 8 promises
     there are none in this file. It is a one-shot settle check with two
     independent stops: 100ms of stillness, or a 2s ceiling. It cannot
     outlive the gesture that started it, and nothing schedules another.

     Under reduced motion every scroll above is instant, so there is
     nothing to wait for beyond one tick for layout to flush. */
  /* Is this control inside a chapter that is closed right now? The
     chapter layer in js/ksat-shell.js hides a closed chapter's sections
     with hidden="until-found" where the engine supports it and a plain
     `hidden` where it does not, so the attribute's presence is the
     question, never its value. Asked BEFORE the scroll, because the
     patched scrollIntoView is about to remove it. */
  function sectionHidden(node) {
    try {
      var s = node.closest ? node.closest('section.sec') : null;
      return !!(s && s.hasAttribute('hidden'));
    } catch (e) { return false; }
  }

  function afterScrollSettles(instant, cb) {
    if (instant) { setTimeout(cb, 40); return; }
    var last = -1, still = 0, tries = 0;
    var iv = setInterval(function () {
      tries++;
      var y = Math.round(window.scrollY || window.pageYOffset || 0);
      if (y === last) still++; else still = 0;
      last = y;
      if (still >= 2 || tries > 40) { clearInterval(iv); cb(); }
    }, 50);
  }

  /* THE CORRECTION PASS, and why scrollIntoView alone was not enough.

     Measured on the running page: pressing the location field landed
     #dashArea at y=609 in a 630px viewport — technically scrolled to,
     effectively off the bottom edge, with its lower half cut off.

     Two things conspire. block:'center' centres against the VIEWPORT,
     which knows nothing about the sticky bar covering the top of it; and
     js/ksat-shell.js patches Element.prototype.scrollIntoView to open a
     hidden chapter first, so the scroll that actually runs is not always
     the one asked for. Calling the patched method is still right — it is
     what opens the chapter and what redirects a locked section — so this
     does not replace it. It runs after it and fixes up what is left.

     The fix is deliberately one-directional: it only ever moves a target
     that is genuinely obscured, and it never scrolls a control that is
     already comfortably in view. A correction that fires every time
     would fight the smooth scroll that is still settling.

     The top edge is the bar's own measured bottom rather than
     --ksat-ss-h, because the masthead sits above the bar and the real
     obstruction is the sum of the two. */
  function clearOfChrome(node, instant) {
    try {
      var b = node.getBoundingClientRect();
      var vh = window.innerHeight || 0;
      if (!vh) return;

      var top = 0;
      if (bar) {
        var bb = bar.getBoundingClientRect();
        if (bb.height > 0) top = bb.bottom;
      }
      var pad = 12;
      var delta = 0;

      if (b.top < top + pad) {
        delta = b.top - (top + pad);               /* hidden behind the chrome */
      } else if (b.bottom > vh - pad) {
        /* Below the fold. Bring the whole control up, but never so far
           that it disappears under the bar we just cleared it of. */
        delta = Math.min(b.bottom - (vh - pad), b.top - (top + pad));
      }
      if (!delta) return;

      /* Matches the scroll that got us here: a correction that glides
         after an instant jump is the same starved animation again, and
         after a chapter reveal it lands in the middle of the canvas
         repaint. */
      window.scrollBy({ top: delta, behavior: (instant || reduced()) ? 'auto' : 'smooth' });
    } catch (e) { /* a nudge that fails is not worth an exception */ }
  }

  function ring(node) {
    if (ringTimer) { clearTimeout(ringTimer); ringTimer = null; }
    try {
      var old = document.querySelectorAll('[data-ksat-ss-target]');
      for (var i = 0; i < old.length; i++) old[i].removeAttribute('data-ksat-ss-target');
      node.setAttribute('data-ksat-ss-target', '');
    } catch (e) { return; }
    ringTimer = setTimeout(function () {
      ringTimer = null;
      try { node.removeAttribute('data-ksat-ss-target'); } catch (e) {}
    }, 2300);
  }

  function reduced() {
    try { return matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (e) { return false; }
  }

  /* ===================================================================
     8 · WATCHING THE CONTROLS

     Delegated listeners on `document`, not listeners bound to each
     control, and that is forced rather than chosen. index.html's
     fillSelect() does `sel.innerHTML = ""` and rebuilds every option,
     and renderExplorerControls() and renderMap() rebuild their chip
     rows element by element — both run inside renderAll(), which fires
     on every language switch. A listener bound to a chip does not
     survive the next repaint. js/ksat-shell.js hit the same wall with
     the nav buttons and reached for a MutationObserver for the same
     reason.

     The selects carry `onchange` handlers assigned by index.html's
     bind(). A delegated listener on document sees the event AFTER that
     handler has run, which is exactly what we want: S is already
     updated by the time we read it.

     The map is the one control with no element event we can rely on —
     its regions are SVG <g> nodes wired with both click and keydown —
     so #regionPanel is watched instead. index.html's renderRegionPanel()
     rewrites it whenever the selection changes, whichever input caused
     it.

     NO POLLING. There is no setInterval here reading state, and no
     requestAnimationFrame loop at all, which is why there is nothing in
     this file that has to check prefers-reduced-motion. The one timer
     below is the boot readiness check, and it stops.
     =================================================================== */

  var watching = false;
  var mo = null;

  function bump() {
    if (paint()) saveSoon();
  }

  function watch() {
    if (watching) return;
    watching = true;

    document.addEventListener('change', function (e) {
      if (!bar) return;
      var id = e.target && e.target.id;
      if (!id) return;
      if (!isWatchedId(id)) return;
      bump();
    }, false);

    /* Chips and map regions are clicks. A frame's delay so the page's
       own handler has finished writing S and re-rendering. */
    document.addEventListener('click', function () {
      if (!bar) return;
      setTimeout(bump, 0);
    }, false);

    /* The map's regions answer Enter and Space as well as clicks. */
    document.addEventListener('keyup', function (e) {
      if (!bar) return;
      if (e.key !== 'Enter' && e.key !== ' ') return;
      setTimeout(bump, 0);
    }, false);

    if (typeof MutationObserver !== 'undefined') {
      mo = new MutationObserver(function () { setTimeout(bump, 0); });
      ['regionPanel', 'exLayers', 'mapMetrics'].forEach(function (id) {
        var n = $(id);
        if (n) { try { mo.observe(n, { childList: true }); } catch (e) {} }
      });
    }

    /* js/ksat-i18n.js re-renders every label on the page and then says
       so. Our strings and every option text we read change with it. */
    document.addEventListener('ksat:lang', function () {
      lastSig = '';
      /* The masthead re-lays-out in the new language and can change
         height, and nothing scrolls when it does — so place() has to be
         asked directly rather than waiting for a scroll that will not
         come. */
      setTimeout(function () { paint(); place(); }, 60);
    });

    /* Chapters swap which sections are in flow, so a control the bar
       reads can leave and re-enter the document. */
    document.addEventListener('ksat:chapter', function () {
      lastSig = '';
      setTimeout(function () { paint(); }, 60);
    });

    /* The bar's own height changes with the viewport, and the wrap
       point differs between English and Arabic. */
    window.addEventListener('resize', function () {
      setTimeout(measure, 120);
      placeSoon();
    });

    /* The bar is fixed, so it has to be told where the masthead's lower
       edge is on every scroll. Passive, because this never calls
       preventDefault and a non-passive scroll listener on a page with
       twenty-seven canvases is a scroll-jank bug waiting to be filed. */
    try { window.addEventListener('scroll', placeSoon, { passive: true }); }
    catch (e) { window.addEventListener('scroll', placeSoon, false); }

    /* A BACKGROUND TAB DOES NOT RUN requestAnimationFrame, which was
       measured here rather than assumed: in a hidden tab a frame
       requested by placeSoon() never arrived at all, and the bar kept
       the offset it had when the tab was hidden.

       That is the browser behaving correctly and it is mostly harmless,
       because nobody scrolls a tab they cannot see. It stops being
       harmless on the way back: a restore fires no scroll event, so
       without this the reader returns to a bar still positioned for
       wherever the page was when they left — sitting over the masthead,
       or floating below where it belongs.

       place() directly rather than placeSoon(), because the whole point
       is that the frame queue is what could not be trusted. */
    document.addEventListener('visibilitychange', function () { place(); });
  }

  /* The size observer is deliberately NOT in watch(), and this is a bug
     rather than a style preference.

     watch() returns immediately if it has run before, because its
     listeners are bound to `document` and binding them twice would run
     every repaint twice. The ResizeObserver is the one thing in there
     that was bound to the BAR instead — and the bar is destroyed and
     rebuilt on every tier change. A researcher who signs out and back
     in got a fresh bar with the observer still watching the detached
     one, so --ksat-ss-h stopped following anything measure() was not
     already called for by hand.

     So it is created per bar, in build(), and dropped in destroy().
     Height still tracks without it — paint() and showNote() both call
     measure() — but it is what catches the changes nobody asked for,
     the late webfont swap being the one that actually moves the wrap
     point on the Arabic page. */
  var ro = null;
  function observeSize() {
    if (typeof ResizeObserver === 'undefined' || !bar) return;
    try {
      ro = new ResizeObserver(function () { measure(); });
      ro.observe(bar);
    } catch (e) { ro = null; }
  }
  function unobserveSize() {
    if (!ro) return;
    try { ro.disconnect(); } catch (e) {}
    ro = null;
  }

  var WATCHED_IDS = ['dashArea', 'dashPeriod', 'exScene', 'exEpoch',
                     'simArea', 'simAmb', 'vArea', 'vMetric', 'vRange',
                     'cmpA', 'cmpB', 'cmpMode'];
  function isWatchedId(id) { return WATCHED_IDS.indexOf(id) !== -1; }

  /* ===================================================================
     9 · RESTORING, VISIBLY

     Section 20 asks that the selections survive navigation. The part
     that is easy to get wrong is the part that matters: a researcher
     who comes back to a dashboard that is silently filtered to
     Farwaniya, last 12 months, reads the KPI tiles as the national
     figure. Persistence without disclosure is not a feature, it is a
     way of being wrong quietly.

     So a restore does three things: it says WHAT it changed, by name;
     it marks each restored field in the bar with a dot until the reader
     visits that control; and it offers one press that puts everything
     back to the defaults the page shipped with.

     HOW the values are applied: they are written into index.html's own
     `S` and then index.html's own renderAll() is called. That is the
     function the page already calls on every language switch, and it
     re-fills every select from S and redraws every canvas. Setting
     fifteen select values by hand and dispatching fifteen change events
     would be a second, worse implementation of a function that is
     already there, and it would miss the two chip rows entirely because
     a chip carries no value attribute to set.
     =================================================================== */

  var DEFAULTS = null;     /* the page's own values, snapshotted at boot */
  var restoredOnce = false;

  function snapshotDefaults() {
    if (DEFAULTS) return;
    var S = pageState();
    if (!S) return;
    DEFAULTS = {};
    PERSIST.forEach(function (rule) {
      DEFAULTS[rule.path] = getPath(S, rule.path);
    });
  }

  /* Write a set of path -> value into S and repaint the page with it.
     Returns the list of PERSIST rules that actually moved. */
  function applyToPage(values, validate) {
    var S = pageState();
    if (!S) return [];
    var moved = [];
    PERSIST.forEach(function (rule) {
      if (!(rule.path in values)) return;
      var want = values[rule.path];
      if (validate && !valid(rule, want)) return;
      if (rule.num) want = +want;
      var cur = getPath(S, rule.path);
      if (String(cur) === String(want)) return;
      setPath(S, rule.path, want);
      moved.push(rule);
    });
    if (!moved.length) return moved;

    /* renderAll() is a function DECLARATION in index.html, so unlike
       `const S` it really is on window. Guarded anyway: this layer must
       degrade to doing nothing rather than to throwing. */
    try {
      if (typeof window.renderAll === 'function') window.renderAll();
    } catch (e) {
      /* If the page's own repaint failed we have written state that
         nothing has drawn. Say so in the console rather than leaving a
         bar that confidently describes a view nobody is looking at. */
      try { console.warn('[ksat-session] renderAll() threw while restoring', e); } catch (e2) {}
    }
    return moved;
  }

  function restore() {
    if (restoredOnce) return;
    restoredOnce = true;

    var data = load();
    if (!data) { paint(); return; }

    if (data.fold) setFold(true);
    if (data.more) setMore(true);

    var moved = applyToPage(data.sel || {}, true);
    if (!moved.length) { paint(); return; }

    /* Name the fields as the bar names them, not as S names them, so
       the sentence matches what the reader can see. Several S paths map
       onto one field — ex.scene and ex.layer are both "Dataset" — so
       the list is de-duplicated. */
    var seen = {};
    var names = [];
    moved.forEach(function (rule) {
      var def = byKey(rule.field);
      if (!def || seen[rule.field]) return;
      seen[rule.field] = true;
      restoredKeys[rule.field] = true;
      names.push(t(def.label));
    });

    showNote(names);
    lastSig = '';
    paint();
  }

  function byKey(k) {
    var all = FIELDS.concat(MORE);
    for (var i = 0; i < all.length; i++) if (all[i].key === k) return all[i];
    return null;
  }

  function showNote(names) {
    if (!elNote || !elNoteTxt) return;
    elNoteTxt.innerHTML = '';
    var b = document.createElement('b');
    b.textContent = t('ss.restoredH');
    elNoteTxt.appendChild(b);
    elNoteTxt.appendChild(document.createTextNode(' '));
    elNoteTxt.appendChild(
      document.createTextNode(tx('ss.restoredP', listJoin(names)))
    );
    elNote.hidden = false;
    measure();
  }

  function dismissNote() {
    if (!elNote) return;
    elNote.hidden = true;
    restoredKeys = {};
    lastSig = '';
    paint();
  }

  /* "Start fresh" forgets the stored selections AND puts the controls
     back where the page had them. Forgetting alone would leave the
     reader looking at a restored view with no way to undo it except by
     changing ten controls by hand, which is not an offer of a clean
     slate, it is an offer to stop writing one down. */
  function startFresh() {
    forget();
    if (DEFAULTS) applyToPage(DEFAULTS, false);
    restoredKeys = {};
    if (elNote && elNoteTxt) {
      elNoteTxt.innerHTML = '';
      elNoteTxt.textContent = t('ss.cleared');
      /* The notice stays up for a moment carrying the confirmation,
         because a row that vanishes at the same instant as ten controls
         change is a page that just did something unexplained. */
      setTimeout(function () { dismissNote(); }, 4200);
    }
    lastSig = '';
    paint();
    /* save() is deliberately not called here. The page's own repaint
       will trip the watcher in section 8 a moment from now and call it
       anyway — and when it does, every value is back at its default,
       so the branch in save() removes the key rather than writing a
       new one. The clean slate stays clean. */
  }

  /* ===================================================================
     10 · TIER

     The bar belongs to the insider tier and to nothing else. A public
     visitor never gets it — not built and hidden, not built at all —
     because every control it reads lives in one of the ten sections
     js/ksat-shell.js locks, and a bar describing an analysis a visitor
     cannot run is an advertisement rather than a tool.

     The tier is taken from js/ksat-shell.js. It dispatches ksat:identity
     on every real change with { tier, previous, insider }, and it sets
     data-ksat-tier on <html> as the standing value. We subscribe to the
     event and read the attribute once at boot, because the shell
     resolves the session from Supabase and may well have settled before
     this file is parsed — a listener alone would then never fire.

     TO BE CLEAR ABOUT WHAT THIS IS: the attribute is product framing,
     not a security control, and js/ksat-shell.js says so at length. Flip
     it in DevTools and you get this bar over the shipped demo
     constants, because the real enforcement is row-level security in
     Postgres and `anon` holds no table grants. This layer inherits that
     position exactly and adds nothing to it — which is also why nothing
     it stores can be sensitive, and why section 3 is written the way it
     is.
     =================================================================== */

  function tier() {
    try { return root.getAttribute('data-ksat-tier') || 'public'; }
    catch (e) { return 'public'; }
  }

  function applyTier() {
    if (tier() === 'insider') {
      if (!bar) {
        if (!build()) return;
        watch();
      }
      bar.hidden = false;
      restore();
      paint();
    } else {
      destroy();
    }
  }

  /* ===================================================================
     11 · BOOT

     Two conditions, both real rather than time-based:
       · the page has rendered once — #kpiGrid has tiles, which only
         happens after init() -> renderAll() -> renderDashboard();
       · #dashArea has options, which is the same call and is what every
         validity check in section 3 reads.

     The defaults snapshot is taken at that moment and BEFORE anything
     stored is applied, which is what makes "Start fresh" able to offer
     the page as it shipped rather than as it was last left.

     The interval stops. It is a readiness check, not a state poll.
     =================================================================== */

  function ready() {
    var g = $('kpiGrid');
    var a = $('dashArea');
    return !!(g && g.children.length && a && a.options && a.options.length);
  }

  function start() {
    snapshotDefaults();
    applyTier();
    document.addEventListener('ksat:identity', function () { applyTier(); });

    KS.session = {
      /* Small surface, for a presenter with the console open and for
         whoever folds these strings into js/ksat-i18n.js. */
      strings: STR,
      key: KEY,
      persisted: PERSIST.map(function (r) { return r.path; }),
      refresh: function () { lastSig = ''; paint(); },
      clear: startFresh,
      state: function () {
        return { tier: tier(), built: !!bar, folded: folded,
                 more: moreOpen, storage: storageOK };
      }
    };
  }

  function boot() {
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (ready() || tries > 80) { clearInterval(iv); start(); }
    }, 120);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
