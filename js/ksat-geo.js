/* =====================================================================
   ksat-geo.js - MAPS, GEOREFERENCING AND THE PIXELS
   Owner: 01 Front End / 02 Back End

   Three separate jobs live in this file. They are together because they
   all speak the same language - degrees, metres and pixels - and keeping
   the conversions in one place is the only way they stay consistent.

     1 . THE MAP. A thin factory over Leaflet 1.9.4, which is VENDORED at
         vendor/leaflet.js. It is not loaded from a CDN and it must not
         be: vercel.json sets script-src 'self', so a cdnjs tag is
         blocked outright and the map silently never appears. The same
         header decides the tiles - img-src lists openstreetmap.org,
         basemaps.cartocdn.com and tiles.maps.eox.at, and nothing else
         will load. Adding a basemap means editing vercel.json too.

     2 . GEOREFERENCING. A KuwaitSat-1 frame arrives as a picture with a
         centre coordinate, a ground sample distance and a pixel size,
         and nothing else. That is enough to put a rectangle on a map and
         to turn any pixel box inside the frame into a lat/lon box - but
         only under assumptions that are WRITTEN DOWN in FOOTPRINT_NOTE
         below and repeated to the researcher everywhere a footprint is
         drawn. The frames carry no attitude, so north is assumed to be
         up; they carry no camera model, so the projection is assumed
         flat. Both are approximations and both are stated.

     3 . THE PIXELS. analyseFrame() is the only place in this platform
         that measures anything from the imagery itself. It computes a
         visible-band greenness index per tile. What that index can and
         cannot support is in INDEX_NOTE, and the Environmental Analysis
         agent quotes it into the audit trail rather than paraphrasing
         it, so the limitation travels with the finding.

   NOTHING HERE IS A SECURITY CONTROL. The Kuwait envelope below is the
   same envelope as public.kuwait_area_ok() in 03-security/db/06_validation.sql,
   and it is here so a researcher is told "that is outside Kuwait" while
   they are still drawing rather than after the insert is refused. The
   database check is the real one; this is the courtesy copy. If the two
   ever disagree, the database wins and this file is the one that is wrong.
   ===================================================================== */

(function () {
  'use strict';

  var KS = window.KSAT = window.KSAT || {};

  /* -------------------------------------------------------------------
     THE ENVELOPE.  Mirrors public.kuwait_area_ok(jsonb).
     ------------------------------------------------------------------- */
  /* MATCHES public.kuwait_area_ok() AND MUST CONTINUE TO.

     This is the courtesy copy: it clips the map view so a researcher is
     told "that is outside Kuwait" while they are still dragging, rather
     than after the insert is refused. The database check is the real
     one. If the two ever disagree the database wins and this line is
     the bug.

     >>> THESE TWO NUMBERS CHANGE AS A PAIR. <<<

     Widened 2026-09-23, after 03-security/db/14_widen_mission_envelope.sql
     was run by hand against the live database. Both halves are in step.

     The old 46.5-48.8 E / 28.5-30.1 N excluded, measured against the
     layers now in assets/geo/: 31 % of the EEZ, 65 % of the contiguous
     zone, 6 % of the territorial sea and a 12 km2 strip of land north
     of 30.1 N. The new bound excludes zero of all five.

     If a mission insert is ever refused with `missions_area_shape` for
     an area that looks correct on the map, these two have drifted
     apart: the database is the one that decides, and this line is then
     the one that is wrong. createMission() in js/ksat-researcher.js
     detects exactly that case and says so.

     IT IS A RECTANGLE, NOT A MAP OF KUWAIT. It includes sea, and parts
     of Iraq and Iran. For "is this on Kuwaiti land", ask
     KS.layers.onKuwaitiLand() in js/ksat-layers.js, which tests the
     actual coastline. */
  var KUWAIT = { west: 46.5, east: 49.6, south: 28.5, north: 30.15 };

  var FOOTPRINT_NOTE =
    'Footprints are computed from the frame centre, the 39 m ground sample ' +
    'distance and the pixel dimensions. The payload record carries no ' +
    'attitude, so north is assumed to be up and no rotation is applied, and ' +
    'the ground is treated as flat at the frame centre. Treat a footprint as ' +
    'an indication of extent, not as a survey boundary.';

  var INDEX_NOTE =
    'Greenness is the Excess Green index on the visible bands, ExG = 2g - r - b ' +
    'on chromatic coordinates. KuwaitSat-1 carries no near infrared band, so ' +
    'NDVI cannot be computed and this is a proxy, not a vegetation measurement. ' +
    'The frames are JPEG, raw decoded, with no radiometric or atmospheric ' +
    'correction and no illumination normalisation between passes, so values ' +
    'are comparable within one frame and not between frames.';

  /* >>> MEASURED ON THE REAL ARCHIVE, 23 Sep 2026. READ THIS BEFORE
         CHANGING VEG_EXG OR THE RANKING. <<<

     Frame 07, Al-Khiran and the Wafra plain - the most agricultural
     ground KuwaitSat-1 has photographed - was measured at four grid
     resolutions, from 2.47 km tiles down to 309 m tiles:

         tile     ExG min    median    max     tiles with ExG > 0
         2472 m   -0.050     -0.033    -0.021  0 of 64
         1236 m   -0.056     -0.033    -0.012  0 of 256
          618 m   -0.058     -0.033    -0.009  0 of 1024
          309 m   -0.054     -0.033    -0.001  0 of 4096

     NOT ONE TILE REACHES ZERO, let alone the 0.05 that the Excess Green
     literature uses for vegetation. ExG = 0 is neutral grey; negative
     means the ground is redder than neutral, which is what sand is. The
     median sits at -0.033 at every resolution: that is the desert, and
     it does not move.

     So the honest reading of this archive is: THERE IS NO VEGETATION IN
     IT THAT A VISIBLE-BAND INDEX CAN DETECT. That is not a bug in this
     file and it is not a threshold that needs loosening. Lowering
     VEG_EXG until something "counts as vegetation" would be choosing the
     answer first, and the number it produced would mean nothing.

     What IS in the data is a real gradient: the brightest tile climbs
     from -0.021 to -0.001 as the tiles get smaller, and its distance
     from the median rises from 2.6 to 5.7 standard deviations. Something
     locally greener is being averaged away at coarse scales. It may be
     an irrigated plot; it may equally be damp ground, a road, or a
     building. This platform cannot tell the difference and does not
     claim to.

     That is why the pipeline ranks by RELATIVE greenness within one
     frame, reports it as "the least red ground in this frame", and says
     in the same breath that no vegetation was detected. See rank() in
     js/ksat-agents.js. */
  var EVIDENCE_NOTE =
    'No tile in this archive reaches the Excess Green threshold for vegetation, ' +
    'at any grid resolution tested down to 309 m. Candidate zones are therefore ' +
    'ranked by relative greenness WITHIN a frame - they are the least red ground ' +
    'in it - and that is a place to look, not detected vegetation. On an ' +
    'uncalibrated visible-band frame the difference is equally consistent with ' +
    'soil colour, soil moisture or a built surface.';

  /* Metres per degree. The lat figure is the WGS84 mean; the lon figure
     is the equatorial value scaled by the cosine of the latitude, which
     is accurate to better than a metre per kilometre at this latitude
     and far inside the error the no-rotation assumption already costs. */
  var M_PER_DEG_LAT = 110574;
  function mPerDegLon(lat) { return 111320 * Math.cos(lat * Math.PI / 180); }

  function clampLon(x) { return Math.min(KUWAIT.east, Math.max(KUWAIT.west, x)); }
  function clampLat(y) { return Math.min(KUWAIT.north, Math.max(KUWAIT.south, y)); }
  function r5(n) { return Math.round(n * 1e5) / 1e5; }

  function inEnvelope(lat, lon) {
    return lat >= KUWAIT.south && lat <= KUWAIT.north &&
           lon >= KUWAIT.west && lon <= KUWAIT.east;
  }

  /* -------------------------------------------------------------------
     A RECTANGLE, AS THE DATABASE WANTS IT

     public.missions.area_geojson is checked by kuwait_area_ok(), which
     wants exactly this: type Polygon, ONE ring, between 4 and 200
     points, every point a two-number array, every longitude inside
     46.5..48.8 and every latitude inside 28.5..30.1.

     GeoJSON order is [longitude, latitude] - RFC 7946 section 3.1.1 -
     and getting that backwards is the single most common way to write a
     polygon the check refuses, because 29 is not a valid Kuwaiti
     longitude. The ring closes on its first point.

     Extra keys are allowed: kuwait_area_ok only inspects type and
     coordinates, so `name` travels with the polygon and gives the map
     and the report something to call the area.
     ------------------------------------------------------------------- */
  function rectPolygon(south, west, north, east, name) {
    var s = clampLat(Math.min(south, north));
    var n = clampLat(Math.max(south, north));
    var w = clampLon(Math.min(west, east));
    var e = clampLon(Math.max(west, east));

    /* CLAMPING A RECTANGLE THAT IS ENTIRELY OUTSIDE KUWAIT COLLAPSES IT
       ONTO AN EDGE, AND THE RESULT STILL PASSES kuwait_area_ok.

       Pan the New Mission map south into the Gulf, or west into Saudi
       Arabia, and every corner clamps to the same latitude or the same
       longitude. What comes out is a valid GeoJSON Polygon with four
       corners and zero area, sitting on the border. The database accepts
       it - every point IS inside the envelope - the mission is created
       reading "about 0 km2", and the run then stalls with "no archive
       frame is inside this mission area", which tells the researcher
       nothing about what actually went wrong.

       A degenerate rectangle is not an area of interest. Return null and
       let the caller say so in words. 1e-4 degrees is about 11 m: below
       that there is nothing a 39 m/px sensor could resolve anyway. */
    if ((e - w) < 1e-4 || (n - s) < 1e-4) { return null; }

    var p = {
      type: 'Polygon',
      coordinates: [[
        [r5(w), r5(s)], [r5(e), r5(s)], [r5(e), r5(n)], [r5(w), r5(n)], [r5(w), r5(s)]
      ]]
    };
    if (name) p.name = String(name).slice(0, 80);
    return p;
  }

  /* The named areas offered in the New Mission dialog. Every one of them
     is inside the envelope; they exist so that a researcher who does not
     want to pan a map still creates a REAL polygon rather than a note. */
  var PRESETS = [
    { id: 'all',     label: 'Whole of Kuwait',            s: 28.55, w: 46.55, n: 30.05, e: 48.45 },
    { id: 'bay',     label: 'Kuwait Bay and the capital', s: 29.15, w: 47.55, n: 29.60, e: 48.30 },
    { id: 'bubiyan', label: 'Bubiyan and Khor as-Sabiya', s: 29.55, w: 47.90, n: 30.05, e: 48.45 },
    /* The city itself, not the governorate. KuwaitSat-1 has no frame
       over either, so a mission here runs on public reference imagery -
       see js/ksat-reference.js. The tight box matters: the whole north
       west is 100 km across, and at that size the Sentinel-2 mosaic
       drops to a zoom where a grid cell is kilometres wide. */
    { id: 'jahracity', label: 'Al-Jahra city',            s: 29.30, w: 47.62, n: 29.38, e: 47.73 },
    { id: 'jahra',   label: 'Al-Jahra and the north west',s: 29.20, w: 46.60, n: 29.95, e: 47.75 },
    { id: 'ahmadi',  label: 'Al-Ahmadi and the south coast', s: 28.90, w: 47.90, n: 29.35, e: 48.40 },
    { id: 'khiran',  label: 'Al-Khiran and Wafra',        s: 28.52, w: 47.70, n: 29.00, e: 48.45 }
  ];
  function preset(id) {
    for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i].id === id) return PRESETS[i];
    return null;
  }
  function presetPolygon(id) {
    var p = preset(id);
    return p ? rectPolygon(p.s, p.w, p.n, p.e, p.label) : null;
  }

  /* -------------------------------------------------------------------
     THE FRAME FOOTPRINT
     ------------------------------------------------------------------- */
  function hasFix(f) {
    return f && f.lat !== null && f.lat !== undefined &&
           f.lon !== null && f.lon !== undefined;
  }

  /* half extents, in degrees, of a frame centred on its coordinate */
  function halfSpan(f) {
    var lat = Number(f.lat);
    var gsd = Number(f.gsd_m) || 39;
    var w = Number(f.image_w) || 512;
    var h = Number(f.image_h) || 512;
    return {
      dLat: (h * gsd / 2) / M_PER_DEG_LAT,
      dLon: (w * gsd / 2) / mPerDegLon(lat)
    };
  }

  /* [[south,west],[north,east]] - Leaflet order, for L.rectangle */
  function frameBounds(f) {
    if (!hasFix(f)) return null;
    var lat = Number(f.lat), lon = Number(f.lon), d = halfSpan(f);
    return [[lat - d.dLat, lon - d.dLon], [lat + d.dLat, lon + d.dLon]];
  }

  /* A pixel box inside the frame becomes a GeoJSON polygon on the
     ground. Image y runs DOWN and latitude runs UP, which is why y0 maps
     to the north edge and y1 to the south. Getting that inverted flips
     every finding about the frame centre and looks entirely plausible on
     a map, so it is written out rather than folded into one expression. */
  function pixelPolygon(f, x0, y0, x1, y1, name) {
    if (!hasFix(f)) return null;
    var lat = Number(f.lat), lon = Number(f.lon);
    var gsd = Number(f.gsd_m) || 39;
    var w = Number(f.image_w) || 512, h = Number(f.image_h) || 512;
    var mLon = mPerDegLon(lat);

    function lonAt(x) { return lon + ((x - w / 2) * gsd) / mLon; }
    function latAt(y) { return lat + ((h / 2 - y) * gsd) / M_PER_DEG_LAT; }

    var north = latAt(y0), south = latAt(y1);
    var west = lonAt(x0), east = lonAt(x1);
    return rectPolygon(south, west, north, east, name);
  }

  /* Ray casting, on a GeoJSON ring of [lon,lat] pairs. Used to answer
     "is this frame inside the mission area" without asking the database
     for a PostGIS it does not have installed. */
  function pointInPolygon(lon, lat, poly) {
    if (!poly || poly.type !== 'Polygon' || !poly.coordinates || !poly.coordinates[0]) return false;
    var ring = poly.coordinates[0], inside = false, i, j;
    for (i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      var hit = ((yi > lat) !== (yj > lat)) &&
                (lon < (xj - xi) * (lat - yi) / ((yj - yi) || 1e-12) + xi);
      if (hit) inside = !inside;
    }
    return inside;
  }

  function polygonBounds(poly) {
    if (!poly || !poly.coordinates || !poly.coordinates[0]) return null;
    var ring = poly.coordinates[0];
    var s = 90, n = -90, w = 180, e = -180;
    ring.forEach(function (p) {
      if (p[1] < s) s = p[1]; if (p[1] > n) n = p[1];
      if (p[0] < w) w = p[0]; if (p[0] > e) e = p[0];
    });
    return [[s, w], [n, e]];
  }

  function polygonAreaKm2(poly) {
    var b = polygonBounds(poly);
    if (!b) return 0;
    var midLat = (b[0][0] + b[1][0]) / 2;
    var h = (b[1][0] - b[0][0]) * M_PER_DEG_LAT / 1000;
    var w = (b[1][1] - b[0][1]) * mPerDegLon(midLat) / 1000;
    /* Adaptive, so a small area does not read "about 0 km2". Zooming the
       New Mission map onto a single farm gives roughly 0.03 km2, and
       rounding that to a whole number told the researcher their area was
       nothing. A genuine 0 now means genuinely degenerate. */
    var a = h * w;
    return a < 10 ? Math.round(a * 100) / 100 : Math.round(a);
  }

  function fmtCoord(lat, lon) {
    return Math.abs(lat).toFixed(4) + (lat >= 0 ? 'N' : 'S') + ' ' +
           Math.abs(lon).toFixed(4) + (lon >= 0 ? 'E' : 'W');
  }

  /* -------------------------------------------------------------------
     THE MAP FACTORY
     ------------------------------------------------------------------- */

  /* Basemaps. Every URL here has to exist in the img-src list in
     vercel.json or the tiles are blocked with no error the page can see
     - the requests simply never happen. Attribution is not decoration:
     OSM is ODbL. EOxCloudless is CC BY-NC-SA 4.0 for non-commercial use,
     which a student capstone is; commercial use needs a licence from EOX.
     Both require attribution.

     >>> CARTO WAS HERE AND HAD TO COME OUT. <<<
     basemaps.cartocdn.com/dark_all was the first default. It still
     answers with HTTP 200 and a 256x256 PNG, so nothing in the console,
     the network panel or a status-code check says anything is wrong -
     but the PNG is now a grey watermark reading "API KEY REQUIRED ·
     carto.com/basemaps/apikey". Carto moved their free basemaps behind a
     key and kept serving a valid image to callers without one. It was
     caught by looking at a screenshot, which is the only thing that
     could have caught it.

     The two that replaced it need no key and no account:

       Sentinel-2 cloudless   EOX, CC BY-NC-SA 4.0 (non-commercial),
                              modified Copernicus Sentinel data.
                              Actual satellite imagery,
                              which is what this workspace is for, and
                              dark enough to sit in this UI unretouched.
                              Serves to z16 over Kuwait - checked.
       OpenStreetMap          ODbL. Carries the place names and the road
                              network that imagery alone does not.

     The dark variant is the SAME OpenStreetMap tiles with a CSS filter
     over them, not a different provider. The attribution is unchanged
     because the data is unchanged; only the pixels in this browser are
     inverted. */
  function baseLayers() {
    var OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
    return {
      'Satellite (Sentinel-2)': L.tileLayer(
        'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2021_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg',
        { maxZoom: 16, maxNativeZoom: 16,
          /* EOX's required credit, verbatim from their licence page:
             "EOxCloudless https://cloudless.eox.at by EOX IT Services GmbH
             (Contains modified Copernicus Sentinel data 'year')". */
          attribution: '<a href="https://cloudless.eox.at">EOxCloudless</a> by ' +
                       'EOX IT Services GmbH (Contains modified Copernicus ' +
                       'Sentinel data 2021), CC BY-NC-SA 4.0' }),
      'Street map, dark': L.tileLayer(
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        { maxZoom: 19, className: 'ksat-tiles-dark', attribution: OSM_ATTR }),
      'Street map': L.tileLayer(
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        { maxZoom: 19, attribution: OSM_ATTR })
    };
  }

  /* OVERLAYS FROM PUBLIC EARTH OBSERVATION.

     Real data, not a decoration, and the only heat this platform has:
     KuwaitSat-1 carries no thermal band at all. MODIS is a 1 km product
     and GIBS serves it no finer than zoom 7, so it is shown as CONTEXT -
     which part of the country is hotter - and js/ksat-reference.js
     refuses to rank city blocks on it. The layer name says the
     resolution so nobody has to go looking for it. */
  function overlayLayers() {
    if (typeof L === 'undefined') { return {}; }
    return {
      'Land surface temperature (MODIS, 1 km)': L.tileLayer(
        'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/' +
        'MODIS_Terra_Land_Surface_Temp_Day/default/2025-06-15/' +
        'GoogleMapsCompatible_Level7/{z}/{y}/{x}.png',
        { maxZoom: 19, maxNativeZoom: 7, opacity: 0.55,
          attribution: 'MODIS Terra Land Surface Temperature (day), NASA GIBS' })
    };
  }
  var DEFAULT_BASE = 'Satellite (Sentinel-2)';

  var HUD = null;

  function hudControl(map) {
    var C = L.Control.extend({
      options: { position: 'bottomleft' },
      onAdd: function () {
        var d = L.DomUtil.create('div', 'ksat-hud');
        this._d = d;
        return d;
      }
    });
    var c = new C();
    c.addTo(map);
    /* Without this a drag that starts on the read-out pans the map under
       your finger, and a click on it zooms. */
    L.DomEvent.disableClickPropagation(c._d);

    function paint() {
      var ctr = map.getCenter(), z = map.getZoom();
      var b = map.getBounds();
      var widthKm = (b.getEast() - b.getWest()) * mPerDegLon(ctr.lat) / 1000;
      c._d.textContent = '';
      function line(k, v) {
        var row = document.createElement('div');
        var i = document.createElement('i'); i.textContent = k;
        var b2 = document.createElement('b'); b2.textContent = v;
        row.appendChild(i); row.appendChild(b2);
        c._d.appendChild(row);
      }
      line('CENTRE', fmtCoord(ctr.lat, ctr.lng));
      line('ZOOM', String(z));
      line('WIDTH', widthKm.toFixed(1) + ' km');
    }

    /* The hash is the thing the team liked about georef.html: the URL is
       the view, so a coordinate can be sent to a colleague by copying
       the address bar.

       It is written on moveend and NOT on move. `move` fires once per
       animation frame, and replaceState at 60Hz is enough history churn
       to make a browser stutter on a long drag - measured, not guessed.
       The read-out itself does follow `move`, because a coordinate that
       only updates when you let go is not a read-out. */
    function hash() {
      var ctr = map.getCenter();
      try {
        history.replaceState(null, '',
          location.pathname + location.search + '#geo@' +
          ctr.lat.toFixed(4) + ',' + ctr.lng.toFixed(4) + ',' + map.getZoom());
      } catch (e) {}
    }
    map.on('move zoom', paint);
    map.on('moveend zoomend', hash);
    paint();
    return c;
  }

  /* Read a #geo@lat,lon,zoom hash if there is one. Same idea as the
     reference page, same order, so a link made there still works. */
  function hashView() {
    var m = /#geo@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(\d+)/.exec(location.hash || '');
    if (!m) return null;
    return { lat: parseFloat(m[1]), lon: parseFloat(m[2]), zoom: parseInt(m[3], 10) };
  }

  /* make(hostId or element, opts) -> the Leaflet map, or null.

     opts.hud      : add the coordinate read-out and drive the URL hash
     opts.view     : [lat, lon, zoom]; a #geo@ hash overrides it when hud
     opts.onMove   : called with the map on every settled move
     opts.minimal  : no zoom control, no attribution prefix (for insets) */
  function make(host, opts) {
    opts = opts || {};
    var node = typeof host === 'string' ? document.getElementById(host) : host;
    if (!node) return null;
    if (typeof L === 'undefined') {
      node.textContent = 'The map library did not load. Check vendor/leaflet.js.';
      return null;
    }
    /* Leaflet refuses to initialise twice on one container and throws
       "Map container is already initialized", which in a page that
       rebuilds panels is an easy accident. Reuse instead. */
    if (node._ksatMap) { node._ksatMap.invalidateSize(); return node._ksatMap; }

    var view = opts.view || [29.35, 47.75, 9];
    var h = opts.hud ? hashView() : null;
    if (h) view = [h.lat, h.lon, h.zoom];

    var map = L.map(node, {
      zoomControl: !opts.minimal,
      attributionControl: true,
      /* The envelope is a soft fence: a researcher may look outside
         Kuwait, they simply cannot draw a mission area there. maxBounds
         would trap them; this just stops an accidental pan to the
         Atlantic. */
      maxBounds: [[24.5, 42.0], [34.0, 53.0]],
      maxBoundsViscosity: 0.6,
      minZoom: 5
    }).setView([view[0], view[1]], view[2]);

    var bases = baseLayers();
    bases[DEFAULT_BASE].addTo(map);
    /* The base layers are stashed rather than wired into a control here.
       A caller that also has OVERLAYS - the Geospatial view has four -
       wants one switcher with both halves in it, and it cannot build
       its overlay groups until the map exists. Two controls stacked on
       top of each other was the first version and it looked like a bug. */
    map._ksatBases = bases;
    map.attributionControl.setPrefix('');
    if (opts.hud) { HUD = hudControl(map); }
    if (opts.onMove) {
      map.on('moveend zoomend', function () { opts.onMove(map); });
    }
    node._ksatMap = map;
    /* A map built inside a hidden section measures zero. Every caller
       that shows a view calls resize(); this covers the first paint. */
    setTimeout(function () { map.invalidateSize(); }, 60);
    return map;
  }

  function resize(host) {
    var node = typeof host === 'string' ? document.getElementById(host) : host;
    if (node && node._ksatMap) {
      node._ksatMap.invalidateSize();
      return node._ksatMap;
    }
    return null;
  }

  /* EVERY PROGRAMMATIC MOVE GOES THROUGH HERE, AND EVERY ONE OF THEM IS
     animate:false. THIS IS NOT A STYLE CHOICE.

     Leaflet's animated path runs the whole move inside
     requestAnimationFrame. rAF does not fire in a tab the browser is not
     painting - a background tab, a minimised window, a tab being driven
     by automation - so an animated fitBounds in those conditions does
     not move the map, does not throw, does not log, and leaves
     _animatingZoom undefined so nothing even looks stuck. Measured on
     this workspace: "Fit to frames" and the area presets in the New
     Mission dialog silently did nothing, repeatedly, with a clean
     console.

     animate:false skips rAF entirely and sets the view synchronously.
     The cost is that the map snaps instead of gliding. That is the right
     trade for a control whose whole job is "show me that place": a snap
     that always works beats a glide that sometimes does not, and this
     team runs with system animations turned off anyway.

     Caller-driven zoom - the +/- buttons, the scroll wheel, a pinch -
     is untouched and still animates. */
  function fit(map, bounds, pad) {
    if (!map || !bounds) return;
    try {
      map.invalidateSize();
      map.fitBounds(bounds, { padding: pad || [24, 24], animate: false });
    } catch (e) { /* an empty or degenerate bounds is not worth a crash */ }
  }

  function goto_(map, lat, lon, zoom) {
    if (!map) return;
    try {
      map.invalidateSize();
      map.setView([lat, lon], zoom, { animate: false });
    } catch (e) {}
  }

  /* -------------------------------------------------------------------
     THE PIXELS

     analyseFrame() draws the frame into an offscreen canvas and measures
     it tile by tile. It runs entirely in the browser: the bytes never
     leave the session they were released to, which is the same promise
     13_payload_archive.sql makes about them.

     A canvas drawn from a data: URI is NOT tainted - data URIs are
     same-origin - so getImageData() is allowed here. It would throw on a
     cross-origin image, which is one more reason the frames are carried
     as base64 in the row rather than fetched from a bucket.
     ------------------------------------------------------------------- */

  function loadImage(src) {
    return new Promise(function (ok, no) {
      var img = new Image();
      img.onload = function () { ok(img); };
      img.onerror = function () { no(new Error('frame image would not decode')); };
      img.src = src;
    });
  }

  /* Classification, with every threshold named and none of them hidden
     in an expression:

       exg    Excess Green on chromatic coordinates, -1 .. 2
       lum    Rec.709 luminance, 0 .. 255
       water  dark, and blue leading both other channels
       veg    exg at or above VEG_EXG
       bare   neither

     VEG_EXG = 0.05 is the conventional working threshold for Excess
     Green on uncalibrated visible imagery. It is NOT calibrated to this
     sensor and no one should read a vegetation percentage off it. The
     Environmental Analysis agent says so in its own step record. */
  var VEG_EXG = 0.05;
  var WATER_LUM = 70;

  /* 16, not 8, and the measurements above are the reason. At 8 the tiles
     are 2.47 km across and the greenest tile stands 2.6 standard
     deviations from the desert median; at 16 they are 1.24 km and it
     stands 4.0. Kuwait's irrigated ground is in blocks far smaller than
     a kilometre, so a coarse tile averages it into the sand around it.

     16 rather than 32 or 64 because a candidate zone has to be a unit
     somebody could actually act on. 1.24 km square is about 1.5 km2,
     which is a planting block. 309 m tiles separate the signal better
     still and give 4096 of them, which is a heat map, not a
     recommendation. */
  var DEFAULT_GRID = 16;

  function analyseFrame(f, grid) {
    grid = grid || DEFAULT_GRID;
    return loadImage('data:' + (f.image_mime || 'image/jpeg') + ';base64,' + f.image_b64)
      .then(function (img) {
        var w = img.naturalWidth || img.width;
        var h = img.naturalHeight || img.height;
        var cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        var cx = cv.getContext('2d', { willReadFrequently: true });
        cx.drawImage(img, 0, 0);
        var px = cx.getImageData(0, 0, w, h).data;

        var tiles = [];
        var counts = { veg: 0, water: 0, bare: 0 };
        var tw = Math.floor(w / grid), th = Math.floor(h / grid);

        for (var gy = 0; gy < grid; gy++) {
          for (var gx = 0; gx < grid; gx++) {
            var x0 = gx * tw, y0 = gy * th;
            var x1 = (gx === grid - 1) ? w : x0 + tw;
            var y1 = (gy === grid - 1) ? h : y0 + th;
            var sr = 0, sg = 0, sb = 0, n = 0;
            /* Every 2nd pixel in each direction. A 520x500 frame is
               260k pixels; a quarter of them is plenty for a tile mean
               and keeps eight frames under a second on a laptop. */
            for (var y = y0; y < y1; y += 2) {
              var rowOff = y * w * 4;
              for (var x = x0; x < x1; x += 2) {
                var o = rowOff + x * 4;
                sr += px[o]; sg += px[o + 1]; sb += px[o + 2]; n++;
              }
            }
            if (!n) continue;
            var R = sr / n, G = sg / n, B = sb / n;
            var sum = R + G + B || 1;
            var r = R / sum, g = G / sum, b = B / sum;
            var exg = 2 * g - r - b;
            var lum = 0.2126 * R + 0.7152 * G + 0.0722 * B;
            var isWater = (b > r && b > g && lum < WATER_LUM);
            var isVeg = (!isWater && exg >= VEG_EXG);
            var kind = isWater ? 'water' : (isVeg ? 'vegetation' : 'bare');
            counts[isWater ? 'water' : (isVeg ? 'veg' : 'bare')]++;
            tiles.push({
              gx: gx, gy: gy, x0: x0, y0: y0, x1: x1, y1: y1,
              r: Math.round(R), g: Math.round(G), b: Math.round(B),
              exg: Math.round(exg * 1000) / 1000,
              lum: Math.round(lum),
              kind: kind
            });
          }
        }

        /* Neighbour vegetation fraction. Kept, and on this archive it is
           always zero, because nothing classifies as vegetation. It is
           left in because it is the right signal the day a frame DOES
           contain some: bare ground beside greenery is a better planting
           candidate than bare ground in open desert, since whatever is
           growing proves the water and the soil are not the blocker. */
        var at = {};
        tiles.forEach(function (t) { at[t.gx + ',' + t.gy] = t; });
        tiles.forEach(function (t) {
          var v = 0, tot = 0;
          for (var dy = -1; dy <= 1; dy++) {
            for (var dx = -1; dx <= 1; dx++) {
              if (!dx && !dy) continue;
              var nb = at[(t.gx + dx) + ',' + (t.gy + dy)];
              if (!nb) continue;
              tot++;
              if (nb.kind === 'vegetation') v++;
            }
          }
          t.nbVeg = tot ? v / tot : 0;
        });

        /* THE DISTRIBUTION, OVER LAND ONLY.

           Water sits far from the land values and would drag both the
           median and the spread, so every tile classified as water is
           left out of these statistics. What is left describes the
           ground: where its middle is, how much it varies, and how far
           the greenest tile stands from the rest.

           z is what the Recommendation Agent ranks on. A z of 0 is
           ordinary ground for this frame; a high z is the least red tile
           in it. Because z is computed per frame it is not comparable
           between frames, which is the same limitation INDEX_NOTE states
           about ExG itself - and the reason the agent never mixes
           candidates from two frames into one ranking without saying so. */
        var land = tiles.filter(function (t) { return t.kind !== 'water'; });
        var vals = land.map(function (t) { return t.exg; }).sort(function (a, b) { return a - b; });
        var median = vals.length ? vals[Math.floor(vals.length / 2)] : 0;
        var sd = 0;
        if (vals.length) {
          sd = Math.sqrt(vals.reduce(function (s, v) {
            return s + (v - median) * (v - median);
          }, 0) / vals.length);
        }
        tiles.forEach(function (t) {
          t.z = (sd > 0 && t.kind !== 'water') ? (t.exg - median) / sd : 0;
        });

        /* NULL, NOT ZERO, WHEN THERE IS NO LAND.

           Frame 08 is open Gulf water: every tile classifies as water,
           `vals` is empty, and min/median/max/sd were all reported as 0.
           The Environmental Analysis agent then printed "ExG ranges 0 to
           0, median 0" and went on to narrate "the greenest tile stands
           0 standard deviations above the median, so there is a real
           gradient in the ground here" - about a frame with no ground in
           it at all. Zero is a measurement. Absent is not, and the
           difference has to survive into the trail. */
        var hasLand = vals.length > 0;
        var topZ = land.length ? Math.max.apply(null, land.map(function (t) { return t.z; })) : null;

        return {
          frame_no: f.frame_no,
          grid: grid,
          width: w, height: h,
          /* Both axes, because the tiles are not square: a 520 x 500 px
             frame at grid 16 gives 1248 x 1209 m, and the last row and
             column are larger again because the remainder pixels go
             there. tileM stays as the width for the one place a single
             figure reads better than two, and it is described as
             "across" rather than "square" wherever it is printed. */
          tileM: Math.round(Math.floor(w / grid) * (Number(f.gsd_m) || 39)),
          tileH_m: Math.round(Math.floor(h / grid) * (Number(f.gsd_m) || 39)),
          tiles: tiles,
          counts: counts,
          total: tiles.length,
          vegPct: Math.round(1000 * counts.veg / tiles.length) / 10,
          waterPct: Math.round(1000 * counts.water / tiles.length) / 10,
          barePct: Math.round(1000 * counts.bare / tiles.length) / 10,

          /* The honest headline. On this archive it is false every time,
             and the agents are required to say so rather than quietly
             ranking as if it were true. */
          vegetationDetected: counts.veg > 0,
          exg: {
            min: hasLand ? vals[0] : null,
            median: hasLand ? median : null,
            max: hasLand ? vals[vals.length - 1] : null,
            sd: hasLand ? sd : null,
            topZ: topZ,
            landTiles: land.length
          }
        };
      });
  }

  /* ------------------------------------------------------------------- */
  KS.geo = {
    KUWAIT: KUWAIT,
    PRESETS: PRESETS,
    preset: preset,
    presetPolygon: presetPolygon,
    FOOTPRINT_NOTE: FOOTPRINT_NOTE,
    INDEX_NOTE: INDEX_NOTE,
    EVIDENCE_NOTE: EVIDENCE_NOTE,
    VEG_EXG: VEG_EXG,
    DEFAULT_GRID: DEFAULT_GRID,

    rectPolygon: rectPolygon,
    polygonBounds: polygonBounds,
    polygonAreaKm2: polygonAreaKm2,
    pointInPolygon: pointInPolygon,
    inEnvelope: inEnvelope,
    clampLat: clampLat,
    clampLon: clampLon,
    fmtCoord: fmtCoord,

    hasFix: hasFix,
    frameBounds: frameBounds,
    pixelPolygon: pixelPolygon,

    make: make,
    resize: resize,
    fit: fit,
    goTo: goto_,
    baseLayers: baseLayers,
    overlayLayers: overlayLayers,
    DEFAULT_BASE: DEFAULT_BASE,

    analyseFrame: analyseFrame
  };
})();
