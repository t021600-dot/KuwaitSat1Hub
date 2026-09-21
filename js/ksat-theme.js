/* =====================================================================
   KuwaitSat-1 Mission Hub — theme layer, progressive enhancement only
   Owner: 01 Front-end.  Companion to css/ksat-theme.css.

   ---------------------------------------------------------------------
   WHY THIS FILE EXISTS AT ALL
   ---------------------------------------------------------------------
   css/ksat-theme.css restyles the page by re-declaring the prototype's
   CSS variables. That reaches everything drawn by the BROWSER.

   It does not reach anything drawn by JavaScript into a <canvas>, because
   a canvas is a bitmap: the drawing code passes colour and font as plain
   strings, and index.html has those strings hard-coded. The globe halo,
   the graticule, the orbit swath cone, the descent beam and the satellite
   sprite are all painted with the OLD teal #3FD0C9. Leave them and the
   page ends up with teal accents floating inside a blue-accented site,
   which looks broken rather than deliberate.

   We cannot edit index.html. So this file does the one thing CSS cannot:
   it intercepts the canvas colour and font properties and translates the
   handful of BRAND strings on their way through.

   ---------------------------------------------------------------------
   WHAT IT DELIBERATELY DOES NOT DO
   ---------------------------------------------------------------------
   · It does not touch imagery colour. The Earth, the ocean, the desert,
     the atmosphere, the rocket, the starfield and every data ramp (green
     vegetation, amber-red heat) are passed through untouched. Those are
     mission imagery and data — they already read correctly, and recolouring
     data would be a lie about the data.
   · It does not add, remove, reorder or rewrite any page content.
   · It does not change any animation, timing or behaviour.
   · If anything it depends on is missing, every step is skipped silently
     and the page behaves exactly as it did before.
   ===================================================================== */

(function () {
  'use strict';

  /* Refuse to install twice, however the file gets loaded. */
  if (window.KSAT_THEME) { return; }
  var THEME = window.KSAT_THEME = { patched: false, repainted: false };

  /* -------------------------------------------------------------------
     1 · THE TRANSLATION TABLE

     Only brand / chrome colours appear here. Each entry says what the
     colour is used for in index.html, so it is obvious why it is safe
     to change — and equally obvious what is NOT in the list.
     ------------------------------------------------------------------- */
  var COLOR_MAP = {
    // the retired accent: globe halo + graticule, choropleth selection
    // stroke, descent tick, orbit swath, satellite solar panels
    '#3fd0c9': '#3D8BFF',
    // satellite body highlight, drawn five times across the page
    '#5fd6cf': '#6BA8FF',
    // descent caption line
    '#4fd3cc': '#3D8BFF',
    // choropleth label fill (a pale teal)
    '#8ff0ea': '#A8C8FF',
    // the hero gradient's cool stop, where it is drawn rather than styled
    '#22a9a3': '#2E6FD6'
  };

  /* The same accent also appears 33 times as rgba(63,208,201,alpha) for
     halos, graticules, beams and cones. The alpha carries the design
     intent, so we keep whatever alpha was asked for and swap only the
     three channel values. 61,139,255 is #3D8BFF. */
  var OLD_RGB = '63,208,201';
  var NEW_RGB = '61,139,255';

  /* Canvas font strings hard-code the family, so they cannot follow the
     --body variable. The theme moves body text from IBM Plex Sans to
     Inter; without this the chart axis labels would stay on Plex and
     visibly disagree with every label around them. IBM Plex Mono is
     retained by the theme, so mono strings are left alone. */
  var FONT_FROM = /IBM Plex Sans/g;
  var FONT_TO = 'Inter';

  /* -------------------------------------------------------------------
     2 · THE TRANSLATOR

     This runs on every canvas colour write on the page, including inside
     60fps animation loops, so it has to be cheap. A Map memoises each
     distinct string the first time it is seen; after that the hot path is
     a single Map.get. The cache is capped because rampColor() generates
     a long tail of unique interpolated hexes.
     ------------------------------------------------------------------- */
  var cache = new Map();

  function translate(value) {
    // Gradients and patterns are objects, not strings. Pass straight through.
    if (typeof value !== 'string') { return value; }

    var hit = cache.get(value);
    if (hit !== undefined) { return hit; }

    var out = value;
    var lower = value.toLowerCase();

    if (COLOR_MAP[lower]) {
      out = COLOR_MAP[lower];
    } else if (lower.indexOf(OLD_RGB) !== -1) {
      out = value.replace(OLD_RGB, NEW_RGB);
    }

    if (cache.size > 600) { cache.clear(); }
    cache.set(value, out);
    return out;
  }

  function translateFont(value) {
    if (typeof value !== 'string' || value.indexOf('IBM Plex Sans') === -1) {
      return value;
    }
    var hit = cache.get(value);
    if (hit !== undefined) { return hit; }
    var out = value.replace(FONT_FROM, FONT_TO);
    if (cache.size > 600) { cache.clear(); }
    cache.set(value, out);
    return out;
  }

  /* -------------------------------------------------------------------
     3 · INSTALLING THE INTERCEPT

     We replace the property descriptor on CanvasRenderingContext2D's
     prototype. The original setter is kept and always called, so the
     browser still does all the real work and still validates the value —
     we only hand it a different string. The getter is left completely
     alone, so any code that reads a colour back gets exactly what the
     canvas holds.

     If the browser does not expose these as configurable accessors, we
     bail out and change nothing.
     ------------------------------------------------------------------- */
  function patchProperty(proto, name, mapFn) {
    var desc = Object.getOwnPropertyDescriptor(proto, name);
    if (!desc || !desc.set || !desc.configurable) { return false; }

    var originalSet = desc.set;
    Object.defineProperty(proto, name, {
      configurable: true,
      enumerable: desc.enumerable,
      get: desc.get,
      set: function (value) { originalSet.call(this, mapFn(value)); }
    });
    return true;
  }

  function installCanvasIntercept() {
    if (typeof CanvasRenderingContext2D === 'undefined') { return false; }
    var proto = CanvasRenderingContext2D.prototype;
    var ok = false;

    try {
      // fillStyle and strokeStyle cover essentially every painted pixel.
      ok = patchProperty(proto, 'fillStyle', translate) || ok;
      ok = patchProperty(proto, 'strokeStyle', translate) || ok;
      // shadowColor is used once, for the globe halo glow.
      ok = patchProperty(proto, 'shadowColor', translate) || ok;
      // font keeps canvas labels on the same face as the page.
      ok = patchProperty(proto, 'font', translateFont) || ok;
    } catch (e) {
      // A locked-down or unusual engine. Not worth failing the page over.
      return false;
    }
    return ok;
  }

  /* -------------------------------------------------------------------
     4 · REPAINTING

     Installing the intercept changes nothing that is already on screen —
     a canvas keeps whatever bitmap it was last given. Something has to
     ask the page to draw again.

     renderAll() is the prototype's own full render, defined at
     index.html:4268 and called at boot from applyLang(). It rebuilds
     every view purely from the state object S, so calling it is exactly
     what the page does when the language changes. It is safe here because
     we run at load, before the researcher has started anything.

     Everything is wrapped: if renderAll is absent or throws, we fall back
     to a resize event, which the page already listens for and which
     redraws every canvas. If that is unavailable too, we simply stop —
     the canvases keep their original colours and nothing breaks.
     ------------------------------------------------------------------- */
  function repaint() {
    try {
      if (typeof window.renderAll === 'function') {
        window.renderAll();
        THEME.repainted = true;
        return;
      }
    } catch (e) { /* fall through to the gentler option */ }

    try {
      window.dispatchEvent(new Event('resize'));
      THEME.repainted = true;
    } catch (e) { /* nothing left to try; leave the page as it is */ }
  }

  /* -------------------------------------------------------------------
     5 · BOOT

     Order matters: intercept first, then repaint, or the repaint would
     draw the old colours.
     ------------------------------------------------------------------- */
  function boot() {
    THEME.patched = installCanvasIntercept();
    if (!THEME.patched) { return; }

    /* Two frames of headroom so the prototype's own boot render has
       certainly finished. Repainting on top of a half-built view would
       be harmless but wasteful. */
    requestAnimationFrame(function () {
      requestAnimationFrame(repaint);
    });

    /* Webfonts land after first paint. Canvas text is measured against
       whatever face was available at the moment it was drawn, so labels
       drawn before Inter arrives are laid out on a fallback and sit
       slightly wrong. One more repaint once the fonts are ready fixes
       the alignment. document.fonts is absent on older engines, which is
       why it is feature-checked rather than assumed. */
    if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
      document.fonts.ready.then(function () {
        try { window.dispatchEvent(new Event('resize')); } catch (e) {}
      }).catch(function () {});
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
