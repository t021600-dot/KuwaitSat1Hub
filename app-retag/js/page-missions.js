/* missions.html — the signed-in researcher's mission list.

   Note what is NOT here: no filter by user id. The list comes from the
   my_missions view, which Row Level Security has already narrowed to the
   rows this researcher may see. Filtering again in JavaScript would make a
   broken policy look like a working one. */

guard(function (user) {
  var list = $('#list');

  $('#subtitle').textContent =
    'Private to ' + (user.name || user.email) +
    '. Other researchers cannot see anything on this page.';

  function emptyCard() {
    var card = el('div', 'card empty');
    card.appendChild(el('div', 'mark', '—'));
    card.appendChild(el('h2', null, 'No missions yet'));
    card.appendChild(el('p', 'muted small',
      'Create a mission to give the research assistants something to work on.'));
    var p = document.createElement('p');
    var a = el('a', 'btn btn-primary', 'New mission');
    a.href = 'new-mission.html';
    p.appendChild(a);
    card.appendChild(p);
    return card;
  }

  function missionCard(m) {
    var card = el('a', 'card');
    card.href = 'mission.html?id=' + encodeURIComponent(m.id);

    var head = el('div', 'btn-row');
    head.style.justifyContent = 'space-between';
    head.style.gap = '10px';
    var h = el('h2', null, m.title);        // textContent — never innerHTML
    h.style.margin = '0';
    head.appendChild(h);
    head.appendChild(statusBadge(m.status));
    card.appendChild(head);

    if (m.injectionFlag) {
      // Raised by the agent when the objective read as an instruction
      // rather than a research question. Never editable from the browser.
      card.appendChild(el('span', 'chip chip-flag', 'Objective flagged for review'));
    }

    var snippet = m.objective && m.objective.length > 120
      ? m.objective.slice(0, 120) + '…' : (m.objective || '');
    var p = el('p', 'small muted', snippet);
    p.style.margin = '10px 0 0';
    card.appendChild(p);

    var area = el('p', 'mono muted', boundsText(m.area));
    area.style.margin = '10px 0 0';
    card.appendChild(area);

    var foot = el('div', 'btn-row small muted');
    foot.style.justifyContent = 'space-between';
    foot.style.marginTop = '10px';
    foot.appendChild(el('span', null, m.findingCount === null
      ? 'Findings appear once the agents run'
      : m.findingCount + (m.findingCount === 1 ? ' finding' : ' findings')));
    foot.appendChild(el('span', null, 'Created ' + fmtDate(m.createdAt)));
    card.appendChild(foot);

    return card;
  }

  function showError(err) {
    clear(list);
    var card = el('div', 'card');
    card.appendChild(el('p', 'banner banner-error',
      failMessage(err, 'Loading your missions')));
    var again = el('button', 'btn', 'Try again');
    again.type = 'button';
    again.addEventListener('click', load);
    card.appendChild(again);
    list.appendChild(card);
  }

  function showLoading() {
    clear(list);
    for (var i = 0; i < 3; i++) list.appendChild(el('div', 'skeleton'));
  }

  function load() {
    showLoading();
    Data.listMissions().then(function (missions) {
      clear(list);
      if (!missions.length) { list.appendChild(emptyCard()); return; }
      missions.forEach(function (m) { list.appendChild(missionCard(m)); });
    }).catch(showError);
  }

  load();
});
