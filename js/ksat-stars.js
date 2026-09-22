/* =====================================================================
   ksat-stars.js — THE FIELD BEHIND THE DOOR
   Owner: 01 Front End

   WHAT THIS IS FOR

   The sign-in gate is the one screen on this platform that a researcher
   looks at while doing nothing. It is a wait: the account exists, the
   password is being typed, the session is being established. Until now
   that wait was a flat panel of rgba(4,8,18,.93) over a blurred page,
   which reads as a modal that is in the way rather than as the front
   door of a spacecraft programme.

   The brief was a star field in the manner of the OpenAI Astra page:
   depth, slow drift, a sense that the panel is floating in something
   rather than sitting on something. Not a copy of it.

   WHERE IT MOUNTS, AND WHY IT WATCHES FOR ITS OWN HOST

   #ksat-gate does not exist at parse time. js/ksat-integration.js
   builds it only when a reader asks to sign in, so a script that runs
   on DOMContentLoaded and looks for it finds nothing and gives up. The
   same is true of #entry on the researcher page, which is removed after
   its splash.

   So this file does not look once. It observes document.body for
   childList additions and attaches to either host the moment it
   appears. That is the same shape js/ksat-minimal.js uses against
   renderNav(), and it is here for the same reason: this page builds
   large parts of itself after load, and a feature that assumes
   otherwise disappears the first time the DOM is rebuilt.

   WHAT IS DRAWN

   Three parallax layers of stars, a slow rotation about a centre below
   the frame, two drifting nebula washes in the platform's own teal and
   indigo, and an occasional meteor. Nothing here is data. It is
   decoration on a waiting screen and it is not badged as anything else
   — every figure on this platform declares whether it was measured or
   modelled, and the correct declaration for this one is "neither".

   MOTION IS A SETTING, NOT A DECISION

   Under prefers-reduced-motion the field is painted ONCE and the loop
   never starts: no rotation, no twinkle, no meteors. The stars stay,
   because a still star field is not a motion effect. The media query is
   re-read live, so a reader who changes the setting with the gate open
   gets the change without a reload.
   ===================================================================== */

(function () {
  'use strict';

  var KS = (window.KSAT = window.KSAT || {});
  if (KS.stars) return;                       // never mount twice

  /* Hosts this layer will decorate. #ksat-gate is the sign-in gate on
     the public site; #entry is the researcher workspace's splash, and
     #denied is what stands in its place when there is no session. All
     three are screens where somebody is waiting or being turned away,
     and all three are the full viewport. */
  var HOSTS = ['ksat-gate', 'entry', 'denied'];

  var reduce = null;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)'); } catch (e) {}
  function still() { return !!(reduce && reduce.matches); }

  /* -------------------------------------------------------------------
     A field, bound to one host element
     ------------------------------------------------------------------- */
  function field(host) {
    if (!host || host.querySelector('.ksat-stars')) return;

    var cv = document.createElement('canvas');
    cv.className = 'ksat-stars';
    cv.setAttribute('aria-hidden', 'true');    // decoration: never announced
    host.insertBefore(cv, host.firstChild);

    var ctx = cv.getContext('2d');
    if (!ctx) { cv.remove(); return; }

    var W = 0, H = 0, dpr = 1;
    var stars = [], meteors = [], t0 = 0, raf = 0;

    /* Layer 0 is furthest and barely moves; layer 2 is nearest and
       carries most of the rotation. Counts are weighted the other way
       round so the distance reads as distance and not as noise. */
    var LAYERS = [
      { n: 0.52, r: [0.35, 0.85], a: [0.18, 0.46], spin: 0.10 },
      { n: 0.33, r: [0.55, 1.25], a: [0.30, 0.68], spin: 0.26 },
      { n: 0.15, r: [0.85, 1.90], a: [0.48, 0.95], spin: 0.52 }
    ];

    /* A handful of stars are not white. Real fields are not, and two
       tinted stars per hundred is the difference between "sky" and
       "dots". The tints are the platform's own accents. */
    var TINT = ['#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFFFFF',
                '#FFFFFF', '#CFE6FF', '#CFE6FF', '#BFF3EF', '#FFE3C4'];

    function rnd(a, b) { return a + Math.random() * (b - a); }

    function build() {
      /* Density per area, so a phone and a 4K monitor look the same
         rather than the phone looking like deep space and the monitor
         looking empty. */
      var target = Math.max(120, Math.min(620, Math.round((W * H) / 3400)));
      stars = [];
      for (var li = 0; li < LAYERS.length; li++) {
        var L = LAYERS[li];
        var n = Math.round(target * L.n);
        for (var i = 0; i < n; i++) {
          stars.push({
            x: Math.random() * W,
            y: Math.random() * H,
            r: rnd(L.r[0], L.r[1]),
            a: rnd(L.a[0], L.a[1]),
            c: TINT[(Math.random() * TINT.length) | 0],
            spin: L.spin,
            /* twinkle: each star has its own period and phase, so the
               field never pulses in unison */
            tw: rnd(2.6, 7.4),
            ph: Math.random() * Math.PI * 2
          });
        }
      }
    }

    function size() {
      var r = host.getBoundingClientRect();
      var w = Math.max(1, Math.round(r.width || window.innerWidth));
      var h = Math.max(1, Math.round(r.height || window.innerHeight));
      dpr = Math.min(2, window.devicePixelRatio || 1);
      if (w === W && h === H) return false;
      W = w; H = h;
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      cv.style.width = W + 'px';
      cv.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
      return true;
    }

    /* The two nebula washes. Painted every frame because they drift;
       they are cheap because they are two radial gradients, not a
       particle system. */
    function wash(ms) {
      var d = still() ? 0 : ms / 1000;
      var cx1 = W * (0.26 + 0.05 * Math.sin(d * 0.045));
      var cy1 = H * (0.30 + 0.04 * Math.cos(d * 0.037));
      var g1 = ctx.createRadialGradient(cx1, cy1, 0, cx1, cy1, Math.max(W, H) * 0.62);
      g1.addColorStop(0, 'rgba(24,104,124,0.30)');
      g1.addColorStop(0.45, 'rgba(15,58,84,0.14)');
      g1.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, W, H);

      var cx2 = W * (0.78 - 0.05 * Math.cos(d * 0.031));
      var cy2 = H * (0.72 - 0.04 * Math.sin(d * 0.041));
      var g2 = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, Math.max(W, H) * 0.58);
      g2.addColorStop(0, 'rgba(58,44,116,0.26)');
      g2.addColorStop(0.5, 'rgba(26,22,64,0.12)');
      g2.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, W, H);
    }

    /* Rotation centre sits below the frame, so the field turns like a
       sky rather than like a wheel with a visible hub. */
    function spinAbout() { return { x: W * 0.5, y: H * 1.35 }; }

    function paint(ms) {
      var d = still() ? 0 : ms / 1000;

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#04070F';
      ctx.fillRect(0, 0, W, H);
      wash(ms);

      var c = spinAbout();
      var base = d * 0.0042;                   // radians/sec at spin = 1

      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        var ang = base * s.spin;
        var dx = s.x - c.x, dy = s.y - c.y;
        var ca = Math.cos(ang), sa = Math.sin(ang);
        var x = c.x + dx * ca - dy * sa;
        var y = c.y + dx * sa + dy * ca;

        if (x < -8 || x > W + 8 || y < -8 || y > H + 8) continue;

        var a = s.a;
        if (!still()) {
          a *= 0.62 + 0.38 * Math.sin(d * (Math.PI * 2 / s.tw) + s.ph);
        }

        ctx.globalAlpha = Math.max(0, Math.min(1, a));
        ctx.fillStyle = s.c;
        ctx.beginPath();
        ctx.arc(x, y, s.r, 0, Math.PI * 2);
        ctx.fill();

        /* The brightest few get a halo. Drawing one for every star
           costs a lot and reads as fog. */
        if (s.r > 1.45) {
          ctx.globalAlpha = Math.max(0, Math.min(1, a * 0.22));
          ctx.beginPath();
          ctx.arc(x, y, s.r * 3.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      if (!still()) meteor(ms);
    }

    var nextMeteor = 0;
    function meteor(ms) {
      if (!nextMeteor) nextMeteor = ms + rnd(3000, 9000);
      if (ms > nextMeteor) {
        meteors.push({
          x: rnd(W * 0.15, W * 1.05),
          y: rnd(-40, H * 0.55),
          len: rnd(70, 170),
          sp: rnd(0.34, 0.62),
          born: ms,
          life: rnd(900, 1500)
        });
        nextMeteor = ms + rnd(5200, 15000);
      }
      for (var i = meteors.length - 1; i >= 0; i--) {
        var m = meteors[i];
        var age = (ms - m.born) / m.life;
        if (age >= 1) { meteors.splice(i, 1); continue; }
        var px = m.x - (ms - m.born) * m.sp * 0.6;
        var py = m.y + (ms - m.born) * m.sp * 0.35;
        /* fade in over the first fifth, out over the last third */
        var a = age < 0.2 ? age / 0.2 : (age > 0.67 ? (1 - age) / 0.33 : 1);
        var g = ctx.createLinearGradient(px, py, px + m.len * 0.6, py - m.len * 0.35);
        g.addColorStop(0, 'rgba(255,255,255,' + (a * 0.85).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + m.len * 0.6, py - m.len * 0.35);
        ctx.stroke();
      }
    }

    function frame(ms) {
      if (!t0) t0 = ms;
      paint(ms - t0);
      raf = requestAnimationFrame(frame);
    }

    function start() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (still()) { paint(0); return; }        // one frame, no loop
      raf = requestAnimationFrame(frame);
    }

    function onResize() { if (size()) { t0 = 0; } if (still()) paint(0); }

    size();
    start();

    /* A window resize listener is not enough. The host is a fixed, full
       viewport panel that can be mounted while it is still detached, and
       in that state getBoundingClientRect() reports nothing — the canvas
       ends up sized to whatever the window was at mount time and a strip
       of the screen stays unpainted. ResizeObserver watches the element
       itself, so it corrects on attach, on layout and on rotate alike.
       The window listener stays as the fallback for engines without it. */
    if (window.ResizeObserver) {
      try { new ResizeObserver(onResize).observe(host); } catch (e) {}
    }
    window.addEventListener('resize', onResize);

    /* Re-read the setting live rather than at load. */
    if (reduce) {
      var onPref = function () { t0 = 0; start(); };
      if (reduce.addEventListener) reduce.addEventListener('change', onPref);
      else if (reduce.addListener) reduce.addListener(onPref);
    }

    /* -----------------------------------------------------------------
       PAUSE WHEN DETACHED, RESUME WHEN RE-ATTACHED — not "stop for good".

       js/ksat-shell.js does not leave #ksat-gate where the integration
       layer puts it. captureGate() pulls it straight back out of the
       document the moment it is built, keeps it in a variable, and
       re-appends it every time openGate() runs. So the gate's life is
       add, remove, add, remove, for as long as the page is open.

       An observer that set alive=false on the first removal would kill
       the field milliseconds after creating it and it would never come
       back — the canvas would still be there, black, every time the
       reader opened the gate. Detaching is a pause, and only a pause.

       It still has to BE a pause: a canvas painting sixty frames a
       second behind a gate nobody has opened is a battery cost nobody
       can see.
       ----------------------------------------------------------------- */
    var attached = document.contains(host);
    var watch = new MutationObserver(function () {
      var now = document.contains(host);
      if (now === attached) return;
      attached = now;
      if (now) { size(); t0 = 0; start(); }
      else if (raf) { cancelAnimationFrame(raf); raf = 0; }
    });
    watch.observe(document.body, { childList: true, subtree: true });
    if (!attached && raf) { cancelAnimationFrame(raf); raf = 0; }

    /* Nothing is painted while the tab is hidden. */
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = 0; }
      else if (attached) { t0 = 0; start(); }
    });
  }

  /* -------------------------------------------------------------------
     Attach to whichever host exists now, and to any that appears later
     ------------------------------------------------------------------- */
  function sweep() {
    for (var i = 0; i < HOSTS.length; i++) {
      var h = document.getElementById(HOSTS[i]);
      if (h) field(h);
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
          if (n.nodeType === 1 && HOSTS.indexOf(n.id) >= 0) field(n);
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
