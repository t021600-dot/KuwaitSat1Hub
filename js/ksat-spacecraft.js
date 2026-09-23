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

   NOTHING IS THROWN AWAY. The twelve entries are the page's own SPECS
   array and they are still the page's own SPECS array — this file reads
   them back out of #specTable rather than retyping them, so there is
   exactly one copy of that data in the project and a correction to it
   lands here automatically. The concept chain is read out of
   #conceptFlow the same way. css/ksat-spacecraft.css folds the two
   original blocks away on the public tier; a signed-in researcher on
   the hub still gets them as they were.

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
   THE THIRD PASS: LESS TEXT, AND ONE CONTROL INSTEAD OF THREE LISTS
   ---------------------------------------------------------------------
   The first build of this block had four long readings, four derived
   figures with their arithmetic printed beside them, a twelve-row
   record grid and a six-step pipeline. All of it was true and most of
   it was text, and the team's answer was "super super summarize this",
   "delete this" over the figures, and "remove this ... present it in a
   minimalist way less text more interactive way" over the other two.

   So: the readings are about a third of their old length. The derived
   figures are gone, along with the orbital arithmetic they carried.

   And the record and the pipeline are now ONE control. Every entry is a
   chip; the chip carries the label and a single line underneath carries
   the value of whichever chip you point at. Eighteen facts, two lines
   of text on screen at rest, and nothing hidden behind a fold that a
   reader has to know to open.

   That is a real trade, so it is worth writing down what was given up:
   the four derived figures were the one place on this page that showed
   its own working — the inclination sun-synchrony needs at 525 km came
   out at 97.5 degrees against a published 97.6, in public, to a tenth
   of a degree. It is in the git history if it is ever wanted back.

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

    lede: {
      en: 'Everything here begins as a frame from a box the size of two milk cartons. What it can see follows from its orbit, its lens and its three colours.',
      ar: 'كل ما هنا يبدأ من صورة تلتقطها عُلبة بحجم عبوتَي حليب. وما تستطيع رؤيته ينتج عن مدارها وعدستها وألوانها الثلاثة.'
    },

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

    /* ONE CONTROL INSTEAD OF TWO LISTS. The twelve record entries were
       a twelve-row grid and the pipeline was six numbered cards, and
       together they were most of the text on this page. They are chips
       now: point at one, read one line. Same facts, same sources, about
       two lines of text on screen at rest. */
    railH: { en: 'The record', ar: 'السجل' },
    railB: { en: '🛰 Measured', ar: '🛰 مقيس' },
    railN: { en: 'Every figure published about this mission, and the pipeline they feed. Choose one.',
             ar: 'كل رقم منشور عن هذه المهمة، والمسار الذي تغذّيه. اختر واحداً.' },
    railP: { en: 'Pipeline', ar: 'المسار' },
    railHint: { en: 'Choose an entry to read it.',
                ar: 'اختر مدخلة لقراءتها.' },

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

  /* index.html builds #specTable from its own SPECS array. Reading it
     back means there is still exactly one copy of those twelve facts in
     the project: correct one and this follows, with no second list to
     forget. It also means the source marks — [1], [4], [5] — arrive
     already in place, because they are part of the cell text.

     Returns null, not [], when the table has not been built yet, so
     paint() can tell "not ready" from "empty". */
  function record() {
    var rows = document.querySelectorAll('#specTable tr');
    if (!rows.length) { return null; }
    var out = [];
    Array.prototype.forEach.call(rows, function (tr) {
      var c = tr.children;
      if (c.length < 2) { return; }
      out.push({ k: c[0].textContent.trim(), v: c[1].textContent.trim() });
    });
    return out.length ? out : null;
  }

  /* #conceptFlow is built by index.html too. Its children alternate
     .fnode and .farrow — six steps and the five connectors drawn
     between them — and each .fnode holds an icon, a .ft name and a .fs
     line.

     THE FIRST VERSION OF THIS GUESSED AT THE MARKUP, with a list of
     likely selectors (b, strong, .k, h4) and a fallback that split the
     node's whole textContent on a newline. There are no newlines in
     that markup, so every step came out as one run reading
     "SatelliteKuwaitSat-1 acquires an RGB frame" — the name and its
     line concatenated with nothing between them. Guessing at a
     structure three files away and not looking at the result is how
     that happens. This reads .fnode / .ft / .fs, which is what is
     actually there, and returns null rather than rubbish if index.html
     ever changes them. */
  function pathSteps() {
    var nodes = document.querySelectorAll('#conceptFlow .fnode');
    if (!nodes.length) { return null; }
    var out = [];
    Array.prototype.forEach.call(nodes, function (node) {
      var t = node.querySelector('.ft');
      var d = node.querySelector('.fs');
      var name = (t ? t.textContent : '').trim();
      if (!name) { return; }
      out.push({ n: name, d: (d ? d.textContent : '').trim() });
    });
    return out.length ? out : null;
  }

  /* ===================================================================
     4 · PAINT
     =================================================================== */
  var host = null;

  function paint() {
    var sec = document.getElementById('mission');
    if (!sec) { return false; }

    var recs = record();
    var steps = pathSteps();
    /* The record is the one part worth waiting for. The rest of the
       block is this file's own copy and can be painted immediately, but
       painting a block whose centre is an empty list and then filling
       it a beat later is a visible flicker on a page that has no other
       one. Wait for the table; give up on the path quietly if it never
       arrives, because four steps missing is a smaller loss than the
       whole block. */
    if (!recs) { return false; }

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
    open.appendChild(el('p', 'kss-lede', L(COPY.lede)));
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

    /* ---- the record and the pipeline, as one rail ------------------
       Twelve entries and however many pipeline steps the page has, all
       as chips, with one line underneath showing whichever is chosen.
       The chips carry the LABEL and the line carries the VALUE, which
       is the right way round: the labels are two or three words and the
       values are the sentences. */
    var rec = el('div', 'kss-part');
    rec.id = 'ksat-spacecraft-record';
    rec.appendChild(head(COPY.railH, COPY.railN, COPY.railB, 'real'));

    var chips = el('div', 'kss-chips');
    var out = el('p', 'kss-out', L(COPY.railHint));
    /* polite, not assertive: this updates on hover as well as on click,
       and an assertive region would interrupt a screen reader on every
       pointer move across the row. */
    out.setAttribute('role', 'status');
    out.setAttribute('aria-live', 'polite');

    var chosen = null;
    function chip(label, value, cls) {
      var b = el('button', 'kss-chip' + (cls ? ' ' + cls : ''), label);
      b.type = 'button';
      b.setAttribute('aria-pressed', 'false');
      function show() {
        if (chosen && chosen !== b) { chosen.setAttribute('aria-pressed', 'false'); }
        chosen = b;
        b.setAttribute('aria-pressed', 'true');
        out.textContent = value || label;
      }
      b.addEventListener('click', show);
      b.addEventListener('mouseenter', show);
      b.addEventListener('focus', show);
      chips.appendChild(b);
      return b;
    }

    recs.forEach(function (r) { chip(r.k, r.v); });

    if (steps) {
      var lab = el('span', 'kss-chips__lab', L(COPY.railP));
      chips.appendChild(lab);
      steps.forEach(function (st, i) {
        chip(String(i + 1) + ' \u00b7 ' + st.n, st.d, 'kss-chip--step');
      });
    }

    rec.appendChild(chips);
    rec.appendChild(out);
    host.appendChild(rec);

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
