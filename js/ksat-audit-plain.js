/* =====================================================================
   ksat-audit-plain.js - THE AUDIT TAB, ANSWER FIRST
   Owner: 03 Security

   The Provenance / Audit view holds everything a sceptic could want and
   arranges it so that nobody reads any of it.

   Six full-width cards stacked down a long page. Four bare numbers at
   the top captioned with table names. Two tables of six columns each at
   10px. And the Access test - the one thing on this platform that
   proves its own claim by running against the live database in front of
   you - sitting FOURTH, below both tables, where a visitor has already
   stopped scrolling.

   Worse, the numbers do not answer the question anybody actually
   arrives with. "Steps refused: 5" reads as five things went wrong.
   Every one of them is a guardrail doing its job.

   This file does not remove anything. It puts the answer at the top,
   promotes the proof to second, and folds the two dense tables away
   until somebody asks for them. Everything that was on the page is
   still on the page.

   >>> IT COUNTS, IT DOES NOT CLAIM <<<
   Every sentence in the panel is computed from rows read back a moment
   earlier. Nothing is written in advance. If a genuine fault ever
   appears - a refusal that is not a screened objective and not a
   stop-for-no-evidence - the panel says so in red and does not soften
   it. A summary that can only say good news is not a summary, it is
   decoration.

   The classification matches refusalKind() in js/ksat-researcher.js on
   purpose. Two surfaces disagreeing about what a refusal means would be
   worse than neither of them explaining it.
   ===================================================================== */

(function () {
  'use strict';

  var KS = window.KSAT = window.KSAT || {};
  var doc = document;

  var PANEL = null, BODY = null;

  function el(tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) { n.className = cls; }
    if (text != null) { n.textContent = text; }
    return n;
  }

  function line(cls, strong, rest) {
    var d = el('div', 'ksat-ap-line ' + (cls || ''));
    if (strong) { d.appendChild(el('b', null, strong)); }
    if (rest) { d.appendChild(doc.createTextNode(rest)); }
    return d;
  }

  function plural(n, one, many) {
    return n + ' ' + (n === 1 ? one : (many || one + 's'));
  }

  /* Same four categories as refusalKind(), in the same order. */
  function classify(s) {
    if (s.status !== 'refused') { return null; }
    if (s.injection_flag) { return 'screened'; }
    if (s.step_name === 'environmental_analysis' ||
        s.step_name === 'recommendation') { return 'nodata'; }
    if (s.step_name === 'impact_prediction') { return 'floor'; }
    return 'fault';
  }

  /* ------------------------------------------------------------------
     THE READ

     Named columns only. missions, mission_runs, agent_steps and results
     carry COLUMN-LEVEL grants, so select('*') comes back "permission
     denied for table" while the columns the app actually asks for come
     back fine. That is the security model working, not a fault, and it
     is worth knowing before somebody reports it as one.
     ------------------------------------------------------------------ */
  function read() {
    var sb = window.sb;
    if (!sb) { return Promise.resolve(null); }
    return Promise.all([
      sb.from('missions').select('id,title,status'),
      sb.from('mission_runs').select('id,status'),
      sb.from('agent_steps').select('id,step_name,status,allowed,injection_flag,refused_reason'),
      sb.from('results').select('id,kind')
    ]).then(function (r) {
      if (r.some(function (x) { return x.error; })) {
        return { error: (r.find(function (x) { return x.error; })).error.message };
      }
      return { missions: r[0].data || [], runs: r[1].data || [],
               steps: r[2].data || [], results: r[3].data || [] };
    }).catch(function (e) { return { error: String(e && e.message || e) }; });
  }

  /* ------------------------------------------------------------------
     THE PANEL
     ------------------------------------------------------------------ */
  function say(d) {
    if (!BODY) { return; }
    while (BODY.firstChild) { BODY.removeChild(BODY.firstChild); }

    if (!d) {
      BODY.appendChild(line('', null,
        'Not signed in, so there is no record to read.'));
      return;
    }
    if (d.error) {
      BODY.appendChild(line('bad', 'The record could not be read. ', d.error));
      return;
    }

    var refused = d.steps.filter(function (s) { return s.status === 'refused'; });
    var byKind = { screened: 0, nodata: 0, floor: 0, fault: 0 };
    refused.forEach(function (s) { byKind[classify(s)]++; });
    var complete = d.steps.filter(function (s) { return s.status === 'complete'; }).length;

    BODY.appendChild(line('', plural(d.missions.length, 'mission') + ', ' +
      plural(d.runs.length, 'run') + ', ' + plural(d.steps.length, 'recorded step') +
      ', ' + plural(d.results.length, 'finding') + '. ',
      'Read back from the database just now, under this account. Nothing on ' +
      'this page is stored in the browser or written into the markup.'));

    if (!refused.length) {
      BODY.appendChild(line('ok', 'No step was refused. ',
        complete + ' completed. That is not automatically good news: a pipeline ' +
        'that never refuses anything has no guardrails to refuse with. Use the ' +
        'access test below to see the boundaries actually hold.'));
    } else {
      BODY.appendChild(line('ok',
        plural(refused.length, 'step was', 'steps were') + ' refused, and ' +
        (byKind.fault ? 'most of that is' : 'all of it is') + ' the platform working. ',
        'A refusal here is a boundary, not a crash.'));

      if (byKind.nodata) {
        BODY.appendChild(line('sub2', plural(byKind.nodata, 'stop') + ' for want of evidence. ',
          'The Orchestrator would have had to answer from data that cannot ' +
          'carry the question, so it stopped and recorded why. The reason ' +
          'stored on the row is the finding.'));
      }
      if (byKind.floor) {
        BODY.appendChild(line('sub2', plural(byKind.floor, 'zone') + ' rejected on the ' +
          'impact floor. ',
          'The Impact Prediction Agent would not claim a benefit its own numbers ' +
          'do not support. It said by how much it fell short and ranked again ' +
          'without that zone.'));
      }
      if (byKind.screened) {
        BODY.appendChild(line('sub2', plural(byKind.screened, 'objective') + ' screened. ',
          'The text read as an instruction to the agents rather than a research ' +
          'question, so no tool was called and no data was read at all.'));
      }
      if (byKind.fault) {
        BODY.appendChild(line('bad', plural(byKind.fault, 'genuine fault') + '. ',
          'This is not a guardrail. A step was refused for a reason the pipeline ' +
          'does not account for, and it should be looked at. The rows are in ' +
          'Agent steps below.'));
      }
    }

    BODY.appendChild(line('sub2', 'This account cannot alter the record. ',
      'Missions are insert-only for a researcher: no update grant and no delete ' +
      'grant. A mission cannot be rewritten or erased once it exists, including ' +
      'by the person who created it.'));

    BODY.appendChild(line('sub2', 'Want to check rather than take this on trust? ',
      'The access test below sends four requests this account is not supposed to ' +
      'be able to make, against the live database, and prints what comes back.'));
  }

  function refresh() { read().then(say); }

  /* ------------------------------------------------------------------
     REARRANGING WHAT IS ALREADY THERE
     ------------------------------------------------------------------ */

  /* Fold a card's rows away. The table keeps filling underneath:
     loadAudit() writes into it either way, so opening the fold shows
     current rows rather than starting a load. */
  function fold(tableId, noun) {
    var t = doc.getElementById(tableId);
    if (!t) { return; }
    var box = t.closest('.scrolly') || t.parentNode;
    var card = t.closest('.card');
    var ct = card && card.querySelector('.ct');
    if (!ct || ct.querySelector('.ksat-ap-fold')) { return; }

    box.hidden = true;

    var btn = el('button', 'btn ksat-ap-fold');
    btn.type = 'button';

    function count() {
      /* minus one for the header row */
      return Math.max(0, t.rows.length - 1);
    }
    function label() {
      btn.textContent = box.hidden
        ? ('Show the ' + noun + ' (' + count() + ')')
        : ('Hide the ' + noun);
    }
    btn.addEventListener('click', function () {
      box.hidden = !box.hidden;
      label();
    });
    label();

    /* The count is only known after loadAudit() has written the rows. */
    new MutationObserver(label).observe(t, { childList: true, subtree: true });

    ct.appendChild(btn);
  }

  function arrange() {
    var view = doc.getElementById('audit');
    if (!view || doc.getElementById('ksatAuditPlain')) { return; }
    var grid = view.querySelector('.grid');
    if (!grid) { return; }

    PANEL = el('div', 'card s12 ksat-ap');
    PANEL.id = 'ksatAuditPlain';
    var ct = el('div', 'ct');
    ct.appendChild(el('h3', null, 'What this record shows'));
    var re = el('button', 'btn', 'Re-read');
    re.type = 'button';
    re.addEventListener('click', refresh);
    ct.appendChild(re);
    PANEL.appendChild(ct);
    BODY = el('div', 'ksat-ap-body');
    PANEL.appendChild(BODY);

    grid.insertBefore(PANEL, grid.firstChild);

    /* THE PROOF GOES SECOND, NOT FOURTH. The access test is the
       strongest thing on this page and it was below two tables. */
    var at = doc.getElementById('accessTest');
    var atCard = at && at.closest('.card');
    if (atCard && atCard.parentNode === grid) {
      grid.insertBefore(atCard, PANEL.nextSibling);
    }

    fold('auditRuns', 'runs');
    fold('auditSteps', 'steps');

    refresh();
  }

  /* The view loads its own data when it is shown, so re-read then too. */
  function watch() {
    arrange();
    var view = doc.getElementById('audit');
    if (!view || view._ksatApWired) { return; }
    view._ksatApWired = true;
    new MutationObserver(function () {
      if (!view.classList.contains('hidden')) { arrange(); refresh(); }
    }).observe(view, { attributes: true, attributeFilter: ['class'] });
  }

  KS.auditPlain = { refresh: refresh, read: read };

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', watch);
  } else {
    watch();
  }
})();
