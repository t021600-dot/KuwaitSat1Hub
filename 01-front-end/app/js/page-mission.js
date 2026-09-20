/* mission.html — the agent pipeline, the results map, the review checkpoint.

   D-6: the six agent steps are POLLED from the my_agent_steps view every two
   seconds. Not Realtime, no websocket — our CSP has no wss:// in connect-src
   on purpose, and a poll that fails says so instead of going quiet.

   Nothing an agent wrote is ever put on screen with innerHTML. Titles and
   bodies go through textContent, and the map popups are DOM nodes, because
   Leaflet's bindPopup() takes HTML. */

var POLL_MS = 2000;

guard(function () {
  var missionId = qs('id');
  var mission = null, run = null, steps = [], results = [], report = null;
  var map = null, drawn = {}, timer = null, polling = false;

  function notFound() {
    var host = clear($('#content'));
    var card = el('div', 'card empty');
    card.appendChild(el('div', 'mark', '—'));
    card.appendChild(el('h1', null, 'Mission not found, or you do not have access to it'));
    card.appendChild(el('p', 'muted small',
      'If another researcher owns this mission, it will not open here.'));
    var p = document.createElement('p');
    var a = el('a', 'btn btn-primary', 'Back to my missions');
    a.href = 'missions.html';
    p.appendChild(a);
    card.appendChild(p);
    host.appendChild(card);
  }

  function loadFailed(err) {
    var host = clear($('#content'));
    var card = el('div', 'card');
    card.appendChild(el('p', 'banner banner-error', failMessage(err, 'Loading this mission')));
    var again = el('button', 'btn', 'Try again');
    again.type = 'button';
    again.addEventListener('click', start);
    card.appendChild(again);
    host.appendChild(card);
  }

  /* The shell is fixed markup with no data in it, so this one innerHTML is
     a template, not a place a value can be injected. Everything after this
     is filled in with textContent. */
  function shell() {
    $('#content').innerHTML = '' +
      '<div class="section">' +
        '<p class="small"><a href="missions.html">← My missions</a></p>' +
        '<div class="btn-row" style="justify-content:space-between;gap:10px">' +
          '<h1 style="margin:0" id="m-title"></h1>' +
          '<span id="m-status"></span>' +
        '</div>' +
        '<p id="m-flag" hidden><span class="chip chip-flag">Objective flagged for review</span></p>' +
        '<p id="m-objective" style="margin-top:12px"></p>' +
        '<dl class="kv" style="margin-top:12px">' +
          '<dt>Area</dt><dd class="mono" id="m-area"></dd>' +
          '<dt>Created</dt><dd id="m-created"></dd>' +
          '<dt>Launched</dt><dd id="m-launched"></dd>' +
        '</dl>' +
      '</div>' +

      '<section class="card section" aria-labelledby="pipe-h">' +
        '<div class="pipeline-head">' +
          '<h2 id="pipe-h" style="margin:0">Agent pipeline</h2>' +
          '<span class="small muted" id="pipe-count"></span>' +
        '</div>' +
        '<ol class="timeline" id="timeline" aria-live="polite"></ol>' +
        '<p class="small muted" id="poll-note" style="margin-top:14px">The agents assist. ' +
        'They do not command the satellite and they do not decide anything for you. ' +
        'All figures shown are sample data.</p>' +
      '</section>' +

      '<section class="section" aria-labelledby="map-h">' +
        '<h2 id="map-h">Results on the map</h2>' +
        '<div id="map-slot"></div>' +
        '<div class="legend" id="legend" hidden>' +
          '<span><i style="background:#4DD0C0"></i> Site</span>' +
          '<span><i style="background:#F5A524"></i> Map layer</span>' +
          '<span>Dashed outline = the area you selected</span>' +
        '</div>' +
      '</section>' +

      '<section class="section" aria-labelledby="find-h">' +
        '<h2 id="find-h">Findings</h2>' +
        '<div id="findings"></div>' +
      '</section>' +

      '<section class="review" aria-labelledby="rev-h">' +
        '<h2 id="rev-h" style="margin-top:0">Researcher review</h2>' +
        '<p class="small muted" id="rev-copy">The agents are still working. Nothing is ' +
        'published until you approve it.</p>' +
        '<div class="btn-row">' +
          '<button class="btn btn-primary" type="button" id="gen" disabled>Generate Report</button>' +
          '<span class="small muted" id="gen-reason">Available when all six agents finish.</span>' +
        '</div>' +
      '</section>';

    $('#gen').addEventListener('click', onGenerate);
  }

  function renderHead() {
    $('#m-title').textContent = mission.title;
    clear($('#m-status')).appendChild(statusBadge(mission.status));
    $('#m-flag').hidden = !mission.injectionFlag;
    $('#m-objective').textContent = mission.objective;
    $('#m-area').textContent = areaLine(mission.area);
    $('#m-created').textContent = fmtDateTime(mission.createdAt);
    $('#m-launched').textContent = mission.launchedAt
      ? fmtDateTime(mission.launchedAt) : 'Not launched yet';
  }

  var STEP_STATE = {
    queued: 'Queued', running: 'Running…', complete: 'Complete',
    refused: 'Refused', failed: 'Failed', missing: 'Never ran'
  };

  function renderTimeline() {
    var done = steps.filter(function (s) { return s.status === 'complete'; }).length;
    $('#pipe-count').textContent = done + ' of ' + steps.length + ' complete' +
      (run ? '' : ' — not launched yet');

    var host = clear($('#timeline'));

    steps.forEach(function (s) {
      var li = el('li', 'agent ' + s.status);
      li.setAttribute('aria-label', s.name + ', ' + (STEP_STATE[s.status] || s.status));

      var node = el('span', 'node', s.status === 'complete' ? '✓'
        : s.status === 'refused' || s.status === 'failed' ? '!' : String(s.order));
      node.setAttribute('aria-hidden', 'true');
      li.appendChild(node);

      var body = el('span', 'body');
      body.appendChild(el('span', 'nm', s.name));

      var st = el('span', 'st');
      if (s.status === 'running') {
        var spin = el('span', 'spin');
        spin.setAttribute('aria-hidden', 'true');
        st.appendChild(spin);
        st.appendChild(document.createTextNode(' Running…'));
      } else {
        st.textContent = STEP_STATE[s.status] || s.status;
      }
      body.appendChild(st);

      // The role is our own fixed copy. The refusal reason is the
      // database's, so it goes in as text.
      body.appendChild(el('span', 'sm', s.summary || s.role));
      if (s.refusedReason) {
        body.appendChild(el('span', 'sm bad', 'Refused: ' + s.refusedReason));
      }
      if (s.injectionFlag) {
        body.appendChild(el('span', 'sm bad',
          'This step was flagged as a possible prompt injection.'));
      }

      li.appendChild(body);
      host.appendChild(li);
    });
  }

  function mapped() {
    return results.filter(function (r) { return r.geometry; });
  }

  function renderMap() {
    var slot = $('#map-slot');

    if (!mapped().length) {
      clear(slot).appendChild(el('div', 'map-placeholder',
        run ? 'Result areas appear here as the agents write them.'
            : 'Launch the mission to see result areas here.'));
      $('#legend').hidden = true;
      map = null;
      drawn = {};
      return;
    }
    if (map) { syncShapes(); return; }

    clear(slot);
    var holder = el('div', 'map');
    holder.id = 'results-map';
    slot.appendChild(holder);

    try {
      map = baseMap('results-map');
      if (mission.area) {
        L.rectangle(areaToBounds(mission.area), {
          color: '#4DD0C0', weight: 2, dashArray: '5,5', fill: false
        }).addTo(map);
        map.fitBounds(areaToBounds(mission.area), { padding: [24, 24] });
      }
      $('#legend').hidden = false;
      setTimeout(function () { if (map) map.invalidateSize(); }, 150);
      syncShapes();
    } catch (err) {
      // The findings below still tell the whole story without the map.
      map = null;
      clear(slot).appendChild(el('div', 'map-placeholder',
        'The map could not load. The findings are listed below as text.'));
      $('#legend').hidden = true;
    }
  }

  function syncShapes() {
    if (!map) return;
    mapped().forEach(function (r) {
      if (drawn[r.id]) return;
      var colour = KIND_COLOURS[r.kind] || '#4DD0C0';
      var layer;
      try {
        layer = L.geoJSON(r.geometry, {
          style: { color: colour, weight: 2, fillColor: colour, fillOpacity: 0.28 }
        });
      } catch (e) {
        return;   // a geometry we cannot draw must not break the page
      }
      // bindPopup() and bindTooltip() take HTML. Give them nodes instead.
      layer.bindPopup(popupNode(r.title, [KIND_LABELS[r.kind] || r.kind, r.body]));
      layer.bindTooltip(popupNode(r.title, []));
      layer.on('click', function () {
        var card = document.getElementById('finding-' + r.id);
        if (!card) return;
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.style.borderColor = colour;
        setTimeout(function () { card.style.borderColor = ''; }, 1600);
      });
      layer.addTo(map);
      drawn[r.id] = layer;
    });
  }

  function renderFindings() {
    var host = clear($('#findings'));

    if (!results.length) {
      host.appendChild(el('p', 'small muted',
        run ? 'Findings appear as the agents complete their analysis.'
            : 'Launch the mission and the agents will write their findings here.'));
      return;
    }

    results.forEach(function (r) {
      var card = el('div', 'card');
      card.id = 'finding-' + r.id;

      var head = el('div', 'btn-row');
      head.style.justifyContent = 'space-between';
      head.style.gap = '10px';
      var h = el('h3', null, r.title);       // agent-written — textContent
      h.style.margin = '0';
      head.appendChild(h);
      head.appendChild(el('span', 'chip chip-' + r.kind, KIND_LABELS[r.kind] || r.kind));
      card.appendChild(head);

      var body = el('p', 'small muted', r.body || '');
      body.style.margin = '10px 0 0';
      body.style.whiteSpace = 'pre-wrap';    // keep the agent's line breaks
      card.appendChild(body);

      host.appendChild(card);
    });
  }

  function refusedStep() {
    return steps.find(function (s) {
      return s.status === 'refused' || s.status === 'failed';
    }) || null;
  }

  function renderReview() {
    var gen = $('#gen');
    if (!gen) return;

    if (report) {
      $('#rev-copy').textContent = 'Mission Complete ✓ — you approved this report on ' +
        fmtDateTime(report.approvedAt) + '.';
      var link = el('a', 'btn btn-primary', 'View report');
      link.href = 'report.html?id=' + encodeURIComponent(mission.id);
      link.id = 'gen';
      gen.parentNode.replaceChild(link, gen);
      $('#gen-reason').textContent = '';
      return;
    }

    if (!run) {
      $('#rev-copy').textContent = 'This mission has not been launched yet. ' +
        'Launching starts the six research assistants.';
      gen.textContent = 'Launch Mission';
      gen.dataset.action = 'launch';
      gen.disabled = false;
      $('#gen-reason').textContent = 'You decide when the agents start.';
      return;
    }

    gen.dataset.action = 'report';
    gen.textContent = 'Generate Report';

    if (run.status === 'complete') {
      $('#rev-copy').textContent = 'The agents have finished. Nothing is published until ' +
        'you approve it.';
      gen.disabled = false;
      $('#gen-reason').textContent = 'You are approving this analysis for release.';
      return;
    }

    if (run.status === 'failed' || run.status === 'stalled') {
      var bad = refusedStep();
      $('#rev-copy').textContent = 'The run ' +
        (run.status === 'stalled' ? 'stalled' : 'failed') + '. ' +
        (bad && bad.refusedReason
          ? 'The ' + bad.name + ' step was refused: ' + bad.refusedReason
          : 'No report can be generated from an incomplete run.');
      gen.disabled = true;
      $('#gen-reason').textContent = 'Create a new mission to run the agents again.';
      return;
    }

    gen.disabled = true;
    $('#gen-reason').textContent = 'Available when all six agents finish.';
  }

  function onGenerate() {
    var btn = $('#gen');

    if (btn.dataset.action === 'launch') {
      var restoreLaunch = setBusy(btn, 'Launching…');
      $('#gen-reason').textContent = 'Asking the database to queue a run…';
      Data.startPipeline(mission.id)
        .then(function () { return refreshAll(); })
        .then(function () { startPolling(); })
        .catch(function (err) {
          restoreLaunch('Launch Mission');
          $('#gen-reason').textContent = failMessage(err, 'Launching the mission');
        });
      return;
    }

    var restore = setBusy(btn, 'Generating…');
    $('#gen-reason').textContent = 'Writing the report and recording your approval…';
    Data.generateReport(mission.id).then(function (r) {
      report = r;
      return Data.getMission(mission.id);
    }).then(function (m) {
      if (m) mission = m;
      renderHead();
      renderReview();
    }).catch(function (err) {
      restore('Generate Report');
      $('#gen-reason').textContent = failMessage(err, 'Generating the report');
    });
  }

  function refreshAll() {
    return Promise.all([
      Data.getRunState(mission.id),
      Data.getResults(mission.id),
      Data.getReport(mission.id)
    ]).then(function (res) {
      run = res[0].run;
      steps = res[0].steps;
      results = res[1];
      report = res[2];
      $('#poll-note').classList.remove('bad');
      renderTimeline();
      renderMap();
      renderFindings();
      renderReview();
    });
  }

  function runActive() {
    return !!run && (run.status === 'queued' || run.status === 'running');
  }

  /* Poll, do not spin. If a poll fails, say so on screen and keep the last
     good state instead of blanking the page. */
  function startPolling() {
    if (timer) return;
    timer = setInterval(function () {
      // On a slow connection one poll can still be in flight when the next
      // tick fires. Skipping rather than stacking keeps the strip honest.
      if (polling) return;
      polling = true;
      Data.tick(mission.id)
        .then(refreshAll)
        .then(function () {
          polling = false;
          if (!runActive()) { clearInterval(timer); timer = null; }
        })
        .catch(function (err) {
          polling = false;
          clearInterval(timer); timer = null;
          var note = $('#poll-note');
          note.classList.add('bad');
          note.textContent = failMessage(err, 'Reading the agent steps') +
            ' Reload the page to try again.';
        });
    }, POLL_MS);
  }

  function start() {
    if (!missionId) { notFound(); return; }
    Data.getMission(missionId).then(function (m) {
      if (!m) { notFound(); return; }
      mission = m;
      shell();
      renderHead();
      return refreshAll().then(function () {
        if (runActive()) startPolling();
      });
    }).catch(loadFailed);
  }

  start();
});
