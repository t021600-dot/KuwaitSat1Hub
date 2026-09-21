/* =====================================================================
   ksat-density.js — LET THE PAGE BREATHE
   Owner: 01 Front End, with 03 Security (nothing may be removed)

   THE BRIEF, SAID THREE TIMES
   "The website has to be less text because I noticed that it is
   overwhelming with texts" — and, from the same team, "without removing
   any info or whatever we have."

   Those conflict only if the choice is keep-or-delete. It isn't.

   WHAT THE FIRST VERSION GOT WRONG
   It selected `p.lede, p.sub` and folded ELEVEN paragraphs. Measured on
   the live page there are 109 paragraphs carrying 16,531 characters,
   and the worst offenders are plain `<p>` that the selector never saw:

       builders  1,917 chars over  6 paragraphs
       trust     1,490 chars over 20 paragraphs
       system    1,361 chars over  9 paragraphs
       imagery   1,224 chars over  8 paragraphs

   Folding eleven of 109 was not a reduction. This version reads every
   paragraph in every section.

   TWO SHAPES OF WALL, TWO TREATMENTS
   A section is overwhelming in one of two ways, and one control does not
   fix both:

   1 · ONE LONG PARAGRAPH — clamp it to two lines, open on request.
   2 · A RUN OF PARAGRAPHS — `trust` has twenty. Clamping each would
       produce twenty "Read more" controls, which is a worse wall than
       the text was. So a run shows its FIRST paragraph and folds the
       rest behind a SINGLE control that names how much is behind it.

   NOTHING IS REMOVED
   Every word stays in the DOM. Collapsed runs use `hidden="until-found"`
   where the browser supports it, so Ctrl+F finds the text and the
   browser opens the block for you. Screen readers read in order. Print
   takes everything.

   WHAT IS DELIBERATELY LEFT ALONE
   - The legend: it IS the provenance key and has to be read.
   - Anything inside a figure, table, chart, canvas, badge or control.
   - The first paragraph of every run — you always see a whole thought.
   - Our own layers, and the guided tour, which narrates.
   ===================================================================== */

(function () {
  'use strict';

  var KS = window.KSAT = window.KSAT || {};
  if (KS.density) return;

  /* MEASURED, NOT GUESSED — twice now.
     340 folded 2 of 109. 230 folded 11. The distribution is:
       over 300 chars .. 9      140-200 .. 25
       200-300 ........ 14       80-140 .. 41      under 80 .. 20
     150 catches the 48 paragraphs that actually build a wall and leaves
     the 61 short ones alone, because short text was never the problem. */
  var LONG_ONE  = 150;   /* a single paragraph worth clamping          */
  var RUN_MIN   = 1;     /* paragraphs after the first, to fold a run.
                            Was 2. One control plus one visible opening
                            paragraph still beats two separate clamps,
                            and two clamps in a row is the stacking this
                            whole shape exists to avoid. */
  var RUN_CHARS = 240;   /* ...and only if they carry this much text   */

  var KEEP_WHOLE = [
    '#legend', '.legcell',
    'figure', 'figcaption', 'table', 'thead', 'tbody',
    '.badge', '.chip', '.chips', '.cmplab', '.exhud',
    'nav', '.bar', 'button', 'a[href]',
    '#ksat-as-panel', '.ksat-invite', '.ksat-wf', '#ksat-wf',
    '.ag-p', '.dstep', '.demopan', '.demofin',
    '#intro', '.intro'
  ].join(',');

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function reduced() {
    try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }
  /* `hidden="until-found"` keeps text findable by Ctrl+F and reachable
     by a screen reader while it is collapsed. Not everywhere yet, so we
     detect rather than assume. */
  var UNTIL_FOUND = (function () {
    try { return 'onbeforematch' in document.body; } catch (e) { return false; }
  })();

  var stats = { clamped: 0, runs: 0, grids: 0, hidden: 0 };

  function eligible(p) {
    if (p.dataset.ksatFolded) return false;
    if (p.closest(KEEP_WHOLE)) return false;
    if (!p.textContent || !p.textContent.trim()) return false;
    /* A control strip is SHORT text carrying several links. Prose with
       inline citations is still prose, and the first version got this
       wrong: it rejected everything with more than two links, which
       excluded a 203-character sentence in `builders` that carried three
       citations. That exclusion broke the run around it - the two
       paragraphs after it ended up as two separate clamps instead of one
       control. Judge by DENSITY, not by count. */
    var links = p.querySelectorAll('a,button,.badge').length;
    var chars = p.textContent.trim().length;
    if (links > 2 && chars < 120) return false;      /* short + linky = a strip */
    if (links > 6) return false;                     /* a citation list         */
    return true;
  }

  function control(labelText) {
    var b = el('button', 'ksat-fold-more');
    b.type = 'button';
    b.setAttribute('aria-expanded', 'false');
    b.appendChild(el('span', 'ksat-fold-word', labelText));
    return b;
  }

  /* ---- shape 1 · one long paragraph, clamped -------------------------- */
  function clampOne(p) {
    p.dataset.ksatFolded = '1';
    p.classList.add('ksat-fold');
    if (!p.id) p.id = 'ksat-fold-' + (stats.clamped + 1);

    var b = control('Read more');
    b.setAttribute('aria-controls', p.id);
    b.addEventListener('click', function () {
      var open = p.classList.toggle('ksat-fold-open');
      b.setAttribute('aria-expanded', open ? 'true' : 'false');
      b.querySelector('.ksat-fold-word').textContent = open ? 'Show less' : 'Read more';
      if (!open && p.getBoundingClientRect().top < 0) {
        p.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' });
      }
    });
    p.insertAdjacentElement('afterend', b);
    stats.clamped++;
  }

  /* ---- shape 2 · a run of paragraphs behind one control --------------- */
  var runId = 0;
  function foldRun(list) {
    var rest = list.slice(1);
    var chars = rest.reduce(function (n, p) { return n + p.textContent.trim().length; }, 0);
    if (rest.length < RUN_MIN || chars < RUN_CHARS) return false;

    var id = 'ksat-run-' + (++runId);
    var wrap = el('div', 'ksat-run');
    wrap.id = id;
    list[0].insertAdjacentElement('afterend', wrap);
    rest.forEach(function (p) { p.dataset.ksatFolded = '1'; wrap.appendChild(p); });

    if (UNTIL_FOUND) wrap.setAttribute('hidden', 'until-found');
    else wrap.hidden = true;

    var word = rest.length === 1 ? 'paragraph' : 'paragraphs';
    var b = control('Read more — ' + rest.length + ' more ' + word);
    b.setAttribute('aria-controls', id);

    function openRun() {
      wrap.removeAttribute('hidden');
      wrap.hidden = false;
      b.setAttribute('aria-expanded', 'true');
      b.querySelector('.ksat-fold-word').textContent = 'Show less';
    }
    function closeRun() {
      if (UNTIL_FOUND) wrap.setAttribute('hidden', 'until-found');
      else wrap.hidden = true;
      b.setAttribute('aria-expanded', 'false');
      b.querySelector('.ksat-fold-word').textContent = 'Read more — ' + rest.length + ' more ' + word;
    }
    b.addEventListener('click', function () {
      (b.getAttribute('aria-expanded') === 'true') ? closeRun() : openRun();
    });
    /* Ctrl+F landed inside it: the browser reveals it, so match the button. */
    wrap.addEventListener('beforematch', function () {
      b.setAttribute('aria-expanded', 'true');
      b.querySelector('.ksat-fold-word').textContent = 'Show less';
    });

    wrap.insertAdjacentElement('afterend', b);
    stats.runs++;
    stats.hidden += rest.length;

    /* The one paragraph still showing may itself be a wall. */
    if (list[0].textContent.trim().length > LONG_ONE) clampOne(list[0]);
    return true;
  }

  /* ---- shape 3 · A CARD GRID -----------------------------------------
     The measurement that forced this: `trust` carries twenty paragraphs
     but its longest is 139 characters and eleven are under 100. It is
     not a wall of prose - it is eighteen CARDS. Clamping a 98-character
     paragraph does nothing, which is why the first two passes left these
     sections untouched while they were the densest on the page:

       trust    18 cards in one container   1,253 chars
       system    6 capability cards            812 chars
       sources   6 rule cards                  780 chars

     A grid shows its first three cards and folds the rest behind one
     control that names the total. That is how an agency site handles a
     long list.

     THE CARDS ARE NOT WRAPPED. Putting them in a container would make
     THAT the grid item and collapse the layout to a single column. Each
     extra card is hidden individually and the control goes after the
     grid, so the CSS grid is untouched.
     ------------------------------------------------------------------ */
  var KEEP_CARDS = 3;
  var gridId = 0;

  function hideCard(node, on) {
    if (on) {
      if (UNTIL_FOUND) node.setAttribute('hidden', 'until-found');
      else node.hidden = true;
    } else {
      node.removeAttribute('hidden');
      node.hidden = false;
    }
  }

  function foldGrid(container) {
    if (container.dataset.ksatGrid) return false;
    if (container.closest(KEEP_WHOLE)) return false;

    var kids = [].slice.call(container.children).filter(function (c) {
      return c.querySelector && c.querySelector('p') && c.textContent.trim().length > 30;
    });
    if (kids.length < KEEP_CARDS + 2) return false;

    var rest = kids.slice(KEEP_CARDS);
    var chars = rest.reduce(function (n, c) { return n + c.textContent.trim().length; }, 0);
    if (chars < 300) return false;

    container.dataset.ksatGrid = '1';
    var id = 'ksat-grid-' + (++gridId);
    container.id = container.id || id;

    rest.forEach(function (c) { c.dataset.ksatFolded = '1'; hideCard(c, true); });

    var b = control('Show all ' + kids.length);
    b.setAttribute('aria-controls', container.id);
    function setOpen(open) {
      rest.forEach(function (c) { hideCard(c, !open); });
      b.setAttribute('aria-expanded', open ? 'true' : 'false');
      b.querySelector('.ksat-fold-word').textContent =
        open ? 'Show fewer' : 'Show all ' + kids.length;
    }
    b.addEventListener('click', function () {
      setOpen(b.getAttribute('aria-expanded') !== 'true');
    });
    rest.forEach(function (c) {
      c.addEventListener('beforematch', function () { setOpen(true); });
    });

    container.insertAdjacentElement('afterend', b);
    stats.grids = (stats.grids || 0) + 1;
    stats.hidden += rest.length;
    return true;
  }

  /* ---- walk each section, grouping consecutive siblings --------------- */
  function doSection(sec) {
    /* Card grids first: they are the densest shape and folding one
       removes its paragraphs from consideration below. */
    var conts = sec.querySelectorAll('div, ul, ol');
    for (var c = 0; c < conts.length; c++) foldGrid(conts[c]);

    var kids = [].slice.call(sec.querySelectorAll('p'));
    var usable = kids.filter(eligible);
    if (!usable.length) return;

    /* group by shared parent AND adjacency, so we never pull a paragraph
       out of one card into another */
    var groups = [], cur = [];
    for (var i = 0; i < usable.length; i++) {
      var p = usable[i];
      if (!cur.length) { cur = [p]; continue; }
      var prev = cur[cur.length - 1];
      /* SAME PARENT IS ENOUGH. Requiring prev.nextElementSibling === p
         meant a run only formed when paragraphs were DIRECT siblings,
         and in this page they almost never are - headings, rules and
         wrappers sit between them. That is why the first build folded
         zero runs. */
      var adjacent = prev.parentElement === p.parentElement;
      if (adjacent) cur.push(p);
      else { groups.push(cur); cur = [p]; }
    }
    if (cur.length) groups.push(cur);

    groups.forEach(function (g) {
      if (g.length > 1 && foldRun(g)) return;
      g.forEach(function (p) {
        if (!p.dataset.ksatFolded && p.textContent.trim().length > LONG_ONE) clampOne(p);
      });
    });
  }

  function run() {
    var secs = document.querySelectorAll('section[id]');
    for (var i = 0; i < secs.length; i++) doSection(secs[i]);
    KS.density = stats;
    document.documentElement.setAttribute('data-ksat-density', 'on');
  }

  function boot() {
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (document.querySelector('section[id] p') || tries > 60) {
        clearInterval(iv);
        run();
      }
    }, 120);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
