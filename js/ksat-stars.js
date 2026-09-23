/* =====================================================================
   ksat-stars.js — THE GALAXY BEHIND THE DOOR
   Owner: 01 Front End.  Pairs with css/ksat-stars.css.

   ---------------------------------------------------------------------
   WHAT THIS IS FOR
   ---------------------------------------------------------------------
   The sign-in gate is the one screen on this platform that a researcher
   looks at while doing nothing. It is a wait: the account exists, the
   password is being typed, the session is being established. It used to
   be a flat panel over a blurred page, which reads as a modal in the
   way rather than as the front door of a spacecraft programme.

   ---------------------------------------------------------------------
   THE SECOND PASS: "exactly like this galaxy"
   ---------------------------------------------------------------------
   The first version of this file drew three parallax layers of stars,
   two nebula washes and an occasional meteor, on a brief that said "not
   exactly the same but something like that". The team came back with
   "make sure the waiting page is exactly like this galaxy", so the page
   was opened and looked at properly rather than remembered.

   What is actually on it: ONE SPIRAL GALAXY, face on, centred, drawn as
   individual point stars rather than as a painted nebula. Two arms,
   each sweeping a little over a turn. A bright core with a soft bloom.
   The stars are mostly blue-white with a scattering of warm amber ones
   through the arms, which is what gives it the look of a real stellar
   population instead of a graphic. Background black, with the faintest
   navy wash at the edges. It turns, slowly, as one piece.

   That last word matters and is the one thing that would have been got
   wrong from memory. A real galaxy rotates DIFFERENTIALLY — the inside
   goes round faster — and a particle field built that way winds its own
   arms into a smear within a minute. This one rotates rigidly. So does
   ours, and the note at rotate() says so, so nobody "fixes" it later.

   ---------------------------------------------------------------------
   HOW IT IS BUILT, AND WHY IT IS 2D CANVAS AND NOT WebGL
   ---------------------------------------------------------------------
   The reference is a WebGL2 canvas. It does not need to be: the whole
   image is under a thousand soft round blobs. Five sprites are
   pre-rendered once, one per colour in the palette, and every star is
   one drawImage of a sprite scaled to its size. That is a blit, not a
   shader, and it holds 60fps on an integrated GPU with no context to
   lose, no extension to feature-detect and no fallback path to keep.

   The geometry is a logarithmic spiral, which is what a real one is:

       theta = arm + TURNS * 2pi * t,     r = R * (0.18 + 0.82 * t^0.72)

   with t the position along the arm, gaussian scatter across it that
   widens as it goes out, a gaussian bulge of small bright stars at the
   core, and a sparse halo over the whole frame so the galaxy is in
   something rather than on something.

   The 0.18 is the gap between the bulge and where the arms begin. The
   first build ran the arms all the way in, and with additive blending
   the inner turn and the core merged into one white blob about 150px
   across. On the reference you can see black between the nucleus and
   the first arm, and that gap is most of what makes it read as a
   galaxy rather than as a light source with confetti round it.

   ---------------------------------------------------------------------
   WHERE IT MOUNTS, AND WHY IT WATCHES FOR ITS OWN HOST
   ---------------------------------------------------------------------
   #ksat-gate does not exist at parse time. js/ksat-integration.js
   builds it only when a reader asks to sign in, so a script that runs
   on DOMContentLoaded and looks for it finds nothing and gives up. The
   same is true of #entry on the researcher page, which is removed after
   its splash.

   So this file does not look once. It observes document.body for
   childList additions and attaches the moment a host appears. AND IT
   PAUSES RATHER THAN STOPS: js/ksat-shell.js captures #ksat-gate out of
   the document immediately after creating it and re-appends it on every
   open, so a field that stopped on detach drew exactly one frame in its
   life. That was the bug; the MutationObserver at watch() is the fix.

   ---------------------------------------------------------------------
   MOTION IS A SETTING, NOT A DECISION
   ---------------------------------------------------------------------
   Under prefers-reduced-motion the galaxy is painted ONCE and the loop
   never starts: no rotation and no twinkle. The stars stay, because a
   still galaxy is not a motion effect, and the still frame is the whole
   picture rather than a first frame of something. The media query is
   re-read live, so a reader who changes the setting with the gate open
   gets the change without a reload.

   Nothing here is data. It is decoration on a waiting screen and it is
   not badged as anything else: every figure on this platform declares
   whether it was measured or modelled, and the honest declaration for
   this one is "neither".
   ===================================================================== */

(function () {
  'use strict';

  var KS = (window.KSAT = window.KSAT || {});
  if (KS.stars) { return; }                   // never mount twice

  /* Hosts this layer will decorate. #ksat-gate is the sign-in gate on
     the public site; #entry is the researcher workspace's splash, and
     #denied is what stands in its place when there is no session. All
     three are screens where somebody is waiting or being turned away,
     and all three are the full viewport. */
  var HOSTS = ['ksat-gate', 'entry', 'denied'];

  var reduce = null;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)'); } catch (e) {}
  function still() { return !!(reduce && reduce.matches); }

  /* ===================================================================
     1 · THE PALETTE, AND THE SPRITES IT IS BAKED INTO

     Read off the reference rather than invented: the population is
     mostly blue-white, with a real minority of warm amber stars through
     the arms. Take the warm ones out and it stops looking like a galaxy
     and starts looking like a screensaver — they are 18% of the draw
     and most of the character.

     Each colour is pre-rendered once into a 64px sprite: a white core
     at 12% of the radius, the colour at 34%, transparent at the edge.
     Drawing a star is then one drawImage of that sprite, scaled. The
     sprites are module level and shared by every host, because there is
     never more than one gate on screen and building them per field
     would be five canvases per open.
     =================================================================== */
  var PALETTE = [
    { c: '#F4F8FF', w: 34 },   /* cool white                            */
    { c: '#CCDEFF', w: 28 },   /* blue white                            */
    { c: '#9DC2FF', w: 20 },   /* ice blue                              */
    { c: '#FFD4AC', w: 12 },   /* warm                                  */
    { c: '#FFB877', w: 6 }     /* amber                                 */
  ];
  var SPRITE = 64;
  var sprites = null;

  /* ===================================================================
     1b · THE EMBLEM AT THE CENTRE OF THE SPIRAL

     "i want in the middle of the galaxy star is our logo."

     assets/brand/ksat-emblem-256.png is the seal: a circular mark on a
     cream ground with a navy ring, already cut to a transparent circle.
     It goes where the nucleus is, and the nucleus glow stays behind it,
     so the logo reads as lit by the galaxy rather than pasted on it.

     Two things this has to get right.

     It is ASYNCHRONOUS. The first frame is painted before any image has
     loaded, and under prefers-reduced-motion there IS no second frame —
     the field draws once and stops. So every field registers a repaint
     callback here and the load fires all of them. Without that, a
     reader with motion switched off gets a galaxy with a hole in it.

     It is loaded ONCE for the whole module, not per host. There are
     three possible hosts on two pages and never more than one of them
     on screen, and a second decode of the same 256px PNG for the same
     centre is work nobody asked for.
     =================================================================== */
  var MARK_SRC = 'assets/brand/ksat-emblem-256.png';
  var mark = null;
  var markWaiting = [];

  function brand(onReady) {
    if (mark === false) { return null; }          /* it failed; stop asking */
    if (mark) { return mark.complete && mark.naturalWidth ? mark : null; }

    mark = new Image();
    mark.decoding = 'async';
    mark.addEventListener('load', function () {
      var q = markWaiting; markWaiting = [];
      q.forEach(function (fn) { try { fn(); } catch (e) {} });
    });
    mark.addEventListener('error', function () { mark = false; markWaiting = []; });
    mark.src = MARK_SRC;

    if (onReady) { markWaiting.push(onReady); }
    return null;
  }

  function buildSprites() {
    if (sprites) { return sprites; }
    sprites = PALETTE.map(function (p) {
      var c = document.createElement('canvas');
      c.width = c.height = SPRITE;
      var g = c.getContext('2d');
      var h = SPRITE / 2;
      var grad = g.createRadialGradient(h, h, 0, h, h, h);
      grad.addColorStop(0.00, '#FFFFFF');
      grad.addColorStop(0.12, p.c);
      grad.addColorStop(0.34, tint(p.c, 0.45));
      grad.addColorStop(1.00, tint(p.c, 0));
      g.fillStyle = grad;
      g.fillRect(0, 0, SPRITE, SPRITE);
      return c;
    });
    return sprites;
  }

  /* #RRGGBB to rgba() at a given alpha. Written out rather than reached
     for from a library because it is four lines and this file has no
     dependencies at all. */
  function tint(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function pick() {
    var r = Math.random() * 100, acc = 0;
    for (var i = 0; i < PALETTE.length; i++) {
      acc += PALETTE[i].w;
      if (r < acc) { return i; }
    }
    return 0;
  }

  /* A gaussian, by the cheap route: the sum of three uniforms is close
     enough to normal for scatter that nobody will measure. */
  function gauss() {
    return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
  }

  /* ===================================================================
     2 · ONE GALAXY, BOUND TO ONE HOST
     =================================================================== */
  function field(host) {
    if (!host || host.dataset.ksatStars === 'on') { return; }
    host.dataset.ksatStars = 'on';

    var cv = document.createElement('canvas');
    cv.className = 'ksat-stars';
    cv.setAttribute('aria-hidden', 'true');
    host.insertBefore(cv, host.firstChild);

    var g = cv.getContext('2d', { alpha: false });
    if (!g) { return; }

    var W = 0, Hh = 0, dpr = 1;
    var stars = [];
    var CX = 0, CY = 0, R = 1;
    var spin = 0;
    var raf = 0, t0 = 0;

    /* ---- geometry ------------------------------------------------- */
    var ARMS = 2;
    var TURNS = 1.26;          /* how far one arm wraps, in turns       */
    var CORE = 0.17;           /* share of stars in the central bulge   */
    var HALO = 200;            /* loose stars over the whole frame      */

    function count() {
      /* Density per area, capped. A phone gets a galaxy rather than a
         thinned-out version of a desktop one, and a 4K panel does not
         get 9,000 sprites a frame. */
      var n = Math.round((W * Hh) / 1050);
      return Math.max(520, Math.min(1450, n));
    }

    function build() {
      stars = [];
      var n = count();

      /* THE CORE. A gaussian cloud, small and bright. It is what makes
         the middle read as a nucleus rather than as the place the arms
         happen to meet. */
      var nCore = Math.round(n * CORE);
      for (var i = 0; i < nCore; i++) {
        var cr = Math.abs(gauss()) * R * 0.080;
        var ca = Math.random() * Math.PI * 2;
        stars.push({
          x: Math.cos(ca) * cr,
          y: Math.sin(ca) * cr,
          /* Small and many, so the bulge reads as one glow rather
             than as six white blobs sitting on top of each other. */
          s: 0.34 + Math.random() * 0.62,
          a: 0.7 + Math.random() * 0.3,
          p: pick(),
          ph: Math.random() * Math.PI * 2,
          tw: 0.10 + Math.random() * 0.14
        });
      }

      /* THE ARMS. t runs along the arm; r is a power of t so the stars
         bunch toward the middle the way they do on the reference, and
         the cross-arm scatter widens as it goes out. */
      var nArm = n - nCore;
      for (var j = 0; j < nArm; j++) {
        var arm = j % ARMS;
        var t = Math.pow(Math.random(), 0.82);
        var r = R * (0.18 + 0.82 * Math.pow(t, 0.72));
        var th = (arm / ARMS) * Math.PI * 2 + TURNS * Math.PI * 2 * t;

        /* Scatter across the arm, plus a little along it, so the arm is
           a band of stars and not a drawn line. */
        var spread = R * (0.030 + 0.100 * t);
        var ox = gauss() * spread;
        var oy = gauss() * spread;
        th += gauss() * 0.10;

        var big = Math.random() < 0.05;       /* the few bright giants  */
        stars.push({
          x: Math.cos(th) * r + ox,
          y: Math.sin(th) * r + oy,
          s: (big ? 1.7 + Math.random() * 1.7 : 0.55 + Math.random() * 1.25) * (1 - 0.20 * t),
          a: (big ? 1 : 0.6 + Math.random() * 0.4) * (1 - 0.26 * t),
          p: pick(),
          ph: Math.random() * Math.PI * 2,
          tw: 0.08 + Math.random() * 0.16
        });
      }

      /* THE HALO. Sparse, faint, and OUTSIDE the disc as often as in
         it, so the galaxy sits in space rather than on a black card.
         These rotate with everything else; at this brightness nobody
         can tell, and exempting them costs a branch per star. */
      for (var k = 0; k < HALO; k++) {
        var hr = R * (0.35 + Math.random() * 1.5);
        var ha = Math.random() * Math.PI * 2;
        stars.push({
          x: Math.cos(ha) * hr,
          y: Math.sin(ha) * hr,
          s: 0.4 + Math.random() * 0.7,
          a: 0.16 + Math.random() * 0.34,
          p: pick(),
          ph: Math.random() * Math.PI * 2,
          tw: 0.14 + Math.random() * 0.2
        });
      }
    }

    function size() {
      var r = host.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width || window.innerWidth));
      Hh = Math.max(1, Math.round(r.height || window.innerHeight));
      /* 1.5 rather than the full device ratio. These are soft blobs
         with no edge to alias, so the third pixel buys nothing and
         costs 78% more fill on a 2x panel. */
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(Hh * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);

      /* TWO COMPOSITIONS, AND THE BREAKPOINT IS WHERE THEY STOP
         FIGHTING. The card is about 390px wide and centred. A galaxy
         also centred, 500px across, is simply underneath it: measured
         in the browser, the scrim over the middle of the card killed
         every arm and what was left on screen was a form on black with
         a few stray halo stars. The reference gets away with a centred
         galaxy because its words are at the far left and far right of
         the frame, and a sign-in card cannot be.

         So on a wide screen the pair separates the way the reference
         separates them: the card moves to the left gutter (that half is
         css/ksat-stars.css) and the galaxy takes the right. Below
         1000px there is no room for two things side by side, so it
         centres and the scrim does the work. */
      CX = (W >= 1000) ? W * 0.66 : W * 0.5;
      /* A LITTLE ABOVE CENTRE. The card carrying the security notice and
         the password field sits in the middle of this host, and it is a
         soft scrim rather than a panel (see css/ksat-stars.css), so the
         galaxy reads THROUGH it the way the reference reads behind its
         own headline. 0.42 keeps the core just above the title instead
         of directly behind it, which is the difference between a glow
         under the words and a washed-out word. */
      CY = Hh * 0.42;
      R = Math.min(W, Hh) * 0.40;
      build();
    }

    /* ---- paint ---------------------------------------------------- */
    function ground() {
      /* Black, with the faintest navy lift away from the core. The
         reference is pure black at the edges and very slightly blue
         where the galaxy's light falls, and that gradient is the
         difference between "space" and "a black div". */
      g.fillStyle = '#04070F';
      g.fillRect(0, 0, W, Hh);

      var vg = g.createRadialGradient(CX, CY, 0, CX, CY, Math.max(W, Hh) * 0.75);
      vg.addColorStop(0, 'rgba(24,44,86,.55)');
      vg.addColorStop(0.45, 'rgba(12,22,46,.28)');
      vg.addColorStop(1, 'rgba(4,7,15,0)');
      g.fillStyle = vg;
      g.fillRect(0, 0, W, Hh);
    }

    function bloom() {
      var bg = g.createRadialGradient(CX, CY, 0, CX, CY, R * 0.50);
      bg.addColorStop(0, 'rgba(255,250,238,.50)');
      bg.addColorStop(0.10, 'rgba(236,240,255,.30)');
      bg.addColorStop(0.30, 'rgba(186,208,255,.13)');
      bg.addColorStop(0.62, 'rgba(140,175,255,.045)');
      bg.addColorStop(1, 'rgba(120,160,255,0)');
      g.fillStyle = bg;
      g.fillRect(CX - R, CY - R, R * 2, R * 2);
    }

    function draw(ms) {
      ground();

      var sp = buildSprites();
      var cos = Math.cos(spin), sin = Math.sin(spin);
      /* A hair of inclination. Face on reads as a target; 0.94 reads as
         a disc seen from very slightly off the pole, which is what the
         reference looks like. */
      var SQ = 0.94;
      var moving = !still();

      g.globalCompositeOperation = 'lighter';
      for (var i = 0; i < stars.length; i++) {
        var st = stars[i];
        var x = CX + (st.x * cos - st.y * sin);
        var y = CY + (st.x * sin + st.y * cos) * SQ;

        var sz = st.s * 3.2;                         /* sprite is soft  */
        if (x < -sz || x > W + sz || y < -sz || y > Hh + sz) { continue; }

        var a = st.a;
        if (moving) { a *= 1 + st.tw * Math.sin(ms * 0.0013 + st.ph); }
        if (a <= 0.01) { continue; }

        g.globalAlpha = a > 1 ? 1 : a;
        g.drawImage(sp[st.p], x - sz, y - sz, sz * 2, sz * 2);
      }
      g.globalAlpha = 1;
      bloom();
      g.globalCompositeOperation = 'source-over';

      /* The emblem last, and in source-over rather than lighter: it has
         its own cream ground and an additive blend would bleach it to
         white against the nucleus it is sitting on.

         0.36 of the galaxy radius, and that number is the arms' rather
         than a matter of taste: the spiral starts at 0.18R (see the
         header), so a seal of 0.36R DIAMETER has a radius of 0.18R and
         meets the first arm exactly. At 0.44 it sat on top of the arm
         and the gap that makes this read as a galaxy closed up. The
         bulge stars are drawn and then covered, which is right — the
         logo IS the nucleus now. */
      var m = brand(repaint);
      if (m) {
        var d = R * 0.36;
        g.drawImage(m, CX - d / 2, CY - d / 2, d, d);
      }
    }

    /* Handed to brand() so a late-arriving image repaints a field that
       has already stopped: under reduced motion there is no next frame
       to pick it up. */
    function repaint() {
      if (!document.contains(host)) { return; }
      draw(0);
    }

    /* RIGID ROTATION, AND THIS IS NOT AN OVERSIGHT.

       Real galaxies rotate differentially: the inside goes round in far
       less time than the outside. Build a particle field that way and
       the arms wind themselves into a featureless smear inside a
       minute, because there is no density wave here to hold them — the
       stars ARE the arms. The reference rotates as one piece and so
       does this. One revolution in 300 seconds, which is slow enough to
       be noticed rather than watched. */
    var OMEGA = (Math.PI * 2) / 300000;

    function frame(ms) {
      raf = 0;
      if (still() || document.hidden || !document.contains(host)) { return; }
      if (!t0) { t0 = ms; }
      spin += OMEGA * (ms - (frame.last || ms));
      frame.last = ms;
      draw(ms);
      raf = requestAnimationFrame(frame);
    }

    function start() {
      if (raf) { return; }
      frame.last = 0;
      /* PAINT ONE FRAME NOW, before asking for the next. A background
         tab never services requestAnimationFrame, so a gate opened in a
         window that is not in front sat black until the reader came
         back to it. The galaxy is a still picture that happens to turn;
         there is no reason for the first one to wait on a frame
         callback. */
      draw(0);
      if (still()) { return; }
      raf = requestAnimationFrame(frame);
    }

    function stop() {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
    }

    /* ---- life ------------------------------------------------------ */
    size();
    start();

    /* THE HOST IS DETACHED AND RE-ATTACHED, AND THAT COST A BUG ONCE.

       js/ksat-shell.js's captureGate() removes #ksat-gate from the
       document the instant it is built and puts it back on every open.
       A field that STOPPED on detach therefore drew one frame in its
       entire life and then sat still for ever. So detach pauses and
       attach resumes. */
    var attached = document.contains(host);
    new MutationObserver(function () {
      var now = document.contains(host);
      if (now === attached) { return; }
      attached = now;
      if (now) { size(); t0 = 0; start(); }
      else { stop(); }
    }).observe(document.body, { childList: true, subtree: true });

    /* A window resize is not enough on its own: this host is often
       mounted while detached, where it has no measurable box, and it
       gets its real size the moment it is put back. */
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(function () {
        if (!document.contains(host)) { return; }
        size();
        if (still()) { draw(0); } else { start(); }
      }).observe(host);
    } else {
      window.addEventListener('resize', function () { size(); start(); });
    }

    if (reduce && reduce.addEventListener) {
      reduce.addEventListener('change', function () {
        stop();
        if (still()) { draw(0); } else { t0 = 0; start(); }
      });
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { stop(); }
      else if (attached) { t0 = 0; start(); }
    });
  }

  /* ===================================================================
     3 · ATTACH TO WHATEVER EXISTS NOW, AND TO WHATEVER APPEARS LATER
     =================================================================== */
  function sweep() {
    for (var i = 0; i < HOSTS.length; i++) {
      var h = document.getElementById(HOSTS[i]);
      if (h) { field(h); }
    }
  }

  function boot() {
    sweep();
    /* childList only, and no subtree scan of our own canvas: this page
       has frozen once already on an observer that watched everything
       while the callback mutated inside it. */
    new MutationObserver(function (recs) {
      for (var i = 0; i < recs.length; i++) {
        var add = recs[i].addedNodes;
        for (var j = 0; j < add.length; j++) {
          var n = add[j];
          if (n.nodeType === 1 && HOSTS.indexOf(n.id) >= 0) { field(n); }
        }
      }
    }).observe(document.body, { childList: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  KS.stars = { mount: field, sweep: sweep };
})();
