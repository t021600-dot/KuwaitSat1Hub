/* =====================================================================
   ksat-assistant.js — MISSION ASSISTANT
   Owner: 03 Security, with 04 Agents (the guardrail text)

   A corner assistant for researchers and for anyone looking at the
   platform for the first time.

   THE DESIGN DECISION WORTH DEFENDING
   This does NOT add a second brain. The page already contains a working
   analyst (askAnalyst(), section #ai) that answers in a fixed five-part
   structure and badges every answer with the class of data it rests on.
   Building a rival that answered the same questions differently would
   mean two sources of truth on one page, and the second one would have
   no provenance.

   So the assistant does two things and refuses the third:
     1 · PLATFORM questions it answers itself, from a written knowledge
         base below. How the agents work, who can see what, where the
         numbers come from, what the checkpoint is for.
     2 · DATA questions it hands to askAnalyst() - the real engine - and
         mirrors that answer back WITH its provenance badge, alongside a
         control that opens the full analyst where the sources are.
     3 · Anything it has no grounding for, it says so. It does not guess.

   NO NETWORK. NO KEY. NO MODEL.
   Everything here runs in the page. There is no API call, so there is
   no key to leak and nothing to intercept. That is also why it works
   under our Content-Security-Policy, whose connect-src allows only our
   own origin and Supabase: a third-party chatbot would be blocked, and
   correctly so.

   SECURITY NOTES FOR THE REVIEWER
   - Every string that reaches the DOM goes through textContent. There
     is no innerHTML in this file, so a question containing markup is
     rendered as the characters the researcher typed.
   - The transcript is kept in sessionStorage, per tab, and never leaves
     the browser. It is not written to the database: a researcher's
     questions are their own.
   - It reads identity from KSAT.live only to change its greeting. It
     never asks the database for anything, so it cannot leak a row it
     was not entitled to.
   ===================================================================== */

(function () {
  'use strict';

  var KS = window.KSAT = window.KSAT || {};
  if (KS.assistant) return;                       /* never double-mount */

  var PANEL_ID = 'ksat-as-panel';
  var FAB_ID   = 'ksat-as-fab';
  var STORE    = 'ksat.assistant.log.v1';

  /* ===================================================================
     1 · SMALL DOM HELPERS. textContent only, everywhere.
     =================================================================== */

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }
  function reduced() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (e) { return false; }
  }
  function isRTL() {
    var r = document.documentElement;
    return r.getAttribute('dir') === 'rtl' || r.getAttribute('lang') === 'ar';
  }

  /* ===================================================================
     2 · THE KNOWLEDGE BASE

     Written, not generated. Each entry carries the words a person would
     actually use, and an answer that is true of THIS build. Where an
     answer would be stronger with a number, the number is the one the
     system really enforces - they are pulled from KS.LIMITS where that
     exists so they cannot drift apart from the database.

     `see` names a section so the assistant can offer to take you there.
     =================================================================== */

  function limits() {
    var L = KS.LIMITS || {};
    return {
      floor:    (L.MIN_ZONE_SCORE != null ? L.MIN_ZONE_SCORE : 40),
      reranks:  (L.MAX_RERANKS    != null ? L.MAX_RERANKS    : 2),
      budget:   (L.STEP_BUDGET    != null ? L.STEP_BUDGET    : 40)
    };
  }

  var KB = [
    {
      k: ['what is this', 'what is kuwaitsat', 'about', 'what does this do', 'purpose', 'explain the site', 'what am i looking at'],
      t: 'What this platform is',
      a: function () {
        return 'KuwaitSat-1 Mission Hub turns what the satellite sees into something a planner can act on. ' +
               'A researcher states an objective and an area; a pipeline of agents collects the imagery, analyses vegetation and surface heat, ' +
               'ranks candidate zones, projects the likely effect of greening each one, and drafts a report. ' +
               'A person approves that report before it exists. Every figure on the site names where it came from.';
      },
      see: 'mission'
    },
    {
      k: ['real data', 'is the data real', 'fake', 'made up', 'where do the numbers come from', 'provenance', 'badge', 'measured', 'modelled', 'source'],
      t: 'Where the numbers come from',
      a: function () {
        return 'Every figure carries one of four marks, and they are the honest answer to this question.\n\n' +
               '🛰 MISSION RECORD — published, attributable fact about KuwaitSat-1. The source is always linked.\n' +
               '▦ REFERENCE DATASET — thirty-six monthly records per governorate, modelled on published Kuwaiti climate and land-cover patterns.\n' +
               '◈ MODELLED — produced by the platform’s environmental model. Physically consistent, derived rather than measured.\n' +
               '⬡ DERIVED ANALYSIS — an interpretation by the analyst in this page. Decision support, never a decision.\n\n' +
               'The satellite facts are real and cited. The environmental figures are modelled, and every panel that shows one says so. ' +
               'When calibrated feeds are connected, those panels change and the marks change with them.';
      },
      see: 'legend'
    },
    {
      k: ['who can see', 'privacy', 'colleague', 'other researcher', 'my missions', 'can anyone see', 'isolation', 'rls', 'row level'],
      t: 'Who can see your work',
      a: function () {
        return 'Nobody but you. Not your colleagues, not the agents, not an administrator through this site.\n\n' +
               'Your missions, runs, agent steps, results and reports are filtered in the database by row-level security, ' +
               'keyed to the account in your signed session. It is not the page choosing what to draw — the database refuses to return the rows at all.\n\n' +
               'Tested rather than claimed: a researcher asking for a colleague’s mission by its exact primary key gets zero rows back, ' +
               'and the anonymous role holds no grant on any table, view or function.';
      },
      see: 'trust'
    },
    {
      k: ['agent', 'workflow', 'pipeline', 'how do the agents work', 'automation', 'steps'],
      t: 'How the agent workflow runs',
      a: function () {
        var L = limits();
        return 'Six stages, and one real decision.\n\n' +
               '1 · You state an objective and an area, and press Launch Mission.\n' +
               '2 · The data collection agent delineates candidate zones on the 39 m grid.\n' +
               '3 · Environmental analysis ranks them by observed stress.\n' +
               '4 · THE DECISION. Each zone is checked against a projected cover-uplift floor. ' +
               'Below the floor the zone is REJECTED, a re-ranking subroutine drops it, and the next candidate comes forward — at most ' + L.reranks + ' times.\n' +
               '5 · The accepted zone is written to the map.\n' +
               '6 · A report is drafted — and stops, awaiting your approval.\n\n' +
               'Every pass is written to the audit trail, including every refusal and the number that caused it. ' +
               'The highest-ranked zone is often not the one that reaches the map, and that is the point.';
      },
      see: 'agent'
    },
    {
      k: ['checkpoint', 'approve', 'approval', 'human in the loop', 'report agent', 'who signs'],
      t: 'The human checkpoint',
      a: function () {
        return 'No report exists without a named, signed-in person who owns that mission.\n\n' +
               'When the agents finish, the workflow pauses and shows the draft with an Approve control. ' +
               'The report is written only when a person presses it, and the approver recorded against it is taken from the verified session — ' +
               'it cannot be pointed at somebody else.\n\n' +
               'The part that genuinely cannot happen: the automation engine is refused the report function outright. ' +
               'An unattended pipeline cannot sign its own conclusion, which is the whole reason a checkpoint exists in an AI system.';
      },
      see: 'agent'
    },
    {
      k: ['password', 'stored', 'sign in', 'login', 'account', 'authentication', 'secure my account'],
      t: 'Passwords and sign-in',
      a: function () {
        return 'This platform never sees your password and has nowhere to put one — there is no password column in any table we own.\n\n' +
               'Authentication is handled by Supabase Auth: your password is hashed with bcrypt on their side, and this page receives only a short-lived session token. ' +
               'The key that ships in the page is a publishable key, which grants nothing on its own — every table, view and function refuses it.';
      },
      see: 'trust'
    },
    {
      k: ['security', 'how secure', 'protection', 'headers', 'csp', 'hack', 'attack', 'safe'],
      t: 'The security posture',
      a: function () {
        return 'The short version: the database decides, not the page.\n\n' +
               '· Row-level security on every table, and column-level grants on top — the anonymous role holds nothing.\n' +
               '· Every write goes through a function that re-reads ownership inside the transaction rather than trusting what the browser sent.\n' +
               '· Real response headers: HSTS, a content security policy with frame-ancestors, object-src and base-uri all set to none, nosniff, a referrer policy, and a permissions policy denying camera, microphone and location.\n' +
               '· Thirty-six automated checks run against the live system as an anonymous visitor. They try the door rather than asking whether it is locked.\n\n' +
               'One gap is documented rather than hidden: the policy still allows inline script, because the page contains twenty-seven inline blocks and a strict policy would blank it. The write-up says exactly how that closes.';
      },
      see: 'trust'
    },
    {
      k: ['run a mission', 'how do i start', 'launch', 'get started', 'new mission', 'use the console'],
      t: 'Running a mission',
      a: function () {
        return 'Sign in, open the research console, state what you are trying to find out, choose the area and the period, and press Launch Mission.\n\n' +
               'You will see each agent report as it goes, including the zones it refuses and why. ' +
               'At the end the draft report waits for your approval. Nothing is written under your name until you give it.';
      },
      see: 'console'
    },
    {
      k: ['public', 'outsider', 'insider', 'why is this hidden', 'sign in to see', 'locked', 'tier'],
      t: 'Why some panels ask you to sign in',
      a: function () {
        return 'Nothing is hidden for secrecy.\n\n' +
               'The panels behind sign-in are the ones that PRODUCE work — a mission, a run, a scored recommendation. ' +
               'They are where a signed-in researcher’s own rows are drawn, and those rows live in the database behind row-level security. ' +
               'They were never in this page to begin with, so unlocking the panel in your browser would show you empty instruments.\n\n' +
               'Everything that explains, evidences or attributes the work is public: the mission record, the imagery story, the governance pages, the team and every source.';
      },
      see: 'legend'
    },
    {
      k: ['who built', 'team', 'authors', 'students', 'credit'],
      t: 'Who built this',
      a: function () {
        return 'A four-person team, each owning one part: front end, back end, AI agents and automation, and security. ' +
               'The KuwaitSat-1 satellite itself is the work of the project team at Kuwait University with the Kuwait Foundation for the Advancement of Sciences — ' +
               'they built it, and this platform only looks at what it sees.';
      },
      see: 'team'
    },
    {
      k: ['3d', 'orbit', 'globe', 'satellite path', 'where is the satellite'],
      t: 'The orbit view',
      a: function () {
        return 'The 3D orbit view draws KuwaitSat-1’s path from a circular two-body model at a fixed inclination. ' +
               'It is marked as modelled rather than live telemetry, because that is what it is — the platform does not carry a live tracking feed. ' +
               'Altitude, ground sample distance and swath in the readout are the published mission figures.';
      },
      see: 'globe'
    },
    {
      k: ['report', 'download', 'export', 'pdf', 'get the report'],
      t: 'Reports',
      a: function () {
        return 'A report is produced only after you approve the draft. It carries a provenance mark on every figure, ' +
               'the run identifier that produced it, and the identifiers of the agent steps behind it — including the zones that were rejected and the numbers that rejected them. ' +
               'Anyone reading it can trace any figure back to the step that made it.';
      },
      see: 'agent'
    }
  ];

  /* A question we cannot ground gets this, not a guess. */
  function noAnswer(q) {
    return 'I don’t have a grounded answer for that, and I would rather say so than invent one.\n\n' +
           'I can explain how the agent workflow reaches a decision, who can see your work, where any number on this page came from, ' +
           'what the approval checkpoint protects, or how sign-in and security are handled. ' +
           'For questions about the environmental data itself — greening potential, surface heat, change between epochs — ' +
           'the analyst in the AI section answers from the dataset and shows its sources.';
  }

  /* Words that mean "this is a question about the DATA", which belongs
     to the real analyst rather than to this knowledge base. */
  var DATA_WORDS = /\b(greening|vegetation|ndvi|heat|temperature|stress|coverage|score|governorate|jahra|ahmadi|asimah|hawalli|farwaniya|mubarak|bubiyan|change|epoch|trend|highest|lowest|compare|which area|how much|rainfall|dust)\b/i;

  function match(q) {
    var s = (q || '').toLowerCase();
    var best = null, bestScore = 0;
    for (var i = 0; i < KB.length; i++) {
      var score = 0;
      for (var j = 0; j < KB[i].k.length; j++) {
        var kw = KB[i].k[j];
        if (s.indexOf(kw) !== -1) score += kw.length;        /* longer phrase, stronger signal */
      }
      if (score > bestScore) { bestScore = score; best = KB[i]; }
    }
    return bestScore >= 4 ? best : null;
  }

  /* ===================================================================
     3 · BUILDING IT
     =================================================================== */

  var ui = {};

  function buildFab() {
    var b = el('button', 'ksat-as-fab');
    b.id = FAB_ID;
    b.type = 'button';
    b.setAttribute('aria-haspopup', 'dialog');
    b.setAttribute('aria-expanded', 'false');
    b.setAttribute('aria-controls', PANEL_ID);
    b.setAttribute('aria-label', 'Open the mission assistant');

    /* The mark: a satellite over a horizon, drawn rather than an emoji,
       so it inherits the interface colour and stays crisp at any zoom. */
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.classList.add('ksat-as-mark');
    var paths = [
      'M3 17.5a9 9 0 0 1 18 0',                       /* the horizon    */
      'M12 3.4v3.1',                                  /* mast           */
      'M9.2 8.2h5.6v3.2H9.2z',                        /* body           */
      'M5.6 9.0h3.0M15.2 9.0h3.0',                    /* solar panels   */
      'M5.6 10.6h3.0M15.2 10.6h3.0'
    ];
    paths.forEach(function (d) {
      var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', d);
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', 'currentColor');
      p.setAttribute('stroke-width', '1.5');
      p.setAttribute('stroke-linecap', 'round');
      p.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(p);
    });
    b.appendChild(svg);
    b.appendChild(el('span', 'ksat-as-fab-label', 'Assistant'));

    b.addEventListener('click', function () { isOpen() ? close() : open(); });
    document.body.appendChild(b);
    ui.fab = b;
  }

  function buildPanel() {
    var p = el('div', 'ksat-as-panel');
    p.id = PANEL_ID;
    p.setAttribute('role', 'dialog');
    p.setAttribute('aria-modal', 'false');     /* the page stays usable behind it */
    p.setAttribute('aria-label', 'Mission assistant');
    p.hidden = true;

    /* header */
    var head = el('div', 'ksat-as-head');
    var ttl = el('div', 'ksat-as-ttl');
    ttl.appendChild(el('span', 'ksat-as-eyebrow', 'MISSION ASSISTANT'));
    ttl.appendChild(el('span', 'ksat-as-sub', 'Answers from this page. No external model.'));
    head.appendChild(ttl);

    var x = el('button', 'ksat-as-x', '×');
    x.type = 'button';
    x.setAttribute('aria-label', 'Close the assistant');
    x.addEventListener('click', close);
    head.appendChild(x);
    p.appendChild(head);

    /* transcript */
    var log = el('div', 'ksat-as-log');
    log.id = 'ksat-as-log';
    log.setAttribute('role', 'log');
    log.setAttribute('aria-live', 'polite');
    log.setAttribute('aria-label', 'Conversation');
    p.appendChild(log);
    ui.log = log;

    /* suggestions */
    var chips = el('div', 'ksat-as-chips');
    ui.chips = chips;
    p.appendChild(chips);

    /* composer */
    var form = el('form', 'ksat-as-form');
    form.setAttribute('novalidate', 'novalidate');
    var inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'ksat-as-input';
    inp.id = 'ksat-as-input';
    inp.placeholder = 'Ask about the platform, the agents or your privacy…';
    inp.setAttribute('autocomplete', 'off');
    inp.setAttribute('maxlength', '400');
    inp.setAttribute('aria-label', 'Ask the mission assistant');
    var send = el('button', 'ksat-as-send', 'Ask');
    send.type = 'submit';
    form.appendChild(inp);
    form.appendChild(send);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = inp.value.trim();
      if (!v) return;
      inp.value = '';
      ask(v);
    });
    p.appendChild(form);
    ui.input = inp;

    document.body.appendChild(p);
    ui.panel = p;

    p.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
    });
  }

  /* ===================================================================
     4 · SPEAKING
     =================================================================== */

  function bubble(who, text, opts) {
    opts = opts || {};
    var row = el('div', 'ksat-as-row ksat-as-' + who);
    var b = el('div', 'ksat-as-bubble');

    if (opts.title) b.appendChild(el('div', 'ksat-as-btitle', opts.title));

    /* Paragraphs, preserved. textContent per line - never innerHTML. */
    String(text).split('\n').forEach(function (line) {
      if (!line.trim()) { b.appendChild(el('div', 'ksat-as-gap')); return; }
      b.appendChild(el('p', 'ksat-as-p', line));
    });

    if (opts.badge) {
      var bd = el('span', 'ksat-as-badge', opts.badge);
      b.appendChild(bd);
    }

    if (opts.goto) {
      var go = el('button', 'ksat-as-go', opts.gotoLabel || 'Open that section');
      go.type = 'button';
      go.addEventListener('click', function () {
        try {
          if (KS.shell && KS.shell.goToSection) KS.shell.goToSection(opts.goto);
          else { var t = document.getElementById(opts.goto); if (t) t.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth' }); }
        } catch (e) {}
        if (window.matchMedia('(max-width: 620px)').matches) close();
      });
      b.appendChild(go);
    }

    row.appendChild(b);
    ui.log.appendChild(row);
    ui.log.scrollTop = ui.log.scrollHeight;
    save();
    return b;
  }

  function thinking() {
    var row = el('div', 'ksat-as-row ksat-as-a');
    var b = el('div', 'ksat-as-bubble ksat-as-wait');
    b.appendChild(el('span', 'ksat-as-dot'));
    b.appendChild(el('span', 'ksat-as-dot'));
    b.appendChild(el('span', 'ksat-as-dot'));
    b.setAttribute('aria-label', 'Working');
    row.appendChild(b);
    ui.log.appendChild(row);
    ui.log.scrollTop = ui.log.scrollHeight;
    return row;
  }

  /* Hand a data question to the page's own analyst and mirror its answer
     back, badge and all. We read the analyst's log rather than
     re-implementing it, so there is exactly one engine. */
  function delegate(q, row) {
    var logEl = document.getElementById('anLog');
    if (typeof window.askAnalyst !== 'function' || !logEl) {
      row.remove();
      bubble('a', 'The analyst is on the AI section of this page. It answers from the dataset and shows its sources.', { goto: 'ai', gotoLabel: 'Open the analyst' });
      return;
    }
    var before = logEl.children.length;
    try { window.askAnalyst(q); } catch (e) {
      row.remove();
      bubble('a', 'I could not reach the analyst just then. It is on the AI section of this page.', { goto: 'ai', gotoLabel: 'Open the analyst' });
      return;
    }
    /* The analyst writes its answer asynchronously; poll briefly. */
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      var kids = logEl.children;
      if (kids.length > before) {
        var last = kids[kids.length - 1];
        var txt = (last.innerText || last.textContent || '').trim();
        /* Strip the analyst's own "who" line - we re-label it ourselves. */
        var lines = txt.split('\n').filter(function (l) { return l.trim(); });
        if (lines.length && /analyst/i.test(lines[0])) lines.shift();
        if (lines.length) {
          clearInterval(iv);
          row.remove();
          bubble('a', lines.join('\n'), {
            title: 'From the KuwaitSat analyst',
            badge: 'answered over the reference dataset',
            goto: 'ai',
            gotoLabel: 'Open the analyst, with its sources'
          });
          return;
        }
      }
      if (tries > 40) {                                  /* ~4 seconds */
        clearInterval(iv);
        row.remove();
        bubble('a', 'The analyst is taking longer than expected. It is on the AI section of this page, with its sources.', { goto: 'ai', gotoLabel: 'Open the analyst' });
      }
    }, 100);
  }

  function ask(q) {
    bubble('q', q);
    var row = thinking();
    var wait = reduced() ? 60 : 320;

    setTimeout(function () {
      var hit = match(q);
      if (hit) {
        row.remove();
        bubble('a', hit.a(), { title: hit.t, goto: hit.see, gotoLabel: 'Show me' });
        return;
      }
      if (DATA_WORDS.test(q)) { delegate(q, row); return; }
      row.remove();
      bubble('a', noAnswer(q), { goto: 'ai', gotoLabel: 'Open the analyst' });
    }, wait);
  }

  /* ===================================================================
     5 · SUGGESTIONS — different for a visitor and a researcher
     =================================================================== */

  var SUGGEST_PUBLIC = [
    'What is this platform?',
    'Where do the numbers come from?',
    'Why do some panels ask me to sign in?',
    'How do the agents reach a decision?'
  ];
  var SUGGEST_INSIDER = [
    'Who can see my missions?',
    'How do I run a mission?',
    'What does the approval checkpoint protect?',
    'Where do the numbers come from?'
  ];

  function paintChips() {
    ui.chips.textContent = '';
    var list = KS.live ? SUGGEST_INSIDER : SUGGEST_PUBLIC;
    list.forEach(function (q) {
      var c = el('button', 'ksat-as-chip', q);
      c.type = 'button';
      c.addEventListener('click', function () { ask(q); });
      ui.chips.appendChild(c);
    });
  }

  function greet() {
    if (ui.log.children.length) return;              /* restored transcript */
    var who = KS.live ? 'You are signed in, so the instruments and your own missions are available.'
                      : 'You are viewing the public record. Signing in adds the instruments and your own missions.';
    bubble('a',
      'I can explain how this platform works, how the agents reach a decision, who can see your work, and where any number on this page came from.\n\n' +
      who + '\n\n' +
      'Everything I answer comes from this page. There is no external model and no network call.',
      { title: 'Mission assistant' });
  }

  /* ===================================================================
     6 · OPEN, CLOSE, REMEMBER
     =================================================================== */

  function isOpen() { return ui.panel && !ui.panel.hidden; }

  var lastFocus = null;
  function open() {
    if (!ui.panel) return;
    lastFocus = document.activeElement;
    ui.panel.hidden = false;
    ui.fab.setAttribute('aria-expanded', 'true');
    document.documentElement.setAttribute('data-ksat-assistant', 'open');
    paintChips();
    greet();
    setTimeout(function () { try { ui.input.focus(); } catch (e) {} }, reduced() ? 0 : 120);
  }
  function close() {
    if (!ui.panel) return;
    ui.panel.hidden = true;
    ui.fab.setAttribute('aria-expanded', 'false');
    document.documentElement.removeAttribute('data-ksat-assistant');
    try { (lastFocus && lastFocus.focus) ? lastFocus.focus() : ui.fab.focus(); } catch (e) {}
  }

  /* The transcript is a per-tab convenience. sessionStorage, not
     localStorage: a researcher's questions should not outlive the tab,
     and they are never sent anywhere. Wrapped because some contexts
     throw on access rather than returning null. */
  function save() {
    try {
      var rows = [].map.call(ui.log.children, function (r) {
        return { who: r.classList.contains('ksat-as-q') ? 'q' : 'a', text: r.innerText || '' };
      });
      sessionStorage.setItem(STORE, JSON.stringify(rows.slice(-40)));
    } catch (e) {}
  }
  function restore() {
    var rows = null;
    try { rows = JSON.parse(sessionStorage.getItem(STORE) || 'null'); } catch (e) { return; }
    if (!rows || !rows.length) return;
    rows.forEach(function (r) {
      var row = el('div', 'ksat-as-row ksat-as-' + (r.who === 'q' ? 'q' : 'a'));
      var b = el('div', 'ksat-as-bubble');
      String(r.text).split('\n').forEach(function (line) {
        if (line.trim()) b.appendChild(el('p', 'ksat-as-p', line));
      });
      row.appendChild(b);
      ui.log.appendChild(row);
    });
    ui.log.scrollTop = ui.log.scrollHeight;
  }

  /* ===================================================================
     7 · BOOT
     =================================================================== */

  function start() {
    if (document.getElementById(FAB_ID)) return;
    buildFab();
    buildPanel();
    restore();

    /* Keep the suggestions honest when the researcher signs in or out. */
    document.addEventListener('ksat:identity', function () { if (isOpen()) paintChips(); });

    /* A global shortcut a researcher will actually remember. */
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === '/' || e.key === '?')) {
        e.preventDefault();
        isOpen() ? close() : open();
      }
    });

    KS.assistant = { open: open, close: close, ask: ask };
  }

  function boot() {
    /* THE FIRST VERSION OF THIS WAITED FOR #anLog AND NEVER MOUNTED.
       #anLog is built by the page when the analyst section renders, and
       that section is INSIDER - hidden from a signed-out visitor - so
       for the public tier the element never appears and the launcher
       never mounted at all. The assistant is for visitors above all.

       There is nothing to wait for: delegate() already checks for
       askAnalyst at the moment a data question is asked, and degrades
       to "the analyst is on the AI section" when it is absent. So mount
       as soon as there is a body, with one frame's delay so the intro
       sequence owns the screen first. */
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (document.body || tries > 40) { clearInterval(iv); start(); }
    }, 100);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
