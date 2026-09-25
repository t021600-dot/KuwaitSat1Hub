/* =====================================================================
   ksat-missions-map.js - EVERY MISSION, ON THE REAL KUWAIT
   Owner: 01 Front end

   The Missions view was a table. A column headed AREA that read "Drawn
   on the map" was the only hint that a mission had any ground attached
   to it at all, and a researcher comparing two missions had to open
   each one to find out whether they even overlapped.

   This puts the real coastline above the table with every one of this
   account's mission areas drawn on it. Click an area, open the mission.

   >>> IT IS THE REAL COASTLINE, NOT A SKETCH <<<
   assets/geo/kuwait_land.min.geojson via KS.layers.load, which is
   OpenStreetMap under ODbL and carries the attribution with it. The
   public page still draws a thirteen-point hand-made outline that
   overlaps the real mainland by IoU 0.71; this does not.

   >>> IT READS THE DATABASE, NOT THE TABLE <<<
   js/ksat-researcher.js exports nothing on window.KSAT - MISSIONS is a
   private closure - and its own header says a panel is never drawn
   from a local variable when the database could be asked. So this
   selects for itself, with NAMED COLUMNS: 03-security/db/03_grants.sql
   grants columns individually and PostgREST refuses the whole request
   if one is ungranted, so select('*') fails by design.

   >>> LEAFLET IN A HIDDEN VIEW HAS NO SIZE <<<
   show() toggles .hidden on the section. A map built while the section
   is hidden measures 0x0 and stays that way. Built on first reveal,
   resized on every reveal after, via a MutationObserver on the
   section's class - the same hook js/ksat-areas.js uses on #modal,
   because onShow() in ksat-researcher.js knows nothing about this file
   and must not be edited to learn.

   Every programmatic move is animate:false. On this platform an
   animated Leaflet move silently does nothing when rAF does not fire,
   which is the case in a background tab.
   ===================================================================== */

(function () {
  'use strict';

  var KS = window.KSAT = window.KSAT || {};
  var doc = document;

  var MAP = null, LAYER = null, MSG = null, WRAP = null;
  var PENDING = null;

  var STYLE = {
    complete: { color: '#79bd96', weight: 2, fill: true, fillOpacity: 0.12 },
    review:   { color: '#8eb9d8', weight: 2, fill: true, fillOpacity: 0.12 },
    queued:   { color: '#d2ad68', weight: 2, fill: true, fillOpacity: 0.12 },
    running:  { color: '#d2ad68', weight: 2, fill: true, fillOpacity: 0.12 },
    failed:   { color: '#d88484', weight: 1.6, dashArray: '4 3', fill: false },
    draft:    { color: '#8e9aa5', weight: 1.4, dashArray: '3 3', fill: true, fillOpacity: 0.06 }
  };

  function el(tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) { n.className = cls; }
    if (text != null) { n.textContent = text; }
    return n;
  }

  function say(t) { if (MSG) { MSG.textContent = t || ''; } }

  /* ------------------------------------------------------------------
     THE PANEL
     ------------------------------------------------------------------ */
  function build() {
    var table = doc.getElementById('missionTable');
    if (!table || doc.getElementById('ksatMissionsMap')) { return null; }
    var card = table.closest('.card');
    if (!card || !card.parentNode) { return null; }

    WRAP = el('div', 'card s12');
    WRAP.id = 'ksatMissionsMap';

    var ct = el('div', 'ct');
    ct.appendChild(el('h3', null, 'Where your runs are'));
    var fit = el('button', 'btn', 'Fit to my runs');
    fit.type = 'button';
    fit.addEventListener('click', function () { fitAll(true); });
    ct.appendChild(fit);
    WRAP.appendChild(ct);

    var host = el('div', 'ksat-map');
    host.id = 'mxMap';
    host.style.height = '320px';
    WRAP.appendChild(host);

    WRAP.appendChild(el('div', 'ksat-keys', ''));
    WRAP.lastChild.id = 'mxKeys';

    MSG = el('div', 'said');
    MSG.id = 'mxMsg';
    WRAP.appendChild(MSG);

    card.parentNode.insertBefore(WRAP, card);

    var geo = KS.geo;
    if (!geo || typeof L === 'undefined') {
      say('The map library did not load, so the mission areas cannot be drawn. ' +
          'The table below is unaffected.');
      return null;
    }

    MAP = geo.make(host, { view: [29.35, 47.75, 8], minimal: true });
    if (!MAP) { say('The map could not be created.'); return null; }

    /* The real coastline, and the licence that travels with it. */
    if (KS.layers) {
      KS.layers.load(MAP, 'land', {
        style: { color: '#dce9f1', weight: 1.2, fill: false }
      }).then(function (gj) { gj.addTo(MAP); })
        .catch(function () { say('The coastline layer could not be read.'); });
      KS.layers.load(MAP, 'islands', {
        style: { color: '#9fc5dc', weight: 0.9, fill: true, fillOpacity: 0.1 }
      }).then(function (gj) { gj.addTo(MAP); }).catch(function () {});
    }

    LAYER = L.layerGroup().addTo(MAP);
    legend();
    return MAP;
  }

  function legend() {
    var n = doc.getElementById('mxKeys');
    if (!n) { return; }
    while (n.firstChild) { n.removeChild(n.firstChild); }
    [['Complete', '#79bd96'], ['Awaiting review', '#8eb9d8'],
     ['Running', '#d2ad68'], ['Draft', '#8e9aa5'], ['Stopped', '#d88484']]
      .forEach(function (p) {
        var s = el('span');
        var i = el('i');
        i.style.background = p[1];
        s.appendChild(i);
        s.appendChild(doc.createTextNode(p[0]));
        n.appendChild(s);
      });
  }

  /* ------------------------------------------------------------------
     DRAW
     ------------------------------------------------------------------ */
  function draw(rows) {
    if (!MAP || !LAYER) { return; }
    var geo = KS.geo;
    LAYER.clearLayers();

    var drawn = 0, skipped = 0;
    rows.forEach(function (m) {
      var a = m.area_geojson;
      if (!a || a.type !== 'Polygon') { skipped++; return; }
      var st = STYLE[m.status] || STYLE.draft;
      var gj = L.geoJSON(a, { style: st });

      var d = el('div');
      var h = el('h4', null, m.title || 'Untitled');
      d.appendChild(h);
      var sub = el('div', 'sub');
      sub.textContent = String(m.status || '').toUpperCase() + '  ·  ' +
        geo.polygonTrueAreaKm2(a) + ' km²' +
        (a.name ? '  ·  ' + a.name : '');
      d.appendChild(sub);

      /* Opening the mission is the page's own job. Reuse the row it
         already listens for rather than inventing a second path. */
      var b = el('button', 'btn', 'Open the mission');
      b.type = 'button';
      b.addEventListener('click', function () {
        var tr = doc.querySelector('#missionTable tr[data-mid="' + m.id + '"]');
        if (tr) { tr.click(); }
      });
      d.appendChild(b);

      gj.bindPopup(d);
      gj.addTo(LAYER);
      drawn++;
    });

    /* THE CAPTION IS GONE, and the licence credit is not.

       This said "N missions drawn on the real coastline. Click an area
       to open its mission. Boundaries are OpenStreetMap under ODbL; see
       assets/geo/LICENSE-DATA.md." Removed on request.

       The ODbL credit survives because it was never only here:
       js/ksat-layers.js adds it to Leaflet's own attribution control on
       every map it loads a layer into, and this map calls
       KS.layers.load for both 'land' and 'islands'. The obligation is
       met on the map itself, which is where a map credit belongs. If
       that ever stops being true, this sentence has to come back. */
    say('');

    fitAll(false);
  }

  function fitAll(force) {
    if (!MAP || !LAYER) { return; }
    var b = null;
    LAYER.eachLayer(function (l) {
      if (!l.getBounds) { return; }
      b = b ? b.extend(l.getBounds()) : L.latLngBounds(l.getBounds());
    });
    if (!b || !b.isValid()) {
      if (force) { KS.geo.goTo(MAP, 29.35, 47.75, 8); }
      return;
    }
    KS.geo.fit(MAP, b, [28, 28]);
  }

  /* ------------------------------------------------------------------
     READ

     Named columns only. See the header.
     ------------------------------------------------------------------ */
  function load() {
    if (!window.sb) { say('Not signed in, so there is nothing to draw.'); return; }
    return window.sb.from('missions')
      .select('id,title,status,area_geojson,created_at')
      .order('created_at', { ascending: false })
      .then(function (r) {
        if (r.error) {
          say('The mission areas could not be read: ' + r.error.message);
          return;
        }
        draw(r.data || []);
      });
  }

  /* The table repaints on every load; follow it rather than polling. */
  function follow() {
    var table = doc.getElementById('missionTable');
    if (!table || table._ksatMxWired) { return; }
    table._ksatMxWired = true;
    var t = null;
    new MutationObserver(function () {
      clearTimeout(t);
      t = setTimeout(function () { if (MAP) { load(); } }, 200);
    }).observe(table, { childList: true });
  }

  /* ------------------------------------------------------------------
     SHOW / RESIZE
     ------------------------------------------------------------------ */
  function reveal() {
    if (!MAP) {
      MAP = build();
      if (MAP) { follow(); load(); }
      return;
    }
    KS.geo.resize('mxMap');
    if (PENDING) { PENDING = null; load(); }
  }

  function watch() {
    var sec = doc.getElementById('missions');
    if (!sec || sec._ksatMxWired) { return; }
    sec._ksatMxWired = true;
    new MutationObserver(function () {
      if (!sec.classList.contains('hidden')) { reveal(); }
    }).observe(sec, { attributes: true, attributeFilter: ['class'] });
    if (!sec.classList.contains('hidden')) { reveal(); }
  }

  KS.missionsMap = {
    reload: load,
    map: function () { return MAP; }
  };

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', watch);
  } else {
    watch();
  }
})();
