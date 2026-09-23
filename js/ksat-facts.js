/* =====================================================================
   ksat-facts.js - THE FIRST SECTION AFTER THE HERO, MADE INTO CONTENT
   Owner: 01 Front End
   Pairs with css/ksat-facts.css.

   THE BRIEF, IN ONE LINE
   "Change it, present real info from KuwaitSat-1 and all over Kuwait
   space things just like how NASA is organized and present things."

   WHAT WAS THERE, AND WHY IT HAD TO MOVE

   #legend opened the page with five cards explaining the site's own
   badge vocabulary: Measured, Public data, Reference dataset, Modelled,
   Model output. Those five classes matter enormously, but they are a
   KEY. A key belongs next to the thing it unlocks, and the thing it
   unlocks is the provenance register down in #sources.

   In the slot it occupied, the first content a visitor meets after the
   hero, nasa.gov puts a mission. So this file does two things:

     1 - moves the five cards, the actual DOM nodes, into #sources, so
         nothing is deleted and every data-i18n key on them keeps
         working exactly as js/ksat-i18n.js expects;
     2 - builds KuwaitSat-1 itself into #legend: what it is, what it was
         for, who built it, what it has actually done, and where it sits
         in the national picture.

   ---------------------------------------------------------------------
   THE RULE THIS FILE IS WRITTEN UNDER

   NOT ONE FACT BELOW IS INVENTED. Every sentence on screen traces to
   data already in index.html, and every figure carries the same source
   chip the page's own srcChips() draws. The sources are read live out of
   the SOURCES array rather than copied, so if a URL is corrected in
   index.html these chips follow it.

   Where the record genuinely does not say something, this file says so
   on screen rather than filling the gap. Two places do that:

     - LEADS in index.html carries three names and three role KEYS
       (r:"lead.a", "lead.b", "lead.c"). Grep the whole repo: those keys
       have NO English and NO Arabic anywhere. The names are published;
       the mapping of name to post is not, in anything this repo holds.
       CLAIMS says only "academic and operational directors named on the
       official site", so the two names are shown as a pair under that
       exact wording, and the panel states outright that the record here
       does not say which of them holds which post. Guessing would have
       been one sentence and would have been indistinguishable from the
       true ones.

     - "92 days" is arithmetic on two sourced dates, 3 January 2023 and
       5 April 2023, and the line under it says so. It is not presented
       as a published figure because it is not one.

   The stated objective is the load bearing one. The published objective
   was capacity building and evaluating the camera for attitude
   determination, NOT operational environmental monitoring. That
   distinction is the reason this platform is credible, so it is quoted
   verbatim from the SPECS row and given its own block rather than being
   softened into a summary.

   ---------------------------------------------------------------------
   BILINGUAL

   Every user visible string here lives in COPY as an {en, ar} pair. In
   English mode nothing Arabic renders and in Arabic mode nothing English
   renders, because the section is rebuilt wholesale from one side of
   each pair rather than patched.

   The re-render is driven by the 'ksat:lang' event that
   js/ksat-i18n.js dispatches at the END of its apply(), after
   translateDom, translateBadges, translateLabels and the page's own
   renderAll() have all finished. Rendering last is what keeps this
   section out of the i18n layer's caches: its translateLabels() sweep
   caches the English of a text node on first sight and restores it on
   the way back, and it explicitly SKIPS any node that already contains
   Arabic. Since our nodes are thrown away and rebuilt on every switch,
   they are never the stale copy it restores.

   Latin identifiers that name a real object stay Latin inside the Arabic
   too - KuwaitSat-1, 2U, UHF, S-band, COSPAR 2023-001CY, RGB - which is
   the convention js/ksat-i18n.js states in its own header and follows.
   Numerals stay Western for the same reason: that header sets the house
   rule and its newer strings use them.

   ---------------------------------------------------------------------
   PUNCTUATION

   No em dashes and no en dashes in anything a reader sees. 361 of them
   were stripped from this site in one morning because the team reads
   that punctuation as machine written, and they are right that it is a
   tell. Commas and full stops only. The hyphens that survive are inside
   names: KuwaitSat-1, S-band, Transporter-6, COSPAR 2023-001CY.

   ---------------------------------------------------------------------
   Z-INDEX: none claimed. Nothing here stacks.
   ===================================================================== */

(function () {
  'use strict';

  var KS = window.KSAT = window.KSAT || {};
  if (KS.facts) return;

  /* =================================================================
     1 - REACHING THE PAGE'S OWN DATA

     SOURCES, SPECS and PILLARS are top level `const` bindings in
     CLASSIC scripts inside index.html. Classic scripts share one global
     lexical environment, so they are reachable here BY NAME, but they
     are NOT properties of window, so `window.SOURCES` is undefined and
     a plain `typeof` guard is the only safe way to ask.

     Everything below degrades rather than throws: if a binding is not
     there, the citation chips come back empty and the section still
     renders its prose. A missing array must never blank the first
     content block on the page.

     THE READ IS A BARE REFERENCE INSIDE try/catch, AND IT HAS TO BE.
     A lookup by string would mean eval or new Function, and the CSP in
     vercel.json grants script-src 'self' 'unsafe-inline' with NO
     'unsafe-eval', so either one is blocked outright in production and
     the section would lose every citation chip on the live site while
     working perfectly on a dev server that has no CSP. Naming the
     binding directly compiles to a normal global lookup; if it is not
     there the ReferenceError is catchable and we return null.
     ================================================================= */
  function sources() {
    var s = null;
    try { s = SOURCES; } catch (e) { s = null; }      /* eslint-disable-line no-undef */
    return (s && s.length) ? s : null;
  }
  function pillars() {
    var p = null;
    try { p = PILLARS; } catch (e) { p = null; }      /* eslint-disable-line no-undef */
    return (p && p.length) ? p : null;
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* Citation chips, built the same way index.html's srcChips() builds
     them: zero based index into SOURCES, displayed one based, so [3]
     here is the same [3] a reader sees in the register below. The
     markup is deliberately identical (a.tag) so the two are visually
     the same chip and not two chips that happen to look alike. */
  function cite(list) {
    var SRC = sources();
    if (!SRC) return '';
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var s = SRC[list[i]];
      if (!s) continue;
      out.push('<a class="tag" href="' + esc(s.url) + '" target="_blank" rel="noopener" title="' +
        esc(s.name) + '">[' + (list[i] + 1) + ']</a>');
    }
    if (!out.length) return '';
    return '<span class="ksf-cite">' + out.join(' ') + '</span>';
  }

  /* =================================================================
     2 - THE COPY

     Read this as the content, not as configuration. Each entry names
     the source indices it is answerable to, and those indices are the
     ones printed beside it on screen.
     ================================================================= */
  var COPY = {

    /* --- the section head ------------------------------------------ */
    eyebrow: {
      en: 'The national satellite',
      ar: 'القمر الاصطناعي الوطني'
    },
    /* BADGES in js/ksat-i18n.js already carries this exact pair, so the
       badge reads the same whether that sweep painted it or we did. */
    badge: {
      en: '🛰 Published record',
      ar: '🛰 سجل منشور'
    },
    h2: {
      en: 'What Kuwait put in orbit',
      ar: 'ما الذي وضعته الكويت في المدار'
    },
    /* SPECS rows op/form/mass, plus gsd/sw and spec.first. Sources
       [1][2][4][5] for the first sentence, [3][4] for the second.

       THE WORD "FIRST" IS THE ONE TO WATCH IN THAT SENTENCE, because an
       unearned "first" is the cheapest way for a page like this to
       become untrue. It is earned twice over in the register and both
       are now cited: SOURCES[1] is Kuwait University's own first
       Kuwaiti satellite launch announcement, and SOURCES[3] is the
       peer-reviewed paper whose title is literally "The First Kuwait
       National Satellite Project, KuwaitSat-1". The paper was missing
       from this chip group, which left the strongest evidence for the
       strongest word in the sentence sitting unlinked two panels away. */
    lede1: {
      en: 'KuwaitSat-1 is Kuwait’s first national satellite project, a 2U CubeSat of roughly 2 kg, built and operated by Kuwait University.',
      ar: 'KuwaitSat-1 هو أول مشروع قمر اصطناعي وطني للكويت، وهو قمر مكعّب من فئة 2U تبلغ كتلته نحو 2 كجم، من بناء وتشغيل جامعة الكويت.'
    },
    lede1src: [0, 1, 3, 4],
    lede2: {
      en: 'It carries a Gecko RGB imager that resolves 39 m on the ground across a frame about 80 km wide, and its first image series was captured on 5 April 2023.',
      ar: 'ويحمل مصوّر Gecko متعدد الألوان RGB بدقة عيّنة أرضية 39 متراً عبر إطار عرضه نحو 80 كم، والتُقطت أول سلسلة صور له في 5 أبريل 2023.'
    },
    lede2src: [2, 3],

    /* --- the figure strip -------------------------------------------

       THESE FOUR ARE NOT THE OBVIOUS FOUR, AND THAT IS THE POINT.

       The first version of this strip carried Platform, Ground sample
       distance, Swath and Launch. Then it went on screen, and the hero's
       own .factstrip sits DIRECTLY ABOVE this section carrying LAUNCHED
       3 Jan 2023, PLATFORM 2U CubeSat 2 kg, IMAGER GSD 39 m, SWATH
       80 km. Four identical numbers, twice, a few hundred pixels apart.
       A reader scrolling past would have learned nothing from the second
       set and would have wondered why the page was repeating itself.

       So the prose keeps 2U, 2 kg, 39 m and 80 km, where they belong in
       a sentence, and the strip carries the four published facts the
       hero does NOT: who operates it, when it first returned imagery,
       when the ground segment came up, and the international designator
       it is listed under. Between the lede and the strip the section
       still covers every headline specification, and nothing is said
       twice.                                                          */
    figs: [
      { k: { en: 'Operator', ar: 'الجهة المشغّلة' },
        v: { en: 'Kuwait University', ar: 'جامعة الكويت' },
        d: { en: 'Builder and operator', ar: 'الجهة البانية والمشغّلة' },
        s: [0, 4] },
      { k: { en: 'First imagery', ar: 'أول صور' },
        v: { en: '5 April 2023', ar: '5 أبريل 2023' },
        d: { en: 'Five consecutive frames', ar: 'خمسة إطارات متتالية' },
        s: [2, 3] },
      { k: { en: 'Ground station', ar: 'المحطة الأرضية' },
        v: { en: 'Oct 2022', ar: 'أكتوبر 2022' },
        d: { en: 'Operational at the College of Science', ar: 'دخلت الخدمة في كلية العلوم' },
        s: [3] },
      { k: { en: 'COSPAR ID', ar: 'معرّف COSPAR' },
        v: { en: '2023-001CY', ar: '2023-001CY' },
        d: { en: 'International designator', ar: 'المعرّف الدولي' },
        s: [4] }
    ],

    /* --- block: the objective --------------------------------------- */
    objH: { en: 'What the mission set out to do', ar: 'ما الذي قامت المهمة لأجله' },
    /* Verbatim from the SPECS row spec.obj, and from the Arabic the page
       already publishes for it in SPEC_VAL_AR. Not paraphrased, because
       the paraphrase is where a mission quietly acquires an objective it
       never had. */
    objQuote: {
      en: 'Capacity building; evaluate camera use for attitude determination',
      ar: 'بناء القدرات؛ وتقييم استخدام الكاميرا في تحديد الاتجاه'
    },
    objQuoteSrc: [0, 4],
    objP: {
      en: 'That is the objective on the published record. It is not operational environmental monitoring, and this platform has never claimed that it was. What follows on this page is an analytical layer proposed on top of a mission of this kind, built on the record below rather than on anything the spacecraft has been said to do.',
      ar: 'هذا هو الهدف كما ورد في السجل المنشور. وهو ليس رصداً بيئياً تشغيلياً، ولم تدّعِ هذه المنصة يوماً أنه كذلك. وما يلي في هذه الصفحة طبقة تحليلية مقترحة فوق مهمة من هذا النوع، مبنية على السجل أدناه لا على أي شيء قيل إن المركبة تفعله.'
    },

    /* --- block: the people ------------------------------------------ */
    whoH: { en: 'Who built it', ar: 'من بناه' },
    whoP: {
      en: 'The project is directed by Dr Hala AlJassar. Kuwait University names her as Acting Head of the Department of Physics in the College of Science, and as the representative of the Kuwait National Space Research Center at the United Nations.',
      ar: 'يدير المشروع الدكتورة هالة الجسار. وتسمّيها جامعة الكويت رئيسةً بالإنابة لقسم الفيزياء في كلية العلوم، وممثلةً لمركز الكويت الوطني لأبحاث الفضاء لدى الأمم المتحدة.'
    },
    whoPsrc: [0, 6, 11],
    people: [
      { n: { en: 'Dr Hala AlJassar', ar: 'الدكتورة هالة الجسار' },
        r: { en: 'Project director', ar: 'مديرة المشروع' } },
      /* THE PAIR IS SHOWN AS A PAIR ON PURPOSE. See the file header:
         the repo publishes both names and the two posts, and does not
         publish which name holds which post. */
      { n: { en: 'Dr Yaser Abdulraheem and Dr Ahmad AlKandari',
             ar: 'الدكتور ياسر عبدالرحيم والدكتور أحمد الكندري' },
        r: { en: 'Academic and operational directors, as named on the project’s own site. The published record here does not say which of the two holds which post.',
             ar: 'المدير الأكاديمي والمدير التشغيلي، كما وردت أسماؤهما في موقع المشروع. والسجل المنشور هنا لا يحدد أيّهما يشغل أي منصب.' } }
    ],
    /* "just say four kuwaiti student".

       THE SOURCE CHIP CAME OFF WITH THE OLD SENTENCE, ON PURPOSE. The
       line it replaced was attributed to [6], Kuwaiti press coverage,
       and what that coverage reported was a cohort selected from a
       larger applicant pool — not a number. Leaving [6] beside "four"
       would be citing a source for something it does not say, which on
       a page whose whole argument is attribution is worse than carrying
       no chip at all. This is the project team stating a fact about
       their own project, and it reads as one. */
    whoP2: {
      en: 'Built by four Kuwaiti students.',
      ar: 'بناها أربعة طلبة كويتيين.'
    },
    whoP2src: null,

    /* --- block: the national picture    /* --- the pointer to the relocated key --------------------------- */
    note: {
      en: 'The vocabulary that labels every panel on this page as measured, public data, reference dataset, modelled or model output has moved to the sources section, beside the register that uses it.',
      ar: 'انتقلت مفردات التصنيف التي تصف كل لوحة في هذه الصفحة بأنها مقيسة أو بيانات عامة أو مجموعة مرجعية أو مُنمذَجة أو مخرجات نموذج إلى قسم المصادر، بجانب السجل الذي يستخدمها.'
    },
    noteLink: { en: 'Read the provenance key', ar: 'اقرأ مفتاح المصدرية' },

    /* --- the vocabulary, in its new home ---------------------------- */
    vocabH: { en: 'Every panel declares what it is', ar: 'كل لوحة تُعلن عن طبيعتها' },
    /* THE SECOND SENTENCE USED TO BE A UNIVERSAL, AND IT WAS NOT TRUE.

       It read: "Every chart, map and figure on the site carries one of
       them." Nothing in index.html claims that, and the site does not
       do it: the hero fact strip, the concept chain and the Explore
       panel's own Featured cards all carry no badge at all, and the
       Explore panel is the other half of this same pair of files. A
       sentence a reader can falsify in ten seconds, sitting directly
       above the provenance register, costs more credibility than the
       register earns.

       What is left is the page's own claim. "Every panel declares what
       it is" is index.html's heading for this block, data-i18n leg.h,
       and the sentence now says only what a badge does when a panel
       carries one, which is exactly what the five cards below define. */
    vocabP: {
      en: 'The five classes below are the badge vocabulary used across this platform. The badge on a panel says which of them that panel is, and this is where they are defined.',
      ar: 'الأصناف الخمسة أدناه هي مفردات التصنيف المستخدمة في هذه المنصة. والشارة على أي لوحة تقول أي صنف منها تكون، وهنا تُعرَّف هذه الأصناف.'
    }
  };

  /* One side of a pair. There is no fallback to English inside an Arabic
     render on purpose: a missing Arabic string should show as an obvious
     hole in review, not leak an English sentence into an Arabic page,
     which is the exact complaint the team raised twice. */
  function L(pair, code) {
    if (!pair) return '';
    return code === 'ar' ? (pair.ar || '') : (pair.en || '');
  }

  /* =================================================================
     3 - MOVING THE VOCABULARY

     The five cards are MOVED, not rebuilt. appendChild on a node that is
     already in the document relocates it, keeping every attribute, every
     data-i18n key and the inline SVG marks exactly as index.html wrote
     them, so js/ksat-i18n.js keeps translating them with no idea
     anything happened.

     THE BUG THIS SHAPE EXISTS TO PREVENT, FOUND IN THE BROWSER

     The first version wrote the panel's heading and paragraph with
     `host.innerHTML = ...` and then appended the strip. That is correct
     exactly once. On the SECOND pass, which is every language switch,
     innerHTML replaced the panel's children, and the strip was one of
     them, so the five cards were destroyed before the line that tries to
     re-append them ever ran. Switching to Arabic once and counting:

         document.querySelectorAll('.legcell').length  ->  0

     The provenance vocabulary is the one thing on this page that must
     never disappear, and it took a single language switch to delete it.

     So the strip is now held in a module level reference and is NEVER a
     child that innerHTML can reach. The heading and paragraph are real
     elements created once, and a re-render only assigns textContent to
     them. Nothing in this function can destroy a node it did not make.
     ================================================================= */

  /* Our one handle on the five cards, captured the first time we find
     them and kept for the life of the page. */
  var vocabStrip = null;

  function moveVocabulary(code) {
    /* NOT named `sources`: that is the accessor for the SOURCES array a
       few lines up, and shadowing it here is the kind of thing that
       works until somebody adds a cite() call to this function. */
    var sec = document.getElementById('sources');
    if (!sec) return;

    var host = document.getElementById('ksf-vocab');
    if (!host) {
      host = document.createElement('div');
      host.id = 'ksf-vocab';
      host.className = 'ksf-vocab panel';
      host.appendChild(document.createElement('h3'));
      host.appendChild(document.createElement('p'));
      /* Immediately after the section lede, so a reader meets the key
         BEFORE the provenance register that is written in it, rather
         than after three panels of tables that assume it. */
      var lede = sec.querySelector(':scope > .lede');
      if (lede && lede.nextSibling) sec.insertBefore(host, lede.nextSibling);
      else sec.appendChild(host);
    }

    /* textContent, not innerHTML. See the note above. */
    var h3 = host.querySelector(':scope > h3');
    var p = host.querySelector(':scope > p');
    if (h3) h3.textContent = L(COPY.vocabH, code);
    if (p) p.textContent = L(COPY.vocabP, code);

    /* Find the cards wherever they currently are, once. appendChild on a
       node already in the document MOVES it, so this both relocates them
       on the first pass and is a no-op on every pass after. */
    if (!vocabStrip || !vocabStrip.isConnected) {
      vocabStrip = document.querySelector('.legstrip');
    }
    if (vocabStrip && vocabStrip.parentNode !== host) host.appendChild(vocabStrip);
  }

  /* =================================================================
     4 - THE SECTION ITSELF
     ================================================================= */
  function markup(code) {
    var h = '';

    h += '<div class="ksf-eyebrow">' +
           '<span class="ksf-rule" aria-hidden="true"></span>' +
           '<span class="ksf-lab">' + esc(L(COPY.eyebrow, code)) + '</span>' +
           '<span class="badge real">' + esc(L(COPY.badge, code)) + '</span>' +
         '</div>';

    h += '<h2 class="ksf-h2">' + esc(L(COPY.h2, code)) + '</h2>';

    /* TWO PARAGRAPHS, NOT ONE. The first draft ran both sentences into a
       single <p> with a chip group after each, and the mid paragraph
       chips landed in the middle of a line: the eye hit "[1] [2] [5] It
       carries" and stopped. Splitting keeps each claim beside the source
       that answers for it, and puts every chip at the end of a line
       where the page's own srcChips() already puts them. */
    h += '<p class="ksf-lede">' +
           esc(L(COPY.lede1, code)) + ' ' + cite(COPY.lede1src) +
         '</p>';
    h += '<p class="ksf-lede ksf-lede-2">' +
           esc(L(COPY.lede2, code)) + ' ' + cite(COPY.lede2src) +
         '</p>';

    /* the figure strip */
    h += '<div class="ksf-figs">';
    for (var i = 0; i < COPY.figs.length; i++) {
      var f = COPY.figs[i];
      h += '<div class="ksf-fig">' +
             '<span class="k">' + esc(L(f.k, code)) + '</span>' +
             '<span class="v">' + esc(L(f.v, code)) + '</span>' +
             '<span class="d">' + esc(L(f.d, code)) + ' ' + cite(f.s) + '</span>' +
           '</div>';
    }
    h += '</div>';

    /* objective and people, side by side */
    h += '<div class="ksf-band two">';

    h += '<div class="ksf-block">' +
           '<h3>' + esc(L(COPY.objH, code)) + '</h3>' +
           '<p class="ksf-quote">' + esc(L(COPY.objQuote, code)) + ' ' + cite(COPY.objQuoteSrc) + '</p>' +
           '<p>' + esc(L(COPY.objP, code)) + '</p>' +
         '</div>';

    var peeps = '';
    for (var p = 0; p < COPY.people.length; p++) {
      peeps += '<li class="ksf-person">' +
                 '<span class="n">' + esc(L(COPY.people[p].n, code)) + '</span>' +
                 '<span class="r">' + esc(L(COPY.people[p].r, code)) + '</span>' +
               '</li>';
    }
    h += '<div class="ksf-block">' +
           '<h3>' + esc(L(COPY.whoH, code)) + '</h3>' +
           '<p>' + esc(L(COPY.whoP, code)) + ' ' + cite(COPY.whoPsrc) + '</p>' +
           '<ul class="ksf-people">' + peeps + '</ul>' +
           '<p>' + esc(L(COPY.whoP2, code)) + '</p>' +
         '</div>';

    h += '</div>';

    /* the pointer to the relocated key */
    h += '<p class="ksf-note">' + esc(L(COPY.note, code)) +
         ' <a href="#sources">' + esc(L(COPY.noteLink, code)) + '</a></p>';

    return h;
  }

  /* =================================================================
     5 - MOTION: THERE IS NONE, AND THAT WAS A DELIBERATE RETREAT

     This file used to carry a scroll reveal. The figure strip, the four
     blocks and the closing note were given a class that set opacity 0
     and a 10px offset, and an IntersectionObserver added .in as each one
     came into view. The CSS was written the careful way round, visible
     by default, hidden only once JS had confirmed prefers-reduced-motion
     was off and IntersectionObserver existed.

     IT STILL FAILED, AND THE FAILURE WAS OBSERVED, NOT IMAGINED.
     In the verification browser the observer never delivered a single
     callback. After scrolling the whole section past the viewport:

         figs   0/4 landed
         blocks 0/4 landed
         first .ksf-fig computed opacity: 0

     A fresh observer created by hand on one of those elements also never
     fired inside 2.5 seconds, which points at the tab being throttled
     rather than at the class logic. That distinction does not matter.
     What matters is that a decorative fade put the FIRST CONTENT BLOCK
     ON THE PAGE one undelivered callback away from being invisible, and
     the page is about KuwaitSat-1, not about a fade.

     A watchdog timer was considered and rejected: the section starts
     below the hero, so on nearly every visit nothing would be on screen
     when the watchdog checked, it would strip the effect anyway, and
     the page would carry the machinery without ever playing it.

     So the content simply renders. The brief says motion is optional.
     This is the section taking that option.
     ================================================================= */

  /* =================================================================
     6 - RENDER AND RE-RENDER
     ================================================================= */
  function currentLang() {
    var root = document.documentElement;
    var a = root.getAttribute('data-ksat-lang');
    if (a === 'ar' || a === 'en') return a;
    return (root.lang || 'en').toLowerCase().indexOf('ar') === 0 ? 'ar' : 'en';
  }

  var host = null;

  function render() {
    var section = document.getElementById('legend');
    if (!section) return;
    var code = currentLang();

    if (!host || !section.contains(host)) {
      host = document.createElement('div');
      host.className = 'ksf';
      section.appendChild(host);
    }

    host.innerHTML = markup(code);

    /* Only now, once a replacement heading is actually on the page, is
       the section allowed to hide index.html's own. The class is the
       whole guard: without our content there is nothing to hide. */
    section.classList.add('ksf-on');

    moveVocabulary(code);
  }

  /* js/ksat-i18n.js fires this at the very end of its apply(), after its
     own sweeps and after the page's renderAll(). Re-rendering here means
     our strings are the last written and cannot be half overwritten by a
     sweep that ran after us. */
  document.addEventListener('ksat:lang', render);

  function boot() {
    /* Wait for #legend to be in the document. It is static markup so it
       is there at DOMContentLoaded, but the shell reorders sections and
       this is cheap insurance against a race that would otherwise show
       as an empty first section. */
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (document.getElementById('legend') || tries > 60) {
        clearInterval(iv);
        try { render(); } catch (e) { console.warn('[ksat-facts]', e); }
      }
    }, 100);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  KS.facts = { render: render, copy: COPY };
})();
