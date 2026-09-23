/* =====================================================================
   ksat-spacecraft.js — THE MACHINE, AND THE LINE WHERE IT STOPS
   Owner: 01 Front End.  Pairs with css/ksat-spacecraft.css.

   ---------------------------------------------------------------------
   THE BRIEF
   ---------------------------------------------------------------------
     "remove this — i dont like it like that — put the real pic of the
      satlight and do your research on explaining it scientficcly and
      whatever is good to be put on the home page at the bottom."

   The thing pointed at was the bottom half of #mission: a twelve row
   specification table folded shut behind a summary, beside a vertical
   Concept chain of four boxes. Both are good CONTENT presented as a
   form. Neither has a picture in it, on a page whose subject is a
   camera in orbit and which now has a photograph of the actual flight
   unit sitting in assets/.

   css/ksat-spacecraft.css folds both of the original blocks away on the
   public tier. A signed-in researcher on the hub still has them as they
   were, and nothing is removed from the document.

   ---------------------------------------------------------------------
   WHY THIS IS A CHILD OF #mission AND NOT A NEW SECTION
   ---------------------------------------------------------------------
   js/ksat-home.js's header says it, having paid for it: js/ksat-shell.js
   shows one chapter at a time and hides the others section by section,
   so a node added as a SIBLING of the sections belongs to no chapter,
   is never hidden, and stands under all six. A new <section> would have
   needed registering in that file's CHAPTERS array as well.

   Appending to #mission costs none of that. #mission is the last
   section of chapter one that a public reader sees — #builders is
   insider — so the bottom of #mission IS the bottom of the home page,
   which is where this was asked for.

   ---------------------------------------------------------------------
   IT HAS BEEN CUT THREE TIMES, AND HERE IS THE WHOLE LEDGER
   ---------------------------------------------------------------------
   The first build had four long readings, four derived figures with
   their arithmetic printed beside them, a twelve-row record grid and a
   six-step pipeline. Every pass since has been subtraction, asked for
   in these words:

     "super super summarize this"        the readings, now a third as
                                         long as they were
     "delete this"                       the derived figures
     "remove this ... present it in a
      minimalist way less text more
      interactive way"                   the grid and the pipeline, which
                                         became one row of chips
     "remove this and instead of it
      put this video"                    and then the chips too

   What stands now is: a heading, two sentences, the photograph, four
   short readings, and the launch clip.

   THE LEDGER, because two of those were real losses and a reader of
   this file should not have to dig for them.

   The derived figures were the one place on this page that showed its
   own working: the inclination sun-synchrony needs at 525 km came out
   at 97.5 degrees against a published 97.6, in public, to a tenth of a
   degree.

   The twelve record entries were the page's provenance made visible —
   operator, form factor, mass, payload, GSD, swath, vehicle, launch,
   COSPAR id, ground station, objective, first imagery, each with its
   source mark. They are still in the document as #specTable, still on
   the researcher side, and the numbered register in #sources is
   untouched. They are simply no longer on screen for a visitor.

   Both are in the git history and both are about twenty lines to bring
   back.

   ---------------------------------------------------------------------
   THE ONE CLAIM THAT IS A LIMITATION RATHER THAN A FEATURE
   ---------------------------------------------------------------------
   The payload is an RGB camera. NDVI — the index almost everybody means
   when they say "vegetation index" — is (NIR - R)/(NIR + R) and needs a
   near infrared band, which this spacecraft does not have. So it cannot
   be computed from KuwaitSat-1 at all, and the block says so in plain
   words rather than leaving a reader to assume otherwise.

   Saying it is not a weakness in the pitch, it IS the pitch: this whole
   platform is built on the difference between what was measured and
   what was modelled, and a section about the instrument is the natural
   place to draw that line. A visible-band greenness index such as
   2G - R - B is computable from these frames and is named instead.
   ===================================================================== */

(function () {
  'use strict';

  var KS = window.KSAT = window.KSAT || {};
  if (KS.spacecraft) { return; }
  KS.spacecraft = true;

  var SHOT = 'assets/cards/ksat1-flight-unit.png';
  /* The same clip index.html embeds in its opening sequence. One id,
     one place, so the two cannot drift. */
  var FILM = 'XGuaRj3C4bM';

  /* ===================================================================
     1 · COPY

     Same shape as js/ksat-home.js's COPY: an { en, ar } pair per string,
     resolved at paint time against the live language. Nothing here goes
     through js/ksat-i18n.js's dictionary, because that dictionary is
     keyed on strings that already existed in index.html and these did
     not. Repainting on ksat:lang is this file's own job; see boot().
     =================================================================== */
  var COPY = {
    h: { en: 'The spacecraft, and what one frame can tell you',
         ar: 'المركبة، وما الذي تستطيع صورة واحدة أن تخبرك به' },

    cap: {
      en: 'KuwaitSat-1. Photograph supplied by the project. The dark blue faces are its only source of power; the four antennas travel coiled against the body and spring out on release.',
      ar: 'كويت سات-١. الصورة مقدَّمة من المشروع. الأوجه الزرقاء الداكنة مصدر طاقتها الوحيد، والهوائيات الأربعة تُلفّ على الجسم ثم تنتشر بعد الانفصال.'
    },

    /* SUPER SUPER SUMMARIZED, in the team's words. Each of these ran to
       about 85 words and is now about 30. Nothing was dropped that was
       load-bearing: the sun-synchronous argument, the pixel size, the
       NDVI limit and the downlink bottleneck are all still stated. What
       went was the second and third sentence explaining each of them,
       which is the part a reader on a home page does not stop for. */
    blocks: [
      { t: { en: 'The orbit is the clock',
             ar: 'المدار هو الساعة' },
        p: { en: 'Sun-synchronous at 525 km: every pass crosses a given latitude at the same local solar time. Two frames months apart carry the same sun angle, so a difference between them is a difference on the ground and not in the light.',
             ar: 'مدار متزامن مع الشمس على ارتفاع ٥٢٥ كم: كل مرور يعبر خط العرض نفسه في التوقيت الشمسي المحلي نفسه. فصورتان تفصل بينهما أشهر تحملان زاوية الشمس نفسها، ويكون الفرق بينهما فرقاً على الأرض لا في الإضاءة.' } },

      { t: { en: 'What 39 metres a pixel buys',
             ar: 'ما الذي تشتريه ٣٩ متراً لكل بكسل' },
        p: { en: 'One pixel is 1,520 m², a fifth of a football pitch. A road or a single tree is not in the picture. A farm, a landfill cell, a new district or a stretch that has greened is.',
             ar: 'البكسل الواحدة ١٥٢٠ متراً مربعاً، خُمس ملعب كرة قدم. فالطريق أو الشجرة المفردة ليست في الصورة، أما المزرعة وخلية الردم والحي الجديد والرقعة التي اخضرّت فنعم.' } },

      { t: { en: 'Three colours, and where measurement stops',
             ar: 'ثلاثة ألوان، وأين يتوقف القياس' },
        p: { en: 'The camera is red, green and blue only. NDVI needs near infrared, so it cannot be computed from this spacecraft at all. A visible-band greenness index can. Everything past that is modelled, and says so.',
             ar: 'الكاميرا أحمر وأخضر وأزرق فقط. ومؤشر NDVI يحتاج الأشعة تحت الحمراء القريبة، فلا يمكن حسابه من هذه المركبة إطلاقاً، بينما يمكن حساب مؤشر خُضرة مرئي. وكل ما بعد ذلك محسوب بنموذج، ومعلَّم بذلك.' } },

      { t: { en: 'The link is the bottleneck, not the lens',
             ar: 'الاختناق في الوصلة لا في العدسة' },
        p: { en: 'A frame is about 12 MB and there is one ground station, at Kuwait University. Fifteen passes a day, a handful high enough to be worth a downlink, minutes each. So it returns chosen frames, not a stream.',
             ar: 'حجم الإطار نحو ١٢ ميغابايت، والمحطة الأرضية واحدة في جامعة الكويت. خمس عشرة مروراً يومياً، القليل منها مرتفع بما يكفي ليستحق إنزالاً، ودقائق لكل منها. فهي تعيد إطارات مختارة لا تدفقاً متصلاً.' } }
    ],

    /* THE LAUNCH CLIP, WHERE THE RECORD RAIL WAS.

       The rail was eighteen chips and one line, and it replaced a
       twelve-row grid before that. The team's answer to both was the
       same shape of answer, and this time it was "remove this and
       instead of it put this video". So the twelve published entries no
       longer appear on the public home page at all. They are still in
       the document (#specTable, hidden for this tier), still on the
       researcher side, and the numbered provenance register in #sources
       is untouched — but a visitor now reads the spacecraft, sees it,
       and watches it leave, which is a fair trade for a home page.

       The clip is the one index.html already embeds in its opening
       sequence, XGuaRj3C4bM. Same video, same source, and vercel.json's
       Content-Security-Policy already carries the frame-src for it. */
    filmH: { en: 'The launch', ar: 'الإطلاق' },
    /* THE CREDIT LINE IS GONE FROM THE SCREEN, NOT FROM THE PAGE, and
       that distinction is the reason this comment stays. The clip is a
       report published by Al-Jarida, «كويت سات 1».. بصمة كويتية في
       الفضاء. The team asked for the caption removed; the player itself
       shows the publisher's name and channel across the top of the
       frame before it is played, which is where a viewer will see it,
       and filmTitle below still names them for a screen reader. */
    filmTitle: { en: 'KuwaitSat-1, reported by Al-Jarida',
                 ar: 'كويت سات-١، تقرير جريدة الجريدة' },
    filmBlocked: { en: 'This viewer blocks external media, so the clip cannot play here.',
                   ar: 'هذا المتصفّح يمنع الوسائط الخارجية، فلا يمكن تشغيل المقطع هنا.' },
    filmOpen: { en: 'Open the clip on YouTube', ar: 'افتح المقطع على يوتيوب' },

    alt: { en: 'The KuwaitSat-1 flight unit: a black anodised CubeSat frame with four deep blue solar panel faces, a populated circuit board on the top deck, and four thin whip antennas deployed from that deck.',
           ar: 'وحدة الطيران لكويت سات-١: هيكل مكعّب أسود مؤكسد بأربعة أوجه من الألواح الشمسية الزرقاء الداكنة، ولوحة إلكترونية على السطح العلوي، وأربعة هوائيات رفيعة منتشرة منه.' }
  };

  /* ===================================================================
     2 · SMALL HELPERS
     =================================================================== */
  var root = document.documentElement;

  function lang() { return root.getAttribute('lang') === 'ar' ? 'ar' : 'en'; }
  function L(pair) { var c = lang(); return (pair && pair[c]) || (pair && pair.en) || ''; }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text != null) { n.textContent = text; }
    return n;
  }

  function head(titlePair, notePair, badgePair, badgeCls) {
    var h = el('div', 'kss-head');
    var row = el('div', 'kss-head__row');
    row.appendChild(el('h3', 'kss-head__t', L(titlePair)));
    if (badgePair) { row.appendChild(el('span', 'badge ' + badgeCls, L(badgePair))); }
    h.appendChild(row);
    if (notePair) { h.appendChild(el('p', 'kss-head__n', L(notePair))); }
    return h;
  }

  /* ===================================================================
     3 · THE TWO BLOCKS THAT ARE READ RATHER THAN RETYPED
     =================================================================== */

  /* ===================================================================
     4 · PAINT
     =================================================================== */
  var host = null;

  function paint() {
    var sec = document.getElementById('mission');
    if (!sec) { return false; }

    /* NOTHING HERE WAITS ON THE PAGE ANY MORE. This function used to
       hold off until index.html had filled #specTable, because the
       twelve record entries were read out of it. They are not part of
       this block now — the launch clip took their place — so every
       string, the photograph and the iframe are all this file's own and
       it can paint on the first call. boot()'s poll is left in place
       for the one thing still outside our control: #mission existing.*/

    if (!host) {
      host = el('div', 'kss');
      host.id = 'ksat-spacecraft';
      sec.appendChild(host);
    }
    /* innerHTML is safe here and only here: every child of this node was
       created by this function. Nothing belonging to index.html is ever
       inside it. */
    host.innerHTML = '';
    host.setAttribute('dir', lang() === 'ar' ? 'rtl' : 'ltr');

    /* ---- the opening ---------------------------------------------- */
    var open = el('div', 'kss-open');
    open.appendChild(el('h3', 'kss-h', L(COPY.h)));
    host.appendChild(open);

    /* ---- the photograph, then the four readings under it ----------- */
    var top = el('div', 'kss-top');

    var fig = el('figure', 'kss-shot');
    var img = document.createElement('img');
    img.src = SHOT;
    img.width = 752;
    img.height = 454;
    img.alt = L(COPY.alt);
    img.loading = 'lazy';
    img.decoding = 'async';
    fig.appendChild(img);
    fig.appendChild(el('figcaption', 'kss-cap', L(COPY.cap)));
    top.appendChild(fig);

    var read = el('div', 'kss-read');
    COPY.blocks.forEach(function (b) {
      var art = el('article', 'kss-block');
      art.appendChild(el('h4', 'kss-block__t', L(b.t)));
      art.appendChild(el('p', 'kss-block__p', L(b.p)));
      read.appendChild(art);
    });
    host.appendChild(top);
    host.appendChild(read);

    /* ---- the launch, where the record rail was ---------------------

       AN IFRAME IS THE ONE PLACE THIS FILE GIVES UP CONTROL, so the
       parameters are chosen rather than defaulted:

         youtube-nocookie.com   privacy-enhanced host. No tracking
                                cookie is set until the clip is played.
         no autoplay            this is the foot of a long page, not an
                                opening sequence. A video that starts
                                talking at a reader who scrolled into it
                                is the reason people install blockers.
         rel=0, modestbranding  no grid of unrelated videos at the end.
         loading=lazy           it is below every other thing here.
         referrerpolicy         strict-origin-when-cross-origin, the
                                same value vercel.json sends for the
                                whole site.

       Built with createElement and setAttribute rather than a string of
       HTML, which is this file's rule everywhere and matters more here
       than anywhere else in it. */
    var film = el('div', 'kss-part');
    film.id = 'ksat-spacecraft-film';
    /* Title only. The badge and the provenance note were asked for
       by name and taken out; head() takes nulls for both. */
    film.appendChild(head(COPY.filmH, null, null, null));

    var fig = el('figure', 'kss-film');
    var frame = el('div', 'kss-film__box');

    var yt = document.createElement('iframe');
    yt.className = 'kss-film__yt';
    yt.title = L(COPY.filmTitle);
    yt.src = 'https://www.youtube-nocookie.com/embed/' + FILM +
             '?rel=0&modestbranding=1&playsinline=1';
    yt.setAttribute('allow', 'encrypted-media; picture-in-picture; fullscreen');
    yt.setAttribute('allowfullscreen', '');
    yt.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    yt.setAttribute('loading', 'lazy');
    frame.appendChild(yt);

    /* THE SAME FALLBACK THE OPENING SEQUENCE USES, and for the same
       reason: a reader whose browser blocks third-party frames gets an
       empty black rectangle and no idea why. index.html does this at
       line 995; this is that pattern, scoped to this block.

       THE FIRST VERSION SHOWED IT EVERY TIME, and the cause is worth
       keeping. index.html's copy starts its three-second timer at the
       moment it inserts the frame, which is right there — its frame
       loads immediately. Ours is loading="lazy" at the foot of a
       30,000px page, so three seconds after insertion the browser has
       not fetched anything yet and never intended to. The fallback fired
       under a player that was working.

       So the countdown starts when the frame comes INTO VIEW, which is
       also when the lazy fetch starts, and a load that arrives after
       the timer clears the panel again. Both halves are needed: the
       observer for the common case and the late load for a slow
       connection. */
    var fall = el('div', 'kss-film__fall');
    fall.hidden = true;
    fall.appendChild(el('p', 'kss-film__fallp', L(COPY.filmBlocked)));
    var open = document.createElement('a');
    open.className = 'kss-film__open';
    open.href = 'https://youtu.be/' + FILM;
    open.target = '_blank';
    open.rel = 'noopener';
    open.textContent = L(COPY.filmOpen);
    fall.appendChild(open);

    var loaded = false;
    yt.addEventListener('load', function () {
      loaded = true;
      fall.hidden = true;
    });

    function watchLoad() {
      setTimeout(function () { if (!loaded) { fall.hidden = false; } }, 3000);
    }
    if (typeof IntersectionObserver === 'undefined') {
      watchLoad();                       /* no observer: the old behaviour */
    } else {
      var io = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) { io.disconnect(); watchLoad(); return; }
        }
      }, { rootMargin: '200px 0px' });
      io.observe(frame);
    }

    fig.appendChild(frame);
    fig.appendChild(fall);
    film.appendChild(fig);
    host.appendChild(film);

    return true;
  }

  /* ===================================================================
     5 · THE CARD ROW ABOVE THIS BLOCK HAS NOWHERE LEFT TO GO

     js/ksat-home.js builds a row of four picture cards at the top of
     #mission: Mission record, Concept chain, Ground segment, Captured
     From Space. Every one of those four destinations has now been
     merged into the rail above or taken off the public page, so all
     four would scroll a reader to something that is not there.

     An earlier version of this file intercepted their clicks in the
     capture phase and re-pointed them, which is the right trick when
     there is somewhere to point. With one destination left between the
     four it only puts four identical cards in a row. The row is hidden
     for the public tier in css/ksat-spacecraft.css instead: one line,
     and trivially reversible if the team want it back.
     =================================================================== */

  /* ===================================================================
     6 · BOOT

     index.html fills #specTable from its own script, which runs after
     this one. So this polls — briefly, and then stops. It does NOT use
     a MutationObserver on the table: the table is built once and an
     observer left watching it for the life of the page is a cost with
     no second event to justify it.
     =================================================================== */
  function boot() {
    if (paint()) { return; }
    var left = 80;                        /* ~12s at 150ms */
    var t = setInterval(function () {
      if (paint() || --left <= 0) { clearInterval(t); }
    }, 150);
  }

  /* Language is the one thing that repaints the whole block, and
     js/ksat-i18n.js announces it. The record and the chain are read
     fresh on every repaint, so they arrive already translated by that
     file rather than needing a second dictionary here. */
  document.addEventListener('ksat:lang', function () { if (host) { paint(); } });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}());
