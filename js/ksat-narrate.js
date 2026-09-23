/* =====================================================================
   ksat-narrate.js - THE RUN, NARRATED FOR A ROOM
   Owner: 01 Front end

   A run takes about nine seconds and produces two things: a line of
   commentary in #runMsg that is REPLACED on every phase, and a trace of
   rows read back from agent_steps.

   Neither is watchable from four metres away.

   The commentary is a single line that overwrites itself, so by the
   time anybody reads "measuring 8 frames" it says something else and
   the audience has no idea what just happened. The trace is the audit
   trail, at 10px, and it grows downward past the fold.

   This file adds a third thing beside them: an accumulating narration.
   Every phase the Orchestrator announces is kept, timestamped, with the
   seconds since the run began, in type you can read from the back of a
   room. At the end it is the story of the run, in order, still on
   screen.

   >>> IT DOES NOT TOUCH THE TRACE. THAT IS THE WHOLE POINT. <<<
   js/ksat-researcher.js says, above narrate():

       "The live commentary goes in the message line under the mission,
        NOT in the trace. The trace is the audit trail and has to stay
        exactly what agent_steps says; mixing a narration line into it
        would be the one thing this file is not allowed to do."

   That is correct and this file does not go around it. The narration
   is a SEPARATE panel. Nothing here writes into #trace, and the two are
   labelled so nobody in the audience can mistake one for the other:
   the narration says what the platform is doing, the trace is what the
   database recorded. If they ever disagree, the trace is right.

   >>> IT HOOKS BY OBSERVING, NOT BY EDITING <<<
   narrate() and refreshTrace() are closures inside ksat-researcher.js
   and nothing is exported. Rather than reach into that file, this one
   watches the two elements they write to: #runMsg for each phase and
   #traceSrc for the run id. Zero coupling, and it cannot break a run
   even if it throws.
   ===================================================================== */

(function () {
  'use strict';

  var KS = window.KSAT = window.KSAT || {};
  var doc = document;

  var PANEL = null, LOG = null, CLOCK = null, HEAD = null;
  var RUN = null;          /* the run id the narration belongs to */
  var T0 = 0;              /* when this run's first phase arrived */
  var LAST = '';           /* de-duplicate: the observer fires per mutation */
  var TICK = null;
  var BIG = false;

  /* WHERE A STORY STARTS.

     Not at the run id. MutationObserver callbacks are batched into a
     microtask, so the #traceSrc observer fires AFTER the #runMsg one
     that ran in the same tick, and the run id is stamped a moment
     after the first phase is announced. Clearing on a new id therefore
     wiped the opening line of every run:

        1  Mission Orchestrator - requesting a run slot
        2  RESET new run 602c8f86      <- line 1 destroyed here

     Caught in a live test before this shipped. The story boundary is
     the story's own first sentence instead, which arrives in order
     with the rest of the narration because it IS the rest of the
     narration. run() opens every run with it, the reference path
     included. */
  var STARTS = /requesting a run slot/i;

  function el(tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) { n.className = cls; }
    if (text != null) { n.textContent = text; }
    return n;
  }

  function secs() {
    return T0 ? ((Date.now() - T0) / 1000).toFixed(1) + 's' : '0.0s';
  }

  /* The Orchestrator phrases a phase as "Role - what it is doing".
     Splitting them lets the role be set in the agent's own colour and
     the sentence be the thing that reads large. */
  function split(text) {
    var i = text.indexOf(' - ');
    if (i > 0 && i < 48) {
      return { who: text.slice(0, i), what: text.slice(i + 3) };
    }
    return { who: null, what: text };
  }

  function add(text) {
    if (!LOG || !text) { return; }
    if (text === LAST) { return; }

    /* A new run announcing itself, with the previous run still on
       screen. Clear here, where the ordering is the narration's own. */
    if (STARTS.test(text) && LOG.firstChild) { clearLog(); }

    LAST = text;
    if (!T0) { T0 = Date.now(); }

    var parts = split(text);
    var row = el('div', 'ksat-nr-line');
    row.appendChild(el('span', 't', secs()));

    var body = el('span', 'b');
    if (parts.who) { body.appendChild(el('span', 'who', parts.who)); }
    body.appendChild(el('span', 'what', parts.what));
    row.appendChild(body);

    /* Mark the newest so the eye lands on it. The previous newest
       keeps its text, it just stops being highlighted: an audience
       that looks away for two seconds must still be able to find its
       place. */
    var prev = LOG.querySelector('.ksat-nr-line.now');
    if (prev) { prev.classList.remove('now'); }
    row.classList.add('now');

    LOG.appendChild(row);
    /* scrollTop, not scrollIntoView: this panel scrolls, the page must
       not. A run that dragged the whole window down every 400 ms would
       be unusable to drive. */
    LOG.scrollTop = LOG.scrollHeight;

    if (PANEL) { PANEL.hidden = false; }
    startClock();
  }

  function startClock() {
    if (TICK) { return; }
    TICK = setInterval(function () {
      if (!CLOCK) { return; }
      CLOCK.textContent = secs();
    }, 100);
  }

  function stopClock() {
    if (TICK) { clearInterval(TICK); TICK = null; }
    if (CLOCK) { CLOCK.textContent = secs(); }
  }

  function clearLog() {
    T0 = 0;
    LAST = '';
    stopClock();
    if (LOG) { while (LOG.firstChild) { LOG.removeChild(LOG.firstChild); } }
    if (CLOCK) { CLOCK.textContent = '0.0s'; }
  }

  /* The run id only ever LABELS the narration. It never clears it: see
     STARTS above for why that ordering cannot be trusted. */
  function label(runId) {
    RUN = runId;
    if (HEAD) {
      HEAD.textContent = runId ? ('RUN ' + String(runId).slice(0, 8)) : 'NO RUN YET';
    }
  }

  /* Exported for a caller that genuinely wants a blank panel. */
  function reset(runId) {
    clearLog();
    label(runId);
  }

  /* ------------------------------------------------------------------
     THE PANEL
     ------------------------------------------------------------------ */
  function build() {
    var trace = doc.getElementById('trace');
    if (!trace || doc.getElementById('ksatNarrate')) { return; }

    PANEL = el('div', 'ksat-nr');
    PANEL.id = 'ksatNarrate';
    PANEL.hidden = true;

    var bar = el('div', 'ksat-nr-bar');
    bar.appendChild(el('h4', null, 'What the Orchestrator is doing'));
    HEAD = el('span', 'run', 'NO RUN YET');
    bar.appendChild(HEAD);
    CLOCK = el('span', 'clock', '0.0s');
    bar.appendChild(CLOCK);

    var big = el('button', 'btn', 'Bigger');
    big.type = 'button';
    big.addEventListener('click', function () {
      BIG = !BIG;
      PANEL.classList.toggle('big', BIG);
      big.textContent = BIG ? 'Smaller' : 'Bigger';
      if (LOG) { LOG.scrollTop = LOG.scrollHeight; }
    });
    bar.appendChild(big);
    PANEL.appendChild(bar);

    LOG = el('div', 'ksat-nr-log');
    PANEL.appendChild(LOG);

    PANEL.appendChild(el('div', 'ksat-nr-foot',
      'This is the narration. The Agent Execution Trace below is the ' +
      'audit record, read back from agent_steps. If the two ever ' +
      'disagree, the trace is right.'));

    /* Above the trace, inside the same card, so the story and the
       record read as one thing in one place. */
    trace.parentNode.insertBefore(PANEL, trace);
  }

  /* ------------------------------------------------------------------
     THE HOOKS

     #runMsg  - narrate() clears it and writes one text node per phase.
     #traceSrc - refreshTrace() stamps "READ FROM agent_steps - RUN xxxxxxxx"
                 on every poll, so the run id appears there first.
     ------------------------------------------------------------------ */
  function watch() {
    build();

    var msg = doc.getElementById('runMsg');
    if (msg && !msg._ksatNarrateWired) {
      msg._ksatNarrateWired = true;
      new MutationObserver(function () {
        var t = (msg.textContent || '').trim();
        if (t) { add(t); }
      }).observe(msg, { childList: true, subtree: true, characterData: true });
    }

    var src = doc.getElementById('traceSrc');
    if (src && !src._ksatNarrateWired) {
      src._ksatNarrateWired = true;
      new MutationObserver(function () {
        var m = /RUN\s+([0-9a-f]{4,})/i.exec(src.textContent || '');
        var id = m ? m[1] : null;
        if (id && id !== RUN) { label(id); }
      }).observe(src, { childList: true, subtree: true, characterData: true });
    }
  }

  KS.narrate = {
    add: add,
    reset: reset,
    panel: function () { return PANEL; }
  };

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', watch);
  } else {
    watch();
  }
})();
