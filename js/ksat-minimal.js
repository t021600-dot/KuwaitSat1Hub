/* =====================================================================
   ksat-minimal.js — THE PUBLIC MASTHEAD, IN THE NASA SHAPE
   Companion to css/ksat-minimal.css. Owner: 01 Front End.

   THE BRIEF, in the team's own words: "i want the page to be super
   minimalist, dont show a lot of details to the outsider", "the page
   should look like nasa from the top exactly", "the top panel like nasa
   exactly stays dark in day mode and dark mode".

   WHAT nasa.gov'S MASTHEAD ACTUALLY IS, since "like NASA" has to mean
   something specific to be buildable: one slim black row. On the left
   the word Explore with a circled chevron, then a plain outlined search
   field. Dead centre, the agency emblem, with no words beside it. On
   the right two or three menu words. That is the whole of it — no
   second row, no counts, no badges. It is black on every page at every
   hour, and the reader's colour preference changes the page beneath it
   and never the bar.

   ---------------------------------------------------------------------
   THIS FILE MOVES FOUR NODES AND CREATES TWO. IT REBUILDS NOTHING.
   ---------------------------------------------------------------------
   js/ksat-nav.js already derives six groups from the chapters that
   js/ksat-shell.js owns — brief / space / intel / planning / agents /
   record — with Arabic names, membership, lock counts, popovers and
   keyboard handling. Building a second Explore menu here would be a
   second taxonomy over the same twenty-three sections, which is the
   exact mistake that file's own header warns about. So the strip that
   already holds those six triggers BECOMES the drawer, and one new
   button opens it. The triggers keep their popovers, their counts,
   their relabelling on ksat:lang and their Escape handling, because
   they are the same elements in the same parent with the same
   listeners still attached.

   EVERYTHING HERE IS PUBLIC-TIER ONLY and is undone on sign-in. A
   researcher's masthead is the two-row one, because a researcher is
   navigating twenty-three working sections rather than being
   introduced to a satellite.
   ===================================================================== */

(function () {
  'use strict';

  var KS = window.KSAT = window.KSAT || {};
  if (KS.minimal) return;

  var root = document.documentElement;

  /* Strings live here rather than in js/ksat-i18n.js because they belong
     to a layer that layer knows nothing about. Same shape as the rest. */
  var TXT = {
    explore: { en: 'Explore',                    ar: 'استكشف' },
    exploreA:{ en: 'Explore the platform',       ar: 'استكشف المنصة' },
    brand:   { en: 'KuwaitSat Green Intelligence — back to the top',
               ar: 'كويت سات — الذكاء البيئي — العودة إلى الأعلى' },
    seal:    { en: 'KuwaitSat Vision',           ar: 'كويت سات فيجن' }
  };
  function isRTL() { return root.getAttribute('dir') === 'rtl'; }
  function t(k) { var o = TXT[k]; return (isRTL() && o.ar) ? o.ar : o.en; }

  function el(tag, cls) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }
  function isPublic() {
    return (root.getAttribute('data-ksat-tier') || 'public') !== 'insider';
  }

  /* ===================================================================
     1 · THE SEAL

     The bar carried a 26px vector redrawing of the emblem plus a
     two-line wordmark. The team asked for the real thing. The emblem
     already contains its own wordmark inside the ring, so setting the
     lockup beside it prints the name twice — css/ksat-minimal.css hides
     the vector and the words, and this puts the seal in their place.

     Hiding the words costs #brandBtn its accessible name, which is the
     kind of thing that gets missed until somebody runs a screen reader
     over it. So the button is given one explicitly, and it is refreshed
     on ksat:lang along with everything else.
     =================================================================== */
  var seal = null, brandBtn = null;

  function buildSeal() {
    brandBtn = document.getElementById('brandBtn') ||
               document.querySelector('.bar .brand');
    if (!brandBtn || seal) return;

    seal = el('img', 'ksat-min-seal');
    seal.src = 'assets/brand/ksat-emblem-256.png';
    seal.width = 256; seal.height = 256;
    seal.alt = '';                       /* decorative: the button carries the name */
    seal.setAttribute('aria-hidden', 'true');
    seal.decoding = 'async';
    brandBtn.insertBefore(seal, brandBtn.firstChild);
  }

  /* ===================================================================
     2 · EXPLORE, AND THE ONE NODE THAT HAS TO MOVE

     js/ksat-nav.js appends its search control as the last child of the
     strip. The strip is about to become a drawer that is closed by
     default, and a search box you cannot see is not a search box — so
     that single button is re-parented up to #ksat-nav, where it sits
     beside Explore exactly as nasa.gov places it.

     Nothing in js/ksat-nav.js reads that button's parent: it measures
     with getBoundingClientRect, reaches it through a held reference,
     and its click-outside guard asks whether #ksat-nav contains the
     event target — which is still true one level up. Checked all three
     before moving it.
     =================================================================== */
  var exploreBtn = null, strip = null, findBtn = null, findHome = null;

  function buildExplore() {
    var nav = document.getElementById('ksat-nav');
    if (!nav || exploreBtn) return false;

    strip = nav.querySelector('.ksat-nav-strip');
    if (!strip) return false;            /* ksat-nav.js has not built yet */

    strip.classList.add('ksat-min-drawer');

    findBtn = strip.querySelector('.ksat-nav-find');
    if (findBtn) {
      findHome = findBtn.parentNode;     /* remembered, so sign-in can put it back */
      nav.appendChild(findBtn);
    }

    exploreBtn = el('button', null);
    exploreBtn.id = 'ksat-min-explore';
    exploreBtn.type = 'button';
    exploreBtn.setAttribute('aria-expanded', 'false');
    exploreBtn.setAttribute('aria-controls', strip.id || (strip.id = 'ksat-min-drawer'));

    var label = el('span', 'ksat-min-explore-t');
    label.textContent = t('explore');
    var chev = el('span', 'ksat-min-chev');
    chev.setAttribute('aria-hidden', 'true');
    exploreBtn.appendChild(label);
    exploreBtn.appendChild(chev);
    exploreBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      setOpen(exploreBtn.getAttribute('aria-expanded') !== 'true');
    });

    nav.insertBefore(exploreBtn, nav.firstChild);
    return true;
  }

  function setOpen(on) {
    if (!exploreBtn) return;
    exploreBtn.setAttribute('aria-expanded', on ? 'true' : 'false');
    if (on) root.setAttribute('data-ksat-min-explore', 'open');
    else    root.removeAttribute('data-ksat-min-explore');
  }

  /* Escape closes, and so does a click anywhere outside. Both are
     registered ONCE, on document, and both stand down when the drawer
     is already shut — the page has five other things bound to Escape
     (the intro, the tour, the assistant, the chapter sheet, the nav's
     own popovers) and the way they coexist is that each refuses to act
     unless it is the thing actually open. */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!root.hasAttribute('data-ksat-min-explore')) return;
    setOpen(false);
    if (exploreBtn) exploreBtn.focus();
  });
  document.addEventListener('click', function (e) {
    if (!root.hasAttribute('data-ksat-min-explore')) return;
    var nav = document.getElementById('ksat-nav');
    if (nav && nav.contains(e.target)) return;
    setOpen(false);
  });

  /* ===================================================================
     3 · APPLY, AND UNDO ON SIGN-IN

     The tier is the shell's, derived from the Supabase session and from
     nothing else. This layer only reads it.
     =================================================================== */
  function relabel() {
    if (exploreBtn) {
      var l = exploreBtn.querySelector('.ksat-min-explore-t');
      if (l) l.textContent = t('explore');
      exploreBtn.setAttribute('aria-label', t('exploreA'));
    }
    if (brandBtn) brandBtn.setAttribute('aria-label', t('brand'));
    if (seal) seal.setAttribute('data-name', t('seal'));
  }

  function toInsider() {
    /* Put the search back where ksat-nav.js left it and close the
       drawer, so the researcher's two-row bar is the one that file
       built, untouched. The seal and the Explore button stay in the
       DOM and are hidden by the stylesheet's tier scope — removing
       them would mean rebuilding on every sign-out. */
    setOpen(false);
    if (findBtn && findHome && findBtn.parentNode !== findHome) findHome.appendChild(findBtn);
  }
  function toPublic() {
    if (findBtn && findHome && findBtn.parentNode === findHome) {
      var nav = document.getElementById('ksat-nav');
      if (nav) nav.appendChild(findBtn);
    }
  }

  function apply() {
    if (isPublic()) toPublic(); else toInsider();
    relabel();
  }

  /* ===================================================================
     4 · START

     js/ksat-nav.js builds its strip on DOMContentLoaded and rebuilds it
     whenever index.html's own renderNav() wipes the nav — which it does
     on every language switch. A MutationObserver is the only reliable
     hook: this file does not own that function and must not fight it
     for ownership. The same lesson is written up at length in
     js/ksat-shell.js, which lost a whole feature to it once.
     =================================================================== */
  function boot() {
    buildSeal();
    if (!buildExplore()) return false;
    apply();
    return true;
  }

  function watch() {
    var nav = document.getElementById('ksat-nav');
    if (!nav || typeof MutationObserver === 'undefined') return;
    new MutationObserver(function () {
      if (document.getElementById('ksat-min-explore')) return;   /* still ours */
      exploreBtn = null; strip = null; findBtn = null; findHome = null;
      boot();
    }).observe(nav, { childList: true });
  }

  function start() {
    if (!boot()) {
      /* ksat-nav.js has not reached its strip yet. Watch for it rather
         than guessing at a delay. */
      var mo = new MutationObserver(function () {
        if (boot()) { mo.disconnect(); watch(); }
      });
      mo.observe(document.body, { childList: true, subtree: true });
      setTimeout(function () { mo.disconnect(); if (boot()) watch(); }, 4000);
      return;
    }
    watch();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  document.addEventListener('ksat:lang', function () { setTimeout(relabel, 0); });
  document.addEventListener('ksat:identity', apply);

  KS.minimal = { setOpen: setOpen, apply: apply };
})();
