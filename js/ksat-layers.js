/* =====================================================================
   ksat-layers.js - THE REAL KUWAIT, AS MAP LAYERS
   Owner: 02 Back End and data

   Until this file existed every map on this platform drew Kuwait as a
   rectangle. The mission area was a box, "is this in Kuwait" was a
   comparison against four numbers, and the public page drew the country
   as a thirteen-point sketch that overlaps the real mainland by 71 %.

   This loads the real shapes from assets/geo/ and puts them on any map
   that asks:

     kuwait_land                the coastline, 1 polygon
     islands                    25 land masses, including all 9 named
                                islands. Kubbar, Qaruh and Umm al-Maradim
                                are among them, and no preset on this
                                platform contains any of the three.
     governorates_land          the 6 governorates
     governorates_land_osm2023  the SAME 6 on the older boundary. See
                                "the disputed block" below.
     areas_land                 204 residential areas - the layer that
                                makes "residential blocks in Jahra" a
                                real question rather than a figure of
                                speech
     water_bodies               51, including the Jahra pools
     settlements                125 places, most with Arabic names
     protected_areas_epa        19 reserves, as EPA publishes them
     international_land_boundaries   the Iraq and Saudi lines

   >>> ATTRIBUTION IS A LICENCE CONDITION, NOT A CREDIT LINE <<<
   These layers are OpenStreetMap under ODbL, plus GeoNames under CC BY
   4.0 and EPA's published coordinates. A map drawn from them is a
   "produced work" and must say so. attribute() below adds that to the
   Leaflet attribution control, and it is called from load() so a layer
   cannot appear on a map without it. Do not separate the two.
   assets/geo/LICENSE-DATA.md has the full terms and is served.

   >>> THE DISPUTED BLOCK - DO NOT QUIETLY PICK A SIDE <<<
   An 893 km2 block in the south west (Um Qudeer and Al Abdiliya) is in
   JAHRA in current OpenStreetMap and in AHMADI in geoBoundaries 2023,
   Natural Earth, and the OSM area codes inside the block itself. One
   changeset moved it in October 2024. Jahra's own website publishes
   11,230 km2, which is below both readings.

   This platform does not adjudicate that. BOTH versions ship, the
   switch is the researcher's, and governorateSource() names which one
   is on screen. Choosing one silently would be this platform asserting
   a boundary it has no standing to assert.
   ===================================================================== */

(function () {
  'use strict';

  var KS = window.KSAT = window.KSAT || {};

  var BASE = 'assets/geo/';

  /* The credit line. Every clause is required by a licence on a layer
     that can be loaded from this file. */
  var CREDIT =
    'Boundaries &copy; <a href="https://www.openstreetmap.org/copyright">' +
    'OpenStreetMap</a> contributors (ODbL) &middot; ' +
    'Places: <a href="https://www.geonames.org">GeoNames</a> (CC BY 4.0) &middot; ' +
    'Maritime zones: <a href="https://www.marineregions.org/">Marine Regions</a> ' +
    '(CC BY 4.0, no legal value) &middot; ' +
    'Reserves: Kuwait EPA, as published';

  var LAYERS = {
    land: {
      file: 'kuwait_land.min.geojson',
      label: 'Kuwait coastline',
      style: { color: '#dce9f1', weight: 1.4, fill: false }
    },
    islands: {
      file: 'islands.min.geojson',
      label: 'Islands',
      style: { color: '#9fc5dc', weight: 1, fill: true, fillOpacity: 0.12 }
    },
    governorates: {
      file: 'governorates_land.min.geojson',
      label: 'Governorates',
      style: { color: '#c9a86a', weight: 1, dashArray: '4 3', fill: false }
    },
    governorates2023: {
      file: 'governorates_land_osm2023.min.geojson',
      label: 'Governorates (2023 boundary)',
      style: { color: '#a8763f', weight: 1, dashArray: '2 4', fill: false }
    },
    areas: {
      file: 'areas_land.min.geojson',
      label: 'Residential areas',
      style: { color: '#8eb9d8', weight: 0.7, fill: true, fillOpacity: 0.07 }
    },
    water: {
      file: 'water_bodies.min.geojson',
      label: 'Inland water',
      style: { color: '#4f93c0', weight: 0.8, fill: true, fillOpacity: 0.3 }
    },
    settlements: {
      file: 'settlements.min.geojson',
      label: 'Places',
      point: true
    },
    reserves: {
      file: 'protected_areas_epa.min.geojson',
      label: 'Protected areas (EPA, as published)',
      style: { color: '#79bd96', weight: 1, fill: true, fillOpacity: 0.1 }
    },
    borders: {
      file: 'international_land_boundaries.min.geojson',
      label: 'International land boundaries',
      style: { color: '#d88484', weight: 1.6, fill: false }
    },

    /* MARITIME ZONES, AND THE WARNING THAT TRAVELS WITH THEM.

       Marine Regions states these have "no legal value whatsoever".
       They are 12 and 24 nautical mile buffers and median lines, not
       agreed boundaries: Kuwait-Iran is undelimited and beyond boundary
       point 162 Kuwait-Iraq is undemarcated. The label says so on the
       layer switcher, because that is the only place a researcher
       actually reads before ticking a box. */
    territorialSea: {
      file: 'territorial_sea_12nm.min.geojson',
      label: 'Territorial sea, 12 nm (no legal value)',
      style: { color: '#5a9fd4', weight: 1, dashArray: '5 4',
               fill: true, fillOpacity: 0.05 }
    },
    contiguousZone: {
      file: 'contiguous_zone_24nm.min.geojson',
      label: 'Contiguous zone, 24 nm (no legal value)',
      style: { color: '#4a7fa8', weight: 1, dashArray: '2 5', fill: false }
    },
    eez: {
      file: 'eez.min.geojson',
      label: 'EEZ (no legal value)',
      style: { color: '#3d6b8f', weight: 1, dashArray: '8 5', fill: false }
    },
    maritimeBoundaries: {
      file: 'maritime_boundaries.min.geojson',
      label: 'Maritime boundaries (no legal value)',
      style: { color: '#8fb4d0', weight: 1.4, fill: false }
    }
  };

  /* One fetch per file for the life of the page. Several maps ask for
     the same layer and areas_land is 244 kB; fetching it per map would
     be four copies of the same bytes. */
  var cache = {};

  function fetchLayer(key) {
    var def = LAYERS[key];
    if (!def) { return Promise.reject(new Error('unknown layer ' + key)); }
    if (!cache[key]) {
      cache[key] = fetch(BASE + def.file).then(function (r) {
        if (!r.ok) { throw new Error(def.file + ' -> HTTP ' + r.status); }
        return r.json();
      });
    }
    return cache[key];
  }

  /* Added once per map. Leaflet keeps duplicates out of the control by
     itself, but the flag makes the intent visible: this is a condition
     being met, not a string being appended. */
  function attribute(map) {
    if (!map || map._ksatCredited) { return; }
    map._ksatCredited = true;
    if (map.attributionControl) { map.attributionControl.addAttribution(CREDIT); }
  }

  function nameOf(p) {
    return p.name_en || p.name || p.NAME || p.name_ar || '';
  }

  /* load(map, key, opts) -> Promise<L.GeoJSON>

     opts.style   overrides the default style
     opts.onEach  (feature, layer) for popups and the like
     opts.pane    a Leaflet pane name
     opts.label   overrides the popup title */
  function load(map, key, opts) {
    opts = opts || {};
    if (typeof L === 'undefined' || !map) {
      return Promise.reject(new Error('no map'));
    }
    return fetchLayer(key).then(function (fc) {
      var def = LAYERS[key];
      var gj = L.geoJSON(fc, {
        pane: opts.pane,
        style: opts.style || def.style,
        pointToLayer: def.point ? function (f, latlng) {
          return L.circleMarker(latlng, { radius: 3, color: '#c9d4dd',
                                          weight: 1, fillOpacity: 0.7 });
        } : undefined,
        onEachFeature: function (f, layer) {
          var p = f.properties || {};
          var nm = nameOf(p);
          if (nm) {
            /* bindPopup with a STRING would be an innerHTML path for
               text that came out of a data file. Build the node. */
            var d = document.createElement('div');
            var h = document.createElement('h4');
            h.textContent = nm;
            d.appendChild(h);
            if (p.name_ar && p.name_ar !== nm) {
              var ar = document.createElement('div');
              ar.textContent = p.name_ar;
              ar.setAttribute('dir', 'rtl');
              d.appendChild(ar);
            }
            [['area_km2', 'km²'], ['gov_name_en', ''], ['type', '']]
              .forEach(function (pair) {
                if (p[pair[0]] === undefined || p[pair[0]] === null) { return; }
                var s = document.createElement('div');
                s.className = 'sub';
                s.textContent = p[pair[0]] + (pair[1] ? ' ' + pair[1] : '');
                d.appendChild(s);
              });
            /* The licence, on the feature, where a reader can see it. */
            if (p.license) {
              var lic = document.createElement('div');
              lic.className = 'sub';
              lic.textContent = p.license;
              d.appendChild(lic);
            }
            layer.bindPopup(d);
          }
          if (opts.onEach) { opts.onEach(f, layer); }
        }
      });
      attribute(map);
      return gj;
    });
  }

  /* Which governorate boundary is on screen, in words. The Missions and
     report surfaces print this rather than implying there is one answer. */
  function governorateSource(key) {
    return key === 'governorates2023'
      ? 'geoBoundaries 2023 (OpenStreetMap as of January 2023). Puts the ' +
        'Um Qudeer / Al Abdiliya block in Al-Ahmadi.'
      : 'OpenStreetMap, current. Puts the Um Qudeer / Al Abdiliya block in ' +
        'Al-Jahra, following a single changeset in October 2024.';
  }

  /* IS THIS POINT ON KUWAITI LAND?

     The honest version of the rectangle test. geo.inEnvelope() asks
     whether a coordinate is inside 46.5-48.8 E, 28.5-30.1 N, which is
     true of large parts of Iraq, Saudi Arabia and the Gulf. This asks
     the coastline.

     Asynchronous, because the answer lives in a 58 kB file. Callers that
     cannot wait - the live area-of-interest read-out as the map is
     dragged - should keep using the envelope and treat this as the
     check that runs before something is committed.

     It does NOT replace kuwait_area_ok() in the database. That check is
     the one that actually decides, it runs on every insert, and it stays
     a rectangle until somebody changes it by hand in Supabase. */
  function onKuwaitiLand(lat, lon) {
    return fetchLayer('land').then(function (fc) {
      var geo = KS.geo;
      if (!geo) { return null; }
      return fc.features.some(function (f) {
        var g = f.geometry;
        if (!g) { return false; }
        var polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
        return polys.some(function (rings) {
          /* outer ring contains it and no hole excludes it */
          if (!geo.pointInPolygon(lon, lat, { type: 'Polygon', coordinates: [rings[0]] })) {
            return false;
          }
          for (var i = 1; i < rings.length; i++) {
            if (geo.pointInPolygon(lon, lat, { type: 'Polygon', coordinates: [rings[i]] })) {
              return false;
            }
          }
          return true;
        });
      });
    });
  }

  KS.layers = {
    LAYERS: LAYERS,
    CREDIT: CREDIT,
    load: load,
    fetchLayer: fetchLayer,
    attribute: attribute,
    governorateSource: governorateSource,
    onKuwaitiLand: onKuwaitiLand
  };
})();
