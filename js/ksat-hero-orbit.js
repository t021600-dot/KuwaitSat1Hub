/* =====================================================================
   ksat-hero-orbit.js — PULL THE CAMERA BACK OFF THE SPACECRAFT
   Owner: 01 Front End.  Companion to css/ksat-hero-orbit.css.

   "i want our satlight in here to be little zoomed out and moves around
   earth just like that".

   The travel is the stylesheet's, for the reasons written at the top of
   it. This file does one thing: it asks the renderer for a wider shot,
   and it keeps the pass from fighting a finger.

   ---------------------------------------------------------------------
   WHY THIS IS NOT AN EDIT TO js/ksat-cubesat.js
   ---------------------------------------------------------------------
   That file already publishes the control this needs —

       KSAT.cubesat.view(ry, rx, zoom)

   — and it already re-derives its focal length from V.zoom on every
   resize, so a value set once here survives every reflow without this
   file listening for anything. Editing the literal in that file would
   also move the spacecraft in #descent, which is a different shot with
   a different job. The API is the seam; use the seam.

   ---------------------------------------------------------------------
   0.62, AND HOW IT WAS ARRIVED AT
   ---------------------------------------------------------------------
   Measured at a 1424x630 viewport, tier public. At V.zoom = 1 the model
   stood 330px tall inside a 391px stage — 84% of the frame, with the
   antennas leaving it on both sides. That is a portrait of a CubeSat,
   and the brief asks for a spacecraft in orbit, which is a smaller thing
   in a bigger sky.

   0.62 brings it to roughly 205px, just over half the stage, which
   leaves the antennas inside the frame at every point of the pass and
   leaves sky above the limb for the pass to happen in. It is a shot,
   not a diagram.

   ---------------------------------------------------------------------
   THE ONE THING THAT HAS TO BE WAITED FOR
   ---------------------------------------------------------------------
   js/ksat-cubesat.js mounts on its own schedule — it waits for the
   public tier and for .hero-sat to exist. So this file cannot call the
   API at boot and assume. It polls briefly, then gives up quietly: a
   hero that never mounted a spacecraft is a hero with no spacecraft to
   zoom out, and that is not an error this layer should announce.
   ===================================================================== */

(function () {
  'use strict';

  var KS = window.KSAT = window.KSAT || {};
  if (KS.heroOrbit) { return; }
  KS.heroOrbit = true;

  var ZOOM = 0.62;
  var TRIES = 60;            /* ~9s at 150ms — mount is normally <1s */
  var EVERY = 150;

  function stage() {
    return document.querySelector('.hero-sat .ksat-cs');
  }

  /* ------------------------------------------------------------------
     A pass that keeps moving under a finger reads as the page fighting
     back. js/ksat-cubesat.js already has its own drag handling and its
     own idle timer that resumes the model's rotation; this mirrors that
     on the figure so the stylesheet can pause the travel, and it uses
     the same resume delay so the two restart together rather than one
     after the other.
     ------------------------------------------------------------------ */
  var RESUME_MS = 2600;
  var idle = 0;

  function hold(fig) {
    fig.setAttribute('data-ksat-held', '');
    if (idle) { clearTimeout(idle); idle = 0; }
  }
  function release(fig) {
    if (idle) { clearTimeout(idle); }
    idle = setTimeout(function () {
      fig.removeAttribute('data-ksat-held');
      idle = 0;
    }, RESUME_MS);
  }

  function wire(fig) {
    /* pointerdown on the figure, pointerup on the window: a drag that
       ends outside the figure still has to release it, and it usually
       does end outside — the model is small and the gesture is not. */
    fig.addEventListener('pointerdown', function () { hold(fig); });
    window.addEventListener('pointerup', function () { release(fig); });
    window.addEventListener('pointercancel', function () { release(fig); });

    /* The arrow keys turn the model too. Same treatment. */
    fig.addEventListener('keydown', function (e) {
      if (e.key && e.key.indexOf('Arrow') === 0) { hold(fig); }
    });
    fig.addEventListener('keyup', function (e) {
      if (e.key && e.key.indexOf('Arrow') === 0) { release(fig); }
    });
    fig.addEventListener('blur', function () { release(fig); });
  }

  function apply() {
    var cs = KS.cubesat;
    var fig = stage();
    if (!cs || typeof cs.view !== 'function' || !fig) { return false; }
    cs.view(undefined, undefined, ZOOM);
    wire(fig);
    return true;
  }

  function boot() {
    if (apply()) { return; }
    var left = TRIES;
    var t = setInterval(function () {
      if (apply() || --left <= 0) { clearInterval(t); }
    }, EVERY);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}());
