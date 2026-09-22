/* =====================================================================
   ksat-cubesat.js — the CubeSat model in the descent strip
   Companion to css/ksat-cubesat.css.

   ---------------------------------------------------------------------
   WHERE THIS CAME FROM
   ---------------------------------------------------------------------
   This is a port, not a rewrite. The renderer is the one already built
   in _preview/cubesat.html: a hand-rolled 3D engine on a 2D canvas with
   no library anywhere in it. Real geometry in millimetres, quads with
   per-face painter functions that draw solar cells and busbars and
   silkscreen in the face's own uv space, back-face culling, a painter's
   algorithm depth sort, per-face shading against a camera-space light,
   and antenna polylines depth-sorted segment by segment so the body
   occludes the parts of a whip that pass behind it.

   Its comments came across with it. Where a line says why it is the way
   it is, that reason was earned by somebody hitting the bug it fixes,
   and deleting the sentence would mean hitting it again.

   ---------------------------------------------------------------------
   THE ONE THING THE PORT CHANGED ON PURPOSE: 3U BECAME 2U
   ---------------------------------------------------------------------
   The preview models a 3U bus — 100 x 100 x 340.5 mm, three solar cells
   per face. KuwaitSat-1 is not that. The page's own fact table says so
   two screens above this strip:

       Platform    2U CubeSat · 2 kg          index.html, .fact block
       "Kuwait's first national satellite is a 2U CubeSat built by a
        Kuwait University team."               index.html, [data-i18n="mis.lede"]

   Mounting a 3U here and letting the page imply it is Kuwait's
   satellite would be exactly the kind of quiet misstatement this site
   exists to prevent. It would also contradict a published figure
   printed on the same page, which is worse than being wrong somewhere
   nobody can check.

   So the geometry moved to 2U. In CubeSat standard terms 1U is 113.5 mm
   of height, so 3U = 340.5 and 2U = 227.0. H is the only number that had
   to change by hand; the rails, the ribs, the panel bands, the deck and
   the bottom plate are all written in terms of H and hy and followed it.
   The cells per face went from three to two, because two 2U-proportioned
   cells is what a 2U face holds — three would have squashed them into a
   shape no cell is made in.

   WHAT IS STILL MODELLED, AND IS LABELLED AS SUCH. The 2U form factor
   is published. The surface is not: nobody has published a drawing of
   KuwaitSat-1's panel layout, its cell count, its deck components or its
   antenna lengths, and this file does not pretend otherwise. The model
   therefore carries the page's own provenance badge — "◈ Modelled", the
   same mark and the same wording the rest of the site uses — and a
   caption that names precisely which part is from the record and which
   part is drawn. See STRINGS below; the caption is not decorative and
   should not be shortened into a slogan.

   The one detail deliberately copied from the photograph the team
   attached: four deployed whip antennas off the top deck, splayed in
   pairs. Their length here is 165 mm, which is a quarter wave in the
   70 cm amateur band and a plausible figure for a 2U — plausible, not
   published, which is what the caption says.

   ---------------------------------------------------------------------
   WHERE IT MOUNTS, AND WHY NOTHING IN index.html CHANGED
   ---------------------------------------------------------------------
   #descent is the transition strip between the orbit console and the
   team section. index.html owns it and is being edited by hand, so this
   file touches none of its markup. It appends one <figure> inside
   #descent, stamps data-ksat-cubesat="on" onto the strip, and lets
   css/ksat-cubesat.css hide the old #cvDescent from there.

   #cvDescent is NOT removed. It stays in the DOM. Delete these two
   files and the old downlink cone comes back with no edit anywhere.

   ---------------------------------------------------------------------
   PERFORMANCE, BECAUSE THIS PAGE CANNOT AFFORD ANOTHER LOOP
   ---------------------------------------------------------------------
   index.html already runs a hero orbit animation and carries 27
   canvases. A second rAF loop painting ~150 shaded quads with per-face
   detail painters is not free, so it is gated three ways:

     · IntersectionObserver. The loop does not exist while the strip is
       off screen, which is nearly all of the time on a page this long.
     · document.hidden. A backgrounded tab freezes document.timeline
       anyway, but rAF in some browsers still fires at a trickle and
       there is no reason to burn it.
     · devicePixelRatio capped at 1.5. At 2.0 on a retina panel this
       strip is ~2800 x 800 device pixels of gradient fills and hairline
       strokes for a decorative transition. 1.5 is the point where the
       cell fingers still read and the fill rate stops mattering.

   Measured frame times are kept in KSAT.cubesat.stats() so the next
   person does not have to take this paragraph on trust.

   ---------------------------------------------------------------------
   MOTION IS OPTIONAL
   ---------------------------------------------------------------------
   Under prefers-reduced-motion: reduce there is no auto-rotation and no
   rAF loop at all. The model is drawn once, in a three-quarter view, and
   redrawn only when the reader drags it or presses an arrow key. Drag
   and keyboard both still work — reduced motion means the page does not
   move on its own, not that the reader may not move it.

   The reviewer's machine reports reduce. If this looks frozen, that is
   why, and KSAT.cubesat.stats().reducedMotion says so out loud.
   ===================================================================== */

(function () {
  'use strict';

  var KS = window.KSAT = window.KSAT || {};
  if (KS.cubesat) { return; }          /* refuse to install twice */

  /* =================================================================
     0 · ENVIRONMENT
     ================================================================= */

  function reduced() {
    try { return matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (e) { return false; }
  }

  /* The stylesheet. index.html is owned by somebody else and is being
     edited right now, so this file cannot add a <link> to its head by
     editing the file — it adds one at runtime instead, and only if the
     page has not already got one. When the <link> does eventually get
     written into index.html by hand, this becomes a no-op rather than a
     duplicate: the loop below looks for the href, not for our marker.

     CSP note: vercel.json allows style-src 'self', so a same-origin
     stylesheet injected this way loads normally. Nothing external is
     fetched anywhere in this file. */
  function ensureStyles(done) {
    var links = document.querySelectorAll('link[rel="stylesheet"]');
    for (var i = 0; i < links.length; i++) {
      var h = links[i].getAttribute('href') || '';
      if (h.indexOf('ksat-cubesat.css') !== -1) { done(); return; }
    }
    var base = 'css/ksat-cubesat.css';
    try {
      /* Derive from our own src so the pair still works if the site is
         ever served from a subdirectory. */
      var me = document.currentScript && document.currentScript.src;
      if (me) { base = me.replace(/js\/ksat-cubesat\.js.*$/, 'css/ksat-cubesat.css'); }
    } catch (e) {}
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = base;
    l.setAttribute('data-ksat-cubesat-css', 'injected');
    l.onload = done;
    l.onerror = done;                  /* mount anyway; unstyled beats absent */
    document.head.appendChild(l);
  }

  /* =================================================================
     1 · STRINGS

     Kept here rather than in js/ksat-i18n.js because that file owns the
     page's dictionary and this file owns its own words. Both languages
     for every user-visible string, which on this page is a requirement
     and not a courtesy: the Arabic side renders dir="rtl" lang="ar" for
     real, not as a token gesture.

     The badge text matches the BADGES table in js/ksat-i18n.js exactly,
     mark and all, so this model reads under the same label as every
     other modelled figure on the site. The class is NOT .badge — see the
     note in css/ksat-cubesat.css for why reusing it would poison that
     file's English cache.

     THE CAPTION IS THE POINT. It is the sentence that separates what is
     published from what is drawn. Shorten it and the picture starts
     making a claim the mission never made.
     ================================================================= */

  var STR = {
    en: {
      badge: '◈ Modelled',
      cap: '2U form factor from the published mission record. Surface detail, ' +
           'panel layout, deck components and antenna geometry are modelled for ' +
           'this illustration — not taken from a published drawing.',
      hint: 'Drag, or use the arrow keys, to turn',
      alt: 'Illustration of a 2U CubeSat, the form factor published for ' +
           'KuwaitSat-1: a black anodised aluminium frame roughly 100 by 100 by ' +
           '227 millimetres, with corner rails, four deep blue solar panel faces ' +
           'of two cells each, a populated green circuit board on the top deck, ' +
           'and four whip antennas deployed from that deck. The model turns ' +
           'slowly and can be rotated by dragging it or with the arrow keys. ' +
           'The surface detail and the antennas are modelled, not taken from a ' +
           'published drawing of the spacecraft.'
    },
    ar: {
      badge: '◈ مُنمذَج',
      cap: 'شكل الهيكل 2U مأخوذ من سجل المهمة المنشور. أما تفاصيل السطح وتوزيع ' +
           'الألواح ومكوّنات السطح العلوي وهندسة الهوائيات فهي مُنمذَجة لأغراض هذا ' +
           'الرسم التوضيحي — وليست مأخوذة من مخطط منشور.',
      hint: 'اسحب، أو استخدم مفاتيح الأسهم، للتدوير',
      alt: 'رسم توضيحي لقمر مكعّب من فئة 2U، وهو الشكل المنشور لـ KuwaitSat-1: ' +
           'هيكل ألمنيوم أسود مؤكسد بأبعاد تقارب ١٠٠ × ١٠٠ × ٢٢٧ مليمتراً، ' +
           'بقضبان زاويّة، وأربعة أوجه من الألواح الشمسية الزرقاء الداكنة تحمل ' +
           'خليّتين لكل وجه، ولوحة إلكترونية خضراء على السطح العلوي، وأربعة ' +
           'هوائيات سلكية منشورة منه. يدور النموذج ببطء ويمكن تدويره بالسحب أو ' +
           'بمفاتيح الأسهم. تفاصيل السطح والهوائيات مُنمذَجة وليست مأخوذة من ' +
           'مخطط منشور للمركبة.'
    }
  };

  function lang() {
    var r = document.documentElement;
    var c = r.getAttribute('data-ksat-lang') || r.lang || 'en';
    return c.toLowerCase().indexOf('ar') === 0 ? 'ar' : 'en';
  }

  /* =================================================================
     2 · VEC3  — ported unchanged
     ================================================================= */

  var sub3   = function (a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; };
  var add3   = function (a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; };
  var mul3   = function (a, k) { return [a[0] * k, a[1] * k, a[2] * k]; };
  var dot3   = function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; };
  var cross3 = function (a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  };
  function unit3(v) { var l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  var lerp3 = function (a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  };

  /* ---------------------- colour helpers -------------------------- */
  function hex2rgb(h) {
    h = h.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function shade(hex, k, spec) {
    var c = hex2rgb(hex);
    var r = Math.min(255, c[0] * k + (spec || 0) * 255);
    var g = Math.min(255, c[1] * k + (spec || 0) * 255);
    var b = Math.min(255, c[2] * k + (spec || 0) * 255);
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  }

  /* ================= THE SATELLITE MODEL ==========================
     Millimetres, origin at the geometric centre. +y is up (the deck
     the antennas sit on), +z is the face that starts toward camera.  */

  var U    = 100;            /* 1U cross-section                       */
  var H    = 227.0;          /* 2U height — see the header. 2 x 113.5. */
  var RAIL = 8.5;            /* CubeSat standard rail width            */
  var hx = U / 2, hz = U / 2, hy = H / 2;

  var MAT = {
    rail  : '#14161B',        /* black anodised aluminium              */
    railLt: '#2E333C',        /* rail edge catching light              */
    sub   : '#0A0D16',        /* solar panel substrate (PCB under cells)*/
    cell  : '#2C3F7D',        /* triple-junction cell, deep blue-violet*/
    cellHi: '#5266BD',
    pcb   : '#123524',        /* top deck solder mask                  */
    plate : '#0C0E13',        /* bottom plate                          */
    gold  : '#B9973F',
    kapton: '#C9A227',
    silk  : '#D8E2EE'
  };

  var faces = [];            /* {p:[4 pts], n:[3], mat, paint, glossy} */
  var rods  = [];            /* antenna polylines                      */

  /* Push a quad. `out` is a hint for which way is outward, so winding
     never has to be guessed. Points are given as [TL,TR,BR,BL] in the
     face's own uv frame: u runs TL->TR, v runs TL->BL.                */
  function quad(p, out, mat, opt) {
    var n = unit3(cross3(sub3(p[1], p[0]), sub3(p[3], p[0])));
    if (dot3(n, out) < 0) { n = mul3(n, -1); }
    var f = { p: p, n: n, mat: mat };
    if (opt) { for (var k in opt) { if (Object.prototype.hasOwnProperty.call(opt, k)) { f[k] = opt[k]; } } }
    faces.push(f);
  }

  /* An axis-aligned box, six plain quads. Used for the rails and ribs. */
  function box(x0, x1, y0, y1, z0, z1, mat, opt) {
    var A = [x0, y1, z1], B = [x1, y1, z1], C = [x1, y0, z1], D = [x0, y0, z1];   /* +z */
    var E = [x1, y1, z0], F = [x0, y1, z0], G = [x0, y0, z0], K = [x1, y0, z0];   /* -z */
    quad([A, B, C, D], [0, 0, 1], mat, opt);
    quad([E, F, G, K], [0, 0, -1], mat, opt);
    quad([B, E, K, C], [1, 0, 0], mat, opt);
    quad([F, A, D, G], [-1, 0, 0], mat, opt);
    quad([F, E, B, A], [0, 1, 0], mat, opt);
    quad([D, C, K, G], [0, -1, 0], mat, opt);
  }

  /* ---- the four corner rails, standing slightly proud of the panels */
  var RO = hx, RI = hx - RAIL;
  box( RI,  RO, -hy, hy,  RI,  RO, MAT.rail);
  box(-RO, -RI, -hy, hy,  RI,  RO, MAT.rail);
  box( RI,  RO, -hy, hy, -RO, -RI, MAT.rail);
  box(-RO, -RI, -hy, hy, -RO, -RI, MAT.rail);

  /* ---- transverse ribs at each U boundary, tying the rails together.
     The 3U preview had four rows here (two ends plus two internal U
     boundaries). A 2U has one internal boundary, not two, so this is a
     three-row list: bottom, the single mid-height joint, top. Putting
     three rows on a 2U would read as a 3U that had been squashed. */
  [-hy + 2, -3, hy - 8].forEach(function (y) {
    box(-RO, RO, y, y + 6, -RO, -RI + 1.5, MAT.rail);
    box(-RO, RO, y, y + 6,  RI - 1.5, RO,  MAT.rail);
    box(-RO, -RI + 1.5, y, y + 6, -RO, RO, MAT.rail);
    box( RI - 1.5, RO, y, y + 6, -RO, RO, MAT.rail);
  });

  /* ---- four little standoff feet under the bottom deck ------------ */
  [[RI + 2, RI + 2], [-RO + 2, RI + 2], [RI + 2, -RO + 2], [-RO + 2, -RO + 2]]
    .forEach(function (p) {
      var x = p[0], z = p[1];
      box(x - 1, x + 4, -hy - 5, -hy, z - 1, z + 4, '#1A1D24');
    });

  /* ================= SOLAR PANEL FACE PAINTER ======================
     Drawn in uv space: u across the panel, v down it. Two cells per
     2U face, each with fingers and two busbars, plus the silkscreen
     interconnect marks and kapton tabs between them.

     The 3U preview carried three bands here. The bands below are the
     same construction — a cell body, a gap, a cell body — re-measured
     for two, so each cell keeps roughly the proportion a real
     triple-junction cell has rather than being stretched to fill.    */
  var CELLS = [[0.055, 0.475], [0.525, 0.945]];

  function paintPanel(g, uv, k, spec) {
    var cellCol = shade(MAT.cell, k * 1.18, spec * 0.55);
    var cellTop = shade(MAT.cellHi, k * 1.30, spec * 0.95);

    CELLS.forEach(function (band, ci) {
      var v0 = band[0], v1 = band[1], u0 = 0.075, u1 = 0.925;

      /* the cell body, as a real projected quad */
      g.beginPath();
      g.moveTo.apply(g, uv(u0, v0)); g.lineTo.apply(g, uv(u1, v0));
      g.lineTo.apply(g, uv(u1, v1)); g.lineTo.apply(g, uv(u0, v1));
      g.closePath();

      /* a gradient down the cell gives the glassy cover-glass sheen */
      var a = uv(u0, v0), b = uv(u1, v1);
      var grd = g.createLinearGradient(a[0], a[1], b[0], b[1]);
      grd.addColorStop(0, cellTop);
      grd.addColorStop(0.45, cellCol);
      grd.addColorStop(1, shade(MAT.cell, k * 0.72, spec * 0.25));
      g.fillStyle = grd; g.fill();

      /* fingers — fine current-collecting lines across the cell */
      g.strokeStyle = 'rgba(150,180,235,' + (0.07 + spec * 0.18).toFixed(3) + ')';
      g.lineWidth = 0.55;
      for (var i = 1; i < 14; i++) {
        var u = u0 + (u1 - u0) * (i / 14);
        g.beginPath();
        g.moveTo.apply(g, uv(u, v0 + 0.004));
        g.lineTo.apply(g, uv(u, v1 - 0.004));
        g.stroke();
      }
      /* two busbars running the other way */
      g.strokeStyle = 'rgba(190,210,245,' + (0.22 + spec * 0.3).toFixed(3) + ')';
      g.lineWidth = 1.1;
      [0.34, 0.66].forEach(function (f) {
        var v = v0 + (v1 - v0) * f;
        g.beginPath();
        g.moveTo.apply(g, uv(u0 + 0.01, v));
        g.lineTo.apply(g, uv(u1 - 0.01, v));
        g.stroke();
      });
      /* cell outline */
      g.strokeStyle = 'rgba(8,12,22,.85)'; g.lineWidth = 1;
      g.beginPath();
      g.moveTo.apply(g, uv(u0, v0)); g.lineTo.apply(g, uv(u1, v0));
      g.lineTo.apply(g, uv(u1, v1)); g.lineTo.apply(g, uv(u0, v1));
      g.closePath(); g.stroke();

      /* silkscreen bracket marks in the gap below each cell.
         The preview hard-coded `ci < 2` because it knew it had three
         bands. Written against CELLS.length so the 2U change could not
         leave a bracket row floating under the last cell with nothing
         below it — which is what happened on the first attempt. */
      if (ci < CELLS.length - 1) {
        var vg = v1 + 0.017;
        g.strokeStyle = 'rgba(216,226,238,.62)'; g.lineWidth = 1;
        [0.20, 0.50, 0.80].forEach(function (u) {
          g.beginPath();
          g.moveTo.apply(g, uv(u - 0.045, vg - 0.006));
          g.lineTo.apply(g, uv(u - 0.045, vg + 0.006));
          g.lineTo.apply(g, uv(u + 0.045, vg + 0.006));
          g.lineTo.apply(g, uv(u + 0.045, vg - 0.006));
          g.stroke();
        });
        /* kapton tabs either side */
        g.fillStyle = 'rgba(201,162,39,.78)';
        [[0.075, 0.13], [0.87, 0.925]].forEach(function (t) {
          var ua = t[0], ub = t[1];
          g.beginPath();
          g.moveTo.apply(g, uv(ua, vg - 0.005)); g.lineTo.apply(g, uv(ub, vg - 0.005));
          g.lineTo.apply(g, uv(ub, vg + 0.005)); g.lineTo.apply(g, uv(ua, vg + 0.005));
          g.closePath(); g.fill();
        });
      }
    });

    /* the interconnect squiggle the real panels carry, mid-face */
    g.strokeStyle = 'rgba(216,226,238,.5)'; g.lineWidth = 1.1;
    g.beginPath();
    var path = [[0.30, 0.50], [0.38, 0.487], [0.45, 0.513], [0.55, 0.487], [0.62, 0.513], [0.70, 0.50]];
    path.forEach(function (pt, i) {
      var s = uv(pt[0], pt[1]);
      if (i) { g.lineTo(s[0], s[1]); } else { g.moveTo(s[0], s[1]); }
    });
    g.stroke();
  }

  /* ---- the four solar faces, inset between the rails -------------- */
  var PZ = hz + 1.6, PX = hx + 1.6, PE = RI - 0.5, PY = hy - 8;
  /* +z */ quad([[-PE, PY, PZ], [PE, PY, PZ], [PE, -PY, PZ], [-PE, -PY, PZ]],
                [0, 0, 1], MAT.sub, { paint: paintPanel, glossy: 1 });
  /* -z */ quad([[PE, PY, -PZ], [-PE, PY, -PZ], [-PE, -PY, -PZ], [PE, -PY, -PZ]],
                [0, 0, -1], MAT.sub, { paint: paintPanel, glossy: 1 });
  /* +x */ quad([[PX, PY, PE], [PX, PY, -PE], [PX, -PY, -PE], [PX, -PY, PE]],
                [1, 0, 0], MAT.sub, { paint: paintPanel, glossy: 1 });
  /* -x */ quad([[-PX, PY, -PE], [-PX, PY, PE], [-PX, -PY, PE], [-PX, -PY, -PE]],
                [-1, 0, 0], MAT.sub, { paint: paintPanel, glossy: 1 });

  /* ==================== TOP DECK PAINTER ===========================
     The populated face: solder mask, a processor, an RF can, the
     antenna release board, a connector and some gold pads.           */
  function paintDeck(g, uv, k, spec) {
    var rect = function (u0, v0, u1, v1, fill, stroke) {
      g.beginPath();
      g.moveTo.apply(g, uv(u0, v0)); g.lineTo.apply(g, uv(u1, v0));
      g.lineTo.apply(g, uv(u1, v1)); g.lineTo.apply(g, uv(u0, v1));
      g.closePath();
      if (fill)   { g.fillStyle = fill; g.fill(); }
      if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1; g.stroke(); }
    };

    /* a darker solar strip across one half of the deck */
    rect(0.06, 0.06, 0.94, 0.42, shade(MAT.cell, k, spec * 0.7), 'rgba(8,12,22,.7)');
    g.strokeStyle = 'rgba(150,180,235,' + (0.12 + spec * 0.2).toFixed(3) + ')';
    g.lineWidth = 0.6;
    for (var i = 1; i < 12; i++) {
      var u = 0.06 + 0.88 * (i / 12);
      g.beginPath(); g.moveTo.apply(g, uv(u, 0.065)); g.lineTo.apply(g, uv(u, 0.415)); g.stroke();
    }

    /* green board area */
    rect(0.06, 0.46, 0.94, 0.94, shade(MAT.pcb, k * 1.05, spec * 0.25), 'rgba(10,20,14,.8)');

    /* processor + RF can */
    rect(0.13, 0.54, 0.36, 0.72, shade('#0B0D11', k * 1.1, spec * 0.5), 'rgba(0,0,0,.6)');
    rect(0.42, 0.52, 0.60, 0.62, shade('#20262E', k * 1.1, spec * 0.6));
    /* connector, green with gold pins */
    rect(0.64, 0.52, 0.90, 0.60, shade('#1D6B39', k * 1.1, spec * 0.3), 'rgba(0,0,0,.5)');
    g.strokeStyle = shade(MAT.gold, k * 1.2, spec); g.lineWidth = 1;
    for (var j = 0; j < 10; j++) {
      var uu = 0.66 + 0.022 * j;
      g.beginPath(); g.moveTo.apply(g, uv(uu, 0.525)); g.lineTo.apply(g, uv(uu, 0.595)); g.stroke();
    }

    /* gold traces */
    g.strokeStyle = shade(MAT.gold, k, spec * 0.7); g.lineWidth = 1.2;
    [[0.14, 0.80], [0.14, 0.86]].forEach(function (t) {
      var u0 = t[0], v = t[1];
      g.beginPath(); g.moveTo.apply(g, uv(u0, v)); g.lineTo.apply(g, uv(0.58, v));
      g.lineTo.apply(g, uv(0.66, v - 0.05)); g.lineTo.apply(g, uv(0.88, v - 0.05)); g.stroke();
    });

    /* antenna release burn-wire pads at the four edge midpoints */
    g.fillStyle = shade(MAT.gold, k * 1.1, spec * 0.8);
    [[0.50, 0.49], [0.50, 0.92], [0.085, 0.70], [0.915, 0.70]].forEach(function (t) {
      g.beginPath(); g.arc.apply(g, uv(t[0], t[1]).concat([2.6, 0, 6.283])); g.fill();
    });

    /* silkscreen legend */
    g.strokeStyle = 'rgba(216,226,238,.5)'; g.lineWidth = 1;
    rect(0.63, 0.66, 0.90, 0.88, null, 'rgba(216,226,238,.35)');
  }
  quad([[-PE, hy + 0.8, -PE], [PE, hy + 0.8, -PE], [PE, hy + 0.8, PE], [-PE, hy + 0.8, PE]],
       [0, 1, 0], MAT.pcb, { paint: paintDeck, glossy: 0.55 });

  /* ---- bottom plate ---------------------------------------------- */
  quad([[-PE, -hy - 0.8, PE], [PE, -hy - 0.8, PE], [PE, -hy - 0.8, -PE], [-PE, -hy - 0.8, -PE]],
       [0, -1, 0], MAT.plate, {
         paint: function (g, uv) {
           g.strokeStyle = 'rgba(90,110,135,.35)'; g.lineWidth = 1;
           [0.3, 0.5, 0.7].forEach(function (v) {
             g.beginPath(); g.moveTo.apply(g, uv(0.12, v)); g.lineTo.apply(g, uv(0.88, v)); g.stroke();
           });
         }
       });

  /* ==================== DEPLOYED ANTENNAS ==========================
     Four tape-spring whips on the top deck, one per edge, splayed
     outward and tilted up.

     330 mm in the 3U preview; 165 mm here. Two reasons. Proportion: a
     330 mm whip on a 227 mm body is longer than the spacecraft and the
     strip fills with wire rather than satellite. Plausibility: 165 mm
     is about a quarter wave in the 70 cm band, which is the length a
     2U of this class usually carries. Neither number is published for
     KuwaitSat-1 and the caption says so.                             */
  var ANT_LEN = 165;
  [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d, i) {
    var dx = d[0], dz = d[1];
    var base = [dx * (hx - 14), hy + 6, dz * (hz - 14)];
    var pts = [];
    var N = 26;
    /* a slight yaw so the four do not sit on perfect axes, as in the
       photographed unit where the pairs splay apart                   */
    var yaw = (i < 2 ? 1 : -1) * 0.34;
    var cy = Math.cos(yaw), sy = Math.sin(yaw);
    var ax = dx * cy + dz * sy, az = -dx * sy + dz * cy;
    for (var s = 0; s <= N; s++) {
      var t = s / N;
      var r = ANT_LEN * t;
      /* A deployed tape spring is stiff and straight. Keeping y strictly
         linear in t makes the rod collinear in 3D, so it projects to a clean
         straight line; any curve term here reads as slack wire instead.     */
      var lift = 30 * t;               /* was 52 on the longer 3U whip */
      pts.push([base[0] + ax * r, base[1] + lift, base[2] + az * r]);
    }
    rods.push({ pts: pts, w0: 4.4, w1: 3.0, col: '#3A414D' });
    /* the little anodised root block the whip springs out of */
    box(base[0] - 5, base[0] + 5, hy + 1, hy + 7, base[2] - 5, base[2] + 5, '#191C22');
  });

  /* =================================================================
     3 · THE STAGE — the DOM this renderer needs, built here

     index.html gains no markup. Everything below is created at runtime
     and appended inside #descent.
     ================================================================= */

  var strip = null, fig = null, cv = null, g = null, capEl = null,
      badgeEl = null, hintEl = null;

  function buildStage(host) {
    fig = document.createElement('figure');
    fig.className = 'ksat-cs';
    /* role="img" with a text alternative, on the element that also takes
       focus, so there is exactly one node in the accessibility tree for
       this picture instead of a labelled group wrapping a labelled image.
       tabindex makes the rotation reachable without a pointer; the hint
       line is wired up with aria-describedby so the affordance is spoken
       and not merely drawn. */
    fig.setAttribute('role', 'img');
    fig.setAttribute('tabindex', '0');

    cv = document.createElement('canvas');
    cv.className = 'ksat-cs-cv';
    /* The bitmap itself is not a second thing to announce. */
    cv.setAttribute('aria-hidden', 'true');

    badgeEl = document.createElement('span');
    badgeEl.className = 'ksat-cs-badge';

    capEl = document.createElement('figcaption');
    capEl.className = 'ksat-cs-cap';

    hintEl = document.createElement('span');
    hintEl.className = 'ksat-cs-hint';
    hintEl.id = 'ksat-cs-hint';
    fig.setAttribute('aria-describedby', 'ksat-cs-hint');

    capEl.appendChild(document.createTextNode(''));
    fig.appendChild(cv);
    fig.appendChild(badgeEl);
    capEl.appendChild(hintEl);
    fig.appendChild(capEl);
    host.appendChild(fig);

    g = cv.getContext('2d');
    return !!g;
  }

  /* The text, in whichever language the page is in. Called on mount and
     again on ksat:lang — which js/ksat-i18n.js dispatches AFTER it has
     finished walking the DOM, so nothing here races its translation. */
  function paintText() {
    var t = STR[lang()];
    badgeEl.textContent = t.badge;
    capEl.firstChild.nodeValue = t.cap + ' ';
    hintEl.textContent = t.hint;
    fig.setAttribute('aria-label', t.alt);
  }

  /* ---------------------------------------------------------------
     THE aria-hidden HANDOVER, stated plainly because it changes what a
     screen reader is told.

     index.html marks #descent aria-hidden="true". That was right: the
     strip was a decorative downlink cone with three lines of type over
     it, and there was nothing in it a reader needed.

     It is no longer decorative. It now holds an illustration of the
     spacecraft and a caption saying which parts of that illustration
     are published and which are drawn, and a provenance note that no
     screen-reader user can reach is not a provenance note.

     So the attribute moves down one level: off #descent, onto
     #cvDescent, which css/ksat-cubesat.css has just hidden anyway. The
     .dtext lines are left exposed — they are hidden from the public
     tier by CSS and visible to a signed-in researcher, and in the tier
     where they are visible they should also be readable.

     If this turns out to be the wrong call, the fix is one line here,
     not an edit to index.html.
     --------------------------------------------------------------- */
  function handOverAria(host) {
    if (host.getAttribute('aria-hidden') !== 'true') { return; }
    host.removeAttribute('aria-hidden');
    var old = host.querySelector('#cvDescent');
    if (old) { old.setAttribute('aria-hidden', 'true'); }
  }

  /* =================================================================
     4 · RENDERER — ported, with the light turned round
     ================================================================= */

  var RM = reduced();

  /* ry/rx are the yaw/pitch pair; zoom scales the focal length.
     The starting attitude is the preview's "hero" three-quarter view,
     which is also the single static frame used under reduced motion. */
  var V = { ry: -0.62, rx: -0.30, zoom: 1.0, spin: !RM, ant: true };
  var W = 0, Hh = 0, CX = 0, CY = 0, FOC = 1;

  /* Light fixed in camera space, so turning the model sweeps the light
     across it — the behaviour you want when inspecting an object.

     THE ONE SHADING CHANGE FROM THE PREVIEW. The preview lit from the
     upper RIGHT. Everything else on this page is lit from the upper
     LEFT: index.html's hero globe uses lightDir=[-0.55,-0.4,0.73], and
     in canvas screen space a negative x puts the highlight left and a
     negative y puts it up. A satellite lit from the opposite side of a
     page whose Earth is lit from the other reads as a pasted-in asset.

     Shading is lam = max(0, -dot(n, LIGHT)), so a face is lit when its
     normal opposes LIGHT. Wanting the lit normals to point left-and-up
     means -LIGHT = [-0.62, +0.42, +0.60], hence the signs below. FILL
     is mirrored with it so the soft side stays opposite the key. */
  var LIGHT = unit3([ 0.62, -0.42, -0.60]);
  var FILL  = unit3([-0.70,  0.30, -0.34]);

  function rotPt(p) {
    var x = p[0], y = p[1], z = p[2];
    var cy = Math.cos(V.ry), sy = Math.sin(V.ry);
    var nx = x * cy + z * sy, nz = -x * sy + z * cy;
    var cx = Math.cos(V.rx), sx = Math.sin(V.rx);
    var ny = y * cx - nz * sx; nz = y * sx + nz * cx;
    return [nx, ny, nz];
  }
  function rotN(n) { return rotPt(n); }

  var CAM_D = 1150;
  function proj(p) {
    var z = p[2] + CAM_D;
    var k = FOC / Math.max(1, z);
    return [CX + p[0] * k, CY - p[1] * k];
  }
  function projZ(p) { return p[2] + CAM_D; }

  /* devicePixelRatio capped at 1.5 — see PERFORMANCE in the header.
     The preview capped at 2 because it was the only thing on its page. */
  var DPR_CAP = 1.5;

  function fitCanvas() {
    var dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    W  = fig.clientWidth  || strip.clientWidth  || 1;
    Hh = fig.clientHeight || strip.clientHeight || 1;
    cv.width  = Math.max(1, Math.round(W * dpr));
    cv.height = Math.max(1, Math.round(Hh * dpr));
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    CX = W / 2;
    CY = Hh * 0.52;
    /* The preview scaled focal length off min(W,Hh) because its stage
       was roughly square. This strip is not: it is the full viewport
       wide and 240-400px tall, so min() would be the height on a phone
       and the height on a desktop too — but the two differ by 40% and
       a satellite that shrinks as the window widens looks like a bug.
       Scale off the height alone, which is what actually constrains it. */
    FOC = Hh * 2.9 * V.zoom;
  }

  /* Frame-time instrumentation. Cheap: two performance.now() calls per
     frame and one running mean. It exists because "it feels fine" is
     not a number and the next person will want one. */
  var stat = { frames: 0, lastMs: 0, meanMs: 0, worstMs: 0 };

  function draw() {
    var t0 = performance.now();

    g.clearRect(0, 0, W, Hh);

    /* A soft floor glow so the object is not floating on flat black.
       Left as the literal teal rgba(63,208,201,a) on purpose:
       js/ksat-theme.js intercepts exactly that triple on its way into a
       canvas and retints it to the live --accent-canvas, so this glow
       follows the theme for free. Change the literal and it stops. */
    var fg = g.createRadialGradient(CX, Hh * 0.82, 10, CX, Hh * 0.82, W * 0.34);
    fg.addColorStop(0, 'rgba(63,208,201,.10)');
    fg.addColorStop(1, 'rgba(63,208,201,0)');
    g.fillStyle = fg; g.fillRect(0, 0, W, Hh);

    var draws = [];
    var i, f, rp, n, c, view, lam, fillL, k, vdirR, rim, spec, hv, vdir;

    /* --- faces: rotate, cull, shade --- */
    for (i = 0; i < faces.length; i++) {
      f = faces[i];
      rp = [rotPt(f.p[0]), rotPt(f.p[1]), rotPt(f.p[2]), rotPt(f.p[3])];
      n  = rotN(f.n);
      c  = [(rp[0][0] + rp[1][0] + rp[2][0] + rp[3][0]) / 4,
            (rp[0][1] + rp[1][1] + rp[2][1] + rp[3][1]) / 4,
            (rp[0][2] + rp[1][2] + rp[2][2] + rp[3][2]) / 4];
      view = [c[0], c[1], c[2] + CAM_D];
      if (dot3(n, view) >= 0) { continue; }             /* back-facing */

      lam   = Math.max(0, -dot3(n, LIGHT));
      fillL = Math.max(0, -dot3(n, FILL)) * 0.30;
      k = 0.26 + lam * 1.30 + fillL;

      /* rim term: faces turning away from the camera catch a cool edge light.
         A near-black object on a near-black ground needs this to read at all. */
      vdirR = unit3(mul3(view, -1));
      rim = Math.pow(1 - Math.min(1, Math.abs(dot3(n, vdirR))), 3.2) * 0.30;

      /* specular: half-vector against the view direction */
      spec = 0;
      if (f.glossy) {
        vdir = unit3(mul3(view, -1));
        hv = unit3(add3(vdir, mul3(LIGHT, -1)));
        spec = Math.pow(Math.max(0, dot3(n, hv)), 22) * f.glossy;
      }
      draws.push({ z: c[2], kind: 'face', f: f, rp: rp, k: k, spec: spec, rim: rim });
    }

    /* --- antenna segments, each depth-sorted on its own so the body
           occludes the parts that pass behind it --- */
    if (V.ant) {
      for (i = 0; i < rods.length; i++) {
        var rod = rods[i];
        var rrp = rod.pts.map(rotPt);
        for (var s = 0; s < rrp.length - 1; s++) {
          var a = rrp[s], b = rrp[s + 1];
          var tt = s / (rrp.length - 1);
          draws.push({ z: (a[2] + b[2]) / 2, kind: 'rod', a: a, b: b,
                       w: rod.w0 + (rod.w1 - rod.w0) * tt, col: rod.col });
        }
      }
    }

    draws.sort(function (p, q) { return q.z - p.z; });   /* far first */

    for (i = 0; i < draws.length; i++) {
      var d = draws[i];

      if (d.kind === 'rod') {
        var A = proj(d.a), B = proj(d.b);
        var sc = FOC / Math.max(1, projZ(d.a));
        g.strokeStyle = d.col; g.lineWidth = Math.max(1.0, d.w * sc * 0.92);
        g.lineCap = 'round';
        g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke();
        /* a thin top highlight so the whip reads as round, not flat */
        g.strokeStyle = 'rgba(196,214,238,.62)';
        g.lineWidth = Math.max(0.5, d.w * sc * 0.34);
        g.beginPath(); g.moveTo(A[0], A[1] - 0.9); g.lineTo(B[0], B[1] - 0.9); g.stroke();
        continue;
      }

      var df = d.f, drp = d.rp, dk = d.k, dspec = d.spec, drim = d.rim;
      var sp = [proj(drp[0]), proj(drp[1]), proj(drp[2]), proj(drp[3])];

      g.beginPath();
      g.moveTo(sp[0][0], sp[0][1]); g.lineTo(sp[1][0], sp[1][1]);
      g.lineTo(sp[2][0], sp[2][1]); g.lineTo(sp[3][0], sp[3][1]);
      g.closePath();
      g.fillStyle = shade(df.mat, dk, dspec * 0.35 + drim * 0.12);
      g.fill();

      if (df.paint) {
        g.save(); g.clip();
        /* uv -> 3D (bilinear on the rotated quad) -> screen, so detail
           keeps its perspective instead of being pasted on flat */
        /* jshint loopfunc:true */
        var uv = (function (q) {
          return function (u, v) {
            var aa = lerp3(q[0], q[1], u), bb = lerp3(q[3], q[2], u);
            return proj(lerp3(aa, bb, v));
          };
        })(drp);
        df.paint(g, uv, dk, dspec);
        g.restore();
      }

      /* edge line: catches light on the rails the way anodised alu does */
      g.strokeStyle = 'rgba(' + (150 + dspec * 260 | 0) + ',' + (170 + dspec * 240 | 0) + ',' +
                      (198 + dspec * 200 | 0) + ',' +
                      (0.09 + dk * 0.13 + drim * 0.85).toFixed(3) + ')';
      g.lineWidth = 1 + drim * 1.6;
      g.stroke();
    }

    var ms = performance.now() - t0;
    stat.frames++;
    stat.lastMs = ms;
    stat.meanMs = stat.meanMs ? stat.meanMs * 0.92 + ms * 0.08 : ms;
    if (ms > stat.worstMs) { stat.worstMs = ms; }
  }

  /* =================================================================
     5 · INTERACTION

     Drag is the preview's, unchanged in behaviour. Two additions:

     · KEYBOARD. The preview was a developer page with a mouse assumed.
       This one is in a public page, so the rotation has a keyboard
       equivalent: arrows turn it, Home puts it back. Without that the
       only way to explore the model is a pointer, which is not an
       acceptable answer on this site.

     · AUTO-ROTATION RESUMES. The preview killed auto-rotation for good
       on first drag, because it had a button to turn it back on. There
       is no button here — a control panel in a transition strip is the
       opposite of what was asked for — so a reader who nudges it once
       would leave it stopped forever. It resumes four seconds after the
       last interaction instead.
     ================================================================= */

  var drag = null;
  var idleTimer = null;
  var RESUME_MS = 4000;

  function touched() {
    V.spin = false;
    if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
    if (RM) { return; }                  /* nothing to resume into */
    idleTimer = setTimeout(function () { V.spin = true; idleTimer = null; }, RESUME_MS);
  }

  function bindInteraction() {
    fig.addEventListener('pointerdown', function (e) {
      drag = { x: e.clientX, y: e.clientY };
      touched();
      fig.setAttribute('data-drag', 'on');
      try { fig.setPointerCapture(e.pointerId); } catch (err) {}
    });

    fig.addEventListener('pointermove', function (e) {
      if (!drag) { return; }
      V.ry += (e.clientX - drag.x) * 0.0085;
      V.rx += (e.clientY - drag.y) * 0.0070;
      V.rx = Math.max(-1.35, Math.min(1.35, V.rx));
      drag = { x: e.clientX, y: e.clientY };
      /* Draw immediately rather than waiting for the loop: under reduced
         motion there is no loop, and with one there is no reason to add
         a frame of lag to a direct manipulation. */
      draw();
    });

    /* On window, not on the figure: a pointer released outside the strip
       still ends the drag. Leaving this on the element is how a model
       ends up stuck to the cursor. */
    window.addEventListener('pointerup', function () {
      drag = null; fig.removeAttribute('data-drag');
    });
    window.addEventListener('pointercancel', function () {
      drag = null; fig.removeAttribute('data-drag');
    });

    /* No wheel handler. The preview zoomed on scroll; here the strip
       sits in the middle of a very long page and swallowing the wheel
       would trap the reader's scroll in a decorative band. */

    fig.addEventListener('keydown', function (e) {
      var step = e.shiftKey ? 0.28 : 0.10;
      var used = true;
      switch (e.key) {
        case 'ArrowLeft':  V.ry -= step; break;
        case 'ArrowRight': V.ry += step; break;
        case 'ArrowUp':    V.rx = Math.max(-1.35, V.rx - step); break;
        case 'ArrowDown':  V.rx = Math.min( 1.35, V.rx + step); break;
        case 'Home':       V.ry = -0.62; V.rx = -0.30; break;
        default: used = false;
      }
      if (!used) { return; }
      e.preventDefault();               /* arrows must not scroll the page */
      touched();
      draw();
    });
  }

  /* =================================================================
     6 · THE LOOP, AND THE THREE THINGS THAT STOP IT
     ================================================================= */

  var raf = 0;
  var onScreen = false;

  function frame() {
    raf = 0;
    if (!running()) { return; }
    if (V.spin && !drag) { V.ry += 0.0042; draw(); }
    raf = requestAnimationFrame(frame);
  }

  function running() {
    return onScreen && !document.hidden && !RM;
  }

  function sync() {
    if (running()) {
      if (!raf) { raf = requestAnimationFrame(frame); }
    } else if (raf) {
      cancelAnimationFrame(raf); raf = 0;
    }
  }

  function observeVisibility() {
    if (typeof IntersectionObserver === 'undefined') {
      /* No observer: assume on screen. Worse for battery, correct for
         rendering, and this branch is the one nobody will ever hit. */
      onScreen = true; sync(); return;
    }
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        onScreen = entries[i].isIntersecting;
      }
      /* Redraw once on arrival even when not spinning, so a strip that
         was resized while off screen is not shown stale. */
      if (onScreen) { draw(); }
      sync();
    }, { rootMargin: '120px 0px', threshold: 0 });
    io.observe(strip);
  }

  /* =================================================================
     7 · RESIZE

     #descent is 100vw wide and clamp(240px,34vw,400px) tall, so it
     changes shape on every window resize and on an orientation flip.
     ResizeObserver where it exists, because the chapter system can also
     change this element's height without the window moving at all.
     ================================================================= */

  var resizeTimer = null;
  function onResize() {
    if (resizeTimer) { return; }
    resizeTimer = setTimeout(function () {
      resizeTimer = null;
      fitCanvas();
      draw();
    }, 90);
  }

  /* =================================================================
     8 · MOUNT
     ================================================================= */

  function mount() {
    strip = document.getElementById('descent');
    if (!strip) { KS.cubesat = { mounted: false, reason: 'no #descent' }; return; }
    if (strip.querySelector('.ksat-cs')) { return; }   /* already there */

    if (!buildStage(strip)) {
      fig.parentNode.removeChild(fig);
      KS.cubesat = { mounted: false, reason: 'no 2d context' };
      return;
    }

    handOverAria(strip);
    paintText();
    fitCanvas();
    draw();

    /* Only now does the old strip get hidden. If anything above had
       thrown, #cvDescent would still be drawing and the reader would
       have the page they had yesterday rather than an empty band. */
    strip.setAttribute('data-ksat-cubesat', 'on');

    bindInteraction();
    observeVisibility();

    window.addEventListener('resize', onResize);
    if (typeof ResizeObserver !== 'undefined') {
      try { new ResizeObserver(onResize).observe(strip); } catch (e) {}
    }
    document.addEventListener('visibilitychange', sync);

    /* The language switch re-renders most of the page; our strings are
       ours, so we repaint them ourselves. Fires after i18n's own walk. */
    document.addEventListener('ksat:lang', paintText);

    /* The tier flip shows or hides .dtext, which changes nothing about
       the canvas but can change the strip's layout on narrow screens. */
    document.addEventListener('ksat:identity', onResize);

    KS.cubesat = {
      mounted: true,
      bus: '2U',
      faces: faces.length,
      rods: rods.length,
      reducedMotion: RM,
      stats: function () {
        return {
          frames: stat.frames,
          lastMs: +stat.lastMs.toFixed(2),
          meanMs: +stat.meanMs.toFixed(2),
          worstMs: +stat.worstMs.toFixed(2),
          onScreen: onScreen,
          spinning: V.spin && !!raf,
          reducedMotion: RM,
          canvas: cv.width + 'x' + cv.height,
          css: W + 'x' + Hh
        };
      },
      /* Left in deliberately: the preview had view presets and losing
         them entirely would make this harder to inspect than the thing
         it replaced. No UI, just a handle. */
      view: function (ry, rx, zoom) {
        if (typeof ry === 'number') { V.ry = ry; }
        if (typeof rx === 'number') { V.rx = rx; }
        if (typeof zoom === 'number') { V.zoom = zoom; fitCanvas(); }
        touched(); draw();
      }
    };
  }

  function boot() {
    /* #descent is in the initial markup, but the chapter system in
       js/ksat-shell.js can hide and reveal it, and the page's own
       scripts run after it. Poll briefly rather than assume. */
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (document.getElementById('descent') || tries > 60) {
        clearInterval(iv);
        ensureStyles(mount);
      }
    }, 120);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
