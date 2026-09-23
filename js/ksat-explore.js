/* =====================================================================
   ksat-explore.js — THE EXPLORE PANEL, AND REAL DESTINATIONS BEHIND IT
   Companion to css/ksat-explore.css. Owner: 01 Front End.

   THE BRIEF, in the team's own words: "in here how when clicking on
   explore the way it is shown i want the exact same thing but for
   kuwait", and "make my explore botton the tabs inside it real, every
   tab takes me to its page and has content in it".

   =====================================================================
   THE ONE RULE THIS FILE IS WRITTEN AROUND
   =====================================================================
   NOT ONE FACT ON THIS PANEL IS WRITTEN BY ME. Every card headline is
   the literal heading of the section it opens, copied from index.html,
   or, for the one section js/ksat-facts.js takes over, from that file's
   own COPY read live at paint time; every meta line is either a figure
   out of the SPECS / SOURCES / CLAIMS / REGIONS / PILLARS arrays in
   index.html, or a structural fact this file counts at runtime from the
   live page. Every Arabic string is copied verbatim out of
   js/ksat-i18n.js's dictionary rather than translated here, so a card
   and its destination can never drift apart.

   AND A TRUE FIGURE ON THE WRONG CARD IS STILL A FALSE STATEMENT.
   Three meta lines shipped attached to sections that do not print them:
   the optics figures over #orbit, the NASA plate credit over the
   modelled #globe, and the not-claimed count over #trust. Every one was
   traceable, and every one told the reader something untrue about the
   page it opened. The long note above TOPICS has what was measured.

   There are no read times and no article dates on these cards, which is
   the one place this deliberately departs from nasa.gov's panel. NASA
   has real articles with real publication dates behind theirs. We have
   twelve sections. Inventing "4 min read" to complete the resemblance
   would put a fabricated number on the front page of a platform whose
   entire argument is that every number on it can be traced, and a
   plausible invented fact is worse here than a missing one.

   =====================================================================
   WHAT THIS SUPERSEDES IN js/ksat-minimal.js, EXACTLY
   =====================================================================
   That file owns the Explore button and it keeps owning it. Read its
   header before changing anything here. What changes:

     SUPERSEDED  Section 2's drawer. js/ksat-minimal.js turns
                 .ksat-nav-strip (the six chapter triggers from
                 js/ksat-nav.js) into the thing Explore opens.
                 css/ksat-explore.css hides that strip in the public
                 tier and this file mounts #ksat-ex in its place.
                 Nothing is removed: the strip is still built, still
                 filtered by tier, and the researcher's two row bar
                 still uses it, because both the hide rule and this
                 panel are scoped to the public tier.

     SUPERSEDED  Section 2b's tier filter, for the public reader. That
                 filter exists to pull SIGN-IN rows out of a menu built
                 from all twenty three sections. This panel is built
                 from a hand authored list of the twelve sections that
                 are actually in the public document, so there is
                 nothing to filter. The filter still runs and is still
                 correct; it just has no rows left to act on here.

     KEPT, AND RELIED ON  Everything else. The Explore button itself,
                 its aria-expanded, its chevron, its relabelling on
                 ksat:lang, its Escape handler (which also returns focus
                 to the trigger), and its click outside handler. This
                 file does not register a second Escape key listener and
                 does not register a second click outside listener. It
                 mirrors the root attribute js/ksat-minimal.js already
                 sets, data-ksat-min-explore, and drives the panel from
                 that. One source of truth for "is Explore open", owned
                 by the file that owns the button.

                 That is also why #ksat-ex is mounted INSIDE #ksat-nav
                 rather than beside it: js/ksat-minimal.js's click
                 outside guard is `if (nav.contains(e.target)) return`,
                 so being a child of #ksat-nav is what stops a click on
                 a topic from closing the panel out from under the
                 handler that is about to navigate. #ksat-nav is
                 position:static and .bar-in is position:relative, so an
                 absolutely positioned child still spans the full bar.
                 Both were measured in the live page before relying on
                 them, not assumed.

   =====================================================================
   NO SECOND ROUTER. THIS IS THE IMPORTANT ONE.
   =====================================================================
   js/ksat-shell.js owns chapters AND owns location.hash: goToSection()
   opens the owning chapter, scrolls, and pushes the hash, and its
   popstate / hashchange listeners read it back. Two things writing
   location.hash is a bug that stays invisible until a deep link lands
   on the wrong chapter, and that file's own header says so at length.

   So this file writes NOTHING to location.hash, registers no popstate
   and no hashchange listener, and has no view layer of its own. Every
   topic and every card is one call to KSAT.shell.goToSection(id). The
   destination "page" is the chapter the shell opens, which really does
   swap the document to a different set of sections. It reads the hash
   once at boot, to decide which topic starts underlined, and that is a
   read and never a write.
   ===================================================================== */

(function () {
  'use strict';

  var KS = window.KSAT = window.KSAT || {};
  if (KS.explore) return;

  var root = document.documentElement;

  /* index.html's data arrays are top level `const` in classic scripts,
     which puts them in the shared global lexical environment but NOT on
     window. So they are reachable by BARE NAME and not as window.SPECS.
     js/ksat-i18n.js leans on the same property to fill the page's AR
     object; its header explains why this is safe.

     THIS WAS A ONE LINE eval() FOR ABOUT TEN MINUTES AND WOULD HAVE
     SHIPPED BROKEN. vercel.json sends
     `script-src 'self' 'unsafe-inline'` with no 'unsafe-eval', so an
     eval here works on the local no-cache server, which sends no CSP at
     all, and throws on the deployed site. The lookup is therefore a
     switch over literal identifiers: same laziness, no eval, and every
     name this file depends on is listed in one readable place.

     Lazy rather than captured at load, because index.html calls
     SOURCES.push() three times from later inline scripts and a snapshot
     taken at the wrong moment would be short four sources. Guarded,
     because a future index.html is allowed to rename any of these and
     this panel must degrade rather than throw. */
  function P(name) {
    try {
      switch (name) {
        case 'SPECS':       return typeof SPECS       !== 'undefined' ? SPECS       : null;
        case 'SOURCES':     return typeof SOURCES     !== 'undefined' ? SOURCES     : null;
        case 'CLAIMS':      return typeof CLAIMS      !== 'undefined' ? CLAIMS      : null;
        case 'NOT_CLAIMED': return typeof NOT_CLAIMED !== 'undefined' ? NOT_CLAIMED : null;
        case 'REGIONS':     return typeof REGIONS     !== 'undefined' ? REGIONS     : null;
        case 'PILLARS':     return typeof PILLARS     !== 'undefined' ? PILLARS     : null;
        case 'SPEC_VAL_AR': return typeof SPEC_VAL_AR !== 'undefined' ? SPEC_VAL_AR : null;
        case 'srcChips':    return typeof srcChips    !== 'undefined' ? srcChips    : null;
      }
    } catch (e) {}
    return null;
  }

  function isRTL() { return root.getAttribute('dir') === 'rtl'; }
  function L(o) { return (isRTL() && o && o.ar) ? o.ar : (o ? o.en : ''); }
  function reduced() {
    try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  function el(tag, cls) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }


  /* ===================================================================
     1 · STRINGS

     Kept in this file, in both languages, because the layer they belong
     to knows nothing about them. The team has asked twice that English
     mode show no Arabic and Arabic mode show no English, so every entry
     here is a pair and nothing is ever rendered as "EN / AR".

     NO EM DASHES AND NO EN DASHES anywhere below. 361 of them came out
     of this codebase this morning after the team called that
     punctuation "too ai and fake". Commas and full stops. The hyphens
     that survive are the ones inside names: KuwaitSat-1, S-band,
     COSPAR 2023-001CY, and the page's own heading "An AI-powered
     environmental planning system", which is quoted and not authored.
     =================================================================== */
  var TXT = {
    panel:    { en: 'Explore the platform',        ar: 'استكشف المنصة' },
    featured: { en: 'Featured',                    ar: 'مختارات' },
    /* The imagery credit. assets/earth/CREDITS.txt is the long version;
       this is the short one the reader actually sees. */
    /* The language row. It names the language you would switch TO, so in
       English it reads Arabic and in Arabic it reads English, and each
       carries lang= so a screen reader changes voice for that one word
       without any Arabic appearing in the English build. */
    toAr:     { en: 'Arabic',                      ar: 'العربية' },
    toEn:     { en: 'English',                     ar: 'الإنجليزية' },
    toArA:    { en: 'Switch the platform to Arabic', ar: 'تحويل المنصة إلى العربية' },
    toEnA:    { en: 'Switch the platform to English', ar: 'تحويل المنصة إلى الإنجليزية' }
  };
  function t(k) { return L(TXT[k]); }


  /* ===================================================================
     2 · THE TOPICS

     DERIVED FROM WHAT THE PUBLIC DOCUMENT ACTUALLY HOLDS, which after
     this morning's pass is exactly twelve sections. Verified in the live
     page rather than read off CHAPTERS, because js/ksat-shell.js PARKS
     the ten researcher sections out of the DOM entirely for a signed out
     visitor, so CHAPTERS still lists ten ids that are not there:

       #top  #legend  #mission  #imagery  #system  #globe
       #orbit  #story  #vision  #trust  #sources  #finale

     Nothing here links to a researcher section. There is no SIGN-IN row,
     no locked row and no greyed row, because the team's instruction was
     "whatever tab that needs to be signed in in order to view it, dont
     put it in the website", and a row that exists only to say no is
     still putting it in the website.

     EIGHT DESTINATIONS PLUS A LANGUAGE ROW. The shape the brief
     suggested was Home, The Mission, Kuwait From Space, The Orbit,
     Kuwait's Space Programme, How This Works, Sources, Arabic. Two
     changes, both because a row has to lead somewhere real:

       "Kuwait's Space Programme" is NOT here. There is no page about
       Kuwait's space programme in the public document. The two sections
       that row would have had to open are #system, which is this
       platform's environmental planning system, and #vision, which is
       Kuwait Vision 2035 as published by the Ministry of Foreign
       Affairs. Calling either one "Kuwait's Space Programme" would be a
       promise the page cannot keep, and on this platform that is the
       expensive kind of mistake. The row is named A Greener Kuwait,
       which is what js/ksat-minimal.js already renames that chapter to
       for public readers.

       "The Story" is added, because #story and #finale sit in the
       record chapter and nothing else in the list reaches them.

     WHY EACH ROW LANDS WHERE IT DOES. A chapter is the unit the shell
     shows, so the landing section decides which chapter opens and the
     rest of that chapter comes with it. Between them the nine rows and
     their cards reach all twelve public sections, which was the test:

       Home            #top      chapter brief     also legend, mission
       The Mission     #mission  chapter brief
       Kuwait From
         Space         #imagery  chapter space     also globe, orbit
       The Orbit       #orbit    chapter space
       A Greener
         Kuwait        #system   chapter planning  also vision
       How This Works  #trust    chapter agents
       The Story       #story    chapter record    also sources, finale
       Sources         #sources  chapter record

     How This Works pointing at #trust rather than at #legend is not a
     guess: js/ksat-minimal.js's PUBLIC_NAME table already renames the
     agents chapter to "How This Works" for public readers, and #trust is
     the only section in it. Following an existing decision beats making
     a second one. #legend is reachable as a card from two topics.
     =================================================================== */

  /* Section headings, quoted. English is the literal text of the <h2> in
     index.html; Arabic is the literal value from the dictionary in
     js/ksat-i18n.js, by key, so the two can never disagree. The key is
     recorded beside each one so the next person can check. */
  var H = {
    top:     { en: 'From Space to a Greener Kuwait',                   ar: 'من الفضاء إلى كويت أكثر اخضراراً' },   /* hero.h1a + hero.h1b */
    legend:  { en: 'Every panel declares what it is',                  ar: 'كل لوحة تُعلن عن طبيعتها' },            /* leg.h   */
    /* NOT mis.h ANY MORE, and js/ksat-home.js's H map says the same in
       the same words. #mission's own heading is hidden for the public
       tier and the section is now one photograph: the team who built
       the satellite. A card that promises "KuwaitSat-1 on the record"
       and lands on a group portrait is a card that lied. */
    mission: { en: 'The team who built it',                            ar: 'الفريق الذي بناه' },
    imagery: { en: 'Captured From Space',                              ar: 'مُلتقَط من الفضاء' },                   /* img.h   */
    system:  { en: 'An AI-powered environmental planning system',      ar: 'نظام تخطيط بيئي مدعوم بالذكاء الاصطناعي' }, /* sys.h */
    globe:   { en: 'Kuwait From Above',                                ar: 'الكويت من الأعلى' },                   /* d3.h    */
    orbit:   { en: 'Where Is KuwaitSat?',                              ar: 'أين كويت سات؟' },                      /* orb.h   */
    story:   { en: 'A Greener Kuwait Starts From Above',               ar: 'كويت أكثر اخضراراً تبدأ من الأعلى' },   /* st.h    */
    vision:  { en: "Aligned with Kuwait's sustainability ambitions",   ar: 'متوائمة مع طموحات الاستدامة في الكويت' }, /* v35.h */
    trust:   { en: 'What this system will not do',                     ar: 'ما لن يفعله هذا النظام' },             /* gr.h    */
    sources: { en: 'Sources and data provenance',                      ar: 'المصادر ومنشأ البيانات' },             /* src.h, ampersand spelled out */
    finale:  { en: 'From space to a greener Kuwait',                   ar: 'من الفضاء إلى كويت أكثر خضرة' }        /* the finale line, sentence case */
  };

  /* #legend IS NOT ALWAYS THE PROVENANCE LEGEND, AND A CARD THAT SAID IT
     WAS PUT A FALSE HEADLINE ON THE FRONT PAGE.

     Caught in the browser with both files loaded. js/ksat-facts.js, the
     other half of this pair, MOVES the five badge cards out of #legend
     and down into #sources, and builds the KuwaitSat-1 published record
     into #legend in their place, hiding index.html's own <h2> through
     `#legend.ksf-on > h2.st[data-i18n="leg.h"]`. Measured after that ran:

         #legend h2.st        computed display: none
         #legend .ksf-h2      "What Kuwait put in orbit"
         .legt closest section              "sources"

     The Explore card still read "Every panel declares what it is" and
     "The provenance legend, five badges", and landed the reader on a
     page about the satellite. On a platform whose entire argument is
     that a headline can be trusted to match its page, that is the
     expensive kind of wrong.

     So the legend card resolves at PAINT time rather than at build time,
     because the order of the two files is not guaranteed: this one boots
     on DOMContentLoaded and that one polls on a 100ms interval until
     #legend exists, so either can be first. Both strings below are
     quoted, not authored: the English is js/ksat-facts.js's COPY.h2 and
     the Arabic is its COPY.h2.ar, read live off KSAT.facts.copy when
     that file is present so the two can never drift apart.

     NO META LINE IN THAT STATE. The facts panel's own figures are all
     SPECS rows that #mission already carries, and there is no count on
     it this file can assert against an array in index.html. The rule
     this whole file is written under says a card carries one fewer line
     rather than a guess, so it carries one fewer line. */
  var H_FACTS = { en: 'What Kuwait put in orbit', ar: 'ما الذي وضعته الكويت في المدار' };

  function legendTaken() {
    var s = document.getElementById('legend');
    return !!(s && s.classList.contains('ksf-on'));
  }

  /* The headline of a card, quoted from the destination. Only #legend
     has two possible answers today; everything else reads straight out
     of the table above. */
  function headline(id) {
    if (id === 'legend' && legendTaken()) {
      var live = (KS.facts && KS.facts.copy && KS.facts.copy.h2) || H_FACTS;
      return L(live);
    }
    return L(H[id]);
  }

  /* Meta lines. Each one is traceable. The comment on each says where.
     Anything that would have needed a fact I could not trace is simply
     not here, and the card carries one fewer line rather than a guess. */
  var M = {
    /* mis.specn, the page's own wording for the SPECS table. Count is
       asserted against SPECS.length at build time, below. */
    spec:    { en: 'Twelve published entries, each with its source',   ar: 'اثنتا عشرة مدخلة منشورة، ولكل منها مصدرها' },
    /* CLAIMS entry 5: "five consecutive frames", and SPECS spec.first:
       "First image series captured 5 April 2023". Sources [3] and [4]. */
    frames:  { en: 'Five frames, 5 April 2023',                        ar: 'خمسة إطارات، 5 أبريل 2023' },
    /* SPECS spec.gsd and spec.sw. Sources [3] and [4].
       ONLY EVER ON THE #imagery CARD. See the note on TOPICS below: both
       figures are printed in #imagery and neither is printed in #orbit,
       and a meta line is read as a description of the page it opens. */
    optics:  { en: '39 m ground sample distance, 80 km swath',         ar: 'دقة عيّنة أرضية 39 متراً، وعرض مسح 80 كم' },
    /* NOT_CLAIMED entry 3, verbatim in substance: the orbit readout is
       not live, it is a circular two body model on nominal deployment
       parameters. Said as a virtue rather than as a disclaimer. */
    model:   { en: 'A circular two body model, not live telemetry',    ar: 'نموذج ثنائي الجسم دائري، وليس قياساً حيّاً' },
    /* Counted from the page at runtime; see countLegend(). Withheld
       entirely when js/ksat-facts.js has moved the badges out of
       #legend, because then it describes a different section. */
    legend:  { en: 'The provenance legend, five badges',               ar: 'دليل المنشأ، خمس شارات' },
    /* REGIONS.length, the reference dataset's governorates. True of
       #globe, which extrudes exactly those six and names them on
       screen, and of #system, which scores them. */
    regions: { en: 'Six governorates in the reference dataset',        ar: 'ست محافظات في مجموعة البيانات المرجعية' },
    /* PILLARS.length and source [9], Ministry of Foreign Affairs. */
    v2035:   { en: 'Kuwait Vision 2035, seven official pillars',       ar: 'رؤية كويت 2035، سبع ركائز رسمية' },
    /* SOURCES.length and CLAIMS.length; both asserted at build time. */
    srcs:    { en: 'Sixteen sources behind nine claims',               ar: 'ستة عشر مصدراً خلف تسعة ادعاءات' },
    /* NOT_CLAIMED.length. */
    notclaim:{ en: 'Six things this platform does not claim',          ar: 'ستة أمور لا تدّعيها هذه المنصة' },
    /* Structural, and true: those are the sections in the record
       chapter. Counted at runtime by countChapter('story'). */
    record:  { en: 'The story, the sources and the closing statement', ar: 'القصة والمصادر والخاتمة' },
    /* Structural: the finale is the last section of the public page. */
    closing: { en: 'The closing statement',                            ar: 'الخاتمة' }
  };

  /* art keys map to real files and nothing else. 'wide' and 'disk' pick
     the day or the night plate from the reader's theme; 'mark' is the
     project's own emblem. There is no fourth option, because there is no
     fourth real image. */
  /* EVERY META LINE BELOW WAS CHECKED AGAINST THE SECTION IT OPENS, IN
     THE BROWSER, AND THREE OF THEM WERE WRONG.

     A meta line sits under the headline and reads as a description of
     the destination. Each one here was true of the record; three of
     them were true of a DIFFERENT PAGE than the one the card opened,
     which is the "right figure, wrong event" mistake the brief warns
     about. What the live sections actually print:

       #orbit    Altitude, Velocity, Orbital period, Inclination, Lat,
                 Lon, Range to Kuwait, Orbit position, Pass status. NO
                 ground sample distance and NO swath anywhere in the
                 section. It carried "39 m ground sample distance, 80 km
                 swath" on two topics. Now it carries "A circular two
                 body model, not live telemetry", which is the section's
                 own sentence: "outputs of a circular two-body model
                 with a fixed inclination, not measurements".
                 The optics line moves to #imagery, which prints both.

       #globe    "Kuwait From Above", badged "◈ Modelled": the six
                 governorates extruded by the selected metric. It is not
                 imagery at all. It carried "NASA Blue Marble and Black
                 Marble composites", which told a reader that this
                 platform's own modelled surface was a NASA photograph.
                 That is the single worst sentence this panel could
                 print, so that meta key is gone. The NASA attribution
                 was never carried by it anyway: the credit line at the
                 foot of the panel states it in full, on every topic.
                 #globe now carries REGIONS.length, which it does show.

       #trust    "What this system will not do" is the agent guardrails,
                 eighteen of them. The six NOT_CLAIMED entries are not
                 here: #notClaim renders inside #sources. So the
                 "Six things this platform does not claim" line moves to
                 a #sources card, and the #trust cards carry no meta
                 line, because there is no count in that section this
                 file can assert against an array in index.html and the
                 rule is a missing line over a guessed one. */
  /* ART IS ASSIGNED UNDER TWO RULES, AND BOTH ARE ABOUT THE READER.

     1 · NO PLATE APPEARS TWICE IN ONE TOPIC. Three cards side by side
         carrying two copies of the same globe is the thing that made
         this panel look generated. Checked by eye against the list
         below, topic by topic; it is eight short rows and a test that
         asserts it would be longer than the data.

     2 · THE PLATE IS ABOUT THE DESTINATION. #orbit gets the low-angle
         shot where the curve of Earth is across the top, because that
         is what an orbit looks like from inside one. #imagery gets the
         closest framing, because that section is about what a frame
         contains. #mission gets the flight unit, because #mission is
         about the spacecraft and the spacecraft is the one thing in
         this panel that is not a picture of the Earth.

     The emblem key stays in ART and is no longer assigned to anything.
     It was standing in for four different sections, and a logo on a
     card tells a reader nothing about where the card goes. */
  var TOPICS = [
    { key: 'home',    sec: 'top',
      name: { en: 'Home',               ar: 'الرئيسية' },
      cards: [
        { sec: 'mission', art: 'team', meta: null },
        { sec: 'imagery', art: 'near', meta: 'frames' },
        /* `region` was here and was pulled after looking at the row:
           near and region are both wide night views over the same
           coast and, at 332px, they read as the same picture printed
           twice. Rule 1 is about what the eye sees, not about what the
           filenames say. The limb plate is the one framing in the set
           that is unmistakably a different shot. */
        { sec: 'sources', art: 'limb', meta: 'srcs' }
      ] },

    { key: 'mission', sec: 'mission',
      name: { en: 'The Mission',        ar: 'المهمة' },
      cards: [
        { sec: 'mission', art: 'team', meta: null },
        { sec: 'legend',  art: 'term', meta: 'legend' },
        { sec: 'orbit',   art: 'low',  meta: 'model' }
      ] },

    /* sec was 'imagery' and is now 'globe'. css/ksat-spacecraft.css
       takes #imagery off the public tier — the team quoted its whole
       acquisition record back and said delete it — and a topic row
       whose destination is gone drops out of the menu entirely, which
       would have cost the public menu a whole chapter. #globe is
       "Kuwait From Above", it is public, and it is the section this
       topic is actually about. The imagery CARD below stays in the
       list: reachable() drops it on the public tier and a signed-in
       researcher, who still has that section, still gets it. */
    { key: 'space',   sec: 'globe',
      name: { en: 'Kuwait From Space',  ar: 'الكويت من الفضاء' },
      cards: [
        { sec: 'imagery', art: 'near', meta: 'optics' },
        { sec: 'globe',   art: 'gulf', meta: 'regions' },
        { sec: 'orbit',   art: 'limb', meta: 'model' }
      ] },

    { key: 'orbit',   sec: 'orbit',
      name: { en: 'The Orbit',          ar: 'المدار' },
      cards: [
        { sec: 'orbit',   art: 'low',  meta: 'model' },
        { sec: 'globe',   art: 'disk', meta: 'regions' }
      ] },

    { key: 'green',   sec: 'system',
      name: { en: 'A Greener Kuwait',   ar: 'كويت أكثر خضرة' },
      cards: [
        { sec: 'system',  art: 'region', meta: 'regions' },
        { sec: 'vision',  art: 'near',   meta: 'v2035' }
      ] },

    { key: 'works',   sec: 'trust',
      name: { en: 'How This Works',     ar: 'كيف يعمل هذا' },
      cards: [
        { sec: 'trust',   art: 'term', meta: null },
        { sec: 'legend',  art: 'limb', meta: 'legend' },
        { sec: 'sources', art: 'gulf', meta: 'notclaim' }
      ] },

    { key: 'story',   sec: 'story',
      name: { en: 'The Story',          ar: 'القصة' },
      cards: [
        { sec: 'story',   art: 'wide', meta: 'record' },
        { sec: 'finale',  art: 'disk', meta: 'closing' }
      ] },

    { key: 'sources', sec: 'sources',
      name: { en: 'Sources',            ar: 'المصادر' },
      cards: [
        { sec: 'sources', art: 'region', meta: 'srcs' },
        { sec: 'trust',   art: 'term',   meta: null }
      ] }
  ];

  var BY_KEY = {};
  TOPICS.forEach(function (x) { BY_KEY[x.key] = x; });


  /* ===================================================================
     2b · THE COUNTS ARE CHECKED, NOT TRUSTED

     Four meta lines above carry a number: twelve SPECS rows, sixteen
     sources, nine claims, six not-claimed entries, six governorates,
     seven pillars. Those numbers are true of index.html as it stands
     today and index.html moves constantly. If somebody adds a source
     and the card still says sixteen, this panel has put a wrong number
     on the front page, which is the exact failure the platform exists
     to prevent.

     So they are asserted against the live arrays at build time. A
     mismatch drops the meta line rather than printing it, and warns
     once in the console with the name of the array that moved. Silence
     is the wrong failure mode here; a missing line is the right one.
     =================================================================== */
  var EXPECT = [
    ['spec',     'SPECS',       12],
    ['srcs',     'SOURCES',     16],
    ['srcs',     'CLAIMS',       9],
    ['notclaim', 'NOT_CLAIMED',  6],
    ['regions',  'REGIONS',      6],
    ['v2035',    'PILLARS',      7]
  ];
  var stale = {};
  function checkCounts() {
    EXPECT.forEach(function (row) {
      var arr = P(row[1]);
      if (!arr || typeof arr.length !== 'number') return;   /* renamed away: leave it alone */
      if (arr.length !== row[2]) {
        stale[row[0]] = true;
        console.warn('[ksat-explore] ' + row[1] + '.length is ' + arr.length +
                     ', the Featured meta line was written for ' + row[2] +
                     '. That line is being withheld rather than printed wrong.');
      }
    });
  }

  /* The badge count, read off the page instead of hard coded, for the
     same reason.

     TWO BUGS FIXED HERE, BOTH FOUND WITH THE OTHER FILE LOADED.

     It used to ask for `#legend .legt`, and `if (n && n !== 5)` treated
     a count of ZERO as "fine". Those two together are the exact hole
     this guard exists to close: js/ksat-facts.js moves the five cards
     out of #legend and into #sources, so the selector returns 0, zero
     is falsy, the guard passes, and the card prints "five badges" on
     the strength of having found none. A guard that cannot fail is not
     a guard.

     So the count is document wide. The cards are MOVED and never
     deleted, which that file says at length and which was confirmed on
     the page: five .legt nodes, closest section "sources". Counting
     them wherever they live answers the only question the meta line
     actually asks, which is whether there are still five of them. And
     any answer other than five, zero included, withholds the line. */
  function countLegend() {
    if (document.querySelectorAll('.legt').length !== 5) stale.legend = true;
  }

  function meta(k, sec) {
    if (!k || stale[k]) return null;
    /* The provenance line belongs to whichever section holds the
       badges. Once js/ksat-facts.js has taken #legend over, that card
       is the satellite record and the line would describe a section the
       reader is not being sent to. */
    if (k === 'legend' && sec === 'legend' && legendTaken()) return null;
    return L(M[k]);
  }


  /* ===================================================================
     3 · ART

     Four real plates and one real emblem. assets/earth/CREDITS.txt has
     the full provenance: NASA Blue Marble (day) and Black Marble
     (night), public domain, reprojected onto a sphere by this project
     and aimed at 29.3 N 47.7 E. Nothing was painted in.

     The plates come in day and night pairs and the public masthead is
     dark in both themes, but the PAGE is not, and a day page with night
     cards under it looks like a loading error. So the plate follows the
     page's theme, and swaps when the reader changes it.
     =================================================================== */
  /* NINE PLATES, NOT THREE.

     The team, holding our Explore panel beside nasa.gov's: "see how when
     clicking on the explore botton — the quality of work is 4k".

     The shape was already right. What was wrong was that twenty-one
     cards across eight topics were drawing on THREE images, so opening
     two topics in a row showed the same globe twice and the same limb
     twice, and the panel read as a template with the same picture
     dropped into every slot. On nasa.gov every card in that drawer is a
     different photograph, and that — more than any spacing or type
     decision — is what makes the panel look considered.

     assets/cards/ already held six plates that nothing was using, each
     a different framing and a different altitude over the same region.
     They are all here now, and so is the flight unit photograph, which
     is the one card in the panel that is not a picture of the Earth and
     is the better for it.

     Keys are named for the SHOT, not for the section, because the same
     plate is correct for more than one destination and a key called
     `missionCard` would be a lie the first time it moved. */
  var ART = {
    wide:   { day: 'assets/earth/earth-day.jpg',  night: 'assets/earth/earth-night.jpg',  w: 2400, h: 1100 },
    disk:   { day: 'assets/earth/globe-day.jpg',  night: 'assets/earth/globe-night.jpg',  w: 1400, h: 1400 },
    mark:   { day: 'assets/brand/ksat-emblem-256.png', night: 'assets/brand/ksat-emblem-256.png', w: 256, h: 256 },

    /* The hardware. Transparent PNG, one file for both themes — it is a
       cut-out object rather than a lit scene, so there is no day plate
       and no night plate to choose between. `fit: contain` for the same
       reason the emblem needs it: cover would crop the antennas off. */
    unit:   { day: 'assets/cards/ksat1-flight-unit.png',
              night: 'assets/cards/ksat1-flight-unit.png', w: 752, h: 454, fit: 'contain' },
    /* The section it labels is now a photograph of the team, so the
       card carries that photograph. */
    team:   { day: 'assets/cards/ksat1-team.webp',
              night: 'assets/cards/ksat1-team.webp', w: 770, h: 513 },

    near:   { day: 'assets/cards/card-kuwait-day.jpg',    night: 'assets/cards/card-kuwait-night.jpg',    w: 1200, h: 900 },
    gulf:   { day: 'assets/cards/card-gulf-day.jpg',      night: 'assets/cards/card-gulf-night.jpg',      w: 1200, h: 900 },
    region: { day: 'assets/cards/card-region-day.jpg',    night: 'assets/cards/card-region-night.jpg',    w: 1200, h: 900 },
    low:    { day: 'assets/cards/card-limb-low-day.jpg',  night: 'assets/cards/card-limb-low-night.jpg',  w: 1200, h: 900 },
    term:   { day: 'assets/cards/card-terminator-day.jpg',night: 'assets/cards/card-terminator-night.jpg',w: 1200, h: 900 },
    limb:   { day: 'assets/cards/feature-limb-day.jpg',   night: 'assets/cards/feature-limb-night.jpg',   w: 1600, h: 1200 }
  };
  /* Alt text describes the PLATE, never the destination, and never
     claims a region. earth-night.jpg is a limb view whose lit half is
     mostly Europe; saying "Kuwait from orbit" over it would be a caption
     that does not match its picture.

     THE DAY AND NIGHT PLATES NEEDED SEPARATE WORDS, which only became
     obvious once the night plate was actually opened and looked at.
     One alt string served both, and it said "lit from one side". That
     is a fair description of earth-day.jpg. earth-night.jpg is the
     Black Marble composite: what is visible on it is city lights on the
     unlit hemisphere, with an atmospheric rim. Nothing on it is lit
     from one side, so for half the readers of this page the alt text
     described a picture that was not there.

     assets/earth/CREDITS.txt is the authority for both: Blue Marble
     Next Generation for the day plate, Earth at Night 2012 for the
     night one, each reprojected onto a sphere by this project. */
  var ALT = {
    wide: {
      day:   { en: 'NASA Blue Marble composite of Earth, reprojected onto a sphere and lit from one side.',
               ar: 'مركّب Blue Marble من ناسا للأرض، أُعيد إسقاطه على كرة وأُضيء من جهة واحدة.' },
      night: { en: 'NASA Black Marble composite of Earth at night, reprojected onto a sphere, city lights along the limb.',
               ar: 'مركّب Black Marble من ناسا للأرض ليلاً، أُعيد إسقاطه على كرة، وأضواء المدن على الحافة.' }
    },
    disk: {
      day:   { en: 'NASA Blue Marble composite of the full disk of Earth, with the Gulf near the centre.',
               ar: 'مركّب Blue Marble من ناسا لقرص الأرض الكامل، والخليج قرب المركز.' },
      night: { en: 'NASA Black Marble composite of the full disk of Earth at night, with the Gulf near the centre.',
               ar: 'مركّب Black Marble من ناسا لقرص الأرض الكامل ليلاً، والخليج قرب المركز.' }
    },
    mark: {
      day:   { en: 'The KuwaitSat Vision emblem.', ar: 'شعار كويت سات فيجن.' },
      night: { en: 'The KuwaitSat Vision emblem.', ar: 'شعار كويت سات فيجن.' }
    },

    /* WRITTEN AFTER OPENING EVERY PLATE AND LOOKING AT IT, day and night
       separately, as a contact sheet. The note at the top of this map
       says alt text describes the plate and never claims a region it
       cannot see; these six do name regions, because in these six the
       regions are plainly there in both phases. The night plates are
       NASA Black Marble and the day plates NASA Blue Marble, reprojected
       onto a sphere — the same provenance the two originals carry, and
       it is in assets/earth/CREDITS.txt. */
    unit: {
      day:   { en: 'KuwaitSat-1: a black anodised CubeSat frame with four deep blue solar faces, a circuit board on the top deck and four thin whip antennas.',
               ar: 'كويت سات-١: هيكل مكعّب أسود مؤكسد بأربعة أوجه شمسية زرقاء داكنة، ولوحة إلكترونية على السطح العلوي، وأربعة هوائيات رفيعة.' },
      night: { en: 'KuwaitSat-1: a black anodised CubeSat frame with four deep blue solar faces, a circuit board on the top deck and four thin whip antennas.',
               ar: 'كويت سات-١: هيكل مكعّب أسود مؤكسد بأربعة أوجه شمسية زرقاء داكنة، ولوحة إلكترونية على السطح العلوي، وأربعة هوائيات رفيعة.' }
    },
    near: {
      day:   { en: 'NASA Blue Marble composite: the Arabian peninsula filling the frame, the Red Sea on one side and the Gulf on the other.',
               ar: 'مركّب Blue Marble من ناسا: شبه الجزيرة العربية تملأ الإطار، والبحر الأحمر من جهة والخليج من الأخرى.' },
      night: { en: 'NASA Black Marble composite at night: the Gulf coast picked out in a continuous line of city light, the desert dark behind it.',
               ar: 'مركّب Black Marble من ناسا ليلاً: ساحل الخليج مرسوم بخط متصل من أضواء المدن، والصحراء مظلمة خلفه.' }
    },
    gulf: {
      day:   { en: 'NASA Blue Marble composite: the Gulf at the centre, Arabia to the west and the Indian subcontinent to the east.',
               ar: 'مركّب Blue Marble من ناسا: الخليج في المركز، والجزيرة العربية غرباً وشبه القارة الهندية شرقاً.' },
      night: { en: 'NASA Black Marble composite at night: Arabia dark between two coastlines of city light.',
               ar: 'مركّب Black Marble من ناسا ليلاً: الجزيرة العربية مظلمة بين ساحلين من أضواء المدن.' }
    },
    region: {
      day:   { en: 'NASA Blue Marble composite: a wide view from the Horn of Africa across Arabia to the Indian subcontinent.',
               ar: 'مركّب Blue Marble من ناسا: مشهد واسع من القرن الأفريقي عبر الجزيرة العربية إلى شبه القارة الهندية.' },
      night: { en: 'NASA Black Marble composite at night: the same span, with the Nile, the Gulf and the Indian coast drawn in light.',
               ar: 'مركّب Black Marble من ناسا ليلاً: المدى نفسه، والنيل والخليج والساحل الهندي مرسومة بالضوء.' }
    },
    low: {
      day:   { en: 'NASA Blue Marble composite seen at a low angle, with the curve of Earth across the top of the frame.',
               ar: 'مركّب Blue Marble من ناسا بزاوية منخفضة، وانحناء الأرض يعبر أعلى الإطار.' },
      night: { en: 'NASA Black Marble composite at night, seen at a low angle, the Caspian dark at the centre and the Gulf below it.',
               ar: 'مركّب Black Marble من ناسا ليلاً بزاوية منخفضة، وبحر قزوين مظلم في المركز والخليج تحته.' }
    },
    term: {
      day:   { en: 'NASA Blue Marble composite: the snow of the Himalaya at the top of the frame, Arabia at the foot of it.',
               ar: 'مركّب Blue Marble من ناسا: ثلوج الهيمالايا أعلى الإطار، والجزيرة العربية في أسفله.' },
      night: { en: 'NASA Black Marble composite at night: the lit coast running away toward the horizon.',
               ar: 'مركّب Black Marble من ناسا ليلاً: الساحل المضاء يمتدّ بعيداً نحو الأفق.' }
    },
    limb: {
      day:   { en: 'NASA Blue Marble composite of the limb: the curve of the planet against black, Europe and the Mediterranean along it.',
               ar: 'مركّب Blue Marble من ناسا لحافة الأرض: انحناء الكوكب على سواد، وأوروبا والبحر المتوسط على امتداده.' },
      night: { en: 'NASA Black Marble composite of the limb at night: city light along the curve, the atmosphere a thin blue line above it.',
               ar: 'مركّب Black Marble من ناسا لحافة الأرض ليلاً: أضواء المدن على الانحناء، والغلاف الجوي خط أزرق رفيع فوقها.' }
    }
  };
  function isNight() {
    var a = root.getAttribute('data-theme');
    if (a === 'light') return false;
    if (a === 'dark') return true;
    try { return matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) { return true; }
  }
  function artSrc(k) { return ART[k][isNight() ? 'night' : 'day']; }
  function artAlt(k) { return L(ALT[k][isNight() ? 'night' : 'day']); }


  /* ===================================================================
     4 · NAVIGATE

     One call, into the router that already exists. KSAT.shell.goToSection
     opens the owning chapter if it is not the open one, scrolls to the
     section's own heading rather than the top of its padding, and
     replaces the hash. Nothing here touches location.
     =================================================================== */
  function go(id) {
    var sh = KS.shell;
    if (!sh || typeof sh.goToSection !== 'function') return false;
    if (!document.getElementById(id)) return false;       /* parked, or renamed */
    var ok = sh.goToSection(id);
    if (ok === false) return false;

    close();

    /* FOCUS HAS TO LAND SOMEWHERE OR THE KEYBOARD READER IS STRANDED.
       Closing the panel destroys the focused element's visibility, and
       js/ksat-minimal.js only restores focus to the trigger on Escape,
       which is correct for Escape and wrong for a navigation. So focus
       moves to the destination's heading. tabindex="-1" makes a heading
       focusable without putting it in the tab order, and it is left in
       place afterwards because setting it again on the next visit costs
       nothing and removing it mid scroll is what caused the jump the
       first time this was tried. preventScroll because goToSection is
       already doing a smooth scroll and two scrollers fighting is a
       visible stutter. */
    var s = document.getElementById(id);
    var h = s.querySelector('h2, h3') || s;
    /* focus() on a display:none element is a no-op, and this panel
       closes straight afterwards — so a heading hidden for the public
       tier strands a keyboard reader on a destroyed node, which is the
       precise failure the note above says this exists to prevent. Same
       test as js/ksat-shell.js's scroll anchor. */
    if (h !== s && !h.getClientRects().length) { h = s; }
    if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1');
    setTimeout(function () {
      try { h.focus({ preventScroll: true }); } catch (e) { try { h.focus(); } catch (e2) {} }
    }, reduced() ? 0 : 260);
    return true;
  }


  /* ===================================================================
     5 · BUILD
     =================================================================== */
  var panel = null, list = null, cardWrap = null, cardHead = null, navBox = null;
  var activeKey = TOPICS[0].key;      /* which row is underlined */
  var shownKey  = null;               /* which row's cards are on screen */

  function build() {
    var nav = document.getElementById('ksat-nav');
    if (!nav || document.getElementById('ksat-ex')) return false;

    panel = el('div');
    panel.id = 'ksat-ex';
    panel.hidden = true;

    var inner = el('div', 'ksat-ex-in');

    navBox = el('nav', 'ksat-ex-topics');
    list = el('ul');
    navBox.appendChild(list);

    var feat = el('div', 'ksat-ex-feat');
    cardHead = el('p', 'ksat-ex-feat-h');
    cardHead.id = 'ksat-ex-feat-h';
    cardWrap = el('ul', 'ksat-ex-cards');
    cardWrap.setAttribute('aria-labelledby', 'ksat-ex-feat-h');
    feat.appendChild(cardHead);
    feat.appendChild(cardWrap);


    inner.appendChild(navBox);
    inner.appendChild(feat);
    panel.appendChild(inner);

    /* Inside #ksat-nav on purpose. See the header: this is what makes
       js/ksat-minimal.js's click outside guard leave the panel alone. */
    nav.appendChild(panel);

    buildRows();
    paint();
    adoptButton();
    return true;
  }

  /* The trigger's aria-controls pointed at .ksat-nav-strip, which is now
     hidden. Repointing it is the difference between a screen reader
     saying "collapsed, controls a thing that is not displayed" and
     saying what is actually about to open. js/ksat-minimal.js sets it
     again whenever it rebuilds, which is why watch() re-applies. */
  function adoptButton() {
    var b = document.getElementById('ksat-min-explore');
    if (b) b.setAttribute('aria-controls', 'ksat-ex');
  }

  /* A DESTINATION HAS TO BE IN THE DOCUMENT AND ALSO ON THE SCREEN.

     getElementById was enough while the only way a section left the
     public page was being parked out of the DOM. It is not enough now:
     css/ksat-spacecraft.css takes #imagery off the public tier with
     display:none, and the node is deliberately still there both for
     js/ksat-shell.js and for a signed-in researcher. A card or a topic
     row pointing at it would open the panel, scroll, and land the
     reader on nothing.

     getComputedStyle on a handful of elements, only while this panel is
     being painted, is not a cost worth optimising away. It also covers
     every future case of the same shape without anyone having to
     remember the rule. */
  function reachable(id) {
    var n = document.getElementById(id);
    if (!n) return false;
    try { return getComputedStyle(n).display !== 'none'; }
    catch (e) { return true; }
  }

  function buildRows() {
    list.innerHTML = '';

    TOPICS.forEach(function (topic) {
      /* A row whose destination is not reachable does not appear. A
         menu that quietly loses a row beats a menu with a row that goes
         nowhere. */
      if (!reachable(topic.sec)) return;

      var li = el('li');
      var b = el('button', 'ksat-ex-topic');
      b.type = 'button';
      b.setAttribute('data-key', topic.key);
      b.tabIndex = -1;                       /* roving; set properly in paint() */
      li.appendChild(b);
      list.appendChild(li);
    });

    /* The language row, set apart by a rule above it, exactly as
       nasa.gov sets Espanol apart from its topics. */
    var li2 = el('li', 'ksat-ex-sep');
    var lb = el('button', 'ksat-ex-topic');
    lb.type = 'button';
    lb.setAttribute('data-act', 'lang');
    lb.tabIndex = -1;
    li2.appendChild(lb);
    list.appendChild(li2);
  }

  function rows() { return Array.prototype.slice.call(list.querySelectorAll('.ksat-ex-topic')); }

  /* paint() writes every user visible string. It runs on build, on
     ksat:lang and on ksat:chapter, so there is exactly one place where
     language and state reach the DOM and no string is cached anywhere
     against a language it was first rendered in. That caching bug is
     written up in js/ksat-shell.js and is worth not repeating. */
  function paint() {
    navBox.setAttribute('aria-label', t('panel'));
    cardHead.textContent = t('featured');

    var ar = isRTL();
    rows().forEach(function (b) {
      var key = b.getAttribute('data-key');
      if (key) {
        b.textContent = L(BY_KEY[key].name);
        var on = (key === activeKey);
        if (on) b.setAttribute('aria-current', 'page');
        else    b.removeAttribute('aria-current');
        b.tabIndex = on ? 0 : -1;
        b.removeAttribute('lang');
      } else {
        /* The language row names the language you switch TO. lang= on
           the button is what keeps a screen reader from reading the
           Arabic word with an English voice, and it is removed again in
           the Arabic build where the word is English. */
        b.textContent = ar ? t('toEn') : t('toAr');
        b.setAttribute('aria-label', ar ? t('toEnA') : t('toArA'));
        b.setAttribute('lang', ar ? 'en' : 'ar');
        b.tabIndex = -1;
      }
    });

    /* If nothing is underlined, the first row takes the tab stop, or the
       column has no way in from the keyboard at all. */
    if (!list.querySelector('[aria-current="page"]')) {
      var first = list.querySelector('.ksat-ex-topic[data-key]');
      if (first) first.tabIndex = 0;
    }

    paintCards(shownKey || activeKey, true);
  }

  /* The cards follow whichever row the reader is pointing at or has
     focused, and fall back to the row that is underlined. force skips
     the "already showing" check, which is what a language switch needs.

     aria-live is deliberately NOT set on this region. The cards are a
     preview that changes on hover and on arrow key, and announcing three
     headlines every time focus moves down one row would make the column
     unusable with a screen reader. The cards are reachable with Tab and
     announce themselves when they get there. */
  function paintCards(key, force) {
    var topic = BY_KEY[key];
    if (!topic) return;
    if (!force && shownKey === key) return;
    shownKey = key;

    var live = topic.cards.filter(function (c) { return reachable(c.sec); });
    cardWrap.setAttribute('data-count', String(live.length));
    cardWrap.innerHTML = '';

    live.forEach(function (c) {
      var li = el('li');
      var b = el('button', 'ksat-ex-card');
      b.type = 'button';
      b.setAttribute('data-sec', c.sec);
      b.setAttribute('data-art', c.art);
      /* A cut-out object has to be contained; a photograph of a scene
         has to be covered. The stylesheet used to know which was which
         by naming the one exception (data-art="mark"), which stopped
         being true the moment a second cut-out was added. The map says
         it now, and the stylesheet reads it off the element. */
      if (ART[c.art] && ART[c.art].fit) { b.setAttribute('data-fit', ART[c.art].fit); }

      var art = el('span', 'ksat-ex-card-art');
      var img = el('img');
      img.src = artSrc(c.art);
      img.width = ART[c.art].w;
      img.height = ART[c.art].h;
      img.alt = artAlt(c.art);
      img.loading = 'lazy';
      img.decoding = 'async';
      art.appendChild(img);

      var h = el('span', 'ksat-ex-card-h');
      h.textContent = headline(c.sec);

      b.appendChild(art);
      b.appendChild(h);

      /* A meta line only appears when its number is still true of the
         page. checkCounts() is what decides that. */
      var mt = meta(c.meta, c.sec);
      if (mt) {
        var m = el('span', 'ksat-ex-card-m');
        m.textContent = mt;
        b.appendChild(m);
      }

      li.appendChild(b);
      cardWrap.appendChild(li);
    });
  }

  /* ===================================================================
     5b · FULL BLEED, MEASURED RATHER THAN GUESSED

     nasa.gov's Explore panel runs edge to edge. Ours could not: it is
     absolutely positioned inside .bar-in, and css/ksat-theme.css caps
     .bar-in at max-width 1280px with margin-inline:auto. Measured in a
     real 1424px viewport, the panel came out 1280px wide sitting 66px in
     from each edge, which reads as a dropdown card rather than as a
     panel. At 1186px it looked right only because .bar-in was filling
     the window anyway.

     WHY NOT calc((100% - 100vw) / 2), WHICH IS THE USUAL TRICK. Because
     100vw INCLUDES THE SCROLLBAR and this page always has one. In the
     same measurement the viewport was 1424 and the document client width
     1412, so that formula would have hung the panel 6px past the right
     edge and put a horizontal scrollbar on the document. The page must
     never scroll sideways.

     .bar is a plain block, so its border box is already exactly the
     client width, scrollbar excluded. Measuring the gap between .bar and
     .bar-in gives the bleed exactly, in both directions, at any width,
     with no assumption about the cap or the scrollbar. The same
     measurement hands the content its measure, so the topic column lines
     up under the word Explore instead of under the panel edge.

     Physical to logical on the way out, because in the Arabic build
     inline-start is the right hand edge. The two are equal today; they
     stop being equal the moment anyone gives .bar-in asymmetric
     padding. */
  function measure() {
    if (!panel) return;
    var bar = document.querySelector('.bar');
    var barIn = document.querySelector('.bar-in');
    if (!bar || !barIn) return;

    var rb = bar.getBoundingClientRect();
    var ri = barIn.getBoundingClientRect();
    if (!rb.width || !ri.width) return;              /* hidden, or mid layout */

    var physStart = Math.max(0, ri.left - rb.left);
    var physEnd   = Math.max(0, rb.right - ri.right);
    var rtl = isRTL();

    panel.style.setProperty('--ksat-ex-bleed-s', Math.round(rtl ? physEnd : physStart) + 'px');
    panel.style.setProperty('--ksat-ex-bleed-e', Math.round(rtl ? physStart : physEnd) + 'px');
    panel.style.setProperty('--ksat-ex-measure', Math.round(ri.width) + 'px');
  }

  /* One rAF per resize burst. getBoundingClientRect forces layout, and
     doing that on every resize event of a window drag is how a panel
     that is not even open makes the page feel heavy. */
  var measureQueued = false;
  function queueMeasure() {
    if (measureQueued) return;
    measureQueued = true;
    requestAnimationFrame(function () { measureQueued = false; measure(); });
  }

  /* The theme can change while the panel is closed, so the plates are
     re-pointed rather than the whole card list rebuilt.

     THE ALT TEXT GOES WITH THE SRC. It did not, and that was a silent
     one: swapping the file under an unchanged alt string left a screen
     reader describing the day plate while the night plate was on
     screen. Now that the two plates have different descriptions, that
     is the difference between correct and wrong rather than between two
     phrasings of the same sentence. */
  function repaintArt() {
    if (!cardWrap) return;
    Array.prototype.forEach.call(cardWrap.querySelectorAll('.ksat-ex-card'), function (b) {
      var img = b.querySelector('img');
      var k = b.getAttribute('data-art');
      if (img && ART[k]) { img.src = artSrc(k); img.alt = artAlt(k); }
    });
  }


  /* ===================================================================
     6 · INTERACTION

     Delegated from the panel, one listener, and it stops propagation on
     purpose: js/ksat-minimal.js closes the drawer on any document click
     outside #ksat-nav, and although this panel is inside #ksat-nav and
     therefore already exempt, a future refactor that moves it would turn
     every card click into a race between navigating and closing. Being
     explicit costs one line.
     =================================================================== */
  function wire() {
    panel.addEventListener('click', function (e) {
      e.stopPropagation();

      var topic = e.target.closest ? e.target.closest('.ksat-ex-topic') : null;
      if (topic) {
        if (topic.getAttribute('data-act') === 'lang') {
          var want = isRTL() ? 'en' : 'ar';
          close();
          if (KS.i18n && typeof KS.i18n.apply === 'function') KS.i18n.apply(want);
          return;
        }
        var k = topic.getAttribute('data-key');
        if (k && BY_KEY[k]) { setActive(k); go(BY_KEY[k].sec); }
        return;
      }

      var card = e.target.closest ? e.target.closest('.ksat-ex-card') : null;
      if (card) {
        var sec = card.getAttribute('data-sec');
        /* The underline follows the destination where a topic owns it,
           so arriving by card does not leave a stale row underlined. */
        for (var i = 0; i < TOPICS.length; i++) {
          if (TOPICS[i].sec === sec) { setActive(TOPICS[i].key); break; }
        }
        go(sec);
      }
    });

    /* PREVIEW ON HOVER AND ON FOCUS, AND THE POINTER DOES NOT GET TO
       OVERRULE THE KEYBOARD.

       Caught with real key presses rather than dispatched events, which
       is the only reason it was caught at all. Arrowing from How This
       Works down to Sources moved the focus ring correctly and left The
       Mission's three cards on screen. The cause is that .bar is
       position:relative and not sticky (css/ksat-detail.css wins over
       index.html's own rule; css/ksat-minimal.css documents the same
       finding), so the masthead and this panel scroll with the page.
       When the page scrolls, the rows slide underneath a stationary
       mouse cursor and the browser fires mouseover for each one. Those
       are real events with no user intent behind them, and they landed
       after the focusin and repainted the cards.

       So hover is only believed while the pointer is actually being
       moved. mousemove arms it, any key in the column disarms it, and a
       mouseover that arrives with the flag down is ignored. A touch tap
       fires no mousemove either, which incidentally fixes the other
       half of the same problem: a tap no longer repaints the cards one
       frame before it navigates. */
    var pointerLive = false;
    panel.addEventListener('mousemove', function () { pointerLive = true; });
    panel.addEventListener('mouseover', function (e) {
      if (!pointerLive) return;
      var topic = e.target.closest ? e.target.closest('.ksat-ex-topic[data-key]') : null;
      if (topic) paintCards(topic.getAttribute('data-key'));
    });
    panel.addEventListener('mouseleave', function () {
      pointerLive = false;
      paintCards(activeKey);
    });
    /* focusin still drives the preview for Tab and for assistive
       technology, both of which move focus without a pointer at all. */
    panel.addEventListener('focusin', function (e) {
      var topic = e.target.closest ? e.target.closest('.ksat-ex-topic[data-key]') : null;
      if (topic) paintCards(topic.getAttribute('data-key'));
    });
    panel.addEventListener('keydown', function () { pointerLive = false; });

    /* ARROW KEYS THROUGH THE COLUMN, which is what makes a roving
       tabindex worth having. Escape is NOT handled here: js/ksat-minimal.js
       already owns it and already returns focus to the trigger, and a
       second Escape listener is how the page ends up with six things
       fighting over one key. That file's header says the same. */
    list.addEventListener('keydown', function (e) {
      var all = rows();
      var i = all.indexOf(document.activeElement);
      if (i < 0) return;
      var next = -1;

      if (e.key === 'ArrowDown')      next = (i + 1) % all.length;
      else if (e.key === 'ArrowUp')   next = (i - 1 + all.length) % all.length;
      else if (e.key === 'Home')      next = 0;
      else if (e.key === 'End')       next = all.length - 1;
      else return;

      e.preventDefault();
      all.forEach(function (b) { b.tabIndex = -1; });
      all[next].tabIndex = 0;
      try { all[next].focus({ preventScroll: true }); } catch (err) { all[next].focus(); }

      /* focusin normally repaints the cards for us, and it does not fire
         at all when the window does not hold system focus, which is
         exactly the state an automated browser is in. Repainting here as
         well costs one call and means the preview cannot silently stop
         following the arrow keys. paintCards() is idempotent: it returns
         immediately when the key is already the one on screen. */
      var k2 = all[next].getAttribute('data-key');
      if (k2) paintCards(k2);
    });
  }


  /* ===================================================================
     7 · OPEN AND CLOSE ARE NOT OURS

     js/ksat-minimal.js sets data-ksat-min-explore on <html> and that is
     the single source of truth for whether Explore is open. This mirrors
     it. Going the other way, close() asks that file to close rather than
     hiding the panel behind its back, so aria-expanded and the chevron
     stay in step with what the reader can see.
     =================================================================== */
  function close() {
    if (KS.minimal && typeof KS.minimal.setOpen === 'function') KS.minimal.setOpen(false);
    else root.removeAttribute('data-ksat-min-explore');
    sync();
  }

  function sync() {
    if (!panel) return;
    var open = root.getAttribute('data-ksat-min-explore') === 'open';
    if (open === !panel.hidden) return;
    panel.hidden = !open;

    if (open) {
      /* Measured on open, not only on resize: the bar's width changes
         with the tier and with the language, and both can happen while
         the panel is shut. */
      measure();
      paintCards(activeKey, true);
      /* Focus the underlined row so the arrow keys work immediately.
         preventScroll because the panel is already in view and a focus
         scroll here yanks the page behind it. */
      var cur = list.querySelector('[aria-current="page"]') ||
                list.querySelector('.ksat-ex-topic[data-key]');
      if (cur) setTimeout(function () {
        try { cur.focus({ preventScroll: true }); } catch (e) {}
      }, 0);
    }
  }


  /* ===================================================================
     8 · WHICH ROW IS UNDERLINED

     The shell tells us, on ksat:chapter, which sections are now on
     screen. If the row the reader last used is one of them it stays
     underlined; otherwise the first row that owns a section on this page
     takes it. That covers arriving by deep link, by the chapter rail, by
     the chapter pill, by Ctrl+F opening a closed chapter, and by the
     back button, without this file listening to any of them.
     =================================================================== */
  /* THE UNDERLINE DOES NOT ALWAYS GET A CHAPTER EVENT TO RIDE ON, and
     that was a real bug, caught in the browser rather than reasoned
     about. Pressing The Mission from Home moved the page correctly and
     left "Home" underlined, because both live in the brief chapter:
     js/ksat-shell.js only calls openChapter() when the owning chapter
     is not already open, so no ksat:chapter fired and paint() never ran.
     Setting the row explicitly here covers the same-chapter case, and
     syncActive() below still covers every arrival this file did not
     cause. */
  function setActive(key) {
    if (!BY_KEY[key]) return;
    activeKey = key;
    if (panel) paint();
  }

  function syncActive(ids) {
    if (!ids || !ids.length) return;
    var cur = BY_KEY[activeKey];
    if (cur && ids.indexOf(cur.sec) !== -1) return;
    for (var i = 0; i < TOPICS.length; i++) {
      if (ids.indexOf(TOPICS[i].sec) !== -1) { activeKey = TOPICS[i].key; break; }
    }
  }


  /* ===================================================================
     9 · THE MISSION PAGE

     The team: the specification table, the concept chain and the ground
     segment "should be splashed on the page like that but should be
     organized in in the correct tab in the explore". The Explore row
     that carries them is The Mission, and this is the other half of
     that: #mission opened as three stacked panels, and a NASA mission
     page opens with its quick facts first and its detail underneath.

     So a fact strip is mounted as the FIRST CHILD OF #mission, after
     its heading. Six figures, every one of them a row of the SPECS
     array in index.html, with the same source chips the table below
     uses, built by index.html's own srcChips(). Nothing is duplicated
     that is not already visible two panels down, and nothing is
     authored: if a SPECS key is missing the tile is skipped.

     WHY INSIDE THE SECTION AND NOT BESIDE IT. js/ksat-shell.js hides a
     chapter by hiding its sections. A sibling inside .wrap belongs to no
     chapter and stands under every one of them, which is exactly the
     #descent bug that file documents at length: 928px of dead space
     above the dashboard. A child of #mission is hidden and shown with
     #mission for free.

     index.html is not edited. This is a runtime mount, the same way
     js/ksat-minimal.js mounts the seal and js/ksat-i18n.js mounts the
     language toggle. If the team would rather have it in the markup,
     the shape is in handoff and this function can go.
     =================================================================== */
  var FACTS = ['spec.date', 'spec.form', 'spec.pay', 'spec.gsd', 'spec.sw', 'spec.cos'];
  var FACT_LAB = {
    'spec.date': { en: 'Launch',        ar: 'الإطلاق' },
    'spec.form': { en: 'Form factor',   ar: 'الشكل' },
    'spec.pay':  { en: 'Payload',       ar: 'الحمولة' },
    'spec.gsd':  { en: 'Resolution',    ar: 'الدقة' },
    'spec.sw':   { en: 'Swath',         ar: 'عرض المسح' },
    'spec.cos':  { en: 'COSPAR ID',     ar: 'المعرّف الدولي' }
  };

  function mountFacts() {
    var sec = document.getElementById('mission');
    if (!sec) return;
    var specs = P('SPECS'), chips = P('srcChips'), valAr = P('SPEC_VAL_AR');
    if (!specs || typeof chips !== 'function') return;

    var host = document.getElementById('ksat-ex-facts');
    if (!host) {
      host = el('div', 'ksat-ex-facts');
      host.id = 'ksat-ex-facts';
      /* Insert relative to the h2's OWN parent, not to the section.
         querySelector('h2') searches the whole subtree, so the heading is
         not necessarily a direct child of sec — and once the home page
         was rebuilt around wrapper elements it stopped being one. Calling
         sec.insertBefore() with a reference node that belongs to a
         different parent throws NotFoundError, which killed boot() before
         it reached watch(), which is the function that attaches the
         observer the Explore button depends on. The button then toggled
         an attribute nothing was listening to. */
      var h2 = sec.querySelector('h2');
      if (h2 && h2.parentNode) h2.parentNode.insertBefore(host, h2.nextSibling);
      else sec.appendChild(host);
    }

    var byKey = {};
    specs.forEach(function (s) { byKey[s.k] = s; });

    var html = '';
    FACTS.forEach(function (k) {
      var s = byKey[k];
      if (!s) return;                       /* renamed or removed: skip, never invent */
      var v = (isRTL() && valAr && valAr[k]) ? valAr[k] : s.v;
      html += '<div class="ksat-ex-fact">' +
                '<div class="ksat-ex-fact-k">' + escapeHtml(L(FACT_LAB[k])) + '</div>' +
                '<div class="ksat-ex-fact-v">' + escapeHtml(v) + '</div>' +
                '<div class="ksat-ex-fact-s">' + chips(s.src) + '</div>' +
              '</div>';
    });
    host.innerHTML = html;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }


  /* ===================================================================
     10 · START

     js/ksat-nav.js rebuilds its strip whenever index.html's renderNav()
     wipes #ksat-nav, which it does on every language switch, and
     js/ksat-minimal.js rebuilds its button after that. Our panel is a
     child of #ksat-nav and goes with it. A MutationObserver is the only
     reliable hook; the same lesson is written up in both of those files.
     =================================================================== */
  function boot() {
    checkCounts();
    countLegend();
    if (!build()) return false;
    wire();
    root.setAttribute('data-ksat-explore', 'on');   /* the CSS waits for this */
    measure();
    sync();
    /* The fact strip is decoration. Opening the panel is the feature.
       They were in the same try-nothing sequence, so one throw inside
       mountFacts() took boot() down with it, start() never reached
       watch(), and the Explore button silently stopped working while
       every other symptom looked fine: the button existed, it was
       clickable, it flipped aria-expanded, and the panel was built and
       sitting in the DOM. Decoration must not be able to do that. */
    try {
      mountFacts();
    } catch (e) {
      if (window.console && console.error) {
        console.error('[ksat-explore] the fact strip did not mount. The ' +
                      'panel itself is unaffected.', e);
      }
    }
    return true;
  }

  function watch() {
    var nav = document.getElementById('ksat-nav');
    if (!nav || typeof MutationObserver === 'undefined') return;
    new MutationObserver(function () {
      if (document.getElementById('ksat-ex')) { adoptButton(); return; }
      panel = list = cardWrap = cardHead = navBox = null;
      shownKey = null;
      if (build()) { wire(); sync(); }
    }).observe(nav, { childList: true });

    /* One observer for the two root attributes we read: the open state
       that js/ksat-minimal.js owns, and the theme that js/ksat-theme.js
       owns. attributeFilter keeps this off every other attribute on
       <html>, of which the shell alone sets four. */
    new MutationObserver(function (recs) {
      for (var i = 0; i < recs.length; i++) {
        if (recs[i].attributeName === 'data-ksat-min-explore') sync();
        else repaintArt();
      }
    }).observe(root, { attributes: true, attributeFilter: ['data-ksat-min-explore', 'data-theme'] });
  }

  function start() {
    if (!boot()) {
      var mo = new MutationObserver(function () {
        if (boot()) { mo.disconnect(); watch(); }
      });
      mo.observe(document.body, { childList: true, subtree: true });
      setTimeout(function () { mo.disconnect(); if (boot()) watch(); }, 6000);
      return;
    }
    watch();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.addEventListener('resize', queueMeasure);

  /* Language: repaint every string, re-point the plates, rebuild the
     fact strip. Deferred a tick because js/ksat-i18n.js calls the page's
     own renderAll() inside apply(), and rendering on top of that is how
     you get half a panel in one language. */
  document.addEventListener('ksat:lang', function () {
    setTimeout(function () {
      if (panel) { paint(); repaintArt(); measure(); }
      mountFacts();
    }, 0);
  });

  /* Chapter changes decide the underline. detail.ids is the list of
     section ids the shell has just put on screen. */
  document.addEventListener('ksat:chapter', function (e) {
    if (!e.detail) return;
    syncActive(e.detail.ids);
    if (panel) paint();
  });

  /* Sign in swaps the whole masthead. The stylesheet already scopes this
     panel to the public tier, but the fact strip is in the page and
     should follow the tier too. */
  document.addEventListener('ksat:identity', function () {
    setTimeout(mountFacts, 0);
  });

  KS.explore = {
    open:   function () { if (KS.minimal) KS.minimal.setOpen(true); },
    close:  close,
    go:     go,
    topics: TOPICS.map(function (x) { return { key: x.key, section: x.sec }; })
  };
})();
