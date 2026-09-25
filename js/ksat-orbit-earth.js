/* =====================================================================
   ksat-orbit-earth.js - a real Earth that turns, and the real spacecraft
   Owner: 01 Front End

   "Where Is KuwaitSat?" drew its planet from about forty hand-typed
   coastline points and its spacecraft from three rectangles. This
   supplies the two things it should have been drawing instead, and the
   page keeps its old drawing whenever either one is not ready.

   1 · THE PLANET. Satellite imagery, sampled per pixel through an
       orthographic projection - the same technique and the same source
       as the page's intro globe, but turning.

   2 · THE SPACECRAFT. Not drawn here at all. js/ksat-cubesat.js already
       renders KuwaitSat-1 properly: real geometry in millimetres, solar
       cells painted per face, back-face culling, depth-sorted antennas.
       This asks that renderer for an offscreen sprite and caches it. A
       second, simpler spacecraft would be a second model of one real
       object, free to drift away from the first.

   ---------------------------------------------------------------------
   HOW A PHOTOGRAPH OF A PLANET ROTATES AT SIXTY FRAMES A SECOND
   ---------------------------------------------------------------------
   The intro globe is rendered once, so it can afford an asin, an atan2,
   a tan, a log and a pow per pixel. Measured here, that is 28ms for a
   254px sphere. Three frames. Per frame.

   The first version of this file cached a sphere per 6 degrees of
   longitude and reused it, which is fine for something static and
   visibly wrong for something turning: the planet stepped.

   THE OBSERVATION THAT FIXES IT. As the globe rotates, the geometry
   does not change at all. Every pixel keeps its latitude, keeps its
   shading, and keeps its texture ROW. The only thing that moves is the
   texture COLUMN, and it moves by the same amount for every pixel on
   the disc.

   So all of it is precomputed once per size: for each pixel inside the
   disc, the destination offset, the texture row, the texture column at
   zero longitude, and the three shading multipliers. A frame is then a
   flat loop over that list doing one add, one wrap and three multiplies
   per pixel - no trigonometry anywhere - which measures around a
   millisecond and rotates continuously instead of stepping.

   The tables are rebuilt only when the canvas size or the tilt changes,
   which is a window resize.

   ---------------------------------------------------------------------
   SOURCE AND LICENCE
   ---------------------------------------------------------------------
   EOX s2cloudless, Web Mercator zoom 2. The same imagery as the intro
   globe and both report figures, already credited on the page and
   already in the img-src allow-list in vercel.json. Nothing new has to
   be allowed for this file to work in production.

   The tiles answer with access-control-allow-origin:*, so with
   crossOrigin='anonymous' the scratch canvas stays untainted and
   getImageData works. That is the only reason per-pixel sampling is
   possible at all; without it the browser throws on read and the page
   silently keeps its old globe.

   ---------------------------------------------------------------------
   IT MUST NEVER BLOCK AND NEVER THROW
   ---------------------------------------------------------------------
   Every function here returns false or null until it can return
   something real, and the caller keeps what it already had. A panel
   that renders nothing while a fetch is in flight is worse than one
   that renders yesterday's drawing.
   ===================================================================== */
(function (w, doc) {
  'use strict';

  var KS = w.KSAT = w.KSAT || {};
  if (KS.orbitEarth) { return; }

  var TEX = { px: null, w: 0, h: 0, tried: false };
  var TEX_Z = 2;                 /* 4 x 4 tiles = 1024 x 1024 */

  /* ------------------------------------------------------------------
     1 · THE IMAGERY
     ------------------------------------------------------------------ */
  function load() {
    if (TEX.tried) { return; }
    TEX.tried = true;

    var N = 1 << TEX_Z, SIZE = 256;
    var c = doc.createElement('canvas');
    c.width = N * SIZE; c.height = N * SIZE;
    var g = c.getContext('2d', { willReadFrequently: true });
    if (!g) { return; }
    var done = 0;

    for (var ty = 0; ty < N; ty++) {
      for (var tx = 0; tx < N; tx++) {
        (function (X, Y) {
          var im = new w.Image();
          im.crossOrigin = 'anonymous';
          im.onload = function () {
            try { g.drawImage(im, X * SIZE, Y * SIZE, SIZE, SIZE); } catch (e) {}
            if (++done === N * N) { finish(); }
          };
          /* One tile that never arrives is a hole in an ocean, not a
             failure. Fifteen of sixteen is still the real planet. */
          im.onerror = function () { if (++done === N * N) { finish(); } };
          im.src = 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2021_3857/' +
                   'default/GoogleMapsCompatible/' + TEX_Z + '/' + Y + '/' + X + '.jpg';
        }(tx, ty));
      }
    }

    function finish() {
      try {
        TEX.px = g.getImageData(0, 0, c.width, c.height).data;
        TEX.w = c.width; TEX.h = c.height;
      } catch (e) {
        /* Tainted canvas. It should not happen with ACAO:*, but a proxy
           or a corporate middlebox that strips the header would do it,
           and the caller's own globe is a better answer than a hole. */
        TEX.px = null;
      }
    }
  }

  /* ------------------------------------------------------------------
     2 · THE TABLES

     Built once per (size, tilt). See HOW A PHOTOGRAPH OF A PLANET
     ROTATES above for why this exists at all.

     The maths is the inverse orthographic projection: from a pixel's
     offset inside the disc, work out the point on the sphere, then the
     latitude and longitude there, then where that falls in a Web
     Mercator image. The Mercator inverse is the

         v = (1 - ln(tan f + sec f) / pi) / 2

     below, and it is why latitude has to be clamped: Mercator does not
     reach the poles, so a pixel past +-85.05 degrees has no source row
     and would read off the end of the buffer.
     ------------------------------------------------------------------ */
  var TBL = null;                /* the tables for the current size/tilt */

  function build(size, phi0deg) {
    var R = size / 2;
    var TW = TEX.w, TH = TEX.h;
    var phi0 = phi0deg * Math.PI / 180;
    var sp0 = Math.sin(phi0), cp0 = Math.cos(phi0);

    /* Sun direction: up and to the left, the same as the intro globe
       and as the highlight the panel already lays over the disc. */
    var LX = -0.46, LY = -0.40, LZ = 0.79;
    var LAT_MAX = 1.4844;                  /* 85.05 deg, Mercator's limit */

    var cap = size * size;
    var dst = new Int32Array(cap);         /* byte offset in the output   */
    var row = new Int32Array(cap);         /* texture row, times TW       */
    var col = new Int32Array(cap);         /* texture column at lon 0     */
    var kR  = new Float32Array(cap);       /* shading, red                */
    var kG  = new Float32Array(cap);
    var kB  = new Float32Array(cap);
    var aR  = new Float32Array(cap);       /* terminator glow, added      */
    var aG  = new Float32Array(cap);
    var n = 0;

    for (var py = 0; py < size; py++) {
      var ny = (py - R + 0.5) / R;
      for (var px = 0; px < size; px++) {
        var nx = (px - R + 0.5) / R;
        var d2 = nx * nx + ny * ny;
        if (d2 > 1) { continue; }          /* outside the disc, stays clear */
        var nz = Math.sqrt(1 - d2);

        var lat = Math.asin(nz * sp0 + (-ny) * cp0);
        /* Longitude relative to the centre. The centre's own longitude
           is added at draw time, as a whole number of texture columns,
           which is the entire trick. */
        var rel = Math.atan2(nx, nz * cp0 - (-ny) * sp0) * 180 / Math.PI;

        var latC = lat > LAT_MAX ? LAT_MAX : (lat < -LAT_MAX ? -LAT_MAX : lat);
        var v = (1 - Math.log(Math.tan(latC) + 1 / Math.cos(latC)) / Math.PI) / 2;
        var sy = (v * TH) | 0;
        if (sy < 0) { sy = 0; } else if (sy >= TH) { sy = TH - 1; }

        var u = (((rel + 180) % 360) + 360) % 360 / 360;
        var sx = (u * TW) | 0;
        if (sx < 0) { sx = 0; } else if (sx >= TW) { sx = TW - 1; }

        /* Lambert, softened across the terminator. A hard clamp at zero
           draws a razor edge down the middle of the planet, and a razor
           edge is what makes a render read as a diagram. */
        var lam = nx * LX + ny * LY + nz * LZ;
        var soft = 0.34;
        lam = lam > soft ? lam
            : lam < -soft ? 0
            : (lam + soft) * (lam + soft) / (4 * soft);
        var sh = 0.13 + 0.90 * Math.pow(lam, 0.72);
        /* A warm band right at the terminator, and more blue on the
           night side: the two things that read as atmosphere. */
        var warm = (lam > 0.02 && lam < 0.30) ? (0.30 - lam) / 0.28 : 0;

        dst[n] = (py * size + px) * 4;
        row[n] = sy * TW;
        col[n] = sx;
        kR[n] = sh;
        kG[n] = sh;
        kB[n] = sh * (1 + 0.15 * (1 - lam));
        aR[n] = warm * 34;
        aG[n] = warm * 12;
        n++;
      }
    }

    var cv = doc.createElement('canvas');
    cv.width = size; cv.height = size;
    var g = cv.getContext('2d');
    if (!g) { return null; }

    return {
      size: size, phi0: phi0deg, n: n, TW: TW,
      dst: dst, row: row, col: col, kR: kR, kG: kG, kB: kB, aR: aR, aG: aG,
      cv: cv, g: g,
      /* Reused every frame. Everything outside the disc is left at the
         zero alpha createImageData gives it and is never written again,
         so the disc stays a disc without a per-pixel test. */
      img: g.createImageData(size, size)
    };
  }

  /* One frame of the globe, drawn into ctx at (x,y) at `size` CSS px.
     Returns false if the imagery has not arrived, and the caller is
     expected to draw whatever it drew before. */
  function draw(ctx, x, y, size, lam0deg, phi0deg) {
    load();
    if (!TEX.px) { return false; }

    /* Whole pixels: a sphere resampled onto a half-pixel grid shimmers
       along the coastlines as it turns. */
    var sz = Math.max(32, Math.min(768, Math.round(size)));
    var tilt = Math.round(phi0deg);
    if (!TBL || TBL.size !== sz || TBL.phi0 !== tilt) {
      TBL = build(sz, tilt);
      if (!TBL) { return false; }
    }

    var T = TBL, TW = T.TW, tex = TEX.px;
    var d = T.img.data;
    var dst = T.dst, row = T.row, col = T.col;
    var kR = T.kR, kG = T.kG, kB = T.kB, aR = T.aR, aG = T.aG;

    /* The rotation, as a whole number of texture columns. At 1024
       columns one step is 0.35 of a degree, which at this size is a
       third of a pixel: continuous as far as anyone can see. */
    var shift = Math.round((((lam0deg % 360) + 360) % 360) / 360 * TW) % TW;

    for (var i = 0, n = T.n; i < n; i++) {
      var sx = col[i] + shift;
      if (sx >= TW) { sx -= TW; }
      var t = (row[i] + sx) << 2;
      var o = dst[i];
      /* d is a Uint8ClampedArray, so the clamping is the array's. */
      d[o]     = tex[t]     * kR[i] + aR[i];
      d[o + 1] = tex[t + 1] * kG[i] + aG[i];
      d[o + 2] = tex[t + 2] * kB[i];
      d[o + 3] = 255;
    }

    T.g.putImageData(T.img, 0, 0);
    ctx.drawImage(T.cv, x, y, size, size);
    return true;
  }

  /* ------------------------------------------------------------------
     3 · THE SPACECRAFT

     Borrowed whole from js/ksat-cubesat.js, so the orbit panel and the
     hero show one model of one satellite. That renderer is a full 3D
     pass per call, far too much per frame, so sprites are cached by
     rotation: SAT_STEP degrees per entry.

     It returns null until that file has loaded and exposed its sprite
     entry point, which is the ordinary state for the first few frames -
     scripts load in order and this panel starts drawing before the tail
     of the page has run.
     ------------------------------------------------------------------ */
  var SAT_STEP = 15;
  var SATS = {}, SAT_N = 0, SAT_MAX = 240;

  function satellite(size, spinDeg, tiltDeg) {
    var fn = KS.cubesatSprite;
    if (typeof fn !== 'function') { return null; }

    var sz = Math.round((size || 40) / 8) * 8;
    if (sz < 24) { sz = 24; } else if (sz > 160) { sz = 160; }
    var spin = Math.round(((spinDeg % 360) + 360) % 360 / SAT_STEP) * SAT_STEP;
    var tilt = Math.round(tiltDeg || 0);
    var key = sz + '|' + spin + '|' + tilt;

    if (!SATS.hasOwnProperty(key)) {
      /* Bounded, and bluntly so: past the limit the whole cache goes
         rather than one entry at a time. A full turn at one size is 24
         entries, so the limit is only reached by something pathological
         - a tab left open through many resizes - and paying for one
         rebuild beats holding an unbounded pile of canvases. */
      if (SAT_N >= SAT_MAX) { SATS = {}; SAT_N = 0; }
      /* Cached even when it comes back null, so a renderer that cannot
         produce a sprite is asked once per bucket, not once a frame. */
      SATS[key] = fn(sz, spin, tilt, 1) || null;
      SAT_N++;
    }
    return SATS[key];
  }

  KS.orbitEarth = {
    draw: draw,
    satellite: satellite,
    load: load,
    ready: function () { return !!TEX.px; }
  };

  /* Start fetching as soon as this file runs. The panel is below the
     fold, so the imagery has usually arrived before anyone scrolls to
     it, and the caller draws its old globe until it has. */
  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
}(window, document));
