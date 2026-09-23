/* =====================================================================
   ksat-home.js - THE HOME PAGE, GIVEN THE NASA TREATMENT
   Owner: 01 Front End. Pairs with css/ksat-home.css.

   THE BRIEF, IN THE TEAM'S OWN WORDS

     "dont keep text squezed like that"
     "change the way this presented to this style, it is zoomed out so
      you see the full pic"
     "thats all for the home page, not just text but visuals and pics
      just how the home page is at nasa"

   They pointed at three blocks of ours beside full page screenshots of
   nasa.gov: #mission, which is a fact strip over a folded twelve row
   table; the section js/ksat-facts.js builds in #legend, which is good
   content in a plain column; and the record and national picture at the
   foot of it, which are a list and a row of pills.

   All three are walls of text with no picture in them, on a platform
   whose subject is a camera in orbit and which has real imagery sitting
   unused in assets/cards/.

   ---------------------------------------------------------------------
   THE SECOND PASS, AND WHAT THE TEAM ASKED FOR THE SECOND TIME

   They came back to a built page with three corrections rather than a
   redesign, and one of them was "but keep this", which is the most
   useful sentence in the brief: most of what is here is right and the
   job was to change three things and touch nothing else. So this pass
   is deliberately small.

     1  "remove this text", quoting the NASA provenance paragraph in
        full. The credit line under each feature picture is gone.
        figureFor() carries the whole argument for why that is safe and
        what still holds the provenance.

     2  The topic grid's first tile was carrying the 2400 x 1000 band
        plate inside a 4/3 tile, which letterboxed it into a strip with
        44 percent of the tile empty. That is the opposite of "zoomed
        out so you see the full pic" even though it was contain and not
        crop. DESTS now picks art by shape; the note there has the
        measurements.

     3  The band sat 258px below the last line of the section above it,
        measured, because two sections' worth of vertical padding met in
        front of it. css/ksat-home.css pulls it up into its own
        section's padding. The reasoning is on the .ksh-band rule.

   WHAT WAS DELIBERATELY NOT TOUCHED: the four treatments, the card
   rows, the side by side features, the prose cards and their plates,
   and every string that was already verified. "Keep this" was an
   instruction too.

   ---------------------------------------------------------------------
   THIS IS AN ADDITIVE LAYER. index.html IS NOT EDITED.

   Every section this file restyles lives in index.html, which belongs
   to the human and which this file never touches. So the work is done
   the way js/ksat-facts.js already does it: read the DOM the page
   already built, wrap it, move nodes into the new wrappers, and add the
   pictures around them. Read that file before this one. It is the model
   for this job and its two hard won lessons are obeyed here:

     - a node that is MOVED with appendChild keeps every attribute and
       every data-i18n key, so js/ksat-i18n.js goes on translating it
       with no idea it travelled. Nothing below is ever copied and
       re-typed;

     - innerHTML on a container destroys children you did not make. The
       only innerHTML assignments below are on elements this file
       created in the same function, and the nodes belonging to
       index.html or to js/ksat-facts.js are only ever appended, never
       overwritten.

   ---------------------------------------------------------------------
   EVERYTHING MUST BE A CHILD OF ITS SECTION. THIS COST A DAY ONCE.

   js/ksat-shell.js shows one chapter at a time and hides the rest with
   the hidden attribute, section by section. A node added as a SIBLING
   of the sections inside .wrap belongs to no chapter, is never hidden,
   and stands under every chapter in turn. That is the #descent bug that
   file documents at length: a bare div between #mission and #builders
   that held its full clamp(240px, 34vw, 400px) under every chapter and,
   with the hero that would not hide, put 928px of dead space above the
   dashboard.

   So: the band, the card rows, the features and the topic grid below
   are ALL children of #mission or of the .ksf container inside #legend.
   Not one insertion in this file has .wrap as its parent. If you add
   one, put it inside a section.

   ---------------------------------------------------------------------
   NOT ONE FACT HERE IS INVENTED, AND THE TWO PLACES THAT COULD HAVE
   BEEN ARE THE ONES TO CHECK

   Every sentence below traces to SOURCES, SPECS, TIMELINE, CLAIMS or
   PILLARS in index.html, or to prose already on the page. Where a
   string is quoted from another file the key is recorded beside it so
   the next person can check it in one grep.

     THE COUNT. "Twelve published entries" is the page's own wording for
     the SPECS table (data-i18n mis.specn). It is asserted against
     SPECS.length at render time and the line is DROPPED if the array
     ever stops having twelve rows. A count that drifts is the easiest
     false statement on a page like this to ship, because nobody
     recounts a number that was true when it was written.

     THE PICTURES. The Earth frames are NASA Blue Marble and Black
     Marble composites sampled onto a sphere by this project, per
     assets/earth/CREDITS.txt. The spacecraft stills are this page's own
     3D model: a 2U form factor from the published record with MODELLED
     surface detail, which is what css/ksat-minimal.css section 14 says
     when it takes the sticker off the hero model. NEITHER is a
     photograph taken by KuwaitSat-1 and no alt string and no caption
     below says or implies that it is. The credit line that used to say
     so out loud has been removed at the team's request, and the note
     over figureFor() sets out exactly what is still carrying that
     statement now that it is gone. Read it before writing any new
     caption into this file.

     THE TEAM PHOTOGRAPH IS DELIBERATELY NOT USED. TEAM_PHOTO in
     index.html carries verified:false with the note "publisher not
     independently verified", and index.html has its own machinery for
     presenting it with that qualification attached. Lifting it onto the
     front page, where there is no room for the qualification, would
     strip the caveat off the one picture on this site that needs it.

   ---------------------------------------------------------------------
   BILINGUAL, AND NOTHING LEAKS

   Every user visible string, alt text included, is an {en, ar} pair in
   COPY or ALT below. One side is rendered, never both, so English mode
   shows no Arabic and Arabic mode shows no English. There is no fallback
   to English inside an Arabic render: a missing Arabic string shows as
   an obvious hole in review rather than as an English sentence in an
   Arabic page, which is the complaint the team has raised twice.

   THE RE-RENDER RIDES ON 'ksat:lang', which js/ksat-i18n.js dispatches
   at the very END of its apply(), after translateDom, the page's own
   renderAll(), translateBadges, translateChapters and translateLabels
   have all finished. The handler defers with setTimeout(0) on top of
   that, for one specific reason: js/ksat-facts.js listens to the same
   event and rebuilds the whole .ksf container with
   `host.innerHTML = markup(code)`, which destroys every wrapper this
   file put inside it. Deferring means we run after that rebuild
   whatever order the two listeners were registered in, find a clean
   .ksf, and wrap it again.

   Latin identifiers that name a real object stay Latin inside the
   Arabic: KuwaitSat-1, 2U, UHF, S-band, COSPAR 2023-001CY, RGB. That is
   the convention js/ksat-i18n.js states in its header and the one
   js/ksat-facts.js follows. Numerals stay Western for the same reason.

   ---------------------------------------------------------------------
   NO EM DASHES AND NO EN DASHES in anything a reader sees. 361 of them
   were stripped from this codebase in one morning because the team
   reads that punctuation as machine written. Commas and full stops. The
   hyphens that survive are inside names: KuwaitSat-1, S-band,
   Transporter-6, COSPAR 2023-001CY.

   ---------------------------------------------------------------------
   MOTION: THERE IS NO rAF IN THIS FILE AND NOTHING ANIMATES ON LOAD.

   The only motion is the smooth scroll a card asks for, and reduced()
   below turns that into an instant jump when the media query matches.
   The arrow nudge is a CSS transition and css/ksat-home.css section 7
   removes it under prefers-reduced-motion.

   Nothing here fades content in. js/ksat-facts.js section 5 records
   what happened the last time this page put its first content block
   behind an IntersectionObserver: the observer never delivered a
   callback in the verification browser and the section stayed at
   opacity 0 after being scrolled right past. A picture that might not
   arrive is worse than a picture that simply arrives.

   Z-INDEX: none claimed from the shared stack. See the note in
   css/ksat-home.css.
   ===================================================================== */

(function () {
  'use strict';

  var KS = window.KSAT = window.KSAT || {};
  if (KS.home) return;

  /* ===================================================================
     1 - THE SMALL THINGS
     =================================================================== */

  var root = document.documentElement;

  function el(tag, cls) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }

  /* One side of a pair, never both, and no fallback across languages.
     See the bilingual note in the header. */
  function L(pair, code) {
    if (!pair) return '';
    return code === 'ar' ? (pair.ar || '') : (pair.en || '');
  }

  function currentLang() {
    var a = root.getAttribute('data-ksat-lang');
    if (a === 'ar' || a === 'en') return a;
    return (root.lang || 'en').toLowerCase().indexOf('ar') === 0 ? 'ar' : 'en';
  }

  /* The page has an explicit theme control, so the attribute is the
     authority and the media query is only the fallback for the state
     where the reader has never chosen. Same three step test
     js/ksat-explore.js uses, so the two panels can never disagree about
     which plate the page is showing. */
  function isNight() {
    var a = root.getAttribute('data-theme');
    if (a === 'light') return false;
    if (a === 'dark') return true;
    try { return matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) { return true; }
  }

  function reduced() {
    try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  /* THE SAME 760px THAT css/ksat-home.css SECTION 6 USES. Below it the
     full bleed band stops being an overlay and becomes a picture with
     the words under it, and the art has to change shape to match: the
     2400 x 1000 band plate in a 4/3 box would be cropped to a third of
     itself, which is the opposite of what the team asked for. The number
     is written in both files with this comment beside it in each. */
  function narrow() {
    try { return matchMedia('(max-width: 760px)').matches; } catch (e) { return false; }
  }

  /* SPECS is a top level `const` in a CLASSIC script inside index.html.
     Classic scripts share one global lexical environment, so the name is
     reachable here, but a `const` is NOT a property of window, so
     window.SPECS is undefined and a bare reference inside try/catch is
     the only safe way to ask.

     IT HAS TO BE A BARE REFERENCE AND NOT A LOOKUP BY STRING. A lookup
     would mean eval or new Function, and vercel.json sends
     script-src 'self' 'unsafe-inline' with no 'unsafe-eval', so either
     one works on the local no-cache server, which sends no CSP, and is
     blocked outright on the deployed site. Naming the binding compiles
     to an ordinary global lookup and the ReferenceError is catchable. */
  function specs() {
    var s = null;
    try { s = SPECS; } catch (e) { s = null; }        /* eslint-disable-line no-undef */
    return (s && s.length) ? s : null;
  }


  /* ===================================================================
     2 - THE PICTURES

     Every entry names a real file in assets/. There is no placeholder
     and no fourth option, because there is no fourth real image.

     DAY ART FOR THE LIGHT THEME AND NIGHT ART FOR THE DARK ONE. The
     reason is the one js/ksat-explore.js gives for its own plates: a
     light page with night cards on it looks like a loading error. The
     spacecraft stills and the emblem have no day or night version, so
     both keys point at the same file rather than at a file that does
     not exist.
     =================================================================== */
  var ART = {
    band:   { day: 'assets/cards/band-kuwait-day.jpg',   night: 'assets/cards/band-kuwait-night.jpg',  alt: 'wide' },
    kuwait: { day: 'assets/cards/card-kuwait-day.jpg',   night: 'assets/cards/card-kuwait-night.jpg',  alt: 'wide' },
    gulf:   { day: 'assets/cards/card-gulf-day.jpg',     night: 'assets/cards/card-gulf-night.jpg',    alt: 'gulf' },
    region: { day: 'assets/cards/card-region-day.jpg',   night: 'assets/cards/card-region-night.jpg',  alt: 'region' },
    limb:   { day: 'assets/cards/feature-limb-day.jpg',  night: 'assets/cards/feature-limb-night.jpg', alt: 'limb' },
    globe:  { day: 'assets/earth/globe-day.jpg',         night: 'assets/earth/globe-night.jpg',        alt: 'disk' },
    sat1:   { day: 'assets/cards/sat-three-quarter.png', night: 'assets/cards/sat-three-quarter.png',  alt: 'craft' },
    sat2:   { day: 'assets/cards/sat-panel-on.png',      night: 'assets/cards/sat-panel-on.png',       alt: 'craft' },
    sat3:   { day: 'assets/cards/sat-from-below.png',    night: 'assets/cards/sat-from-below.png',     alt: 'craft' },
    sat4:   { day: 'assets/cards/sat-edge.png',          night: 'assets/cards/sat-edge.png',           alt: 'craft' },
    mark:   { day: 'assets/brand/ksat-emblem-256.png',   night: 'assets/brand/ksat-emblem-256.png',    alt: 'mark' },
    /* Added after the grid was measured: four of the eight tiles were
       the Arabian Peninsula at night at four camera distances, which are
       four different files that read as one picture at 290px wide. These
       two are different VIEWS rather than different zooms. */
    term:   { day: 'assets/cards/card-terminator-day.jpg', night: 'assets/cards/card-terminator-night.jpg', w: 1200, h: 900, alt: 'region' },
    lowlimb:{ day: 'assets/cards/card-limb-low-day.jpg',   night: 'assets/cards/card-limb-low-night.jpg',   w: 1200, h: 900, alt: 'limb' }
  };

  /* ALT TEXT DESCRIBES THE PICTURE AND NEVER THE DESTINATION.

     js/ksat-explore.js learned this the expensive way and its note is
     worth repeating: a card's alt text that describes the page it opens
     rather than the image it labels tells a screen reader something
     that is not on the screen.

     THE DAY AND NIGHT PLATES NEED SEPARATE WORDS. The day plates are
     the Blue Marble composite and show coastline, desert and sea. The
     night plates are the Black Marble composite and what is visible on
     them is city lights. One string for both would describe a picture
     half the readers of this page are not looking at.

     Each description below was written after opening the file it
     describes, not from its name. The Gulf really is at the centre of
     card-gulf-*.jpg, the limb really does run across the top of
     feature-limb-*.jpg, and card-region-*.jpg really does reach from
     the Red Sea to the Gulf.
     =================================================================== */
  var ALT = {
    wide: {
      day:   { en: 'The Gulf and the Arabian Peninsula in daylight, from the NASA Blue Marble composite sampled onto a sphere by this project.',
               ar: 'الخليج وشبه الجزيرة العربية في وضح النهار، من مركّب Blue Marble من ناسا، أُخذت عيّناته على كرة في هذا المشروع.' },
      night: { en: 'City lights across the Gulf and the Arabian Peninsula, from the NASA Black Marble composite sampled onto a sphere by this project.',
               ar: 'أضواء المدن عبر الخليج وشبه الجزيرة العربية، من مركّب Black Marble من ناسا، أُخذت عيّناته على كرة في هذا المشروع.' }
    },
    gulf: {
      day:   { en: 'The Gulf at the centre of frame in daylight, with the Red Sea and the Arabian Peninsula to the west.',
               ar: 'الخليج في وسط الإطار في وضح النهار، والبحر الأحمر وشبه الجزيرة العربية إلى الغرب.' },
      night: { en: 'The Gulf at the centre of frame at night, its coastal cities lit along both shores.',
               ar: 'الخليج في وسط الإطار ليلاً، ومدنه الساحلية مضاءة على الضفتين.' }
    },
    region: {
      day:   { en: 'The Arabian Peninsula in daylight, from the Red Sea across to the Gulf.',
               ar: 'شبه الجزيرة العربية في وضح النهار، من البحر الأحمر إلى الخليج.' },
      night: { en: 'The Arabian Peninsula at night, from the Red Sea across to the Gulf.',
               ar: 'شبه الجزيرة العربية ليلاً، من البحر الأحمر إلى الخليج.' }
    },
    limb: {
      day:   { en: 'Earth in daylight with the limb across the top of the frame and the Gulf below it.',
               ar: 'الأرض في وضح النهار، وحافتها عبر أعلى الإطار والخليج أسفلها.' },
      night: { en: 'Earth at night with the limb across the top of the frame and the lights of the Gulf below it.',
               ar: 'الأرض ليلاً، وحافتها عبر أعلى الإطار وأضواء الخليج أسفلها.' }
    },
    /* Quoted verbatim from js/ksat-explore.js ALT.disk, because it is
       the same two files and the same viewpoint, and two descriptions of
       one picture is how they drift apart. */
    disk: {
      day:   { en: 'NASA Blue Marble composite of the full disk of Earth, with the Gulf near the centre.',
               ar: 'مركّب Blue Marble من ناسا لقرص الأرض الكامل، والخليج قرب المركز.' },
      night: { en: 'NASA Black Marble composite of the full disk of Earth at night, with the Gulf near the centre.',
               ar: 'مركّب Black Marble من ناسا لقرص الأرض الكامل ليلاً، والخليج قرب المركز.' }
    },
    /* THE SENTENCE THAT KEEPS THIS PAGE HONEST. The stills are renders
       of the page's own 3D model. The 2U form factor is in the
       published record (SPECS spec.form, sources [0] and [4]); the
       surface detail is drawn, which is exactly what
       css/ksat-minimal.css section 14 states when it removes the
       MODELLED sticker from the hero: "KuwaitSat-1 is a 2U and the
       surface detail in that model is drawn". Saying it in the alt text
       is how the claim survives the sticker coming off. */
    craft: {
      day:   { en: 'The KuwaitSat-1 2U CubeSat as this page’s own 3D model. The form factor is from the published record and the surface detail is modelled.',
               ar: 'نموذج ثلاثي الأبعاد في هذه الصفحة للقمر المكعّب KuwaitSat-1 من فئة 2U. الشكل مأخوذ من السجل المنشور، وتفاصيل السطح مُنمذَجة.' },
      night: { en: 'The KuwaitSat-1 2U CubeSat as this page’s own 3D model. The form factor is from the published record and the surface detail is modelled.',
               ar: 'نموذج ثلاثي الأبعاد في هذه الصفحة للقمر المكعّب KuwaitSat-1 من فئة 2U. الشكل مأخوذ من السجل المنشور، وتفاصيل السطح مُنمذَجة.' }
    },
    /* Quoted from js/ksat-explore.js ALT.mark. */
    mark: {
      day:   { en: 'The KuwaitSat Vision emblem.', ar: 'شعار كويت سات فيجن.' },
      night: { en: 'The KuwaitSat Vision emblem.', ar: 'شعار كويت سات فيجن.' }
    }
  };

  /* THE KEYS THAT NAME A PHOTOGRAPH RATHER THAN A CUT OUT.

     Everything in this list is a JPEG that carries its own opaque
     background. Everything NOT in it, the four spacecraft stills and
     the emblem, is a PNG with a transparent one and needs the radial
     lift --ksh-plate provides. buildGrid() reads this to decide which
     ground a tile gets, and the long note there has the measurement
     that made it necessary.

     Written out as a list rather than derived from the file extension:
     the extension is how the file happened to be saved, the
     transparency is the thing that actually decides the answer, and a
     future PNG export of an Earth frame would silently get the wrong
     ground if this were a test on ".png". */
  var PHOTO_ART = ['band', 'kuwait', 'gulf', 'region', 'limb', 'globe', 'term', 'lowlimb'];

  function artSrc(key) {
    var a = ART[key];
    if (!a) return '';
    return a[isNight() ? 'night' : 'day'];
  }
  function artAlt(key, code) {
    var a = ART[key];
    if (!a) return '';
    var set = ALT[a.alt];
    if (!set) return '';
    return L(set[isNight() ? 'night' : 'day'], code);
  }


  /* ===================================================================
     3 - THE COPY

     Read this as the content, not as configuration. Where a string is
     quoted from elsewhere the key is named beside it.
     =================================================================== */
  var COPY = {

    /* THE BAND'S THREE LINES. Every clause is a SPECS row or a CLAIMS
       entry:
         2U CubeSat            SPECS spec.form, sources [0][4]
         roughly 2 kg          SPECS spec.mass, source [4]
         Kuwait University     SPECS spec.op,   sources [0][4]
         Cape Canaveral,
         3 January 2023        SPECS spec.date, sources [1][4][5]
         first image series
         5 April 2023          SPECS spec.first, source [3]
       The Arabic is assembled from the Arabic js/ksat-facts.js already
       publishes for the same facts in COPY.lede1, COPY.rec[2] and
       COPY.rec[3], so the two sections cannot describe the spacecraft
       in two different ways. */
    bandDek: {
      en: 'A 2U CubeSat of roughly 2 kg, built and operated by Kuwait University. It launched from Cape Canaveral on 3 January 2023 and returned its first image series on 5 April 2023.',
      ar: 'قمر مكعّب من فئة 2U تبلغ كتلته نحو 2 كجم، من بناء وتشغيل جامعة الكويت. أُطلق من كيب كانافيرال في 3 يناير 2023، وأعاد أول سلسلة صور له في 5 أبريل 2023.'
    },

    /* Row and grid labels. These are signposts, not claims: none of them
       asserts a fact about KuwaitSat-1, which is why none of them
       carries a citation. */
    missionRow: { en: 'Explore the record',   ar: 'استكشف السجل' },
    legendRow:  { en: 'Behind the mission',   ar: 'خلف المهمة' },
    gridRow:    { en: 'The rest of this page', ar: 'بقية هذه الصفحة' },

    /* Card labels quoted from index.html's own data-i18n strings, with
       the Arabic quoted from js/ksat-i18n.js by the same key, so a card
       and the panel it opens can never disagree.
         mis.spec   mis.specn   mis.chain   mis.gs */
    cRecord:  { en: 'Mission record', ar: 'سجل المهمة' },
    cRecordM: { en: 'Twelve published entries, each with its source',
                ar: 'اثنتا عشرة مدخلة منشورة، ولكل منها مصدرها' },
    cChain:   { en: 'Concept chain',  ar: 'سلسلة المفهوم' },
    cGround:  { en: 'Ground segment', ar: 'القطاع الأرضي' },
    /* CLAIMS entry 4 and SPECS spec.gs, source [3]. The Arabic is
       js/ksat-facts.js COPY.rec[1], which publishes the same clause. */
    cGroundM: { en: 'UHF for telemetry, tracking and command, S-band for image downlink',
                ar: 'هوائي UHF للقياس عن بُعد والتتبّع والتحكم، وهوائي S-band لتنزيل الصور' },
    /* Quoted from js/ksat-explore.js M.frames, which traces it to CLAIMS
       entry 5 and SPECS spec.first. */
    cImageryM: { en: 'Five frames, 5 April 2023', ar: 'خمسة إطارات، 5 أبريل 2023' },

    /* THE TWO CAPTIONS, AND THERE IS NO LONGER A CREDIT BESIDE THEM.

       COPY.credit used to live here and figureFor() printed it under
       every feature picture. The team asked for that text to go, in
       their words "remove this text", and quoted the long form of it
       back at us. The reasoning and the three things that keep the page
       honest without it are written out in full over figureFor(); the
       short version is that the provenance moved nowhere, it is in the
       ALT table above and in assets/earth/CREDITS.txt, and neither
       caption below attributes its picture to anything at all.

       BOTH CAPTIONS DESCRIBE THE FRAME AND NOT THE MISSION. That is
       load bearing now that the denial underneath them is gone: a
       caption that said "KuwaitSat-1 sees this" would be the invented
       fact the whole file is written to avoid. capGulf names
       KuwaitSat-1 once, and what it says about it, that the spacecraft
       passes over the Gulf, is a statement about the orbit and not
       about the photograph. */
    capLimb: {
      en: 'The Gulf and the Arabian Peninsula seen from orbit, with the curve of the planet across the top of the frame.',
      ar: 'الخليج وشبه الجزيرة العربية من المدار، وانحناء الكوكب عبر أعلى الإطار.'
    },
    capGulf: {
      en: 'The Gulf at the centre of frame, the water KuwaitSat-1 passes over.',
      ar: 'الخليج في وسط الإطار، وهو الماء الذي يمرّ فوقه KuwaitSat-1.'
    }
  };

  /* Section headings, QUOTED. The English is the literal text of the
     <h2> in index.html and the Arabic is the literal value from the
     dictionary in js/ksat-i18n.js, by the key named beside each one.
     This table is the same one js/ksat-explore.js keeps, checked against
     js/ksat-i18n.js line by line rather than copied on trust, so a tile
     and its destination can never drift apart. */
  var H = {
    top:     { en: 'From Space to a Greener Kuwait',                  ar: 'من الفضاء إلى كويت أكثر اخضراراً' },       /* hero.h1a + hero.h1b */
    mission: { en: 'KuwaitSat-1 on the record',                       ar: 'كويت سات-١ في السجل' },                    /* mis.h  */
    imagery: { en: 'Captured From Space',                             ar: 'مُلتقَط من الفضاء' },                       /* img.h  */
    orbit:   { en: 'Where Is KuwaitSat?',                             ar: 'أين كويت سات؟' },                          /* orb.h  */
    system:  { en: 'An AI-powered environmental planning system',     ar: 'نظام تخطيط بيئي مدعوم بالذكاء الاصطناعي' }, /* sys.h  */
    trust:   { en: 'What this system will not do',                    ar: 'ما لن يفعله هذا النظام' },                 /* gr.h   */
    story:   { en: 'A Greener Kuwait Starts From Above',              ar: 'كويت أكثر اخضراراً تبدأ من الأعلى' },       /* st.h   */
    sources: { en: 'Sources and data provenance',                     ar: 'المصادر ومنشأ البيانات' }                  /* src.h  */
  };

  /* ===================================================================
     4 - THE TOPIC GRID'S EIGHT DESTINATIONS

     THESE ARE THE PUBLIC SECTIONS AND NOTHING ELSE.

     js/ksat-shell.js PARKS the ten researcher sections out of the DOM
     entirely for a signed out visitor, and the team's instruction about
     them was "whatever tab that needs to be signed in in order to view
     it, dont put it in the website". A tile that exists only to say no
     is still putting it in the website, so there is no locked tile, no
     greyed tile and no sign in tile here.

     These eight are the eight topic rows js/ksat-explore.js already
     offers, landing on the same eight sections. Following an existing
     decision beats making a second one, and it means the Explore panel
     and this grid can never offer a reader two different maps of the
     same page.

     Every tile is checked against the live document before it is drawn:
     goTo() refuses an id that is not there and buildGrid() skips it, so
     a future index.html that renames or removes a section loses a tile
     rather than shipping a button that does nothing.
     =================================================================== */
  /* THE ART ON EACH TILE IS CHOSEN BY SHAPE FIRST, AND THAT IS THE ONE
     THING THAT CHANGED HERE THIS PASS.

     "it is zoomed out so you see the full pic" is the team's rule and
     css/ksat-home.css obeys it by giving every tile object-fit:contain,
     so nothing is ever cropped. The cost of contain is a mat: art whose
     shape is not the box's shape shows whole with ground either side of
     it. A small mat reads as a frame. A large one reads as a mistake,
     and MEASURED IN THE LIVE PAGE the first tile had a large one.

     The #top tile used to carry the band plate. band-kuwait-*.jpg is
     2400 x 1000, ratio 2.400, and a tile is 4/3, ratio 1.333. At a
     tile width of 293px that picture is 122px tall inside a 219px box:
     97px of empty plate, 44 percent of the tile, split above and below
     a letterboxed strip. It was the only visibly wrong picture in the
     grid. #top now takes card-region-*.jpg, which is 1200 x 900 and
     fills a 4/3 tile exactly, and the band plate is left to the one
     place whose box was built around its shape, the full bleed band
     itself.

     #system moves from region to gulf so the swap does not put the same
     photograph on two tiles.

     WHY SOME MAT IS STILL LEFT, AND WHY THAT IS FINE. There are four
     4/3 plates in assets/cards and six Earth slots on this page, four
     tiles and the two feature figures, so a repeat somewhere is
     arithmetic rather than carelessness. The repeats are kept in the
     SECOND row of the grid, furthest from the features at the top of
     #legend that use the same two plates. What is left over:

       sat1, sat4   756 x 527, ratio 1.432 against 1.333, a 7 percent
                    mat top and bottom on a transparent PNG, which is
                    not a mat at all but the model standing on its
                    ground;
       globe, mark  square, a 12.5 percent mat at each side. A disk and
                    an emblem both read as centred objects, so a frame
                    around them is what a reader expects to see.

     None of that is the 44 percent strip the first tile was showing. */
  /* ART IS CHOSEN FOR VARIETY ACROSS THE GRID, not only for fit.
     The first assignment gave region, kuwait, gulf and limb to four
     different tiles. Every one is the Arabian Peninsula at night from a
     slightly different distance, so the grid read as the same photograph
     printed four times. Measured at 290px per tile, that is exactly what
     it looked like.

     Now: two spacecraft angles that cannot be mistaken for each other,
     the full disk, the emblem, and three Earth views that are genuinely
     different framings rather than three zoom levels. No two adjacent
     tiles carry the same subject. */
  var DESTS = [
    { id: 'top',     art: 'lowlimb' },
    { id: 'mission', art: 'sat1'    },
    { id: 'imagery', art: 'kuwait'  },
    { id: 'orbit',   art: 'globe'   },
    { id: 'system',  art: 'term'    },
    { id: 'trust',   art: 'sat3'    },
    { id: 'story',   art: 'sat4'    },
    { id: 'sources', art: 'mark'    }
  ];


  /* ===================================================================
     5 - SMALL BUILDERS
     =================================================================== */

  /* ONE ARROW IN THE CODEBASE. css/ksat-home.css section 8 mirrors it
     with scaleX(-1) for Arabic rather than this file drawing a second
     path, because two arrows are two things that can get out of step. */
  var ARROW = '<svg class="{c}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
              '<path d="M4 12h14"/><path d="m12.6 6 5.4 6-5.4 6"/></svg>';

  function arrow(cls) { return ARROW.replace('{c}', cls); }

  function image(cls, artKey, code) {
    var img = el('img', cls);
    img.src = artSrc(artKey);
    img.alt = artAlt(artKey, code);
    /* Everything in this layer is below the fold by definition: the
       hero is above all three of these sections. Lazy is correct and
       decoding async keeps a big plate off the main thread. */
    img.loading = 'lazy';
    img.decoding = 'async';
    return img;
  }

  /* The row head: a title on the leading edge, one link on the trailing
     edge, which is the shape the reference uses above every card row.
     The link's label is the DESTINATION'S OWN HEADING rather than a
     "Discover More", because a link that names where it goes is worth
     more on this page than one that matches a screenshot. */
  function rowHead(titlePair, destId, code) {
    var head = el('div', 'ksh-row__head');

    var h = el('h3', 'ksh-row__title');
    h.textContent = L(titlePair, code);
    head.appendChild(h);

    if (destId && document.getElementById(destId)) {
      var a = el('button', 'ksh-link');
      a.type = 'button';
      a.innerHTML = arrow('ksh-arrow');
      a.insertBefore(document.createTextNode(L(H[destId], code)), a.firstChild);
      a.addEventListener('click', function () { goTo(destId); });
      head.appendChild(a);
    }
    return head;
  }

  /* A card: a plate, a label under it, a meta line, an arrow. `run` is
     what the card does when it is pressed. */
  function card(artKey, titlePair, metaPair, code, run) {
    var b = el('button', 'ksh-card');
    b.type = 'button';

    var plate = el('div', 'ksh-card__plate');
    plate.appendChild(image('ksh-card__img', artKey, code));
    b.appendChild(plate);

    var body = el('div', 'ksh-card__body');
    var txt = el('div', '');
    var t = el('span', 'ksh-card__t');
    t.textContent = L(titlePair, code);
    txt.appendChild(t);
    /* A CARD CARRIES ONE FEWER LINE RATHER THAN A GUESS. Two of the
       four cards in #mission have no meta line, because there is no
       count or figure in the panel they open that this file can assert
       against an array in index.html, and a plausible invented line is
       worse here than a missing one. */
    if (metaPair) {
      var m = el('span', 'ksh-card__m');
      m.textContent = L(metaPair, code);
      txt.appendChild(m);
    }
    body.appendChild(txt);

    var ar = el('span', '');
    ar.innerHTML = arrow('ksh-card__arrow');
    body.appendChild(ar.firstChild);

    b.appendChild(body);
    b.addEventListener('click', run);
    return b;
  }

  /* The figure half of a side by side feature: a picture and ONE line of
     caption. A <figure> and a <figcaption>, so the caption is associated
     with the image in the accessibility tree rather than merely sitting
     near it.

     THE CREDIT LINE IS GONE AND THE TEAM ASKED FOR THAT TWICE.

     It used to render a second line under the caption, in --ink-3, that
     read "NASA composite, sampled onto a sphere by this project. Not an
     image from KuwaitSat-1." The team had already deleted the three
     sentence version of that paragraph off the Explore cards, and the
     instruction this pass was to remove it here too, quoted back at us
     in full. A sentence the team has now asked to be rid of twice does
     not get kept under a shorter class name.

     WHAT STOPS THIS BECOMING A FALSE CLAIM, because deleting a
     disclaimer is exactly the kind of edit that quietly makes a page
     lie. Three things, none of which moved:

       - THE ALT TEXT IS UNTOUCHED AND IT CARRIES THE WHOLE STATEMENT.
         ALT.limb and ALT.gulf, and every other entry in that table,
         name the NASA Blue Marble or Black Marble composite and say it
         was sampled onto a sphere by this project. A screen reader gets
         more provenance from this figure than the credit line ever put
         on screen;

       - NO CAPTION CLAIMS KuwaitSat-1 TOOK THE PICTURE. COPY.capLimb
         and COPY.capGulf describe what is in the frame, the Gulf, the
         Peninsula, the curve of the planet, and neither one attributes
         it to anything. Removing a denial is only dangerous when
         something nearby is making the assertion, and nothing here is;

       - assets/earth/CREDITS.txt is unchanged and is still the full
         record, which is where the long version always belonged.

     If a future pass wants the provenance back on screen, put it in
     ONE place on the page, in #sources beside the rest of the
     provenance, and not under every picture. */
  function figureFor(artKey, capPair, code) {
    var fig = el('figure', 'ksh-feature__fig');

    var media = el('div', 'ksh-feature__media');
    media.appendChild(image('', artKey, code));
    fig.appendChild(media);

    var cap = el('figcaption', 'ksh-figcap');
    cap.textContent = L(capPair, code);
    fig.appendChild(cap);

    return fig;
  }

  /* The banner plate that goes on top of a prose card. See the note in
     css/ksat-home.css section 3b for why these are 5/2 and not 4/3. */
  function plate(artKey, code) {
    var p = el('div', 'ksh-plate');
    p.appendChild(image('', artKey, code));
    return p;
  }


  /* ===================================================================
     6 - NAVIGATION

     NO SECOND ROUTER, AND THIS IS THE IMPORTANT ONE.

     js/ksat-shell.js owns chapters AND owns location.hash: goToSection()
     opens the owning chapter, scrolls to the section's own heading and
     replaces the hash, and its popstate and hashchange listeners read it
     back. Two things writing location.hash is a bug that stays invisible
     until a deep link lands on the wrong chapter, and that file's header
     says so at length. js/ksat-explore.js made the same promise.

     So this file writes NOTHING to location.hash, registers no popstate
     and no hashchange listener, and has no view layer. Every tile and
     every row link is one call into the router that already exists,
     preferring KSAT.explore.go because it also closes the Explore panel
     and moves focus to the destination heading, which is work already
     written and tested one file over.
     =================================================================== */
  function goTo(id) {
    if (!id || !document.getElementById(id)) return false;   /* parked, or renamed */

    var ex = KS.explore;
    if (ex && typeof ex.go === 'function') {
      try { if (ex.go(id) !== false) return true; } catch (e) {}
    }
    var sh = KS.shell;
    if (sh && typeof sh.goToSection === 'function') {
      try { return sh.goToSection(id) !== false; } catch (e) {}
    }
    /* Last resort, for a page where neither layer booted. Still not a
       hash write: just a scroll. */
    try { document.getElementById(id).scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth' }); } catch (e) {}
    return false;
  }

  /* Scrolling to a panel INSIDE the section we are already in. This is
     not navigation and must not touch the router: the reader can see
     the card, so the chapter is already open and the hash is already
     right.

     scroll-margin-top comes from the .ksh-target class in
     css/ksat-home.css, because a panel has none of its own and a smooth
     scroll would otherwise park it under the sticky masthead. */
  function revealPanel(node) {
    if (!node) return;
    node.classList.add('ksh-target');
    try {
      node.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
    } catch (e) {
      node.scrollIntoView();
    }
    /* FOCUS HAS TO LAND SOMEWHERE OR THE KEYBOARD READER IS STRANDED.
       tabindex="-1" makes a heading focusable without putting it in the
       tab order, and preventScroll stops a second scroller fighting the
       smooth one, which reads as a visible stutter. The same shape
       js/ksat-explore.js go() uses, and for the same reasons. */
    var h = node.querySelector('summary, h3, h2') || node;
    if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1');
    setTimeout(function () {
      try { h.focus({ preventScroll: true }); } catch (e) { try { h.focus(); } catch (e2) {} }
    }, reduced() ? 0 : 280);
  }


  /* ===================================================================
     7 - TREATMENT 1 AND 2 ON #mission
     =================================================================== */

  /* A state stamp, so a render that would produce exactly what is
     already on screen does nothing. Rebuilding the cards on every theme
     attribute mutation would swap eight <img> src values and throw away
     eight decoded bitmaps for no visible change. */
  function stamp(code) {
    return code + '|' + (isNight() ? 'n' : 'd') + '|' + (narrow() ? 's' : 'w');
  }

  function applyMission(code) {
    var sec = document.getElementById('mission');
    if (!sec) return;

    /* ---- the band, built once ------------------------------------- */
    var band = sec.querySelector(':scope > .ksh-band');
    if (!band) {
      band = el('div', 'ksh-band');

      var img = el('img', 'ksh-band__img');
      img.decoding = 'async';
      /* NOT lazy. This one is the first thing in the section and, on a
         chapter the shell opens directly, can be the first thing in the
         viewport. A lazy attribute on an image that is already on
         screen buys nothing and costs a visible pop. */
      band.appendChild(img);

      var scrim = el('div', 'ksh-band__scrim');
      scrim.setAttribute('aria-hidden', 'true');
      band.appendChild(scrim);

      band.appendChild(el('div', 'ksh-band__copy'));

      /* FIRST CHILD OF THE SECTION. Not a sibling in .wrap. See the
         #descent note in the header. */
      sec.insertBefore(band, sec.firstChild);
    }

    var copy = band.querySelector('.ksh-band__copy');

    /* index.html's own eyebrow and heading are MOVED in, not copied.
       appendChild on a node already in the document relocates it, so
       every data-i18n key survives and js/ksat-i18n.js keeps
       translating them. On every pass after the first these two
       selectors find nothing, because the nodes are no longer direct
       children of the section, and the moves are a no-op. */
    var eyebrow = sec.querySelector(':scope > .eyebrow');
    if (eyebrow) copy.appendChild(eyebrow);
    var h2 = sec.querySelector(':scope > h2.st');
    if (h2) copy.appendChild(h2);

    /* The dek and the link, ours, created once and re-worded on every
       language change. textContent rather than innerHTML: there is no
       markup in these strings and there never should be. */
    var dek = copy.querySelector(':scope > .ksh-dek');
    if (!dek) {
      dek = el('p', 'ksh-dek');
      /* THE DEK OPTS OUT OF js/ksat-density.js, AND WITHOUT THIS LINE
         THE BAND SHIPPED A HALF SENTENCE.

         MEASURED IN THE LIVE PAGE BEFORE THIS LINE EXISTED. That file
         walks every `section[id]` and clamps any paragraph longer than
         its LONG_ONE threshold of 150 characters to two lines, then
         inserts a "Read more" button after it. COPY.bandDek is 172
         characters. So the band rendered:

           "A 2U CubeSat of roughly 2 kg, built and operated by Kuwait
            University. It launched from Cape Canaveral on 3 January
            2023 and returned its first..."

         cut there, with a Read more control dropped between the dek and
         the link, over the photograph. The paragraph measured 47px of a
         71px scrollHeight: one of its three lines was behind a button.

         TWO THINGS WERE WRONG WITH THAT. The clause it ate, "returned
         its first image series on 5 April 2023", is a cited fact, SPECS
         spec.first, and it was the only place in this band where the
         mission's result appears. And clamping the dek is the exact
         thing the team asked to have stopped: "dont keep text squezed
         like that" is the sentence this whole file answers, and a
         three line paragraph showing two lines and an ellipsis is that
         complaint reproduced by another file.

         WHY THIS FLAG AND NOT A CSS OVERRIDE. js/ksat-density.js reads
         `p.dataset.ksatFolded` in its own eligible() test and skips any
         paragraph that already carries it; clampOne() sets the same
         flag on everything it takes. It is that file's own opt out,
         used the way that file uses it, so nothing there has to change
         and nothing here has to fight a `-webkit-line-clamp` in the
         cascade. Its KEEP_WHOLE list is the other door and it already
         holds '#legend', which is why the prose this file moves inside
         #legend was never at risk and only this one paragraph was.

         THE TIMING WORKS OUT AND IS WORTH STATING. That file runs its
         sweep ONCE, from a 120ms poll after DOMContentLoaded, and never
         again. boot() below calls render() synchronously, so this
         paragraph exists and carries the flag before the first tick. */
      dek.dataset.ksatFolded = '1';
      copy.appendChild(dek);
    }
    dek.textContent = L(COPY.bandDek, code);

    var link = copy.querySelector(':scope > .ksh-link');
    if (!link) {
      link = el('button', 'ksh-link');
      link.type = 'button';
      link.addEventListener('click', function () { goTo('imagery'); });
      copy.appendChild(link);
    }
    /* Rebuilt rather than patched, so the label and the arrow are
       always written together and an Arabic label can never be left
       beside an English one. */
    link.innerHTML = arrow('ksh-arrow');
    link.insertBefore(document.createTextNode(L(H.imagery, code)), link.firstChild);
    link.hidden = !document.getElementById('imagery');

    /* The plate itself. */
    var bandArt = narrow() ? 'kuwait' : 'band';
    var bImg = band.querySelector('.ksh-band__img');
    var wantSrc = artSrc(bandArt);
    /* Compared against the resolved absolute URL the property returns,
       not against the attribute, so a re-render with the same art does
       not restart the fetch. */
    if (bImg.getAttribute('src') !== wantSrc) bImg.setAttribute('src', wantSrc);
    bImg.alt = artAlt(bandArt, code);

    keepFactStripOutOfTheBand(sec, band);

    /* ---- the card row --------------------------------------------- */
    var grid = sec.querySelector(':scope > .grid');
    var row = sec.querySelector(':scope > .ksh-row');
    if (!row) {
      row = el('div', 'ksh-row');
      /* Before the material it describes, and still inside the
         section. The specification table, the concept chain and the
         ground segment panel are untouched underneath: this row is a
         way IN to them, not a replacement for them, and the team's
         brief says in as many words to keep the table reachable. */
      if (grid) sec.insertBefore(row, grid);
      else sec.appendChild(row);
    }
    if (row.dataset.kshStamp === stamp(code)) return;
    row.dataset.kshStamp = stamp(code);

    row.innerHTML = '';
    row.appendChild(rowHead(COPY.missionRow, 'sources', code));

    var cards = el('div', 'ksh-cards');

    /* THE COUNT IS ASSERTED, NOT TRUSTED. mis.specn says twelve. If
       SPECS ever stops having twelve rows the line is dropped and the
       card carries one fewer line, rather than printing a number that
       has quietly become false. */
    var sp = specs();
    var recordMeta = (sp && sp.length === 12) ? COPY.cRecordM : null;

    var fold = sec.querySelector('details.specfold');
    cards.appendChild(card('sat1', COPY.cRecord, recordMeta, code, function () {
      if (fold) {
        /* The table is folded shut by default. A card that scrolls a
           reader to a closed accordion and leaves them to find the
           summary has not opened anything. */
        fold.open = true;
        revealPanel(fold);
      }
    }));

    var chain = sec.querySelector('[data-i18n="mis.chain"]');
    var chainPanel = chain ? chain.closest('.panel') : null;
    cards.appendChild(card('sat2', COPY.cChain, null, code, function () {
      revealPanel(chainPanel);
    }));

    var gs = sec.querySelector('[data-i18n="mis.gs"]');
    var gsPanel = gs ? gs.closest('.panel') : null;
    cards.appendChild(card('sat3', COPY.cGround, COPY.cGroundM, code, function () {
      revealPanel(gsPanel);
    }));

    if (document.getElementById('imagery')) {
      cards.appendChild(card('kuwait', H.imagery, COPY.cImageryM, code, function () {
        goTo('imagery');
      }));
    }

    row.appendChild(cards);
  }

  /* THE FACT STRIP HAS TO STAY OUT OF THE BAND, AND THE REASON IS A
     ONE LINE SELECTOR IN ANOTHER FILE.

     js/ksat-explore.js mounts its six tile fact strip with
     `sec.insertBefore(host, h2.nextSibling)` where h2 is
     `sec.querySelector('h2')`. That is a DESCENDANT query, not a child
     query. Once this file has moved index.html's h2 into the band, that
     lookup finds the heading INSIDE the band and the six fact tiles are
     inserted over the photograph, on top of the dek, in a column held
     to the left third.

     Which file runs first is not guaranteed: that one boots on
     DOMContentLoaded and js/ksat-facts.js polls on a 100ms interval, so
     load order decides it. Rather than depend on an order, the strip is
     put back where it belongs whenever it turns up in the wrong place,
     on every render and from a MutationObserver on the band. Its own
     guard is a document wide getElementById, so once it exists it is
     never re-inserted and one relocation is permanent.

     The strip itself is not modified. It keeps its id, its class and
     its contents, and that file goes on repainting it on every language
     change exactly as before. */
  function keepFactStripOutOfTheBand(sec, band) {
    var strip = document.getElementById('ksat-ex-facts');
    if (!strip) return;
    if (!band.contains(strip)) return;
    band.insertAdjacentElement('afterend', strip);
  }

  function watchBand() {
    var sec = document.getElementById('mission');
    var band = sec && sec.querySelector(':scope > .ksh-band');
    if (!band || band.dataset.kshWatched === '1') return;
    if (typeof MutationObserver === 'undefined') return;
    band.dataset.kshWatched = '1';
    new MutationObserver(function () {
      keepFactStripOutOfTheBand(sec, band);
    }).observe(band, { childList: true, subtree: true });
  }


  /* ===================================================================
     8 - TREATMENTS 3, 2 AND 4 ON THE SECTION js/ksat-facts.js BUILDS

     That file owns #legend and rebuilds its whole .ksf container from
     scratch on every language change, which wipes every wrapper this
     function adds. That is not a problem to work around, it is the
     staleness test: if .ksh-feature is not in there, the container has
     been rebuilt and everything below has to run again. If it is, there
     is nothing to do.
     =================================================================== */
  function applyLegend(code) {
    var ksf = document.querySelector('#legend .ksf');
    if (!ksf) return;
    if (ksf.querySelector(':scope > .ksh-feature')) {
      /* Already wrapped. The only thing that can still be stale is the
         art, which follows the theme rather than the language. */
      refreshLegendArt(code);
      return;
    }

    /* ---- TREATMENT 3: the lede beside a real picture --------------- */
    var firstBand = ksf.querySelector(':scope > .ksf-band');

    var feature = el('div', 'ksh-feature');
    var fcopy = el('div', 'ksh-feature__copy');
    feature.appendChild(fcopy);
    ksf.insertBefore(feature, firstBand || null);

    /* Everything that stood before the first block band is the lede:
       the eyebrow, the heading, two paragraphs and the four figure
       tiles. Collected by POSITION rather than by a list of selectors,
       so a future js/ksat-facts.js that adds a line to its lede does
       not leave that line orphaned above the feature. */
    var move = [];
    var n = ksf.firstElementChild;
    while (n && !(n.classList && n.classList.contains('ksf-band'))) {
      if (n !== feature) move.push(n);
      n = n.nextElementSibling;
    }
    move.forEach(function (node) { fcopy.appendChild(node); });

    feature.appendChild(figureFor('limb', COPY.capLimb, code));

    /* ---- TREATMENT 2: the two prose blocks under it ---------------- */
    var two = ksf.querySelector(':scope > .ksf-band.two');
    if (two) {
      var row = el('div', 'ksh-row');
      ksf.insertBefore(row, two);
      row.appendChild(rowHead(COPY.legendRow, 'mission', code));
      row.appendChild(two);                    /* appendChild moves it */

      /* A banner plate on each block. The prose is untouched: see the
         note in css/ksat-home.css section 3b for why these two keep
         every word instead of becoming image cards with a short label.
         The quoted mission objective is the reason this platform is
         credible and a card row is not worth deleting it for. */
      var blocks = two.querySelectorAll(':scope > .ksf-block');
      var plateArt = ['sat4', 'mark'];
      for (var i = 0; i < blocks.length && i < plateArt.length; i++) {
        blocks[i].insertBefore(plate(plateArt[i], code), blocks[i].firstChild);
      }
    }

    /* ---- TREATMENT 3 AGAIN: the record beside a picture ------------ */
    /* Found by CONTENT, not by index. The three block bands are the
       objective pair, the record and the national picture, and reading
       them off a nodeList position would break the first time one is
       added or reordered in js/ksat-facts.js. */
    var recBand = null, natBand = null;
    var bands = ksf.querySelectorAll(':scope > .ksf-band');
    for (var b = 0; b < bands.length; b++) {
      if (bands[b].querySelector('.ksf-rec')) recBand = bands[b];
      if (bands[b].querySelector('.ksf-pillars')) natBand = bands[b];
    }

    if (recBand) {
      var f2 = el('div', 'ksh-feature');
      ksf.insertBefore(f2, recBand);
      var c2 = el('div', 'ksh-feature__copy');
      f2.appendChild(c2);
      c2.appendChild(recBand);                 /* appendChild moves it */
      f2.appendChild(figureFor('gulf', COPY.capGulf, code));
    }

    /* ---- TREATMENT 4: the topic grid at the foot -------------------

       THE ANCHOR MOVED BECAUSE THE BAND IT USED IS GONE. This grid was
       inserted after the national picture band, and js/ksat-facts.js no
       longer emits that band: the team asked for the Vision 2035
       pillars and the dated record taken off the page. Anchored to that
       band and nothing else, the whole topic grid would have vanished
       with it, silently, which is the kind of collateral nobody asks
       for.

       The first repair was "fall back to the last band", and it did not
       work: by the time this runs, the treatments above have MOVED the
       only remaining band inside a .ksh-feature wrapper, so a
       `:scope > .ksf-band` list is empty. Measured in the browser, and
       the grid still did not appear.

       So the fallback is a position rather than a sibling. The grid
       goes at the foot of the section, immediately before the closing
       provenance note, which is where "at the foot" meant all along. */
    var gridRow = el('div', 'ksh-row');
    if (natBand) {
      natBand.insertAdjacentElement('afterend', gridRow);
    } else {
      var tail = ksf.querySelector(':scope > .ksf-note');
      if (tail) { ksf.insertBefore(gridRow, tail); } else { ksf.appendChild(gridRow); }
    }
    gridRow.appendChild(rowHead(COPY.gridRow, null, code));
    gridRow.appendChild(buildGrid(code));
  }

  function buildGrid(code) {
    var g = el('div', 'ksh-grid');

    DESTS.forEach(function (d) {
      /* CHECKED AGAINST THE LIVE DOCUMENT. A tile for a section the
         shell has parked would be a button that does nothing, and on a
         page whose whole argument is that a link can be trusted that is
         worse than one tile fewer. */
      if (!document.getElementById(d.id)) return;

      /* A PHOTOGRAPH GETS A FLAT GROUND AND A CUT OUT GETS THE
         HIGHLIGHT, AND MIXING THE TWO UP IS WHAT THE SECOND CLASS
         FIXES.

         --ksh-plate in css/ksat-home.css is a radial highlight over
         --surf-2, and the comment on it says exactly what it is for:
         sat-three-quarter.png and its three siblings are a dark body
         with dark blue cells on a TRANSPARENT background, and without
         that lift they are a black shape on a black ground. The emblem
         is transparent too and wants the same lift.

         The Earth frames are not transparent. They are JPEGs that carry
         their own background, and globe-*.jpg is a disk on black. It is
         square, a tile is 4/3, so contain leaves a 12.5 percent mat at
         each side, and MEASURED IN THE LIVE PAGE that mat was painting
         the radial highlight: two pale grey bars either side of a black
         photograph, which reads as a picture that failed to load rather
         than as a frame.

         So a tile carrying a photograph is marked here and
         css/ksat-home.css gives it a flat near black ground instead. On
         the four 4/3 plates the ground is never seen, because the
         picture fills the tile exactly. On the globe it is the same
         black the photograph itself is on, so the mat disappears and
         the disk shows whole. That is what "zoomed out so you see the
         full pic" asked for, without the bars the literal reading of it
         produced.

         Decided from ART rather than from the file extension, because
         the extension is an accident of how the file was saved and the
         transparency is the thing that actually matters. */
      var t = el('button', 'ksh-tile');
      t.type = 'button';
      if (PHOTO_ART.indexOf(d.art) > -1) t.classList.add('ksh-tile--photo');
      var ti = image('ksh-tile__img', d.art, code);
      /* The art key is stamped ON THE NODE. refreshLegendArt walks the
         live tiles, and the live tile list is filtered by what is in
         the document, so it can be shorter than DESTS. Reading the key
         back off the node is what stops a theme change from pairing a
         picture with the wrong tile after a section has been parked. */
      ti.dataset.kshArt = d.art;
      t.appendChild(ti);

      var lab = el('div', 'ksh-tile__label');
      var s = el('span', 'ksh-tile__t');
      s.textContent = L(H[d.id], code);
      lab.appendChild(s);

      var holder = el('span', '');
      holder.innerHTML = arrow('ksh-tile__arrow');
      lab.appendChild(holder.firstChild);

      t.appendChild(lab);
      t.addEventListener('click', function () { goTo(d.id); });
      g.appendChild(t);
    });

    return g;
  }

  /* The wrappers in #legend survive a theme change, because nothing
     dispatches 'ksat:lang' for a theme change and js/ksat-facts.js does
     not rebuild. Only the pictures are stale, so only the pictures are
     replaced, one src and one alt at a time. */
  function refreshLegendArt(code) {
    var ksf = document.querySelector('#legend .ksf');
    if (!ksf) return;
    var want = stamp(code);
    if (ksf.dataset.kshArt === want) return;
    ksf.dataset.kshArt = want;

    var figs = ksf.querySelectorAll('.ksh-feature__media img');
    var keys = ['limb', 'gulf'];
    for (var i = 0; i < figs.length && i < keys.length; i++) {
      figs[i].setAttribute('src', artSrc(keys[i]));
      figs[i].alt = artAlt(keys[i], code);
    }
    var plates = ksf.querySelectorAll('.ksh-plate img');
    var pkeys = ['sat4', 'mark'];
    for (var p = 0; p < plates.length && p < pkeys.length; p++) {
      plates[p].setAttribute('src', artSrc(pkeys[p]));
      plates[p].alt = artAlt(pkeys[p], code);
    }
    var tiles = ksf.querySelectorAll('.ksh-tile__img');
    /* The tile list is filtered by what is in the document, so it can
       be shorter than DESTS. Walking the live nodes and taking the art
       key from the matching DESTS entry by index would then pair a
       picture with the wrong tile. The art key is read back off the
       node instead. */
    for (var q = 0; q < tiles.length; q++) {
      var k = tiles[q].dataset.kshArt;
      if (!k) continue;
      tiles[q].setAttribute('src', artSrc(k));
      tiles[q].alt = artAlt(k, code);
    }
  }


  /* ===================================================================
     9 - RENDER, AND WHEN
     =================================================================== */
  function render() {
    var code = currentLang();
    try { applyMission(code); } catch (e) { console.warn('[ksat-home] mission', e); }
    try { watchBand(); } catch (e) {}
    try { applyLegend(code); } catch (e) { console.warn('[ksat-home] legend', e); }
    /* The stamp on .ksf is written by refreshLegendArt, which is only
       reached on a pass that finds the wrappers already there. On the
       pass that BUILDS them the art is current by construction, so the
       stamp is set here instead. Without this the first theme change
       after a language change would think the art was already right. */
    var ksf = document.querySelector('#legend .ksf');
    if (ksf && !ksf.dataset.kshArt) ksf.dataset.kshArt = stamp(code);
  }

  /* js/ksat-i18n.js fires this at the very end of its apply(). The
     setTimeout is the important part: js/ksat-facts.js listens to the
     same event and rebuilds the container we wrap, so deferring puts us
     after it whatever order the listeners were registered in. */
  document.addEventListener('ksat:lang', function () { setTimeout(render, 0); });

  /* The theme is an attribute on <html> and nothing dispatches an event
     for it, so it is observed. attributeFilter keeps this from firing on
     every other attribute the shell writes to the root, of which there
     are several. */
  if (typeof MutationObserver !== 'undefined') {
    new MutationObserver(function () { render(); })
      .observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-ksat-lang', 'dir'] });
  }

  /* Two media queries this file genuinely depends on. The width one
     decides which plate the band uses, and the colour scheme one covers
     the reader who has never touched the theme control, where
     isNight() falls through to the system preference. */
  function listen(q, fn) {
    var m;
    try { m = matchMedia(q); } catch (e) { return; }
    if (m.addEventListener) m.addEventListener('change', fn);
    else if (m.addListener) m.addListener(fn);          /* older Safari */
  }
  listen('(max-width: 760px)', function () { render(); });
  listen('(prefers-color-scheme: dark)', function () { render(); });

  function boot() {
    /* #mission and #legend are static markup, so both are present at
       DOMContentLoaded. js/ksat-facts.js's .ksf container is NOT: it
       polls on a 100ms interval of its own before it builds. So this
       poll waits for the thing it actually needs, rather than for the
       section that was always going to be there, and gives up after six
       seconds rather than spinning for the life of the page. */
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      var ready = document.querySelector('#legend .ksf .ksf-band');
      if (ready || tries > 60) {
        clearInterval(iv);
        render();
      }
    }, 100);
    /* And one immediate pass, so #mission gets its band without waiting
       for the other file. render() is idempotent. */
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  KS.home = { render: render, copy: COPY, dests: DESTS };
})();
