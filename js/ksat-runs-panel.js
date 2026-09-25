/* =====================================================================
   ksat-runs-panel.js - hide the runs summary, and delete a run from it
   Owner: 01 Front End

   Two things were asked for on the "Your Runs" card in the overview:
   the choice to show or hide it, and the ability to delete a run.

   ---------------------------------------------------------------------
   1 · SHOW OR HIDE IS A VIEW PREFERENCE, AND IT IS KEPT IN THE BROWSER
   ---------------------------------------------------------------------
   It is deliberately NOT stored in the database. There is no archived,
   deleted_at or hidden column on missions and no status value that
   means archived - checked against the applied SQL - so a server-side
   hide would be a live-database change, a new column, a new grant and a
   new policy, applied by hand after review. That is a large amount of
   new surface for "I do not want to look at this card right now".

   localStorage is the honest shape for it: it is this viewer's own
   preference, on this browser, and it cannot be mistaken for the run
   being archived or deleted. Every read and write is wrapped, because
   the accessor throws outright in a private window with site data
   blocked and the panel must not disappear when that happens.

   THE HEADER NEVER HIDES. Only the table and its message go. A control
   that hides the thing containing the control is a control you press
   once.

   ---------------------------------------------------------------------
   2 · DELETE REUSES THE FLOW THAT WAS ALREADY REVIEWED
   ---------------------------------------------------------------------
   Nothing about deleting is implemented here. js/ksat-mission-edit.js
   already owns it and calls the delete_mission RPC, which is SECURITY
   DEFINER, owner-scoped, refuses a run that has a signed report, and
   writes a counts-only row to monitoring_events before it erases
   anything. This file asks that flow to open, against this row, with
   its confirmation placed under this table.

   A second copy of that confirmation would drift from the first the
   day either was touched, and what would drift is the sentence in
   front of an irreversible delete.

   WHAT A DELETE ACTUALLY DESTROYS, since this file puts a second door
   on it: the run, its recorded steps including the refusals that are
   the evidence the guardrails fired, and its findings. The confirmation
   names those counts before the press. A run whose report has been
   signed cannot be deleted at all, here or anywhere.
   ===================================================================== */
(function (w, doc) {
  'use strict';

  var KS = w.KSAT = w.KSAT || {};
  if (KS.runsPanel) { return; }

  var TABLE = 'ovMissions';
  var MSG = 'ovMissionsMsg';
  var KEY = 'ksat.runsPanel.hidden';

  function el(tag, cls, txt) {
    var n = doc.createElement(tag);
    if (cls) { n.className = cls; }
    if (txt != null) { n.textContent = txt; }
    return n;
  }

  /* Both wrapped. In a private window with site data blocked these
     throw rather than returning null, and an exception here would take
     the whole panel with it. */
  function readHidden() {
    try { return w.localStorage.getItem(KEY) === '1'; } catch (e) { return false; }
  }
  function writeHidden(v) {
    try { w.localStorage.setItem(KEY, v ? '1' : '0'); } catch (e) {}
  }

  /* ------------------------------------------------------------------
     THE HIDE CONTROL
     ------------------------------------------------------------------ */
  function mountToggle(card, table) {
    var head = card.querySelector('.ct');
    if (!head || head.querySelector('.ksat-rp-toggle')) { return; }

    var msg = doc.getElementById(MSG);
    var btn = el('button', 'btn ksat-rp-toggle');
    btn.type = 'button';
    btn.setAttribute('aria-controls', TABLE);

    function paint(hidden) {
      table.hidden = hidden;
      if (msg) { msg.hidden = hidden; }
      btn.textContent = hidden ? 'Show runs' : 'Hide runs';
      btn.setAttribute('aria-expanded', hidden ? 'false' : 'true');
      card.classList.toggle('ksat-rp-collapsed', hidden);
    }

    btn.addEventListener('click', function () {
      var next = !table.hidden;
      writeHidden(next);
      paint(next);
    });

    /* Before "View archive", so the two controls read in the order a
       reader uses them: deal with this card, then leave it. */
    head.insertBefore(btn, head.querySelector('[data-go="missions"]') || null);
    paint(readHidden());
  }

  /* ------------------------------------------------------------------
     THE DELETE CONTROL, ONE PER ROW

     paintMissions() in js/ksat-researcher.js rebuilds every row on each
     refresh, so this runs from an observer rather than once.
     ------------------------------------------------------------------ */
  function mountRowControls(table) {
    var rows = table.rows, i;
    for (i = 0; i < rows.length; i++) {
      var tr = rows[i];

      /* The header row gets a header cell, and nothing else. */
      if (tr.cells.length && tr.cells[0].tagName === 'TH') {
        if (tr.cells.length < 5) { tr.appendChild(el('th', null, '')); }
        continue;
      }

      var mid = tr.getAttribute('data-mid');
      if (!mid || tr.cells.length > 4) { continue; }

      var td = el('td', 'ksat-rp-act');
      var x = el('button', 'btn sm danger ksat-rp-del', 'Delete');
      x.type = 'button';
      x.setAttribute('data-mid', mid);
      x.setAttribute('aria-label',
        'Delete the run ' + (tr.cells[0] ? tr.cells[0].textContent : ''));
      x.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = this.getAttribute('data-mid');
        var me = KS.missionEdit;
        if (!me || typeof me.deleteFlow !== 'function') {
          /* js/ksat-mission-edit.js owns the flow. If it did not load,
             say so rather than offering a button that does nothing. */
          var m = doc.getElementById(MSG);
          if (m) {
            m.className = 'said bad';
            m.textContent = 'The delete control is unavailable on this page.';
          }
          return;
        }
        me.deleteFlow(id, {
          /* The confirmation lands directly under this table, where the
             row being deleted is still on screen above it. */
          host: table,
          msgId: MSG
        });
      });
      td.appendChild(x);
      tr.appendChild(td);
    }
  }

  function sweep() {
    var table = doc.getElementById(TABLE);
    if (!table) { return; }
    var card = table.closest ? table.closest('.card') : null;
    if (card) { mountToggle(card, table); }
    mountRowControls(table);
  }

  function start() {
    var table = doc.getElementById(TABLE);
    if (!table) { return false; }
    sweep();
    new w.MutationObserver(function () { sweep(); })
      .observe(table, { childList: true });
    KS.runsPanel = { sweep: sweep };
    return true;
  }

  function boot() {
    if (start()) { return; }
    var tries = 0;
    var iv = setInterval(function () {
      if (start() || ++tries > 60) { clearInterval(iv); }
    }, 120);
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}(window, document));
