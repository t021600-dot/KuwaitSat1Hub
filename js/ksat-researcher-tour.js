/* =====================================================================
   ksat-researcher-tour.js - THE GUIDED TOUR, RESEARCHER WORKSPACE
   Owner: 01 Front end

   >>> THIS IS NOT js/ksat-tour.js. DO NOT MERGE THE TWO. <<<
   js/ksat-tour.js is the PUBLIC page's tour: it dresses the eleven-step
   #demoHud / #demoPan engine that lives in index.html, and index.html
   is the only page that loads it. This file is the RESEARCHER
   workspace's tour and researcher.html is the only page that loads it.
   Different pages, different engines, different markup, no shared code.
   The first draft of this file was written at the name ksat-tour.js and
   silently replaced 1,382 lines of the public one; git had it, but the
   names are kept apart now so nobody has to find that out twice.

   Eleven steps across the researcher workspace. Each one switches to a
   real view, puts a spotlight on a real element, and says what the
   thing is for and what to do with it.

   >>> IT DRIVES THE REAL UI. IT DOES NOT IMITATE IT. <<<
   Every navigation here is document.querySelector('[data-go=...]').click()
   on the actual sidebar button, so the tour goes through the same
   delegated handler a researcher's own click goes through. There is no
   second copy of the navigation to drift out of step with the first,
   and a view that is broken is broken ON THE TOUR TOO. A tour that can
   pass while the workspace fails is worse than no tour: it is a
   demonstration that lies.

   >>> A MISSING TARGET IS NOT AN ERROR <<<
   The Reports step points at a table that is empty until a report is
   signed, and the checkpoint card does not exist until a run reaches
   one. Steps whose element is absent still show their card, centred,
   with the spotlight off. Skipping them silently would teach a new
   researcher that the surface does not exist.

   >>> NOTHING ANIMATES <<<
   See the note at the top of css/ksat-tour.css. Reduced motion is on
   for this user and the automated tab runs hidden, so a transition is
   a thing that either never plays or plays to nobody.
   ===================================================================== */

(function () {
  'use strict';

  var KS = window.KSAT = window.KSAT || {};
  var doc = document;

  /* How long to wait for a view's own asynchronous content before
     giving up and showing the card without a spotlight. The audit view
     loads four tables and the console fills a mission list. */
  var SETTLE_MS = 2200;
  var POLL_MS = 90;

  var STEPS = [
    {
      view: 'overview',
      target: 'aside',
      title: 'Everything this account can do is in this column',
      body: [
        'The workspace is grouped by what you are doing rather than by which ' +
        'table the data sits in. <b>Mission Operations</b> is where research ' +
        'questions are defined and run. <b>Scientific Data</b> is what the ' +
        'satellite and the public record actually hold. <b>Analysis</b> is ' +
        'where a run happens, and <b>Outputs</b> is what leaves the building.',
        'Nothing on any of these views is typed into the page. Every number ' +
        'is read from the database under your own sign-in, so what you see ' +
        'here is what your account is allowed to see and no more.'
      ],
      act: 'Take the tour in order the first time. After that the sidebar is ' +
           'faster than the tour.'
    },
    {
      view: 'overview',
      target: ['#wfLine', '#wfTitle'],
      title: 'A mission moves through fixed stages',
      body: [
        'A mission is a research question with a piece of ground attached to ' +
        'it. It is drafted, launched, run by the agents, stopped at a human ' +
        'checkpoint for your decision, and only then written up.',
        'The stage shown here is read from the mission row itself. If a run ' +
        'stops early the stage stops with it, which is the point: the ' +
        'workflow is not a progress bar that always reaches the end.'
      ],
      act: 'Watch this line during a run. It is the shortest description of ' +
           'where the work has got to.'
    },
    {
      view: 'missions',
      target: '[data-act="new-mission"]',
      title: 'Starting a mission: the question, then the ground',
      body: [
        'A mission needs a title, a research objective of at least twenty ' +
        'characters, and an area. The objective should be a question the ' +
        'evidence could answer, not an instruction to the agents.',
        'The area is <b>drawn on a map, not typed</b>. Pan and zoom until the ' +
        'ground you mean is on screen and the area of interest is whatever ' +
        'the view contains, clipped to Kuwait. There are presets for the ' +
        'common cases, including Al-Jahra city.',
        'The database checks the shape on the way in. If it refuses the ' +
        'polygon the dialog says which of the two reasons applies rather ' +
        'than making you guess.'
      ],
      act: 'Open this dialog and use a preset. It is the fastest way to a ' +
           'valid area.'
    },
    {
      view: 'missions',
      target: '#missionTable',
      title: 'The mission list is the record, not a summary',
      body: [
        'Every mission this account has created, with its area, the date and ' +
        'its status. <b>Draft</b> has never been run. <b>Complete</b> reached a ' +
        'report. A mission can also stop without a report, and it stays in ' +
        'this list saying so.',
        'Click any row to open its detail: the area on a map, the steps of ' +
        'its runs read back from agent_steps, the findings it produced, and ' +
        'the approved report if there is one.'
      ],
      act: 'Click a row. Everything about a mission is reachable from here.'
    },
    {
      view: 'frames',
      target: ['#framesGrid', '#framesCount'],
      title: 'What the satellite actually photographed',
      body: [
        'The payload archive. These are the frames KuwaitSat-1 holds, and ' +
        'the count is the real one, not a target.',
        'Not every frame carries a geolocation, and the ones that do were ' +
        'matched by eye against reference imagery rather than by an onboard ' +
        'GPS. Each row says which method produced its position and how much ' +
        'confidence that method earns. A frame without a position cannot be ' +
        'used to answer a question about a specific place, and the pipeline ' +
        'will not pretend otherwise.',
        'This archive is read only for every signed-in role. It carries no ' +
        'insert, update or delete grant at all.'
      ],
      act: 'Open a frame to see its geolocation method before you trust a ' +
           'finding that rests on it.'
    },
    {
      view: 'geo',
      target: '#geoMap',
      title: 'The real Kuwait, with its licence attached',
      body: [
        'Eighteen layers: the coastline, twenty-five islands, the six ' +
        'governorates on two different boundary readings, two hundred and ' +
        'four residential areas, inland water, places, protected areas and ' +
        'the maritime zones.',
        'The credit line under the map is a <b>licence condition</b>, not ' +
        'decoration. These layers are OpenStreetMap under ODbL and GeoNames ' +
        'under CC BY, and a map drawn from them has to say so. The ' +
        'attribution is added by the same code that adds the layer, so the ' +
        'two cannot be separated.',
        'The maritime zones are labelled "no legal value" because Marine ' +
        'Regions says so themselves. They are distance buffers, not agreed ' +
        'boundaries.'
      ],
      act: 'Use "Use this view as an area of interest" to take the current ' +
           'view straight into a new mission.'
    },
    {
      view: 'console',
      target: ['#runBtn', '#runMission'],
      title: 'Running the pipeline',
      body: [
        'Choose a mission and run it. Six agents work in order: the ' +
        'Orchestrator plans, the Satellite Data Agent finds evidence, the ' +
        'Environmental Analysis Agent measures it, and the Recommendation ' +
        'Agent ranks what it found.',
        'The first decision is whether there is anything to analyse at all. ' +
        'If no KuwaitSat-1 frame covers the area the run does not stop ' +
        'automatically: it falls back to public Earth observation, Sentinel-2 ' +
        'for surface and MODIS for relative heat, and <b>every finding made ' +
        'that way is stamped with the sensor that produced it</b>. That is how ' +
        'a question about Al-Jahra gets an answer when the archive has never ' +
        'photographed Al-Jahra.',
        'A run can also end with no candidates. That is a result about the ' +
        'area, and it is written up as one.'
      ],
      act: 'Run a mission and read the trace as it fills. Every line in it is ' +
           'a row in agent_steps.'
    },
    {
      view: 'console',
      target: ['#permWrite'],
      up: '.card',
      title: 'What the agents are not allowed to do',
      body: [
        'Three of these rows say DENIED and one says HUMAN ONLY. They are ' +
        '<b>not labels</b>. The payload archive carries no write grant for any ' +
        'signed-in role, so an agent that tried to modify a frame would be ' +
        'refused by the database rather than by this page.',
        'That distinction matters more than it looks. A permission enforced ' +
        'by the interface is a permission anybody can get around by not ' +
        'using the interface.'
      ],
      act: 'Prove it yourself on Provenance / Audit. The Access Test runs ' +
           'the refused operations against the live database while you watch.'
    },
    {
      view: 'console',
      target: ['#checkpointCard', '#runBtn'],
      title: 'The checkpoint is yours, and it is real',
      body: [
        'When the agents have ranked what they found, the run stops and waits ' +
        'for a person. You can approve the candidates, ask for a re-rank, or ' +
        'abandon the run.',
        'Nothing is written to a report before you decide, and abandoning ' +
        'does not delete the run. It closes with a reason and stays in the ' +
        'audit record, because a run somebody chose to stop is evidence too.'
      ],
      act: 'The three buttons lock while a decision is being written, so a ' +
           'double click cannot approve twice.'
    },
    {
      view: 'reports',
      target: '#reportTable',
      title: 'The report, and what it refuses to claim',
      body: [
        'A report is generated from findings you approved. It has ten fixed ' +
        'sections, including <b>Limitations</b>, which states what the ' +
        'measurement cannot support rather than burying it.',
        'The document reads on the left and the ground it is about stays on ' +
        'the right, with a handle that wipes between the area as measured ' +
        'and the same area with the approved zones drawn as planted. The ' +
        'green is a conceptual simulation of your decision. It is not a ' +
        'prediction and not an observation, and the report says so on the ' +
        'map itself.',
        'Sign it and it is fixed. Download it as Markdown or print it to PDF.'
      ],
      act: 'Open a report and drag the handle. That comparison is the fastest ' +
           'way to explain a mission to somebody who was not in the room.'
    },
    {
      view: 'audit',
      target: ['#accessTest', '#auditSteps'],
      title: 'The record, and how to check it',
      body: [
        'Every run, every step, every refusal and every result, read back ' +
        'from the tables that hold them. Refusals are shown rather than ' +
        'hidden, because a pipeline that never refuses anything is a ' +
        'pipeline with no guardrails.',
        'The <b>Access Test</b> is the one to show a sceptic. It attempts the ' +
        'operations the agents are denied, against the live database, under ' +
        'your own session, and prints what came back. Four attempts, four ' +
        'refusals, every time, with the database’s own error text.'
      ],
      act: 'Run the Access Test in front of whoever is asking. It takes a few ' +
           'seconds and it answers the question completely.'
    }
  ];

  /* ------------------------------------------------------------------
     STATE
     ------------------------------------------------------------------ */
  var veil = null, hole = null, card = null;
  var idx = -1;
  var running = false;

  function el(tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function laidOut(n) {
    if (!n) return false;
    var r = n.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  /* RESOLVE ONE STEP'S TARGET.

     target is an ARRAY of selectors tried IN ORDER, not a comma
     selector. That is not a style preference. querySelector('a, b')
     returns whichever of the two comes first in the DOCUMENT, so
     '#framesGrid, #framesCount' returned the little count heading and
     the grid it was meant to point at never got a look in. An array
     says what the priority is and means it.

     Two cases where the first match is not the thing to light up:

       - it is laid out but empty. #wfLine is the workflow timeline,
         which has no height until a run fills it. The card AROUND it
         is what the step is describing, so climb to .card.
       - it is hidden. #checkpointCard does not exist on screen until a
         run reaches a checkpoint. Climbing from it would light up
         whatever container happened to be above it, so fall through to
         the next selector instead.

     step.up, when set, replaces the match with its nearest matching
     ancestor. Used where the precise element is a two-word <b> and the
     panel around it is what the reader needs to see. */
  function resolveOnce(step) {
    var list = Array.isArray(step.target) ? step.target
             : (step.target ? [step.target] : []);
    for (var i = 0; i < list.length; i++) {
      var n = null;
      try { n = doc.querySelector(list[i]); } catch (e) { n = null; }
      if (!n) continue;
      if (step.up) {
        var u = n.closest(step.up);
        if (u && laidOut(u)) return u;
      }
      if (laidOut(n)) return n;
      var card2 = n.closest('.card');
      if (card2 && card2 !== n && laidOut(card2)) return card2;
    }
    return null;
  }

  /* Poll, because a view's content arrives from the database after the
     view itself does. Resolves with the element or with null once
     SETTLE_MS is up: null is a legitimate answer here, not a failure. */
  function waitFor(step) {
    if (!step.target) return Promise.resolve(null);
    return new Promise(function (resolve) {
      var spent = 0;
      (function poll() {
        var n = resolveOnce(step);
        if (n) { resolve(n); return; }
        spent += POLL_MS;
        if (spent >= SETTLE_MS) { resolve(null); return; }
        setTimeout(poll, POLL_MS);
      })();
    });
  }

  function goToView(id) {
    var btn = doc.querySelector('aside [data-go="' + id + '"]') ||
              doc.querySelector('[data-go="' + id + '"]');
    if (btn) { btn.click(); }
  }

  /* ------------------------------------------------------------------
     PLACING THE CARD

     Below the target if there is room, above if there is not, and
     clamped into the viewport either way. The card is never allowed to
     sit on top of the thing it is pointing at.
     ------------------------------------------------------------------ */
  function place(rect) {
    var pad = 14;
    var vw = doc.documentElement.clientWidth;
    var vh = doc.documentElement.clientHeight;
    var cw = card.offsetWidth || 430;
    var ch = card.offsetHeight || 260;

    var top, left;

    if (!rect) {
      top = Math.max(pad, (vh - ch) / 2);
      left = Math.max(pad, (vw - cw) / 2);
    } else {
      var below = vh - (rect.bottom + pad);
      var above = rect.top - pad;
      if (below >= ch || below >= above) {
        top = rect.bottom + pad;
      } else {
        top = rect.top - ch - pad;
      }
      left = rect.left + (rect.width - cw) / 2;
    }

    card.style.top = Math.round(Math.min(Math.max(pad, top), Math.max(pad, vh - ch - pad))) + 'px';
    card.style.left = Math.round(Math.min(Math.max(pad, left), Math.max(pad, vw - cw - pad))) + 'px';
  }

  function spotlight(node) {
    if (!node) {
      veil.classList.add('plain');
      place(null);
      return;
    }
    veil.classList.remove('plain');
    var r = node.getBoundingClientRect();
    var m = 6;
    hole.style.top = Math.round(r.top - m) + 'px';
    hole.style.left = Math.round(r.left - m) + 'px';
    hole.style.width = Math.round(r.width + m * 2) + 'px';
    hole.style.height = Math.round(r.height + m * 2) + 'px';
    place(r);
  }

  /* ------------------------------------------------------------------
     RENDER ONE STEP
     ------------------------------------------------------------------ */
  function render(step, node) {
    while (card.firstChild) card.removeChild(card.firstChild);

    card.appendChild(el('div', 'step',
      'Step ' + (idx + 1) + ' of ' + STEPS.length));
    card.appendChild(el('h4', null, step.title));

    step.body.forEach(function (html) {
      var p = el('p');
      /* The strings above are authored in this file and contain only
         <b>. Nothing from the database reaches here. */
      p.innerHTML = html;
      card.appendChild(p);
    });

    if (step.act) {
      var a = el('p', 'do');
      a.textContent = step.act;
      card.appendChild(a);
    }

    if (!node && step.target) {
      var miss = el('p', 'do');
      miss.textContent = 'This surface has nothing on it yet, so there is ' +
        'nothing to point at. It fills in once a run has produced something.';
      card.appendChild(miss);
    }

    var bar = el('div', 'ksat-tour-bar');
    var dots = el('div', 'dots');
    STEPS.forEach(function (s, i) {
      var d = el('button', 'dot' + (i === idx ? ' on' : (i < idx ? ' done' : '')));
      d.type = 'button';
      d.title = s.title;
      d.setAttribute('aria-label', 'Step ' + (i + 1) + ': ' + s.title);
      d.addEventListener('click', function () { goto(i); });
      dots.appendChild(d);
    });
    bar.appendChild(dots);

    if (idx > 0) {
      var back = el('button', 'btn', 'Back');
      back.type = 'button';
      back.addEventListener('click', function () { goto(idx - 1); });
      bar.appendChild(back);
    }

    var next = el('button', 'btn primary',
      idx === STEPS.length - 1 ? 'Done' : 'Next');
    next.type = 'button';
    next.addEventListener('click', function () {
      if (idx === STEPS.length - 1) { end(true); } else { goto(idx + 1); }
    });
    bar.appendChild(next);

    card.appendChild(bar);

    var hint = el('div', 'ksat-tour-hint',
      'Arrow keys move, Escape leaves the tour.');
    card.appendChild(hint);

    next.focus();
  }

  /* ------------------------------------------------------------------
     GO TO A STEP
     ------------------------------------------------------------------ */
  var seq = 0;

  function goto(i) {
    if (i < 0 || i >= STEPS.length) return;
    var step = STEPS[i];
    idx = i;
    var mine = ++seq;

    goToView(step.view);

    waitFor(step).then(function (node) {
      /* A second navigation may have started while this one was
         waiting. Only the newest one is allowed to paint. */
      if (!running || mine !== seq) return;

      if (node) {
        /* show() scrolls to the top on every view change, so the
           target has to be brought back. 'center' keeps the card's
           room above and below roughly even. */
        try { node.scrollIntoView({ block: 'center', inline: 'nearest' }); }
        catch (e) { node.scrollIntoView(); }
      }
      render(step, node);
      spotlight(node);
      /* Measured once with the real card height, once the content is
         in it: the first place() ran against last step's height. */
      spotlight(node);
    });
  }

  function reposition() {
    if (!running || idx < 0) return;
    spotlight(resolveOnce(STEPS[idx]));
  }

  function onKey(e) {
    if (!running) return;
    if (e.key === 'Escape') { e.stopPropagation(); end(false); return; }
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { goto(idx + 1); return; }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { goto(idx - 1); return; }
  }

  function start(from) {
    if (running) return;
    running = true;

    veil = el('div', 'ksat-tour-veil');
    veil.setAttribute('role', 'dialog');
    veil.setAttribute('aria-label', 'Guided tour of the researcher workspace');
    hole = el('div', 'ksat-tour-hole');
    card = el('div', 'ksat-tour-card');
    veil.appendChild(hole);
    veil.appendChild(card);
    doc.body.appendChild(veil);

    /* Clicking the dark area leaves. Clicking inside the card does not. */
    veil.addEventListener('click', function (e) {
      if (e.target === veil) end(false);
    });

    /* Escape is captured BEFORE the page's own Escape handler, which
       closes modals and panels. During the tour, Escape means the
       tour. */
    doc.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);

    goto(typeof from === 'number' ? from : 0);
  }

  function end(finished) {
    if (!running) return;
    running = false;
    seq++;
    doc.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', reposition);
    window.removeEventListener('scroll', reposition, true);
    if (veil && veil.parentNode) veil.parentNode.removeChild(veil);
    veil = hole = card = null;
    idx = -1;
    if (finished) {
      try { localStorage.setItem('ksat.tour.done', '1'); } catch (e) {}
    }
  }

  /* ------------------------------------------------------------------
     THE LAUNCHER

     In the top bar, beside Mission hub. THE TOUR NEVER STARTS BY
     ITSELF: a walkthrough that opens over somebody's work is an
     obstacle, and on demo day it would open over the demo. It starts
     from this button, or from #tour in the address bar for a link
     somebody can be sent.
     ------------------------------------------------------------------ */
  function mount() {
    if (doc.getElementById('ksatTourOpen')) return;

    /* ANCHOR ON THE BUTTON, NOT ON A CLASS.

       The first version looked for '.top .right', because
       css/ksat-researcher.css styles a .right in the top bar. The
       MARKUP does not use it: researcher.html:98 is div.who. The
       selector matched nothing, mount() returned early, and the tour
       shipped to production with no way to start it. Caught on the
       deployed site rather than before it, which is the whole argument
       for reading the markup instead of the stylesheet.

       #signout is an id the page actually has. */
    var anchor = doc.getElementById('signout');
    var bar = anchor ? anchor.parentNode
            : (doc.querySelector('.top .who') || doc.querySelector('.who') ||
               doc.querySelector('.top .right') || doc.querySelector('.right'));
    if (!bar) return;

    var b = el('button', 'ksat-tour-open', 'Guided tour');
    b.type = 'button';
    b.id = 'ksatTourOpen';
    b.addEventListener('click', function () { start(0); });

    var hub = bar.querySelector('a[href="/"]') || anchor;
    if (hub && hub.parentNode === bar) { bar.insertBefore(b, hub); }
    else { bar.appendChild(b); }

    if (location.hash === '#tour') {
      try { history.replaceState(null, '', location.pathname); } catch (e) {}
      setTimeout(function () { start(0); }, 700);
    }
  }

  KS.tour = { start: start, end: end, steps: STEPS };

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
