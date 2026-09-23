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

   THE TWO TREATMENTS COLLIDED            fixed 21 September 2026
   Seen in the browser, in `#imagery`, reading as one run-on line:

       READ MORE ⌄READ MORE — 1 MORE PARAGRAPH ⌄

   That is the exact stacking the note above says this file exists to
   prevent, and the file was building it itself. `foldRun()` folded the
   run, and then its last act was `if (list[0] is long) clampOne(list[0])`
   — so the opening paragraph got a SECOND control of its own. The two
   buttons ended up separated only by the run wrapper, and index.html's
   own reset (`[hidden]{display:none!important}`) takes that wrapper out
   of the flow entirely, so nothing broke the line between them. Measured
   here: the `#imagery` lede is 190 characters (over LONG_ONE) and the one
   paragraph behind it is 241 (over RUN_CHARS), so BOTH tests passed on
   the same run. Nothing about it was random; it fired every load.

   WHY A MERGE AND NOT A SUPPRESSION
   Dropping one treatment was the cheaper fix and it is the wrong one.
   Drop the fold and the run comes back. Drop the clamp — which is what
   the note in ksat-theme.css assumed happened — and the visible opening
   paragraph stays a 190-character wall in exactly the sections that are
   worst, which is the brief inverted. Both reductions are wanted; what
   was wrong was asking for them TWICE.

   So a clamped lead plus a folded run is now ONE control that names
   everything behind it — "Read more — this paragraph and 1 more" — and
   opening it opens both. Nothing is hidden that was not hidden before,
   nothing gained a second affordance, and every word is still in the DOM.

   AND THE OTHER ROAD TO THE SAME PILE-UP
   A group can also stack when `foldRun` DECLINES: two paragraphs of
   170 characters each clear LONG_ONE individually but their tail is
   under RUN_CHARS, so the run was refused and each got its own clamp —
   two controls in a row again, by the other door. A group that would
   produce two or more clamps now folds as a run regardless of
   RUN_CHARS: one control always beats two.

   LABELS ARE OURS, IN BOTH LANGUAGES     added 21 September 2026
   These controls are built by script, carry no data-i18n, and the page
   dictionary never sees them. js/ksat-i18n.js does sweep
   `.ksat-fold-word` afterwards, but it can only guess from the English:
   it tests the label for "more" and anything without that word becomes
   "عرض أقل". Measured on the live page, that turned every grid control
   — "Show all 18" — into an Arabic label reading SHOW FEWER, the
   opposite of what the button does, and it threw the counts away as
   well. So every label here exists in English and Arabic, and repaints
   itself on the `ksat:lang` event, which i18n dispatches AFTER its own
   sweep — ours is the last word in both directions.
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
    '#intro', '.intro',
    /* '.kss' was here, exempting the spacecraft block from folding.
       js/ksat-spacecraft.js is deleted and nothing emits that class any
       more, so the clause could never match. A never-matching selector
       in a keep-whole list is not a bug, it is an instruction to the
       next reader that is no longer true. */
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

  var stats = { clamped: 0, runs: 0, grids: 0, hidden: 0, merged: 0 };

  /* ---- LABELS · ENGLISH AND ARABIC ------------------------------------
     Arabic counts are not "n + word". One is the noun alone, two is the
     dual, three to ten takes the plural, eleven and up goes back to the
     singular. Getting that wrong is the kind of thing a reader notices
     immediately and a reviewer never does, so it is written out once
     here and every label goes through it.
     ------------------------------------------------------------------ */
  function arCount(n, one, two, few, many) {
    if (n === 1) return one;
    if (n === 2) return two;
    if (n <= 10) return n + ' ' + few;
    return n + ' ' + many;
  }
  function paras(n, code) {
    if (code === 'ar') {
      return arCount(n, 'فقرة واحدة أخرى', 'فقرتان أخريان', 'فقرات أخرى', 'فقرة أخرى');
    }
    return n + (n === 1 ? ' more paragraph' : ' more paragraphs');
  }
  function cards(n, code) {
    if (code === 'ar') return arCount(n, 'بطاقة واحدة', 'بطاقتان', 'بطاقات', 'بطاقة');
    return String(n);
  }

  var T = {
    more:  { en: 'Read more',  ar: 'اقرأ المزيد' },
    less:  { en: 'Show less',  ar: 'عرض أقل' },
    fewer: { en: 'Show fewer', ar: 'عرض أقل' },
    /* a run: the lead paragraph is whole, only the tail is behind this */
    run: function (n, code) {
      return code === 'ar' ? 'اقرأ المزيد, ' + paras(n, 'ar')
                           : 'Read more, ' + paras(n, 'en');
    },
    /* MERGED: the lead is clamped AND a run is folded, one control for
       both, so the label has to name both halves or the reader cannot
       tell what they are opening. */
    merged: function (n, code) {
      return code === 'ar' ? 'اقرأ المزيد, هذه الفقرة و' + paras(n, 'ar')
                           : 'Read more, this paragraph and ' + n + ' more';
    },
    grid: function (n, code) {
      return code === 'ar' ? 'عرض الكل, ' + cards(n, 'ar') : 'Show all ' + n;
    }
  };

  /* i18n sets both; `lang` alone would miss the moment before it runs. */
  function lang() {
    var r = document.documentElement;
    var code = r.getAttribute('data-ksat-lang') || r.lang || 'en';
    return String(code).toLowerCase().indexOf('ar') === 0 ? 'ar' : 'en';
  }

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

  /* Every control is registered, and every control knows how to write
     its own label from its own state — open or closed, English or
     Arabic. A control that was told its text once could not survive a
     language switch, and that is how the counts used to disappear. */
  var controls = [];
  function control(render) {
    var b = el('button', 'ksat-fold-more');
    b.type = 'button';
    b.setAttribute('aria-expanded', 'false');
    b.appendChild(el('span', 'ksat-fold-word', ''));
    var c = {
      btn: b,
      isOpen: function () { return b.getAttribute('aria-expanded') === 'true'; },
      paint: function () {
        b.querySelector('.ksat-fold-word').textContent = render(c.isOpen(), lang());
      },
      set: function (open) {
        b.setAttribute('aria-expanded', open ? 'true' : 'false');
        c.paint();
      }
    };
    controls.push(c);
    c.paint();
    return c;
  }
  /* i18n dispatches this AFTER its own `.ksat-fold-word` sweep, so this
     repaint is what the reader is left looking at. */
  document.addEventListener('ksat:lang', function () {
    for (var i = 0; i < controls.length; i++) controls[i].paint();
  });

  /* ---- shape 1 · one long paragraph, clamped -------------------------- */
  var foldId = 0;
  function clampOne(p) {
    p.dataset.ksatFolded = '1';
    p.classList.add('ksat-fold');
    if (!p.id) p.id = 'ksat-fold-' + (++foldId);

    var c = control(function (open, code) {
      return open ? T.less[code] : T.more[code];
    });
    c.btn.setAttribute('aria-controls', p.id);
    c.btn.addEventListener('click', function () {
      var open = p.classList.toggle('ksat-fold-open');
      c.set(open);
      if (!open && p.getBoundingClientRect().top < 0) {
        p.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' });
      }
    });
    p.insertAdjacentElement('afterend', c.btn);
    stats.clamped++;
  }

  /* ---- shape 2 · a run of paragraphs behind one control --------------- */
  var runId = 0;
  function foldRun(list, force) {
    var rest = list.slice(1);
    var chars = rest.reduce(function (n, p) { return n + p.textContent.trim().length; }, 0);
    if (rest.length < RUN_MIN) return false;
    /* `force` is the caller saying "the alternative here is two clamps in
       a row", which is worse than folding a short tail. It may skip the
       CHARS test; it may never skip RUN_MIN, because a run of one is not
       a run at all. */
    if (chars < RUN_CHARS && !force) return false;

    var lead = list[0];
    /* The paragraph still on show may itself be a wall. It used to get
       its own clamp control, inserted after this one was already in the
       DOM — which is the run-on line described at the top of this file.
       It still gets clamped; it no longer gets a second button. */
    var leadLong = lead.textContent.trim().length > LONG_ONE;

    var id = 'ksat-run-' + (++runId);
    var wrap = el('div', 'ksat-run');
    wrap.id = id;
    lead.insertAdjacentElement('afterend', wrap);
    rest.forEach(function (p) { p.dataset.ksatFolded = '1'; wrap.appendChild(p); });

    if (UNTIL_FOUND) wrap.setAttribute('hidden', 'until-found');
    else wrap.hidden = true;

    if (leadLong) {
      /* Marked folded as well, so the clamp pass in doSection() walks
         past it instead of handing it the button we just removed. */
      lead.dataset.ksatFolded = '1';
      lead.classList.add('ksat-fold');
      if (!lead.id) lead.id = 'ksat-fold-' + (++foldId);
      stats.clamped++;
      stats.merged++;
    }

    var c = control(function (open, code) {
      if (open) return T.less[code];
      return leadLong ? T.merged(rest.length, code) : T.run(rest.length, code);
    });
    /* aria-controls takes a LIST. A merged control genuinely governs two
       elements and a screen reader should be told both. */
    c.btn.setAttribute('aria-controls', leadLong ? lead.id + ' ' + id : id);

    function openAll() {
      wrap.removeAttribute('hidden');
      wrap.hidden = false;
      if (leadLong) lead.classList.add('ksat-fold-open');
      c.set(true);
    }
    function closeAll() {
      if (UNTIL_FOUND) wrap.setAttribute('hidden', 'until-found');
      else wrap.hidden = true;
      if (leadLong) lead.classList.remove('ksat-fold-open');
      c.set(false);
      /* Collapsing a merged control can pull a screenful out from under
         the reader; put the paragraph they were reading back in view.
         `auto` under reduced motion, never a smooth scroll they did not
         ask for. */
      if (lead.getBoundingClientRect().top < 0) {
        lead.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' });
      }
    }
    c.btn.addEventListener('click', function () {
      c.isOpen() ? closeAll() : openAll();
    });
    /* Ctrl+F landed inside it: the browser reveals it, so match the
       button — and un-clamp the lead too, or the reader gets a revealed
       tail hanging off a paragraph that is still cut at two lines. */
    wrap.addEventListener('beforematch', function () {
      if (leadLong) lead.classList.add('ksat-fold-open');
      c.set(true);
    });

    wrap.insertAdjacentElement('afterend', c.btn);
    stats.runs++;
    stats.hidden += rest.length;
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

    var ctl = control(function (open, code) {
      return open ? T.fewer[code] : T.grid(kids.length, code);
    });
    ctl.btn.setAttribute('aria-controls', container.id);
    function setOpen(open) {
      rest.forEach(function (c) { hideCard(c, !open); });
      ctl.set(open);
    }
    ctl.btn.addEventListener('click', function () { setOpen(!ctl.isOpen()); });
    rest.forEach(function (c) {
      c.addEventListener('beforematch', function () { setOpen(true); });
    });

    container.insertAdjacentElement('afterend', ctl.btn);
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
      if (g.length > 1) {
        /* Count what the fallback would cost before taking it. Two
           paragraphs of 170 characters each clear LONG_ONE on their own
           but their tail is under RUN_CHARS, so foldRun used to refuse
           and both got clamped — two controls in a row, the same pile-up
           the merge above exists to stop, arriving by the other door.
           One control always beats two, so a group that would produce
           two or more clamps folds as a run regardless of RUN_CHARS. */
        var wouldClamp = 0;
        for (var k = 0; k < g.length; k++) {
          if (g[k].textContent.trim().length > LONG_ONE) wouldClamp++;
        }
        if (foldRun(g, wouldClamp > 1)) return;
      }
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
