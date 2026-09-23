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

  /* The Leaflet pane the conceptual "after" vectors are drawn into, so
     the wipe can clip them without clipping the measurement. */
  var AFTER_PANE = 'ksatReportAfter';
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

  function buildMap(host, area, rows) {
    var geo = KS.geo;
    if (!geo || typeof L === 'undefined') { return null; }
    var map = geo.make(host, { view: [29.35, 47.75, 9], minimal: true });
    if (!map) { return null; }
    geo.resize(host);

    if (map._reportLayers) {
      map.removeLayer(map._reportLayers.before);
      map.removeLayer(map._reportLayers.after);
    }

    /* THE AFTER LAYER NEEDS ITS OWN PANE, OR THE WIPE WIPES EVERYTHING.

       Leaflet draws every vector into overlayPane unless it is told
       otherwise. before and after being separate layer groups does not
       separate them on screen: they share one pane, so clipping that
       pane clipped the mission-area rectangle and the measured
       candidate outlines along with the green. Dragging the handle
       wiped between "the whole map" and "a bare basemap" rather than
       between measured and conceptual, which is the one comparison the
       control exists to make.

       AFTER_PANE sits at 450: above overlayPane's 400, below the
       shadow, marker, tooltip and popup panes, so nothing else moves.
       createPane() builds a fresh div every call, hence the guard. */
    if (!map.getPane(AFTER_PANE)) {
      map.createPane(AFTER_PANE).style.zIndex = 450;
    }

    var before = L.layerGroup().addTo(map);
    var after = L.layerGroup();
    map._reportLayers = { before: before, after: after };

    var bounds = L.latLngBounds([]);

    if (area) {
      var ab = geo.polygonBounds(area);
      if (ab) {
        L.rectangle(ab, { color: '#dce9f1', weight: 1, dashArray: '4 3',
                          fill: false }).addTo(before);
        bounds.extend(ab);
      }
    }

    rows.forEach(function (x) {
      var b = geo.polygonBounds(x.geometry);
      if (!b) { return; }
      var isSite = x.kind === 'site';
      /* BEFORE: the zone outlined as measured, unfilled - it is ground,
         not a plan. AFTER: the same rectangle filled green, which is the
         only difference between the two halves of the wipe. */
      L.rectangle(b, { color: isSite ? '#d2ad68' : '#8eb9d8',
                       weight: isSite ? 2 : 1,
                       fill: false }).addTo(before);
      if (isSite) {
        L.rectangle(b, { color: '#79bd96', weight: 2,
                         fill: true, fillColor: '#79bd96',
                         fillOpacity: 0.55,
                         pane: AFTER_PANE }).addTo(after);
        bounds.extend(b);
      }
    });

    if (bounds.isValid()) { geo.fit(map, bounds, [26, 26]); }
    return map;
  }

  /* -------------------------------------------------------------------
     THE WIPE

     One map, with the "after" overlay clipped to a draggable edge. Two
     maps side by side at this column width would be two postage stamps.

     The handle is a range input rather than a div with a mousedown
     listener, so it is reachable from the keyboard and announced by a
     screen reader without any extra work.
     ------------------------------------------------------------------- */
  function wipe(host, map, layers) {
    /* Clip the after pane alone. Falling back to overlayPane would put
       the old behaviour back - everything clipped - so if the pane is
       missing the wipe does nothing rather than something wrong. */
    var pane = map.getPane(AFTER_PANE);
    var box = el('div', 'wipe');
    box.style.height = '330px';

    var seam = el('div', 'seam');
    var range = doc.createElement('input');
    range.type = 'range';
    range.min = '0'; range.max = '100'; range.value = '50';
    range.setAttribute('aria-label',
      'Wipe between the area as measured and the conceptual planted simulation');

    var lTag = el('span', 'tag l', 'AS MEASURED');
    var rTag = el('span', 'tag r green', 'CONCEPTUAL');

    function apply() {
      var pct = Number(range.value);
      /* The after layer is clipped from the left edge inward, so
         dragging left reveals more of the simulation. */
      if (pane) { pane.style.clipPath = 'inset(0 0 0 ' + pct + '%)'; }
      seam.style.left = pct + '%';
    }

    host.appendChild(box);
    box.appendChild(seam);
    box.appendChild(lTag);
    box.appendChild(rTag);
    box.appendChild(range);
    range.addEventListener('input', apply);

    return { box: box, apply: apply, layers: layers };
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

    var pr = el('button', 'btn', 'Print / save as PDF');
    pr.type = 'button';
    pr.addEventListener('click', function () {
      doc.documentElement.classList.add('ksat-printing');
      window.print();
      setTimeout(function () {
        doc.documentElement.classList.remove('ksat-printing');
      }, 800);
    });
    bar.appendChild(pr);
    left.appendChild(bar);

    /* ---- the right column ---- */
    var mapId = 'rpt-map-' + Math.abs(String(opts.missionId || 'x')
      .split('').reduce(function (a, c) { return a + c.charCodeAt(0); }, 0));

    right.appendChild(el('h4', null, 'The ground this report is about'));
    var wrap = el('div');
    right.appendChild(wrap);

    var mapHost = el('div', 'ksat-map');
    mapHost.id = mapId;

    var note = el('div', 'sub');
    right.appendChild(note);
    note.textContent = 'Loading the findings from the database…';

    loadGeometry(opts.missionId).then(function (rows) {
      var sites = rows.filter(function (x) { return x.kind === 'site'; });
      wrap.appendChild(mapHost);
      var map = buildMap(mapHost, opts.mission && opts.mission.area_geojson, rows);
      if (!map) {
        note.textContent = 'The map could not be drawn in this browser. Every ' +
          'coordinate in the report is still in the findings on the mission.';
        return;
      }

      if (sites.length) {
        var w = wipe(wrap, map, map._reportLayers);
        /* the map moves inside the wipe box, so it has to be re-measured */
        w.box.insertBefore(mapHost, w.box.firstChild);
        mapHost.style.height = '330px';
        map._reportLayers.after.addTo(map);
        KS.geo.resize(mapHost);
        w.apply();

        note.textContent = 'Drag the handle. Left of it is the area as KuwaitSat-1 ' +
          'measured it; right of it, the ' + sites.length + ' approved candidate ' +
          'zones drawn as planted. The green is a CONCEPTUAL SIMULATION of the ' +
          'decision in this report, not a prediction and not an observation.';
      } else {
        note.textContent = 'This run produced no candidate zones, so there is ' +
          'nothing to draw as planted. The mission area is outlined.';
      }

      var keys = el('div', 'ksat-keys');
      [['#dce9f1', 'Mission area'], ['#d2ad68', 'Candidate zone, as measured'],
       ['#79bd96', 'Conceptual planting']].forEach(function (p) {
        var s = el('span');
        var i = el('i');
        i.style.background = p[0];
        s.appendChild(i);
        s.appendChild(doc.createTextNode(p[1]));
        keys.appendChild(s);
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
