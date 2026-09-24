/* =====================================================================
   ksat-access.js — THE WAY IN FOR SOMEONE WHO IS NOT ALREADY INSIDE
   Owner: 01 Front End

   THE PROBLEM. An outside researcher arriving at this site today gets
   a dead end. The sign-in card says "This platform is restricted to
   authorized researchers" and "Accounts are issued by the KuwaitSat-1
   research programme", and then offers no link, no address and no
   control that would let anyone become one. Eleven invite panels across
   the public page funnel into the same wall.

   So this adds one line and one button to the card the visitor is
   already looking at — "Are you an external researcher?" / "Apply for
   Data Access" — and an application form behind it.

   ------------------------------------------------------------------
   THE HONEST PART, WHICH IS THE WHOLE DESIGN
   ------------------------------------------------------------------
   There is NO backend for this. No table, no RPC, no email service, no
   monitored address anywhere in the repository. The brief was explicit:
   if there is no real approval system, do not invent a fake one.

   So nothing here pretends to submit. The form does not POST. It builds
   the completed request as text and hands it to the applicant with a
   copy button, and the confirmation says plainly that no account has
   been created and that the request still has to reach the team. A
   spinner and a "Request received, we will be in touch" screen would
   have been three lines shorter and would have been a lie told to a
   real person about their own data access.

   Two things are stated on screen because the brief requires them:
   submitting does not grant access, and this is a prototype.

   ------------------------------------------------------------------
   WHY IT SWAPS THE CARD RATHER THAN OPENING A SECOND OVERLAY
   ------------------------------------------------------------------
   #ksat-gate already has a backdrop, a star field, a close button, an
   Escape handler, a focus trap, `inert` on <main>, and focus restore on
   close. Building a second modal means reimplementing all of that and
   getting one of them subtly wrong. Instead the sign-in nodes are
   DETACHED from the card (references kept) and the form is appended in
   their place; "Back to sign in" puts them back.

   That also keeps the focus trap correct. ksat-shell.js:1213-1240 walks
   `g.querySelectorAll('input, button, a[href], [tabindex]')` live at
   keydown and does NOT filter hidden nodes — so hiding the sign-in
   fields with [hidden] instead of removing them would leave Tab cycling
   through invisible inputs.

   THE CTA MUST NOT BE GATED ON haveDb(). When the database is
   unreachable, ksat-shell.js disables #ksat-signin entirely. That is
   precisely the visitor this rescues, so the apply route stays live
   even when signing in cannot work.
   ===================================================================== */
(function (w, doc) {
  'use strict';

  var KS = w.KSAT = w.KSAT || {};
  if (KS.access) { return; }

  /* textContent only, never innerHTML. Both ksat-shell.js and
     ksat-integration.js state this as a hard rule, and every field
     below carries a string a stranger typed. */
  function el(tag, cls, txt) {
    var n = doc.createElement(tag);
    if (cls) { n.className = cls; }
    if (txt !== undefined && txt !== null) { n.textContent = txt; }
    return n;
  }

  var FIELDS = [
    { k: 'name', l: 'Full name', t: 'text', req: true },
    { k: 'inst', l: 'Institution or organisation', t: 'text', req: true },
    { k: 'role', l: 'Academic or professional role', t: 'text', req: true },
    { k: 'mail', l: 'Email address', t: 'email', req: true },
    { k: 'topic', l: 'Research topic or area', t: 'text', req: true },
    { k: 'why', l: 'Why you need KuwaitSat-1 data', t: 'area', req: true },
    { k: 'use', l: 'What you intend to use the data for', t: 'area', req: true }
  ];

  /* ------------------------------------------------------------------
     THE FORM
     ------------------------------------------------------------------ */
  function buildForm(card, restore) {
    var form = doc.createElement('form');
    form.className = 'ksat-ax-form';
    form.setAttribute('novalidate', '');

    form.appendChild(el('div', 'ksat-gate-eyebrow', 'KuwaitSat-1 Mission Hub'));
    form.appendChild(el('h2', null, 'Apply for data access'));
    form.appendChild(el('p', 'ksat-gate-sub',
      'For researchers outside the KuwaitSat-1 programme. Tell us who you ' +
      'are and what you are trying to find out.'));

    var inputs = {};
    FIELDS.forEach(function (f) {
      var wrap = el('label', 'ksat-ax-field');
      wrap.appendChild(el('span', 'ksat-ax-lab', f.l));
      var i = doc.createElement(f.t === 'area' ? 'textarea' : 'input');
      i.id = 'ksat-ax-' + f.k;
      i.name = f.k;
      if (f.t !== 'area') { i.type = f.t; }
      else { i.rows = 3; }
      if (f.req) { i.required = true; }
      i.autocomplete = f.k === 'mail' ? 'email' : 'off';
      wrap.appendChild(i);
      inputs[f.k] = i;
      form.appendChild(wrap);
    });

    /* The brief requires this to be unmistakable, so it is a panel and
       not a footnote. */
    form.appendChild(el('p', 'ksat-ax-warn',
      'Submitting this does not grant access. Requests are reviewed by the ' +
      'KuwaitSat team, and access is issued only if the request is approved.'));

    var msg = el('p', 'ksat-ax-msg');
    msg.hidden = true;

    var row = el('div', 'ksat-ax-row');
    var send = el('button', 'ksat-gate-btn', 'Submit application');
    send.type = 'submit';
    var back = el('button', 'ksat-ax-back', 'Back to sign in');
    back.type = 'button';
    row.appendChild(send);
    row.appendChild(back);

    form.appendChild(msg);
    form.appendChild(row);

    back.addEventListener('click', restore);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var missing = FIELDS.filter(function (f) {
        return f.req && !String(inputs[f.k].value || '').trim();
      });
      var mail = String(inputs.mail.value || '').trim();
      if (missing.length) {
        msg.hidden = false;
        msg.className = 'ksat-ax-msg bad';
        msg.textContent = missing.length === 1
          ? 'One field still needs an answer: ' + missing[0].l.toLowerCase() + '.'
          : missing.length + ' fields still need an answer, starting with ' +
            missing[0].l.toLowerCase() + '.';
        inputs[missing[0].k].focus();
        return;
      }
      if (mail.indexOf('@') < 1 || mail.indexOf('.', mail.indexOf('@')) < 0) {
        msg.hidden = false;
        msg.className = 'ksat-ax-msg bad';
        msg.textContent = 'That email address does not look complete.';
        inputs.mail.focus();
        return;
      }
      done(card, inputs, restore);
    });

    return form;
  }

  /* ------------------------------------------------------------------
     THE CONFIRMATION

     Nothing was sent. This says so, and gives the applicant the text so
     the request is not lost.
     ------------------------------------------------------------------ */
  function done(card, inputs, restore) {
    var lines = ['KuwaitSat-1 — request for research data access', ''];
    FIELDS.forEach(function (f) {
      lines.push(f.l + ': ' + String(inputs[f.k].value || '').trim());
    });
    var text = lines.join('\n');

    while (card.firstChild) { card.removeChild(card.firstChild); }

    card.appendChild(el('div', 'ksat-gate-eyebrow', 'KuwaitSat-1 Mission Hub'));
    card.appendChild(el('h2', null, 'Your application is ready to send'));
    card.appendChild(el('p', 'ksat-gate-sub',
      'This platform is a prototype and has no application inbox connected ' +
      'to it yet, so nothing has been transmitted. Your answers are below. ' +
      'Copy them and send them to the KuwaitSat team, and they will be ' +
      'reviewed in the normal way.'));

    var pre = el('pre', 'ksat-ax-out', text);
    card.appendChild(pre);

    var row = el('div', 'ksat-ax-row');
    var copy = el('button', 'ksat-gate-btn', 'Copy application');
    copy.type = 'button';
    var back = el('button', 'ksat-ax-back', 'Back to sign in');
    back.type = 'button';
    row.appendChild(copy);
    row.appendChild(back);
    card.appendChild(row);

    var note = el('p', 'ksat-ax-warn',
      'No account has been created and no access has been granted by this step.');
    card.appendChild(note);

    copy.addEventListener('click', function () {
      function ok() { copy.textContent = 'Copied'; }
      try {
        if (w.navigator && w.navigator.clipboard) {
          w.navigator.clipboard.writeText(text).then(ok, select);
        } else { select(); }
      } catch (e) { select(); }
    });

    /* Clipboard access can be refused, and in an iframe usually is.
       Selecting the text is the fallback that always works. */
    function select() {
      try {
        var r = doc.createRange();
        r.selectNodeContents(pre);
        var s = w.getSelection();
        s.removeAllRanges();
        s.addRange(r);
        copy.textContent = 'Press Ctrl+C to copy';
      } catch (e) {
        copy.textContent = 'Select the text above to copy';
      }
    }

    back.addEventListener('click', restore);
    back.focus();
  }

  /* ------------------------------------------------------------------
     MOUNTING
     ------------------------------------------------------------------ */
  function openForm(card) {
    /* MARK THE CARD. scan() runs from a MutationObserver on body, and
       clearing the card removes #ksat-access-cta, so without this the
       observer helpfully re-adds "Apply for Data Access" on top of the
       application the visitor is already filling in. Seen in testing:
       it appeared underneath the confirmation screen. */
    card.setAttribute('data-ksat-ax', 'open');
    var held = [];
    while (card.firstChild) {
      held.push(card.firstChild);
      card.removeChild(card.firstChild);
    }
    function restore() {
      card.removeAttribute('data-ksat-ax');
      while (card.firstChild) { card.removeChild(card.firstChild); }
      held.forEach(function (n) { card.appendChild(n); });
      var m = card.querySelector('input[type="email"]');
      if (m) { m.focus(); }
    }
    var form = buildForm(card, restore);
    card.appendChild(form);
    var first = form.querySelector('input');
    if (first) { first.focus(); }
  }

  function cta(onOpen) {
    var box = el('div', 'ksat-ax-cta');
    box.id = 'ksat-access-cta';
    box.appendChild(el('p', 'ksat-ax-ask', 'Are you an external researcher?'));
    var b = el('button', 'ksat-ax-apply', 'Apply for Data Access');
    b.type = 'button';
    b.addEventListener('click', onOpen);
    box.appendChild(b);
    return box;
  }

  function scan() {
    /* index.html and any page carrying the shared gate. */
    var g = doc.getElementById('ksat-gate');
    if (g) {
      var card = g.querySelector('.ksat-gate-card');
      if (card && !card.getAttribute('data-ksat-ax') &&
          !card.querySelector('#ksat-access-cta')) {
        card.appendChild(cta(function () { openForm(card); }));
      }
    }
    /* researcher.html, where the wall is static markup instead. */
    var d = doc.getElementById('denied');
    if (d) {
      var boxD = d.querySelector('.entrybox');
      if (boxD && !boxD.querySelector('#ksat-access-cta')) {
        boxD.appendChild(cta(function () {
          if (KS.shell && KS.shell.openGate) { KS.shell.openGate(); return; }
          w.location.href = '/';
        }));
      }
    }
  }

  KS.access = { scan: scan, open: openForm };

  function start() {
    scan();
    /* The gate is built lazily by ksat-integration.js and then captured,
       detached and re-appended by ksat-shell.js, so it can enter the
       document long after load. */
    new w.MutationObserver(scan).observe(doc.body, { childList: true, subtree: true });
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
}(window, document));
