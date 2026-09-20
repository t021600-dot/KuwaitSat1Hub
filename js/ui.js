/* Shared UI helpers. No storage access here — everything goes through Data.

   TWO RULES THIS FILE EXISTS TO ENFORCE:
   1. Text a person or an agent wrote goes on screen with textContent, or is
      escaped with esc() if it really must pass through innerHTML. Never raw.
   2. Nothing here is an inline handler. Our Content Security Policy is
      script-src 'self', so onclick="" attributes simply do not run. */

function $(sel, root) { return (root || document).querySelector(sel); }
function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

function esc(s) {
  var d = document.createElement('div');
  d.textContent = (s === null || s === undefined) ? '' : String(s);
  return d.innerHTML;
}

/* Build an element and fill it with textContent in one line.
   Using this instead of a string of HTML is what makes an XSS impossible
   rather than merely unlikely. */
function el(tag, className, text) {
  var node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== null && text !== undefined) node.textContent = String(text);
  return node;
}

function clear(node) {
  while (node && node.firstChild) node.removeChild(node.firstChild);
  return node;
}

function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function fmtDate(iso) {
  if (!iso) return '—';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

/* ---------- status ----------
   These six values are the ones missions_status_allowed accepts in
   06_validation.sql. A status we do not recognise is shown as itself rather
   than swallowed, so a mismatch with the database is visible, not silent. */

var STATUS_LABELS = {
  draft: 'Draft', queued: 'Queued', running: 'Running',
  review: 'Ready for review', complete: 'Complete', failed: 'Failed'
};
var STATUS_TONE = {
  draft: 'draft', queued: 'running', running: 'running',
  review: 'review', complete: 'complete', failed: 'failed'
};

/* Returns an ELEMENT, not a string of HTML. */
function statusBadge(status) {
  var key = String(status || '');
  var span = el('span', 'badge badge-' + (STATUS_TONE[key] || 'draft'));
  var pip = el('i', 'pip');
  pip.setAttribute('aria-hidden', 'true');
  span.appendChild(pip);
  span.appendChild(document.createTextNode(STATUS_LABELS[key] || key || 'Unknown'));
  return span;
}

/* ---------- the map area ----------
   THE FIELD-SHAPE RULE (DECISIONS D-3, 06_validation.sql):
   the map draw tool thinks in a bounding box {north, south, east, west};
   the database column area_geojson accepts only a GeoJSON Polygon whose ring
   is [lng, lat] pairs and whose LAST POINT REPEATS THE FIRST. Send the
   bounding box and kuwait_area_ok() refuses the insert every single time,
   with a constraint name the researcher cannot act on. Convert here, once,
   on the way out. */

var KUWAIT = { west: 46.5, east: 48.8, south: 28.5, north: 30.1 };

function boundsToPolygon(b) {
  if (!b) return null;
  var w = Number(b.west), e = Number(b.east);
  var s = Number(b.south), n = Number(b.north);
  if ([w, e, s, n].some(function (v) { return isNaN(v); })) return null;
  return {
    type: 'Polygon',
    // One ring, five points: the four corners, then the first corner again
    // to close it. Longitude FIRST — GeoJSON is [lng, lat] while Leaflet is
    // [lat, lng], and that swap is the classic silent bug.
    coordinates: [[
      [w, s],
      [e, s],
      [e, n],
      [w, n],
      [w, s]
    ]]
  };
}

/* The inverse, used when reading a mission back. The screens draw and label a
   rectangle, so we reduce whatever polygon the database holds to its extent. */
function polygonToBounds(g) {
  if (!g || g.type !== 'Polygon' || !g.coordinates || !g.coordinates[0]) return null;
  var ring = g.coordinates[0];
  var lngs = [], lats = [];
  for (var i = 0; i < ring.length; i++) {
    var p = ring[i];
    if (!p || p.length < 2) continue;
    var lng = Number(p[0]), lat = Number(p[1]);
    if (isNaN(lng) || isNaN(lat)) continue;
    lngs.push(lng);
    lats.push(lat);
  }
  if (!lngs.length) return null;
  return {
    west: Math.min.apply(null, lngs), east: Math.max.apply(null, lngs),
    south: Math.min.apply(null, lats), north: Math.max.apply(null, lats)
  };
}

/* Keep a box inside Kuwait and give it a minimum size. The database checks
   this too — this is only so the researcher is not refused after the fact. */
function clampToKuwait(a) {
  var b = {
    north: Math.min(KUWAIT.north, Math.max(KUWAIT.south, Number(a.north))),
    south: Math.min(KUWAIT.north, Math.max(KUWAIT.south, Number(a.south))),
    east:  Math.min(KUWAIT.east,  Math.max(KUWAIT.west,  Number(a.east))),
    west:  Math.min(KUWAIT.east,  Math.max(KUWAIT.west,  Number(a.west)))
  };
  if (b.north < b.south) { var t = b.north; b.north = b.south; b.south = t; }
  if (b.east < b.west) { var u = b.east; b.east = b.west; b.west = u; }
  if (b.north - b.south < 0.05) b.north = Math.min(KUWAIT.north, b.south + 0.05);
  if (b.east - b.west < 0.05) b.east = Math.min(KUWAIT.east, b.west + 0.05);
  return b;
}

function boundsText(a) {
  if (!a) return 'No area recorded.';
  return 'N ' + a.north.toFixed(2) + ' · S ' + a.south.toFixed(2) +
         ' · E ' + a.east.toFixed(2) + ' · W ' + a.west.toFixed(2);
}

/* Rough area of a lat/lon box in km2. Good enough to show the researcher. */
function areaKm2(a) {
  if (!a) return 0;
  var latKm = (a.north - a.south) * 111;
  var midLat = (a.north + a.south) / 2;
  var lonKm = (a.east - a.west) * 111 * Math.cos(midLat * Math.PI / 180);
  return Math.max(0, Math.round(latKm * lonKm));
}

function areaLine(a) {
  if (!a) return 'No area recorded.';
  return boundsText(a) + ' — approx. ' + areaKm2(a).toLocaleString('en-GB') + ' km²';
}

/* Colours and labels keyed by results.kind — the CHECK constraint on the
   results table allows exactly these four. Only 'site' and 'map_layer' ever
   carry geometry. */
var KIND_COLOURS = {
  site: '#4DD0C0', map_layer: '#F5A524', metric: '#64748B', narrative: '#64748B'
};
var KIND_LABELS = {
  site: 'Site', metric: 'Metric', map_layer: 'Map layer', narrative: 'Narrative'
};

/* ---------- form feedback ----------
   Every form here owes the researcher three answers: it is working, it
   worked, or IT FAILED AND HERE IS WHY. A spinner that never resolves is the
   one outcome we do not ship. */

function setBanner(node, kind, message) {
  if (!node) return;
  node.className = 'banner banner-' + kind;
  node.textContent = message;
  node.hidden = false;
}

function hideBanner(node) {
  if (!node) return;
  node.textContent = '';
  node.hidden = true;
}

/* Puts a button into its loading state and hands back the undo, so a catch
   block physically cannot forget to re-enable it. */
function setBusy(btn, busyLabel) {
  if (!btn) return function () {};
  var wasLabel = btn.textContent;
  btn.disabled = true;
  clear(btn);
  var spin = el('span', 'spin');
  spin.setAttribute('aria-hidden', 'true');
  btn.appendChild(spin);
  btn.appendChild(document.createTextNode(' ' + busyLabel));
  return function restore(label) {
    btn.disabled = false;
    btn.textContent = label || wasLabel;
  };
}

/* One sentence, always containing the word "failed" and a reason. Never a
   bare error code, and never silence. */
function failMessage(err, what) {
  var reason = (err && err.message) ? String(err.message) : 'the server did not say why';
  return what + ' failed — ' + reason;
}

/* ---------- header / footer ---------- */

function renderHeader(user) {
  var host = $('#site-header');
  if (!host) return;
  host.className = 'site-header';
  clear(host);

  var bar = el('div', 'wrap bar');
  var brand = el('a', 'brand');
  brand.href = user ? 'missions.html' : 'index.html';
  var dot = el('span', 'dot');
  dot.setAttribute('aria-hidden', 'true');
  brand.appendChild(dot);
  brand.appendChild(document.createTextNode('KuwaitSat-1 Mission Hub'));
  bar.appendChild(brand);
  bar.appendChild(el('span', 'spacer'));

  if (user) {
    var who = el('span', 'whoami');
    who.appendChild(el('span', 'n', user.name || user.email || 'Researcher'));
    who.appendChild(document.createElement('br'));
    who.appendChild(el('span', 'o', user.org || ''));
    bar.appendChild(who);

    var out = el('button', 'btn btn-sm btn-ghost', 'Sign out');
    out.type = 'button';
    out.id = 'signout';
    out.addEventListener('click', function () {
      var restore = setBusy(out, 'Signing out…');
      Data.signOut()
        .then(function () { window.location.href = 'index.html'; })
        .catch(function (err) {
          restore('Sign out');
          window.alert(failMessage(err, 'Sign out'));
        });
    });
    bar.appendChild(out);
  } else {
    var link = el('a', 'btn btn-sm btn-primary', 'Researcher sign in');
    link.href = 'login.html';
    bar.appendChild(link);
  }

  host.appendChild(bar);
}

function renderFooter() {
  var host = $('#site-footer');
  if (!host) return;
  host.className = 'site-footer';
  clear(host);
  var wrap = el('div', 'wrap');
  wrap.appendChild(el('div', null,
    'Access restricted to authorized KuwaitSat-1 researchers. Demonstration build — ' +
    'all figures shown are sample data and are not operational measurements.'));
  if (!Data.isLive()) {
    // Say it out loud. A demo running on browser storage must never be
    // mistaken for the database answering.
    wrap.appendChild(el('div', 'demo-flag',
      'DEMO MODE — no Supabase project is connected, so this browser is storing ' +
      'everything locally. Nothing on this screen proves access control.'));
  }
  host.appendChild(wrap);
}

/* ---------- auth guard ----------
   Hides page content until we know who is signed in, so private data never
   flashes on screen. Redirects to login when there is no session. */

function guard(onReady) {
  var app = $('#app');
  var boot = $('#boot');
  Data.getCurrentUser().then(function (user) {
    if (!user) { window.location.replace('login.html'); return; }
    renderHeader(user);
    renderFooter();
    if (boot) boot.remove();
    if (app) app.hidden = false;
    onReady(user);
  }).catch(function (err) {
    // Never leave "Checking access…" spinning for ever.
    if (boot) boot.textContent = failMessage(err, 'Checking your session');
  });
}

/* ---------- Leaflet helpers ---------- */

var KUWAIT_CENTER = [29.31, 47.48];
var KUWAIT_ZOOM = 8;

function baseMap(elId, opts) {
  var map = L.map(elId, {
    center: (opts && opts.center) || KUWAIT_CENTER,
    zoom: (opts && opts.zoom) || KUWAIT_ZOOM,
    scrollWheelZoom: false,
    attributionControl: true
  });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
  return map;
}

function areaToBounds(a) {
  return [[a.south, a.west], [a.north, a.east]];
}

/* Leaflet's bindPopup() and bindTooltip() take HTML. Handing them a string
   built from a title an agent wrote is an innerHTML in disguise, so we hand
   them a DOM node instead and let the browser keep it as text. */
function popupNode(title, lines) {
  var box = el('div', 'popup');
  box.appendChild(el('strong', null, title));
  (lines || []).forEach(function (line) {
    if (line === null || line === undefined || line === '') return;
    box.appendChild(el('div', 'small', line));
  });
  return box;
}
