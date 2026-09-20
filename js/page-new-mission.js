/* new-mission.html — write the objective, draw the area, launch.

   TWO THINGS IN HERE ARE LOAD-BEARING:

   1. NO maxlength ON EITHER TEXT FIELD. maxlength silently truncates a
      5,000-character paste to the limit, the form accepts the shortened
      text, a row IS created, and nothing ever refuses anything. A live
      counter plus a disabled button refuses visibly, and the database
      refuses again behind it (06_validation.sql).

   2. The area is converted from a bounding box to a GeoJSON Polygon by
      boundsToPolygon() inside js/data.js before it is sent. Send the raw
      box and kuwait_area_ok() rejects every insert. */

var TITLE_MAX = 120;        // missions_title_len: between 3 and 120
var TITLE_MIN = 3;
var OBJECTIVE_MAX = 1500;   // missions_objective_len: between 20 and 1500
var OBJECTIVE_MIN = 20;

guard(function () {
  var banner = $('#form-banner');
  var map = null;

  try {
    map = baseMap('picker');
  } catch (err) {
    // The map is a convenience, not the only way in. Fall back to coordinates.
    var slot = $('#picker');
    var fallback = el('div', 'map-placeholder',
      'The map could not load. Type the coordinates below instead.');
    slot.parentNode.replaceChild(fallback, slot);
    $('#map-hint').textContent = 'Enter the four coordinates of your area below.';
    $('#coords').open = true;
  }

  var corner1 = null, rect = null, marker = null, area = null;

  function clearArea() {
    corner1 = null;
    if (rect && map) map.removeLayer(rect);
    rect = null;
    if (marker && map) map.removeLayer(marker);
    marker = null;
    area = null;
    $('#bounds-text').textContent = 'No area selected.';
    refresh();
  }

  function setArea(a) {
    area = clampToKuwait(a);

    if (map) {
      if (rect) map.removeLayer(rect);
      if (marker) { map.removeLayer(marker); marker = null; }
      rect = L.rectangle(areaToBounds(area), {
        color: '#4DD0C0', weight: 2, fillColor: '#4DD0C0', fillOpacity: 0.12
      }).addTo(map);
      map.fitBounds(rect.getBounds(), { padding: [24, 24], maxZoom: 11 });
    }

    $('#bounds-text').textContent = areaLine(area);
    $('#n').value = area.north.toFixed(2);
    $('#s').value = area.south.toFixed(2);
    $('#e').value = area.east.toFixed(2);
    $('#w').value = area.west.toFixed(2);
    refresh();
  }

  if (map) map.on('click', function (ev) {
    if (area) clearArea();
    if (!corner1) {
      corner1 = ev.latlng;
      marker = L.circleMarker(corner1, { radius: 6, color: '#4DD0C0', fillOpacity: 1 }).addTo(map);
      $('#map-hint').textContent = 'First corner set. Now tap the opposite corner.';
      return;
    }
    var c2 = ev.latlng;
    setArea({
      north: Math.max(corner1.lat, c2.lat), south: Math.min(corner1.lat, c2.lat),
      east:  Math.max(corner1.lng, c2.lng), west:  Math.min(corner1.lng, c2.lng)
    });
    corner1 = null;
    $('#map-hint').textContent = 'Area selected. Tap the map twice again to replace it.';
  });

  $('#use-view').addEventListener('click', function () {
    if (!map) return;
    var b = map.getBounds();
    setArea({ north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() });
    $('#map-hint').textContent = 'Area selected from the current view. Tap the map twice to replace it.';
  });

  $('#clear-area').addEventListener('click', function () {
    clearArea();
    $('#map-hint').textContent = 'Tap one corner on the map, then tap the opposite corner.';
  });

  $('#apply-coords').addEventListener('click', function () {
    var n = parseFloat($('#n').value), s = parseFloat($('#s').value);
    var e = parseFloat($('#e').value), w = parseFloat($('#w').value);
    if ([n, s, e, w].some(isNaN)) {
      fieldError('area', 'Fill all four coordinate fields.');
      return;
    }
    fieldError('area', '');
    setArea({ north: n, south: s, east: e, west: w });
  });

  /* ---------- counters ----------
     The counter turns red past the limit and the button goes dead, so an
     over-length paste is refused ON SCREEN as well as by the database. */

  function countField(inputId, countId, max) {
    var input = $('#' + inputId), out = $('#' + countId);
    function update() {
      var len = input.value.trim().length;
      out.textContent = len.toLocaleString('en-GB');
      out.parentNode.classList.toggle('over', len > max);
      refresh();
    }
    input.addEventListener('input', update);
    update();
  }

  countField('title', 'title-count', TITLE_MAX);
  countField('objective', 'objective-count', OBJECTIVE_MAX);

  $('#title').addEventListener('blur', function () { validate(true); });
  $('#objective').addEventListener('blur', function () { validate(true); });

  function fieldError(id, msg) {
    var box = $('#e-' + id);
    var input = $('#' + id);
    if (msg) {
      if (input) input.setAttribute('aria-invalid', 'true');
      box.textContent = msg;
      box.hidden = false;
    } else {
      if (input) input.removeAttribute('aria-invalid');
      box.textContent = '';
      box.hidden = true;
    }
    return !msg;
  }

  function titleProblem() {
    var v = $('#title').value.trim();
    if (!v) return 'Mission title is required.';
    if (v.length < TITLE_MIN) return 'The title needs at least ' + TITLE_MIN + ' characters.';
    if (v.length > TITLE_MAX) return 'The title is ' + v.length + ' characters. The limit is ' + TITLE_MAX + '.';
    return '';
  }

  function objectiveProblem() {
    var v = $('#objective').value.trim();
    if (v.length < OBJECTIVE_MIN) return 'Write at least ' + OBJECTIVE_MIN + ' characters.';
    if (v.length > OBJECTIVE_MAX) {
      return 'The objective is ' + v.length.toLocaleString('en-GB') +
             ' characters. The limit is ' + OBJECTIVE_MAX.toLocaleString('en-GB') +
             ' — nothing has been saved, and nothing was cut off.';
    }
    return '';
  }

  function missing() {
    var out = [];
    if (titleProblem()) out.push('a title of ' + TITLE_MIN + '–' + TITLE_MAX + ' characters');
    if (objectiveProblem()) out.push('an objective of ' + OBJECTIVE_MIN + '–' +
      OBJECTIVE_MAX.toLocaleString('en-GB') + ' characters');
    if (!area) out.push('an area on the map');
    return out;
  }

  function validate(show) {
    if (show) {
      fieldError('title', titleProblem());
      fieldError('objective', objectiveProblem());
      fieldError('area', area ? '' : 'Select an area on the map.');
    }
    return missing().length === 0;
  }

  function refresh() {
    var gaps = missing();
    $('#launch').disabled = gaps.length > 0;
    $('#launch-reason').textContent = gaps.length
      ? 'Still needed: ' + gaps.join(', ') + '.'
      : 'Ready to launch.';
  }

  $('#mission-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    hideBanner(banner);
    if (!validate(true)) {
      setBanner(banner, 'error', 'Nothing was saved. Fix the fields marked above and try again.');
      return;
    }

    var btn = $('#launch');
    var restore = setBusy(btn, 'Launching…');
    setBanner(banner, 'note', 'Saving the mission…');

    var created = null;

    Data.createMission({
      title: $('#title').value.trim(),
      objective: $('#objective').value.trim(),
      area: area
    }).then(function (m) {
      created = m;
      setBanner(banner, 'note', 'Mission saved. Asking the agents to start…');
      return Data.startPipeline(m.id);
    }).then(function () {
      setBanner(banner, 'ok', 'Launched. Opening the mission…');
      window.location.href = 'mission.html?id=' + encodeURIComponent(created.id);
    }).catch(function (err) {
      restore('Launch Mission');
      if (created) {
        // The mission exists; only the launch was refused (a rate limit,
        // usually). Do not pretend it vanished.
        setBanner(banner, 'error', failMessage(err, 'Launching the mission') +
          ' The mission itself was saved — open it from My missions and press Launch.');
      } else {
        setBanner(banner, 'error', failMessage(err, 'Saving the mission') +
          ' Nothing was saved.');
      }
    });
  });

  setTimeout(function () { if (map) map.invalidateSize(); }, 200);
  refresh();
});
