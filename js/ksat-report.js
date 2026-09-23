/* =====================================================================
   ksat-report.js - THE REPORT, PRESENTED AS A DOCUMENT
   Owner: 01 Front End / 04 Agents

   The Reporting Agent writes ten sections of markdown. Until this file
   existed the page rendered them as one 11px grey column, which is how
   you display log output, not how you display the artefact the whole
   platform exists to produce.

   What this adds, and nothing else:

     1 . the document on the left, the GROUND IT IS ABOUT on the right.
         A report naming five candidate zones by frame and tile, with no
         picture of the place, makes the reader hold coordinates in their
         head.

     2 . a before / after wipe. "Before" is the area as the satellite
         sees it. "After" is the same view with the approved candidate
         zones drawn as planted. It is labelled CONCEPTUAL SIMULATION in
         the corner of the panel and in the download, because it is a
         drawing of a decision, not a prediction.

     3 . download. A researcher who cannot take the report away has not
         been given one.

   >>> THE RULE THIS FILE MUST NOT BREAK <<<
   It presents the report. It does not WRITE any of it. Every sentence
   and every number comes from the markdown the Reporting Agent already
   committed to public.results, so what is on screen and what is in the
   database cannot drift. The only text this file adds is the labelling
   on the simulation panel, which exists to stop the picture being
   mistaken for a measurement.
   ===================================================================== */

(function () {
  'use strict';

  var KS = window.KSAT = window.KSAT || {};

  var doc = document;

  function el(tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }
  function clear(n) { while (n && n.firstChild) { n.removeChild(n.firstChild); } }

  /* -------------------------------------------------------------------
     MARKDOWN, AS NODES

     Same six constructs the Reporting Agent emits, never innerHTML: a
     report body is researcher-authored text at one remove, and the one
     place this platform must not parse hostile text as markup is the
     place that renders findings.

     The single addition over a plain renderer is .caveat. On this
     archive every report contains a paragraph in capitals saying no
     vegetation was detected, and in flat body text a reader skims it -
     after which the list of candidate zones underneath reads as a list
     of green places, which is the exact misreading that paragraph exists
     to prevent. Detecting it is a presentation decision about a sentence
     the agent already wrote; the words are not touched.
     ------------------------------------------------------------------- */
  var SHOUT = /^[A-Z][A-Z ’',-]{14,}/;

  function renderMarkdown(host, md) {
    clear(host);
    var lines = String(md || '').split('\n');
    var ul = null;
    lines.forEach(function (line) {
      if (/^\s*-\s+/.test(line)) {
        if (!ul) { ul = el('ul'); host.appendChild(ul); }
        ul.appendChild(el('li', null, line.replace(/^\s*-\s+/, '')));
        return;
      }
      ul = null;
      if (/^#\s+/.test(line)) { host.appendChild(el('h1', null, line.slice(2))); return; }
      if (/^##\s+/.test(line)) { host.appendChild(el('h2', null, line.slice(3))); return; }
      if (/^---+$/.test(line.trim())) { host.appendChild(el('hr')); return; }
      if (!line.trim()) { return; }
      host.appendChild(el('p', SHOUT.test(line.trim()) ? 'caveat' : null, line));
    });
  }

  /* -------------------------------------------------------------------
     THE GROUND THE REPORT IS ABOUT
     ------------------------------------------------------------------- */

  /* Every polygon this run produced, read back from public.results.
     Not from anything the page held: the findings on screen have to be
     the findings in the database, including here. */
  function loadGeometry(missionId) {
    if (!window.sb) { return Promise.resolve([]); }
    return window.sb.from('results')
      .select('id,kind,title,body,geometry')
      .eq('mission_id', missionId)
      .then(function (r) {
        if (r.error || !r.data) { return []; }
        return r.data.filter(function (x) { return x.geometry; });
      });
  }

  /* THE EXTENT IS COMPUTED ONCE, FOR BOTH FIGURES.

     This is the line between a comparison and two pictures. If each map
     fitted its own contents the AFTER map would frame only the approved
     zones and the BEFORE map the whole mission area, and the two would
     be at different scales over different ground. A reader would be
     invited to compare them and would be comparing nothing. */
  function zoneBounds(area, rows) {
    var geo = KS.geo;
    var b = L.latLngBounds([]);
    if (area) {
      var ab = geo.polygonBounds(area);
      if (ab) { b.extend(ab); }
    }
    rows.forEach(function (x) {
      if (x.kind !== 'site') { return; }
      var r = geo.polygonBounds(x.geometry);
      if (r) { b.extend(r); }
    });
    return b;
  }

  /* ONE BUILDER, CALLED TWICE.

     mode 'before'  the ground as KuwaitSat-1 and the reference imagery
                    measured it. Candidate zones OUTLINED, never filled:
                    they are ground, not a plan.
     mode 'after'   the same ground with the approved zones drawn as the
                    change. Filled green, which is the only difference.

     There used to be one map with a draggable wipe over it. It was
     replaced because a wipe asks a reader to hold half a picture in
     their head while they drag, and because the thing being compared
     here is not a before/after photograph of the same instant: the
     green is a CONCEPTUAL simulation of a decision. Two figures, both
     labelled, let a reader look from one to the other and back. */
  function buildFigure(host, area, rows, mode) {
    var geo = KS.geo;
    if (!geo || typeof L === 'undefined') { return null; }
    var map = geo.make(host, { view: [29.35, 47.75, 9], minimal: true });
    if (!map) { return null; }
    geo.resize(host);

    /* The mission area is identical on both figures. It is the frame of
       reference, so it must not move or change between them. */
    if (area) {
      var ab = geo.polygonBounds(area);
      if (ab) {
        L.rectangle(ab, { color: '#dce9f1', weight: 1, dashArray: '4 3',
                          fill: false }).addTo(map);
      }
    }

    rows.forEach(function (x) {
      var b = geo.polygonBounds(x.geometry);
      if (!b) { return; }
      var isSite = x.kind === 'site';

      if (mode === 'before') {
        L.rectangle(b, { color: isSite ? '#d2ad68' : '#8eb9d8',
                         weight: isSite ? 2 : 1,
                         fill: false }).addTo(map);
        return;
      }

      if (isSite) {
        L.rectangle(b, { color: '#79bd96', weight: 2, fill: true,
                         fillColor: '#79bd96', fillOpacity: 0.55 }).addTo(map);
      } else {
        /* A non-site finding stays on the AFTER map, dimmed. Dropping it
           would make the two figures differ in a second way and the
           reader could not tell which difference was the decision. */
        L.rectangle(b, { color: '#8eb9d8', weight: 1, opacity: 0.3,
                         fill: false }).addTo(map);
      }
    });

    return map;
  }

  /* -------------------------------------------------------------------
     DOWNLOAD
     ------------------------------------------------------------------- */
  function download(name, mime, text) {
    var blob = new Blob([text], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = doc.createElement('a');
    a.href = url; a.download = name;
    doc.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function slug(s) {
    return String(s || 'mission-report').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  }

  /* -------------------------------------------------------------------
     PRESENT

     opts = { host, md, mission, missionId, title, onSign }
     ------------------------------------------------------------------- */
  function present(opts) {
    var host = typeof opts.host === 'string' ? doc.getElementById(opts.host) : opts.host;
    if (!host) { return; }
    clear(host);

    /* .md carries max-width:68ch, which is the right measure for ONE
       column of prose and the wrong one for a host holding two. Left as
       it was, the 460px map column took its width out of 529px and the
       prose was left with 43px: one word per line, for the whole
       report. The class moves the clamp off the host and onto the prose
       column below, where the measure actually belongs. */
    host.classList.add('reporthost');

    var grid = el('div', 'reportgrid');
    var left = el('div', 'reportmain');
    var right = el('div', 'reportaside');
    grid.appendChild(left);
    grid.appendChild(right);
    host.appendChild(grid);

    renderMarkdown(left, opts.md);

    /* the toolbar sits with the document, not with the panel chrome, so
       it travels wherever the report is shown */
    var bar = el('div', 'bar');
    bar.style.margin = '20px 0 0';
    var dl = el('button', 'btn', 'Download the report (.md)');
    dl.type = 'button';
    dl.addEventListener('click', function () {
      download(slug(opts.title) + '.md', 'text/markdown;charset=utf-8', opts.md || '');
    });
    bar.appendChild(dl);

    var pr = el('button', 'btn', 'Save as PDF');
    pr.type = 'button';
    pr.addEventListener('click', function () {
      /* MARK WHAT TO PRINT, DO NOT NAME WHERE IT LIVES.

         The print stylesheet used to hide `.view:not(#reports)`, which
         meant this button produced a BLANK PAGE from the mission detail
         panel and from the Research Console, because the report renders
         into #mdReport and #rrReport in those two views and both were
         hidden by that selector. Three surfaces render a report and
         only one of them could print it.

         Stamping the host instead means the stylesheet never has to
         know which of the three it is. */
      host.classList.add('ksat-print-this');
      doc.documentElement.classList.add('ksat-printing');
      window.print();
      setTimeout(function () {
        doc.documentElement.classList.remove('ksat-printing');
        host.classList.remove('ksat-print-this');
      }, 800);
    });
    bar.appendChild(pr);
    left.appendChild(bar);

    /* ---- the right column: two figures, one extent ---- */
    right.appendChild(el('h4', null, 'The ground this report is about'));

    var note = el('div', 'sub');
    note.textContent = 'Loading the findings from the database\u2026';
    right.appendChild(note);

    var figWrap = el('div', 'figs');
    right.appendChild(figWrap);

    function figure(nLabel, caption) {
      var f = el('figure', 'fig');
      var cap = el('figcaption');
      cap.appendChild(el('b', null, nLabel));
      cap.appendChild(doc.createTextNode(' ' + caption));
      f.appendChild(cap);
      var host = el('div', 'ksat-map');
      f.appendChild(host);
      figWrap.appendChild(f);
      return host;
    }

    loadGeometry(opts.missionId).then(function (rows) {
      var area = opts.mission && opts.mission.area_geojson;
      var sites = rows.filter(function (x) { return x.kind === 'site'; });

      var hostA = figure('Figure 1. As measured.',
        'The mission area, and every finding this run produced, outlined ' +
        'where the measurement put it.');
      var hostB = figure('Figure 2. With the approved zones.',
        sites.length
          ? ('The same ground and the same extent, with the ' + sites.length +
             ' zone' + (sites.length === 1 ? '' : 's') + ' the researcher approved ' +
             'drawn as the change.')
          : 'This run produced no candidate zones, so nothing is drawn as changed.');

      var mBefore = buildFigure(hostA, area, rows, 'before');
      var mAfter = buildFigure(hostB, area, rows, 'after');

      if (!mBefore || !mAfter) {
        note.textContent = 'The maps could not be drawn in this browser. Every ' +
          'coordinate in the report is still in the findings on the mission.';
        return;
      }

      /* BOTH FITTED TO THE SAME BOUNDS. See zoneBounds. */
      var b = zoneBounds(area, rows);
      if (b.isValid()) {
        KS.geo.fit(mBefore, b, [26, 26]);
        KS.geo.fit(mAfter, b, [26, 26]);
      }
      KS.geo.resize(hostA);
      KS.geo.resize(hostB);

      note.textContent = sites.length
        ? ('Two figures of the same ground at the same extent. The green on ' +
           'Figure 2 is a CONCEPTUAL SIMULATION of the decision in this report: ' +
           'it is not a prediction and not an observation.')
        : 'The mission area is outlined on both figures.';

      var keys = el('div', 'ksat-keys');
      [['#dce9f1', 'Mission area'], ['#d2ad68', 'Candidate zone, as measured'],
       ['#79bd96', 'Approved zone, drawn as the change']].forEach(function (p) {
        var sp = el('span');
        var ic = el('i');
        ic.style.background = p[0];
        sp.appendChild(ic);
        sp.appendChild(doc.createTextNode(p[1]));
        keys.appendChild(sp);
      });
      right.appendChild(keys);
    });

    if (opts.onSign) {
      var sign = el('button', 'btn primary', 'Sign and publish this report');
      sign.type = 'button';
      sign.style.marginTop = '12px';
      sign.addEventListener('click', function () { opts.onSign(sign); });
      bar.insertBefore(sign, bar.firstChild);
    }
  }

  KS.report = { present: present, renderMarkdown: renderMarkdown, download: download };
})();
