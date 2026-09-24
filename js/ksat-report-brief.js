/* =====================================================================
   ksat-report-brief.js — THE REPORT, LESS OF IT AT ONCE
   Owner: 01 Front End

   THE ASK. When the report lands it should be less text, with bold
   titles, and it should look composed rather than dumped.

   WHAT THIS DOES. Three things, all presentational:

     1 · The opening paragraph of the Executive summary is lifted into a
         LEAD - larger, lighter, set to a proper measure. It is the one
         paragraph most readers will read, so it stops being the same
         size as everything under it.

     2 · Every section keeps its first paragraph on screen and folds the
         rest behind "Read the full section". A ten-section report that
         opens at ten paragraphs instead of forty is the "less text"
         part, and nothing is deleted to achieve it.

     3 · Section titles are numbered and set large and bold, in CSS.

   WHAT IT DOES NOT DO, AND WHY THAT MATTERS HERE.

   It does not edit, summarise, shorten or rewrite one word the
   Reporting Agent produced. This is a lid, exactly like the agent
   trace: everything is still on the page, one click away, in the order
   and the wording the agent wrote it. A report is the artefact this
   platform exists to produce and the thing a researcher would put in
   front of a supervisor - quietly dropping sentences out of it to make
   it look tidier would be the worst kind of help.

   It also does nothing at all when printing. css/ksat-report-doc.css
   builds the document version, and a folded section would print as a
   missing section. Everything is re-opened before print and the folds
   are suppressed in the print stylesheet.
   ===================================================================== */
(function (w, doc) {
  'use strict';

  var KS = w.KSAT = w.KSAT || {};
  if (KS.reportBrief) { return; }

  var MARK = 'ksatBrief';

  function el(tag, cls, txt) {
    var n = doc.createElement(tag);
    if (cls) { n.className = cls; }
    if (txt !== undefined && txt !== null) { n.textContent = txt; }
    return n;
  }

  /* Everything between this heading and the next one at the same level. */
  function sectionBody(h2) {
    var out = [], n = h2.nextSibling;
    while (n) {
      if (n.nodeType === 1 && /^H[12]$/.test(n.tagName)) { break; }
      out.push(n);
      n = n.nextSibling;
    }
    return out;
  }

  function isBlock(n) {
    return n.nodeType === 1 && /^(P|UL|OL|TABLE|BLOCKQUOTE|PRE)$/.test(n.tagName);
  }

  function brief(main) {
    /* ---- 1 · the lead ---- */
    var firstH2 = main.querySelector('h2');
    if (firstH2) {
      var body = sectionBody(firstH2);
      var firstPara = null, i;
      for (i = 0; i < body.length; i++) {
        if (body[i].nodeType === 1 && body[i].tagName === 'P') { firstPara = body[i]; break; }
      }
      if (firstPara) { firstPara.classList.add('ksat-rb-lead'); }
    }

    /* ---- 2 · fold each section past its first block ---- */
    var heads = main.querySelectorAll('h2');
    Array.prototype.forEach.call(heads, function (h2) {
      var body = sectionBody(h2);
      var blocks = body.filter(isBlock);
      /* Two blocks or fewer is already short. Folding it would add a
         control and remove nothing worth removing. */
      if (blocks.length < 3) { return; }

      var keep = blocks[0];
      var rest = [], started = false, k;
      for (k = 0; k < body.length; k++) {
        if (body[k] === keep) { started = true; continue; }
        if (started) { rest.push(body[k]); }
      }
      if (!rest.length) { return; }

      var wrap = el('div', 'ksat-rb-rest');
      wrap.hidden = true;
      var parent = h2.parentNode;
      parent.insertBefore(wrap, rest[0]);
      rest.forEach(function (n) { wrap.appendChild(n); });

      var btn = el('button', 'ksat-rb-more');
      btn.type = 'button';
      btn.setAttribute('aria-expanded', 'false');
      var caret = el('span', 'ksat-rb-caret', '›');
      var word = el('span', null, 'Read the full section');
      btn.appendChild(caret);
      btn.appendChild(word);

      function paint(open) {
        wrap.hidden = !open;
        btn.classList.toggle('is-open', !!open);
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        word.textContent = open ? 'Show less' : 'Read the full section';
      }
      btn.addEventListener('click', function () { paint(wrap.hidden); });
      parent.insertBefore(btn, wrap);
      paint(false);
    });
  }

  /* PRINT MUST GET EVERYTHING.

     A folded section would print as a missing section, and the printed
     report is the artefact somebody hands to a supervisor. Both print
     buttons stamp html.ksat-printing, so opening every fold the moment
     that class appears is enough, and it costs nothing on screen. */
  function openAll() {
    var wraps = doc.querySelectorAll('.ksat-rb-rest');
    Array.prototype.forEach.call(wraps, function (n) { n.hidden = false; });
    var btns = doc.querySelectorAll('.ksat-rb-more');
    Array.prototype.forEach.call(btns, function (b) {
      b.classList.add('is-open');
      b.setAttribute('aria-expanded', 'true');
    });
  }

  function sweep() {
    var mains = doc.querySelectorAll('.reporthost .reportmain');
    Array.prototype.forEach.call(mains, function (m) {
      if (m.dataset[MARK]) {
        if (!m.querySelector('.ksat-rb-lead')) { delete m.dataset[MARK]; }
        else { return; }
      }
      if (!m.querySelector('h2')) { return; }
      m.dataset[MARK] = '1';
      brief(m);
    });
  }

  KS.reportBrief = { sweep: sweep, openAll: openAll };

  function start() {
    sweep();
    new w.MutationObserver(sweep).observe(doc.body, { childList: true, subtree: true });

    /* html.ksat-printing goes on just before window.print(). */
    new w.MutationObserver(function () {
      if (doc.documentElement.classList.contains('ksat-printing')) { openAll(); }
    }).observe(doc.documentElement, { attributes: true, attributeFilter: ['class'] });

    /* Belt and braces for Ctrl+P, which never touches that class. */
    if (w.matchMedia) {
      try {
        var mq = w.matchMedia('print');
        if (mq.addEventListener) { mq.addEventListener('change', function (e) { if (e.matches) { openAll(); } }); }
      } catch (e) {}
    }
    w.addEventListener('beforeprint', openAll);
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
}(window, document));
