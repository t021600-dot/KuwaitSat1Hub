/* =====================================================================
   ksat-report-fold.js - the whole report, shrunk to a line
   Owner: 01 Front End

   A finished report is ten sections, two maps and a provenance register.
   It lands directly under the run it came from, so a researcher who
   wants to look at the checkpoint again, or at what the agents did, has
   a page of document to scroll past first.

   This puts one control under the heading: an arrow that shrinks the
   report to nothing and brings it back.

   OPEN BY DEFAULT, ALWAYS. The report has just been written and it is
   the thing the run was for; a reader who has to press something to see
   what they waited for has been given a worse page, not a tidier one.
   The control is for afterwards.

   NOT THE SAME THING AS js/ksat-report-brief.js. That file folds the
   sections INSIDE a report, so a reader can skim ten headings and open
   the two they want. This folds the report itself. They compose: a
   collapsed report keeps whichever of its own sections were open, and
   opening it again shows them exactly as they were left.

   WHY A MUTATION OBSERVER. The report host is empty in the markup and
   js/ksat-report.js fills it when the Reporting Agent finishes, which
   may be a minute after this file has run and may happen more than once
   in a session. Watching the host for content is the only way to
   attach at the right moment without a hook in the renderer.

   PRINT TAKES EVERYTHING. A collapsed report would print as a heading
   and nothing else, and the printed report is what somebody hands to a
   supervisor. The same rule css/ksat-report-brief.css already applies
   to its own folds.
   ===================================================================== */
(function (w, doc) {
  'use strict';

  var KS = w.KSAT = w.KSAT || {};
  if (KS.reportFold) { return; }

  /* Both report hosts. The detail panel carries a second copy of the
     same document, and a reader there has the same reason to want it
     out of the way. */
  var HOSTS = ['rrReport', 'mdReport'];

  var MARK = 'ksatRf';
  var CLS = 'ksat-rf-toggle';

  function el(tag, cls, txt) {
    var n = doc.createElement(tag);
    if (cls) { n.className = cls; }
    if (txt != null) { n.textContent = txt; }
    return n;
  }

  function attach(id) {
    var host = doc.getElementById(id);
    if (!host || host.dataset[MARK]) { return; }

    /* NOT UNTIL THERE IS SOMETHING TO FOLD. An arrow above an empty
       host is a control that appears to do nothing, and this host is
       empty for as long as the run takes. */
    if (!host.firstChild) { return; }
    host.dataset[MARK] = '1';

    /* ONE CONTROL, HOWEVER MANY TIMES THE REPORT IS RE-RENDERED.

       The button is a SIBLING of the host, so clearing the host does
       not remove it, and a second run would otherwise stack a second
       arrow on top of the first. Found by reading the re-render path,
       not on screen - the second run is the one nobody rehearses. */
    var stale = host.previousElementSibling;
    if (stale && stale.classList.contains(CLS)) {
      stale.parentNode.removeChild(stale);
    }

    var btn = el('button', CLS);
    btn.type = 'button';
    btn.setAttribute('aria-expanded', 'true');
    btn.setAttribute('aria-controls', id);

    var caret = el('span', 'ksat-rf-caret', '›');
    caret.setAttribute('aria-hidden', 'true');
    var word = el('span', 'ksat-rf-word', 'Hide the report');
    btn.appendChild(caret);
    btn.appendChild(word);

    function paint(open) {
      host.hidden = !open;
      btn.classList.toggle('is-open', !!open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      word.textContent = open ? 'Hide the report' : 'Show the report';
    }

    btn.addEventListener('click', function () { paint(host.hidden); });

    /* Directly above the report and below the heading row, which is
       where the request put it: "an arrow under the report". */
    host.parentNode.insertBefore(btn, host);
    paint(true);

    /* Printing re-opens it and leaves it open. Restoring the collapsed
       state afterwards would be tidier and is not worth the risk: an
       afterprint that does not fire, in a browser that cancels the
       dialog, leaves the reader looking at a report they cannot see
       with no memory of having hidden it. */
    if (w.matchMedia) {
      try {
        w.matchMedia('print').addEventListener('change', function (e) {
          if (e.matches) { paint(true); }
        });
      } catch (e) { /* older browsers: the beforeprint below covers it */ }
    }
    w.addEventListener('beforeprint', function () { paint(true); });
  }

  function sweep() { HOSTS.forEach(attach); }

  function start() {
    sweep();
    HOSTS.forEach(function (id) {
      var host = doc.getElementById(id);
      if (!host) { return; }
      new w.MutationObserver(function () {
        /* A re-render clears the host and fills it again, which drops
           our mark with the old children only if the host itself is
           replaced - it is not, so the mark survives and attach()
           returns early. Clearing it when the host empties is what
           makes a second run get its control back. */
        if (!host.firstChild) { delete host.dataset[MARK]; }
        sweep();
      }).observe(host, { childList: true });
    });
    KS.reportFold = { sweep: sweep };
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
}(window, document));
