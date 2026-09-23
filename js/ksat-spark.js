/* =====================================================================
   ksat-spark.js - A TICK OF LIGHT WHERE THE RESEARCHER CLICKS
   Owner: 01 Front end

   A small ring of light at the point of every click. It is feedback,
   not decoration: on a dense instrument panel where a click may take a
   second to produce anything visible, it answers "did that register?"
   before the answer arrives.

   >>> IT MUST BE VISIBLE WITHOUT MOTION <<<
   This is the constraint that decides the implementation. Windows
   animation settings are OFF on the machine this is built for, and the
   automated browser tab runs HIDDEN, where requestAnimationFrame never
   fires. A spark built the usual way - a CSS keyframe that scales and
   fades - would be invisible to the one person it is for, twice over.

   So the ring is DRAWN AT FULL STRENGTH the moment it is placed, and a
   setTimeout removes it. Under reduced motion that is the whole effect
   and it works: a ring appears and goes. When motion is allowed, a CSS
   transition is added on the next tick so it also expands and fades.
   The transition is the enhancement; the appearing is the feature.

   >>> IT NEVER INTERCEPTS A CLICK <<<
   pointer-events:none on the layer and on every ring. A feedback
   effect that eats the second click of a double click, or lands on top
   of a Leaflet drag, would be worse than no feedback at all. It listens
   on pointerdown in the CAPTURE phase so it fires even where a handler
   stops propagation, and it never calls preventDefault.

   >>> IT IS CAPPED <<<
   A researcher dragging a map fires pointerdown once, but an
   impatient one clicking a slow button fires several. MAX rings are
   kept; the oldest is removed first. An unbounded effect layer is a
   memory leak with a nice colour.
   ===================================================================== */

(function () {
  'use strict';

  var KS = window.KSAT = window.KSAT || {};
  var doc = document;

  var LIFE_MS = 420;   /* how long a ring stays before it is removed */
  var MAX = 6;         /* rings alive at once */

  var layer = null;
  var live = [];

  function reduced() {
    /* Read at call time, not cached: somebody can change the OS
       setting without reloading the page. */
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) { return false; }
  }

  function ensureLayer() {
    if (layer && layer.parentNode) { return layer; }
    layer = doc.createElement('div');
    layer.className = 'ksat-spark-layer';
    layer.setAttribute('aria-hidden', 'true');
    doc.body.appendChild(layer);
    return layer;
  }

  function spark(x, y) {
    var host = ensureLayer();

    var ring = doc.createElement('span');
    ring.className = 'ksat-spark';
    ring.style.left = Math.round(x) + 'px';
    ring.style.top = Math.round(y) + 'px';
    host.appendChild(ring);

    live.push(ring);
    while (live.length > MAX) { drop(live.shift()); }

    if (!reduced()) {
      /* The class that carries the transition is added on a LATER TICK
         than the one that inserted the node. Added in the same tick the
         browser may coalesce the two styles and never transition at
         all, which is the classic way this effect silently does
         nothing. setTimeout, not requestAnimationFrame: rAF does not
         fire in a hidden tab and the ring would then never grow. */
      setTimeout(function () { ring.classList.add('go'); }, 16);
    }

    setTimeout(function () {
      var i = live.indexOf(ring);
      if (i >= 0) { live.splice(i, 1); }
      drop(ring);
    }, LIFE_MS);
  }

  function drop(n) {
    if (n && n.parentNode) { n.parentNode.removeChild(n); }
  }

  /* CAPTURE PHASE, so a handler that stops propagation - and this page
     has several, including the delegated nav - does not swallow the
     feedback for the click that most needs it. */
  function onDown(e) {
    if (e.button !== undefined && e.button !== 0) { return; }
    /* A synthesised click has no coordinates worth drawing at. */
    if (!e.clientX && !e.clientY) { return; }
    spark(e.clientX, e.clientY);
  }

  function mount() {
    if (doc.body._ksatSparkWired) { return; }
    doc.body._ksatSparkWired = true;
    doc.addEventListener('pointerdown', onDown, true);
  }

  KS.spark = { at: spark };

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
