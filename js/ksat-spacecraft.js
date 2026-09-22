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
   THE FOUR FIGURES THAT ARE WORKED OUT HERE
   ---------------------------------------------------------------------
   This page badges every number as measured, reference, modelled or
   derived, and it would be a poor advertisement for that habit if a
   section about the spacecraft quietly mixed the four. So the block is
   in three declared parts: the published record (measured), four
   figures computed here from published numbers (derived, with the
   arithmetic printed next to each), and prose.

   The arithmetic, in full, so the next person can check it rather than
   trust it. a = 6371 + 525 = 6896 km; mu = 398600 km^3/s^2.

     period        T = 2*pi*sqrt(a^3/mu)
                     = 2*pi*sqrt(3.2794e11 / 398600) = 5699 s = 95.0 min
                     -> 86400/5699 = 15.2 orbits a day
     speed         v = sqrt(mu/a) = sqrt(57.80) = 7.60 km/s
     ground track  v * Re/a = 7.60 * 6371/6896 = 7.02 km/s
                     -> an 80 km frame is crossed in 80/7.02 = 11.4 s
     inclination   sun-synchrony needs the node to precess 360/365.24 =
                     0.9856 deg/day. With J2 = 1.08263e-3,
                     d(omega)/dt = -1.5*n*J2*(Re/a)^2*cos i, and
                     n = 2*pi/5699 = 1.1024e-3 rad/s, that is
                     cos i = -0.130, i = 97.5 deg.
                     The rideshare's PUBLISHED inclination is 97.6 deg.

   That last one is the reason the block exists in this shape. It is not
   decoration: it is a derived number landing on a published number to
   within a tenth of a degree, which is how you show a reader that the
   orbit figures on this page hang together rather than asking them to
   take it on faith.

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
      en: 'Everything on this platform begins as a frame from a box about the size of two milk cartons stacked. What that box can see is not a matter of opinion. It follows from its orbit, its lens and its three colours. This is the machine, and the line where its measurements stop.',
      ar: 'كل ما تقدّمه هذه المنصة يبدأ من صورة تلتقطها عُلبة بحجم عبوتَي حليب فوق بعضهما. وما تستطيع هذه العلبة رؤيته ليس مسألة رأي، بل نتيجة لمدارها وعدستها وألوانها الثلاثة. هذه هي المركبة، وهذا هو الحدّ الذي تتوقف عنده قياساتها.'
    },

    cap: {
      en: 'KuwaitSat-1. Photograph supplied by the project. The four whip antennas are coiled against the body inside the dispenser and spring out once the spacecraft is released; the dark blue faces are body-mounted solar cells, which are the only power it has.',
      ar: 'كويت سات-١. الصورة مقدَّمة من المشروع. تُلفّ الهوائيات الأربعة على جسم المركبة داخل القاذف ثم تنتشر بعد انفصالها؛ والأوجه الزرقاء الداكنة خلايا شمسية مثبَّتة على الجسم، وهي مصدر الطاقة الوحيد لها.'
    },

    blocks: [
      { t: { en: 'The orbit is the clock',
             ar: 'المدار هو الساعة' },
        p: { en: 'Transporter-6 released its rideshare into a sun-synchronous orbit near 525 km, inclined 97.6°. Sun-synchronous is not a detail. At that inclination the orbit plane turns just under a degree a day, which is the rate Earth moves around the Sun, so the spacecraft crosses any given latitude at the same local solar time on every pass. Two frames of the same ground months apart therefore carry the same sun angle and the same shadows, and a difference between them is a difference on the ground rather than a difference in the light. Change detection is only honest because of this.',
             ar: 'أطلقت مهمة Transporter-6 حمولاتها في مدار متزامن مع الشمس على ارتفاع يقارب ٥٢٥ كم وبميل ٩٧٫٦ درجة. والتزامن الشمسي ليس تفصيلاً ثانوياً: فعند هذا الميل يدور مستوى المدار نحو درجة واحدة يومياً، وهو المعدّل نفسه الذي تدور به الأرض حول الشمس، فتعبر المركبة أي خط عرض في التوقيت الشمسي المحلي نفسه في كل مرور. ولهذا تحمل صورتان للأرض نفسها تفصل بينهما أشهر زاوية الشمس نفسها وأطوال الظلال نفسها، فيكون الاختلاف بينهما اختلافاً على الأرض لا في الإضاءة. وعلى هذا وحده يقوم رصد التغيّر.' } },

      { t: { en: 'What 39 metres a pixel buys',
             ar: 'ما الذي تشتريه ٣٩ متراً لكل بكسل' },
        p: { en: 'One pixel covers 39 m of ground: about 1,520 m², a fifth of a football pitch. A road, a car and a single tree are all smaller than that and are simply not in the picture. A farm, a landfill cell, a new district, a dust plume, a stretch of ground that has greened or been stripped are all far larger than that, and are. Eighty kilometres of swath at 39 m makes a frame roughly 2,050 pixels across: the sensor of a modest phone, pointed at a country.',
             ar: 'تغطّي البكسل الواحدة ٣٩ متراً على الأرض، أي نحو ١٥٢٠ متراً مربعاً، خُمس ملعب كرة قدم. فالطريق والسيارة والشجرة المفردة أصغر من ذلك، ولا وجود لها في الصورة. أما المزرعة وخلية الردم والحي الجديد وعمود الغبار والرقعة التي اخضرّت أو جُرّدت فكلها أكبر من ذلك بكثير، ولها وجود. وعرض مسح يبلغ ثمانين كيلومتراً بدقة ٣٩ متراً يعطي إطاراً بعرض ٢٠٥٠ بكسل تقريباً: مستشعر هاتف متواضع، موجَّه نحو بلد.' } },

      { t: { en: 'Three colours, and where measurement stops',
             ar: 'ثلاثة ألوان، وأين يتوقف القياس' },
        p: { en: 'The payload is a colour camera: red, green and blue, all of it inside the visible band. Chlorophyll’s strongest signature is not in the visible band. It is the jump in reflectance just past red, in the near infrared, so NDVI, the index most people mean when they say "vegetation index", cannot be computed from this spacecraft at all. What visible light does separate is built surface from bare sand from growing cover, and a visible-band greenness index such as 2G − R − B is computable from every frame here. Anything on this platform that goes further than that is modelled, and is labelled as modelled.',
             ar: 'الحمولة كاميرا ملوّنة: أحمر وأخضر وأزرق، وكلها داخل النطاق المرئي. أما البصمة الأقوى للكلوروفيل فليست في النطاق المرئي، بل في القفزة الانعكاسية خلف الأحمر مباشرة، في الأشعة تحت الحمراء القريبة؛ ولذلك فإن مؤشر NDVI، وهو ما يقصده أكثر الناس بعبارة «مؤشر الغطاء النباتي»، لا يمكن حسابه من هذه المركبة إطلاقاً. والذي يفصله الضوء المرئي فعلاً هو السطح المبني عن الرمل العاري عن الغطاء النامي، ويمكن من كل إطار هنا حساب مؤشر خُضرة مرئي مثل 2G − R − B. وكل ما يتجاوز ذلك في هذه المنصة فهو محسوب بنموذج، ومعلَّم بوصفه كذلك.' } },

      { t: { en: 'The link is the bottleneck, not the lens',
             ar: 'الاختناق في الوصلة لا في العدسة' },
        p: { en: 'An 80 km frame at 39 m is roughly 12 MB before compression. The spacecraft talks to one ground station, at Kuwait University: UHF for telemetry, tracking and command, S-band for the pictures. It comes over the horizon about fifteen times a day, only a handful of those passes climb high enough to be worth a downlink, and each of those lasts minutes. That is why a 2U mission returns selected frames rather than a stream, and why deciding what to keep is an engineering problem in its own right.',
             ar: 'يبلغ حجم إطار عرضه ثمانون كيلومتراً بدقة ٣٩ متراً نحو ١٢ ميغابايت قبل الضغط. وتتحدث المركبة مع محطة أرضية واحدة في جامعة الكويت: نطاق UHF للقياس عن بُعد والتتبع والتحكم، ونطاق S لإنزال الصور. وهي تعبر الأفق نحو خمس عشرة مرة في اليوم، ولا يرتفع منها إلا عدد قليل بما يكفي ليستحق إنزالاً، ويستمر كل مرور من هذه دقائق معدودة. ولهذا تعيد مهمة بحجم وحدتين إطارات مختارة لا تدفقاً متصلاً، ولهذا كان اختيار ما يُحفَظ مسألة هندسية قائمة بذاتها.' } }
    ],

    derH:  { en: 'Worked out here, from the published figures',
             ar: 'محسوبة هنا من الأرقام المنشورة' },
    derB:  { en: '⬡ Derived', ar: '⬡ مشتقّة' },
    derN:  { en: 'Not one of these four came off the spacecraft. Each is arithmetic on a published number and the arithmetic is printed beside it, so you can check it rather than take it. μ = 398,600 km³/s²; Earth’s mean radius is taken as 6,371 km.',
             ar: 'لم يأتِ أيٌّ من هذه الأربعة من المركبة. كلٌّ منها حسابٌ على رقم منشور، والحساب مطبوع بجانبه لتتحقق منه بدل أن تأخذه تسليماً. μ = ٣٩٨٬٦٠٠ كم³/ث²، ونصف قطر الأرض المتوسط مأخوذ ٦٣٧١ كم.' },

    figs: [
      { v: '95.0 min',  va: '٩٥٫٠ دقيقة',
        l: { en: 'One orbit',            ar: 'دورة واحدة' },
        w: { en: 'T = 2π√(a³/μ), a = 6 371 + 525 km  →  15.2 orbits a day',
             ar: 'T = 2π√(a³/μ)، حيث a = ٦٣٧١ + ٥٢٥ كم  ←  ١٥٫٢ دورة يومياً' } },
      { v: '7.60 km/s', va: '٧٫٦٠ كم/ث',
        l: { en: 'Orbital speed',        ar: 'السرعة المدارية' },
        w: { en: 'v = √(μ/a)',
             ar: 'v = √(μ/a)' } },
      { v: '7.02 km/s', va: '٧٫٠٢ كم/ث',
        l: { en: 'Ground track speed',   ar: 'سرعة المسار الأرضي' },
        w: { en: 'v × Rₑ/a  →  an 80 km frame is crossed in 11 s',
             ar: 'v × Rₑ/a  ←  يُقطع إطار بعرض ٨٠ كم في ١١ ثانية' } },
      { v: '97.5°',     va: '٩٧٫٥°',
        l: { en: 'Inclination sun-synchrony needs', ar: 'الميل الذي يقتضيه التزامن الشمسي' },
        w: { en: 'node must precess 0.9856°/day  ·  published: 97.6°',
             ar: 'يجب أن تتقدّم العقدة ٠٫٩٨٥٦° يومياً  ·  المنشور: ٩٧٫٦°' } }
    ],

    recH: { en: 'The published record',  ar: 'السجل المنشور' },
    recB: { en: '🛰 Measured',           ar: '🛰 مقيس' },
    recN: { en: 'Twelve entries, each one attributable. The numbered marks are the sources at the foot of this page.',
            ar: 'اثنتا عشرة مدخلة، كلٌّ منها قابلة للإسناد. والأرقام بين قوسين هي المصادر في أسفل الصفحة.' },

    pathH: { en: 'From the frame to the finding', ar: 'من الإطار إلى النتيجة' },
    /* NO COUNT IN THIS LINE, DELIBERATELY. The steps are read out of
       #conceptFlow, which had four when this was written and has six
       now. A sentence that says "four" is a sentence that goes wrong
       the next time somebody adds a step, and this page's whole habit
       is that a number on screen is true. */
    pathN: { en: 'The steps the platform runs, in the order it runs them. Nothing downstream of step one is a measurement.',
             ar: 'الخطوات التي تنفّذها المنصة، بالترتيب الذي تنفّذها به. وما بعد الخطوة الأولى ليس قياساً.' },

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

    /* ---- four figures, each with its arithmetic -------------------- */
    var der = el('div', 'kss-part');
    der.id = 'ksat-spacecraft-derived';
    der.appendChild(head(COPY.derH, COPY.derN, COPY.derB, 'proj'));
    var figs = el('ul', 'kss-figs');
    COPY.figs.forEach(function (f) {
      var li = el('li', 'kss-fig');
      li.appendChild(el('span', 'kss-fig__v', lang() === 'ar' ? f.va : f.v));
      li.appendChild(el('span', 'kss-fig__l', L(f.l)));
      li.appendChild(el('span', 'kss-fig__w', L(f.w)));
      figs.appendChild(li);
    });
    der.appendChild(figs);
    host.appendChild(der);

    /* ---- the twelve entries, unfolded ------------------------------ */
    var rec = el('div', 'kss-part');
    rec.id = 'ksat-spacecraft-record';
    rec.appendChild(head(COPY.recH, COPY.recN, COPY.recB, 'real'));
    var dl = el('dl', 'kss-dl');
    recs.forEach(function (r) {
      /* dt and dd wrapped in a div. That is valid inside a <dl> in
         HTML5, and it is the only way to make one ENTRY a grid item:
         loose dt/dd children flow into separate tracks, so the twelve
         labels ended up in one column and the twelve values in another,
         with the rule under each label stopping halfway across. */
      var e = el('div', 'kss-e');
      e.appendChild(el('dt', 'kss-dt', r.k));
      e.appendChild(el('dd', 'kss-dd', r.v));
      dl.appendChild(e);
    });
    rec.appendChild(dl);
    host.appendChild(rec);

    /* ---- the chain, laid along the page rather than down it -------- */
    if (steps) {
      var path = el('div', 'kss-part');
      path.id = 'ksat-spacecraft-path';
      path.appendChild(head(COPY.pathH, COPY.pathN, null, null));
      var ol = el('ol', 'kss-steps');
      /* css/ksat-spacecraft.css picks a track count off this. The page
         owns how many steps there are; this file only reports it. */
      ol.setAttribute('data-count', String(steps.length));
      steps.forEach(function (s, i) {
        var li = el('li', 'kss-step');
        li.appendChild(el('span', 'kss-step__n', String(i + 1).padStart(2, '0')));
        li.appendChild(el('span', 'kss-step__t', s.n));
        if (s.d) { li.appendChild(el('span', 'kss-step__d', s.d)); }
        ol.appendChild(li);
      });
      path.appendChild(ol);
      host.appendChild(path);
    }

    return true;
  }

  /* ===================================================================
     5 · THE FOUR CARDS ABOVE THIS BLOCK NOW POINT INTO IT

     js/ksat-home.js builds a row of four picture cards at the top of
     #mission. Three of them open the blocks this file has just replaced:
     card 1 opens the folded table, card 2 reveals the concept chain,
     card 3 reveals the ground segment panel. On the public tier those
     three panels are folded away by css/ksat-spacecraft.css, so those
     three cards would scroll a reader to something they cannot see —
     which is worse than the layout they complained about.

     The handlers belong to that file and cannot be removed from here,
     so this intercepts the click on the way DOWN, on the section. A
     listener in the capture phase on an ancestor runs before the
     target's own listeners, and stopPropagation() there means the
     target's listener never runs at all.

     Bound to #mission rather than to the buttons ON PURPOSE:
     js/ksat-home.js rebuilds that whole row on every language change,
     which would take any per-button binding with it. The section
     survives.
     =================================================================== */
  var CARD_TO = [
    'ksat-spacecraft-record',    /* Mission record   */
    'ksat-spacecraft-path',      /* Concept chain    */
    'ksat-spacecraft-derived'    /* Ground segment   */
    /* the fourth card goes to #imagery and is left alone */
  ];

  function publicTier() {
    return root.getAttribute('data-ksat-tier') === 'public';
  }

  function wireCards() {
    var sec = document.getElementById('mission');
    if (!sec || sec.dataset.kssCards === 'on') { return; }
    sec.dataset.kssCards = 'on';

    sec.addEventListener('click', function (e) {
      if (!publicTier() || !host) { return; }
      var card = e.target && e.target.closest && e.target.closest('.ksh-card');
      if (!card) { return; }
      var row = card.parentNode;
      if (!row || !row.classList.contains('ksh-cards')) { return; }

      var i = Array.prototype.indexOf.call(row.children, card);
      var id = CARD_TO[i];
      if (!id) { return; }                 /* card 4, or a row we do not know */
      var target = document.getElementById(id);
      if (!target) { return; }

      e.stopPropagation();
      e.preventDefault();
      try {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (err) {
        target.scrollIntoView();
      }
      /* Focus follows the scroll or a keyboard reader is left behind at
         the card. -1 rather than 0: this is a landing place, not a stop
         on the tab order. */
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    }, true);
  }

  /* ===================================================================
     6 · BOOT

     index.html fills #specTable from its own script, which runs after
     this one. So this polls — briefly, and then stops. It does NOT use
     a MutationObserver on the table: the table is built once and an
     observer left watching it for the life of the page is a cost with
     no second event to justify it.
     =================================================================== */
  function boot() {
    wireCards();
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
