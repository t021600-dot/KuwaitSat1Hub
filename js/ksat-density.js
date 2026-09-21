/* =====================================================================
   ksat-density.js — LET THE PAGE BREATHE
   Owner: 01 Front End, with 03 Security (nothing may be removed)

   THE BRIEF
   "The page shouldn't be too overwhelming with text but visuals and
   everything important" — and, from the same team, "make sure not to
   remove any content."

   Those pull in opposite directions only if you treat the choice as
   keep-or-delete. It isn't. The fix is PROGRESSIVE DISCLOSURE: a long
   passage shows its first two or three lines and opens on request. The
   words are all still in the DOM, still findable by Ctrl+F, still read
   aloud in order by a screen reader, still printed in full. What
   changes is how much of it arrives at once.

   WHY THIS IS NOT A COSMETIC CHOICE
   This page carries a lot of honest hedging — where a figure came from,
   what it does not claim, who must review it. That writing is the
   integrity of the product and deleting it would be the one genuinely
   dishonest edit available to us. So it stays, and the SUMMARY LINE
   stays visible; only the elaboration folds.

   WHAT IS DELIBERATELY LEFT ALONE
   - Anything inside a figure, table, chart, canvas or badge.
   - Any paragraph under the threshold; short text is not the problem.
   - The legend, which IS the provenance key and has to be read.
   - Headings, captions, labels and controls.
   ===================================================================== */

(function () {
  'use strict';

  var KS = window.KSAT = window.KSAT || {};
  if (KS.density) return;

  /* A paragraph shorter than this was never the problem. Chosen by
     measuring: at the page's measure, ~340 characters is about four
     lines, which is where a block starts reading as a wall. */
  var LONG = 340;

  /* Never touch text living inside these. */
  var KEEP_WHOLE = [
    '#legend', '.legcell',              /* the provenance key            */
    'figure', 'figcaption', 'table',
    '.badge', '.chip', '.chips',
    '.cmplab', '.exhud',                /* readouts over canvases        */
    'nav', '.bar', 'button', 'a',
    '#ksat-as-panel', '.ksat-invite',   /* our own layers                */
    '.ksat-wf', '#ksat-wf',
    '.ag-p', '.dstep', '.demopan'       /* the guided tour narrates      */
  ].join(',');

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function reduced() {
    try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  var n = 0;

  function fold(p) {
    if (p.dataset.ksatFolded) return;
    if (p.closest(KEEP_WHOLE)) return;
    var text = (p.textContent || '').trim();
    if (text.length < LONG) return;

    /* Skip anything that is mostly markup rather than prose — a
       paragraph of links or badges is a control strip, not a wall. */
    if (p.querySelectorAll('a,button,span.badge').length > 3) return;

    p.dataset.ksatFolded = '1';
    p.classList.add('ksat-fold');

    var id = 'ksat-fold-' + (++n);
    p.id = p.id || id;

    var btn = el('button', 'ksat-fold-more');
    btn.type = 'button';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', p.id);
    btn.appendChild(el('span', 'ksat-fold-word', 'Read more'));

    btn.addEventListener('click', function () {
      var open = p.classList.toggle('ksat-fold-open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.querySelector('.ksat-fold-word').textContent = open ? 'Show less' : 'Read more';
      if (!open) {
        /* Collapsing far down a long passage leaves the reader nowhere.
           Bring the head of it back into view. */
        var top = p.getBoundingClientRect().top;
        if (top < 0) p.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' });
      }
    });

    p.insertAdjacentElement('afterend', btn);
  }

  /* Ctrl+F finds text inside a collapsed block; the browser then tells
     us, and we open it rather than scrolling to something invisible.
     Supported where `hidden=until-found` and beforematch exist; a
     no-op elsewhere, which is a fine degradation. */
  function wireFind() {
    document.addEventListener('beforematch', function (e) {
      var p = e.target && e.target.closest && e.target.closest('.ksat-fold');
      if (!p || p.classList.contains('ksat-fold-open')) return;
      p.classList.add('ksat-fold-open');
      var b = p.nextElementSibling;
      if (b && b.classList.contains('ksat-fold-more')) {
        b.setAttribute('aria-expanded', 'true');
        b.querySelector('.ksat-fold-word').textContent = 'Show less';
      }
    }, true);
  }

  function run() {
    var sel = 'section.sec p.lede, section.sec p.sub, section.sec .finale-note, section.sec .warn p, section.sec .note p';
    var list = document.querySelectorAll(sel);
    for (var i = 0; i < list.length; i++) fold(list[i]);
    KS.density = { folded: n };
    try {
      document.documentElement.setAttribute('data-ksat-density', 'on');
    } catch (e) {}
  }

  function boot() {
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (document.querySelector('section.sec p.lede') || tries > 60) {
        clearInterval(iv);
        wireFind();
        run();
      }
    }, 120);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
