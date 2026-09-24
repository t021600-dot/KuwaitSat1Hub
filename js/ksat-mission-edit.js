/* =====================================================================
   ksat-mission-edit.js - RENAME AND DELETE, FROM THE PAGE
   Owner: 02 Back End and data

   Until 15_researcher_edit_delete.sql was applied on 24 September, a
   researcher could create a mission and never touch it again.
   03_grants.sql gives `authenticated` INSERT on three columns and
   SELECT on nine, and no UPDATE or DELETE on missions at all. The cost
   showed up the night before a demo: three identically named Jahra
   missions and two mislabelled Al-Khiran ones, removable only by
   somebody with the Supabase SQL editor open.

   >>> THIS FILE ADDS NO PRIVILEGE. IT CALLS TWO RPCs. <<<
   edit_mission and delete_mission are SECURITY DEFINER with a pinned
   search_path. After the migration, `authenticated` STILL holds zero
   UPDATE and zero DELETE on every table in the schema. Verified live:
   the grant query returns no rows. The buttons here are a way to ask;
   the database is still the thing that decides.

   >>> WHAT THE DATABASE REFUSES, AND WHY THE BUTTON KNOWS FIRST <<<
     - a mission with a SIGNED REPORT cannot be deleted. reports
       .approved_by is a named human who took responsibility for an AI
       output, and the cascade would take it.
     - the OBJECTIVE locks once anything has run. agent_steps hold
       prompts built from that text; rewriting it afterwards would make
       the trail describe a question nobody asked. The title stays
       editable, because a title is a label.

   Both are enforced in SQL and both are also checked here BEFORE the
   button is drawn. Not as security - the database is the security -
   but because offering somebody a button that always fails is worse
   than not offering it. Where the button is withheld, the sentence
   explaining why takes its place.

   >>> THE CONFIRMATION NAMES WHAT IS LOST <<<
   Deleting an unsigned mission still destroys its runs, its results
   and its refused agent_steps, which are the evidence the guardrails
   fired. The dialog counts them first and says the numbers out loud. A
   confirmation that says "are you sure?" is a formality; one that says
   "this removes 2 runs, 18 steps including 3 refusals and 9 findings"
   is a decision.
   ===================================================================== */

(function () {
  'use strict';

  var KS = window.KSAT = window.KSAT || {};
  var doc = document;
  var BUSY = false;

  function el(tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) { n.className = cls; }
    if (text != null) { n.textContent = text; }
    return n;
  }

  function clear(n) { while (n && n.firstChild) { n.removeChild(n.firstChild); } }

  function say(t, bad) {
    var n = doc.getElementById('mdMsg');
    if (!n) { return; }
    clear(n);
    n.className = 'said' + (bad ? ' bad' : '');
    n.appendChild(doc.createTextNode(t || ''));
  }

  /* ------------------------------------------------------------------
     WHAT IS BEHIND THIS MISSION

     Counted before anything is offered, so the confirmation can name
     it and so the Delete button is never drawn for a mission the
     database will refuse.
     ------------------------------------------------------------------ */
  function weigh(missionId) {
    var sb = window.sb;
    if (!sb) { return Promise.resolve(null); }
    return Promise.all([
      sb.from('mission_runs').select('id').eq('mission_id', missionId),
      sb.from('reports').select('id,approved_at').eq('mission_id', missionId),
      sb.from('my_mission_results').select('id').eq('mission_id', missionId)
    ]).then(function (r) {
      if (r[0].error || r[1].error || r[2].error) { return null; }
      var runs = r[0].data || [];
      var reports = r[1].data || [];
      var results = r[2].data || [];
      return sb.from('my_agent_steps').select('id,status,run_id')
        .then(function (s) {
          var ids = {};
          runs.forEach(function (x) { ids[x.id] = 1; });
          var mine = (s.error ? [] : (s.data || [])).filter(function (x) { return ids[x.run_id]; });
          return {
            runs: runs.length,
            steps: mine.length,
            refused: mine.filter(function (x) { return x.status === 'refused'; }).length,
            results: results.length,
            reports: reports.length,
            signed: reports.filter(function (x) { return x.approved_at; }).length
          };
        });
    }).catch(function () { return null; });
  }

  /* ------------------------------------------------------------------
     RENAME
     ------------------------------------------------------------------ */
  function openEdit(m, w) {
    var bar = doc.getElementById('mdActions');
    if (!bar || doc.getElementById('mdEditBox')) { return; }

    var box = el('div', 'editbox');
    box.id = 'mdEditBox';

    var lockedObjective = !!(w && (w.runs || w.reports));

    box.appendChild(el('div', 'label', 'Mission name'));
    var t = doc.createElement('input');
    t.className = 'search';
    t.type = 'text';
    t.maxLength = 120;
    t.value = m.title || '';
    box.appendChild(t);

    box.appendChild(el('div', 'label', 'Research objective'));
    var o = doc.createElement('textarea');
    o.className = 'query';
    o.style.minHeight = '90px';
    o.maxLength = 1500;
    o.value = m.objective || '';
    o.disabled = lockedObjective;
    box.appendChild(o);

    box.appendChild(el('div', 'sub', lockedObjective
      ? 'The objective is locked because this mission has already run. ' +
        'The steps in its trail hold prompts built from this exact text, so ' +
        'changing it now would make the record describe a question nobody ' +
        'asked. The name can still be corrected.'
      : 'Nothing has run on this mission yet, so both fields can be changed. ' +
        'Once it runs, the objective locks.'));

    var act = el('div', 'actions');
    var cancel = el('button', 'btn', 'Cancel');
    cancel.type = 'button';
    cancel.addEventListener('click', function () { box.remove(); say(''); });
    var save = el('button', 'btn primary', 'Save');
    save.type = 'button';
    save.addEventListener('click', function () {
      if (BUSY) { return; }
      var title = t.value.trim();
      if (title.length < 3 || title.length > 120) {
        say('A mission name is between 3 and 120 characters.', true); return;
      }
      BUSY = true;
      save.disabled = true;
      say('Saving…');

      var args = { p_mission_id: m.id, p_title: title };
      /* NULL means "rename only". Sending the unchanged objective would
         hit the lock on a mission that has run, and fail a save the
         researcher never asked for. */
      if (!lockedObjective) { args.p_objective = o.value.trim(); }

      window.sb.rpc('edit_mission', args).then(function (r) {
        BUSY = false;
        save.disabled = false;
        if (r.error) { say(r.error.message, true); return; }
        box.remove();
        say('Saved.');
        refresh();
      });
    });
    act.appendChild(cancel);
    act.appendChild(save);
    box.appendChild(act);

    bar.parentNode.insertBefore(box, bar.nextSibling);
    t.focus();
  }

  /* ------------------------------------------------------------------
     DELETE
     ------------------------------------------------------------------ */
  function openDelete(m, w) {
    var bar = doc.getElementById('mdActions');
    if (!bar || doc.getElementById('mdDelBox')) { return; }

    var box = el('div', 'editbox danger');
    box.id = 'mdDelBox';

    box.appendChild(el('b', null, 'Delete "' + (m.title || 'this mission') + '"?'));

    var parts = [];
    if (w) {
      if (w.runs) { parts.push(w.runs + ' run' + (w.runs === 1 ? '' : 's')); }
      if (w.steps) {
        parts.push(w.steps + ' recorded step' + (w.steps === 1 ? '' : 's') +
          (w.refused ? ', ' + w.refused + ' of them refusals' : ''));
      }
      if (w.results) { parts.push(w.results + ' finding' + (w.results === 1 ? '' : 's')); }
    }

    box.appendChild(el('div', 'sub', parts.length
      ? ('This removes the mission and everything behind it: ' +
         parts.join(', ') + '. The refusals are the evidence the guardrails ' +
         'fired, and they go too. This cannot be undone.')
      : 'This mission has nothing behind it. Nothing else is removed.'));

    box.appendChild(el('div', 'sub',
      'A counts-only row is written to the monitoring table, so the deletion ' +
      'itself stays on the record even though the mission does not.'));

    var act = el('div', 'actions');
    var cancel = el('button', 'btn', 'Keep it');
    cancel.type = 'button';
    cancel.addEventListener('click', function () { box.remove(); say(''); });
    var go = el('button', 'btn danger', 'Delete permanently');
    go.type = 'button';
    go.addEventListener('click', function () {
      if (BUSY) { return; }
      BUSY = true;
      go.disabled = true;
      say('Deleting…');
      window.sb.rpc('delete_mission', { p_mission_id: m.id }).then(function (r) {
        BUSY = false;
        go.disabled = false;
        if (r.error) { box.remove(); say(r.error.message, true); return; }
        box.remove();
        var d = doc.getElementById('missionDetail');
        if (d) { d.hidden = true; }
        refresh();
      });
    });
    act.appendChild(cancel);
    act.appendChild(go);
    box.appendChild(act);

    bar.parentNode.insertBefore(box, bar.nextSibling);
  }

  function refresh() {
    /* The page owns its own loading. Clicking the sidebar item is the
       one path that repaints the table, the overview and the missions
       map together, and it costs one click's worth of work. */
    var nav = doc.querySelector('aside [data-go="missions"]');
    if (nav) { nav.click(); }
  }

  /* ------------------------------------------------------------------
     MOUNT

     actionsFor() in js/ksat-researcher.js rebuilds #mdActions from
     scratch every time a mission is opened, so anything appended here
     is destroyed by the next open. Watch the bar and re-add.
     ------------------------------------------------------------------ */
  var LAST = null;

  /* WHICH MISSION IS OPEN.

     openMission() in js/ksat-researcher.js keeps it in OPEN_MISSION, a
     private closure that file exports nothing from. What it DOES leave
     in the DOM is the highlighted row: it toggles .open on the
     .missionrow whose data-mid matches. That is the handle, and it is
     the same one the page itself relies on to show which row is
     selected, so the two cannot drift apart. */
  function currentMission() {
    var tr = doc.querySelector('#missionTable tr.missionrow.open');
    return tr ? tr.getAttribute('data-mid') : null;
  }

  function decorate() {
    var bar = doc.getElementById('mdActions');
    if (!bar || bar.querySelector('[data-act="mission-edit"]')) { return; }
    var d = doc.getElementById('missionDetail');
    if (!d || d.hidden) { return; }

    var id = currentMission();
    if (!id || !window.sb) { return; }

    window.sb.from('my_missions').select('id,title,objective,status').eq('id', id).limit(1)
      .then(function (r) {
        if (r.error || !r.data || !r.data.length) { return; }
        var m = r.data[0];
        LAST = m;
        return weigh(id).then(function (w) {
          if (bar.querySelector('[data-act="mission-edit"]')) { return; }

          var e = el('button', 'btn', 'Rename');
          e.type = 'button';
          e.setAttribute('data-act', 'mission-edit');
          e.addEventListener('click', function () { openEdit(m, w); });
          bar.appendChild(e);

          if (w && w.signed) {
            /* NO BUTTON, AND A SENTENCE IN ITS PLACE. The database would
               refuse this, and a button that always fails teaches
               nothing. */
            var why = el('span', 'sub nodel',
              'This mission has a signed report, so it cannot be deleted. ' +
              'The report was approved by a named person and deleting the ' +
              'mission would delete that approval with it.');
            bar.appendChild(why);
            return;
          }

          var x = el('button', 'btn danger', 'Delete');
          x.type = 'button';
          x.setAttribute('data-act', 'mission-delete');
          x.addEventListener('click', function () { openDelete(m, w); });
          bar.appendChild(x);
        });
      });
  }

  function watch() {
    var bar = doc.getElementById('mdActions');
    var d = doc.getElementById('missionDetail');
    if (!bar || !d || d._ksatEditWired) { return; }
    d._ksatEditWired = true;

    var t = null;
    function poke() {
      clearTimeout(t);
      t = setTimeout(decorate, 120);
    }
    new MutationObserver(poke).observe(bar, { childList: true });
    new MutationObserver(poke).observe(d, { attributes: true, attributeFilter: ['hidden'] });
    /* The highlighted row changes when a different mission is opened,
       and actionsFor() may rebuild the bar with identical children, so
       watch the table too. */
    var tbl = doc.getElementById('missionTable');
    if (tbl) { new MutationObserver(poke).observe(tbl, { subtree: true, attributes: true, attributeFilter: ['class'] }); }
    poke();
  }

  KS.missionEdit = { decorate: decorate };

  if (doc.readyState === 'loading') { doc.addEventListener('DOMContentLoaded', watch); }
  else { watch(); }
})();
