/* =====================================================================
   ksat-motion.js — SCROLL TRANSITIONS
   Owner: 01 Front End

   Agency pages reveal as you scroll. It is not decoration: on a long
   editorial page it tells you where one idea ends and the next begins,
   and it stops a screenful of dense type arriving all at once.

   THE RULES
   · IntersectionObserver, never a scroll handler. A scroll listener on
     a page with 26 canvases is a dropped-frame machine.
   · Each element is revealed ONCE and then unobserved. Elements that
     re-animate every time you scroll past are the single most common
     way this effect becomes irritating.
   · Reveal is opacity and a 12px rise. Nothing scales, nothing slides
     sideways, nothing rotates — those read as a template.
   · Content is VISIBLE BY DEFAULT. The hidden state is applied by this
     script, so if the script fails, or JavaScript is off, or the
     observer is unsupported, the page is simply the page. Never hide
     content in CSS and rely on JS to bring it back.
   · prefers-reduced-motion disables the whole thing, and the above
     means "disabled" is the correct rendering rather than a fallback.
   ===================================================================== */

(function () {
  'use strict';

  var KS = window.KSAT = window.KSAT || {};
  if (KS.motion) return;

  function reduced() {
    try { return matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (e) { return false; }
  }

  /* No observer, or the reader asked for no motion: do nothing at all.
     The page is already correct without us. */
  if (reduced() || typeof IntersectionObserver === 'undefined') {
    KS.motion = { active: false, reason: reduced() ? 'reduced-motion' : 'no IntersectionObserver' };
    return;
  }

  var SELECTOR = [
    'section.sec > .eyebrow',
    'section.sec > h2',
    'section.sec > h3',
    'section.sec > p',
    'section.sec > .lede',
    'section.sec > .sub',
    'section.sec > .grid',
    'section.sec > .panel',
    'section.sec > .mt',
    'section.sec > table',
    '.capcard',
    '.tile',
    '.kpi'
  ].join(',');

  var io = null;
  var counted = 0;

  function reveal(el, delay) {
    el.style.transitionDelay = delay + 'ms';
    el.setAttribute('data-ksat-in', '');
  }

  function observe(root) {
    var list = (root || document).querySelectorAll(SELECTOR);
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (el.hasAttribute('data-ksat-reveal')) continue;
      /* Anything already on screen when we start must not animate —
         it would flash. Mark it revealed and move on. */
      var r = el.getBoundingClientRect();
      if (r.top < innerHeight && r.bottom > 0) {
        el.setAttribute('data-ksat-reveal', '');
        el.setAttribute('data-ksat-in', '');
        continue;
      }
      el.setAttribute('data-ksat-reveal', '');
      io.observe(el);
      counted++;
    }
    KS.motion.observed = counted;
  }

  io = new IntersectionObserver(function (entries) {
    /* Stagger by position within this batch, so a row of cards arrives
       as a row rather than as one block. Capped, because a long stagger
       on a fast scroll means waiting for content you are already
       looking at. */
    var shown = 0;
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      reveal(e.target, Math.min(shown * 45, 180));
      shown++;
      io.unobserve(e.target);            /* once, and only once */
    });
  }, {
    /* Fire a little before the element reaches the viewport, so the
       movement is finished by the time it is properly in view. */
    rootMargin: '0px 0px -8% 0px',
    threshold: 0.01
  });

  KS.motion = { active: true, observed: 0 };

  function start() {
    document.documentElement.setAttribute('data-ksat-motion', 'on');
    observe(document);

    /* Chapters swap which sections are in flow, and the tier reveals ten
       more. Both produce elements that have never been observed. */
    document.addEventListener('ksat:chapter', function () { setTimeout(observe, 60); });
    document.addEventListener('ksat:identity', function () { setTimeout(observe, 60); });
    /* Language switching re-renders most of the page. */
    document.addEventListener('ksat:lang', function () { setTimeout(observe, 120); });
  }

  function boot() {
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (document.querySelector('section.sec') || tries > 60) { clearInterval(iv); start(); }
    }, 120);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
