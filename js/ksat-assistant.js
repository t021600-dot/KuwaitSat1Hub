/* =====================================================================
   ksat-assistant.js — MISSION ASSISTANT
   Owner: 03 Security, with 04 Agents (the guardrail text)

   A corner assistant for researchers and for anyone looking at the
   platform for the first time.

   THE DESIGN DECISION WORTH DEFENDING
   This does NOT add a second brain. The page already contains a working
   analyst (askAnalyst(), section #ai) that answers in a fixed structure
   and badges every answer with the class of data it rests on. Building
   a rival that answered the same questions differently would mean two
   sources of truth on one page, and the second one would have no
   provenance.

   So the assistant does two things and refuses the third:
     1 · PLATFORM questions it answers itself, from a written knowledge
         base below. How the agents work, who can see what, where the
         numbers come from, what the checkpoint is for.
     2 · DATA questions it hands to askAnalyst() - the real engine - and
         mirrors that answer back WITH its provenance, alongside a
         control that opens the full analyst where the sources are.
     3 · Anything it has no grounding for, it says so. It does not guess.

   NO NETWORK. NO KEY. NO MODEL.
   Everything here runs in the page. There is no API call, so there is
   no key to leak and nothing to intercept. That is also why it works
   under our Content-Security-Policy, whose connect-src allows only our
   own origin and Supabase: a third-party chatbot would be blocked, and
   correctly so.

   SECURITY NOTES FOR THE REVIEWER
   - Every string that reaches the DOM goes through textContent. There
     is no innerHTML in this file, so a question containing markup is
     rendered as the characters the researcher typed.
   - The transcript is kept in sessionStorage, per tab, and never leaves
     the browser. It is not written to the database: a researcher's
     questions are their own.
   - It reads identity from KSAT.live only to change its greeting. It
     never asks the database for anything, so it cannot leak a row it
     was not entitled to.

   ---------------------------------------------------------------------
   FOUR THINGS THAT WERE WRONG, AND WHAT THEY COST   21 September 2026
   ---------------------------------------------------------------------

   1 · THE BRIDGE TO THE ANALYST WAS DEAD, AND SILENTLY SO.
       delegate() looked up document.getElementById('anLog'). The
       analyst transcript is id="chat" and 'anLog' appears nowhere in
       this repository - it was the id of an element in an older draft
       of the page. Because a missing element simply fell through to the
       polite "the analyst is on the AI section" message, the bridge was
       broken for the whole life of the file and nothing complained.
       Every data question a visitor asked got a signpost instead of an
       answer. The id is now a named constant, it is checked once at
       boot, and a missing target writes a console error that names the
       element and this file rather than degrading in silence.

   2 · THE ANSWERS HAD NO SCIENTIFIC STRUCTURE.
       Spec section 26 is explicit that this is a scientific analysis
       assistant and not an ask-us-anything box: an answer must show
       QUESTION, DATA USED, METHOD, ANALYSIS, RESULT, LIMITATIONS and
       SOURCES. The knowledge base wrote free prose. Every entry now
       carries those seven fields. No sentence was dropped in the move -
       the prose was redistributed, not rewritten - and where a field
       genuinely does not apply it says so out loud instead of being
       hidden, because a missing row reads as an answer with nothing to
       declare.

   3 · FACT AND INFERENCE LOOKED IDENTICAL.
       Spec 26 again: AI-generated interpretation must never look the
       same as measured data. Each row now declares its provenance using
       the vocabulary the page already has - MISSION RECORD, REFERENCE
       DATASET, MODELLED, DERIVED ANALYSIS, PUBLIC DATA, ESTIMATE - and
       css/ksat-assistant.css draws a generated row differently from a
       stated one (rail pattern, wash, tag and a screen-reader phrase),
       so the distinction survives greyscale and survives being read
       aloud.

   4 · ESCAPE ONLY WORKED FROM INSIDE THE PANEL.
       The only keydown listener was on the panel, so Escape closed the
       assistant only while focus was still inside it. Click the page
       behind, press Escape, nothing happened. There is now a document
       level listener, guarded so it never takes Escape from the intro
       sequence, the sign-in gate or the chapter sheet.

       That listener was first registered on the bubble phase, and the
       guided tour - which binds document keydown at parse time, before
       this file mounts - beat it to every Escape. With the tour running
       and the panel open, Escape exited the TOUR and left the assistant
       on screen. It is a capture listener now. The long version is at
       WHO ELSE OWNS ESCAPE ON THIS PAGE, further down.

   SOURCES POLICY FOR WHOEVER EDITS THE KNOWLEDGE BASE NEXT
   Do not invent a citation. The page holds a real SOURCES register; a
   row may reference it by index and nothing else. An answer that
   describes how this platform behaves is not a measurement and has no
   source - say that, in those words.

   AND DO NOT WRITE DOWN HOW MANY SOURCES THERE ARE.
   This file used to tell the visitor, in English and in Arabic, about
   "the eight numbered primary sources". There are sixteen. index.html
   declares eight in `const SOURCES` at :1886 and then three separate
   later scripts call SOURCES.push() - :4989, :5330 and :5412 - adding
   the Vision 2035 statement, the WMO temperature verification, the
   World Bank indicators and five more. All three push sites predate
   this file, so the count was wrong on the day it was typed; it was
   not made stale by somebody else's change.

   That is worth more than a typo correction, because SOURCES is the
   one field of the seven whose entire job is to be checkable. A
   visitor who counts the register and finds sixteen where the
   assistant said eight has been given a reason to doubt every other
   number in the answer. The sentences now say "the numbered primary
   sources" and name no total, so the register can grow again without
   making a liar of this file. If a count is ever genuinely wanted,
   read SOURCES.length at draw time - drawSources() already reaches
   into that array for the titles and would be the place.
   ===================================================================== */

(function () {
  'use strict';

  var KS = window.KSAT = window.KSAT || {};
  if (KS.assistant) return;                       /* never double-mount */

  var PANEL_ID = 'ksat-as-panel';
  var FAB_ID   = 'ksat-as-fab';
  var STORE    = 'ksat.assistant.log.v2';
  var STORE_V1 = 'ksat.assistant.log.v1';   /* the flat-text transcript */

  /* THE BRIDGE. One constant, named once, so the next person who
     renames the analyst transcript has a single place to change and a
     console error pointing at it. See note 1 in the header. */
  var ANALYST_LOG_ID = 'chat';          /* index.html, section #ai      */

  /* ===================================================================
     1 · SMALL DOM HELPERS. textContent only, everywhere.
     =================================================================== */

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }
  function reduced() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (e) { return false; }
  }
  function isRTL() {
    var r = document.documentElement;
    return r.getAttribute('dir') === 'rtl' || r.getAttribute('lang') === 'ar';
  }

  /* The page's language, asked of the i18n layer where it exists and of
     the document otherwise. js/ksat-i18n.js loads AFTER this file, so
     KS.i18n is absent on the first paint and present from then on. */
  function lang() {
    try { if (KS.i18n && KS.i18n.lang) return KS.i18n.lang() === 'ar' ? 'ar' : 'en'; }
    catch (e) {}
    return document.documentElement.lang === 'ar' ? 'ar' : 'en';
  }

  /* Every user-visible string in this file is written as {en, ar}.
     js/ksat-i18n.js is not ours to edit, so the pairs live here and are
     listed in the handover so they can be folded into the dictionary
     later without changing behaviour. */
  function L(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string') return v;
    var code = lang();
    return (code === 'ar' && v.ar) ? v.ar : (v.en !== undefined ? v.en : '');
  }

  /* The knowledge base quotes numbers the deployed system enforces. They
     are written as {tokens} and filled at answer time from KS.LIMITS, so
     a threshold change in js/ksat-integration.js cannot leave a stale
     figure sitting in an answer. */
  function limits() {
    var Lm = KS.LIMITS || {};
    return {
      floor:   (Lm.MIN_ZONE_SCORE != null ? Lm.MIN_ZONE_SCORE : 40),
      reranks: (Lm.MAX_RERANKS    != null ? Lm.MAX_RERANKS    : 2),
      budget:  (Lm.STEP_BUDGET    != null ? Lm.STEP_BUDGET    : 40),
      cool:    (Lm.IMPACT_FLOOR_C != null ? Lm.IMPACT_FLOOR_C : 1.0)
    };
  }
  function fill(text, L2) {
    return String(text)
      .replace(/\{floor\}/g,   String(L2.floor))
      .replace(/\{reranks\}/g, String(L2.reranks))
      .replace(/\{budget\}/g,  String(L2.budget))
      .replace(/\{cool\}/g,    String(L2.cool));
  }

  /* ===================================================================
     2 · THE PROVENANCE VOCABULARY

     NOT A NEW ONE. index.html already classifies every figure it draws
     with a .badge whose class encodes the class of data: real, demo,
     sim, ai, pub, proj. typeBadge() in that file gives each its mark and
     its wording. This table is the same six, under the same marks, so a
     researcher who has learned the legend once has learned it here too.

     The seventh, `platform`, is the honest none-of-the-above: an answer
     about how this platform behaves is documented code, not a
     measurement, and pretending it carries a data class would be the
     exact dishonesty the legend exists to prevent. It renders neutral.

     `kind` drives the visual treatment in css/ksat-assistant.css:
       stated    - a published, attributable fact or an official figure
       generated - produced by a model or by an interpretation
       platform  - a description of this system, not a datum
     =================================================================== */

  var PROV = {
    record:   { cls: 'record',   kind: 'stated',    mark: '🛰',
                en: 'Mission record',     ar: 'سجل المهمة' },
    public:   { cls: 'public',   kind: 'stated',    mark: '🏛',
                en: 'Public data',        ar: 'بيانات عامة' },
    dataset:  { cls: 'dataset',  kind: 'generated', mark: '▦',
                en: 'Reference dataset',  ar: 'مجموعة بيانات مرجعية' },
    modelled: { cls: 'modelled', kind: 'generated', mark: '◈',
                en: 'Modelled',           ar: 'مُنمذَج' },
    estimate: { cls: 'estimate', kind: 'generated', mark: '↗',
                en: 'Estimate',           ar: 'تقدير' },
    derived:  { cls: 'derived',  kind: 'generated', mark: '⬡',
                en: 'Derived analysis',   ar: 'تحليل مُشتق' },
    platform: { cls: 'platform', kind: 'platform',  mark: '▣',
                en: 'Platform behaviour', ar: 'سلوك المنصة' }
  };

  /* Spoken, not drawn. A colour and a hatch are invisible to a screen
     reader and to anyone reading a printout in greyscale, so the class
     of a row is also said in words. */
  var KIND_SPOKEN = {
    stated:    { en: 'Stated fact.',                     ar: 'حقيقة موثّقة.' },
    generated: { en: 'Generated, not measured.',         ar: 'مُولَّد وليس مقاساً.' },
    platform:  { en: 'Describes the platform, not data.', ar: 'وصف للمنصة وليس بياناً.' }
  };

  /* The seven fields of spec section 26, in the order they are read. */
  var FIELDS = [
    { id: 'q',        en: 'QUESTION',    ar: 'السؤال' },
    { id: 'data',     en: 'DATA USED',   ar: 'البيانات المستخدمة' },
    { id: 'method',   en: 'METHOD',      ar: 'المنهج' },
    { id: 'analysis', en: 'ANALYSIS',    ar: 'التحليل' },
    { id: 'result',   en: 'RESULT',      ar: 'النتيجة' },
    { id: 'limits',   en: 'LIMITATIONS', ar: 'حدود الإجابة' },
    { id: 'sources',  en: 'SOURCES',     ar: 'المصادر' }
  ];
  var FIELD_BY_ID = {};
  FIELDS.forEach(function (f) { FIELD_BY_ID[f.id] = f; });

  /* ===================================================================
     3 · INTERFACE STRINGS
     =================================================================== */

  var UI = {
    fabLabel:   { en: 'Assistant',            ar: 'المساعد' },
    fabOpen:    { en: 'Open the mission assistant', ar: 'فتح مساعد المهمة' },
    eyebrow:    { en: 'MISSION ASSISTANT',    ar: 'مساعد المهمة' },
    sub:        { en: 'Scientific analysis assistant. Answers from this page, in a fixed structure. No external model.',
                  ar: 'مساعد تحليل علمي. يجيب من هذه الصفحة ببنية ثابتة. لا نموذج خارجي.' },
    close:      { en: 'Close the assistant',  ar: 'إغلاق المساعد' },
    convo:      { en: 'Conversation',         ar: 'المحادثة' },
    placeholder:{ en: 'Ask about the platform, the agents or your privacy…',
                  ar: 'اسأل عن المنصة أو الوكلاء أو خصوصيتك…' },
    inputLabel: { en: 'Ask the mission assistant', ar: 'اسأل مساعد المهمة' },
    send:       { en: 'Ask',                  ar: 'اسأل' },
    working:    { en: 'Working',              ar: 'جارٍ العمل' },
    showMe:     { en: 'Show me',              ar: 'اعرض لي' },
    openSection:{ en: 'Open that section',    ar: 'فتح هذا القسم' },
    openAnalyst:{ en: 'Open the analyst',     ar: 'فتح المحلّل' },
    openAnalystSrc: { en: 'Open the analyst, with its sources',
                      ar: 'فتح المحلّل مع مصادره' },
    greetTitle: { en: 'Mission assistant',    ar: 'مساعد المهمة' },
    fromAnalyst:{ en: 'From the KuwaitSat analyst', ar: 'من محلّل KuwaitSat' },
    confidence: { en: 'Analyst confidence',   ar: 'ثقة المحلّل' },
    srcRegister:{ en: 'Sources register',     ar: 'سجل المصادر' }
  };

  /* ===================================================================
     4 · THE KNOWLEDGE BASE

     Written, not generated. Each entry carries the words a person would
     actually use - in both languages, because a question typed in Arabic
     that fell through to "I have no grounded answer" was indistinguishable
     from a question we genuinely cannot answer - and an answer that is
     true of THIS build.

     SHAPE
       k    English trigger phrases, matched against the lowercased
            question. Longer phrase, stronger signal.
       ka   Arabic trigger phrases, matched the same way.
       t    The heading of the answer.
       q    The question restated in the canonical form the entry
            actually answers, so the researcher can see whether they
            were understood.
       rows The seven fields. Each carries its own provenance key, and
            `src` where a claim genuinely comes from the numbered
            SOURCES register in index.html.
       see  A section the assistant can offer to take you to.
     =================================================================== */

  var KB = [
    {
      k: ['what is this', 'what is kuwaitsat', 'about', 'what does this do', 'purpose', 'explain the site', 'what am i looking at'],
      ka: ['ما هذه المنصة', 'ما هذا الموقع', 'عن المنصة', 'ماذا تفعل', 'الغرض', 'ما الذي أنظر إليه'],
      t: { en: 'What this platform is', ar: 'ما هذه المنصة' },
      q: { en: 'What is this platform, and what does it actually do?',
           ar: 'ما هذه المنصة، وما الذي تفعله فعلياً؟' },
      see: 'mission',
      rows: [
        { id: 'data', prov: 'platform',
          en: 'The platform’s own description of itself: its sections, and the route a mission takes through them. No dataset is read to answer this.',
          ar: 'وصف المنصة لنفسها: أقسامها، والمسار الذي تسلكه المهمة عبرها. لم تُقرأ أي مجموعة بيانات للإجابة على هذا.' },
        { id: 'method', prov: 'platform',
          en: 'A written entry from the assistant’s knowledge base, composed against this build by hand. Nothing here is produced by a language model.',
          ar: 'مدخل مكتوب من قاعدة معرفة المساعد، حُرِّر يدوياً مقابل هذه النسخة. لا شيء هنا ناتج عن نموذج لغوي.' },
        { id: 'analysis', prov: 'platform',
          en: 'KuwaitSat-1 Mission Hub turns what the satellite sees into something a planner can act on.\nA researcher states an objective and an area; a pipeline of agents collects the imagery, analyses vegetation and surface heat, ranks candidate zones, projects the likely effect of greening each one, and drafts a report.',
          ar: 'تحوّل منصة KuwaitSat-1 ما يراه القمر الصناعي إلى ما يمكن لمخطِّط أن يتصرف بناءً عليه.\nيحدّد الباحث هدفاً ومنطقة؛ ثم يجمع مسار من الوكلاء الصور، ويحلّل الغطاء النباتي وحرارة السطح، ويرتّب المناطق المرشّحة، ويقدّر الأثر المرجّح لتشجير كل منها، ويصوغ تقريراً.' },
        { id: 'result', prov: 'platform',
          en: 'A person approves that report before it exists. Every figure on the site names where it came from.',
          ar: 'يعتمد شخصٌ ذلك التقرير قبل أن يوجد. وكل رقم على الموقع يذكر من أين جاء.' },
        { id: 'limits', prov: 'platform',
          en: 'This describes the platform, not the state of any governorate. For the environmental figures themselves, the analyst in the AI section reads the reference dataset and states its own confidence.',
          ar: 'هذا وصف للمنصة، لا لحالة أي محافظة. أما الأرقام البيئية نفسها فيقرأها المحلّل في قسم الذكاء الاصطناعي من مجموعة البيانات المرجعية ويذكر درجة ثقته.' },
        { id: 'sources', prov: 'platform',
          en: 'Not applicable, this answer describes the platform itself and makes no measured claim. The numbered primary sources behind the mission facts are in the Sources register.',
          ar: 'لا ينطبق, هذه الإجابة تصف المنصة نفسها ولا تتضمن أي ادعاء مقاس. والمصادر الأولية المرقّمة خلف حقائق المهمة موجودة في سجل المصادر.' }
      ]
    },
    {
      k: ['real data', 'is the data real', 'fake', 'made up', 'where do the numbers come from', 'provenance', 'badge', 'measured', 'modelled', 'source'],
      ka: ['من أين تأتي الأرقام', 'هل البيانات حقيقية', 'المصدر', 'مقاس', 'منمذج', 'الشارة', 'البيانات حقيقية'],
      t: { en: 'Where the numbers come from', ar: 'من أين تأتي الأرقام' },
      q: { en: 'Where does each number on this page come from, and which of them are measured?',
           ar: 'من أين يأتي كل رقم على هذه الصفحة، وأيّها مقاس فعلاً؟' },
      see: 'legend',
      rows: [
        { id: 'data', prov: 'platform',
          en: 'The four marks the page puts on every figure it draws.\n🛰 MISSION RECORD, published, attributable fact about KuwaitSat-1. The source is always linked.\n▦ REFERENCE DATASET, thirty-six monthly records per governorate, modelled on published Kuwaiti climate and land-cover patterns.\n◈ MODELLED, produced by the platform’s environmental model. Physically consistent, derived rather than measured.\n⬡ DERIVED ANALYSIS, an interpretation by the analyst in this page. Decision support, never a decision.',
          ar: 'العلامات الأربع التي تضعها الصفحة على كل رقم ترسمه.\n🛰 سجل المهمة, حقيقة منشورة ومنسوبة عن KuwaitSat-1، ومصدرها مرتبط دائماً.\n▦ مجموعة بيانات مرجعية, ستة وثلاثون سجلاً شهرياً لكل محافظة، مُنمذَجة على أنماط المناخ والغطاء الأرضي الكويتية المنشورة.\n◈ مُنمذَج, ناتج عن النموذج البيئي للمنصة. متّسق فيزيائياً، مُشتق لا مقاس.\n⬡ تحليل مُشتق, تفسير من المحلّل في هذه الصفحة. دعم للقرار، لا قرار.' },
        { id: 'method', prov: 'platform',
          en: 'The mark is attached to the figure, not to the page, and is written at the moment the panel renders. A panel that mixes classes therefore shows more than one mark rather than averaging them into a single reassuring label.',
          ar: 'ترتبط العلامة بالرقم لا بالصفحة، وتُكتب لحظة رسم اللوحة. ولذلك تُظهر اللوحة التي تمزج أصنافاً أكثر من علامة واحدة بدل دمجها في تسمية واحدة مطمئنة.' },
        { id: 'analysis', prov: 'platform',
          en: 'The satellite facts are real and cited. The environmental figures are modelled, and every panel that shows one says so.',
          ar: 'حقائق القمر الصناعي حقيقية ومُستشهد بها. أما الأرقام البيئية فمُنمذَجة، وكل لوحة تعرض واحداً منها تقول ذلك.' },
        { id: 'result', prov: 'platform',
          en: 'When calibrated feeds are connected, those panels change and the marks change with them.',
          ar: 'عند توصيل تغذيات معايَرة تتغير تلك اللوحات وتتغير العلامات معها.' },
        { id: 'limits', prov: 'platform',
          en: 'A mark states the class of a figure, not its accuracy. ▦ and ◈ figures are physically consistent but they are not observations, and no uncertainty is published for them here because none has been measured.',
          ar: 'تذكر العلامة صنف الرقم لا دقته. أرقام ▦ و◈ متّسقة فيزيائياً لكنها ليست أرصاداً، ولا يُنشر لها هنا أي مقدار لعدم اليقين لأنه لم يُقَس.' },
        { id: 'sources', prov: 'record', src: [0, 2, 3],
          en: 'The satellite facts these marks apply to come from the numbered register. The mission characteristics quoted most often across the site are these three. The modelled figures come from no source outside this page, which is why they carry a different mark.',
          ar: 'حقائق القمر الصناعي التي تنطبق عليها هذه العلامات مأخوذة من السجل المرقّم، وأكثر خصائص المهمة اقتباساً عبر الموقع هي هذه الثلاثة. أما الأرقام المُنمذَجة فلا مصدر لها خارج هذه الصفحة، ولذلك تحمل علامة مختلفة.' }
      ]
    },
    {
      k: ['who can see', 'privacy', 'colleague', 'other researcher', 'my missions', 'can anyone see', 'isolation', 'rls', 'row level'],
      ka: ['من يستطيع رؤية', 'الخصوصية', 'زميل', 'مهماتي', 'عزل البيانات', 'أمن الصفوف'],
      t: { en: 'Who can see your work', ar: 'من يستطيع رؤية عملك' },
      q: { en: 'Who else can see my missions, my runs and my results?',
           ar: 'من غيري يستطيع رؤية مهماتي وتشغيلاتي ونتائجي؟' },
      see: 'trust',
      rows: [
        { id: 'data', prov: 'platform',
          en: 'The row-level security policies and the table grants as they are deployed on this database, not as they are described in a document.',
          ar: 'سياسات أمن الصفوف وصلاحيات الجداول كما هي منشورة على قاعدة البيانات هذه، لا كما تصفها وثيقة.' },
        { id: 'method', prov: 'platform',
          en: 'Isolation is enforced inside Postgres. Every policy is keyed to the account identifier carried in your signed session token, and it is evaluated on the server for every statement.',
          ar: 'يُفرَض العزل داخل Postgres. وكل سياسة مربوطة بمعرّف الحساب المحمول في رمز جلستك الموقّعة، وتُقيَّم على الخادم مع كل عبارة.' },
        { id: 'analysis', prov: 'platform',
          en: 'Nobody but you. Not your colleagues, not the agents, not an administrator through this site.\nYour missions, runs, agent steps, results and reports are filtered in the database by row-level security, keyed to the account in your signed session. It is not the page choosing what to draw, the database refuses to return the rows at all.',
          ar: 'لا أحد سواك. لا زملاؤك، ولا الوكلاء، ولا مسؤول عبر هذا الموقع.\nتُرشَّح مهماتك وتشغيلاتك وخطوات الوكلاء ونتائجك وتقاريرك داخل قاعدة البيانات بأمن الصفوف، مربوطةً بالحساب في جلستك الموقّعة. ليست الصفحة هي التي تختار ما ترسمه, بل قاعدة البيانات ترفض إعادة الصفوف أصلاً.' },
        { id: 'result', prov: 'platform',
          en: 'Tested rather than claimed: a researcher asking for a colleague’s mission by its exact primary key gets zero rows back, and the anonymous role holds no grant on any table, view or function.',
          ar: 'مُختبَر لا مُدّعى: باحث يطلب مهمة زميله بمفتاحها الأساسي بالضبط يستعيد صفراً من الصفوف، ولا يملك الدور المجهول أي صلاحية على أي جدول أو عرض أو دالة.' },
        { id: 'limits', prov: 'platform',
          en: 'This covers what this platform will return to a browser. It says nothing about what the database provider can see on its own infrastructure, and it cannot protect anything you paste into a third-party tool yourself.',
          ar: 'يغطي هذا ما تعيده هذه المنصة إلى المتصفح. ولا يقول شيئاً عمّا يمكن لمزوّد قاعدة البيانات رؤيته على بنيته التحتية، ولا يحمي شيئاً تلصقه أنت في أداة خارجية.' },
        { id: 'sources', prov: 'platform',
          en: 'Not applicable, this describes the platform’s own configuration. The governance section carries the checks and what each one returned.',
          ar: 'لا ينطبق, هذا وصف لإعدادات المنصة نفسها. ويحمل قسم الحوكمة الفحوص وما أعاده كل فحص منها.' }
      ]
    },
    {
      k: ['agent', 'workflow', 'pipeline', 'how do the agents work', 'automation', 'steps'],
      ka: ['الوكلاء', 'سير العمل', 'الأتمتة', 'كيف يعمل الوكلاء', 'الخطوات', 'كيف يصل الوكلاء'],
      t: { en: 'How the agent workflow runs', ar: 'كيف يعمل مسار الوكلاء' },
      q: { en: 'How do the agents work, and where is the decision that actually depends on the data?',
           ar: 'كيف يعمل الوكلاء، وأين القرار الذي يعتمد فعلاً على البيانات؟' },
      see: 'agent',
      rows: [
        { id: 'data', prov: 'platform',
          en: 'The deployed workflow definition and the limits this build enforces: a projected cover-uplift floor of {floor}, at most {reranks} re-rankings, and a step budget of {budget} enforced in the database rather than only in the browser.',
          ar: 'تعريف سير العمل المنشور والحدود التي تفرضها هذه النسخة: أرضية ارتفاع غطاء متوقّعة قدرها {floor}، وبحد أقصى {reranks} من إعادات الترتيب، وميزانية خطوات قدرها {budget} تُفرَض في قاعدة البيانات لا في المتصفح وحده.' },
        { id: 'method', prov: 'platform',
          en: 'Six stages in order. Stage four is a real branch: the outcome depends on the number the analysis produced, not on what was requested.',
          ar: 'ست مراحل بالترتيب. المرحلة الرابعة تفرّع حقيقي: النتيجة تتوقف على الرقم الذي أنتجه التحليل لا على ما طُلب.' },
        { id: 'analysis', prov: 'platform',
          en: '1 · You state an objective and an area, and press Launch Mission.\n2 · The data collection agent delineates candidate zones on the 39 m grid.\n3 · Environmental analysis ranks them by observed stress.\n4 · THE DECISION. Each zone is checked against a projected cover-uplift floor. Below the floor the zone is REJECTED, a re-ranking subroutine drops it, and the next candidate comes forward, at most {reranks} times.\n5 · The accepted zone is written to the map.\n6 · A report is drafted, and stops, awaiting your approval.',
          ar: '١ · تحدّد هدفاً ومنطقة وتضغط إطلاق المهمة.\n٢ · يرسم وكيل جمع البيانات المناطق المرشّحة على شبكة ٣٩ متراً.\n٣ · يرتّبها التحليل البيئي حسب الإجهاد المرصود.\n٤ · القرار. تُقاس كل منطقة مقابل أرضية ارتفاع الغطاء المتوقّعة. ودون الأرضية تُرفَض المنطقة، ويُسقطها روتين إعادة الترتيب، ويتقدّم المرشّح التالي, بحد أقصى {reranks} مرات.\n٥ · تُكتب المنطقة المقبولة على الخريطة.\n٦ · يُصاغ تقرير, ثم يتوقف بانتظار اعتمادك.' },
        { id: 'result', prov: 'platform',
          en: 'Every pass is written to the audit trail, including every refusal and the number that caused it. The highest-ranked zone is often not the one that reaches the map, and that is the point.',
          ar: 'تُكتب كل دورة في سجل التدقيق، بما في ذلك كل رفض والرقم الذي سبّبه. وكثيراً ما لا تكون المنطقة الأعلى ترتيباً هي التي تصل إلى الخريطة، وهذا هو المقصود.' },
        { id: 'limits', prov: 'platform',
          en: 'The floor and the re-ranking limit are configuration: a different deployment can hold different values, and the numbers above are read from this one at the moment you asked. The ranking itself runs over the reference dataset, so it is a screening order and not a survey.',
          ar: 'الأرضية وحد إعادة الترتيب إعدادات: يمكن لنسخة أخرى أن تحمل قيماً مختلفة، والأرقام أعلاه مقروءة من هذه النسخة لحظة سؤالك. ويجري الترتيب نفسه على مجموعة البيانات المرجعية، فهو ترتيب فرز لا مسح ميداني.' },
        { id: 'sources', prov: 'platform',
          en: 'Not applicable, this describes the platform’s own workflow. The 39 m grid it works on is a published mission characteristic and is cited in the Sources register.',
          ar: 'لا ينطبق, هذا وصف لسير عمل المنصة نفسها. أما شبكة ٣٩ متراً التي تعمل عليها فخاصية منشورة من خصائص المهمة ومُستشهد بها في سجل المصادر.' }
      ]
    },
    {
      k: ['checkpoint', 'approve', 'approval', 'human in the loop', 'report agent', 'who signs'],
      ka: ['نقطة الاعتماد', 'الاعتماد', 'الموافقة', 'تدخل بشري', 'من يوقّع'],
      t: { en: 'The human checkpoint', ar: 'نقطة الاعتماد البشرية' },
      q: { en: 'What does the approval checkpoint actually protect?',
           ar: 'ما الذي تحميه نقطة الاعتماد فعلياً؟' },
      see: 'agent',
      rows: [
        { id: 'data', prov: 'platform',
          en: 'The report function’s grants, and the approver recorded against every report this platform has written.',
          ar: 'صلاحيات دالة التقرير، والمعتمِد المسجَّل مقابل كل تقرير كتبته هذه المنصة.' },
        { id: 'method', prov: 'platform',
          en: 'The approver is taken from the verified session on the server side at the moment the report is written. The browser is not asked who is approving, so it cannot answer wrongly.',
          ar: 'يُؤخَذ المعتمِد من الجلسة المُتحقَّق منها على الخادم لحظة كتابة التقرير. ولا يُسأل المتصفح عمّن يعتمد، فلا يستطيع أن يجيب خطأً.' },
        { id: 'analysis', prov: 'platform',
          en: 'No report exists without a named, signed-in person who owns that mission.\nWhen the agents finish, the workflow pauses and shows the draft with an Approve control. The report is written only when a person presses it, and the approver recorded against it is taken from the verified session, it cannot be pointed at somebody else.',
          ar: 'لا يوجد تقرير دون شخص مُسمّى ومسجَّل الدخول يملك تلك المهمة.\nعند انتهاء الوكلاء يتوقف سير العمل ويعرض المسودة مع زر اعتماد. ولا يُكتب التقرير إلا حين يضغطه شخص، والمعتمِد المسجَّل مقابله مأخوذ من الجلسة المُتحقَّق منها, ولا يمكن توجيهه إلى شخص آخر.' },
        { id: 'result', prov: 'platform',
          en: 'The part that genuinely cannot happen: the automation engine is refused the report function outright. An unattended pipeline cannot sign its own conclusion, which is the whole reason a checkpoint exists in an AI system.',
          ar: 'الجزء الذي لا يمكن حدوثه فعلاً: يُمنع محرّك الأتمتة من دالة التقرير منعاً تاماً. فلا يستطيع مسار غير مراقَب أن يوقّع استنتاجه بنفسه، وهذا هو سبب وجود نقطة الاعتماد في نظام ذكاء اصطناعي.' },
        { id: 'limits', prov: 'platform',
          en: 'The checkpoint proves that a named person approved a draft. It does not prove that they read it, and no software can. It is an accountability record, not a quality guarantee.',
          ar: 'تُثبت نقطة الاعتماد أن شخصاً مُسمّى اعتمد مسودة. ولا تثبت أنه قرأها، ولا يستطيع ذلك أي برنامج. فهي سجل مساءلة لا ضمان جودة.' },
        { id: 'sources', prov: 'platform',
          en: 'Not applicable, this describes the platform’s own guardrail.',
          ar: 'لا ينطبق, هذا وصف لضابط الأمان في المنصة نفسها.' }
      ]
    },
    {
      k: ['password', 'stored', 'sign in', 'login', 'account', 'authentication', 'secure my account'],
      ka: ['كلمة المرور', 'تسجيل الدخول', 'الحساب', 'المصادقة'],
      t: { en: 'Passwords and sign-in', ar: 'كلمات المرور وتسجيل الدخول' },
      q: { en: 'What happens to my password, and what does the key in the page grant?',
           ar: 'ماذا يحدث لكلمة مروري، وما الذي يمنحه المفتاح الموجود في الصفحة؟' },
      see: 'trust',
      rows: [
        { id: 'data', prov: 'platform',
          en: 'The schema of every table this project owns, and the capabilities of the publishable key that ships inside the page.',
          ar: 'مخطط كل جدول يملكه هذا المشروع، وقدرات المفتاح القابل للنشر المشحون داخل الصفحة.' },
        { id: 'method', prov: 'platform',
          en: 'Authentication is delegated to Supabase Auth. The page exchanges credentials for a short-lived session token and never handles the secret itself.',
          ar: 'تُفوَّض المصادقة إلى Supabase Auth. تستبدل الصفحة بيانات الاعتماد برمز جلسة قصير العمر ولا تتعامل مع السر نفسه إطلاقاً.' },
        { id: 'analysis', prov: 'platform',
          en: 'This platform never sees your password and has nowhere to put one, there is no password column in any table we own.\nAuthentication is handled by Supabase Auth: your password is hashed with bcrypt on their side, and this page receives only a short-lived session token.',
          ar: 'لا ترى هذه المنصة كلمة مرورك ولا مكان لديها لوضعها, لا يوجد عمود لكلمة المرور في أي جدول نملكه.\nتتولّى Supabase Auth المصادقة: تُجزَّأ كلمة مرورك بخوارزمية bcrypt لديهم، ولا تستقبل هذه الصفحة سوى رمز جلسة قصير العمر.' },
        { id: 'result', prov: 'platform',
          en: 'The key that ships in the page is a publishable key, which grants nothing on its own, every table, view and function refuses it.',
          ar: 'المفتاح المشحون في الصفحة مفتاح قابل للنشر، ولا يمنح شيئاً بذاته, فكل جدول وعرض ودالة يرفضه.' },
        { id: 'limits', prov: 'platform',
          en: 'This covers what the platform stores. It cannot protect an account whose password is reused elsewhere, and it makes no claim about the provider’s own internal handling.',
          ar: 'يغطي هذا ما تخزّنه المنصة. ولا يحمي حساباً أُعيد استخدام كلمة مروره في مكان آخر، ولا يدّعي شيئاً عن المعالجة الداخلية لدى المزوّد.' },
        { id: 'sources', prov: 'platform',
          en: 'Not applicable, this describes the platform’s own authentication arrangement.',
          ar: 'لا ينطبق, هذا وصف لترتيب المصادقة في المنصة نفسها.' }
      ]
    },
    {
      k: ['security', 'how secure', 'protection', 'headers', 'csp', 'hack', 'attack', 'safe'],
      ka: ['الأمن', 'مدى الأمان', 'الحماية', 'الترويسات', 'اختراق', 'هجوم', 'آمن'],
      t: { en: 'The security posture', ar: 'الوضع الأمني' },
      q: { en: 'How is this platform protected, and what is still open?',
           ar: 'كيف تُحمى هذه المنصة، وما الذي لا يزال مفتوحاً؟' },
      see: 'trust',
      rows: [
        { id: 'data', prov: 'platform',
          en: 'The deployed policies and grants, the response headers the live site actually returns, and the results of thirty-six automated checks run against it.',
          ar: 'السياسات والصلاحيات المنشورة، وترويسات الاستجابة التي يعيدها الموقع الحيّ فعلاً، ونتائج ستة وثلاثين فحصاً آلياً جرت عليه.' },
        { id: 'method', prov: 'platform',
          en: 'The checks run as an anonymous visitor against the live system. They try the door rather than asking whether it is locked.',
          ar: 'تجري الفحوص بصفة زائر مجهول على النظام الحيّ. فهي تجرّب الباب بدل أن تسأل هل هو مقفل.' },
        { id: 'analysis', prov: 'platform',
          en: 'The short version: the database decides, not the page.\n· Row-level security on every table, and column-level grants on top, the anonymous role holds nothing.\n· Every write goes through a function that re-reads ownership inside the transaction rather than trusting what the browser sent.\n· Real response headers: HSTS, a content security policy with frame-ancestors, object-src and base-uri all set to none, nosniff, a referrer policy, and a permissions policy denying camera, microphone and location.',
          ar: 'الخلاصة: قاعدة البيانات هي التي تقرّر، لا الصفحة.\n· أمن صفوف على كل جدول، وصلاحيات على مستوى الأعمدة فوقه, ولا يملك الدور المجهول شيئاً.\n· تمرّ كل عملية كتابة عبر دالة تعيد قراءة الملكية داخل المعاملة بدل الوثوق بما أرسله المتصفح.\n· ترويسات استجابة حقيقية: HSTS، وسياسة محتوى بـ frame-ancestors وobject-src وbase-uri مضبوطة كلها على none، وnosniff، وسياسة مُحيل، وسياسة صلاحيات تمنع الكاميرا والميكروفون والموقع.' },
        { id: 'result', prov: 'platform',
          en: 'Thirty-six automated checks run against the live system as an anonymous visitor, and they pass.',
          ar: 'ستة وثلاثون فحصاً آلياً تجري على النظام الحيّ بصفة زائر مجهول، وتنجح.' },
        { id: 'limits', prov: 'platform',
          en: 'One gap is documented rather than hidden: the policy still allows inline script, because the page contains twenty-seven inline blocks and a strict policy would blank it. The write-up says exactly how that closes.',
          ar: 'ثغرة واحدة موثّقة لا مخفية: لا تزال السياسة تسمح بالنصوص البرمجية المضمّنة، لأن الصفحة تحوي سبعة وعشرين كتلة مضمّنة ولأن سياسة صارمة ستُفرغها. ويشرح التوثيق بدقة كيف تُغلق.' },
        { id: 'sources', prov: 'platform',
          en: 'Not applicable, this describes the platform’s own configuration and its own test results.',
          ar: 'لا ينطبق, هذا وصف لإعدادات المنصة نفسها ونتائج اختباراتها.' }
      ]
    },
    {
      k: ['run a mission', 'how do i start', 'launch', 'get started', 'new mission', 'use the console'],
      ka: ['كيف أشغّل مهمة', 'كيف أبدأ', 'إطلاق مهمة', 'مهمة جديدة', 'وحدة التحكم'],
      t: { en: 'Running a mission', ar: 'تشغيل مهمة' },
      q: { en: 'How do I run a mission from start to report?',
           ar: 'كيف أشغّل مهمة من البداية حتى التقرير؟' },
      see: 'console',
      rows: [
        { id: 'data', prov: 'platform',
          en: 'The controls the research console exposes: objective, area, period, and the two thresholds.',
          ar: 'الأدوات التي تعرضها وحدة البحث: الهدف، والمنطقة، والفترة، والعتبتان.' },
        { id: 'method', prov: 'platform',
          en: 'A navigational answer. It describes the sequence of controls, not a computation.',
          ar: 'إجابة إرشادية. تصف تسلسل الأدوات لا عملية حسابية.' },
        { id: 'analysis', prov: 'platform',
          en: 'Sign in, open the research console, state what you are trying to find out, choose the area and the period, and press Launch Mission.\nYou will see each agent report as it goes, including the zones it refuses and why.',
          ar: 'سجّل الدخول، وافتح وحدة البحث، وحدّد ما تحاول معرفته، واختر المنطقة والفترة، ثم اضغط إطلاق المهمة.\nسترى تقرير كل وكيل أولاً بأول، بما في ذلك المناطق التي يرفضها وسبب الرفض.' },
        { id: 'result', prov: 'platform',
          en: 'At the end the draft report waits for your approval. Nothing is written under your name until you give it.',
          ar: 'وفي النهاية تنتظر مسودة التقرير اعتمادك. ولا يُكتب شيء باسمك حتى تمنحه.' },
        { id: 'limits', prov: 'platform',
          en: 'Not applicable to the data, this is a navigational answer. What a run produces depends on the area and thresholds you choose, and on the reference dataset behind them.',
          ar: 'لا ينطبق على البيانات, هذه إجابة إرشادية. وما تنتجه أي تشغيلة يتوقف على المنطقة والعتبات التي تختارها وعلى مجموعة البيانات المرجعية خلفها.' },
        { id: 'sources', prov: 'platform',
          en: 'Not applicable, this is a navigational answer about the platform’s own controls.',
          ar: 'لا ينطبق, هذه إجابة إرشادية عن أدوات المنصة نفسها.' }
      ]
    },
    {
      k: ['public', 'outsider', 'insider', 'why is this hidden', 'sign in to see', 'locked', 'tier'],
      ka: ['لماذا تطلب تسجيل الدخول', 'مقفل', 'مخفي', 'عام', 'لماذا هذا مخفي'],
      t: { en: 'Why some panels ask you to sign in', ar: 'لماذا تطلب بعض اللوحات تسجيل الدخول' },
      q: { en: 'Why are some panels behind sign-in, and what is being withheld?',
           ar: 'لماذا بعض اللوحات خلف تسجيل الدخول، وما الذي يُحجب؟' },
      see: 'legend',
      rows: [
        { id: 'data', prov: 'platform',
          en: 'Which sections draw rows that belong to an account, and which draw the published record.',
          ar: 'أي الأقسام يرسم صفوفاً تخص حساباً، وأيّها يرسم السجل المنشور.' },
        { id: 'method', prov: 'platform',
          en: 'The split follows ownership, not sensitivity: a panel is gated when the rows it would draw live behind row-level security in the database.',
          ar: 'يتبع الفصل الملكية لا الحساسية: تُغلَق اللوحة حين تكون الصفوف التي سترسمها محميةً بأمن الصفوف في قاعدة البيانات.' },
        { id: 'analysis', prov: 'platform',
          en: 'Nothing is hidden for secrecy.\nThe panels behind sign-in are the ones that PRODUCE work, a mission, a run, a scored recommendation. They are where a signed-in researcher’s own rows are drawn, and those rows live in the database behind row-level security. They were never in this page to begin with, so unlocking the panel in your browser would show you empty instruments.',
          ar: 'لا شيء مخفي بدافع السرية.\nاللوحات خلف تسجيل الدخول هي التي تُنتج عملاً, مهمة، أو تشغيلة، أو توصية مُقيَّمة. وهي المكان الذي تُرسم فيه صفوف الباحث المسجَّل نفسه، وتلك الصفوف تقيم في قاعدة البيانات خلف أمن الصفوف. ولم تكن في هذه الصفحة أصلاً، ولذلك فإن فتح اللوحة في متصفحك سيُظهر لك أجهزة فارغة.' },
        { id: 'result', prov: 'platform',
          en: 'Everything that explains, evidences or attributes the work is public: the mission record, the imagery story, the governance pages, the team behind KuwaitSat-1 and every source.',
          ar: 'وكل ما يشرح العمل أو يوثّقه أو ينسبه فهو عام: سجل المهمة، وقصة الصور، وصفحات الحوكمة، والفريق وراء KuwaitSat-1، وكل مصدر.' },
        { id: 'limits', prov: 'platform',
          en: 'Not applicable to the data, this is a navigational answer about how the page is arranged.',
          ar: 'لا ينطبق على البيانات, هذه إجابة إرشادية عن كيفية ترتيب الصفحة.' },
        { id: 'sources', prov: 'platform',
          en: 'Not applicable, this describes the platform’s own arrangement.',
          ar: 'لا ينطبق, هذا وصف لترتيب المنصة نفسها.' }
      ]
    },
    {
      /* 'team' still routes here on purpose. The section it opens,
         #builders, is "The Team Behind KuwaitSat-1" and is very much
         still in the page - it is the capstone's own team section that
         was removed, and nothing here points at it. */
      k: ['who built', 'team', 'authors', 'students', 'credit'],
      ka: ['من بنى', 'الفريق', 'من صنع', 'المؤلفون'],
      t: { en: 'Who built this', ar: 'من بنى هذا' },
      q: { en: 'Who built this platform, and who built the satellite?',
           ar: 'من بنى هذه المنصة، ومن بنى القمر الصناعي؟' },
      see: 'builders',
      rows: [
        { id: 'data', prov: 'record', src: [0, 6],
          en: 'The published attribution of the KuwaitSat-1 project, and the ownership split this project’s own team agreed.',
          ar: 'النسبة المنشورة لمشروع KuwaitSat-1، وتقسيم الملكية الذي اتفق عليه فريق هذا المشروع.' },
        { id: 'method', prov: 'platform',
          en: 'Attribution, not analysis. The satellite half is quoted from the numbered sources; the platform half is a statement about this repository.',
          ar: 'نسبة لا تحليل. فالشق الخاص بالقمر الصناعي مقتبس من المصادر المرقّمة؛ أما شق المنصة فهو تصريح عن هذا المستودع.' },
        { id: 'analysis', prov: 'platform',
          en: 'A four-person team, each owning one part: front end, back end, AI agents and automation, and security.',
          ar: 'فريق من أربعة أشخاص، يملك كل منهم جزءاً: الواجهة الأمامية، والواجهة الخلفية، ووكلاء الذكاء الاصطناعي والأتمتة، والأمن.' },
        { id: 'result', prov: 'record', src: [0, 6],
          en: 'The KuwaitSat-1 satellite itself is the work of the project team at Kuwait University with the Kuwait Foundation for the Advancement of Sciences, they built it, and this platform only looks at what it sees.',
          ar: 'أما القمر الصناعي KuwaitSat-1 نفسه فهو عمل فريق المشروع في جامعة الكويت مع مؤسسة الكويت للتقدم العلمي, هم بنوه، وهذه المنصة تنظر فقط إلى ما يراه.' },
        { id: 'limits', prov: 'platform',
          en: 'This platform is a student capstone and is not affiliated with the KuwaitSat-1 project team. Nothing here should be read as an official mission product.',
          ar: 'هذه المنصة مشروع تخرّج طلابي وليست تابعة لفريق مشروع KuwaitSat-1. ولا ينبغي قراءة أي شيء هنا بوصفه مُنتَجاً رسمياً للمهمة.' },
        { id: 'sources', prov: 'record', src: [0, 6],
          en: 'The satellite’s attribution is taken from the numbered register.',
          ar: 'نسبة القمر الصناعي مأخوذة من السجل المرقّم.' }
      ]
    },
    {
      k: ['3d', 'orbit', 'globe', 'satellite path', 'where is the satellite'],
      ka: ['المدار', 'الكرة الأرضية', 'مسار القمر', 'أين القمر الصناعي'],
      t: { en: 'The orbit view', ar: 'عرض المدار' },
      q: { en: 'Is the 3D orbit view live telemetry?',
           ar: 'هل عرض المدار ثلاثي الأبعاد بيانات حيّة؟' },
      see: 'globe',
      rows: [
        { id: 'data', prov: 'modelled',
          en: 'A circular two-body orbit at a fixed inclination, computed in the browser. There is no tracking feed behind it.',
          ar: 'مدار دائري بجسمين عند ميل ثابت، يُحسب داخل المتصفح. ولا توجد خلفه أي تغذية تتبّع.' },
        { id: 'method', prov: 'modelled',
          en: 'The path is integrated from the two-body model at draw time. The readout beside it quotes published mission figures instead of computed ones.',
          ar: 'يُشتق المسار من نموذج الجسمين لحظة الرسم. أما القراءة بجانبه فتقتبس أرقام المهمة المنشورة بدل الأرقام المحسوبة.' },
        { id: 'analysis', prov: 'derived',
          en: 'The 3D orbit view draws KuwaitSat-1’s path from a circular two-body model at a fixed inclination. It is marked as modelled rather than live telemetry, because that is what it is, the platform does not carry a live tracking feed.',
          ar: 'يرسم عرض المدار ثلاثي الأبعاد مسار KuwaitSat-1 من نموذج جسمين دائري عند ميل ثابت. وهو موسوم بأنه مُنمذَج لا بيانات حيّة، لأن هذا ما هو عليه, فالمنصة لا تحمل تغذية تتبّع حيّة.' },
        { id: 'result', prov: 'record', src: [2, 3, 4],
          en: 'Altitude, ground sample distance and swath in the readout are the published mission figures, 39 m ground sample distance and roughly 80 km per frame.',
          ar: 'أما الارتفاع ومسافة العيّنة الأرضية وعرض المسح في القراءة فهي أرقام المهمة المنشورة, ٣٩ متراً لمسافة العيّنة الأرضية ونحو ٨٠ كيلومتراً لكل إطار.' },
        { id: 'limits', prov: 'platform',
          en: 'The drawn path is illustrative. It is not propagated from a two-line element set, it is not corrected for drag or for the oblateness of the Earth, and it must not be used to predict a pass.',
          ar: 'المسار المرسوم توضيحي. فهو غير مُستنتَج من مجموعة عناصر ثنائية السطر، وغير مُصحَّح للسحب أو لتفلطح الأرض، ولا يجوز استخدامه للتنبؤ بمرور.' },
        { id: 'sources', prov: 'record', src: [2, 3, 4],
          en: 'The mission figures quoted in the readout come from the numbered register.',
          ar: 'أرقام المهمة المقتبسة في القراءة مأخوذة من السجل المرقّم.' }
      ]
    },
    {
      k: ['report', 'download', 'export', 'pdf', 'get the report'],
      ka: ['التقرير', 'تنزيل', 'تصدير', 'الحصول على التقرير'],
      t: { en: 'Reports', ar: 'التقارير' },
      q: { en: 'What is in a report, and can a figure in it be traced?',
           ar: 'ماذا يحوي التقرير، وهل يمكن تتبّع رقم فيه؟' },
      see: 'agent',
      rows: [
        { id: 'data', prov: 'platform',
          en: 'The run identifier, the agent step identifiers, and the provenance mark carried by each figure in the draft.',
          ar: 'معرّف التشغيلة، ومعرّفات خطوات الوكلاء، وعلامة المصدر التي يحملها كل رقم في المسودة.' },
        { id: 'method', prov: 'platform',
          en: 'The report is assembled from the audit trail rather than from the screen, so a figure in it points back to the step that produced it.',
          ar: 'يُجمَّع التقرير من سجل التدقيق لا من الشاشة، فيشير كل رقم فيه إلى الخطوة التي أنتجته.' },
        { id: 'analysis', prov: 'platform',
          en: 'A report is produced only after you approve the draft. It carries a provenance mark on every figure, the run identifier that produced it, and the identifiers of the agent steps behind it, including the zones that were rejected and the numbers that rejected them.',
          ar: 'لا يُنتَج التقرير إلا بعد اعتمادك للمسودة. ويحمل علامة مصدر على كل رقم، ومعرّف التشغيلة التي أنتجته، ومعرّفات خطوات الوكلاء خلفه, بما في ذلك المناطق التي رُفضت والأرقام التي رفضتها.' },
        { id: 'result', prov: 'platform',
          en: 'Anyone reading it can trace any figure back to the step that made it.',
          ar: 'ويستطيع أي قارئ له أن يتتبّع أي رقم رجوعاً إلى الخطوة التي صنعته.' },
        { id: 'limits', prov: 'platform',
          en: 'Traceability is not validity. A report carries modelled figures where the platform has only modelled figures, and it says so on each one rather than promoting them on the way to the conclusion.',
          ar: 'قابلية التتبّع ليست صحّة. فالتقرير يحمل أرقاماً مُنمذَجة حيث لا تملك المنصة سواها، ويقول ذلك على كل رقم بدل ترقيتها في الطريق إلى الاستنتاج.' },
        { id: 'sources', prov: 'platform',
          en: 'Not applicable, this describes the platform’s own reporting format.',
          ar: 'لا ينطبق, هذا وصف لصيغة التقارير في المنصة نفسها.' }
      ]
    }
  ];

  /* ===================================================================
     5 · WHEN THERE IS NO GROUNDED ANSWER

     This gets the same seven fields as everything else. A refusal that
     looked different from an answer would be read as a system error
     rather than as a deliberate guardrail, and the guardrail is the
     part we most want a judge to see working.
     =================================================================== */

  function noAnswerRows() {
    return [
      { id: 'data', prov: 'platform',
        en: 'The question was matched against the assistant’s written knowledge base and against the analyst’s data vocabulary. Neither claimed it.',
        ar: 'قُوبل السؤال بقاعدة المعرفة المكتوبة للمساعد وبمفردات بيانات المحلّل. ولم يطالب به أيٌّ منهما.' },
      { id: 'method', prov: 'platform',
        en: 'Keyword matching against hand-written entries. There is no model here that could improvise past a miss, which is the point.',
        ar: 'مطابقة بالكلمات المفتاحية مقابل مدخلات مكتوبة يدوياً. ولا يوجد هنا نموذج يستطيع الارتجال بعد الإخفاق، وهذا هو المقصود.' },
      { id: 'analysis', prov: 'platform',
        en: 'I don’t have a grounded answer for that, and I would rather say so than invent one.',
        ar: 'ليست لديّ إجابة مسنَدة عن ذلك، وأفضّل قول هذا على اختلاق إجابة.' },
      { id: 'result', prov: 'platform',
        en: 'I can explain how the agent workflow reaches a decision, who can see your work, where any number on this page came from, what the approval checkpoint protects, or how sign-in and security are handled.\nFor questions about the environmental data itself, greening potential, surface heat, change between epochs, the analyst in the AI section answers from the dataset and shows its sources.',
        ar: 'أستطيع شرح كيف يصل مسار الوكلاء إلى قرار، ومن يستطيع رؤية عملك، ومن أين جاء أي رقم على هذه الصفحة، وما الذي تحميه نقطة الاعتماد، وكيف يُعالَج تسجيل الدخول والأمن.\nأما أسئلة البيانات البيئية نفسها, إمكانية التشجير، وحرارة السطح، والتغير بين الحقب, فيجيب عنها المحلّل في قسم الذكاء الاصطناعي من مجموعة البيانات ويعرض مصادره.' },
      { id: 'limits', prov: 'platform',
        en: 'A miss here is not evidence that the platform has no answer. It means this assistant has no written entry for the question, and the wording may simply be unfamiliar to it.',
        ar: 'إخفاق هنا ليس دليلاً على أن المنصة بلا إجابة. بل يعني أن هذا المساعد لا يملك مدخلاً مكتوباً للسؤال، وقد تكون الصياغة غير مألوفة له فحسب.' },
      { id: 'sources', prov: 'platform',
        en: 'Not applicable, no claim was made.',
        ar: 'لا ينطبق, لم يُقدَّم أي ادعاء.' }
    ];
  }

  /* ===================================================================
     6 · ROUTING

     Words that mean "this is a question about the DATA", which belongs
     to the real analyst rather than to this knowledge base. Both
     alphabets: an Arabic question about الجهراء used to fall past this
     test and land in the refusal, which read as a guardrail refusing a
     perfectly answerable question.
     =================================================================== */

  var DATA_WORDS_EN = /\b(greening|vegetation|ndvi|heat|temperature|stress|coverage|score|governorate|jahra|ahmadi|asimah|hawalli|farwaniya|mubarak|bubiyan|change|epoch|trend|highest|lowest|compare|which area|how much|rainfall|dust)\b/i;
  var DATA_WORDS_AR = /(التشجير|تشجير|الغطاء النباتي|النبات|الحرارة|حرارة السطح|الإجهاد|إجهاد|التغطية|الدرجة|المحافظة|محافظة|الجهراء|الأحمدي|العاصمة|حولي|الفروانية|مبارك الكبير|بوبيان|التغير|الحقبة|الاتجاه|الأعلى|الأدنى|قارن|مقارنة|الأمطار|الغبار)/;

  function isDataQuestion(q) {
    return DATA_WORDS_EN.test(q) || DATA_WORDS_AR.test(q);
  }

  function match(q) {
    var s = (q || '').toLowerCase();
    var best = null, bestScore = 0;
    for (var i = 0; i < KB.length; i++) {
      var score = 0, j;
      for (j = 0; j < KB[i].k.length; j++) {
        if (s.indexOf(KB[i].k[j]) !== -1) score += KB[i].k[j].length;
      }
      var ka = KB[i].ka || [];
      for (j = 0; j < ka.length; j++) {
        if (s.indexOf(ka[j]) !== -1) score += ka[j].length;
      }
      if (score > bestScore) { bestScore = score; best = KB[i]; }
    }
    return bestScore >= 4 ? best : null;
  }

  /* ===================================================================
     7 · THE TRANSCRIPT AS DATA

     The old transcript was DOM plus a flat copy in sessionStorage, so a
     language switch left every answered question stranded in whichever
     language it was asked in, and a restored transcript came back as
     unstructured paragraphs. Turns are now records; the DOM is drawn
     from them and redrawn when the language changes.

     A mirrored analyst answer is the one thing that cannot be redrawn in
     the other language: the analyst produced that prose once, in the
     language of the moment. Its field labels and its provenance tag do
     follow the switch; the sentences it wrote stay as it wrote them,
     which is the honest behaviour for a quotation.
     =================================================================== */

  var turns = [];
  var ui = {};

  function pushTurn(t) {
    turns.push(t);
    if (turns.length > 40) turns = turns.slice(-40);
    if (ui.log) ui.log.appendChild(drawTurn(t));
    scrollLog();
    save();
    return t;
  }

  function scrollLog() {
    if (ui.log) ui.log.scrollTop = ui.log.scrollHeight;
  }

  function repaint() {
    if (!ui.log) return;
    ui.log.textContent = '';
    turns.forEach(function (t) { ui.log.appendChild(drawTurn(t)); });
    scrollLog();
  }

  /* ===================================================================
     8 · DRAWING A TURN
     =================================================================== */

  function drawTurn(t) {
    if (t.who === 'q') return drawQuestion(t);
    return drawAnswer(t);
  }

  function drawQuestion(t) {
    var row = el('div', 'ksat-as-row ksat-as-q');
    var b = el('div', 'ksat-as-bubble');
    b.appendChild(el('p', 'ksat-as-p', t.text));
    row.appendChild(b);
    return row;
  }

  /* One field of the seven. The provenance is drawn AND spoken, because
     a hatch and a hue are invisible to a screen reader and to a
     greyscale printout, and spec 26 asks for a distinction that holds
     wherever the answer is read. */
  function drawField(f) {
    var meta = PROV[f.prov] || PROV.platform;
    var wrap = el('div', 'ksat-as-frow ksat-as-kind-' + meta.kind + ' ksat-as-prov-' + meta.cls);

    var label = FIELD_BY_ID[f.id] || { en: f.id, ar: f.id };
    var dt = el('dt', 'ksat-as-flab', L(label));
    wrap.appendChild(dt);

    var dd = el('dd', 'ksat-as-fval');

    var tag = el('span', 'ksat-as-provtag');
    var mark = el('span', 'ksat-as-provmark', meta.mark);
    mark.setAttribute('aria-hidden', 'true');      /* the word follows it */
    tag.appendChild(mark);
    tag.appendChild(el('span', 'ksat-as-provtxt', L(meta)));
    tag.appendChild(el('span', 'ksat-as-sr', ' ' + L(KIND_SPOKEN[meta.kind])));
    dd.appendChild(tag);

    String(L(f)).split('\n').forEach(function (line) {
      if (!line.trim()) { dd.appendChild(el('div', 'ksat-as-gap')); return; }
      dd.appendChild(el('p', 'ksat-as-p', line));
    });

    if (f.src && f.src.length) dd.appendChild(drawSources(f.src));

    wrap.appendChild(dd);
    return wrap;
  }

  /* SOURCE NUMBERS ARE NOT DECORATION. They index the real SOURCES array
     in index.html, and the name is read from that array at draw time
     rather than copied here - a copy would be a second source of truth
     and would go stale the first time the register is reordered. If the
     array is not reachable we print the bracketed number alone, which is
     still checkable against the Sources section, instead of inventing a
     title to fill the space. */
  function drawSources(idx) {
    var wrap = el('p', 'ksat-as-srcline');
    var reg = null;
    try { if (typeof SOURCES !== 'undefined' && SOURCES && SOURCES.length) reg = SOURCES; } catch (e) {}

    idx.forEach(function (i) {
      var s = reg && reg[i] ? reg[i] : null;
      var label = '[' + (i + 1) + ']';
      var node;
      if (s && s.url) {
        /* The full name, not the part before the em dash. Three entries
           in the register begin "Kuwait University —" (the launch
           announcement, the mosaic announcement and the 2025 Kuwait-NSRC
           item), so trimming at the dash produced three tags that all
           read "[n] Kuwait University" and could not be told apart. CSS
           ellipsises what does not fit and the title attribute carries
           the whole thing.

           The count here used to read "four of the eight sources", which
           was wrong twice over - see AND DO NOT WRITE DOWN HOW MANY
           SOURCES THERE ARE in the header. It is three, out of sixteen,
           and the reason the rule exists is the collision, not the
           tally, so the tally is now only an aside. */
        node = el('a', 'ksat-as-srctag', label + ' ' + String(s.name || '').trim());
        node.setAttribute('href', s.url);
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
        if (s.name) node.setAttribute('title', s.name);
      } else {
        node = el('span', 'ksat-as-srctag', label);
      }
      /* Latin numerals and Latin titles inside an Arabic paragraph are
         exactly the case bidi isolation exists for. css/ksat-detail.css
         does the same for every other mono run on this site. The
         isolation itself is a CSS rule keyed to this attribute rather
         than an inline style: the documented CSP gap on this project is
         that inline is still allowed, and nothing new should depend on
         it staying that way. */
      if (isRTL()) node.setAttribute('dir', 'ltr');
      wrap.appendChild(node);
    });
    return wrap;
  }

  function drawAnswer(t) {
    var row = el('div', 'ksat-as-row ksat-as-a');
    var b = el('div', 'ksat-as-bubble');

    if (t.title) b.appendChild(el('div', 'ksat-as-btitle', L(t.title)));

    /* A plain turn - the greeting, or a transcript restored from the
       old flat format - has prose and no fields. */
    if (t.text !== undefined && t.text !== null) {
      String(L(t.text)).split('\n').forEach(function (line) {
        if (!line.trim()) { b.appendChild(el('div', 'ksat-as-gap')); return; }
        b.appendChild(el('p', 'ksat-as-p', line));
      });
    }

    if (t.rows && t.rows.length) {
      var dl = el('dl', 'ksat-as-struct');
      t.rows.forEach(function (f) { dl.appendChild(drawField(f)); });
      b.appendChild(dl);
    }

    /* THE TRAILING BADGE IS GONE, DELIBERATELY. A mirrored answer used
       to end with one line - "answered over the reference dataset" -
       under prose that gave no clue which sentence it applied to. The
       class of the data now sits on the DATA USED row, beside the
       figures it actually describes, which is the whole point of spec
       26. .ksat-as-badge is consequently no longer written by this
       file; css/ksat-detail.css and css/ksat-theme.css still carry
       rules for it and can drop them whenever it suits them. */

    if (t.goto) {
      var go = el('button', 'ksat-as-go', L(t.gotoLabel || UI.openSection));
      go.type = 'button';
      go.addEventListener('click', function () {
        try {
          if (KS.shell && KS.shell.goToSection) KS.shell.goToSection(t.goto);
          else {
            var target = document.getElementById(t.goto);
            if (target) target.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth' });
          }
        } catch (e) {}
        if (window.matchMedia('(max-width: 620px)').matches) close();
      });
      b.appendChild(go);
    }

    row.appendChild(b);
    return row;
  }

  function thinking() {
    var row = el('div', 'ksat-as-row ksat-as-a');
    var b = el('div', 'ksat-as-bubble ksat-as-wait');
    b.appendChild(el('span', 'ksat-as-dot'));
    b.appendChild(el('span', 'ksat-as-dot'));
    b.appendChild(el('span', 'ksat-as-dot'));
    b.setAttribute('aria-label', L(UI.working));
    row.appendChild(b);
    ui.log.appendChild(row);
    scrollLog();
    return row;
  }

  /* ===================================================================
     9 · BUILDING AN ANSWER FROM AN ENTRY

     The numbers are filled here, at answer time, so the turn we store is
     already resolved and a later language switch does not need to reach
     back into KS.LIMITS for a value that may have changed underneath it.
     =================================================================== */

  function answerFromEntry(entry, question) {
    var Lm = limits();

    /* QUESTION is the researcher's words, followed by the canonical form
       the entry actually answers - so they can see whether they were
       understood before they read a word of the answer. */
    var rows = [entry.q
      ? { id: 'q', prov: 'platform',
          en: question + '\n· ' + entry.q.en,
          ar: question + '\n· ' + entry.q.ar }
      : { id: 'q', prov: 'platform', en: question, ar: question }];

    entry.rows.forEach(function (f) {
      rows.push({
        id:   f.id,
        prov: f.prov,
        src:  f.src,
        en:   fill(f.en, Lm),
        ar:   fill(f.ar, Lm)
      });
    });

    return {
      who: 'a',
      title: entry.t,
      rows: rows,
      goto: entry.see,
      gotoLabel: UI.showMe
    };
  }

  /* ===================================================================
     10 · THE BRIDGE TO THE REAL ANALYST

     We read the analyst's own transcript rather than re-implementing it,
     so there is exactly one engine on this page. See note 1 in the
     header for why this was broken and what it cost.
     =================================================================== */

  var bridgeComplained = false;

  function analystLog() {
    var n = document.getElementById(ANALYST_LOG_ID);
    if (!n && !bridgeComplained) {
      bridgeComplained = true;
      console.error(
        '[ksat-assistant] BRIDGE BROKEN: no #' + ANALYST_LOG_ID + ' in the document.\n' +
        'The assistant mirrors the page analyst by reading that element (index.html, section #ai).\n' +
        'If the analyst transcript was renamed, update ANALYST_LOG_ID in js/ksat-assistant.js to match.\n' +
        'Until then every data question falls back to a signpost instead of an answer, which is how ' +
        'the previous wrong id (#anLog) survived unnoticed.');
    }
    return n;
  }

  /* Said in the panel as well as in the console. A defect the visitor
     can see gets reported; a defect only the console knows about gets
     shipped. */
  function bridgeFailure(reasonEn, reasonAr) {
    return {
      who: 'a',
      title: UI.fromAnalyst,
      rows: [
        { id: 'data', prov: 'platform',
          en: 'None. The assistant could not reach the page analyst, so no dataset was read for this question.',
          ar: 'لا شيء. لم يستطع المساعد الوصول إلى محلّل الصفحة، فلم تُقرأ أي مجموعة بيانات لهذا السؤال.' },
        { id: 'method', prov: 'platform',
          en: 'The assistant hands every data question to the analyst in the AI section and mirrors the answer back. That hand-off failed.',
          ar: 'يسلّم المساعد كل سؤال بيانات إلى المحلّل في قسم الذكاء الاصطناعي ويعكس الإجابة. وقد أخفق هذا التسليم.' },
        { id: 'analysis', prov: 'platform', en: reasonEn, ar: reasonAr },
        { id: 'result', prov: 'platform',
          en: 'The analyst itself is unaffected. Open the AI section and ask it there, where its sources are shown alongside the answer.',
          ar: 'المحلّل نفسه غير متأثر. افتح قسم الذكاء الاصطناعي واسأله هناك، حيث تُعرض مصادره إلى جانب الإجابة.' },
        { id: 'limits', prov: 'platform',
          en: 'This is a fault in the assistant, not a refusal by the guardrail. Nothing was withheld from you.',
          ar: 'هذا خلل في المساعد لا رفض من ضابط الأمان. ولم يُحجب عنك شيء.' },
        { id: 'sources', prov: 'platform',
          en: 'Not applicable, no answer was produced.',
          ar: 'لا ينطبق, لم تُنتَج أي إجابة.' }
      ],
      goto: 'ai',
      gotoLabel: UI.openAnalyst
    };
  }

  /* The analyst badges its answer with the class of data it used. Its
     classes are the page's own (real / demo / sim / ai / src); this maps
     them onto the same vocabulary the rest of this file uses so a
     mirrored answer and a written one are marked identically. */
  var ANALYST_PROV = { real: 'record', demo: 'dataset', sim: 'modelled', ai: 'derived', src: 'platform' };

  function provOfAnalystNode(node) {
    var badge = node.querySelector('.who .badge') || node.querySelector('.badge');
    if (!badge) return 'dataset';
    var cls = badge.className.split(/\s+/);
    for (var i = 0; i < cls.length; i++) {
      if (ANALYST_PROV[cls[i]]) return ANALYST_PROV[cls[i]];
    }
    return 'dataset';
  }

  /* The analyst renders its answer as <dl class="arow"><dt>label</dt>
     <dd>value</dd></dl>, one per field, and shows a typing placeholder
     first. The presence of an .arow is therefore the exact test for
     "the answer has landed" - far steadier than the old heuristic,
     which stripped the first line if it contained the word "analyst"
     and hoped. */
  function readAnalystAnswer(node) {
    var rows = node.querySelectorAll('dl.arow');
    if (!rows.length) return null;
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      var dt = rows[i].querySelector('dt');
      var dd = rows[i].querySelector('dd');
      if (!dd) continue;
      out.push({
        label: (dt ? dt.textContent : '').trim(),
        value: (dd.innerText || dd.textContent || '').trim()
      });
    }
    return out.length ? out : null;
  }

  /* The analyst's four fields map onto four of the seven. METHOD,
     LIMITATIONS and SOURCES are ours to state, because the analyst does
     not write them and we will not put words in its mouth. */
  function mirrorRows(question, pairs, prov) {
    var data     = pairs[0] ? pairs[0].value : '';
    var analysis = pairs[1] ? pairs[1].value : '';
    var conf     = pairs[2] ? pairs[2].value : '';
    var rec      = pairs[3] ? pairs[3].value : '';

    var provMeta = PROV[prov] || PROV.dataset;
    var measured = (prov === 'record');

    var rows = [
      { id: 'q', prov: 'platform', en: question, ar: question },
      { id: 'data', prov: prov, en: data, ar: data },
      { id: 'method', prov: 'platform',
        en: 'Answered by the page’s own rule-based analyst, not by this assistant and not by a language model. The question is classified into one of its analysis routes and the route reads the reference series directly, inside the browser. There is no network call and no API key.',
        ar: 'أجاب عنه محلّل الصفحة القائم على القواعد، لا هذا المساعد ولا نموذج لغوي. يُصنَّف السؤال في أحد مسارات التحليل لديه، ويقرأ المسار السلاسل المرجعية مباشرة داخل المتصفح. ولا يوجد أي اتصال بالشبكة ولا مفتاح واجهة برمجية.' },
      { id: 'analysis', prov: 'derived', en: analysis, ar: analysis },
      { id: 'result', prov: 'derived',
        en: rec + (conf ? '\n' + UI.confidence.en + ': ' + conf : ''),
        ar: rec + (conf ? '\n' + UI.confidence.ar + ': ' + conf : '') }
    ];

    rows.push({
      id: 'limits', prov: 'platform',
      en: measured
        ? 'The figures above are published mission characteristics. The analyst’s reading of them is an interpretation and is marked as one.'
        : 'The figures above come from the ' + provMeta.en.toLowerCase() + ', which is ' +
          'physically consistent but is not an observation from a calibrated instrument. The analyst states its own confidence rather than an error bar, because no uncertainty has been measured for these values. Treat the answer as a screening result, not as a survey.',
      ar: measured
        ? 'الأرقام أعلاه خصائص منشورة من خصائص المهمة. أما قراءة المحلّل لها فتفسير وهي موسومة بذلك.'
        : 'الأرقام أعلاه مأخوذة من ' + provMeta.ar + '، وهي متّسقة فيزيائياً لكنها ليست رصداً من جهاز معايَر. ويذكر المحلّل درجة ثقته بدل مقدار خطأ، لأنه لم يُقَس أي مقدار لعدم اليقين لهذه القيم. فعامِل الإجابة على أنها نتيجة فرز لا مسح ميداني.'
    });

    if (measured) {
      rows.push({ id: 'sources', prov: 'record', src: [0, 2, 3],
        en: 'The mission characteristics behind this answer are in the numbered register.',
        ar: 'خصائص المهمة خلف هذه الإجابة موجودة في السجل المرقّم.' });
    } else {
      rows.push({ id: 'sources', prov: 'platform',
        en: 'Not applicable, this answer was computed inside the page over the reference dataset, which is modelled on published Kuwaiti climate and land-cover patterns rather than taken from a cited measurement. The platform’s numbered primary sources are in the Sources register.',
        ar: 'لا ينطبق, حُسبت هذه الإجابة داخل الصفحة على مجموعة البيانات المرجعية، وهي مُنمذَجة على أنماط المناخ والغطاء الأرضي الكويتية المنشورة لا مأخوذة من قياس مُستشهد به. والمصادر الأولية المرقّمة للمنصة موجودة في سجل المصادر.' });
    }

    return rows;
  }

  function delegate(q, waitRow) {
    var logEl = analystLog();

    if (typeof window.askAnalyst !== 'function' || !logEl) {
      waitRow.remove();
      pushTurn(bridgeFailure(
        !logEl
          ? 'The analyst transcript (#' + ANALYST_LOG_ID + ') is not in this document. The console carries the full diagnostic.'
          : 'The analyst function is not loaded in this page. The console carries the full diagnostic.',
        !logEl
          ? 'نص المحلّل (#' + ANALYST_LOG_ID + ') غير موجود في هذه الوثيقة. ويحمل سجل وحدة التحكم التشخيص الكامل.'
          : 'دالة المحلّل غير مُحمَّلة في هذه الصفحة. ويحمل سجل وحدة التحكم التشخيص الكامل.'));
      return;
    }

    var before = logEl.children.length;
    try {
      window.askAnalyst(q);
    } catch (e) {
      console.error('[ksat-assistant] askAnalyst() threw while answering a mirrored question:', e);
      waitRow.remove();
      pushTurn(bridgeFailure(
        'The analyst threw an error while answering. The console carries it.',
        'أطلق المحلّل خطأً أثناء الإجابة. ويحمله سجل وحدة التحكم.'));
      return;
    }

    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      var kids = logEl.children;
      if (kids.length > before) {
        var last = kids[kids.length - 1];
        var pairs = readAnalystAnswer(last);
        if (pairs) {
          clearInterval(iv);
          var prov = provOfAnalystNode(last);
          waitRow.remove();
          pushTurn({
            who: 'a',
            title: UI.fromAnalyst,
            rows: mirrorRows(q, pairs, prov),
            goto: 'ai',
            gotoLabel: UI.openAnalystSrc
          });
          return;
        }
      }
      if (tries > 40) {                                  /* ~4 seconds */
        clearInterval(iv);
        waitRow.remove();
        pushTurn(bridgeFailure(
          'The analyst did not finish within four seconds. It is still on the AI section of this page, with its sources.',
          'لم يُنهِ المحلّل الإجابة خلال أربع ثوانٍ. وهو لا يزال في قسم الذكاء الاصطناعي من هذه الصفحة مع مصادره.'));
      }
    }, 100);
  }

  /* ===================================================================
     11 · ASKING
     =================================================================== */

  function ask(q) {
    pushTurn({ who: 'q', text: q });
    var waitRow = thinking();
    var wait = reduced() ? 60 : 320;

    setTimeout(function () {
      var hit = match(q);
      if (hit) {
        waitRow.remove();
        pushTurn(answerFromEntry(hit, q));
        return;
      }
      if (isDataQuestion(q)) { delegate(q, waitRow); return; }
      waitRow.remove();
      pushTurn({
        who: 'a',
        title: { en: 'No grounded answer', ar: 'لا توجد إجابة مسنَدة' },
        rows: [{ id: 'q', prov: 'platform', en: q, ar: q }].concat(noAnswerRows()),
        goto: 'ai',
        gotoLabel: UI.openAnalyst
      });
    }, wait);
  }

  /* Asking from a suggestion chip goes straight to the entry. The chips
     are translated, and matching runs on English keywords, so a chip
     pressed in Arabic used to land in the refusal - the one place a
     canned question must never land. */
  function askEntry(entry, shown) {
    pushTurn({ who: 'q', text: shown });
    var waitRow = thinking();
    setTimeout(function () {
      waitRow.remove();
      pushTurn(answerFromEntry(entry, shown));
    }, reduced() ? 60 : 320);
  }

  /* ===================================================================
     12 · SUGGESTIONS — different for a visitor and a researcher
     =================================================================== */

  function entryByKey(key) {
    for (var i = 0; i < KB.length; i++) {
      if (KB[i].k.indexOf(key) !== -1) return KB[i];
    }
    return null;
  }

  var SUGGEST_PUBLIC = [
    { key: 'what is this',                  en: 'What is this platform?',                 ar: 'ما هذه المنصة؟' },
    { key: 'where do the numbers come from', en: 'Where do the numbers come from?',        ar: 'من أين تأتي الأرقام؟' },
    { key: 'why is this hidden',            en: 'Why do some panels ask me to sign in?',   ar: 'لماذا تطلب بعض اللوحات تسجيل الدخول؟' },
    { key: 'how do the agents work',        en: 'How do the agents reach a decision?',     ar: 'كيف يصل الوكلاء إلى قرار؟' }
  ];
  var SUGGEST_INSIDER = [
    { key: 'who can see',                   en: 'Who can see my missions?',                ar: 'من يستطيع رؤية مهماتي؟' },
    { key: 'run a mission',                 en: 'How do I run a mission?',                 ar: 'كيف أشغّل مهمة؟' },
    { key: 'checkpoint',                    en: 'What does the approval checkpoint protect?', ar: 'ما الذي تحميه نقطة الاعتماد؟' },
    { key: 'where do the numbers come from', en: 'Where do the numbers come from?',        ar: 'من أين تأتي الأرقام؟' }
  ];

  function paintChips() {
    if (!ui.chips) return;
    ui.chips.textContent = '';
    var list = KS.live ? SUGGEST_INSIDER : SUGGEST_PUBLIC;
    list.forEach(function (s) {
      var shown = L(s);
      var c = el('button', 'ksat-as-chip', shown);
      c.type = 'button';
      c.addEventListener('click', function () {
        var entry = entryByKey(s.key);
        if (entry) askEntry(entry, shown);
        else ask(shown);
      });
      ui.chips.appendChild(c);
    });
  }

  function greet() {
    if (turns.length) return;                        /* restored transcript */
    var who = KS.live
      ? { en: 'You are signed in, so the instruments and your own missions are available.',
          ar: 'أنت مسجَّل الدخول، فالأجهزة ومهماتك متاحة.' }
      : { en: 'You are viewing the public record. Signing in adds the instruments and your own missions.',
          ar: 'أنت تطالع السجل العام. ويضيف تسجيل الدخول الأجهزة ومهماتك.' };

    pushTurn({
      who: 'a',
      title: UI.greetTitle,
      text: {
        en: 'I am a scientific analysis assistant, not a general chatbot. Every answer comes back in the same seven fields, question, data used, method, analysis, result, limitations, sources, so you can see what it rests on before you read what it concludes.\n\n' +
            'I can explain how this platform works, how the agents reach a decision, who can see your work, and where any number on this page came from. Data questions go to the page’s own analyst and come back marked with the class of data it used.\n\n' +
            who.en + '\n\n' +
            'Everything I answer comes from this page. There is no external model and no network call.',
        ar: 'أنا مساعد تحليل علمي، لا روبوت محادثة عام. وتعود كل إجابة في الحقول السبعة نفسها, السؤال، والبيانات المستخدمة، والمنهج، والتحليل، والنتيجة، وحدود الإجابة، والمصادر, لترى على ماذا تستند قبل أن تقرأ ما تستنتجه.\n\n' +
            'أستطيع شرح كيف تعمل هذه المنصة، وكيف يصل الوكلاء إلى قرار، ومن يستطيع رؤية عملك، ومن أين جاء أي رقم على هذه الصفحة. أما أسئلة البيانات فتذهب إلى محلّل الصفحة نفسه وتعود موسومة بصنف البيانات الذي استخدمه.\n\n' +
            who.ar + '\n\n' +
            'كل ما أجيب به يأتي من هذه الصفحة. لا نموذج خارجي ولا اتصال بالشبكة.'
      }
    });
  }

  /* ===================================================================
     13 · OPEN, CLOSE, ESCAPE
     =================================================================== */

  function isOpen() { return ui.panel && !ui.panel.hidden; }

  var lastFocus = null;

  function open() {
    if (!ui.panel) return;
    lastFocus = document.activeElement;
    ui.panel.hidden = false;
    ui.fab.setAttribute('aria-expanded', 'true');
    document.documentElement.setAttribute('data-ksat-assistant', 'open');
    paintChips();
    greet();
    setTimeout(function () { try { ui.input.focus(); } catch (e) {} }, reduced() ? 0 : 120);
  }

  function close() {
    if (!ui.panel) return;
    ui.panel.hidden = true;
    ui.fab.setAttribute('aria-expanded', 'false');
    document.documentElement.removeAttribute('data-ksat-assistant');
    try { (lastFocus && lastFocus.focus) ? lastFocus.focus() : ui.fab.focus(); } catch (e) {}
  }

  /* WHO ELSE OWNS ESCAPE ON THIS PAGE
     index.html binds it on window for the intro sequence, and only acts
     while the intro has not finished. js/ksat-shell.js binds it on the
     sign-in gate and on the chapter sheet, both of which stop
     propagation from their own element. A listener of ours on document
     runs BEFORE the window one in the bubble phase, so calling
     stopPropagation carelessly here would take Escape away from the
     intro. It is therefore only taken when the panel is open and no
     higher overlay is on screen.

     THE CONTRACT FOR WHOEVER REBUILDS THE GUIDED TOUR: while the
     assistant panel is open, <html> carries data-ksat-assistant="open"
     and Escape belongs to the assistant. Check that attribute before
     acting on Escape and the two will not fight.

     ---------------------------------------------------------------
     THE CONTRACT WAS WRITTEN DOWN AND THEN IMMEDIATELY BROKEN, AND A
     BUBBLE-PHASE LISTENER COULD NOT HAVE HELD IT ANYWAY.

     js/ksat-tour.js also binds keydown on document - the listener
     whose OWN_KEYS list names .ksat-as-panel - and inside it the
     Escape branch is evaluated BEFORE that guard runs, so the guard
     never gets to see the panel it was written to protect. No line
     number here on purpose: index.html and that file have both moved
     several hundred lines during these passes and every line citation
     a previous agent left behind now points at the wrong code.

     Two bubble listeners on the same node run in REGISTRATION order,
     and the tour wins that race every time: its addEventListener is at
     the top level of its IIFE and runs the moment the file is parsed,
     while ours runs inside start(), which a 100ms poll calls some way
     after DOMContentLoaded.

     Measured in the browser, not reasoned about: with the tour
     running, the panel open and focus anywhere outside the panel,
     Escape pressed the tour's #dmExit, called preventDefault, and our
     handler then bailed on the e.defaultPrevented line below. The
     visitor lost the guided tour and the assistant stayed open -
     exactly backwards, and the failure was invisible from inside this
     file because the code here is correct as written.

     Capture phase fixes it without touching anyone else's file. A
     capture listener on document runs before every bubble listener on
     document regardless of who registered first, so the guards below
     - panel open, no higher overlay - decide the question instead of
     script order deciding it. Everything the guards let through is
     unchanged; everything they stop still reaches the tour, the intro
     and the gate exactly as before.

     Note also that stopping propagation from capture means the
     panel's own keydown listener (see buildPanel) never runs for
     Escape. That is fine - it closed the panel, and so does this -
     and it is left in place because it is the only thing that closes
     the assistant while a gate or the chapter sheet is up, which is a
     case the guards below deliberately decline.

     ---------------------------------------------------------------
     AND THIS SIDE HAS TO HOLD ON ITS OWN, BECAUSE THE OTHER FILE MAY
     NEVER BE TOUCHED.

     The fix for the tour is one moved line in a file this owner does
     not own, and it has been written down rather than applied. So the
     guarantee here cannot be "the tour will stop competing". It has to
     be "nothing the tour does can win", and that is what the capture
     phase buys: the DOM dispatches capture on document before target
     and before bubble, for every listener, whatever order they
     registered in. The tour would have to move to capture on document
     AND register before this file to take Escape back, and it binds at
     parse time on bubble.

     Two details that keep that true rather than merely likely.

     FIRST, stopImmediatePropagation as well as stopPropagation.
     stopPropagation alone stops the event reaching the target and the
     bubble phase, which is what the tour listens on today; it does NOT
     stop another capture listener on document that was registered
     after this one. There is no such listener in the page right now -
     a sweep of every addEventListener('keydown') in the repository
     found exactly one capture registration, this one - but "there is
     currently no second one" is the same kind of assumption that put
     this handler on the bubble phase in the first place.

     SECOND, what e.defaultPrevented can and cannot mean here. On the
     bubble phase it meant "somebody already handled this", and that is
     how the tour used to beat us. On the capture phase at document
     almost nobody has had a turn yet: the only listeners that ran
     before this one are capture listeners on window, and the page has
     none for keydown - the intro's Escape handler is on window, but on
     bubble, so it runs last of all. The guard is kept because a
     deliberate window-capture handler added later would be making a
     considered claim on the key and should win; it is no longer the
     line that loses the race, and a reader who carries bubble-phase
     intuition to it will misread which failures it can still produce. */
  function visible(node) {
    if (!node || node.hidden) return false;
    return !!(node.offsetWidth || node.offsetHeight || node.getClientRects().length);
  }

  function higherOverlayIsUp() {
    return visible(document.getElementById('intro')) ||
           visible(document.getElementById('ksat-gate')) ||
           visible(document.getElementById('ksat-ch-sheet'));
  }

  function onEscape(e) {
    if (e.key !== 'Escape' && e.key !== 'Esc') return;
    /* An Arabic or any other IME uses Escape to abandon the composition
       it is in the middle of. Taking that keystroke would close the
       panel and lose the half-typed word, so the composition wins. */
    if (e.isComposing || e.keyCode === 229) return;
    if (!isOpen()) return;
    /* See the note above on what this can mean at the capture phase. It
       is no longer the line the guided tour used to beat us on. */
    if (e.defaultPrevented) return;
    if (higherOverlayIsUp()) return;
    e.preventDefault();
    e.stopPropagation();
    /* Also the immediate form: stopPropagation does not stop a second
       capture listener on document registered after this one, and the
       whole point of moving to capture was to stop depending on who
       registered first. */
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    close();
  }

  /* ===================================================================
     14 · REMEMBERING

     The transcript is a per-tab convenience. sessionStorage, not
     localStorage: a researcher's questions should not outlive the tab,
     and they are never sent anywhere. Wrapped because some contexts
     throw on access rather than returning null.
     =================================================================== */

  function save() {
    try { sessionStorage.setItem(STORE, JSON.stringify(turns.slice(-40))); } catch (e) {}
  }

  function restore() {
    var rows = null;
    try { rows = JSON.parse(sessionStorage.getItem(STORE) || 'null'); } catch (e) {}
    if (rows && rows.length) { turns = rows; repaint(); return; }

    /* A tab opened before this rewrite still holds the old flat format.
       It is the visitor's own transcript, so it is carried over as prose
       rather than dropped - it simply has no fields to draw. */
    var old = null;
    try { old = JSON.parse(sessionStorage.getItem(STORE_V1) || 'null'); } catch (e) {}
    if (!old || !old.length) return;
    turns = old.map(function (r) {
      return r.who === 'q' ? { who: 'q', text: String(r.text || '') }
                           : { who: 'a', text: String(r.text || '') };
    });
    repaint();
    save();
  }

  /* ===================================================================
     15 · BUILDING IT
     =================================================================== */

  function buildFab() {
    var b = el('button', 'ksat-as-fab');
    b.id = FAB_ID;
    b.type = 'button';
    b.setAttribute('aria-haspopup', 'dialog');
    b.setAttribute('aria-expanded', 'false');
    b.setAttribute('aria-controls', PANEL_ID);
    b.setAttribute('aria-label', L(UI.fabOpen));

    /* The mark: a satellite over a horizon, drawn rather than an emoji,
       so it inherits the interface colour and stays crisp at any zoom. */
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.classList.add('ksat-as-mark');
    var paths = [
      'M3 17.5a9 9 0 0 1 18 0',                       /* the horizon    */
      'M12 3.4v3.1',                                  /* mast           */
      'M9.2 8.2h5.6v3.2H9.2z',                        /* body           */
      'M5.6 9.0h3.0M15.2 9.0h3.0',                    /* solar panels   */
      'M5.6 10.6h3.0M15.2 10.6h3.0'
    ];
    paths.forEach(function (d) {
      var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', d);
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', 'currentColor');
      p.setAttribute('stroke-width', '1.5');
      p.setAttribute('stroke-linecap', 'round');
      p.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(p);
    });
    b.appendChild(svg);
    b.appendChild(el('span', 'ksat-as-fab-label', L(UI.fabLabel)));

    b.addEventListener('click', function () { isOpen() ? close() : open(); });
    document.body.appendChild(b);
    ui.fab = b;
  }

  function buildPanel() {
    var p = el('div', 'ksat-as-panel');
    p.id = PANEL_ID;
    p.setAttribute('role', 'dialog');
    p.setAttribute('aria-modal', 'false');     /* the page stays usable behind it */
    p.setAttribute('aria-label', L(UI.greetTitle));
    p.hidden = true;

    /* header */
    var head = el('div', 'ksat-as-head');
    var ttl = el('div', 'ksat-as-ttl');
    ui.eyebrow = el('span', 'ksat-as-eyebrow', L(UI.eyebrow));
    ui.subtitle = el('span', 'ksat-as-sub', L(UI.sub));
    ttl.appendChild(ui.eyebrow);
    ttl.appendChild(ui.subtitle);
    head.appendChild(ttl);

    var x = el('button', 'ksat-as-x', '×');
    x.type = 'button';
    x.setAttribute('aria-label', L(UI.close));
    x.addEventListener('click', close);
    head.appendChild(x);
    ui.closeBtn = x;
    p.appendChild(head);

    /* transcript */
    var log = el('div', 'ksat-as-log');
    log.id = 'ksat-as-log';
    log.setAttribute('role', 'log');
    log.setAttribute('aria-live', 'polite');
    log.setAttribute('aria-label', L(UI.convo));
    p.appendChild(log);
    ui.log = log;

    /* suggestions */
    var chips = el('div', 'ksat-as-chips');
    ui.chips = chips;
    p.appendChild(chips);

    /* composer */
    var form = el('form', 'ksat-as-form');
    form.setAttribute('novalidate', 'novalidate');
    var inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'ksat-as-input';
    inp.id = 'ksat-as-input';
    inp.placeholder = L(UI.placeholder);
    inp.setAttribute('autocomplete', 'off');
    inp.setAttribute('maxlength', '400');
    inp.setAttribute('aria-label', L(UI.inputLabel));
    var send = el('button', 'ksat-as-send', L(UI.send));
    send.type = 'submit';
    form.appendChild(inp);
    form.appendChild(send);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = inp.value.trim();
      if (!v) return;
      inp.value = '';
      ask(v);
    });
    p.appendChild(form);
    ui.input = inp;
    ui.send = send;

    document.body.appendChild(p);
    ui.panel = p;

    /* Escape with focus still inside the panel. This one stops at the
       panel, so the document listener below never double-fires. */
    p.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || e.key === 'Esc') { e.stopPropagation(); close(); }
    });
  }

  /* Re-label the furniture when the language changes. The transcript is
     redrawn from the turn records, so answers change language too. */
  function relabel() {
    if (!ui.panel) return;
    ui.fab.setAttribute('aria-label', L(UI.fabOpen));
    var label = ui.fab.querySelector('.ksat-as-fab-label');
    if (label) label.textContent = L(UI.fabLabel);
    ui.panel.setAttribute('aria-label', L(UI.greetTitle));
    ui.eyebrow.textContent = L(UI.eyebrow);
    ui.subtitle.textContent = L(UI.sub);
    ui.closeBtn.setAttribute('aria-label', L(UI.close));
    ui.log.setAttribute('aria-label', L(UI.convo));
    ui.input.placeholder = L(UI.placeholder);
    ui.input.setAttribute('aria-label', L(UI.inputLabel));
    ui.send.textContent = L(UI.send);
    paintChips();
    repaint();
  }

  /* ===================================================================
     16 · BOOT
     =================================================================== */

  function start() {
    if (document.getElementById(FAB_ID)) return;
    buildFab();
    buildPanel();
    restore();

    /* Keep the suggestions honest when the researcher signs in or out. */
    document.addEventListener('ksat:identity', function () { if (isOpen()) paintChips(); });

    /* js/ksat-i18n.js announces the switch; it loads after this file, so
       the listener is registered here and fires from the first apply(). */
    document.addEventListener('ksat:lang', relabel);

    /* A global shortcut a researcher will actually remember. */
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === '/' || e.key === '?')) {
        e.preventDefault();
        isOpen() ? close() : open();
      }
    });

    /* CAPTURE, not bubble. See WHO ELSE OWNS ESCAPE ON THIS PAGE above:
       js/ksat-tour.js registers its own document keydown at parse time,
       which is before this line runs, and two bubble listeners on the
       same node go in registration order - so on bubble the tour took
       Escape out from under an open panel and exited the guided tour
       instead. The `true` is the whole fix. */
    document.addEventListener('keydown', onEscape, true);

    /* THE CHECK THAT WOULD HAVE CAUGHT THE DEAD BRIDGE. It runs once,
       late enough for the page's own scripts to have finished, and says
       so in the console rather than waiting for a visitor to ask a data
       question and get a signpost. */
    setTimeout(function () {
      if (!document.getElementById(ANALYST_LOG_ID)) analystLog();
      else if (typeof window.askAnalyst !== 'function') {
        console.error('[ksat-assistant] #' + ANALYST_LOG_ID + ' is present but askAnalyst() is not a ' +
                      'function. Data questions cannot be mirrored.');
      }
    }, 2500);

    KS.assistant = { open: open, close: close, ask: ask };
  }

  function boot() {
    /* THE FIRST VERSION OF THIS WAITED FOR #anLog AND NEVER MOUNTED.
       That id never existed in this page, so the wait could only ever
       time out - and the timeout was what mounted the launcher, two
       seconds late, for every visitor. The assistant is for visitors
       above all.

       There is nothing to wait for: delegate() already checks for
       askAnalyst and for the transcript at the moment a data question is
       asked, and now reports it loudly when either is missing. So mount
       as soon as there is a body, with one frame's delay so the intro
       sequence owns the screen first. */
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (document.body || tries > 40) { clearInterval(iv); start(); }
    }, 100);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
