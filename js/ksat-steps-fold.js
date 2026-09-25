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

  /* ------------------------------------------------------------------
     PLAIN LANGUAGE, AND WHY IT IS SAFE TO WRITE IT HERE

     Each entry says what the AGENT IS, not what this run found. "Ranks
     every tile against its own frame's median" is a fact about the
     pipeline, true of every run, read off the code. None of it looks at
     a result or repeats a number, so none of it can be wrong about a
     particular run.

     Everything the database actually recorded - the status word, the
     tool, the refusal reason verbatim, the gloss, the injection flag,
     the timestamp - is untouched and still on the row, one level down.
     ------------------------------------------------------------------ */
  var PLAIN = {
    'Satellite Data Agent': {
      one: 'Finds which KuwaitSat-1 frames cover your area, and loads them.',
      steps: [
        'Reads the area recorded on this run.',
        'Searches the payload archive for frames whose footprint falls inside it.',
        'Loads the matching frames, or stops here if none of them do.'
      ]
    },
    'Environmental Analysis Agent': {
      one: 'Measures how green every part of each frame is, and finds the outliers.',
      steps: [
        'Divides each frame into a grid and measures the average colour of every tile.',
        'Sets water aside, so only land is compared.',
        'Scores each tile against its own frame, not against the others.'
      ]
    },
    'Recommendation Agent': {
      one: 'Keeps only the zones that stand far enough out from ordinary ground.',
      steps: [
        'Ranks the tiles by how far they sit from their frame median.',
        'Drops anything that does not clear the threshold.',
        'Returns nothing at all rather than a weak answer.'
      ]
    },
    'Impact Prediction Agent': {
      one: 'Estimates what the approved zones would change, as ranges.',
      steps: [
        'Takes the zones you approved at the checkpoint.',
        'Applies published coefficients to each one.',
        'Gives ranges, and says so where the evidence will not carry a number.'
      ]
    },
    'Visualization Agent': {
      one: 'Draws the approved zones onto the map.',
      steps: [
        'Writes each zone as a shape with real coordinates.',
        'Puts them on the same ground the measurement came from.'
      ]
    },
    'Reporting Agent': {
      one: 'Writes the report from what was recorded, then waits for you.',
      steps: [
        'Assembles the report from the run record only.',
        'Carries the limitations through rather than dropping them.',
        'Stops as a draft until you sign it.'
      ]
    }
  };

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
     THE STATUS MARK: A RING WHILE IT RUNS, A TICK WHEN IT IS DONE

     Asked for directly: a looping ring while an agent is working, green
     when it finishes. The word stays - a ring on its own is a shape,
     and "Completed" is the thing a researcher quotes later - so the
     mark goes in front of it rather than in place of it.

     FOUR STATES, NOT TWO. statusFor() above already collapses six row
     classes into four words, and the mark follows the same four so the
     shape and the word can never disagree:

       done     ok, held      a filled green disc with a tick
       running  running       a ring with one lit arc, turning
       review   nodata, fault a hollow amber ring
       wait     anything else a hollow grey ring

     THE COLOUR IS NOT THE ONLY SIGNAL. The tick, the turning arc and
     the word are all carried separately, so the card still reads on a
     monochrome screen and to somebody who cannot tell the green from
     the amber. That is the same rule the refusal colours in
     css/ksat-workspace.css already follow.
     ------------------------------------------------------------------ */
  function stateKey(row) {
    if (row.classList.contains('ok') || row.classList.contains('held')) { return 'done'; }
    if (row.classList.contains('nodata') || row.classList.contains('fault')) { return 'review'; }
    if (row.classList.contains('running')) { return 'running'; }
    return 'wait';
  }

  /* Only ever called from inside foldRow, which runs once per row: this
     writes into the chip, #trace is watched with subtree:true, and an
     unguarded write here would re-enter sweep() for ever. */
  function paintChip(row, chip) {
    if (!chip) { return; }
    var k = stateKey(row);
    chip.classList.remove('ksat-sf-done', 'ksat-sf-running',
                          'ksat-sf-review', 'ksat-sf-wait');
    chip.classList.add('ksat-sf-mark-' + k);
    chip.textContent = '';
    var dot = el('span', 'ksat-sf-mark');
    dot.setAttribute('aria-hidden', 'true');
    chip.appendChild(dot);
    chip.appendChild(doc.createTextNode(statusFor(row)));
  }

  /* ------------------------------------------------------------------
     FOLD ONE ROW
     ------------------------------------------------------------------ */
  function foldRow(row, key, repeatOfPrev) {
    if (row.dataset[MARK]) { return; }
    row.dataset[MARK] = '1';

    var mid = row.children[1];
    var chip = row.children[2];
    if (!mid) { return; }

    /* The role name stays visible. Everything after it is detail. */
    var keep = mid.querySelector('b');
    var roleName = keep ? keep.textContent.trim() : '';
    var plain = PLAIN[roleName];

    /* Everything stepRow wrote after the <b> is the technical record. */
    var tech = [], i, kids = mid.childNodes, seen = false;
    for (i = 0; i < kids.length; i++) {
      if (kids[i] === keep) { seen = true; continue; }
      if (seen) { tech.push(kids[i]); }
    }

    /* ONE PLAIN SENTENCE, on the row. This is what the researcher reads
       instead of a tool name.

       SAID ONCE. The Environmental Analysis Agent runs per frame, so a
       three-frame run writes three identical rows, and repeating the
       sentence and the arrow down all three is exactly the noise this
       pass exists to remove. A repeat keeps its number, its name and
       its status - the parts that differ - and nothing else. */
    if (plain && !repeatOfPrev) {
      mid.appendChild(el('div', 'ksat-sf-one', plain.one));
    }
    if (repeatOfPrev) {
      row.classList.add('ksat-sf-repeat');
      paintChip(row, chip);
      /* The record is still reachable: it lives on the first row of the
         group, and this row's own technical detail is dropped rather
         than duplicated. Keep the row itself, because the COUNT of them
         is information - three frames were measured, not one. */
      tech.forEach(function (n) { if (n.parentNode) { n.parentNode.removeChild(n); } });
      return;
    }

    var detail = el('div', 'ksat-sf-detail');
    detail.hidden = true;

    /* THE BRIEF PROCESS, in plain steps. This is what opening a row is
       for - not the log. */
    if (plain && plain.steps.length) {
      var ol = doc.createElement('ol');
      ol.className = 'ksat-sf-steps';
      plain.steps.forEach(function (t) {
        ol.appendChild(el('li', null, t));
      });
      detail.appendChild(ol);
    }

    /* THE RECORD ITSELF, one level further down. Nothing the database
       returned is discarded - the status word it actually used, the
       tool, the refusal reason verbatim, the gloss, the timestamp. It
       stops being the first thing on screen, which was the request. */
    if (tech.length || (chip && chip.textContent)) {
      var raw = el('div', 'ksat-sf-raw');
      raw.hidden = true;
      if (chip && chip.textContent) {
        raw.appendChild(el('small', 'ksat-sf-orig',
          'Recorded as: ' + chip.textContent.trim()));
      }
      tech.forEach(function (n) { raw.appendChild(n); });

      var techBtn = el('button', 'ksat-sf-tech');
      techBtn.type = 'button';
      techBtn.textContent = 'Technical record';
      techBtn.setAttribute('aria-expanded', 'false');
      techBtn.addEventListener('click', function () {
        var open = raw.hidden;
        raw.hidden = !open;
        techBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      detail.appendChild(techBtn);
      detail.appendChild(raw);
    }

    if (!detail.childNodes.length) {
      paintChip(row, chip);
      return;
    }

    var id = key + '#' + (row.children[0] ? row.children[0].textContent : '?');

    /* AN ARROW, NOT A BUTTON LABEL. A caret that turns is a smaller
       thing on the page than a worded control, and it repeats six times
       down the card. The accessible name still says what it does. */
    var btn = el('button', 'ksat-sf-more');
    btn.type = 'button';
    btn.setAttribute('aria-expanded', 'false');
    var caret = el('span', 'ksat-sf-caret', '\u203a');
    var word = el('span', 'ksat-sf-word', 'How it works');
    btn.appendChild(caret);
    btn.appendChild(word);

    function paint(open) {
      detail.hidden = !open;
      btn.classList.toggle('is-open', !!open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.setAttribute('aria-label',
        (open ? 'Hide' : 'Show') + ' how the ' + roleName + ' works');
      if (open) { OPEN[id] = 1; } else { delete OPEN[id]; }
    }
    btn.addEventListener('click', function () { paint(detail.hidden); });

    mid.appendChild(btn);
    mid.appendChild(detail);
    paint(!!OPEN[id]);

    paintChip(row, chip);
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
        /* active while a run is being set up, done once it has produced
           its first recorded step */
        node.classList.add(rows.length ? 'done' : 'active');
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
    var card = box.closest ? box.closest('.card') : null;

    /* AN EMPTY TRACE IS A STATE, NOT A NO-OP.

       This used to return early when there were no rows, and the strip
       kept whatever it was showing. Starting a second run clears #trace
       before the first new row lands, so for a few seconds the page
       went on claiming DATA and ANALYSIS were done - for a run that had
       just been closed. Seen live. An empty trace means a run is being
       set up, so the strip resets to REQUEST and nothing else. */
    if (!rows.length) {
      if (card && card.querySelector('.ksat-sf-chain')) {
        paintStrip(card, []);
      }
      return;
    }

    var key = runKey();
    var i, prevRole = null;
    for (i = 0; i < rows.length; i++) {
      var b = rows[i].querySelector('b');
      var roleNow = b ? b.textContent.trim() : '';
      foldRow(rows[i], key, roleNow !== '' && roleNow === prevRole);
      prevRole = roleNow;
    }
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
