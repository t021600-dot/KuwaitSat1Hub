/* =====================================================================
   KuwaitSat-1 Mission Hub — theme layer, progressive enhancement only
   Owner: 01 Front-end.  Companion to css/ksat-theme.css.

   ---------------------------------------------------------------------
   WHY THIS FILE EXISTS AT ALL
   ---------------------------------------------------------------------
   The restyle layers work by re-declaring the page's CSS custom
   properties. That reaches everything drawn by the BROWSER.

   It does not reach anything drawn by JavaScript into a <canvas>,
   because a canvas is a bitmap: the drawing code passes colour and font
   as plain strings, and index.html has those strings hard-coded. The
   globe halo, the graticule, the orbit swath cone, the descent beam and
   the satellite sprite are all painted with a literal teal. Leave them
   and the page ends up with one accent in the CSS and a different one
   inside every chart, which looks broken rather than deliberate.

   We cannot edit index.html. So this file does the one thing CSS
   cannot: it intercepts the canvas colour and font properties and
   translates the handful of BRAND strings on their way through.

   ---------------------------------------------------------------------
   THE BUG THIS REWRITE FIXES                    21 September 2026
   ---------------------------------------------------------------------
   The translation table used to be a literal-to-literal map. It turned
   every hard-coded teal into #3D8BFF, the institutional blue an earlier
   pass had adopted.

   css/ksat-editorial.css then moved the accent BACK to teal — #2FBDB6,
   deepened so it separates from the vegetation ramp — and said why, at
   length, in its own header. Nobody came back here. The result on the
   live site: the page was teal and every canvas on it was blue. Thirty
   or so painted elements disagreeing with the stylesheet that was
   supposed to own them, and no error anywhere to say so.

   A literal that duplicates a token will drift away from it. It is only
   a question of which release. So the table is now DERIVED: it reads
   the live value of --accent-canvas off :root at boot and again
   whenever the theme changes, and every entry is computed from that one
   number. There is nothing left in this file to fall out of step.

   ---------------------------------------------------------------------
   WHY --accent-canvas AND NOT --accent
   ---------------------------------------------------------------------
   Four of the five colours below are painted onto scenes that are BLACK
   IN BOTH THEMES: the globe, the orbit diagram, the descent profile,
   the hero limb. Those are pictures of space, and css/ksat-nasa.css
   keeps them dark on a white page the way a printed journal keeps a
   plate dark. So the colour they want is not the page accent — which in
   light mode has to be dark enough to read on white, and would vanish
   against black — but an accent chosen for the canvas ground.
   css/ksat-nasa.css declares --accent-canvas for exactly that, and
   moves it with the theme. If that file is not loaded the lookup falls
   back to --accent, which is the correct brand teal anyway, so this
   file is useful on its own.

   ---------------------------------------------------------------------
   WHAT IT DELIBERATELY DOES NOT DO
   ---------------------------------------------------------------------
   · It does not touch imagery colour. The Earth, the ocean, the desert,
     the atmosphere, the rocket, the starfield and every data ramp
     (green vegetation, amber-red heat) are passed through untouched.
     Those are mission imagery and data — they already read correctly,
     and recolouring data would be a lie about the data.
   · It does not add, remove, reorder or rewrite any page content.
   · It does not change any animation, timing or behaviour.
   · If anything it depends on is missing, every step is skipped
     silently and the page behaves exactly as it did before.
   ===================================================================== */

(function () {
  'use strict';

  /* Refuse to install twice, however the file gets loaded. */
  if (window.KSAT_THEME) { return; }
  var THEME = window.KSAT_THEME = { patched: false, repainted: false, accent: null };

  /* -------------------------------------------------------------------
     1 · READING A LIVE TOKEN

     getComputedStyle on the document element returns whatever the
     cascade settled on, so this follows every restyle layer, every
     media query and :root[data-theme="light"] without knowing that any
     of them exist. It is called a handful of times per theme change and
     never inside a draw call, so the cost does not matter.
     ------------------------------------------------------------------- */
  function token(name, fallback) {
    try {
      var v = getComputedStyle(document.documentElement)
                .getPropertyValue(name);
      v = v ? v.trim() : '';
      return v || fallback;
    } catch (e) {
      return fallback;
    }
  }

  /* Accepts the three forms a token is realistically authored in. A
     token that is none of them returns null and the caller keeps its
     own default rather than painting something undefined. */
  function parseColour(value) {
    if (!value) { return null; }
    var v = String(value).trim();

    var m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(v);
    if (m) {
      var h = m[1];
      if (h.length === 3) {
        h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) +
            h.charAt(2) + h.charAt(2);
      }
      return [parseInt(h.slice(0, 2), 16),
              parseInt(h.slice(2, 4), 16),
              parseInt(h.slice(4, 6), 16)];
    }

    m = /^rgba?\(\s*([0-9.]+)[\s,]+([0-9.]+)[\s,]+([0-9.]+)/.exec(v);
    if (m) {
      return [Math.round(parseFloat(m[1])),
              Math.round(parseFloat(m[2])),
              Math.round(parseFloat(m[3]))];
    }
    return null;
  }

  function clamp255(n) { return n < 0 ? 0 : (n > 255 ? 255 : Math.round(n)); }

  function mix(from, to, amount) {
    return [clamp255(from[0] + (to[0] - from[0]) * amount),
            clamp255(from[1] + (to[1] - from[1]) * amount),
            clamp255(from[2] + (to[2] - from[2]) * amount)];
  }

  function toHex(c) {
    var out = '#';
    for (var i = 0; i < 3; i++) {
      var s = c[i].toString(16);
      out += (s.length === 1 ? '0' : '') + s;
    }
    return out;
  }

  var WHITE = [255, 255, 255];
  var BLACK = [0, 0, 0];

  /* -------------------------------------------------------------------
     2 · THE TRANSLATION TABLE, DERIVED

     Only brand / chrome colours appear here. Each entry says what the
     colour is used for in index.html, so it is obvious why it is safe
     to change — and equally obvious what is NOT in the list.

     The four relatives of the accent used to be four more literals.
     They are now computed from it, so a change to the brand moves all
     five together and the relationship between them — a lighter
     highlight, a paler label, a deeper gradient stop — is preserved at
     whatever hue the brand lands on.
     ------------------------------------------------------------------- */
  var COLOR_MAP = {};

  /* The same accent also appears 33 times as rgba(63,208,201,alpha) for
     halos, graticules, beams and cones. The alpha carries the design
     intent, so we keep whatever alpha was asked for and swap only the
     three channel values. */
  var OLD_RGB = '63,208,201';
  var NEW_RGB = OLD_RGB;

  function buildColourMap() {
    /* #2FBDB6 is css/ksat-editorial.css's accent, repeated here only as
       the value used when there is no stylesheet at all to read. */
    var raw = token('--accent-canvas', '') || token('--accent', '#2FBDB6');
    var base = parseColour(raw) || [47, 189, 182];

    COLOR_MAP = {
      /* globe halo + graticule, choropleth selection stroke, descent
         tick, orbit swath, satellite solar panels */
      '#3fd0c9': toHex(base),
      /* satellite body highlight, drawn five times across the page —
         a lift off the base, not a second colour */
      '#5fd6cf': toHex(mix(base, WHITE, 0.28)),
      /* descent caption line */
      '#4fd3cc': toHex(base),
      /* choropleth label fill: a pale tint of the same accent */
      '#8ff0ea': toHex(mix(base, WHITE, 0.60)),
      /* the hero gradient's cool stop, where it is drawn rather than
         styled — the deep end of the same ramp */
      '#22a9a3': toHex(mix(base, BLACK, 0.22))
    };

    NEW_RGB = base.join(',');
    THEME.accent = toHex(base);
  }

  /* -------------------------------------------------------------------
     3 · THE FONT, ALSO DERIVED

     This used to rewrite every canvas font string from IBM Plex Sans to
     Inter, as a literal, because a much earlier draft of the theme
     moved body text to Inter. Reading --body instead is still the right
     move, for the same reason the colour table is derived: a literal
     that duplicates a token drifts away from it.

     WHAT AN EARLIER DRAFT OF THIS COMMENT GOT WRONG, corrected here
     because a wrong reason is worse than no reason. It claimed that
     --body is IBM Plex Sans, that Inter is not loaded, and that this
     rewrite was therefore a no-op sending chart labels to Arial. All
     three are false, and one run in the browser says so:

       index.html:64        --body:"IBM Plex Sans",…   (head <style>)
       ksat-theme.css:61    --body:"Inter",…           (loads after it)

     Both are on :root, so the later sheet wins and the live value in
     English is Inter. And Inter IS loaded — ksat-theme.css:1 @imports
     it from Google Fonts alongside Noto Sans Arabic and Readex Pro, so
     document.fonts.check('12px Inter') is true. The rewrite is not a
     no-op: it runs, it moves every canvas label onto Inter, and Inter
     is what the body text around those labels is actually set in. It
     was doing the right thing for a reason that did not exist.

     WHY IT ALSO HAS TO FOLLOW THE LANGUAGE. ksat-theme.css:1463 moves
     --body to "IBM Plex Sans Arabic" for Arabic. This file used to
     rebuild the font map on ksat:theme only, so in Arabic the charts
     kept drawing their labels in Inter — a Latin face — and the Arabic
     glyphs fell through to whatever the operating system offered,
     which is the ungraceful canvas fallback this section is about.
     Worse, the first time the visitor touched the theme control the
     labels jumped to Plex Arabic mid-session for no reason they could
     see. Section 7b listens for ksat:lang as well, so the face follows
     the language the way the accent follows the theme.
     ------------------------------------------------------------------- */
  var FONT_FROM = /IBM Plex Sans/g;
  var FONT_TO = null;                 /* null means "leave fonts alone" */

  function buildFontMap() {
    var body = token('--body', '');
    var first = body.split(',')[0].trim().replace(/^['"]|['"]$/g, '');
    FONT_TO = (first && first !== 'IBM Plex Sans') ? first : null;
  }

  /* -------------------------------------------------------------------
     4 · THE TRANSLATOR

     This runs on every canvas colour write on the page, including inside
     60fps animation loops, so it has to be cheap. A Map memoises each
     distinct string the first time it is seen; after that the hot path
     is a single Map.get. The cache is capped because rampColor()
     generates a long tail of unique interpolated hexes.

     Colours and fonts get SEPARATE caches. They shared one before. No
     string has ever been used as both, so nothing was wrong on the
     page, but a shared cache keyed on a bare string between two
     unrelated translations is a trap waiting for whoever adds the third
     one.
     ------------------------------------------------------------------- */
  var colourCache = new Map();
  var fontCache = new Map();

  function translate(value) {
    // Gradients and patterns are objects, not strings. Pass straight through.
    if (typeof value !== 'string') { return value; }

    var hit = colourCache.get(value);
    if (hit !== undefined) { return hit; }

    var out = value;
    var lower = value.toLowerCase();

    if (COLOR_MAP[lower]) {
      out = COLOR_MAP[lower];
    } else if (lower.indexOf(OLD_RGB) !== -1) {
      out = value.replace(OLD_RGB, NEW_RGB);
    }

    if (colourCache.size > 600) { colourCache.clear(); }
    colourCache.set(value, out);
    return out;
  }

  function translateFont(value) {
    if (FONT_TO === null) { return value; }
    if (typeof value !== 'string' || value.indexOf('IBM Plex Sans') === -1) {
      return value;
    }
    var hit = fontCache.get(value);
    if (hit !== undefined) { return hit; }
    var out = value.replace(FONT_FROM, FONT_TO);
    if (fontCache.size > 300) { fontCache.clear(); }
    fontCache.set(value, out);
    return out;
  }

  /* -------------------------------------------------------------------
     5 · INSTALLING THE INTERCEPT

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
     6 · REPAINTING

     Installing the intercept changes nothing that is already on screen —
     a canvas keeps whatever bitmap it was last given. Something has to
     ask the page to draw again.

     renderAll() is the prototype's own full render, defined in the
     inline script in index.html and called at boot from applyLang(). It
     rebuilds every view purely from the state object S, which is why it
     is also what js/ksat-i18n.js calls on every language switch — so it
     is already proven safe to run mid-session with work in progress.

     Everything is wrapped: if renderAll is absent or throws, we fall
     back to a resize event, which the page already listens for and
     which redraws every canvas. If that is unavailable too, we simply
     stop — the canvases keep their original colours and nothing breaks.
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
     7 · FOLLOWING THE THEME

     js/ksat-appearance.js flips html[data-theme] and then fires
     ksat:theme on the document. At that moment the CSS has already
     changed — the browser applied it in the same task — so re-reading
     the tokens here gives the new values straight away.

     The caches MUST be cleared before the repaint. They are keyed on the
     source string, so every colour the page asks for a second time
     would otherwise come back with the previous theme's answer and the
     charts would simply not change.
     ------------------------------------------------------------------- */
  function refresh() {
    buildColourMap();
    buildFontMap();
    colourCache.clear();
    fontCache.clear();
    repaint();
  }
  THEME.refresh = refresh;

  /* -------------------------------------------------------------------
     7b · FOLLOWING THE LANGUAGE

     js/ksat-i18n.js sets html[lang] and html[dir], calls the page's own
     applyLang (which calls renderAll and so repaints every canvas), and
     only THEN fires ksat:lang. So by the time we hear about it the
     charts have already been redrawn — with the previous face, because
     the font map was built at boot and nothing had rebuilt it.

     Hence the repaint below rather than a quiet cache clear. It is
     guarded on the face actually changing, so EN to AR pays for one
     extra render and nothing else does: same-face language changes, and
     the theme changes that come through refresh() above, fall straight
     through. Colours are deliberately not touched here — a language is
     not a theme, and --accent-canvas has not moved.
     ------------------------------------------------------------------- */
  function refreshFont() {
    var before = FONT_TO;
    buildFontMap();
    if (FONT_TO === before) { return; }
    fontCache.clear();
    repaint();
  }
  THEME.refreshFont = refreshFont;

  /* -------------------------------------------------------------------
     8 · BOOT

     Order matters: read the tokens, install the intercept, then repaint,
     or the repaint would draw the old colours.
     ------------------------------------------------------------------- */
  function boot() {
    buildColourMap();
    buildFontMap();

    THEME.patched = installCanvasIntercept();
    if (!THEME.patched) { return; }

    /* Two frames of headroom so the prototype's own boot render has
       certainly finished. Repainting on top of a half-built view would
       be harmless but wasteful. */
    requestAnimationFrame(function () {
      requestAnimationFrame(repaint);
    });

    document.addEventListener('ksat:theme', refresh);
    document.addEventListener('ksat:lang', refreshFont);

    /* Webfonts land after first paint. Canvas text is measured against
       whatever face was available at the moment it was drawn, so labels
       drawn before the family arrives are laid out on a fallback and sit
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
