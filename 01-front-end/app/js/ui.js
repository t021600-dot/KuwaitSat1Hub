/* Shared UI helpers. No storage access here — everything goes through Data. */

function $(sel, root) { return (root || document).querySelector(sel); }
function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

function esc(s) {
  var d = document.createElement('div');
  d.textContent = (s === null || s === undefined) ? '' : String(s);
  return d.innerHTML;
}

function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function fmtDate(iso) {
  if (!iso) return '—';
  var d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  var d = new Date(iso);
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

function statusBadge(status) {
  var label = { draft: 'Draft', running: 'Running', complete: 'Complete' }[status] || status;
  return '<span class="badge badge-' + esc(status) + '"><i class="pip"></i>' + esc(label) + '</span>';
}

function boundsText(a) {
  return 'N ' + a.north.toFixed(2) + ' · S ' + a.south.toFixed(2) +
         ' · E ' + a.east.toFixed(2) + ' · W ' + a.west.toFixed(2);
}

/* Rough area of a lat/lon box in km2. Good enough to show the researcher. */
function areaKm2(a) {
  var latKm = (a.north - a.south) * 111;
  var midLat = (a.north + a.south) / 2;
  var lonKm = (a.east - a.west) * 111 * Math.cos(midLat * Math.PI / 180);
  return Math.max(0, Math.round(latKm * lonKm));
}

var ZONE_COLOURS = { high: '#4DD0C0', medium: '#F5A524', low: '#64748B' };

/* ---------- header ---------- */

function renderHeader(user) {
  var host = $('#site-header');
  if (!host) return;
  host.className = 'site-header';
  host.innerHTML =
    '<div class="wrap bar">' +
      '<a class="brand" href="' + (user ? 'missions.html' : 'index.html') + '">' +
        '<span class="dot" aria-hidden="true"></span>KuwaitSat-1 Mission Hub</a>' +
      '<span class="spacer"></span>' +
      (user
        ? '<span class="whoami"><span class="n">' + esc(user.name) + '</span><br>' +
          '<span class="o">' + esc(user.org) + '</span></span>' +
          '<button class="btn btn-sm btn-ghost" id="signout" aria-label="Sign out">Sign out</button>'
        : '<a class="btn btn-sm btn-primary" href="login.html">Researcher sign in</a>') +
    '</div>';

  var out = $('#signout');
  if (out) {
    out.addEventListener('click', function () {
      out.disabled = true;
      Data.signOut().then(function () { window.location.href = 'index.html'; });
    });
  }
}

function renderFooter() {
  var host = $('#site-footer');
  if (!host) return;
  host.className = 'site-footer';
  host.innerHTML =
    '<div class="wrap">Access restricted to authorized KuwaitSat-1 researchers. ' +
    'Demonstration build — all figures shown are sample data and are not operational measurements.</div>';
}

/* ---------- auth guard ----------
   Hides page content until we know who is signed in, so private data
   never flashes on screen. Redirects to login when there is no session. */

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
