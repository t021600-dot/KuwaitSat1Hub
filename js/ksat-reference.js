/* =====================================================================
   ksat-reference.js - THE SECOND DATA SOURCE, AND WHY THERE IS ONE
   Owner: 02 Back End / 04 Agents

   >>> READ THIS BEFORE USING ANYTHING IN THIS FILE <<<

   KuwaitSat-1 has photographed five places, all on the coast. There is
   no frame over Al-Jahra, none over any inland governorate, and the
   payload carries no thermal band at all - so a question like "find the
   hottest residential blocks in Jahra" cannot be answered from the
   mission archive. Not badly: AT ALL.

   The wrong answer is to invent coordinates or colour in a heat map.
   This file is the right answer: a SECOND, REAL, PUBLIC data source,
   labelled as such everywhere it is used, so the platform can work over
   ground KuwaitSat-1 has not covered without ever pretending KuwaitSat-1
   covered it.

   WHAT IS IN HERE, AND WHERE IT COMES FROM

     Sentinel-2 cloudless 2021        EOX, CC BY-NC-SA 4.0, non-commercial
                                      modified Copernicus Sentinel data
                                      10 m, visible bands, cloud-free
                                      mosaic. Optical surface cover.

     MODIS Terra Land Surface Temp    NASA GIBS, public domain
                                      1 km, daily daytime LST, rendered
                                      by NASA as a colour image.

   Neither needs an API key. Both send Access-Control-Allow-Origin, which
   is the ONLY reason this file can exist: a canvas drawn from a
   cross-origin image is tainted and getImageData() throws, so without
   CORS these tiles could be displayed and never measured. They are
   loaded with crossOrigin="anonymous" for exactly that reason.

   >>> THE TWO THINGS THIS FILE MUST NEVER DO <<<

   1. It must never write into public.payload_frames. That table is the
      KuwaitSat-1 record and nothing else belongs in it. Reference
      imagery is fetched live and measured in the browser; it is never
      stored as a payload frame.

   2. It must never report a temperature in degrees. GIBS serves LST as a
      RENDERED COLOUR IMAGE, not as values. Reading degrees back out of a
      palette is a guess dressed as a measurement, which is the one thing
      this platform exists not to do. Heat is therefore reported as a
      RELATIVE index within the scene - hotter and cooler than the rest
      of this area - which is all that "the hottest blocks here" actually
      requires, and the wording says so.
   ===================================================================== */

(function () {
  'use strict';

  var KS = window.KSAT = window.KSAT || {};

  var SOURCES = {
    optical: {
      id: 'optical',
      name: 'Sentinel-2 cloudless 2021',
      attribution: 'EOxCloudless https://cloudless.eox.at by EOX IT Services ' +
                   'GmbH (Contains modified Copernicus Sentinel data 2021), ' +
                   'CC BY-NC-SA 4.0, non-commercial use',
      resolution_m: 10,
      maxZoom: 16,
      url: function (z, x, y) {
        return 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2021_3857/' +
               'default/GoogleMapsCompatible/' + z + '/' + y + '/' + x + '.jpg';
      }
    },
    heat: {
      id: 'heat',
      name: 'MODIS Terra Land Surface Temperature, day',
      attribution: 'MODIS Terra Land Surface Temperature (day), NASA GIBS / LANCE',
      resolution_m: 1000,
      maxZoom: 7,
      /* A date with data. GIBS serves a blank tile for a date the
         product has not been produced for, so this is pinned to a known
         good summer day rather than "today" - an empty heat layer on
         stage would look like a fault. */
      date: '2025-06-15',
      url: function (z, x, y) {
        return 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/' +
               'MODIS_Terra_Land_Surface_Temp_Day/default/' + this.date +
               '/GoogleMapsCompatible_Level7/' + z + '/' + y + '/' + x + '.png';
      }
    }
  };

  var TILE = 256;

  /* ---- Web Mercator tile maths, the same as Leaflet's ---------------- */
  function lonToX(lon, z) { return (lon + 180) / 360 * Math.pow(2, z); }
  function latToY(lat, z) {
    var r = lat * Math.PI / 180;
    return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z);
  }
  function xToLon(x, z) { return x / Math.pow(2, z) * 360 - 180; }
  function yToLat(y, z) {
    var n = Math.PI - 2 * Math.PI * y / Math.pow(2, z);
    return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  }

  /* The zoom at which the requested bbox fits in about `px` pixels,
     clamped to what the source actually serves. Asking GIBS for zoom 12
     returns 404s, not a scaled tile. */
  function zoomFor(bounds, px, source) {
    var west = bounds[0][1], east = bounds[1][1];
    for (var z = source.maxZoom; z >= 2; z--) {
      var w = (lonToX(east, z) - lonToX(west, z)) * TILE;
      if (w <= px) { return z; }
    }
    return 2;
  }

  function loadTile(url) {
    return new Promise(function (ok) {
      var img = new Image();
      /* WITHOUT THIS LINE NOTHING IN THIS FILE WORKS. An image drawn
         without it taints the canvas and getImageData throws a
         SecurityError. Both hosts send the header; if a future source
         does not, it can be displayed but never measured. */
      img.crossOrigin = 'anonymous';
      img.onload = function () { ok(img); };
      img.onerror = function () { ok(null); };   /* a missing tile is a hole, not a crash */
      img.src = url;
    });
  }

  /* -------------------------------------------------------------------
     FETCH A BOUNDING BOX AS ONE CANVAS

     bounds is Leaflet order: [[south, west], [north, east]]
     ------------------------------------------------------------------- */
  function fetchArea(sourceId, bounds, px) {
    var src = SOURCES[sourceId];
    if (!src) { return Promise.reject(new Error('unknown source ' + sourceId)); }
    px = px || 768;

    var z = zoomFor(bounds, px, src);
    var x0 = Math.floor(lonToX(bounds[0][1], z));
    var x1 = Math.floor(lonToX(bounds[1][1], z));
    var y0 = Math.floor(latToY(bounds[1][0], z));   /* north edge is the LOW y */
    var y1 = Math.floor(latToY(bounds[0][0], z));

    var cols = x1 - x0 + 1, rows = y1 - y0 + 1;
    if (cols * rows > 64) { return Promise.reject(new Error('area too large to fetch')); }

    var cv = document.createElement('canvas');
    cv.width = cols * TILE;
    cv.height = rows * TILE;
    var cx = cv.getContext('2d', { willReadFrequently: true });

    var jobs = [];
    for (var ty = y0; ty <= y1; ty++) {
      for (var tx = x0; tx <= x1; tx++) {
        (function (tx, ty) {
          jobs.push(loadTile(src.url(z, tx, ty)).then(function (img) {
            if (img) { cx.drawImage(img, (tx - x0) * TILE, (ty - y0) * TILE); }
            return !!img;
          }));
        })(tx, ty);
      }
    }

    return Promise.all(jobs).then(function (got) {
      var have = got.filter(Boolean).length;
      if (!have) { throw new Error(src.name + ' returned no tiles for this area'); }

      /* >>> CROP TO THE AREA THAT WAS ACTUALLY ASKED FOR. <<<

         Without this the canvas is whatever whole map tiles happened to
         cover the box, and for the two sources those are wildly
         different extents: over Al-Jahra the Sentinel-2 mosaic is 4 x 3
         tiles at zoom 13 covering about 17 km, while MODIS at its
         maximum zoom of 7 is a SINGLE tile covering 273 km. Al-Jahra is
         roughly ten pixels of it.

         Two consequences, both wrong, both silent:

           1. gridding the heat canvas 16 x 16 gives cells 17 km across,
              so the whole study area falls inside one cell and every
              tile gets the same heat value - a ranking with no signal
              in it at all;

           2. rankReference() joins the two grids on (gx, gy), which is
              only meaningful if both grids cover the SAME ground. They
              did not, so a candidate's "temperature" was read from a
              cell somewhere else entirely.

         Cropping both canvases to the requested bounds makes cell
         (gx, gy) the same piece of ground in both, which is what the
         join has always assumed. */
      var px0 = (lonToX(bounds[0][1], z) - x0) * TILE;
      var px1 = (lonToX(bounds[1][1], z) - x0) * TILE;
      var py0 = (latToY(bounds[1][0], z) - y0) * TILE;   /* north edge */
      var py1 = (latToY(bounds[0][0], z) - y0) * TILE;

      var cw = Math.max(16, Math.round(px1 - px0));
      var ch = Math.max(16, Math.round(py1 - py0));

      var out = document.createElement('canvas');
      out.width = cw;
      out.height = ch;
      out.getContext('2d', { willReadFrequently: true })
         .drawImage(cv, Math.round(px0), Math.round(py0), cw, ch, 0, 0, cw, ch);

      return {
        source: src,
        canvas: out,
        zoom: z,
        tiles: got.length,
        tilesLoaded: have,
        /* the bounds are now exactly what was requested, so every
           pixel-to-ground conversion downstream is a straight linear
           map onto the mission area */
        bounds: bounds,
        metresPerPixel: 156543.03392 *
          Math.cos((bounds[0][0] + bounds[1][0]) / 2 * Math.PI / 180) / Math.pow(2, z)
      };
    });
  }

  /* -------------------------------------------------------------------
     MEASURE THE OPTICAL SCENE

     Deliberately the SAME index and the SAME thresholds as
     js/ksat-geo.js uses on the KuwaitSat-1 frames. Two data sources
     measured two different ways cannot be compared, and being able to
     say "identical method, different sensor" is the whole point of
     having a second source at all.

     The one addition is `built`: bright, low-saturation ground, which on
     10 m optical separates rooftop and road from bare sand well enough
     to say where the residential blocks are. It is a surface-cover
     classification, not a land-use record, and it is described that way.
     ------------------------------------------------------------------- */
  function measure(area, grid) {
    grid = grid || 16;
    var cv = area.canvas;
    var w = cv.width, h = cv.height;
    var px = cv.getContext('2d', { willReadFrequently: true })
               .getImageData(0, 0, w, h).data;

    var tw = Math.floor(w / grid), th = Math.floor(h / grid);
    var tiles = [], counts = { vegetation: 0, water: 0, built: 0, bare: 0 };

    for (var gy = 0; gy < grid; gy++) {
      for (var gx = 0; gx < grid; gx++) {
        var x0 = gx * tw, y0 = gy * th;
        var x1 = (gx === grid - 1) ? w : x0 + tw;
        var y1 = (gy === grid - 1) ? h : y0 + th;
        var sr = 0, sg = 0, sb = 0, n = 0, lsum = 0, lsq = 0;
        for (var y = y0; y < y1; y += 2) {
          var off = y * w * 4;
          for (var x = x0; x < x1; x += 2) {
            var o = off + x * 4;
            if (px[o + 3] < 8) { continue; }      /* a hole where a tile failed */
            sr += px[o]; sg += px[o + 1]; sb += px[o + 2];
            var lp = 0.2126 * px[o] + 0.7152 * px[o + 1] + 0.0722 * px[o + 2];
            lsum += lp; lsq += lp * lp;
            n++;
          }
        }
        if (!n) { continue; }

        var R = sr / n, G = sg / n, B = sb / n;
        var sum = R + G + B || 1;
        var r = R / sum, g = G / sum, b = B / sum;
        var exg = 2 * g - r - b;
        var lum = 0.2126 * R + 0.7152 * G + 0.0722 * B;
        var mx = Math.max(R, G, B), mn = Math.min(R, G, B);
        var sat = mx ? (mx - mn) / mx : 0;

        /* TEXTURE, AND WHY BRIGHTNESS WAS THE WRONG TEST.

           `built` was originally "bright and unsaturated", which is a
           perfectly good description of a rooftop - and an equally good
           description of desert sand. Measured over Al-Jahra it
           classified ZERO tiles as built, because the city and the
           desert around it sit at the same brightness (lum 175-190) and
           the same low saturation.

           What actually separates them at 10 m is TEXTURE. A
           residential block is roofs, roads, walls and shadows inside
           one tile, so its luminance varies a lot; open desert is
           smooth. Standard deviation of luminance within the tile
           measures that directly, and it does not care how bright the
           surface happens to be.

           It is thresholded per scene in the caller rather than against
           a fixed number, because "textured" only means anything
           relative to the rest of the ground in the same image. */
        var lm = lsum / n;
        var lsd = Math.sqrt(Math.max(0, lsq / n - lm * lm));

        var kind;
        if (b > r && b > g && lum < 70) { kind = 'water'; }
        else if (exg >= 0.05) { kind = 'vegetation'; }
        else { kind = 'bare'; }   /* built is decided below, per scene */

        tiles.push({ gx: gx, gy: gy, x0: x0, y0: y0, x1: x1, y1: y1,
                     r: Math.round(R), g: Math.round(G), b: Math.round(B),
                     exg: Math.round(exg * 1000) / 1000,
                     lum: Math.round(lum),
                     sat: Math.round(sat * 100) / 100,
                     texture: Math.round(lsd * 10) / 10,
                     kind: kind });
      }
    }

    /* The most textured quarter of the land in this scene is called
       built-up. A quartile rather than a constant: it is self
       calibrating, it cannot classify everything or nothing, and it
       says exactly what it means - "more built up than three quarters
       of the ground in this image". Every finding describes it that
       way rather than claiming to have found buildings. */
    var texVals = tiles.filter(function (t) { return t.kind === 'bare'; })
                       .map(function (t) { return t.texture; })
                       .sort(function (a, b) { return a - b; });
    var texCut = texVals.length ? texVals[Math.floor(texVals.length * 0.75)] : Infinity;
    tiles.forEach(function (t) {
      if (t.kind === 'bare' && t.texture >= texCut) { t.kind = 'built'; }
      counts[t.kind]++;
    });

    var land = tiles.filter(function (t) { return t.kind !== 'water'; });
    var vals = land.map(function (t) { return t.exg; }).sort(function (a, b) { return a - b; });
    var median = vals.length ? vals[Math.floor(vals.length / 2)] : null;
    var sd = vals.length
      ? Math.sqrt(vals.reduce(function (s, v) { return s + (v - median) * (v - median); }, 0) / vals.length)
      : null;
    tiles.forEach(function (t) {
      t.z = (sd && t.kind !== 'water') ? (t.exg - median) / sd : 0;
    });

    return {
      grid: grid, width: w, height: h,
      tiles: tiles, counts: counts, total: tiles.length,
      landTiles: land.length,
      tileM: Math.round((w / grid) * area.metresPerPixel),
      vegetationDetected: counts.vegetation > 0,
      exg: { median: median, sd: sd,
             min: vals.length ? vals[0] : null,
             max: vals.length ? vals[vals.length - 1] : null }
    };
  }

  /* -------------------------------------------------------------------
     MEASURE THE HEAT SCENE

     GIBS renders LST as a colour ramp, so what comes back is a PICTURE
     of temperature, not temperature. See the file header: this returns a
     RELATIVE index only and every caller must present it as relative.

     The ramp runs blue (cold) through yellow to red (hot), so hue
     position is the signal. Reducing it to "how far toward the red end"
     is the honest reading; converting it to degrees is not.
     ------------------------------------------------------------------- */
  function measureHeat(area, grid) {
    grid = grid || 16;
    var cv = area.canvas;
    var w = cv.width, h = cv.height;

    /* >>> CAN THIS LAYER EVEN RESOLVE THE GRID IT IS BEING ASKED FOR? <<<

       MODIS LST is a 1 km product and GIBS serves it no finer than zoom
       7. Cropped to a city-sized study area that is a handful of pixels:
       over Al-Jahra, measured, it is 10 x 9. Gridded 16 x 16 that gives
       cells smaller than one source pixel, every cell reads the same
       value, the standard deviation is zero, and every tile scores
       exactly 0.00 - a ranking with no information in it whatsoever,
       presented with all the confidence of a real one.

       So the layer reports whether it can support the grid, and the
       caller must not rank on it when it cannot. A heat map nobody can
       rank on is still worth SHOWING - it is real data and it is the
       honest context for the question - but it is context, not
       evidence, and the difference has to survive into the report. */
    var srcPx = Math.min(w, h);
    var usable = srcPx >= grid * 2;
    var px = cv.getContext('2d', { willReadFrequently: true })
               .getImageData(0, 0, w, h).data;

    var tw = Math.floor(w / grid), th = Math.floor(h / grid);
    var tiles = [];

    for (var gy = 0; gy < grid; gy++) {
      for (var gx = 0; gx < grid; gx++) {
        var x0 = gx * tw, y0 = gy * th;
        var x1 = (gx === grid - 1) ? w : x0 + tw;
        var y1 = (gy === grid - 1) ? h : y0 + th;
        var warm = 0, n = 0;
        for (var y = y0; y < y1; y += 2) {
          var off = y * w * 4;
          for (var x = x0; x < x1; x += 2) {
            var o = off + x * 4;
            if (px[o + 3] < 8) { continue; }
            var R = px[o], G = px[o + 1], B = px[o + 2];
            /* position along the ramp: red end minus blue end, scaled to
               0..1. Grey and transparent pixels contribute nothing. */
            var t = (R - B) / 255;
            warm += (t + 1) / 2;
            n++;
          }
        }
        if (!n) { continue; }
        tiles.push({ gx: gx, gy: gy, x0: x0, y0: y0, x1: x1, y1: y1,
                     heat: Math.round((warm / n) * 1000) / 1000 });
      }
    }

    var vals = tiles.map(function (t) { return t.heat; }).sort(function (a, b) { return a - b; });
    var median = vals.length ? vals[Math.floor(vals.length / 2)] : null;
    var sd = vals.length
      ? Math.sqrt(vals.reduce(function (s, v) { return s + (v - median) * (v - median); }, 0) / vals.length)
      : null;
    tiles.forEach(function (t) { t.z = sd ? (t.heat - median) / sd : 0; });

    return {
      grid: grid, tiles: tiles, total: tiles.length,
      relative: true,
      median: median, sd: sd,

      /* The two things a caller has to know before using this. */
      usable: usable && sd > 0,
      sourcePixels: w + ' x ' + h,
      resolution_m: area.source.resolution_m,

      note: 'Relative only. NASA GIBS serves this product as a rendered colour ' +
            'image rather than as values, so a tile is reported as hotter or ' +
            'cooler than the rest of this scene and never in degrees.',

      limitation: usable && sd > 0 ? null :
        'This layer is ' + area.source.resolution_m + ' m and covers the study ' +
        'area in only ' + w + ' x ' + h + ' pixels, which is coarser than the ' +
        'analysis grid. It cannot distinguish one block from the next here, so ' +
        'it is shown as context and NOT used to rank anything. Ranking blocks by ' +
        'temperature needs a thermal band at about 100 m, such as Landsat 8/9, ' +
        'which is the next source to add.'
    };
  }

  /* Named study areas over ground KuwaitSat-1 has not photographed.
     Every one is inside the Kuwait envelope the database enforces. */
  var AREAS = {
    jahra: { id: 'jahra', label: 'Al-Jahra city',
             s: 29.30, w: 47.62, n: 29.38, e: 47.73,
             note: 'The residential core of Al-Jahra and the farms on its eastern ' +
                   'edge. KuwaitSat-1 has no frame over this ground.' }
  };

  KS.reference = {
    SOURCES: SOURCES,
    AREAS: AREAS,
    fetchArea: fetchArea,
    measure: measure,
    measureHeat: measureHeat
  };
})();
