/* =====================================================================
   ksat-steps-fold.js — SUMMARY FIRST, DETAIL ON DEMAND
   Owner: 01 Front End

   THE PROBLEM THIS SOLVES. Every agent step row was permanently
   expanded. One row could carry the role name, a monospace tool name,
   a multi-line refusal reason quoted verbatim out of PostgREST, an
   italic gloss of 25 to 40 words, an injection warning and a
   timestamp — five stacked 11px blocks. A healthy run writes six or
   more rows including two designed refusals, so the card became a wall
   of small technical text with no way to collapse it, running well past
   the fold. That is fine for the person who wrote it and hostile to a
   judge seeing it for the first time.

   So: a clean status word by default, and a button that opens the rest.

   WHAT THIS FILE DOES NOT DO, ON PURPOSE:

   It does not touch stepRow(). It does not touch refreshTrace()'s
   select. It does not change what any agent computes, logs or refuses.
   It adds no database read. Everything below is derived from DOM that
   is already on the screen. The audit trail is unchanged; this is a
   lid, not an edit.

   TWO THINGS THAT WILL BREAK IT IF YOU FORGET THEM
   ------------------------------------------------------------------
   1 · THE ROW IS A THREE COLUMN GRID.
       .step { grid-template-columns:22px 1fr auto } — see
       css/ksat-workspace.css. Appending the toggle or the detail box
       as a direct child of .step silently creates a fourth implicit
       column and misaligns every row on the page. Both new nodes go
       INSIDE row.children[1], the middle cell.

   2 · THE TRACE IS DESTROYED AND REBUILT ON EVERY TICK.
       refreshTrace() does clear(box) then re-appends fresh stepRow()
       output several times per run. So this cannot run once: it runs
       from a MutationObserver, and it has to remember which rows were
       open or a row the viewer just opened snaps shut half a second
       later. That memory is OPEN, keyed on run id plus row number.

   WHY "held" MAPS TO COMPLETED AND NOT TO "REQUIRES REVIEW"
   ------------------------------------------------------------------
   This is the one genuinely contentious line in the file, so it is
   argued here rather than left to be discovered.

   refusalKind() in js/ksat-researcher.js sorts a refused step into
   held (the floor did its job), nodata (nothing to measure) and fault
   (something went wrong). The comments there and in
   css/ksat-workspace.css both argue at length that a held refusal is
   this platform's STRONGEST evidence — the system declining to claim
   something it cannot support — and that painting it like a failure is
   "the single most misleading thing on this page". The colour bug was
   fixed once already.

   Mapping held to "Requires Review" would reintroduce exactly that bug
   in words instead of colour. held is a completed step. Only nodata and
   fault ask a human for anything.

   And the original word is never destroyed: SCREENED, NO EVIDENCE,
   BELOW FLOOR or REFUSED is preserved as the first line inside the
   fold, one click away, so the row still says precisely what the
   database recorded.
   ===================================================================== */
(function (w, doc) {
  'use strict';

  var KS = w.KSAT = w.KSAT || {};
  if (KS.stepsFold) { return; }

  var TRACE_ID = 'trace';
  var SRC_ID = 'traceSrc';
  var MARK = 'ksatSf';

  /* Which rows the viewer has opened, so a rebuild does not close them.
     Keyed "<run id>#<row number>". Row order is order('started_at') and
     append-only, so the number is stable for the life of a run. */
  var OPEN = {};

  function el(tag, cls, txt) {
    var n = doc.createElement(tag);
    if (cls) { n.className = cls; }
    if (txt != null) { n.textContent = txt; }
    return n;
  }

  function runKey() {
    var s = doc.getElementById(SRC_ID);
    return (s && s.textContent ? s.textContent.trim() : 'run');
  }

  /* ------------------------------------------------------------------
     THE STATUS WORD

     The spec asks for Completed / Running / Waiting / Requires Review.
     The classes on the row already encode the truth, so we read those
     and rewrite TEXT ONLY — never className, or the green/amber/red
     evidence colouring that refusalKind() sets would be lost.
     ------------------------------------------------------------------ */
  function statusFor(row) {
    if (row.classList.contains('ok')) { return 'Completed'; }
    if (row.classList.contains('held')) { return 'Completed'; }  /* see header */
    if (row.classList.contains('nodata')) { return 'Requires Review'; }
    if (row.classList.contains('fault')) { return 'Requires Review'; }
    if (row.classList.contains('running')) { return 'Running'; }
    return 'Waiting';
  }

  /* ------------------------------------------------------------------
     FOLD ONE ROW
     ------------------------------------------------------------------ */
  function foldRow(row, key) {
    if (row.dataset[MARK]) { return; }
    row.dataset[MARK] = '1';

    var mid = row.children[1];
    var chip = row.children[2];
    if (!mid) { return; }

    /* The role name stays visible. Everything after it is detail. */
    var keep = mid.querySelector('b');
    var detail = el('div', 'ksat-sf-detail');
    detail.hidden = true;

    /* Preserve the recorded word before the chip is relabelled, so the
       database's own vocabulary survives one click away. */
    if (chip && chip.textContent) {
      detail.appendChild(el('small', 'ksat-sf-orig',
        'Recorded as: ' + chip.textContent.trim()));
    }

    var move = [], i, kids = mid.childNodes, seen = false;
    for (i = 0; i < kids.length; i++) {
      if (kids[i] === keep) { seen = true; continue; }
      if (seen) { move.push(kids[i]); }
    }
    if (!move.length) {
      /* Nothing to hide. Still relabel the chip so the vocabulary is
         consistent down the column, but do not offer an empty fold. */
      if (chip) { chip.textContent = statusFor(row); }
      return;
    }
    move.forEach(function (n) { detail.appendChild(n); });

    var id = key + '#' + (row.children[0] ? row.children[0].textContent : '?');
    var btn = el('button', 'ksat-sf-more');
    btn.type = 'button';
    btn.setAttribute('aria-expanded', 'false');

    function paint(open) {
      detail.hidden = !open;
      btn.textContent = open ? 'Hide details' : 'View run';
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) { OPEN[id] = 1; } else { delete OPEN[id]; }
    }
    btn.addEventListener('click', function () { paint(detail.hidden); });

    mid.appendChild(btn);
    mid.appendChild(detail);
    paint(!!OPEN[id]);

    if (chip) { chip.textContent = statusFor(row); }
  }

  /* ------------------------------------------------------------------
     THE CHAIN STRIP

     Item 4: let the room see that something is happening, without
     adding clutter. This reuses the .timeline / .stage markup and the
     .done / .active classes that researcher.html already carries in the
     Overview card, so it inherits styling that is already on the page
     rather than introducing a new visual language.

     THE ORDER IS THE REAL ONE. The spec sketches the chain as Satellite
     Data, Environmental Analysis, Impact Prediction, Human Checkpoint,
     Reporting. The code runs the checkpoint BEFORE impact_prediction —
     approve() in js/ksat-agents.js is what starts impact_prediction, and
     that gate is the whole point of the design. Drawing it the other way
     round would be a prettier picture of a workflow this platform does
     not have, so the strip follows the code.

     Every state below is read off the DOM already on screen. No extra
     query, no second source of truth.
     ------------------------------------------------------------------ */
  var CHAIN = [
    { k: 'request', label: 'REQUEST' },
    { k: 'satellite_data', label: 'DATA' },
    { k: 'environmental_analysis', label: 'ANALYSIS' },
    { k: 'recommendation', label: 'DECISION' },
    { k: 'checkpoint', label: 'CHECKPOINT' },
    { k: 'impact_prediction', label: 'IMPACT' },
    { k: 'reporting', label: 'REPORT' }
  ];

  function roleName(key) {
    var R = (KS.agents && KS.agents.ROLES) || {};
    return (R[key] && R[key].name) || null;
  }

  function ensureStrip(card) {
    var strip = card.querySelector('.ksat-sf-chain');
    if (strip) { return strip; }
    strip = el('div', 'timeline ksat-sf-chain');
    CHAIN.forEach(function (c, i) {
      var st = el('div', 'stage');
      st.setAttribute('data-stage', c.k);
      st.appendChild(el('i', null, String(i + 1)));
      st.appendChild(el('span', null, c.label));
      strip.appendChild(st);
    });
    var head = card.querySelector('.ct');
    if (head && head.nextSibling) { card.insertBefore(strip, head.nextSibling); }
    else { card.insertBefore(strip, card.firstChild); }
    return strip;
  }

  function paintStrip(card, rows) {
    var strip = ensureStrip(card);
    var names = [], lastName = null, i;
    for (i = 0; i < rows.length; i++) {
      var b = rows[i].querySelector('b');
      if (!b) { continue; }
      names.push(b.textContent.trim());
      lastName = b.textContent.trim();
    }
    var cp = doc.getElementById('checkpointCard');
    var cpOpen = !!(cp && !cp.hidden);

    CHAIN.forEach(function (c) {
      var node = strip.querySelector('[data-stage="' + c.k + '"]');
      if (!node) { return; }
      node.classList.remove('done', 'active');

      if (c.k === 'request') {
        if (rows.length) { node.classList.add('done'); }
        return;
      }
      if (c.k === 'checkpoint') {
        if (cpOpen) { node.classList.add('active'); }
        else if (names.indexOf(roleName('impact_prediction')) >= 0) {
          node.classList.add('done');
        }
        return;
      }
      var nm = roleName(c.k);
      if (!nm) { return; }
      if (names.indexOf(nm) >= 0) {
        node.classList.add(nm === lastName && !cpOpen ? 'active' : 'done');
      }
    });
  }

  /* ------------------------------------------------------------------
     RUN, AND KEEP RUNNING
     ------------------------------------------------------------------ */
  function sweep() {
    var box = doc.getElementById(TRACE_ID);
    if (!box) { return; }
    var rows = box.querySelectorAll('.step');
    if (!rows.length) { return; }
    var key = runKey();
    var i;
    for (i = 0; i < rows.length; i++) { foldRow(rows[i], key); }
    var card = box.closest ? box.closest('.card') : null;
    if (card) { paintStrip(card, rows); }
  }

  function start() {
    var box = doc.getElementById(TRACE_ID);
    if (!box) { return; }
    sweep();
    /* childList on #trace, because refreshTrace() clears and rebuilds it
       several times per run. subtree as well, because the chip and the
       gloss are written into rows that already exist. */
    new w.MutationObserver(function () { sweep(); })
      .observe(box, { childList: true, subtree: true });

    /* The checkpoint card opening is what makes CHECKPOINT go active,
       and that is an attribute flip on a different element. */
    var cp = doc.getElementById('checkpointCard');
    if (cp) {
      new w.MutationObserver(function () { sweep(); })
        .observe(cp, { attributes: true, attributeFilter: ['hidden'] });
    }
  }

  KS.stepsFold = { sweep: sweep };

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
}(window, document));
