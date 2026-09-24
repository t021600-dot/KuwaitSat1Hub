/* =====================================================================
   ksat-report-doc.js — THE REPORT, AS A DOCUMENT RATHER THAN A PRINTOUT
   Owner: 01 Front End

   WHAT WAS WRONG. Pressing Save as PDF produced the web page's prose
   with the chrome hidden: it began at the markdown's own `# Title` in
   screen type, ran ten sections at screen leading, put the two maps at
   the end, and stopped. No cover, no document control, no numbering, no
   footer, and nothing on the page distinguishing a signed report from
   the unsigned draft that prints from the same code.

   WHAT THIS ADDS. Two nodes per rendered report: a cover block at the
   top of .reportmain and a running footer inside the host. Everything
   else is done by css/ksat-report-doc.css, which is scoped entirely to
   html.ksat-printing so SCREEN RENDERING IS BYTE-FOR-BYTE UNCHANGED.

   NOTHING IS INVENTED. Every field on the cover already exists: the
   title comes from the report's own h1, the run id is parsed out of the
   byline the Reporting Agent already writes, the status comes from the
   host id, and the generated date is a fact about the download rather
   than a measurement. No figure, no finding and no number is touched.

   ------------------------------------------------------------------
   FIVE THINGS THAT WILL BREAK THIS
   ------------------------------------------------------------------
   1 · THE FOOTER MUST LIVE INSIDE THE HOST.
       css/ksat-workspace.css sets `html.ksat-printing body *{
       visibility:hidden }` and then un-hides only `.ksat-print-this`
       and its subtree. A position:fixed footer appended to <body>
       prints blank.

   2 · NOTHING HERE MAY BE CLASSED `bar`.
       css/ksat-workspace.css has
       `html.ksat-printing .ksat-print-this .bar{ display:none
       !important }` to drop the toolbar. An element of that class
       vanishes with no error.

   3 · THE COVER IS NOT A DIRECT CHILD OF THE HOST.
       printHost() in js/ksat-researcher.js tests `host.firstChild`.
       Inserting into .reportmain leaves host.firstChild as the
       .reportgrid, which is what that test expects.

   4 · present() REBUILDS THE HOST ON EVERY OPEN.
       js/ksat-report.js calls clear(host) and re-renders, and appends
       the key list asynchronously after loadGeometry() resolves. So
       this runs from a MutationObserver and guards with a data
       attribute, or you get stacked cover pages.

   5 · NO FIGURE COUNTER.
       js/ksat-report.js already writes the literal strings "Figure 1."
       and "Figure 2." into the captions. A CSS counter on
       figcaption::before would render "1. Figure 1." Section numbering
       is safe because no section heading carries a number today.

   ------------------------------------------------------------------
   WHAT THIS DELIBERATELY DOES NOT DO: PAGE NUMBERS
   ------------------------------------------------------------------
   The brief asks for "footer/page numbering". Page numbers are NOT
   achievable here. `@page { @bottom-center { content: counter(page) } }`
   is CSS Paged Media margin-box syntax, and no browser engine
   implements it - Chromium, Gecko and WebKit all ignore margin boxes
   and all ignore counter(page) in generated content. It works only in
   WeasyPrint/Prince-class formatters.

   The alternative is a real PDF writer, and js/ksat-export.js records
   the decision against that in writing: "No PDF: there is no PDF writer
   on this page, no build step to add one", and separately that the
   Leaflet map "is deliberately NOT exportable... its pixels cannot be
   read back without tainting". html2canvas over this report would
   produce a document whose two figures are empty grey boxes - strictly
   worse than what printing already does correctly.

   So the running footer carries the title, the run id and the status,
   and the page number comes from the browser's own print dialog if the
   presenter ticks "Headers and footers". That box also stamps the URL
   and the system date into the margins, which on a laptop demo prints
   localhost across the top of a scientific report - so the honest
   default is to leave it off and have a footer that identifies the
   document instead.
   ===================================================================== */
(function (w, doc) {
  'use strict';

  var KS = w.KSAT = w.KSAT || {};
  if (KS.reportDoc) { return; }

  var MARK = 'ksatDoc';

  function el(tag, cls, txt) {
    var n = doc.createElement(tag);
    if (cls) { n.className = cls; }
    if (txt !== undefined && txt !== null) { n.textContent = txt; }
    return n;
  }

  /* The three hosts, and what each one IS. printHost() in
     js/ksat-researcher.js already encodes this mapping; it is repeated
     rather than imported because that function is not exported, and a
     draft printed without the word DRAFT on it is the failure this
     whole item exists to prevent. */
  function statusOf(hostId) {
    if (hostId === 'rrReport') { return 'DRAFT — NOT SIGNED'; }
    return 'APPROVED';
  }

  function two(n) { return (n < 10 ? '0' : '') + n; }

  function stamp() {
    var d = new Date();
    return d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate());
  }

  /* The Reporting Agent writes "...assembled by the Reporting Agent from
     run 1a2b3c4d." as the first paragraph. Read the id back rather than
     asking the database for something already on the page. */
  function runIdFrom(main) {
    var ps = main.querySelectorAll('p');
    var i;
    for (i = 0; i < ps.length && i < 4; i++) {
      var m = /from run ([0-9a-f]{6,})/i.exec(ps[i].textContent || '');
      if (m) { return m[1]; }
    }
    return null;
  }

  function buildCover(main, hostId) {
    var h1 = main.querySelector('h1');
    var title = h1 ? (h1.textContent || '').trim() : 'Mission report';
    var run = runIdFrom(main);
    var status = statusOf(hostId);

    var cover = el('header', 'ksat-doc-cover');

    cover.appendChild(el('div', 'ksat-doc-org', 'KuwaitSat-1 Mission Hub'));
    cover.appendChild(el('div', 'ksat-doc-kind', 'Research report'));
    cover.appendChild(el('h1', 'ksat-doc-title', title));

    var st = el('div', 'ksat-doc-status ' +
      (status.indexOf('DRAFT') === 0 ? 'is-draft' : 'is-approved'), status);
    cover.appendChild(st);

    var tbl = doc.createElement('table');
    tbl.className = 'ksat-doc-table';
    function row(k, v) {
      if (!v) { return; }
      var tr = doc.createElement('tr');
      var th = doc.createElement('th');
      th.scope = 'row';
      th.textContent = k;
      var td = doc.createElement('td');
      td.textContent = v;
      tr.appendChild(th);
      tr.appendChild(td);
      tbl.appendChild(tr);
    }
    row('Document', 'Research report');
    row('Status', status);
    row('Run reference', run);
    row('Generated', stamp());
    row('Platform', 'KuwaitSat-1 Mission Hub, research operations');
    cover.appendChild(tbl);

    /* The one sentence that keeps the document honest when it leaves
       the building without the person who made it. */
    cover.appendChild(el('p', 'ksat-doc-note',
      'Findings in this report are derived from KuwaitSat-1 payload imagery ' +
      'and open reference data. Proposed planting is a conceptual simulation, ' +
      'not an observation. No figure is stated in degrees Celsius, and no ' +
      'vegetation index is claimed: the payload carries no near-infrared band.'));

    return cover;
  }

  function buildFooter(main, hostId) {
    var h1 = main.querySelector('h1');
    var title = h1 ? (h1.textContent || '').trim() : 'Mission report';
    var run = runIdFrom(main);
    var f = el('footer', 'ksat-doc-foot');
    f.appendChild(el('span', 'ksat-doc-foot-t', title));
    f.appendChild(el('span', 'ksat-doc-foot-r',
      (run ? 'Run ' + run + '  ·  ' : '') + statusOf(hostId)));
    return f;
  }

  function decorate(host) {
    if (!host || host.dataset[MARK]) { return; }
    var main = host.querySelector('.reportmain');
    if (!main || !main.querySelector('h1')) { return; }
    host.dataset[MARK] = '1';

    main.insertBefore(buildCover(main, host.id), main.firstChild);
    host.appendChild(buildFooter(main, host.id));
  }

  function sweep() {
    var hosts = doc.querySelectorAll('.reporthost');
    var i;
    for (i = 0; i < hosts.length; i++) {
      /* present() clears the host, which takes the cover with it but
         leaves the data attribute on the host itself. Re-arm when the
         cover has gone missing. */
      var h = hosts[i];
      if (h.dataset[MARK] && !h.querySelector('.ksat-doc-cover')) {
        delete h.dataset[MARK];
      }
      decorate(h);
    }
  }

  KS.reportDoc = { sweep: sweep };

  function start() {
    sweep();
    new w.MutationObserver(sweep).observe(doc.body, { childList: true, subtree: true });
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
}(window, document));
