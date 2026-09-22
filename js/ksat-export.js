/* =====================================================================
   ksat-export.js — EXPORT, AND THE LABEL THAT TRAVELS WITH IT
   Owner: 11/12 Export & provenance · spec sections 11 and 12

   WHY THIS FILE EXISTS

   Before it, a grep of index.html for "export", "csv", "toBlob" or
   "text/csv" returned nothing. Two clipboard buttons existed, and that
   was the whole of it. A researcher who wanted the numbers behind a
   chart had to read them off the screen, which is the thing a research
   console is supposed to stop happening.

   THE REASON THIS NEEDED CARE RATHER THAN A DOWNLOAD BUTTON

   Every figure on this platform is invented. The governorate series are
   36 modelled monthly records per region; the scenes are drawn on a
   39 m grid by this page; the greening score is a weighting somebody
   chose. The page is honest about it — a provenance badge sits on every
   panel — but a badge is a property of the PAGE, and a CSV is a file
   that leaves the page. A CSV of bare numbers called "kuwait heat data"
   sitting in somebody's Downloads folder six months from now is a small
   act of misinformation, and it is the kind that spreads, because a
   spreadsheet looks like a measurement in a way a web page does not.

   So the rule this file is built around:

       A NUMBER MAY NOT LEAVE THIS PAGE WITHOUT ITS PROVENANCE LABEL
       ATTACHED TO THE SAME ROW AS THE NUMBER.

   Not in the filename, not only in a header block that a paste into
   another sheet would strip — in the row. That single rule decides most
   of the design below, including the two decisions that look odd:

     · LONG SHAPE, NOT WIDE. One observation per row, with its own
       provenance cell. A wide table would force one provenance column
       to cover a governorate's land area (reference dataset) and its
       greening score (model output) at once, and one of those two
       labels would then be a lie. Long shape costs readability and buys
       the property that the label cannot be separated from the number.

     · A CONTROLLED VOCABULARY, IN ENGLISH, IN THE DATA COLUMN.
       MEASURED · PUBLIC DATA · REFERENCE DATASET · MODELLED ·
       MODEL OUTPUT · ESTIMATED · NOT VERIFIED · PUBLISHED SOURCE.
       These are not translated per row, for the same reason a unit
       symbol is not translated: a file whose filter values change with
       the reader's language cannot be filtered. Both languages get the
       vocabulary defined for them in the bilingual header block instead.

   WHAT IS AND IS NOT OFFERED
   CSV and JSON wherever the surface genuinely holds tabular data. PNG
   wherever there is a real <canvas>. No PDF: there is no PDF writer on
   this page, no build step to add one, and an export format offered but
   not implemented is worse than one not offered.

   The Leaflet map in #map is deliberately NOT exportable. It is a div
   of cross-origin tile images, so its pixels cannot be read back
   without tainting, and the tiles are OpenStreetMap's work rather than
   this platform's to redistribute. The region table under it exports
   instead, which is where the numbers actually are.

   CITATION (spec 12)
   The citation is assembled from things that genuinely exist: the
   platform name in <title>, the live URL, the repository, the MIT
   licence, and the sixteen-entry SOURCES register in this page. There
   is no DOI, no dataset identifier and no author list in it, because
   this project has none that are citable, and a BibTeX entry with a
   plausible-looking author field is precisely how a fabricated citation
   gets into somebody else's bibliography. Absent fields are omitted and
   the omission is stated on screen.

   HOW IT REACHES THE PAGE'S DATA
   index.html declares REGIONS, SERIES, METRICS, SOURCES, PROV, CLAIMS,
   S and agg() as top-level `const`/`function` in CLASSIC <script>
   blocks. Classic scripts share one global lexical environment, so this
   file can read them by name — but they are NOT properties of window,
   so `window.SERIES` is undefined and `typeof SERIES` is the only safe
   test. Two consequences, both load-bearing:

     · This file must stay a CLASSIC script. Adding type="module" would
       put it in its own scope and every table would silently export
       empty. It would not throw; it would just be wrong.
     · It must load AFTER those blocks, i.e. last in <body>, next to
       js/ksat-tour.js, which depends on the same arrangement.

   No eval anywhere: vercel.json ships script-src 'self' 'unsafe-inline'
   with no 'unsafe-eval', so an indirect eval() lookup of those names
   would work on the local server and fail in production only.

   DOWNLOADS AND THE CSP
   Checked vercel.json before relying on this. The policy is
   default-src 'self' with no navigate-to directive, and it already
   names blob: explicitly in img-src, media-src and worker-src. An
   <a download href="blob:..."> is a download rather than a navigation,
   so no fetch directive applies to it; the same is true of the data:
   URL fallback used when toBlob is missing. Both work under this policy
   unchanged.
   ===================================================================== */

(function () {
  'use strict';

  var KS = window.KSAT = window.KSAT || {};
  if (KS.exporter) { return; }

  /* =================================================================
     0 · SMALL HELPERS
     ================================================================= */

  function h(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function reduced() {
    try { return matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (e) { return false; }
  }

  function isAR() {
    return (document.documentElement.getAttribute('lang') || 'en')
      .toLowerCase().indexOf('ar') === 0;
  }

  /* A pair {en, ar} resolved against the page's current language. The
     page's own L() does this, but it reads the page's `LANG` variable,
     which ksat-i18n.js sets on <html lang> as well — reading the
     attribute means this file is correct even if it loads before the
     i18n layer has finished its first pass. */
  function L(pair) {
    if (!pair) { return ''; }
    return (isAR() && pair.ar) ? pair.ar : (pair.en || '');
  }

  /* "{n} rows" + {n: 36} -> "36 rows". Deliberately dumb: no nesting,
     no escaping, because every template here is authored in this file. */
  function fill(str, vals) {
    return String(str).replace(/\{(\w+)\}/g, function (m, k) {
      return (vals && vals[k] != null) ? String(vals[k]) : m;
    });
  }

  /* Arabic uses its own comma. An ASCII comma inside RTL text sits on
     the wrong side of the word it follows once the bidi algorithm has
     run, which is how the first build of the filter line came out
     reading "المنطقة كل المحافظات, 12 شهراً" with the comma adrift. */
  function sep() { return isAR() ? '، ' : ', '; }

  function kv(label, value) { return label + ': ' + value; }

  function iso2(n) { return (n < 10 ? '0' : '') + n; }

  function isoDate(d) {
    return d.getUTCFullYear() + '-' + iso2(d.getUTCMonth() + 1) + '-' + iso2(d.getUTCDate());
  }

  function isoStamp(d) {
    return isoDate(d) + 'T' + iso2(d.getUTCHours()) + ':' + iso2(d.getUTCMinutes()) +
           ':' + iso2(d.getUTCSeconds()) + 'Z';
  }

  function localStamp(d) {
    try { return d.toString(); } catch (e) { return isoStamp(d); }
  }

  /* =================================================================
     1 · THE PAGE'S DATA, READ BY NAME

     Every one of these is a top-level `const` in one of index.html's
     classic <script> blocks. `typeof` is the only safe test: they are
     global LEXICAL bindings, so they exist as identifiers but not as
     properties of window, and a plain `window.SERIES` check would
     report them all missing.

     Each returns null when absent rather than throwing, and every
     caller checks. An export control whose data is unreachable is not
     rendered at all — an empty file is a worse outcome than a missing
     button, because the empty file still looks like an answer.
     ================================================================= */

  function gREGIONS() { return (typeof REGIONS !== 'undefined') ? REGIONS : null; }
  function gREG()     { return (typeof REG     !== 'undefined') ? REG     : null; }
  function gSERIES()  { return (typeof SERIES  !== 'undefined') ? SERIES  : null; }
  function gMETRICS() { return (typeof METRICS !== 'undefined') ? METRICS : null; }
  function gSOURCES() { return (typeof SOURCES !== 'undefined') ? SOURCES : null; }
  function gPROV()    { return (typeof PROV    !== 'undefined') ? PROV    : null; }
  function gCLAIMS()  { return (typeof CLAIMS  !== 'undefined') ? CLAIMS  : null; }
  function gEPOCHS()  { return (typeof EPOCHS  !== 'undefined') ? EPOCHS  : null; }
  function gSCENES()  { return (typeof SCENES  !== 'undefined') ? SCENES  : null; }
  function gState()   { return (typeof S       !== 'undefined') ? S       : null; }
  function gAgg()     { return (typeof agg === 'function') ? agg : null; }

  /* The page's own region namer already handles the Arabic name that
     every REGIONS entry carries. Fall back to the English field rather
     than to the id, which would put "farwaniya" in an export. */
  function regionName(r) {
    if (!r) { return ''; }
    if (typeof regName === 'function') {
      try { return regName(r); } catch (e) { /* fall through */ }
    }
    return (isAR() && r.na) ? r.na : r.n;
  }

  function metricLabel(key) {
    var M = gMETRICS();
    var m = M && M[key];
    if (!m) { return key; }
    return (isAR() && m.ar) ? m.ar : m.en;
  }

  /* SERIES entries carry {i, m, yr} with i running 0..35 from January
     2023 — index.html's MONTH_LABEL fixes that base year. An ISO
     YYYY-MM column is emitted alongside the human label because "Jan
     23" sorts alphabetically and an ISO month does not. */
  function periodISO(p) { return (2023 + p.yr) + '-' + iso2(p.m + 1); }

  function periodLabel(p) {
    var mo = (isAR() && typeof MONTHS_AR !== 'undefined') ? MONTHS_AR
           : (typeof MONTHS_EN !== 'undefined') ? MONTHS_EN : null;
    if (!mo) { return periodISO(p); }
    return mo[p.m] + ' ' + (2023 + p.yr);
  }

  /* =================================================================
     2 · THE PROVENANCE VOCABULARY

     The tokens are the platform's own classes, spelled the way the
     agent workflow already spells them (js/ksat-workflow.js uses
     MEASURED / ESTIMATED / MODELLED in its figure lines). The keys are
     index.html's CLASS_LABEL keys, so a row that knows its badge class
     knows its export token.

     PUBLISHED SOURCE is the one token with no badge behind it. The
     source register is a bibliography rather than a set of figures, and
     labelling a bibliography entry MEASURED would be a category error.
     ================================================================= */

  var CLASS = {
    real:  { token: 'MEASURED',
             en: 'Published, attributable record of KuwaitSat-1, carrying a source.',
             ar: 'سجل منشور ومنسوب عن كويت سات-١، يحمل مصدره.' },
    pub:   { token: 'PUBLIC DATA',
             en: 'Official open statistics, World Bank, WMO, Kuwaiti government publications.',
             ar: 'إحصاءات رسمية مفتوحة, البنك الدولي والمنظمة العالمية للأرصاد ومنشورات حكومية كويتية.' },
    demo:  { token: 'REFERENCE DATASET',
             en: 'Invented for this prototype, shaped on published Kuwaiti climate and land-cover patterns. Not a measurement.',
             ar: 'مُختلَقة لهذا النموذج الأولي، ومصمَّمة على أنماط مناخ وغطاء أرضي كويتية منشورة. وليست قياساً.' },
    sim:   { token: 'MODELLED',
             en: 'Produced by this page’s environmental model. Physically consistent, derived rather than measured.',
             ar: 'ناتجة عن النموذج البيئي في هذه الصفحة. متسقة فيزيائياً، مُشتقّة لا مُقاسة.' },
    ai:    { token: 'MODEL OUTPUT',
             en: 'An interpretation produced by the rule-based analyst in this page. Decision support, never a decision.',
             ar: 'تفسير يولّده المحلّل القائم على القواعد داخل هذه الصفحة. دعم للقرار، وليس قراراً.' },
    est:   { token: 'ESTIMATED',
             en: 'Scaled from a published coefficient. The coefficient is sourced; the result of the scaling is not.',
             ar: 'مقيسة من معامل منشور. المعامل مُوثَّق، أما ناتج القياس فلا.' },
    unver: { token: 'NOT VERIFIED',
             en: 'Not independently verified. Stated as such rather than filled in.',
             ar: 'غير موثَّقة باستقلالية. تُذكر كذلك بدل ملئها.' },
    src:   { token: 'PUBLISHED SOURCE',
             en: 'A published document or page, cited by URL. A reference, not a figure.',
             ar: 'وثيقة أو صفحة منشورة، مُستشهد بها برابطها. مرجع، وليس رقماً.' }
  };

  function tokenOf(cls) { return (CLASS[cls] || CLASS.demo).token; }

  /* =================================================================
     3 · PLATFORM IDENTITY — ONLY WHAT GENUINELY EXISTS

     Nothing here is invented. The name is <title> and og:site_name; the
     URL is the one in og:image and CITATION.cff; the repository and the
     licence are files in the repository. There is no version number
     because the project publishes none, no DOI because none was issued,
     no author list because three of the four names published in
     CITATION.cff are given names only and completing them would be
     guessing at people's families.
     ================================================================= */

  var PLATFORM = {
    nameEn: 'KuwaitSat Green Intelligence, KuwaitSat-1 Mission Hub',
    nameAr: 'كويت سات, الذكاء الأخضر · مركز مهمة كويت سات-١',
    url:    'https://kuwait-sat1-hub.vercel.app/',
    repo:   'https://github.com/t021600-dot/KuwaitSat1Hub',
    licence: 'MIT'
  };

  /* =================================================================
     4 · STRINGS

     Kept in this file rather than in js/ksat-i18n.js, which another
     owner holds. Arabic is authored in the same register as the rest of
     the platform: Modern Standard Arabic for a scientific institution,
     Latin kept for names of real objects (KuwaitSat-1, CSV, JSON, PNG,
     BibTeX, MIT), Western Arabic numerals, because that is what Kuwaiti
     instruments and publications use.
     ================================================================= */

  var TXT = {
    /* --- the export bar --- */
    'bar.lab':      { en: 'Export this view', ar: 'تصدير هذا العرض' },
    'bar.csv':      { en: 'CSV', ar: 'CSV' },
    'bar.json':     { en: 'JSON', ar: 'JSON' },
    'bar.png':      { en: 'PNG', ar: 'PNG' },
    'bar.csvTip':   { en: 'Comma-separated values. One observation per row, each row carrying its own provenance label.',
                      ar: 'قيم مفصولة بفواصل. رصدة واحدة في كل صف، ويحمل كل صف علامة مصدره.' },
    'bar.jsonTip':  { en: 'The same rows with a structured header: platform, prototype notice, filters, provenance vocabulary.',
                      ar: 'الصفوف نفسها مع ترويسة مُهيكلة: المنصة وتنبيه النموذج الأولي والمرشّحات ومفردات المصدر.' },
    'bar.pngTip':   { en: 'The chart as drawn, with a caption strip stating what it is.',
                      ar: 'الرسم كما هو مرسوم، مع شريط تعليق يوضّح ماهيته.' },
    'bar.pick':     { en: 'Chart to export', ar: 'الرسم المراد تصديره' },

    /* --- the "what is in the file" line under each bar ---
       The Arabic here deliberately puts the count AFTER a labelled
       noun ("عدد المؤشرات: 5") rather than before it ("5 مؤشرات").
       Arabic number-noun agreement changes shape three times across
       the range these counts take — 1 takes the singular, 3 to 10 the
       plural, 11 and above the singular accusative — and a template
       with the numeral in front has to be wrong for two of the three.
       The first build of this line printed "1 مؤشرات" on the charts
       section, which is the reading you get when a template written
       for English is filled with an Arabic string. Label-first is
       immune to the count, and reads as an instrument label, which is
       what this line is. */
    'w.series':     { en: '{rows} rows · {months} monthly records × {metrics} × {areas} · every row labelled {token}',
                      ar: 'عدد الصفوف: {rows} · آخر {months} شهراً · عدد المؤشرات: {metrics} · النطاق: {areas} · كل صف موسوم بـ {token}' },
    'w.regions':    { en: '{rows} rows · {areas} governorates × {fields} fields · labelled {token} except the greening score, which is {token2}',
                      ar: 'عدد الصفوف: {rows} · المحافظات: {areas} · الحقول لكل محافظة: {fields} · موسومة {token} عدا درجة التشجير فهي {token2}' },
    'w.change':     { en: '{rows} difference rows plus the written interpretation · both inputs are {token} scenes, not acquisitions',
                      ar: 'عدد الصفوف: {rows} · الفروق مع التفسير المكتوب · كلا المدخلين مشهد {token}، وليس التقاطاً فعلياً' },
    'w.changeNone': { en: 'Nothing to export yet, run change detection first.',
                      ar: 'لا شيء للتصدير بعد, شغّل كشف التغيّر أولاً.' },
    'w.prov':       { en: '{rows} register entries · every dataset and layer the platform uses, with its class and its sources',
                      ar: 'عدد مدخلات السجل: {rows} · كل مجموعة بيانات وطبقة تستخدمها المنصة، بصنفها ومصادرها' },
    'w.src':        { en: '{rows} references · name, URL and what each one supports',
                      ar: 'عدد المراجع: {rows} · الاسم والرابط وما يدعمه كل منها' },
    'w.claims':     { en: '{rows} sourced claims · every statement this page makes about KuwaitSat-1, with its source numbers',
                      ar: 'عدد الادعاءات الموثَّقة: {rows} · كل ما تقوله الصفحة عن كويت سات-١، بأرقام مصادره' },
    'w.filters':    { en: 'Filters in force: {filters}', ar: 'المرشّحات السارية: {filters}' },

    /* --- filter names --- */
    'f.area':       { en: 'Area', ar: 'المنطقة' },
    'f.all':        { en: 'All governorates', ar: 'كل المحافظات' },
    'f.period':     { en: 'Period', ar: 'الفترة' },
    'f.months':     { en: '{n} months', ar: '{n} شهراً' },
    'f.metric':     { en: 'Metric', ar: 'المؤشر' },
    'f.metricAll':  { en: 'All five metrics', ar: 'المؤشرات الخمسة' },
    'f.epochA':     { en: 'Image A', ar: 'الصورة أ' },
    'f.epochB':     { en: 'Image B', ar: 'الصورة ب' },
    'f.scene':      { en: 'Scene', ar: 'المشهد' },
    'f.none':       { en: 'None, the full register is exported', ar: 'لا شيء, يُصدَّر السجل كاملاً' },

    /* --- status --- */
    'st.done':      { en: 'Downloaded {file}', ar: 'تم تنزيل {file}' },
    'st.copied':    { en: 'Copied to the clipboard.', ar: 'نُسخ إلى الحافظة.' },
    'st.copyfail':  { en: 'The clipboard is not available here. The text is selected, copy it with Ctrl+C.',
                      ar: 'الحافظة غير متاحة هنا. النص محدَّد, انسخه بـ Ctrl+C.' },
    'st.nodata':    { en: 'That view has no data to export right now.',
                      ar: 'لا توجد بيانات قابلة للتصدير في هذا العرض الآن.' },
    'st.nocanvas':  { en: 'That chart has not been drawn yet. Scroll it into view and try again.',
                      ar: 'لم يُرسم هذا الرسم بعد. مرّر إليه ثم أعد المحاولة.' },

    /* --- the provenance and citation panel --- */
    'p.h':          { en: 'Data provenance, export and citation', ar: 'مصدر البيانات والتصدير والاستشهاد' },
    'p.lede':       { en: 'Everything the platform lets you take away, and the labels that go with it. Each export carries a bilingual header naming this platform, stating that its figures are a prototype’s invented and modelled data, listing the filters that were in force, and timestamping the file, and then repeats the provenance label on every single row, so that sorting, filtering or pasting the numbers into another sheet cannot strip it off.',
                      ar: 'كل ما تتيح المنصة أخذه، والعلامات المرافقة له. يحمل كل تصدير ترويسة ثنائية اللغة تسمّي المنصة، وتنص على أن أرقامها بيانات مُختلَقة ومُنمذَجة لنموذج أولي، وتُدرج المرشّحات السارية، وتؤرّخ الملف, ثم يُكرَّر وسم المصدر في كل صف، حتى لا يُسقطه الفرز أو التصفية أو النسخ إلى جدول آخر.' },
    'p.vocab':      { en: 'The vocabulary every export uses', ar: 'المفردات التي يستخدمها كل تصدير' },
    'p.vocabp':     { en: 'These eight tokens are written in English in the data column of every file, untranslated, for the same reason a unit symbol is not translated: a filter value that changes with the reader’s language cannot be filtered on. Both languages are defined here and in the header of every file.',
                      ar: 'تُكتب هذه المفردات الثماني بالإنجليزية في عمود البيانات في كل ملف دون ترجمة، للسبب نفسه الذي لا يُترجَم لأجله رمز الوحدة: قيمة تصفية تتغيّر بلغة القارئ لا يمكن التصفية عليها. واللغتان معرَّفتان هنا وفي ترويسة كل ملف.' },
    'p.reg':        { en: 'The registers, as files', ar: 'السجلات، كملفات' },
    'p.regp':       { en: 'The three registers this page keeps: what data it uses and of what class, what it claims about KuwaitSat-1, and the sixteen references those claims rest on.',
                      ar: 'السجلات الثلاثة التي تحفظها هذه الصفحة: ما البيانات التي تستخدمها وبأي صنف، وما تدّعيه عن كويت سات-١، والمراجع الستة عشر التي تستند إليها.' },
    'p.regProv':    { en: 'Data provenance register', ar: 'سجل مصدر البيانات' },
    'p.regClaims':  { en: 'Claims and their sources', ar: 'الادعاءات ومصادرها' },
    'p.regSrc':     { en: 'Source register', ar: 'سجل المصادر' },
    'p.cite':       { en: 'How to cite this platform', ar: 'كيف يُستشهد بهذه المنصة' },
    'p.citep':      { en: 'Assembled from the platform name, the live URL, the repository and the licence. Nothing else, because nothing else exists to cite.',
                      ar: 'مُجمَّع من اسم المنصة ورابطها الحيّ والمستودع والرخصة. لا شيء غير ذلك، لأنه لا يوجد غير ذلك للاستشهاد به.' },
    'p.plainEn':    { en: 'Plain text · English', ar: 'نص عادي · إنجليزي' },
    'p.plainAr':    { en: 'Plain text · Arabic', ar: 'نص عادي · عربي' },
    'p.bib':        { en: 'BibTeX', ar: 'BibTeX' },
    'p.copy':       { en: 'Copy', ar: 'نسخ' },
    'p.missing':    { en: 'What the citation deliberately leaves out', ar: 'ما يتركه الاستشهاد عمداً' },
    'p.missingp':   { en: 'No DOI: none was issued for this project. No dataset identifier: the figures are a prototype’s, and identifying them would imply a deposited dataset that does not exist. No author field: CITATION.cff in the repository names the four people who built it, but three of the four are published as given names only, and completing them here would be guessing at people’s families. Each of these is omitted rather than filled with a plausible-looking value, which is how a fabricated citation gets into somebody else’s bibliography.',
                      ar: 'لا رقم DOI: لم يُصدر أي رقم لهذا المشروع. ولا معرّف مجموعة بيانات: الأرقام تخص نموذجاً أولياً، ومنحها معرّفاً يوحي بإيداع مجموعة بيانات غير موجودة. ولا حقل مؤلفين: يسمّي ملف CITATION.cff في المستودع الأشخاص الأربعة الذين بنوها، لكن ثلاثة منهم منشورون بأسمائهم الأولى فقط، وإكمالها هنا تخمين في أنساب الناس. تُحذف كل واحدة من هذه بدل ملئها بقيمة تبدو معقولة، فتلك هي الطريقة التي يتسلل بها استشهاد مُختلَق إلى مراجع شخص آخر.' },
    'p.primary':    { en: 'KuwaitSat-1 primary sources', ar: 'المصادر الأولية لكويت سات-١' },
    'p.primaryp':   { en: 'If you are citing the spacecraft rather than this platform, cite these instead. They are the published record; this page is a reading of it.',
                      ar: 'إن كنت تستشهد بالمركبة لا بهذه المنصة، فاستشهد بهذه. هي السجل المنشور، وهذه الصفحة قراءة له.' },
    'p.copyAll':    { en: 'Copy all sixteen references', ar: 'نسخ المراجع الستة عشر' },

    /* --- header block, written into every file in both languages --- */
    'x.notice':     { en: 'PROTOTYPE EXPORT, NOT MEASURED DATA',
                      ar: 'تصدير من نموذج أولي, ليست بيانات مُقاسة' },
    'x.body':       { en: 'This file comes from a student capstone prototype. The environmental figures in it are invented or modelled for demonstration. They are not measurements, and KuwaitSat-1 did not produce them: the spacecraft carries an RGB camera at 39 m ground sample distance, with no thermal sensor and no near-infrared band.',
                      ar: 'هذا الملف صادر عن نموذج أولي لمشروع تخرج طلابي. الأرقام البيئية فيه مُختلَقة أو مُنمذَجة لأغراض العرض. وهي ليست قياسات، ولم ينتجها كويت سات-١: تحمل المركبة كاميرا RGB بدقة عيّنة أرضية 39 متراً، دون مستشعر حراري ودون نطاق قريب من تحت الحمراء.' },
    'x.rowlabel':   { en: 'Every data row below carries its own provenance label, so that sorting, filtering or pasting these numbers into another file cannot separate the label from the number it describes.',
                      ar: 'يحمل كل صف بيانات أدناه وسم مصدره، حتى لا يفصل الفرز أو التصفية أو النسخ إلى ملف آخر الوسمَ عن الرقم الذي يصفه.' },
    'x.shape':      { en: 'Shape: long, one observation per row.',
                      ar: 'الشكل: طولي, رصدة واحدة في كل صف.' },
    'x.noauth':     { en: 'Authority: none. Nothing in this file has been reviewed by any competent authority, and none of it may be used for planning.',
                      ar: 'الصفة الرسمية: لا شيء. لم تُراجع أي من محتويات هذا الملف من أي جهة مختصة، ولا يجوز استخدام أي منها في التخطيط.' },
    'x.platform':   { en: 'Platform', ar: 'المنصة' },
    'x.view':       { en: 'View exported', ar: 'العرض المُصدَّر' },
    'x.filters':    { en: 'Filters in force', ar: 'المرشّحات السارية' },
    'x.generated':  { en: 'Generated', ar: 'تاريخ التوليد' },
    'x.repo':       { en: 'Repository', ar: 'المستودع' },
    'x.licence':    { en: 'Licence', ar: 'الرخصة' },
    'x.vocab':      { en: 'Provenance vocabulary used in this file', ar: 'مفردات المصدر المستخدمة في هذا الملف' },
    'x.cite':       { en: 'Cite as', ar: 'الاستشهاد' },
    'x.from':       { en: 'Exported from', ar: 'مُصدَّر من' },

    /* --- column headings --- */
    'c.periodISO':  { en: 'period_iso', ar: 'period_iso' },
    'c.period':     { en: 'Period', ar: 'الفترة' },
    'c.gov':        { en: 'Governorate', ar: 'المحافظة' },
    'c.metricKey':  { en: 'metric_key', ar: 'metric_key' },
    'c.metric':     { en: 'Metric', ar: 'المؤشر' },
    'c.value':      { en: 'Value', ar: 'القيمة' },
    'c.unit':       { en: 'Unit', ar: 'الوحدة' },
    'c.prov':       { en: 'provenance', ar: 'provenance' },
    'c.fieldKey':   { en: 'field_key', ar: 'field_key' },
    'c.field':      { en: 'Field', ar: 'الحقل' },
    'c.measure':    { en: 'Measure', ar: 'المقياس' },
    'c.change':     { en: 'Change', ar: 'التغيّر' },
    'c.dataset':    { en: 'Dataset or layer', ar: 'مجموعة البيانات أو الطبقة' },
    'c.class':      { en: 'class_token', ar: 'class_token' },
    'c.classEn':    { en: 'class_en', ar: 'class_en' },
    'c.classAr':    { en: 'class_ar', ar: 'class_ar' },
    'c.usedby':     { en: 'Used by', ar: 'تستخدمها' },
    'c.srcnums':    { en: 'source_numbers', ar: 'source_numbers' },
    'c.srcurls':    { en: 'source_urls', ar: 'source_urls' },
    'c.n':          { en: 'n', ar: 'n' },
    'c.name':       { en: 'Reference', ar: 'المرجع' },
    'c.url':        { en: 'URL', ar: 'URL' },
    'c.note':       { en: 'What it supports', ar: 'ما يدعمه' },
    'c.claim':      { en: 'Claim made on this page', ar: 'الادعاء الوارد في الصفحة' },

    /* --- field names for the region export --- */
    'r.area':       { en: 'Land area', ar: 'مساحة اليابسة' },
    'r.green':      { en: 'Green cover', ar: 'الغطاء الأخضر' },
    'r.ndvi':       { en: 'Vegetation index (NDVI-like)', ar: 'مؤشر الغطاء النباتي' },
    'r.stress':     { en: 'Environmental stress', ar: 'الإجهاد البيئي' },
    'r.lst':        { en: 'Summer surface temperature', ar: 'حرارة السطح صيفاً' },
    'r.dust':       { en: 'Dust indicator', ar: 'مؤشر الغبار' },
    'r.urban':      { en: 'Built-up share', ar: 'نسبة العمران' },
    'r.score':      { en: 'Greening potential score', ar: 'درجة إمكانية التشجير' },

    /* --- PNG caption strip --- */
    'g.cap':        { en: 'PROTOTYPE · {token} · figures are invented or modelled, not measured',
                      ar: 'نموذج أولي · {token} · الأرقام مُختلَقة أو مُنمذَجة، وليست مُقاسة' },

    /* --- interpretation row label for the change export --- */
    'k.interp':     { en: 'Interpretation', ar: 'التفسير' }
  };

  function t(key, vals) {
    var s = L(TXT[key] || { en: key });
    return vals ? fill(s, vals) : s;
  }

  /* The long note on w.series explains why the Arabic template puts the
     count after a labelled noun. English has the mirror-image problem
     and did not originally get the same care: {metrics} is filled with 5
     on the dashboard bar and with 1 on the charts bar, which always
     exports exactly one metric, so the charts bar shipped reading
     "36 monthly records × 1 metrics × All governorates".

     Arabic is immune because "عدد المؤشرات: 1" is label-first and the
     numeral never has to agree with anything. English is not, so the
     noun is inflected here and the template carries only the slot.

     This is deliberately not a general pluraliser. Every other count in
     this file is structurally two or more — six governorates, eight
     fields, fourteen register entries, sixteen references, twelve or
     thirty-six months — and a helper that pretended to solve
     pluralisation in general would be a promise this file does not
     keep. One noun inflects; that noun is handled. */
  function metricsPhrase(n) {
    if (isAR()) { return String(n); }
    return n + (Number(n) === 1 ? ' metric' : ' metrics');
  }

  /* =================================================================
     5 · THE CITATION

     Assembled, never stored, so that the accessed date is the date the
     reader actually copied it.
     ================================================================= */

  function citationPlain(ar) {
    var today = isoDate(new Date());
    if (ar) {
      return PLATFORM.nameAr + ' [برمجية]. نموذج أولي لمشروع تخرج طلابي. ' +
        'متاح على ' + PLATFORM.url + ' (تاريخ الاطلاع ' + today + '). ' +
        'الشيفرة المصدرية: ' + PLATFORM.repo + '. رخصة ' + PLATFORM.licence + '. ' +
        'لم يُصدر لهذه المنصة رقم DOI ولا معرّف مجموعة بيانات. ' +
        'لا تحتوي المنصة على أي بيانات حقيقية من كويت سات-١؛ وكل رقم بيئي فيها مُختلَق أو مُنمذَج لأغراض العرض.';
    }
    return PLATFORM.nameEn + ' [software]. Student capstone prototype. ' +
      'Available at ' + PLATFORM.url + ' (accessed ' + today + '). ' +
      'Source code: ' + PLATFORM.repo + '. ' + PLATFORM.licence + ' licence. ' +
      'No DOI or dataset identifier is issued for this platform. ' +
      'It holds no real KuwaitSat-1 data: every environmental figure in it is invented or modelled for demonstration.';
  }

  /* A @misc entry with no author, no year and no doi key. Those three
     fields are the ones a reader would most want, and they are exactly
     the three this project cannot supply honestly, so the note field
     says so rather than leaving a reader to assume the entry was
     truncated. */
  function citationBibtex() {
    return '@misc{kuwaitsat_green_intelligence,\n' +
      '  title        = {KuwaitSat Green Intelligence --- KuwaitSat-1 Mission Hub},\n' +
      '  howpublished = {\\url{' + PLATFORM.url + '}},\n' +
      '  urldate      = {' + isoDate(new Date()) + '},\n' +
      '  note         = {Student capstone prototype. Source code at ' + PLATFORM.repo + ', ' +
      PLATFORM.licence + ' licence. No author, year or DOI field is given: none is published for this\n' +
      '                  project, and this entry omits them rather than supplying plausible values. The platform holds no real\n' +
      '                  KuwaitSat-1 data; every environmental figure in it is invented or modelled for demonstration.}\n' +
      '}';
  }

  function sourcesPlain() {
    var SRC = gSOURCES();
    if (!SRC) { return ''; }
    var lines = [PLATFORM.nameEn + ', source register (' + SRC.length + ' entries), ' +
                 t('x.from') + ' ' + PLATFORM.url];
    lines.push('');
    SRC.forEach(function (s, i) {
      lines.push('[' + (i + 1) + '] ' + s.name);
      lines.push('    ' + s.url);
      if (s.note) { lines.push('    ' + s.note); }
    });
    return lines.join('\n');
  }

  /* =================================================================
     6 · FILE WRITERS

     CSV first, because it is the format that goes wrong quietly.
     ================================================================= */

  /* Excel reads a UTF-8 CSV as the system codepage unless the file
     opens with a byte-order mark. Without this one character, every
     Arabic governorate name in a downloaded file renders as mojibake on
     a Windows machine, which on a bilingual platform makes the Arabic
     export worthless. */
  var BOM = '﻿';

  function csvCell(v) {
    var s = (v === null || v === undefined) ? '' : String(v);

    /* CSV injection: a cell beginning = + - @ or a control character is
       executed as a formula by Excel and Sheets when the file is
       opened. The usual fix is to prefix an apostrophe, but applied
       blindly it corrupts every negative number in this file, and the
       change-detection export is mostly negative numbers. So the guard
       only fires on cells that are not valid numbers. */
    if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(s)) {
      s = '\'' + s;
    }

    if (/[",\r\n]/.test(s) || /^\s/.test(s) || /\s$/.test(s)) {
      s = '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  /* The bilingual header block. Written into BOTH languages every time,
     regardless of the reader's current language, because the file
     outlives the session that produced it and will be opened by someone
     who never saw the page. The warning has to survive that. */
  function headerLines(meta) {
    var now = new Date();
    var out = [];
    var bar = '============================================================';

    /* Both languages, always, in that order. Not L() — this block is
       written into a file that will outlive the session and be opened
       by someone who never saw the page, so the warning and the
       labelling have to be readable whichever language they read. */
    function pair(key, valEn, valAr) {
      out.push(TXT[key].en + ': ' + valEn);
      out.push(TXT[key].ar + ': ' + (valAr == null ? valEn : valAr));
    }

    out.push(bar);
    out.push(PLATFORM.nameEn);
    out.push(PLATFORM.nameAr);
    out.push(bar);
    out.push(TXT['x.notice'].en);
    out.push(TXT['x.notice'].ar);
    out.push('');
    out.push(TXT['x.body'].en);
    out.push(TXT['x.body'].ar);
    out.push('');
    out.push(TXT['x.rowlabel'].en);
    out.push(TXT['x.rowlabel'].ar);
    out.push('');
    if (meta.longShape) {
      out.push(TXT['x.shape'].en);
      out.push(TXT['x.shape'].ar);
      out.push('');
    }
    out.push('------------------------------------------------------------');
    pair('x.view', meta.titleEn, meta.titleAr);
    pair('x.filters', meta.filtersEn || TXT['f.none'].en, meta.filtersAr || TXT['f.none'].ar);
    out.push(TXT['x.platform'].en + ' / ' + TXT['x.platform'].ar + ': ' + PLATFORM.url);
    out.push(TXT['x.from'].en + ' / ' + TXT['x.from'].ar + ': ' + location.href);
    out.push(TXT['x.repo'].en + ' / ' + TXT['x.repo'].ar + ': ' + PLATFORM.repo);
    out.push(TXT['x.licence'].en + ' / ' + TXT['x.licence'].ar + ': ' + PLATFORM.licence);
    out.push(TXT['x.generated'].en + ' / ' + TXT['x.generated'].ar + ': ' +
             isoStamp(now) + '  (' + localStamp(now) + ')');
    out.push('------------------------------------------------------------');
    out.push(TXT['x.vocab'].en);
    out.push(TXT['x.vocab'].ar);
    (meta.classes || []).forEach(function (key) {
      var c = CLASS[key];
      if (!c) { return; }
      out.push('  ' + c.token);
      out.push('      EN  ' + c.en);
      out.push('      AR  ' + c.ar);
    });
    out.push('------------------------------------------------------------');
    out.push(TXT['x.cite'].en + ': ' + citationPlain(false));
    out.push(TXT['x.cite'].ar + ': ' + citationPlain(true));
    out.push('');
    out.push(TXT['x.noauth'].en);
    out.push(TXT['x.noauth'].ar);
    out.push(bar);
    return out;
  }

  function toCSV(meta, columns, rows) {
    var lines = [];
    headerLines(meta).forEach(function (l) { lines.push(l ? '# ' + l : '#'); });
    lines.push('');
    lines.push(columns.map(csvCell).join(','));
    rows.forEach(function (r) { lines.push(r.map(csvCell).join(',')); });
    /* CRLF, per RFC 4180. Excel and a surprising number of importers
       still treat a bare LF file as one enormous single row. */
    return BOM + lines.join('\r\n') + '\r\n';
  }

  function toJSON(meta, columns, rows, keys, extra) {
    var now = new Date();
    var vocab = {};
    (meta.classes || []).forEach(function (key) {
      var c = CLASS[key];
      if (c) { vocab[c.token] = { en: c.en, ar: c.ar }; }
    });

    var doc = {
      platform: {
        name_en: PLATFORM.nameEn,
        name_ar: PLATFORM.nameAr,
        url: PLATFORM.url,
        repository: PLATFORM.repo,
        licence: PLATFORM.licence
      },
      prototype_notice: {
        headline_en: TXT['x.notice'].en,
        headline_ar: TXT['x.notice'].ar,
        en: TXT['x.body'].en,
        ar: TXT['x.body'].ar,
        row_labels_en: TXT['x.rowlabel'].en,
        row_labels_ar: TXT['x.rowlabel'].ar,
        authority_en: TXT['x.noauth'].en,
        authority_ar: TXT['x.noauth'].ar
      },
      'export': {
        view_en: meta.titleEn,
        view_ar: meta.titleAr,
        filters_en: meta.filtersEn || TXT['f.none'].en,
        filters_ar: meta.filtersAr || TXT['f.none'].ar,
        exported_from: location.href,
        generated_utc: isoStamp(now),
        generated_local: localStamp(now),
        shape: meta.longShape ? 'long, one observation per row' : 'one entity per row',
        row_count: rows.length
      },
      provenance_vocabulary: vocab,
      citation: {
        en: citationPlain(false),
        ar: citationPlain(true),
        bibtex: citationBibtex(),
        doi: null,
        dataset_id: null,
        authors: null,
        omitted_note_en: TXT['p.missingp'].en,
        omitted_note_ar: TXT['p.missingp'].ar
      },
      columns: columns,
      rows: rows.map(function (r) {
        var o = {};
        keys.forEach(function (k, i) { o[k] = r[i]; });
        return o;
      })
    };

    if (extra) {
      Object.keys(extra).forEach(function (k) { doc[k] = extra[k]; });
    }
    return JSON.stringify(doc, null, 2);
  }

  /* =================================================================
     7 · THE DOWNLOAD

     Same-origin static page, so a Blob and a temporary anchor is the
     whole mechanism. See the CSP note in the file header: nothing in
     vercel.json blocks this.
     ================================================================= */

  function saveBlob(filename, blob) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    /* Off-screen rather than display:none. A few builds of Safari have
       refused to activate a link with no layout box. */
    a.style.position = 'fixed';
    a.style.left = '-9999px';
    a.style.top = '0';
    document.body.appendChild(a);
    a.click();
    /* Revoking in the same tick cancels the download in Firefox before
       it has read the blob. Four seconds is long enough for a file of
       this size and short enough not to matter. */
    setTimeout(function () {
      try { URL.revokeObjectURL(url); } catch (e) {}
      if (a.parentNode) { a.parentNode.removeChild(a); }
    }, 4000);
  }

  function saveText(filename, mime, text) {
    saveBlob(filename, new Blob([text], { type: mime + ';charset=utf-8' }));
    announce(t('st.done', { file: filename }));
  }

  /* Filenames stay ASCII. A UTF-8 filename has to be encoded into
     Content-Disposition to survive, there is no Content-Disposition on
     a blob download, and an Arabic filename arriving as %D8%A7... in a
     Downloads folder helps nobody. The Arabic is inside the file, in
     the header block and in the column headings. */
  function fileName(stem, parts, ext) {
    var bits = [stem];
    (parts || []).forEach(function (p) {
      if (p == null || p === '') { return; }
      bits.push(String(p).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
    });
    bits.push(isoDate(new Date()));
    return bits.join('-').replace(/-+/g, '-') + '.' + ext;
  }

  /* =================================================================
     8 · PNG, WITH A CAPTION STRIP

     A chart image travels further than a CSV and carries even less
     context, so the same rule applies to it: the file says what it is.
     The strip is drawn into the exported bitmap rather than offered as
     a separate caption, because a separate caption is the part that
     gets dropped.
     ================================================================= */

  function cssVar(name, fallback) {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v || fallback;
    } catch (e) { return fallback; }
  }

  function stamped(src, caption) {
    /* The page fits every canvas to devicePixelRatio, so canvas.width is
       in device pixels and clientWidth is in CSS pixels. The ratio is
       what keeps the caption text the same visual size as the chart's
       own labels instead of a quarter of it on a retina screen. */
    var dpr = (src.clientWidth > 0) ? (src.width / src.clientWidth) : 1;
    if (!isFinite(dpr) || dpr <= 0) { dpr = 1; }

    var pad = 14 * dpr;
    var lineH = 17 * dpr;
    var lines = caption.lines;
    var footH = pad * 2 + lineH * lines.length;

    var out = document.createElement('canvas');
    out.width = src.width;
    out.height = src.height + footH;
    var ctx = out.getContext('2d');

    /* The chart canvases are transparent: the ground behind them is a
       CSS background on .chartbox, not a fill. Exported as-is, a chart
       pasted into a white document is invisible dark ink on white. Fill
       first, then draw. */
    ctx.fillStyle = cssVar('--void', '#05070B');
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(src, 0, 0);

    ctx.strokeStyle = cssVar('--line-2', '#232C3C');
    ctx.lineWidth = Math.max(1, dpr);
    ctx.beginPath();
    ctx.moveTo(0, src.height + 0.5 * dpr);
    ctx.lineTo(out.width, src.height + 0.5 * dpr);
    ctx.stroke();

    var y = src.height + pad + lineH * 0.75;
    var body = '"IBM Plex Sans", "IBM Plex Sans Arabic", system-ui, sans-serif';

    lines.forEach(function (ln) {
      ctx.font = (ln.weight || 400) + ' ' + Math.round((ln.size || 12) * dpr) + 'px ' + body;
      ctx.fillStyle = ln.dim ? cssVar('--ink-3', '#6B7A8D') : cssVar('--ink', '#E8ECF2');
      if (ln.rtl) {
        /* Canvas shapes Arabic correctly in fillText, but it will not
           right-align it for you, and a right-to-left caption flush to
           the left margin reads as broken to an Arabic reader. */
        ctx.textAlign = 'right';
        try { ctx.direction = 'rtl'; } catch (e) {}
        ctx.fillText(ln.text, out.width - pad, y);
        ctx.textAlign = 'left';
        try { ctx.direction = 'ltr'; } catch (e) {}
      } else {
        ctx.textAlign = 'left';
        ctx.fillText(ln.text, pad, y);
      }
      y += lineH;
    });

    return out;
  }

  function savePNG(src, filename, caption) {
    var out;
    try { out = stamped(src, caption); }
    catch (e) { announce(t('st.nocanvas')); return; }

    if (out.toBlob) {
      out.toBlob(function (blob) {
        if (!blob) { announce(t('st.nocanvas')); return; }
        saveBlob(filename, blob);
        announce(t('st.done', { file: filename }));
      }, 'image/png');
    } else {
      /* Older Safari has no toBlob. A data: URL on a download anchor is
         a download rather than a navigation, so the CSP does not reach
         it either. */
      var a = document.createElement('a');
      a.href = out.toDataURL('image/png');
      a.download = filename;
      a.style.position = 'fixed';
      a.style.left = '-9999px';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { if (a.parentNode) { a.parentNode.removeChild(a); } }, 4000);
      announce(t('st.done', { file: filename }));
    }
  }

  /* HAS THIS CANVAS ACTUALLY BEEN DRAWN?

     An undrawn canvas on this page is not 0 x 0. The chart helpers take
     their height from CSS and their width from clientWidth, and
     clientWidth is 0 for as long as the section is display:none — which
     every gated section is at the public tier, and which the locked
     sections stay until a reader signs in. The result is a canvas of
     1 x 270 sitting in the DOM looking perfectly real.

     The first guard here was `!cv.width || !cv.height`. One is truthy,
     so a PNG click on a section the reader had never opened ran the
     whole way through and announced "Downloaded ksat-dashboard-chveg
     .png" for a one-pixel-wide strip of background. A file that looks
     like a result and is not is the exact thing this layer exists to
     stop, so the guard now asks the question it meant to ask: does this
     canvas have a layout box, and is its bitmap big enough to be a
     chart rather than an artefact of never having been laid out. */
  function drawn(cv) {
    return !!cv && cv.clientWidth > 0 && cv.width > 32 && cv.height > 32;
  }

  function captionFor(title, token, filtersLine) {
    return {
      lines: [
        { text: title, size: 13, weight: 600 },
        { text: t('g.cap', { token: token }), size: 11.5 },
        { text: TXT['g.cap'].ar.replace('{token}', token), size: 11.5, rtl: true },
        { text: PLATFORM.url + '  ·  ' + filtersLine + '  ·  ' + isoStamp(new Date()),
          size: 10.5, dim: true }
      ]
    };
  }

  /* =================================================================
     9 · CLIPBOARD

     navigator.clipboard is unavailable on a plain-http origin, which is
     exactly the local server this gets developed against, so the
     fallback is not theoretical.
     ================================================================= */

  function copyText(text, sourceEl) {
    function fallback() {
      if (sourceEl) {
        try {
          var range = document.createRange();
          range.selectNodeContents(sourceEl);
          var sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        } catch (e) {}
      }
      announce(t('st.copyfail'));
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        announce(t('st.copied'));
      })['catch'](fallback);
    } else {
      fallback();
    }
  }

  /* =================================================================
     10 · STATUS

     One polite live region for the whole layer. The page's own toast()
     is used too when it is reachable, because a visible confirmation
     and an announced one serve different readers.
     ================================================================= */

  var liveEl = null;

  function announce(msg) {
    if (!liveEl) {
      liveEl = document.createElement('div');
      liveEl.className = 'ksx-status';
      liveEl.setAttribute('role', 'status');
      liveEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(liveEl);
    }
    liveEl.textContent = msg;
    if (typeof toast === 'function') { try { toast(msg); } catch (e) {} }
  }

  /* =================================================================
     11 · ROW BUILDERS

     Each returns null when its data is unreachable, and the bar that
     would have used it is not rendered.
     ================================================================= */

  var METRIC_ORDER = ['ndvi', 'green', 'lst', 'stress', 'dust'];

  function selectedIds(area) {
    var R = gREGIONS();
    if (!R) { return []; }
    if (!area || area === 'all') { return R.map(function (r) { return r.id; }); }
    return [area];
  }

  /* The governorate series: PROV classifies it "Governorate
     environmental series (36 monthly records x 6)", class demo, which
     is REFERENCE DATASET. Every row gets that token; there is no row in
     this table that deserves a different one. */
  function seriesRows(ids, months, metricKeys) {
    var SER = gSERIES(), RG = gREG(), M = gMETRICS();
    if (!SER || !RG || !M) { return null; }
    var rows = [];
    ids.forEach(function (id) {
      var slice = (SER[id] || []).slice(-months);
      slice.forEach(function (p) {
        metricKeys.forEach(function (k) {
          var m = M[k];
          rows.push([
            periodISO(p),
            periodLabel(p),
            regionName(RG[id]),
            k,
            metricLabel(k),
            p[k],
            m && m.unit ? m.unit : '',
            CLASS.demo.token
          ]);
        });
      });
    });
    return rows;
  }

  function seriesColumns() {
    return [t('c.periodISO'), t('c.period'), t('c.gov'), t('c.metricKey'),
            t('c.metric'), t('c.value'), t('c.unit'), t('c.prov')];
  }

  var SERIES_KEYS = ['period_iso', 'period_label', 'governorate', 'metric_key',
                     'metric_name', 'value', 'unit', 'provenance'];

  /* The region scorecard, long shape. The reason for long shape is
     visible right here: land area, cover and stress are REFERENCE
     DATASET, but the greening score is a weighting this platform chose
     and is MODEL OUTPUT. A wide table would have to pick one label for
     the row and would be wrong about the other. */
  var REGION_FIELDS = [
    { key: 'land_area_km2',            txt: 'r.area',   get: function (r) { return r.area; },  unit: 'km2', cls: 'demo' },
    { key: 'green_cover_pct',          txt: 'r.green',  get: function (r) { return r.green; }, unit: '%',   cls: 'demo' },
    { key: 'veg_index',                txt: 'r.ndvi',   get: function (r) { return r.ndvi; },  unit: '',    cls: 'demo' },
    { key: 'env_stress',               txt: 'r.stress', get: function (r) { return r.stress; },unit: '/100',cls: 'demo' },
    { key: 'summer_surface_temp_c',    txt: 'r.lst',    get: function (r) { return r.lst; },   unit: 'degC',cls: 'demo' },
    { key: 'dust_indicator',           txt: 'r.dust',   get: function (r) { return r.dust; },  unit: '/100',cls: 'demo' },
    { key: 'built_up_share_pct',       txt: 'r.urban',  get: function (r) { return r.urban; }, unit: '%',   cls: 'demo' },
    { key: 'greening_potential_score', txt: 'r.score',  get: function (r) { return r.score; }, unit: '/100',cls: 'ai'   }
  ];

  function regionRows() {
    var R = gREGIONS();
    if (!R) { return null; }
    var rows = [];
    R.forEach(function (r) {
      REGION_FIELDS.forEach(function (f) {
        rows.push([regionName(r), f.key, t(f.txt), f.get(r), f.unit, tokenOf(f.cls)]);
      });
    });
    return rows;
  }

  function regionColumns() {
    return [t('c.gov'), t('c.fieldKey'), t('c.field'), t('c.value'), t('c.unit'), t('c.prov')];
  }

  var REGION_KEYS = ['governorate', 'field_key', 'field_name', 'value', 'unit', 'provenance'];

  /* The change readout is read back out of the rendered DOM rather than
     recomputed. Two reasons: runCompare() holds its differences in a
     local, so there is nothing to read; and an export that recomputed
     could silently disagree with the panel the reader is looking at,
     which on a change-detection tool is the worst possible failure. */
  function changeRows() {
    var host = document.getElementById('cmpResult');
    if (!host) { return null; }
    var dts = host.querySelectorAll('dl.detail dt');
    var dds = host.querySelectorAll('dl.detail dd');
    if (!dts.length || dts.length !== dds.length) { return null; }
    var rows = [];
    for (var i = 0; i < dts.length; i++) {
      rows.push([
        (dts[i].textContent || '').trim(),
        (dds[i].textContent || '').trim(),
        CLASS.ai.token
      ]);
    }
    var p = host.querySelector('p');
    if (p) {
      rows.push([t('k.interp'), (p.textContent || '').trim(), CLASS.ai.token]);
    }
    return rows;
  }

  function provRows() {
    var P = gPROV(), SRC = gSOURCES();
    if (!P) { return null; }
    return P.map(function (r) {
      var nums = (r.s || []).map(function (i) { return '[' + (i + 1) + ']'; }).join(' ');
      var urls = (r.s || []).map(function (i) {
        return (SRC && SRC[i]) ? SRC[i].url : '';
      }).filter(Boolean).join(' ');
      var c = CLASS[r.c] || CLASS.demo;
      return [L(r.d), c.token, c.en, c.ar, L(r.u), nums, urls];
    });
  }

  function sourceRows() {
    var SRC = gSOURCES();
    if (!SRC) { return null; }
    return SRC.map(function (s, i) {
      return [i + 1, s.name, s.url, s.note || '', CLASS.src.token];
    });
  }

  function claimRows() {
    var C = gCLAIMS(), SRC = gSOURCES();
    if (!C) { return null; }
    return C.map(function (c) {
      var nums = (c.s || []).map(function (i) { return '[' + (i + 1) + ']'; }).join(' ');
      var urls = (c.s || []).map(function (i) {
        return (SRC && SRC[i]) ? SRC[i].url : '';
      }).filter(Boolean).join(' ');
      return [L(c.c), nums, urls, CLASS.real.token];
    });
  }

  /* =================================================================
     12 · THE FIVE EXPORT TARGETS

     Each describes itself: what it holds, what its filters currently
     are, what a file of it would contain. The describe() output is what
     the bar prints under the buttons, which is spec 11's "the UI should
     make clear what is being exported" and is also the honest way to
     tell a reader that a filter they set will follow the file.
     ================================================================= */

  function sectionTitle(id) {
    var sec = document.getElementById(id);
    var h2 = sec && sec.querySelector('h2.st');
    return h2 ? (h2.textContent || '').trim() : id;
  }

  function areaLabel(area) {
    var RG = gREG();
    if (!area || area === 'all') { return t('f.all'); }
    return RG && RG[area] ? regionName(RG[area]) : area;
  }

  function areaLabelIn(area, ar) {
    var RG = gREG();
    if (!area || area === 'all') { return ar ? TXT['f.all'].ar : TXT['f.all'].en; }
    var r = RG && RG[area];
    if (!r) { return area; }
    return ar ? (r.na || r.n) : r.n;
  }

  function epochLabel(id, ar) {
    var E = gEPOCHS();
    if (!E) { return id; }
    for (var i = 0; i < E.length; i++) {
      if (E[i].id === id) { return ar ? (E[i].ar || E[i].en) : E[i].en; }
    }
    return id;
  }

  function sceneLabel(id, ar) {
    var SC = gSCENES();
    if (!SC) { return id; }
    for (var i = 0; i < SC.length; i++) {
      if (SC[i].id === id) { return ar ? (SC[i].ar || SC[i].en) : SC[i].en; }
    }
    return id;
  }

  var TARGETS = {};

  /* ---- 1 · the dashboard --------------------------------------- */
  TARGETS.dashboard = {
    section: 'dashboard',
    anchor: function () { return document.querySelector('#dashboard .rowf'); },
    stem: 'ksat-dashboard',
    charts: [
      { id: 'chVeg',    label: { en: 'Vegetation index trend', ar: 'اتجاه مؤشر الغطاء النباتي' }, cls: 'demo' },
      { id: 'chStress', label: { en: 'Environmental stress by governorate', ar: 'الإجهاد البيئي حسب المحافظة' }, cls: 'demo' },
      { id: 'chHeat',   label: { en: 'Monthly surface heat', ar: 'الحرارة السطحية الشهرية' }, cls: 'demo' },
      { id: 'chRadial', label: { en: 'Greening potential', ar: 'إمكانية التشجير' }, cls: 'ai' }
    ],
    available: function () { return !!(gSERIES() && gREGIONS() && gMETRICS()); },
    build: function () {
      var st = gState();
      var area = st ? st.dash.area : 'all';
      var months = st ? st.dash.period : 12;
      var ids = selectedIds(area);
      var rows = seriesRows(ids, months, METRIC_ORDER);
      if (!rows) { return null; }

      /* The eight headline tiles are period means of the very rows
         below plus the greening score, so they are computed with the
         page's own agg() rather than re-derived here. Two engines
         producing two slightly different means, one on screen and one
         in the file, is a bug that would take a long time to find. */
      var summary = null;
      var A = gAgg();
      if (A) {
        try {
          var a = A(area, months);
          summary = [
            { key: 'mean_surface_temp_c',      value: a.out.lst,    unit: 'degC', provenance: CLASS.demo.token },
            { key: 'mean_veg_index',           value: a.out.ndvi,   unit: '',     provenance: CLASS.demo.token },
            { key: 'mean_green_cover_pct',     value: a.out.green,  unit: '%',    provenance: CLASS.demo.token },
            { key: 'mean_dust_indicator',      value: a.out.dust,   unit: '/100', provenance: CLASS.demo.token },
            { key: 'mean_env_stress',          value: a.out.stress, unit: '/100', provenance: CLASS.demo.token },
            { key: 'mean_greening_potential',  value: a.out.score,  unit: '/100', provenance: CLASS.ai.token }
          ];
        } catch (e) { summary = null; }
      }

      return {
        meta: {
          titleEn: 'Environmental Intelligence Dashboard, governorate monthly series',
          titleAr: 'لوحة الذكاء البيئي, السلاسل الشهرية للمحافظات',
          filtersEn: 'Area: ' + areaLabelIn(area, false) + '; Period: last ' + months + ' months; Metrics: all five',
          filtersAr: 'المنطقة: ' + areaLabelIn(area, true) + '؛ الفترة: آخر ' + months + ' شهراً؛ المؤشرات: الخمسة جميعاً',
          classes: ['demo', 'ai'],
          longShape: true
        },
        columns: seriesColumns(),
        keys: SERIES_KEYS,
        rows: rows,
        extra: summary ? { headline_figures: summary } : null,
        nameParts: [area, months + 'mo'],
        describe: function () {
          return t('w.series', {
            rows: rows.length, months: months, metrics: metricsPhrase(METRIC_ORDER.length),
            areas: areaLabel(area), token: CLASS.demo.token
          }) + ' · ' + t('w.filters', {
            filters: kv(t('f.area'), areaLabel(area)) + sep() + t('f.months', { n: months })
          });
        },
        chartFilters: function () {
          return areaLabelIn(area, isAR()) + ' · ' + t('f.months', { n: months });
        }
      };
    }
  };

  /* ---- 2 · reading the record ---------------------------------- */
  TARGETS.charts = {
    section: 'charts',
    anchor: function () { return document.querySelector('#charts .rowf'); },
    stem: 'ksat-record',
    charts: [
      { id: 'chTrend', label: { en: 'Trend', ar: 'الاتجاه' }, cls: 'demo',
        live: function () { var e = document.getElementById('vTitle1'); return e && e.textContent; } },
      { id: 'chBars',  label: { en: 'Area comparison', ar: 'مقارنة المناطق' }, cls: 'demo',
        live: function () { var e = document.getElementById('vTitle2'); return e && e.textContent; } }
    ],
    available: function () { return !!(gSERIES() && gREGIONS() && gMETRICS()); },
    build: function () {
      var st = gState();
      var area = st ? st.viz.area : 'all';
      var metric = st ? st.viz.metric : 'ndvi';
      var months = st ? st.viz.range : 36;
      var ids = selectedIds(area);
      var rows = seriesRows(ids, months, [metric]);
      if (!rows) { return null; }
      var M = gMETRICS();
      var mEn = M && M[metric] ? M[metric].en : metric;
      var mAr = M && M[metric] ? (M[metric].ar || M[metric].en) : metric;

      return {
        meta: {
          titleEn: 'Reading the record, ' + mEn,
          titleAr: 'قراءة السجل, ' + mAr,
          filtersEn: 'Area: ' + areaLabelIn(area, false) + '; Metric: ' + mEn + '; Range: last ' + months + ' months',
          filtersAr: 'المنطقة: ' + areaLabelIn(area, true) + '؛ المؤشر: ' + mAr + '؛ المدى: آخر ' + months + ' شهراً',
          classes: ['demo'],
          longShape: true
        },
        columns: seriesColumns(),
        keys: SERIES_KEYS,
        rows: rows,
        nameParts: [metric, area, months + 'mo'],
        describe: function () {
          return t('w.series', {
            rows: rows.length, months: months, metrics: metricsPhrase(1),
            areas: areaLabel(area), token: CLASS.demo.token
          }) + ' · ' + t('w.filters', {
            /* kv() and sep(), not ' ' and ', '. This line was built by
               hand at first and shipped reading
               "المؤشر مؤشر الغطاء النباتي, المنطقة كل المحافظات" —
               no colon to separate label from value, and an ASCII comma
               that the bidi algorithm parks on the wrong side of the
               word it follows. sep() is the Arabic comma; see its
               definition for why this is not cosmetic. */
            filters: kv(t('f.metric'), metricLabel(metric)) + sep() +
                     kv(t('f.area'), areaLabel(area)) + sep() +
                     t('f.months', { n: months })
          });
        },
        chartFilters: function () {
          return metricLabel(metric) + ' · ' + areaLabelIn(area, isAR()) +
                 ' · ' + t('f.months', { n: months });
        }
      };
    }
  };

  /* ---- 3 · the region scorecard under the greening map ---------- */
  TARGETS.map = {
    section: 'map',
    anchor: function () { return document.getElementById('regionTable'); },
    stem: 'ksat-governorates',
    charts: [],
    available: function () { return !!gREGIONS(); },
    build: function () {
      var rows = regionRows();
      if (!rows) { return null; }
      var R = gREGIONS();
      return {
        meta: {
          titleEn: 'Greening potential, governorate scorecard',
          titleAr: 'إمكانية التشجير, بطاقة أداء المحافظات',
          filtersEn: 'None, all six governorates, all eight fields',
          filtersAr: 'لا شيء, المحافظات الست جميعاً، والحقول الثماني جميعاً',
          classes: ['demo', 'ai'],
          longShape: true
        },
        columns: regionColumns(),
        keys: REGION_KEYS,
        rows: rows,
        nameParts: [],
        describe: function () {
          return t('w.regions', {
            rows: rows.length, areas: R.length, fields: REGION_FIELDS.length,
            token: CLASS.demo.token, token2: CLASS.ai.token
          });
        },
        chartFilters: function () { return ''; }
      };
    }
  };

  /* ---- 4 · change detection ------------------------------------ */
  TARGETS.compare = {
    section: 'compare',
    anchor: function () { return document.querySelector('#compare .rowf'); },
    stem: 'ksat-change',
    charts: [
      { id: 'cmpAcv', label: { en: 'Scene A', ar: 'المشهد أ' }, cls: 'sim' },
      { id: 'cmpBcv', label: { en: 'Scene B', ar: 'المشهد ب' }, cls: 'sim' }
    ],
    available: function () { return !!document.getElementById('cmpResult'); },
    build: function () {
      var st = gState();
      var a = st ? st.cmp.a : '', b = st ? st.cmp.b : '';
      var scene = st ? st.ex.scene : '';
      var rows = changeRows();

      return {
        meta: {
          titleEn: 'Compare From Space, change readout',
          titleAr: 'المقارنة من الفضاء, قراءة التغيّر',
          filtersEn: 'Scene: ' + sceneLabel(scene, false) + '; A: ' + epochLabel(a, false) +
                     '; B: ' + epochLabel(b, false) +
                     '. Both scenes are rendered by this page on a 39 m grid. They are not acquisitions, ' +
                     'and the differences below are a real method applied to modelled inputs.',
          filtersAr: 'المشهد: ' + sceneLabel(scene, true) + '؛ أ: ' + epochLabel(a, true) +
                     '؛ ب: ' + epochLabel(b, true) +
                     '. المشهدان مرسومان في هذه الصفحة على شبكة 39 متراً. وليسا التقاطاً فعلياً، ' +
                     'والفروق أدناه طريقة حقيقية طُبّقت على مدخلات مُنمذَجة.',
          classes: ['sim', 'ai'],
          longShape: true
        },
        columns: [t('c.measure'), t('c.change'), t('c.prov')],
        keys: ['measure', 'change', 'provenance'],
        rows: rows || [],
        nameParts: [scene, a, b],
        empty: !rows || !rows.length,
        describe: function () {
          if (!rows || !rows.length) { return t('w.changeNone'); }
          return t('w.change', { rows: rows.length, token: CLASS.sim.token }) + ' · ' +
            t('w.filters', {
              /* Same correction as the charts bar above: labelled with a
                 colon, joined with the Arabic comma. Three values here
                 rather than two, so the adrift-comma reading was worse. */
              filters: kv(t('f.scene'), sceneLabel(scene, isAR())) + sep() +
                       kv(t('f.epochA'), epochLabel(a, isAR())) + sep() +
                       kv(t('f.epochB'), epochLabel(b, isAR()))
            });
        },
        chartFilters: function () {
          return sceneLabel(scene, isAR()) + ' · ' +
                 epochLabel(a, isAR()) + ' → ' + epochLabel(b, isAR());
        }
      };
    }
  };

  /* ---- 5 · the three registers in #sources ---------------------- */
  var REGISTERS = {
    prov: {
      stem: 'ksat-provenance-register',
      titleEn: 'Data provenance register',
      titleAr: 'سجل مصدر البيانات',
      labelKey: 'p.regProv',
      classes: ['real', 'pub', 'demo', 'sim', 'ai', 'unver'],
      build: function () {
        var rows = provRows();
        if (!rows) { return null; }
        return {
          columns: [t('c.dataset'), t('c.class'), t('c.classEn'), t('c.classAr'),
                    t('c.usedby'), t('c.srcnums'), t('c.srcurls')],
          keys: ['dataset', 'class_token', 'class_en', 'class_ar', 'used_by',
                 'source_numbers', 'source_urls'],
          rows: rows,
          describeKey: 'w.prov'
        };
      }
    },
    claims: {
      stem: 'ksat-claims-register',
      titleEn: 'Claims made on this page, and their sources',
      titleAr: 'الادعاءات الواردة في هذه الصفحة ومصادرها',
      labelKey: 'p.regClaims',
      classes: ['real'],
      build: function () {
        var rows = claimRows();
        if (!rows) { return null; }
        return {
          columns: [t('c.claim'), t('c.srcnums'), t('c.srcurls'), t('c.prov')],
          keys: ['claim', 'source_numbers', 'source_urls', 'provenance'],
          rows: rows,
          describeKey: 'w.claims'
        };
      }
    },
    sources: {
      stem: 'ksat-source-register',
      titleEn: 'Source register',
      titleAr: 'سجل المصادر',
      labelKey: 'p.regSrc',
      classes: ['src'],
      build: function () {
        var rows = sourceRows();
        if (!rows) { return null; }
        return {
          columns: [t('c.n'), t('c.name'), t('c.url'), t('c.note'), t('c.prov')],
          keys: ['n', 'reference', 'url', 'supports', 'provenance'],
          rows: rows,
          describeKey: 'w.src'
        };
      }
    }
  };

  function registerMeta(reg) {
    return {
      titleEn: reg.titleEn,
      titleAr: reg.titleAr,
      filtersEn: TXT['f.none'].en,
      filtersAr: TXT['f.none'].ar,
      classes: reg.classes,
      longShape: false
    };
  }

  /* =================================================================
     13 · THE EXPORT BAR

     Built in JS because index.html is not this file's to edit. Each bar
     is inserted next to the control row it belongs to, so that the
     filters and the export that will carry them sit together.
     ================================================================= */

  var bars = [];

  function button(labelKey, titleKey, cls) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn sm ksx-btn' + (cls ? ' ' + cls : '');
    b.setAttribute('data-ksx-label', labelKey);
    b.setAttribute('data-ksx-title', titleKey);
    return b;
  }

  function flash(btn) {
    if (reduced()) { return; }
    btn.setAttribute('data-ksx-done', '');
    setTimeout(function () { btn.removeAttribute('data-ksx-done'); }, 900);
  }

  function buildBar(key, target) {
    var anchor = target.anchor();
    if (!anchor || !target.available()) { return null; }

    var bar = document.createElement('div');
    bar.className = 'ksx-bar';
    bar.setAttribute('data-ksx-for', key);
    bar.setAttribute('role', 'group');

    var lab = document.createElement('span');
    lab.className = 'ksx-lab';
    bar.appendChild(lab);

    var csvBtn = button('bar.csv', 'bar.csvTip');
    var jsonBtn = button('bar.json', 'bar.jsonTip');
    bar.appendChild(csvBtn);
    bar.appendChild(jsonBtn);

    var sel = null, pngBtn = null;
    if (target.charts && target.charts.length) {
      if (target.charts.length > 1) {
        sel = document.createElement('select');
        sel.className = 'ksx-sel';
        target.charts.forEach(function (c, i) {
          var o = document.createElement('option');
          o.value = String(i);
          sel.appendChild(o);
        });
        bar.appendChild(sel);
      }
      pngBtn = button('bar.png', 'bar.pngTip');
      bar.appendChild(pngBtn);
    }

    var what = document.createElement('p');
    what.className = 'ksx-what';
    bar.appendChild(what);

    anchor.parentNode.insertBefore(bar, anchor.nextSibling);

    function data() {
      var d = null;
      try { d = target.build(); } catch (e) { d = null; }
      return d;
    }

    csvBtn.addEventListener('click', function () {
      var d = data();
      if (!d || !d.rows.length) { announce(t('st.nodata')); return; }
      saveText(fileName(target.stem, d.nameParts, 'csv'), 'text/csv',
               toCSV(d.meta, d.columns, d.rows));
      flash(csvBtn);
    });

    jsonBtn.addEventListener('click', function () {
      var d = data();
      if (!d || !d.rows.length) { announce(t('st.nodata')); return; }
      saveText(fileName(target.stem, d.nameParts, 'json'), 'application/json',
               toJSON(d.meta, d.columns, d.rows, d.keys, d.extra));
      flash(jsonBtn);
    });

    if (pngBtn) {
      pngBtn.addEventListener('click', function () {
        var idx = sel ? (parseInt(sel.value, 10) || 0) : 0;
        var spec = target.charts[idx];
        var cv = document.getElementById(spec.id);
        if (!drawn(cv)) { announce(t('st.nocanvas')); return; }
        var d = data();
        var title = (spec.live && spec.live()) || L(spec.label);
        var filters = d && d.chartFilters ? d.chartFilters() : '';
        savePNG(cv, fileName(target.stem, [spec.id].concat(d ? d.nameParts : []), 'png'),
                captionFor(title, tokenOf(spec.cls), filters));
        flash(pngBtn);
      });
    }

    var rec = {
      key: key, bar: bar, target: target, lab: lab, what: what,
      sel: sel, buttons: [csvBtn, jsonBtn].concat(pngBtn ? [pngBtn] : [])
    };
    bars.push(rec);
    return rec;
  }

  function relabel(rec) {
    rec.lab.textContent = t('bar.lab');
    rec.bar.setAttribute('aria-label', t('bar.lab') + ', ' + sectionTitle(rec.target.section));
    rec.buttons.forEach(function (b) {
      b.textContent = t(b.getAttribute('data-ksx-label'));
      b.title = t(b.getAttribute('data-ksx-title'));
    });
    if (rec.sel) {
      rec.sel.setAttribute('aria-label', t('bar.pick'));
      rec.target.charts.forEach(function (c, i) {
        rec.sel.options[i].textContent = (c.live && c.live()) || L(c.label);
      });
    }
    var d = null;
    try { d = rec.target.build(); } catch (e) { d = null; }
    rec.what.textContent = d && d.describe ? d.describe() : '';
    var empty = !d || !d.rows.length;
    rec.buttons.forEach(function (b) {
      if (b.getAttribute('data-ksx-label') === 'bar.png') {
        /* PNG does not follow the row count. The compare bar has no rows
           until somebody runs a comparison, but both scene canvases are
           drawn from the moment the section opens and are worth having.
           What PNG follows is whether anything has been drawn at all —
           which, per drawn(), is not the same question as whether the
           canvas element exists. Disabling it here means a reader in a
           section that has never been opened sees an unavailable button
           rather than one that accepts a click and does nothing. */
        b.disabled = !(rec.target.charts || []).some(function (c) {
          return drawn(document.getElementById(c.id));
        });
        return;
      }
      b.disabled = empty;
    });
  }

  function relabelAll() { bars.forEach(relabel); }

  /* =================================================================
     14 · THE PROVENANCE AND CITATION PANEL

     Spec 12 asks for a dedicated data provenance panel and for citation
     information that is easy to copy. The page already prints the
     provenance register as a table; what it had no way to do was hand
     it to you, or tell you how to cite any of it. This panel is
     appended to #sources, directly below the register it describes.
     ================================================================= */

  function citeBlock(labelKey, text, mono) {
    var wrap = document.createElement('div');
    wrap.className = 'ksx-citerow';

    var head = document.createElement('div');
    head.className = 'ksx-citehead';

    var lab = document.createElement('span');
    lab.className = 'ksx-lab';
    lab.setAttribute('data-ksx-label', labelKey);
    head.appendChild(lab);

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn sm ksx-btn';
    btn.setAttribute('data-ksx-label', 'p.copy');
    head.appendChild(btn);

    var body = document.createElement('div');
    body.className = 'ksx-cite' + (mono ? ' ksx-mono' : '');
    body.textContent = text;
    /* The plain-text Arabic citation is Arabic prose with a Latin URL
       in the middle of it; the BibTeX block is Latin source that must
       never be mirrored. .ksx-cite pins direction in the stylesheet,
       and this attribute is what tells it which way round. */
    body.setAttribute('dir', mono ? 'ltr' : 'auto');

    btn.addEventListener('click', function () { copyText(text, body); flash(btn); });

    wrap.appendChild(head);
    wrap.appendChild(body);
    return wrap;
  }

  var panel = null;

  function buildPanel() {
    var host = document.getElementById('sources');
    if (!host || document.getElementById('ksx-panel')) { return; }

    panel = document.createElement('div');
    panel.id = 'ksx-panel';
    panel.className = 'panel mt ksx-panel';

    var head = document.createElement('div');
    head.className = 'phead';
    head.innerHTML = '<div class="ttl"><h3 data-ksx-label="p.h"></h3></div>';
    panel.appendChild(head);

    var lede = document.createElement('p');
    lede.className = 'sub';
    lede.style.marginTop = '0';
    lede.setAttribute('data-ksx-label', 'p.lede');
    panel.appendChild(lede);

    /* --- the vocabulary --- */
    var vh = document.createElement('h4');
    vh.className = 'ksx-sub';
    vh.setAttribute('data-ksx-label', 'p.vocab');
    panel.appendChild(vh);

    var vp = document.createElement('p');
    vp.className = 'sub';
    vp.setAttribute('data-ksx-label', 'p.vocabp');
    panel.appendChild(vp);

    var vocab = document.createElement('dl');
    vocab.className = 'ksx-key';
    Object.keys(CLASS).forEach(function (k) {
      var c = CLASS[k];
      var dt = document.createElement('dt');
      dt.textContent = c.token;
      var dd = document.createElement('dd');
      dd.setAttribute('data-ksx-class', k);
      vocab.appendChild(dt);
      vocab.appendChild(dd);
    });
    panel.appendChild(vocab);

    /* --- the three registers --- */
    var rh = document.createElement('h4');
    rh.className = 'ksx-sub';
    rh.setAttribute('data-ksx-label', 'p.reg');
    panel.appendChild(rh);

    var rp = document.createElement('p');
    rp.className = 'sub';
    rp.setAttribute('data-ksx-label', 'p.regp');
    panel.appendChild(rp);

    Object.keys(REGISTERS).forEach(function (key) {
      var reg = REGISTERS[key];
      var built = null;
      try { built = reg.build(); } catch (e) { built = null; }
      if (!built) { return; }          /* no data reachable, no button */

      var row = document.createElement('div');
      row.className = 'ksx-bar ksx-bar-inline';
      row.setAttribute('role', 'group');

      var lab = document.createElement('span');
      lab.className = 'ksx-lab';
      lab.setAttribute('data-ksx-label', reg.labelKey);
      row.appendChild(lab);

      var csvBtn = button('bar.csv', 'bar.csvTip');
      var jsonBtn = button('bar.json', 'bar.jsonTip');
      row.appendChild(csvBtn);
      row.appendChild(jsonBtn);

      var what = document.createElement('p');
      what.className = 'ksx-what';
      what.setAttribute('data-ksx-count', String(built.rows.length));
      what.setAttribute('data-ksx-describe', built.describeKey);
      row.appendChild(what);

      csvBtn.addEventListener('click', function () {
        var b = reg.build();
        if (!b) { announce(t('st.nodata')); return; }
        saveText(fileName(reg.stem, [], 'csv'), 'text/csv',
                 toCSV(registerMeta(reg), b.columns, b.rows));
        flash(csvBtn);
      });
      jsonBtn.addEventListener('click', function () {
        var b = reg.build();
        if (!b) { announce(t('st.nodata')); return; }
        saveText(fileName(reg.stem, [], 'json'), 'application/json',
                 toJSON(registerMeta(reg), b.columns, b.rows, b.keys, null));
        flash(jsonBtn);
      });

      panel.appendChild(row);
    });

    /* --- the citation --- */
    var ch = document.createElement('h4');
    ch.className = 'ksx-sub';
    ch.setAttribute('data-ksx-label', 'p.cite');
    panel.appendChild(ch);

    var cp = document.createElement('p');
    cp.className = 'sub';
    cp.setAttribute('data-ksx-label', 'p.citep');
    panel.appendChild(cp);

    var citeHost = document.createElement('div');
    citeHost.id = 'ksx-cites';
    panel.appendChild(citeHost);

    /* --- what is deliberately absent --- */
    var mh = document.createElement('h4');
    mh.className = 'ksx-sub';
    mh.setAttribute('data-ksx-label', 'p.missing');
    panel.appendChild(mh);

    var mp = document.createElement('p');
    mp.className = 'sub ksx-omit';
    mp.setAttribute('data-ksx-label', 'p.missingp');
    panel.appendChild(mp);

    /* --- the sixteen references --- */
    var SRC = gSOURCES();
    if (SRC) {
      var ph = document.createElement('h4');
      ph.className = 'ksx-sub';
      ph.setAttribute('data-ksx-label', 'p.primary');
      panel.appendChild(ph);

      var pp = document.createElement('p');
      pp.className = 'sub';
      pp.setAttribute('data-ksx-label', 'p.primaryp');
      panel.appendChild(pp);

      var srcRow = document.createElement('div');
      srcRow.className = 'ksx-bar ksx-bar-inline';
      srcRow.setAttribute('role', 'group');
      var copyAll = button('p.copyAll', 'bar.csvTip');
      copyAll.addEventListener('click', function () {
        copyText(sourcesPlain(), null); flash(copyAll);
      });
      srcRow.appendChild(copyAll);
      panel.appendChild(srcRow);
    }

    host.appendChild(panel);
    repaintPanel();
  }

  /* The citation text embeds today's date and the current language, so
     it is rebuilt rather than translated in place. */
  function repaintPanel() {
    if (!panel) { return; }

    panel.querySelectorAll('[data-ksx-label]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-ksx-label'));
    });
    panel.querySelectorAll('[data-ksx-class]').forEach(function (el) {
      var c = CLASS[el.getAttribute('data-ksx-class')];
      el.textContent = c ? L(c) : '';
    });
    panel.querySelectorAll('[data-ksx-describe]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-ksx-describe'),
                         { rows: el.getAttribute('data-ksx-count') });
    });

    var host = document.getElementById('ksx-cites');
    if (host) {
      host.innerHTML = '';
      host.appendChild(citeBlock('p.plainEn', citationPlain(false), false));
      host.appendChild(citeBlock('p.plainAr', citationPlain(true), false));
      host.appendChild(citeBlock('p.bib', citationBibtex(), true));
      host.querySelectorAll('[data-ksx-label]').forEach(function (el) {
        el.textContent = t(el.getAttribute('data-ksx-label'));
      });
    }
  }

  /* =================================================================
     15 · KEEPING THE DESCRIPTIONS HONEST

     The "what is in the file" line names the filters in force, so it
     has to follow them. The page has no event for "a filter changed",
     and adding a listener per <select> would miss the ones the tour and
     the assistant set programmatically, so this listens broadly and
     cheaply: one delegated handler, debounced, and the work it does is
     rebuilding six short strings.
     ================================================================= */

  var pending = null;

  function refreshSoon() {
    if (pending) { return; }
    pending = setTimeout(function () { pending = null; relabelAll(); }, 140);
  }

  /* =================================================================
     16 · BOOT
     ================================================================= */

  function start() {
    Object.keys(TARGETS).forEach(function (key) {
      try { buildBar(key, TARGETS[key]); } catch (e) {}
    });
    try { buildPanel(); } catch (e) {}
    relabelAll();

    document.addEventListener('change', refreshSoon, true);
    document.addEventListener('click', refreshSoon, true);

    document.addEventListener('ksat:lang', function () {
      setTimeout(function () { relabelAll(); repaintPanel(); }, 160);
    });
    /* Chapters move whole sections in and out of flow; the tier reveal
       adds more. Either can produce an anchor this file has not seen. */
    document.addEventListener('ksat:chapter', function () {
      setTimeout(function () {
        Object.keys(TARGETS).forEach(function (key) {
          var already = document.querySelector('.ksx-bar[data-ksx-for="' + key + '"]');
          if (!already) { try { buildBar(key, TARGETS[key]); } catch (e) {} }
        });
        relabelAll();
      }, 120);
    });

    KS.exporter = {
      version: 1,
      bars: bars,
      targets: TARGETS,
      registers: REGISTERS,
      vocabulary: CLASS,
      citation: { plain: citationPlain, bibtex: citationBibtex, sources: sourcesPlain },
      csv: toCSV,
      json: toJSON,
      refresh: function () { relabelAll(); repaintPanel(); }
    };
  }

  function boot() {
    var tries = 0;
    /* Wait for the page's own render, not just for DOMContentLoaded:
       #regionTable and #cmpResult are filled by renderAll(), and a bar
       built before that would read an empty table and print "0 rows". */
    var iv = setInterval(function () {
      tries++;
      var ready = document.querySelector('#dashboard .rowf') &&
                  document.getElementById('regionTable') &&
                  document.getElementById('sources');
      if (ready || tries > 80) { clearInterval(iv); start(); }
    }, 120);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
