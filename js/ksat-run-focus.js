/* =====================================================================
   ksat-run-focus.js - one run at a time
   Owner: 01 Front End

   Opening a run used to leave the whole card grid of every other run
   sitting above it, with its search box, so the reader scrolled past
   thirteen summaries to reach the one they had just chosen. Asked to be
   taken off: while a run is open, the list is not on the page.

   WHY AN OBSERVER AND NOT TWO LINES IN THE CLICK HANDLER.
   js/ksat-researcher.js hides #missionDetail from at least three
   places: the Close button, the Escape key, and a refresh that reopens
   whichever run was showing. A pair of statements in openMission() and
   in the close case would be correct on the day it was written and
   wrong the first time somebody adds a fourth way out - and the failure
   mode is a reader who closes a run and finds the list gone, with no
   way back except a reload.

   So the state is READ rather than written in two places. The panel's
   own `hidden` attribute is the single source of truth, and the list
   follows it.

   THE LIST IS HIDDEN, NOT REMOVED. Its scroll position, its search box
   contents and every card in it survive, because hidden is a display
   switch and not a DOM edit. Close the run and the list is exactly as
   it was left.
   ===================================================================== */
(function (w, doc) {
  'use strict';

  var KS = w.KSAT = w.KSAT || {};
  if (KS.runFocus) { return; }

  var DETAIL = 'missionDetail';
  var TABLE = 'missionTable';

  function listCard() {
    var t = doc.getElementById(TABLE);
    /* The card wrapper, not the grid: the search box is its sibling and
       has to go with it. closest() rather than parentNode so a future
       wrapper between the two does not silently leave the search box on
       screen on its own. */
    return t ? t.closest('.card') : null;
  }

  function sync() {
    var d = doc.getElementById(DETAIL);
    var list = listCard();
    if (!d || !list) { return; }
    var open = !d.hidden;
    if (list.hidden === open) { return; }      /* already right */
    list.hidden = open;
  }

  function start() {
    var d = doc.getElementById(DETAIL);
    if (!d) { return false; }

    sync();
    new MutationObserver(sync).observe(d, {
      attributes: true, attributeFilter: ['hidden']
    });

    KS.runFocus = { sync: sync };
    return true;
  }

  /* The panel is in the static markup, but this file can load before
     the page has finished parsing, so poll briefly rather than assume.
     Same shape as the other modules here. */
  function boot() {
    if (start()) { return; }
    var tries = 0;
    var iv = setInterval(function () {
      if (start() || ++tries > 60) { clearInterval(iv); }
    }, 120);
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}(window, document));
