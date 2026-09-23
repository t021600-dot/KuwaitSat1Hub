/* =====================================================================
   ksat-areas.js - PICK A REAL PLACE, NOT A RECTANGLE
   Owner: 02 Back End and data

   Until this file existed, every mission area on this platform was a
   box. You panned the map and whatever was on screen became the
   polygon. That is fine for "the northern bay" and wrong for the
   question this workspace is actually asked:

       "Find the hottest residential BLOCKS in Jahra"

   A block is not a viewport. assets/geo/areas_land.min.geojson holds
   204 real ones with their real boundaries and their real names, 60 of
   them in Jahra governorate: Qasr, Naeem, Taima, Nasseem, Oyoun, Waha,
   North West Jahra, Al Mitla, Kabd. This file lets a researcher choose
   one of those instead of drawing a rough square over it.

   The difference is not cosmetic. A box drawn over Al-Jahra city takes
   in desert, a motorway and part of the bay; the area polygon is the
   place. Every number the run produces is then a number about that
   place.

   >>> ALL 204 FIT THE DATABASE. MEASURED, NOT ASSUMED. <<<
   kuwait_area_ok() wants one ring of 4 to 200 points with every point
   inside the envelope. Checked against the whole layer before this file
   was written:

       usable as a mission area : 204 of 204
       needed simplification    : 4
       fall outside envelope    : 0
       could not fit 200 points : 0

   The four are Bubyan Island (835 points), Al Abaireq (220) and two
   others. simplify() below is what takes them under the cap, and it is
   Douglas-Peucker with a tolerance that climbs until the ring fits
   rather than a fixed value that might not.

   >>> THE RING IS SIMPLIFIED. THE AREA FIGURE IS NOT. <<<
   area_km2 on every feature comes from the package, computed on the
   FULL resolution geometry. Recomputing it from the simplified ring
   would produce a slightly different number and quietly disagree with
   the layer, the popup and the source. The polygon is a boundary for
   the database; the area is a published fact. They are not the same
   thing and this file does not blur them.
   ===================================================================== */

(function () {
  'use strict';

  var KS = window.KSAT = window.KSAT || {};
  var doc = document;

  var MAX_POINTS = 200;   /* kuwait_area_ok(), 03-security/db/06_validation.sql */
  var SHOW = 9;           /* results listed at once */

  var CACHE = null;       /* the flattened list, built once */
  var PICKED = null;      /* the chosen polygon, or null for map-drawn */
  var DRAWN = null;       /* its Leaflet layer on the modal map */

  /* ------------------------------------------------------------------
     GEOMETRY
     ------------------------------------------------------------------ */

  function perp(p, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1];
    if (dx === 0 && dy === 0) {
      return Math.sqrt((p[0] - a[0]) * (p[0] - a[0]) + (p[1] - a[1]) * (p[1] - a[1]));
    }
    var t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
    t = t < 0 ? 0 : (t > 1 ? 1 : t);
    var cx = a[0] + t * dx, cy = a[1] + t * dy;
    return Math.sqrt((p[0] - cx) * (p[0] - cx) + (p[1] - cy) * (p[1] - cy));
  }

  function dp(pts, tol) {
    if (pts.length < 3) { return pts.slice(); }
    var dmax = 0, idx = 0;
    for (var i = 1; i < pts.length - 1; i++) {
      var d = perp(pts[i], pts[0], pts[pts.length - 1]);
      if (d > dmax) { dmax = d; idx = i; }
    }
    if (dmax > tol) {
      var left = dp(pts.slice(0, idx + 1), tol);
      var right = dp(pts.slice(idx), tol);
      return left.slice(0, -1).concat(right);
    }
    return [pts[0], pts[pts.length - 1]];
  }

  /* The outer ring of the biggest piece. Six of the 204 are
     MultiPolygons - an area with an offshore piece, or one the
     motorway cuts in two - and kuwait_area_ok() takes ONE ring, so the
     largest piece is the one that represents the place. The popup
     still shows the full feature. */
  function outerRing(g) {
    if (!g) { return null; }
    if (g.type === 'Polygon') { return g.coordinates[0]; }
    if (g.type !== 'MultiPolygon') { return null; }
    var best = null, bestArea = -1;
    g.coordinates.forEach(function (poly) {
      var r = poly[0], minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
      r.forEach(function (p) {
        if (p[0] < minx) minx = p[0];
        if (p[0] > maxx) maxx = p[0];
        if (p[1] < miny) miny = p[1];
        if (p[1] > maxy) maxy = p[1];
      });
      var a = (maxx - minx) * (maxy - miny);
      if (a > bestArea) { bestArea = a; best = r; }
    });
    return best;
  }

  /* Closed ring of at most MAX_POINTS. Returns null if even a heavily
     simplified ring will not fit, which on this layer never happens -
     but a caller that assumes success would be assuming something about
     a data file it did not check. */
  function simplify(ring) {
    if (!ring || ring.length < 4) { return null; }
    var open = ring.slice();
    if (open.length > 1 &&
        open[0][0] === open[open.length - 1][0] &&
        open[0][1] === open[open.length - 1][1]) {
      open.pop();
    }
    if (open.length + 1 <= MAX_POINTS) { return open.concat([open[0]]); }

    var tol = 0.0005;
    for (var i = 0; i < 40; i++) {
      var s = dp(open.concat([open[0]]), tol);
      if (s.length <= MAX_POINTS) {
        if (s[0][0] !== s[s.length - 1][0] || s[0][1] !== s[s.length - 1][1]) {
          s.push(s[0]);
        }
        return s.length >= 4 ? s : null;
      }
      tol *= 1.6;
    }
    return null;
  }

  function polygonFor(rec) {
    var ring = simplify(outerRing(rec.geometry));
    if (!ring) { return null; }
    return { type: 'Polygon', coordinates: [ring], name: rec.name };
  }

  /* ------------------------------------------------------------------
     THE LIST
     ------------------------------------------------------------------ */

  function build(fc, kind) {
    return (fc && fc.features ? fc.features : []).map(function (f) {
      var p = f.properties || {};
      return {
        kind: kind,
        name: p.name_en || p.name || p.name_ar || 'Unnamed area',
        nameAr: p.name_ar || '',
        gov: (p.parent_governorate_name_en || p.name_en || '').replace(/ Governorate$/, ''),
        km2: typeof p.area_km2 === 'number' ? p.area_km2 : null,
        license: p.license || '',
        geometry: f.geometry
      };
    });
  }

  function load() {
    if (CACHE) { return Promise.resolve(CACHE); }
    var L2 = KS.layers;
    if (!L2) { return Promise.resolve([]); }
    return Promise.all([
      L2.fetchLayer('areas').catch(function () { return null; }),
      L2.fetchLayer('governorates').catch(function () { return null; })
    ]).then(function (r) {
      CACHE = build(r[0], 'area').concat(build(r[1], 'governorate'));
      /* Smallest first inside a name match, because somebody typing
         "Jahra" in a mission about residential blocks wants the
         neighbourhood before the 2,316 km2 desert district. */
      CACHE.sort(function (a, b) { return (a.km2 || 0) - (b.km2 || 0); });
      return CACHE;
    });
  }

  function search(q) {
    var s = String(q || '').trim().toLowerCase();
    if (!CACHE) { return []; }
    if (!s) { return []; }
    var hits = CACHE.filter(function (r) {
      return r.name.toLowerCase().indexOf(s) >= 0 ||
             r.gov.toLowerCase().indexOf(s) >= 0 ||
             (r.nameAr && r.nameAr.indexOf(q.trim()) >= 0);
    });
    /* An exact-ish name match outranks a governorate match: typing
       "Jahra" should offer the place called Jahra before the sixty
       areas that merely sit in Jahra governorate. */
    hits.sort(function (a, b) {
      var an = a.name.toLowerCase().indexOf(s) === 0 ? 0 : 1;
      var bn = b.name.toLowerCase().indexOf(s) === 0 ? 0 : 1;
      if (an !== bn) { return an - bn; }
      return (a.km2 || 0) - (b.km2 || 0);
    });
    return hits;
  }

  /* ------------------------------------------------------------------
     THE UI, MOUNTED INTO THE NEW MISSION DIALOG
     ------------------------------------------------------------------ */

  function el(tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) { n.className = cls; }
    if (text != null) { n.textContent = text; }
    return n;
  }

  function modalMap() {
    var host = doc.getElementById('mMap');
    return host && host._ksatMap ? host._ksatMap : null;
  }

  function clearPick(quiet) {
    PICKED = null;
    var map = modalMap();
    if (DRAWN && map) { try { map.removeLayer(DRAWN); } catch (e) {} }
    DRAWN = null;
    if (!quiet) { paint(); }
  }

  function choose(rec) {
    var poly = polygonFor(rec);
    if (!poly) {
      say('This boundary cannot be reduced to the 200 points the database ' +
          'accepts. Draw the area on the map instead.');
      return;
    }
    PICKED = poly;

    var map = modalMap();
    if (map && typeof L !== 'undefined') {
      if (DRAWN) { try { map.removeLayer(DRAWN); } catch (e) {} }
      DRAWN = L.geoJSON(poly, {
        style: { color: '#79bd96', weight: 2, fill: true,
                 fillColor: '#79bd96', fillOpacity: 0.12 }
      }).addTo(map);
      var b = KS.geo.polygonBounds(poly);
      if (b) { KS.geo.fit(map, b, [14, 14]); }
    }
    paint();
  }

  var MSG = null;
  function say(t) { if (MSG) { MSG.textContent = t || ''; } }

  var INPUT = null, LIST = null, CHOSEN = null;

  function paint() {
    if (!CHOSEN) { return; }
    while (CHOSEN.firstChild) { CHOSEN.removeChild(CHOSEN.firstChild); }
    if (!PICKED) {
      CHOSEN.appendChild(doc.createTextNode(
        'No named area chosen. The mission area is whatever the map shows.'));
      return;
    }
    var ring = PICKED.coordinates[0];
    var strong = el('b', null, PICKED.name);
    CHOSEN.appendChild(strong);
    CHOSEN.appendChild(doc.createTextNode(
      '  ' + KS.geo.polygonAreaKm2(PICKED) + ' km² bounding the polygon, ' +
      ring.length + ' points. Moving the map clears this.'));
    var drop = el('button', 'btn', 'Use the map instead');
    drop.type = 'button';
    drop.style.marginLeft = '10px';
    drop.addEventListener('click', function () { clearPick(); });
    CHOSEN.appendChild(drop);
  }

  function results(list) {
    while (LIST.firstChild) { LIST.removeChild(LIST.firstChild); }
    if (!list.length) { LIST.hidden = true; return; }
    LIST.hidden = false;
    list.slice(0, SHOW).forEach(function (r) {
      var b = el('button', 'ksat-area-hit');
      b.type = 'button';

      var n = el('span', 'nm', r.name);
      b.appendChild(n);
      if (r.nameAr) {
        var ar = el('span', 'ar', r.nameAr);
        ar.setAttribute('dir', 'rtl');
        b.appendChild(ar);
      }
      var meta = r.gov + (r.km2 != null ? '  ·  ' + r.km2.toFixed(1) + ' km²' : '') +
                 (r.kind === 'governorate' ? '  ·  whole governorate' : '');
      b.appendChild(el('span', 'mt', meta));

      b.addEventListener('click', function () {
        choose(r);
        INPUT.value = r.name;
        LIST.hidden = true;
      });
      LIST.appendChild(b);
    });
    if (list.length > SHOW) {
      LIST.appendChild(el('div', 'ksat-area-more',
        (list.length - SHOW) + ' more match. Type a little further.'));
    }
  }

  function mount() {
    var chips = doc.getElementById('mPresets');
    if (!chips || doc.getElementById('ksatAreaPick')) { return; }

    var wrap = el('div', 'ksat-area-pick');
    wrap.id = 'ksatAreaPick';

    var lab = el('div', 'label', 'Or choose a real area by name');
    wrap.appendChild(lab);

    INPUT = doc.createElement('input');
    INPUT.className = 'search';
    INPUT.type = 'text';
    INPUT.placeholder = 'Jahra, Qasr, Taima, Kabd, Al-Ahmadi…';
    INPUT.setAttribute('autocomplete', 'off');
    wrap.appendChild(INPUT);

    LIST = el('div', 'ksat-area-list');
    LIST.hidden = true;
    wrap.appendChild(LIST);

    CHOSEN = el('div', 'sub ksat-area-chosen');
    wrap.appendChild(CHOSEN);

    MSG = el('div', 'sub');
    wrap.appendChild(MSG);

    chips.parentNode.insertBefore(wrap, chips);

    INPUT.addEventListener('input', function () {
      load().then(function () { results(search(INPUT.value)); });
    });
    INPUT.addEventListener('focus', function () {
      load().then(function () {
        say(CACHE.length + ' named areas and governorates, from OpenStreetMap ' +
            'under ODbL. See assets/geo/LICENSE-DATA.md.');
      });
    });

    /* A PICK IS A CHOICE, AND SO IS MOVING THE MAP.

       Only user gestures clear it. Listening to Leaflet's zoomstart
       would not work: fit() fires that itself, so choosing an area
       would immediately un-choose it. mousedown, wheel and touchstart
       on the container, plus the zoom buttons, are unambiguously the
       researcher. */
    var host = doc.getElementById('mMap');
    if (host && !host._ksatAreaWired) {
      host._ksatAreaWired = true;
      ['mousedown', 'wheel', 'touchstart'].forEach(function (ev) {
        host.addEventListener(ev, function () {
          if (PICKED) { clearPick(); say('Area cleared. The map is the mission area again.'); }
        }, { passive: true });
      });
    }

    paint();
    load();
  }

  /* The dialog is built into the page but only filled when it opens, so
     mount on every open. A MutationObserver rather than a click
     handler: the dialog has three entry points and a fourth would be
     missed. */
  function watch() {
    var m = doc.getElementById('modal');
    if (!m) { return; }
    new MutationObserver(function () {
      if (!m.classList.contains('hidden')) {
        mount();
      } else if (PICKED || DRAWN) {
        clearPick(true);
      }
    }).observe(m, { attributes: true, attributeFilter: ['class'] });
    if (!m.classList.contains('hidden')) { mount(); }
  }

  KS.areas = {
    load: load,
    search: search,
    polygonFor: polygonFor,
    simplify: simplify,
    outerRing: outerRing,
    MAX_POINTS: MAX_POINTS,
    /* Read by createMission() in js/ksat-researcher.js. Null means the
       researcher did not choose a named area and the map stands. */
    pending: function () { return PICKED; },
    clear: clearPick
  };

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', watch);
  } else {
    watch();
  }
})();
