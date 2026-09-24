/* =====================================================================
   ksat-checkpoint-figures.js — THE BEFORE AND AFTER, WHERE THE DECISION
   IS ACTUALLY MADE
   Owner: 01 Front End

   THE GAP THIS CLOSES. The two figures existed, and they were in the
   report — which is written AFTER the researcher has already decided.
   The Human checkpoint, the one screen where a person looks at the
   greenery analysis and says yes or no, showed a table of numbers and
   three buttons. No map. The brief asks for the result of the
   environmental analysis to be visually understandable at that stage,
   and a spreadsheet is not that.

   So the same two figures are drawn on the checkpoint card, from the
   SAME code: js/ksat-report.js now exports buildFigure, zoneBounds and
   loadGeometry, and this file calls them. A second implementation would
   have drifted from the first the moment either changed.

   ------------------------------------------------------------------
   THE CAPTIONS ARE DIFFERENT, AND THAT IS THE POINT
   ------------------------------------------------------------------
   In the report, Figure 2 is "With the approved zones" — past tense,
   because by then the researcher approved them. Here nothing has been
   approved yet; the researcher is looking at the figure in order to
   decide. So it reads PROPOSED, and it says in the caption that the
   green is a conceptual simulation rather than an observation.

   Getting that tense wrong would be the worst kind of error on this
   particular screen: a picture that tells someone their decision has
   already been made.

   ------------------------------------------------------------------
   WHY A MutationObserver, AGAIN
   ------------------------------------------------------------------
   checkpoint() in js/ksat-researcher.js does clear(box) and rebuilds
   the zones table — on first arrival AND on every Reject-and-re-rank.
   Drawing once would put the figures on the first candidate set and
   leave them there while the researcher re-ranked past it, which is
   worse than not drawing them at all.

   The maps are torn down and rebuilt with the table, because a Leaflet
   instance whose container has been removed from the document is a
   memory leak with a stale map inside it.

   ONE EXTRA READ, AND ONLY ONE. The candidate geometry is already in
   public.results by the time the checkpoint fires — rank() commits the
   kind==='site' rows before it pauses — so loadGeometry() answers from
   what is already there. The mission AREA is the one thing not on the
   page, so it is fetched once per mission and cached. If that read
   fails the figures still draw: zoneBounds falls back to the site rows
   and both maps still share one extent, which is the property that
   makes them comparable.
   ===================================================================== */
(function (w, doc) {
  'use strict';

  var KS = w.KSAT = w.KSAT || {};
  if (KS.checkpointFigures) { return; }

  var BOX_ID = 'cpFindings';
  var WRAP_CLS = 'ksat-cf-wrap';
  var areaCache = {};

  function el(tag, cls, txt) {
    var n = doc.createElement(tag);
    if (cls) { n.className = cls; }
    if (txt !== undefined && txt !== null) { n.textContent = txt; }
    return n;
  }

  function missionId() {
    var sel = doc.getElementById('runMission');
    return (sel && sel.value) ? sel.value : null;
  }

  function loadArea(id) {
    if (!id) { return Promise.resolve(null); }
    if (Object.prototype.hasOwnProperty.call(areaCache, id)) {
      return Promise.resolve(areaCache[id]);
    }
    if (!w.sb) { return Promise.resolve(null); }
    return w.sb.from('missions').select('area_geojson').eq('id', id).single()
      .then(function (r) {
        var a = (r && r.data) ? r.data.area_geojson : null;
        areaCache[id] = a;
        return a;
      }, function () { areaCache[id] = null; return null; });
  }

  function figure(wrap, label, caption) {
    var f = el('figure', 'fig');
    var cap = el('figcaption');
    cap.appendChild(el('b', null, label));
    cap.appendChild(doc.createTextNode(' ' + caption));
    f.appendChild(cap);
    var host = el('div', 'ksat-map');
    f.appendChild(host);
    wrap.appendChild(f);
    return host;
  }

  function draw(box) {
    var R = KS.report;
    if (!R || !R.buildFigure || !KS.geo || typeof w.L === 'undefined') { return; }

    var wrap = el('div', WRAP_CLS);
    var head = el('div', 'ksat-cf-head', 'What you are deciding about');
    var note = el('div', 'sub ksat-cf-note', 'Drawing the ground…');
    wrap.appendChild(head);
    wrap.appendChild(note);
    var figs = el('div', 'figs');
    wrap.appendChild(figs);
    box.appendChild(wrap);

    var id = missionId();

    Promise.all([R.loadGeometry(id), loadArea(id)]).then(function (res) {
      var rows = res[0] || [];
      var area = res[1];
      var sites = rows.filter(function (x) { return x.kind === 'site'; });

      if (!rows.length) {
        note.textContent = 'No geometry has been written for this run yet, so ' +
          'there is nothing to draw. The table above is the full finding.';
        return;
      }

      var hostA = figure(figs, 'Figure 1. As measured.',
        'The run area, and every zone this run found, outlined where the ' +
        'measurement put it.');
      var hostB = figure(figs, 'Figure 2. Proposed.',
        sites.length
          ? ('The same ground at the same extent, with the ' + sites.length +
             ' candidate zone' + (sites.length === 1 ? '' : 's') +
             ' drawn as the change they would make.')
          : 'This run produced no candidate zones, so nothing is drawn as changed.');

      var mA = R.buildFigure(hostA, area, rows, 'before');
      var mB = R.buildFigure(hostB, area, rows, 'after');
      if (!mA || !mB) {
        note.textContent = 'The maps could not be drawn in this browser. Every ' +
          'coordinate is still in the table above.';
        return;
      }

      /* ONE EXTENT FOR BOTH. Without this the two maps frame different
         ground at different scales and the comparison means nothing. */
      var b = R.zoneBounds(area, rows);
      if (b && b.isValid()) {
        KS.geo.fit(mA, b, [22, 22]);
        KS.geo.fit(mB, b, [22, 22]);
      }
      KS.geo.resize(hostA);
      KS.geo.resize(hostB);

      note.textContent = sites.length
        ? 'Two views of the same ground at the same extent. The green on ' +
          'Figure 2 is a CONCEPTUAL SIMULATION of what you are being asked ' +
          'to approve. It is not a prediction and not an observation.'
        : 'The run area is outlined on both figures.';

      var keys = el('div', 'ksat-keys');
      [['#dce9f1', 'Run area'], ['#d2ad68', 'Candidate zone, as measured'],
       ['#79bd96', 'Proposed change, simulated']].forEach(function (p) {
        var sp = el('span');
        var ic = el('i');
        ic.style.background = p[0];
        sp.appendChild(ic);
        sp.appendChild(doc.createTextNode(p[1]));
        keys.appendChild(sp);
      });
      wrap.appendChild(keys);
    });
  }

  function sweep() {
    var box = doc.getElementById(BOX_ID);
    if (!box) { return; }
    var hasTable = !!box.querySelector('table.zones');
    var hasFigs = !!box.querySelector('.' + WRAP_CLS);

    if (hasTable && !hasFigs) { draw(box); return; }

    /* The table went away: the checkpoint closed, or a re-rank is in
       flight. Drop the figures with it rather than leaving maps whose
       candidate set no longer exists on screen. */
    if (!hasTable && hasFigs) {
      var old = box.querySelector('.' + WRAP_CLS);
      if (old) { old.parentNode.removeChild(old); }
    }
  }

  KS.checkpointFigures = { sweep: sweep };

  function start() {
    var box = doc.getElementById(BOX_ID);
    if (!box) { return; }
    sweep();
    new w.MutationObserver(function () { sweep(); })
      .observe(box, { childList: true });
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
}(window, document));
