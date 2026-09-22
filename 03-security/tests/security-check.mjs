#!/usr/bin/env node
/* =====================================================================
   KuwaitSat-1 Mission Hub — THE SECURITY CHECK
   Owner: 03 · Security · Mariam Madouh

   Run it:
       node 03-security/tests/security-check.mjs
       node 03-security/tests/security-check.mjs --json      (for CI)

   WHAT MAKES THIS WORTH ANYTHING
   Every database check below runs as `anon`, holding only the
   publishable key that ships in the page — the exact position of a
   stranger with DevTools open. It does not use a service key, and it
   does not ask the database politely whether it is configured
   correctly. It tries the door.

   That distinction matters: a suite that queries `pg_policy` proves a
   policy EXISTS. This suite proves the door is LOCKED. A test that
   cannot fail is not evidence.

   Every check states what would make it FAIL. If a check cannot be
   performed, it reports SKIP — never a tick. A green tick here means
   the check ran and the system refused.
   ===================================================================== */

import { readFileSync, existsSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');

const SITE = process.env.KSAT_SITE || 'https://kuwait-sat1-hub.vercel.app';
const JSON_OUT = process.argv.includes('--json');

/* Read the live project from the page's own config, so this file holds
   no copy of anything that could drift. */
function readConfig() {
  const c = readFileSync(join(ROOT, 'js', 'config.js'), 'utf8');
  const url = (c.match(/SUPABASE_URL\s*=\s*'([^']+)'/) || [])[1];
  const key = (c.match(/SUPABASE_PUBLISHABLE_KEY\s*=\s*'([^']+)'/) || [])[1];
  return { url, key };
}
const CFG = readConfig();

/* ------------------------------------------------------------------ */
/* the tiny harness                                                     */
/* ------------------------------------------------------------------ */
const results = [];
let group = '';

const G = (name) => { group = name; };

async function check(id, title, failsWhen, fn) {
  let status = 'FAIL', detail = '';
  try {
    const r = await fn();
    if (r === 'SKIP' || (r && r.skip)) { status = 'SKIP'; detail = (r && r.detail) || 'not runnable here'; }
    else if (r === true) { status = 'PASS'; }
    else if (r && r.ok) { status = 'PASS'; detail = r.detail || ''; }
    else { status = 'FAIL'; detail = (r && r.detail) || String(r); }
  } catch (e) {
    status = 'FAIL';
    detail = e && e.message ? e.message.slice(0, 200) : String(e);
  }
  results.push({ id, group, title, failsWhen, status, detail });
  if (!JSON_OUT) {
    const mark = status === 'PASS' ? '\x1b[32m✔\x1b[0m'
              : status === 'SKIP' ? '\x1b[33m•\x1b[0m'
              : '\x1b[31m✘\x1b[0m';
    const line = `  ${mark} ${id.padEnd(7)} ${title}`;
    console.log(line + (detail && status !== 'PASS' ? `\n            ${detail}` : ''));
  }
}

/* PostgREST as an anonymous visitor. A refusal is the pass. */
async function anonGet(path) {
  const res = await fetch(`${CFG.url}/rest/v1/${path}`, {
    headers: { apikey: CFG.key, Authorization: `Bearer ${CFG.key}` }
  });
  let body = '';
  try { body = (await res.text()).slice(0, 200); } catch {}
  return { status: res.status, body };
}
async function anonRpc(fn, args = {}) {
  const res = await fetch(`${CFG.url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: CFG.key, Authorization: `Bearer ${CFG.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args)
  });
  let body = '';
  try { body = (await res.text()).slice(0, 200); } catch {}
  return { status: res.status, body };
}
const refused = (r) => r.status === 401 || r.status === 403 || r.status === 404
                    || /permission denied|does not exist|not find/i.test(r.body);


/* ------------------------------------------------------------------ */
/* TWO REAL ACCOUNTS, over the same public API                         */
/*                                                                     */
/* Everything above this point runs as `anon`, which proves that a     */
/* stranger reads nothing. It does NOT prove se-m1, because se-m1 is   */
/* about two people who are BOTH signed in: "account B cannot read     */
/* account A's rows". Until 21 Sep 2026 nothing in this repo re-proved */
/* that on demand - the matrix in 03-security/tests/RLS-TEST-MATRIX.md */
/* is run by hand, and tests/two-window-check.js needs a mission id    */
/* pasted into it.                                                     */
/*                                                                     */
/* Credentials come from the environment and never from a file:        */
/*                                                                     */
/*     KSAT_TEST_A="researcher-a@ksat.demo:the-password"               */
/*     KSAT_TEST_B="researcher-b@ksat.demo:the-password"               */
/*                                                                     */
/* Split on the FIRST colon, so a password may contain colons.         */
/*                                                                     */
/* >>> ABSENT VARIABLES MUST SKIP, NEVER FAIL. <<< A missing test      */
/* account is a missing test account; it is not a security finding,    */
/* and a suite that goes red for it teaches people to ignore red. A    */
/* sign-in that is REFUSED also skips, with the reason printed - the   */
/* usual cause is "Email not confirmed" on a fresh account.            */
/* ------------------------------------------------------------------ */
function splitCreds(v) {
  const s = String(v || '');
  const i = s.indexOf(':');
  if (i < 3 || i === s.length - 1) return null;
  return { email: s.slice(0, i).trim(), password: s.slice(i + 1) };
}

async function signIn(creds) {
  const res = await fetch(`${CFG.url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: CFG.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: creds.email, password: creds.password })
  });
  let body = {};
  try { body = await res.json(); } catch {}
  if (!res.ok || !body.access_token) {
    const why = body.error_description || body.msg || body.error || '';
    return { error: `HTTP ${res.status} ${String(why).slice(0, 80)}` };
  }
  return { token: body.access_token };
}

/* A signed-in read. The token is never printed anywhere. */
async function asUser(token, path) {
  const res = await fetch(`${CFG.url}/rest/v1/${path}`, {
    headers: { apikey: CFG.key, Authorization: `Bearer ${token}` }
  });
  let body = '';
  try { body = (await res.text()).slice(0, 300); } catch {}
  return { status: res.status, body };
}
const rowsOf = (r) => { try { const j = JSON.parse(r.body); return Array.isArray(j) ? j : null; } catch { return null; } };

let PAIR = null;
async function twoAccounts() {
  if (PAIR) return PAIR;
  const A = process.env.KSAT_TEST_A, B = process.env.KSAT_TEST_B;
  if (!A || !B) {
    PAIR = { skip: 'KSAT_TEST_A / KSAT_TEST_B are not set' };
    return PAIR;
  }
  const a = splitCreds(A), b = splitCreds(B);
  if (!a || !b) {
    PAIR = { skip: 'expected email:password in KSAT_TEST_A and KSAT_TEST_B' };
    return PAIR;
  }
  /* Two normal browser tabs share one session and account B silently
     becomes account A - the trap RLS-TEST-MATRIX.md opens with. The
     same mistake here is two variables holding one login, and it would
     make ISO-B fail rather than pass, which is at least loud. Say so
     plainly instead. */
  if (a.email.toLowerCase() === b.email.toLowerCase()) {
    PAIR = { skip: 'KSAT_TEST_A and KSAT_TEST_B are the same account' };
    return PAIR;
  }
  const ta = await signIn(a);
  if (ta.error) { PAIR = { skip: `${a.email} could not sign in - ${ta.error}` }; return PAIR; }
  const tb = await signIn(b);
  if (tb.error) { PAIR = { skip: `${b.email} could not sign in - ${tb.error}` }; return PAIR; }

  /* my_missions is the view granted to `authenticated`; a blanket
     select on the missions TABLE is revoked (03_grants.sql), so this is
     also the only shape that would work. */
  const aOwn = rowsOf(await asUser(ta.token, 'my_missions?select=id&limit=1')) || [];
  const bOwn = rowsOf(await asUser(tb.token, 'my_missions?select=id')) || [];

  PAIR = {
    aToken: ta.token, bToken: tb.token,
    aEmail: a.email, bEmail: b.email,
    aMission: (aOwn[0] || {}).id || null,
    bOwnCount: bOwn.length
  };
  return PAIR;
}

let HEAD = null;
async function headers() {
  if (HEAD) return HEAD;
  const res = await fetch(SITE, { redirect: 'follow' });
  HEAD = {};
  for (const [k, v] of res.headers) HEAD[k.toLowerCase()] = v;
  HEAD.__status = res.status;
  return HEAD;
}


/* ------------------------------------------------------------------ */
/* Remove the integration layer from index.html, by LINE.               */
/*                                                                      */
/* Filtering by TAG does not work: `<script src="js/ksat-shell.js">` is  */
/* recognisable but the `</script>` that closes it is identical to every */
/* other closing tag in the page, so six of them survived the filter and */
/* were reported as six changed tags. Removing whole lines is exact,     */
/* and it is also the unit the team's own constraint is written in.      */
/* ------------------------------------------------------------------ */
const LAYER_LINE = /ksat-(integration|theme|shell|workflow|assistant|density|i18n|agency|detail|motion|editorial)\.(css|js)|Plex\+Sans\+Arabic|vendor\/supabase\.js|js\/config\.js|^\s*<!--\s*=====\s*integration layer|^\s*(Added by 03 Security|this comment was changed|is kept at site-original)/;
function withoutLayer(html) {
  return html.split(/\r?\n/).filter(l => !LAYER_LINE.test(l)).join('\n');
}

const TABLES = ['missions', 'mission_runs', 'agent_steps', 'results', 'reports',
                'profiles', 'mission_collaborators', 'app_settings'];
const VIEWS  = ['my_missions', 'my_agent_steps', 'my_mission_results'];
const RPCS   = ['generate_report', 'launch_mission', 'researcher_log_step',
                'researcher_write_result', 'researcher_finish_run',
                'agent_log_step', 'agent_write_result', 'agent_finish_run',
                'claim_next_run', 'sweep_stalled_runs', 'missions_guard',
                'rls_auto_enable', 'kuwait_area_ok',
                /* From 11_monitoring.sql. Listed before the file has been
                   run on purpose: a function that does not exist answers
                   404, which this check reads as refused, and the day the
                   team runs 11 the name is already covered rather than
                   waiting for somebody to remember to add it. */
                'monitor_record', 'monitor_health'];

/* ================================================================== */
/*  RUN                                                               */
/* ================================================================== */
if (!JSON_OUT) {
  console.log('\n\x1b[1mKuwaitSat-1 Mission Hub — security check\x1b[0m');
  console.log(`  target   ${SITE}`);
  console.log(`  database ${CFG.url}`);
  console.log(`  identity anon (the publishable key that ships in the page)\n`);
}

/* ---- 1 · THE ANONYMOUS VISITOR ----------------------------------- */
G('se-m1 · isolation — what a stranger can reach');
if (!JSON_OUT) console.log('\x1b[1m  se-m1 · isolation\x1b[0m');

for (const t of TABLES) {
  await check(`AN-${t.slice(0, 4)}`, `anon cannot read \`${t}\``,
    'the table answers 200 with rows, or with an empty array instead of refusing',
    async () => {
      const r = await anonGet(`${t}?select=*&limit=1`);
      return refused(r) ? { ok: true, detail: `HTTP ${r.status}` }
                        : { ok: false, detail: `HTTP ${r.status} — NOT refused: ${r.body}` };
    });
}
for (const v of VIEWS) {
  await check(`AN-${v.slice(3, 7)}`, `anon cannot read view \`${v}\``,
    'the view answers 200 — which would mean security_invoker is off and it runs as its owner',
    async () => {
      const r = await anonGet(`${v}?select=*&limit=1`);
      return refused(r) ? { ok: true, detail: `HTTP ${r.status}` }
                        : { ok: false, detail: `HTTP ${r.status} — NOT refused: ${r.body}` };
    });
}
await check('AN-RPC', 'anon cannot execute any privileged function',
  'any of the 13 functions answers anything but a refusal',
  async () => {
    const open = [];
    for (const f of RPCS) {
      const r = await anonRpc(f, {});
      if (!refused(r)) open.push(`${f}=${r.status}`);
    }
    return open.length === 0
      ? { ok: true, detail: `${RPCS.length} functions, all refused` }
      : { ok: false, detail: `REACHABLE BY anon: ${open.join(', ')}` };
  });

/* ---- 1b · TWO SIGNED-IN ACCOUNTS. THE se-m1 SENTENCE ITSELF. ------ */

await check('ISO-A', 'the owner can read their own mission by its id',
  'the owner gets 0 rows - which is a MISSING POLICY, not a working lock, and looks identical to one',
  async () => {
    const p = await twoAccounts();
    if (p.skip) return { skip: true, detail: p.skip };
    if (!p.aMission) return { skip: true, detail: `${p.aEmail} owns no mission - nothing to test isolation against` };
    const r = await asUser(p.aToken, `missions?select=id,title&id=eq.${p.aMission}`);
    const rows = rowsOf(r);
    if (r.status !== 200 || rows === null) return { ok: false, detail: `HTTP ${r.status}: ${r.body}` };
    return rows.length === 1
      ? { ok: true, detail: `${p.aEmail} reads their own mission (1 row)` }
      : { ok: false, detail: `${p.aEmail} got ${rows.length} rows for their OWN mission` };
  });

await check('ISO-B', 'the second account gets zero rows for the first account\'s mission id',
  'account B gets a row for a mission it does not own - se-m1 is lost, and so is the product premise',
  async () => {
    const p = await twoAccounts();
    if (p.skip) return { skip: true, detail: p.skip };
    if (!p.aMission) return { skip: true, detail: `${p.aEmail} owns no mission - nothing to ask B for` };

    /* By PRIMARY KEY, not by a search. Knowing the id has to be worth
       nothing: B is not guessing at a name, it holds the exact key of a
       row that certainly exists. */
    const r = await asUser(p.bToken, `missions?select=id,title&id=eq.${p.aMission}`);
    const rows = rowsOf(r);

    /* 200 + [] is the pass: the database ANSWERED and had nothing to
       give. 401/403 is the WRONG kind of zero - that is the session
       failing, and two-window-check.js says the same thing at the same
       volume. It must not be read as isolation working. */
    if (r.status === 401 || r.status === 403) {
      return { ok: false, detail: `HTTP ${r.status} - B's session died; this is not a pass, re-run` };
    }
    if (r.status !== 200 || rows === null) return { ok: false, detail: `HTTP ${r.status}: ${r.body}` };
    if (rows.length !== 0) return { ok: false, detail: `*** ${p.bEmail} READ ${rows.length} ROW(S) OF ${p.aEmail}'S MISSION ***` };
    return { ok: true, detail: `${p.bEmail}: HTTP 200 [] by primary key; ${p.bOwnCount} own mission(s) still visible` };
  });

/* ---- 2 · NO SECRETS ---------------------------------------------- */
G('se-m2 · no secrets in the repository or its history');
if (!JSON_OUT) console.log('\n\x1b[1m  se-m2 · secrets\x1b[0m');

await check('SEC-GL', 'gitleaks finds no secret in the full history',
  'gitleaks exits non-zero on a finding that is not in .gitleaksignore',
  () => {
    const exe = process.env.GITLEAKS || 'C:\\Users\\senpa\\tools\\gitleaks.exe';
    if (!existsSync(exe)) return { skip: true, detail: `gitleaks not found at ${exe}` };
    try {
      execFileSync(exe, ['detect', '--source', ROOT, '--no-banner', '--redact'], { stdio: 'pipe' });
      return { ok: true, detail: 'no leaks' };
    } catch (e) {
      return { ok: false, detail: 'gitleaks reported a finding' };
    }
  });

await check('SEC-KEY', 'the shipped key is publishable, not a service key',
  'config.js carries an `eyJ` JWT or a service_role key — which would hand every visitor BYPASSRLS',
  () => {
    const c = readFileSync(join(ROOT, 'js', 'config.js'), 'utf8');
    if (/service_role/i.test(c)) return { ok: false, detail: 'config.js mentions service_role' };
    if (/eyJ[A-Za-z0-9_-]{20,}/.test(c)) return { ok: false, detail: 'config.js contains a JWT' };
    if (!/^sb_publishable_/.test(CFG.key || '')) return { ok: false, detail: `key is not sb_publishable_: ${String(CFG.key).slice(0, 12)}…` };
    return { ok: true, detail: 'sb_publishable_…' };
  });

await check('SEC-SVC', 'no service key VALUE anywhere in the working tree',
  'a file assigns a real service key as a literal - a JWT, or an sb_secret_ token',
  () => {
    /* The first version of this check matched the STRING
       "SUPABASE_SERVICE_ROLE_KEY" and flagged two files that are both
       correct: 04-agents/tools/preflight.js, which is itself a secret
       SCANNER and so contains the pattern by definition, and
       04-agents/worker/edge/index.ts, which does
       Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") - reading a key from the
       environment is the RIGHT thing to do and must not be a failure.

       A check that cries wolf on correct code teaches people to ignore
       it, which is worse than not having it. So this looks for a key
       VALUE assigned as a literal, which is what is actually dangerous. */
    let files = [];
    try {
      files = execFileSync('git', ['-C', ROOT, 'ls-files'], { stdio: 'pipe' })
        .toString().split(/\r?\n/).filter(Boolean);
    } catch { return { skip: true, detail: 'git ls-files unavailable' }; }

    const LITERAL = /(?:service[_-]?role[_-]?key|secret|api[_-]?key)\s*[:=]\s*["'`](eyJ[A-Za-z0-9_.-]{20,}|sb_secret_[A-Za-z0-9_-]{10,})["'`]/i;
    const BARE    = /["'`](eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|sb_secret_[A-Za-z0-9_-]{16,})["'`]/;
    const hits = [];
    for (const f of files) {
      if (/\.(png|jpg|jpeg|gif|webp|ico|woff2?|ttf|mp4|pdf)$/i.test(f)) continue;
      let txt = '';
      try { txt = readFileSync(join(ROOT, f), 'utf8'); } catch { continue; }
      if (LITERAL.test(txt) || BARE.test(txt)) hits.push(f);
    }
    return hits.length === 0
      ? { ok: true, detail: files.length + ' tracked files, no key literal' }
      : { ok: false, detail: hits.join(', ') };
  });

/* ---- 3 · NO PASSWORDS -------------------------------------------- */
G('se-m3 · the platform stores no password');
if (!JSON_OUT) console.log('\n\x1b[1m  se-m3 · passwords\x1b[0m');

await check('PW-COL', 'no password-shaped column exists in our schema',
  'any table in 01_tables_rls.sql declares a password, hash, secret or token column',
  () => {
    const sql = readFileSync(join(ROOT, '03-security', 'db', '01_tables_rls.sql'), 'utf8');
    const bad = sql.split('\n').filter(l =>
      /^\s*(password|passwd|pwd|pass_hash|password_hash|secret|api_key|token)\s/i.test(l));
    return bad.length === 0 ? { ok: true, detail: 'no such column declared' }
                            : { ok: false, detail: bad.join(' | ') };
  });

await check('PW-AUTH', 'anon cannot reach the auth schema',
  'auth.users is readable over the REST API',
  async () => {
    const r = await anonGet('users?select=*&limit=1');
    return refused(r) ? { ok: true, detail: `HTTP ${r.status}` }
                      : { ok: false, detail: `HTTP ${r.status}: ${r.body}` };
  });

/* ---- 4 · TRANSPORT AND HEADERS ----------------------------------- */
G('se-m4 · HTTPS and response headers');
if (!JSON_OUT) console.log('\n\x1b[1m  se-m4 · transport\x1b[0m');

const HDRS = [
  ['HD-HSTS', 'strict-transport-security', /max-age=\d{7,}/, 'HSTS missing or shorter than ~4 months'],
  ['HD-NOSN', 'x-content-type-options',    /nosniff/i,        'the browser is allowed to guess content types'],
  ['HD-REF',  'referrer-policy',           /strict-origin|no-referrer/i, 'full URLs leak to third parties'],
  ['HD-FRM',  'x-frame-options',           /DENY|SAMEORIGIN/i, 'the site can be framed — clickjacking'],
  ['HD-PERM', 'permissions-policy',        /camera=\(\)/i,     'camera, microphone and geolocation are not denied'],
];
for (const [id, name, re, fails] of HDRS) {
  await check(id, `response header \`${name}\``, fails, async () => {
    const h = await headers();
    const v = h[name];
    if (!v) return { ok: false, detail: 'header absent' };
    return re.test(v) ? { ok: true, detail: v.slice(0, 60) }
                      : { ok: false, detail: `present but unexpected: ${v.slice(0, 80)}` };
  });
}

await check('HD-CSP', 'Content-Security-Policy locks the dangerous directives',
  'frame-ancestors, object-src or base-uri is missing or permissive',
  async () => {
    const h = await headers();
    const csp = h['content-security-policy'];
    if (!csp) return { ok: false, detail: 'no CSP' };
    const must = [
      [/frame-ancestors\s+'none'/, "frame-ancestors 'none'"],
      [/object-src\s+'none'/,      "object-src 'none'"],
      [/base-uri\s+'none'/,        "base-uri 'none'"],
      [/form-action\s+'self'/,     "form-action 'self'"],
      [/default-src\s+'self'/,     "default-src 'self'"],
    ];
    const missing = must.filter(([re]) => !re.test(csp)).map(([, n]) => n);
    return missing.length === 0
      ? { ok: true, detail: 'all five directives present' }
      : { ok: false, detail: `missing: ${missing.join(', ')}` };
  });

await check('HD-CSPI', 'the CSP inline-script exception is declared, not silent',
  "script-src allows 'unsafe-inline' with no written trade-off document",
  async () => {
    const h = await headers();
    const csp = h['content-security-policy'] || '';
    const doc = join(ROOT, '03-security', 'docs', 'CSP-TRADEOFF.md');
    if (!/script-src[^;]*'unsafe-inline'/.test(csp)) return { ok: true, detail: "script-src has no 'unsafe-inline'" };
    return existsSync(doc)
      ? { ok: true, detail: "'unsafe-inline' present and documented in CSP-TRADEOFF.md" }
      : { ok: false, detail: "'unsafe-inline' present with NO trade-off document" };
  });

await check('HD-HTTP', 'plain HTTP does not serve the site',
  'http:// returns 200 instead of redirecting to https',
  async () => {
    try {
      const res = await fetch(SITE.replace('https://', 'http://'), { redirect: 'manual' });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location') || '';
        return /^https:/.test(loc) ? { ok: true, detail: `${res.status} -> ${loc.slice(0, 50)}` }
                                   : { ok: false, detail: `${res.status} -> ${loc}` };
      }
      return { ok: false, detail: `HTTP answered ${res.status} without redirecting` };
    } catch (e) { return { ok: true, detail: 'plain HTTP refused outright' }; }
  });

/* ---- 5 · VALIDATION AND THE WRITE PATH --------------------------- */
G('se-m5 · validation and the human checkpoint');
if (!JSON_OUT) console.log('\n\x1b[1m  se-m5 · validation\x1b[0m');

await check('VA-CONS', 'every researcher input has a database constraint',
  'a CHECK named in 06_validation.sql goes missing from the repo',
  () => {
    const sql = readFileSync(join(ROOT, '03-security', 'db', '06_validation.sql'), 'utf8');
    const want = ['missions_area_shape', 'missions_area_size', 'kuwait_area_ok'];
    const missing = want.filter(w => !sql.includes(w));
    return missing.length === 0 ? { ok: true, detail: want.join(', ') }
                                : { ok: false, detail: `missing: ${missing.join(', ')}` };
  });

await check('VA-ERRS', 'every database error message is mapped for the researcher',
  'the SQL raises a sentence the page has no allowlist entry for — the researcher sees a generic line',
  () => {
    const dbDir = join(ROOT, '03-security', 'db');
    const raises = new Set();
    for (const f of readdirSync(dbDir).filter(f => f.endsWith('.sql'))) {
      const txt = readFileSync(join(dbDir, f), 'utf8');
      for (const line of txt.split('\n')) {
        if (/^\s*--/.test(line)) continue;                    /* commented-out SQL */
        const m = line.match(/raise exception '([^']+)'/);
        if (m) raises.add(m[1]);
      }
    }
    const wf = readFileSync(join(ROOT, 'js', 'ksat-workflow.js'), 'utf8');
    const safeBlock = (wf.match(/var SAFE = \[([\s\S]*?)\];/) || [])[1] || '';
    const pats = [...safeBlock.matchAll(/\/\^(.+?)\$\//g)].map(m => {
      try { return new RegExp('^' + m[1] + '$'); } catch { return null; }
    }).filter(Boolean);

    /* Only browser-reachable functions matter. service_role-only and the
       PHASE2 admin file are not surfaced to a researcher. */
    const notBrowser = /Unknown run\.|Idle minutes|Admin read limit|State a reason|Unknown role\.|That researcher cannot be added\.|You already own this mission\./;
    const unmapped = [...raises]
      .filter(r => !notBrowser.test(r))
      .filter(r => !pats.some(p => p.test(r.replace(/%/g, '5'))));
    return unmapped.length === 0
      ? { ok: true, detail: `${raises.size} messages, all browser-facing ones mapped` }
      : { ok: false, detail: `unmapped: ${unmapped.join(' | ')}` };
  });

await check('VA-CKPT', 'the agent cannot approve its own report',
  'generate_report appears in a grant to service_role — an unattended pipeline could sign its own conclusion',
  () => {
    const sql = readFileSync(join(ROOT, '03-security', 'db', '05_views_rpc.sql'), 'utf8');
    const active = sql.split('\n').filter(l => !/^\s*--/.test(l)).join('\n');
    const bad = /grant\s+execute\s+on\s+function\s+public\.generate_report[^;]*to[^;]*service_role/i.test(active);
    const good = /grant\s+execute\s+on\s+function\s+public\.generate_report\(uuid,text\)\s+to\s+authenticated/i.test(active);
    if (bad) return { ok: false, detail: 'generate_report IS granted to service_role' };
    return good ? { ok: true, detail: 'authenticated only; service_role has no grant' }
                : { ok: false, detail: 'no grant to authenticated found — check 05_views_rpc.sql' };
  });

/* ---- 6 · THE AUDIT FIXES ARE REPRODUCIBLE ------------------------ */
G('se-m6 · the AI security audit, and its fixes in the files');
if (!JSON_OUT) console.log('\n\x1b[1m  se-m6 · audit\x1b[0m');

await check('AU-REPRO', 'every Advisor fix is in the SQL, not only on the live database',
  'a fix exists only in the dashboard, so rebuilding from 03-security/db reopens the hole',
  () => {
    const f = join(ROOT, '03-security', 'db', '10_advisor_fixes.sql');
    if (!existsSync(f)) return { ok: false, detail: '10_advisor_fixes.sql is missing' };
    const sql = readFileSync(f, 'utf8');
    const want = ['missions_guard', 'rls_auto_enable', 'kuwait_area_ok'];
    const missing = want.filter(w => !sql.includes(w));
    return missing.length === 0 ? { ok: true, detail: `${want.length} fixes reproducible` }
                                : { ok: false, detail: `not in the file: ${missing.join(', ')}` };
  });

await check('AU-TOOLS', 'the approved-tool register matches the tools actually called',
  'the agent calls a tool the register does not declare, or declares one that never runs',
  () => {
    const integ = readFileSync(join(ROOT, 'js', 'ksat-integration.js'), 'utf8');
    const declared = new Set([...integ.matchAll(/^\s*'([a-z_]+\.[a-z_]+)':/gm)].map(m => m[1]));
    const used = new Set([...integ.matchAll(/^\s*\w+:\s*'([a-z_]+\.[a-z_]+)'/gm)].map(m => m[1]));
    const wf = readFileSync(join(ROOT, 'js', 'ksat-workflow.js'), 'utf8');
    for (const m of wf.matchAll(/logStepAs\('[a-z_]+',\s*'([a-z_.]+)'/g)) used.add(m[1]);
    const undeclared = [...used].filter(t => !declared.has(t));
    const unused     = [...declared].filter(t => !used.has(t));
    if (undeclared.length || unused.length) {
      return { ok: false, detail: `undeclared: ${undeclared.join(', ') || 'none'} · never called: ${unused.join(', ') || 'none'}` };
    }
    return { ok: true, detail: `${declared.size} declared, ${used.size} in use, exact match` };
  });

/* ---- 7 · THE PAGE ITSELF ----------------------------------------- */
G('integrity · the product still is what it was');
if (!JSON_OUT) console.log('\n\x1b[1m  integrity · the page\x1b[0m');

/* =====================================================================
   THE DECISION OF 22 SEPTEMBER 2026, AND WHY THESE FOUR CHECKS REPLACED
   THREE OTHERS. Read this before changing anything below it.

   Until today this section held PG-STRUCT, PG-MARKUP and PG-NUM. All
   three compared index.html against the frozen site-original/index.html
   and failed on any difference: a tag census, a tag-by-tag sequence
   comparison, and a numeric-literal sequence comparison. They rested on
   one invariant — index.html is the original page plus an integration
   layer, and nothing else.

   THAT INVARIANT IS OVER. It did not erode; it ended on a decision. The
   team authorised editing index.html directly: the Meet the Team section
   was removed on instruction, the wording was rewritten because the site
   called itself a demo, and two design passes restyled the artwork. The
   README said somebody had to decide, once the page stopped moving,
   whether to re-baseline site-original/ or narrow the checks. This is
   that decision, and it went the second way.

   WHY NOT RE-BASELINE. Copying today's index.html over
   site-original/index.html would have turned all three green in one
   command, and it would have destroyed the only thing that folder is
   for. site-original/ is the evidence that the original prototype
   existed in a particular state and was held pristine while the platform
   was built around it. Overwrite it and the repo can no longer show what
   the page was, the README's account of the invariant becomes
   unverifiable, and every future drift check compares today against
   today. An archive that is silently rewritten whenever it disagrees
   with the present is not an archive.

   WHAT THE MEASUREMENT SHOWED, before the checks were changed. Run
   against the current page, the old checks reported: svg 23->21,
   img 2->3, path 57->64, tag count 3119->3152, numeric literals
   7254->7477. Read one level down and those numbers say something quite
   different from "the page was damaged":

     - canvas 23->23, table 8->8, button 47->47, input 11->11,
       select 19->19, iframe 1->1, style 5->5. Every data surface and
       every control the original shipped is still there, exactly.
     - Of 259 element ids in the original, 257 still exist. The two that
       do not are `team` and `teamGrid` — the section the team removed on
       purpose.
     - Of 664 distinct numeric values the original published, 662 still
       appear somewhere in the shipped site. The two that do not are
       26.2 and 9.6, and they are the cx/cy of
       `<circle cx="26.2" cy="9.6" r="2.4" fill="#3FD0C9"/>`, a
       decorative dot inside an icon that the design passes redrew in
       three places. That is also the whole of the svg 23->21 and
       path 57->64 movement.

   So the old checks were failing on authorised restyling, and the thing
   they were written to protect — the mission's data, charts, maps and
   controls — is intact. A sequence comparison against a frozen copy
   cannot tell those two cases apart, and once direct editing is
   authorised it will report the authorised case forever.

   WHAT REPLACED THEM. Four checks, each measuring a property that is
   still true and can still fail loudly:

     PG-ORIG  the archive itself is unaltered  (this is what site-original
              is FOR now: evidence, not a baseline)
     PG-KEEP  a FLOOR on the elements that carry data and controls
     PG-HOOK  every id the page's own JavaScript reaches for still exists
     PG-FIG   every distinct figure the original published still appears

   None of them was loosened to go green. PG-KEEP and PG-HOOK are
   stricter than the census they replace in the way that matters — a
   deleted chart or a deleted control fails them instantly — and PG-FIG
   still fails if one published figure disappears. What they no longer do
   is fail when an icon is redrawn or a paragraph is rewritten, which is
   the only thing that has actually happened.

   THE TWO ALLOWLISTS BELOW ARE THE COST OF THIS DECISION, and they are
   deliberately small, named and reasoned. Adding to one is a decision a
   human takes on purpose. If a check ever fails and the easy fix looks
   like appending an entry, that is the check working.
   ===================================================================== */

await check('PG-ORIG', 'the frozen original is still frozen',
  'site-original/index.html differs from the copy this suite recorded — including a re-baseline',
  () => {
    /* WHY THIS CHECK NOW EXISTS. The three checks it replaces all read
       site-original/index.html and none of them checked it. That was
       safe while the folder was only ever read, but the obvious way to
       make those three go green was to overwrite the archive, and
       nothing in the repo would have noticed or said so afterwards.

       Pinning the hash makes re-baselining a visible act rather than a
       quiet one. It does not forbid it: if the team ever genuinely wants
       a new baseline, they change this constant in the same commit and
       the diff shows a reviewer exactly what happened. What they cannot
       do is replace the evidence and have the suite stay green.

       Recorded 22 Sep 2026 from the file as it has stood since the
       original prototype was archived. */
    const EXPECT = 'dd385908b6886289219bc4f0f133ca05fb4c486ac85f04d115edc239eeec17e1';
    const p = join(ROOT, 'site-original', 'index.html');
    if (!existsSync(p)) {
      return { ok: false, detail: 'site-original/index.html is GONE. That folder is the evidence the original page existed; restore it from git history.' };
    }
    const got = createHash('sha256').update(readFileSync(p)).digest('hex');
    return got === EXPECT
      ? { ok: true, detail: 'sha256 ' + got.slice(0, 16) + '… unchanged' }
      : { ok: false, detail: 'archive altered: expected ' + EXPECT.slice(0, 16) + '… got ' + got.slice(0, 16) +
                             '… — if this was a deliberate re-baseline, update EXPECT in this check in the same commit and say why' };
  });

await check('PG-KEEP', 'every data surface and control of the original is still in the page',
  'the page holds FEWER charts, tables, buttons, inputs, selects or embeds than the original did',
  () => {
    /* This is the surviving half of the old PG-STRUCT, and the half that
       was carrying the meaning. The element types are split in two:

       COUNTED AS A FLOOR — canvas, table, button, input, select, iframe,
       style. These carry the mission's data and the visitor's ability to
       act on it. Twenty-three canvases are twenty-three charts and the
       3D orbit surface. Losing one is losing a chart, and no restyling
       pass has a reason to. More than the original is fine and expected:
       the integration layer adds its own.

       NOT COUNTED — svg, path, img. These are artwork. The design passes
       redraw them by definition, and counting them is what made the old
       check fail on work that was asked for. They are not unguarded:
       every figure they contained is still covered by PG-FIG, which is
       how the redrawn icon above was identified in the first place. */
    const a = withoutLayer(readFileSync(join(ROOT, 'site-original', 'index.html'), 'utf8'));
    const b = withoutLayer(readFileSync(join(ROOT, 'index.html'), 'utf8'));
    const FLOOR = ['canvas', 'table', 'button', 'input', 'select', 'iframe', 'style'];
    /* A SURFACE MAY MOVE INTO THE JS LAYER, and that is not a loss - but
       it is only not a loss if the replacement can be SHOWN to exist. So
       this does not simply decrement the floor: for each claim it reads
       the named file and requires that the file really does create an
       element of that type. A claim whose file has been deleted, or which
       never creates the surface it promised, fails as loudly as a plain
       deletion would.

       #cvDescent, 22 Sep: the descent strip drew a downlink cone on a
       canvas in the markup. The team asked for the spacecraft instead, so
       the strip is now a hand-rolled 3D CubeSat whose canvas is created at
       runtime. The surface is still there and carries more than it did;
       it is simply no longer in the HTML. */
    const MOVED_TO_LAYER = {
      canvas: [{
        file: 'js/ksat-cubesat.js',
        was:  '#cvDescent, the downlink-cone canvas in the descent strip',
        now:  'the 3D CubeSat, created at runtime by that file',
        creates: /createElement\(\s*['"]canvas['"]\s*\)/
      }]
    };

    const moved = [];
    const lost = [];
    const census = [];
    for (const t of FLOOR) {
      const re = new RegExp('<' + t + '[\\s>]', 'gi');
      const ca = (a.match(re) || []).length, cb = (b.match(re) || []).length;
      census.push(`${t} ${cb}`);
      let allowance = 0;
      for (const claim of (MOVED_TO_LAYER[t] || [])) {
        let src = '';
        try { src = readFileSync(join(ROOT, claim.file), 'utf8'); } catch { src = ''; }
        if (!src) {
          lost.push(`${t}: ${claim.file} is GONE, and it carried ${claim.was}`);
        } else if (!claim.creates.test(src)) {
          lost.push(`${t}: ${claim.file} no longer creates a ${t} - ${claim.was} has no replacement`);
        } else {
          allowance += 1;
          moved.push(`${claim.was} -> ${claim.now}`);
        }
      }
      if (cb < ca - allowance) lost.push(`${t} ${ca}->${cb}  (${ca - cb - allowance} lost)`);
    }
    return lost.length === 0
      ? { ok: true, detail: census.join(', ') + (moved.length ? ' | moved to the layer: ' + moved.join('; ') : '') }
      : { ok: false, detail: 'REMOVED FROM THE PAGE: ' + lost.join(', ') };
  });

await check('PG-HOOK', 'every id the original page hangs behaviour off still exists',
  'an id present in the original is gone from the page and no reason is recorded, so whatever reached for it is now dead - or one of the ids removed on purpose has come back',
  () => {
    /* WHY IDS RATHER THAN A TAG SEQUENCE. The page's own JavaScript is
       thousands of lines of getElementById and querySelector against
       these ids. A tag sequence comparison notices that markup moved; it
       cannot tell you whether anything broke. A missing id can only mean
       one thing — some handler, chart initialiser or control lookup now
       returns null — and that is a real defect every time, whether the
       edit was authorised or not.

       This is why it is the check that survives direct editing: an
       author is free to rewrite a heading, restyle a card or reorder a
       section, and none of that touches an id. Deleting a component
       does. */
    const REMOVED_ON_PURPOSE = {
      team: 'the capstone Meet the Team section, removed on the team\'s instruction. Never restore it.',
      teamGrid: 'the grid inside that same section.',

      /* THE MINIMAL PUBLIC PAGE, 22 Sep. The team asked for a public face
         "super minimalist ... dont show a lot of details to the outsider",
         and asked that these be DELETED rather than hidden: hidden content
         still ships to every visitor and still reads back out of
         view-source, so hiding would not have answered the ask. git has all
         of it, and site-original/ still holds the page they came from -
         which is how this check can still see that they are gone. */
      builders:    'the whole Team Behind KuwaitSat-1 section - its essay, the supplied-photograph credits and the leads/timeline panels. Deleted on instruction, 22 Sep.',
      photoPlate:  'the team photograph inside #builders. It went with the section: the credit lines went too, and an uncredited supplied photograph is worse than none.',
      tribute:     'the tribute block inside #builders.',
      bltLeads:    'the named-leads panel inside #builders.',
      bltLinks:    'the source chips inside #builders.',
      bltTimeline: 'the project timeline inside #builders.',
      cvDescent:   'the downlink-cone canvas in the descent strip. Replaced by the 3D spacecraft in js/ksat-cubesat.js, which the team asked for in its place; the cone and its three lines of narration went with it.',
      heroReadout: 'the ALT / GSD / SWATH line over the hero Earth, and the ◈ NASA IMAGERY · ORBIT MODELLED line beside it. Deleted on instruction, 22 Sep: the public page opens on the planet and nothing else. Every one of those figures is still in the page - the hero fact strip carries 39 m and 80 km, and the folded mission record carries all twelve entries.',
    };
    const idsOf = t => [...t.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
    const a = new Set(idsOf(readFileSync(join(ROOT, 'site-original', 'index.html'), 'utf8')));
    const b = new Set(idsOf(readFileSync(join(ROOT, 'index.html'), 'utf8')));
    const gone = [...a].filter(x => !b.has(x));
    const unexplained = gone.filter(x => !(x in REMOVED_ON_PURPOSE));
    /* An allowlist entry that has stopped being needed is reported too.
       It means the element came back, and for `team` specifically that
       is a thing the team asked never to happen. */
    const stale = Object.keys(REMOVED_ON_PURPOSE).filter(x => !gone.includes(x));
    if (unexplained.length) {
      return { ok: false, detail: 'id(s) deleted with no reason recorded: ' + unexplained.join(', ') +
                                  ' — find what referenced them before deciding this is harmless' };
    }
    if (stale.length) {
      return { ok: false, detail: 'id(s) back in the page that were removed on purpose: ' + stale.join(', ') +
                                  ' — if `team` is among them, the Meet the Team section has been restored and must not be' };
    }
    return { ok: true, detail: `${a.size - gone.length} of ${a.size} ids intact, ${gone.length} removed on purpose` };
  });

await check('PG-FIG', 'every figure the original published still appears in the page',
  'a numeric value the original page showed is gone from index.html - a data point was deleted, altered or rounded',
  () => {
    /* This is the surviving meaning of PG-NUM. The team's instruction was
       that wording could change and data could not, and that is still
       the rule. What changed is how it is measured.

       The old check compared every numeric literal IN ORDER, so inserting
       one paragraph with a number in it failed the whole check and told
       you only that the count moved from 7254 to 7477. This compares the
       SET of distinct values, which is immune to insertion and to a
       figure being repeated a different number of times, and still fails
       the moment a value stops appearing at all.

       >>> WHY THE CORPUS IS index.html AND NOTHING ELSE <<<
       The first version of this check searched index.html plus every
       file in js/ and css/, on the assumption that the design passes had
       moved real figures out of the markup and into the layer that
       renders them. THAT ASSUMPTION WAS WRONG, and it was caught by
       deliberately corrupting a figure to see whether this check would
       notice: changing 64778 to 64999 throughout index.html left the
       check green, because 64778 also appears in js/ and the widened
       corpus found it there. A check that a copy elsewhere can satisfy
       is not checking the page.

       Measured rather than assumed: against index.html alone, exactly
       two of the original's 664 distinct values are absent, and they are
       the same two the widened corpus reported. Widening bought nothing
       and cost the check its teeth. If a figure ever genuinely does move
       into js/, this fails and says so, and somebody decides in the open
       whether that was intended — which is the right way round.

       A hyphen after a letter is part of a NAME, not a minus sign. The
       first version of the old check read "KuwaitSat-1" as -1. */
    const REDRAWN = {
      '26.2': 'cx of `<circle cx="26.2" cy="9.6" r="2.4" fill="#3FD0C9"/>`, a decorative dot in an icon the design passes redrew in three places. Artwork coordinate, not data.',
      '9.6': 'cy of that same circle.',

      /* Artwork coordinates from drawings that no longer exist, not
         measurements. The hero's Earth was a canvas drawing - a gradient
         with two ellipses standing in for the desert and the Gulf - and is
         now a photograph (assets/earth/, real NASA imagery; provenance in
         assets/earth/CREDITS.txt). The descent strip's downlink cone is now
         the 3D spacecraft. The published FIGURES of the mission - 525 km,
         39 m, 80 km, 2 kg, 3 Jan 2023 - are all still in the page, which is
         what this check exists to protect. */
      '071018': 'a gradient stop hex in drawDescent(), the downlink cone the spacecraft replaced.',
      '081119': 'the other gradient stop of that same cone.',
      '1.88':   'a beam-width coefficient inside drawDescent(). Artwork, not data.',
      '0.96':   'inner radius ratio of the hero limb glow, from the canvas drawing the NASA photograph replaced.',
      '1.16':   'outer radius ratio of that same glow. It still appears in js/ only because another file happens to use the same number.',
      '0.955':  'y-offset of the desert-band ellipse in the drawn Earth. There is no drawn desert band now - the land is the NASA composite.',
      '0.968':  'y-offset of the gulf ellipse in the same drawing.',
      '0.020':  'ry of that gulf ellipse.'
    };
    const nums = t => (t.match(/(?<![\w-])-?\d+(?:\.\d+)?/g) || []);
    const original = new Set(nums(readFileSync(join(ROOT, 'site-original', 'index.html'), 'utf8')));
    const present = new Set(nums(readFileSync(join(ROOT, 'index.html'), 'utf8')));
    const gone = [...original].filter(x => !present.has(x));
    const unexplained = gone.filter(x => !(x in REDRAWN));
    if (unexplained.length) {
      /* Saying WHERE it went, when it went somewhere, is the difference
         between a check that sends someone hunting through 6,000 lines
         and one that hands them the answer. */
      let layer = '';
      for (const d of ['js', 'css']) {
        const dir = join(ROOT, d);
        if (!existsSync(dir)) continue;
        for (const f of readdirSync(dir)) {
          if (!/\.(js|css)$/.test(f)) continue;
          layer += '\n' + readFileSync(join(dir, f), 'utf8');
        }
      }
      const inLayer = new Set(nums(layer));
      const moved = unexplained.filter(x => inLayer.has(x));
      return { ok: false, detail: `${unexplained.length} figure(s) the original published are gone from index.html: ` +
                                  unexplained.slice(0, 12).join(', ') + (unexplained.length > 12 ? ' …' : '') +
                                  (moved.length ? ` · of those, ${moved.join(', ')} now appear in js/ or css/ instead - if that move was deliberate, record it in REDRAWN with the reason` : '') +
                                  ' — each one was on the original page.' };
    }
    return { ok: true, detail: `${original.size - gone.length} of ${original.size} published figures still in the page, ${gone.length} accounted for` };
  });

await check('PG-JS', 'every inline script in the page still parses',
  'an edit broke a string literal and the page would die on load',
  () => {
    const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
    const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
    const tmp = join(ROOT, '.ksat-parse-check.js');
    let bad = 0;
    for (const b of blocks) {
      writeFileSync(tmp, b);
      try { execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' }); }
      catch { bad++; }
    }
    try { execFileSync(process.platform === 'win32' ? 'cmd' : 'rm',
          process.platform === 'win32' ? ['/c', 'del', tmp] : ['-f', tmp], { stdio: 'pipe' }); } catch {}
    return bad === 0 ? { ok: true, detail: `${blocks.length} inline blocks parse` }
                     : { ok: false, detail: `${bad} of ${blocks.length} fail to parse` };
  });

await check('PG-LAYER', 'every file of the integration layer parses',
  'a shipped script has a syntax error and silently does nothing',
  () => {
    const files = ['config.js', 'ksat-integration.js', 'ksat-theme.js', 'ksat-shell.js', 'ksat-workflow.js'];
    const bad = [];
    for (const f of files) {
      try { execFileSync(process.execPath, ['--check', join(ROOT, 'js', f)], { stdio: 'pipe' }); }
      catch { bad.push(f); }
    }
    return bad.length === 0 ? { ok: true, detail: `${files.length} files parse` }
                            : { ok: false, detail: bad.join(', ') };
  });

/* ------------------------------------------------------------------
   The list of shipped assets is READ FROM THE PAGE, not typed here.

   PG-LIVE used to carry a hand-written list of nine files. The page now
   references twenty-seven, because the design passes added
   ksat-assistant, ksat-density, ksat-i18n, ksat-motion, ksat-tour,
   ksat-brand, ksat-nasa, ksat-agency, ksat-detail, ksat-editorial, a
   webmanifest and four favicons. None of those eighteen was checked by
   anything, and the check still reported "9 assets 200" in green — which
   is the failure mode this whole suite exists to avoid. A check that
   silently stops covering the thing it names is worse than no check,
   because it is also a claim.

   Reading the <script src> and <link href> attributes out of index.html
   means the next file somebody adds is covered the moment it is
   referenced, with nobody having to remember this function exists.

   Only same-origin paths are returned. Google Fonts is the one external
   origin the CSP allows and it is not ours to assert anything about.
   ------------------------------------------------------------------ */
function referencedAssets() {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const out = new Set();
  for (const m of html.matchAll(/<script[^>]+src="([^"]+)"/gi)) out.add(m[1]);
  for (const m of html.matchAll(/<link[^>]+href="([^"]+)"/gi)) out.add(m[1]);
  return [...out]
    .filter(u => !/^(https?:)?\/\//.test(u) && !/^(data|mailto|tel|#)/.test(u))
    .map(u => u.replace(/^\.?\//, '').split(/[?#]/)[0])
    .filter(Boolean);
}

await check('PG-FILE', 'every asset the page asks for exists in the repo',
  'index.html references a stylesheet, script or icon that is not in the working tree - a typo or a deleted file',
  () => {
    /* The offline half of PG-LIVE, and the half that catches the bug
       earliest. A mistyped path or a file deleted out from under a
       <link> is a dead asset on every environment, and you do not need
       the internet or a deploy to know it. This runs in milliseconds and
       cannot skip, so it is the one that will actually catch it. */
    const missing = referencedAssets().filter(a => !existsSync(join(ROOT, a)));
    return missing.length === 0
      ? { ok: true, detail: `${referencedAssets().length} referenced assets all present on disk` }
      : { ok: false, detail: 'referenced but not in the repo: ' + missing.join(', ') };
  });

await check('PG-LIVE', 'every asset that has been committed is actually served',
  'an asset that IS in the last commit 404s in production, so the layer is dead on the live site',
  async () => {
    /* WHY THIS ONLY CHECKS COMMITTED FILES.
       Nine of the twenty-seven referenced assets currently 404 in
       production: ksat-appearance.js, ksat-tour.js, ksat-brand.css,
       ksat-tour.css, ksat-nasa.css, site.webmanifest and four favicons
       under assets/brand/. Every one of them exists on disk and none of
       them is in HEAD. They 404 because they have never been committed,
       so no deploy could have carried them - which is a fact about the
       team's git state on 22 Sep 2026 and not a fault in the site.

       Failing on those would make this check red for a reason it is not
       about, and a check that is red for the wrong reason gets ignored
       and then deleted. Passing on them would be a lie. So they are
       counted and named as PENDING, and the moment somebody commits and
       deploys them they enter this check automatically with no edit
       here.

       What still fails loudly, and is the thing this check is for: a
       file that IS in the last commit and does not serve. That means the
       deploy is broken, the path is wrong, or .vercelignore is eating
       it - and the layer is dead for real visitors. */
    const assets = referencedAssets();

    let haveGit = true;
    try { execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, stdio: 'pipe' }); }
    catch { haveGit = false; }
    const committed = (p) => {
      if (!haveGit) return true;
      try { execFileSync('git', ['cat-file', '-e', 'HEAD:' + p], { cwd: ROOT, stdio: 'pipe' }); return true; }
      catch { return false; }
    };

    const live = assets.filter(committed);
    const pending = assets.filter(a => !committed(a));

    /* One retry per asset. A run on 21 Sep reported the whole check as
       `fetch failed` after thirty-odd earlier requests in the same
       process; every asset answered 200 when probed on its own moments
       later. That is a transport hiccup, not a 404, and re-running the
       suite to find out is exactly the habit that makes people stop
       believing a red line. */
    const probe = async (url) => {
      for (let attempt = 0; attempt < 2; attempt++) {
        try { return { status: (await fetch(url, { method: 'HEAD' })).status }; }
        catch (e) { if (attempt === 1) return { error: e.message }; }
      }
    };

    /* If the origin itself cannot be reached, nothing below is testable.
       That is a SKIP and never a tick - the rule this file opens with. */
    const origin = await probe(SITE);
    if (origin.error) {
      return { skip: true, detail: `${SITE} is unreachable from here (${origin.error}) - the site was not tested` };
    }

    const bad = [], unreachable = [];
    for (const a of live) {
      const r = await probe(`${SITE}/${a}`);
      if (r.error) unreachable.push(`${a} (${r.error})`);
      else if (r.status !== 200) bad.push(`${a}=${r.status}`);
    }

    const tail = pending.length
      ? ` · ${pending.length} not committed yet, so not testable: ${pending.join(', ')}`
      : '';
    if (bad.length) {
      return { ok: false, detail: 'COMMITTED BUT NOT SERVED: ' + bad.join(', ') + tail };
    }
    if (unreachable.length) {
      return { skip: true, detail: 'network gave out mid-run: ' + unreachable.join(', ') + tail };
    }
    if (!haveGit) {
      return { ok: true, detail: `${live.length} referenced assets 200 (git not available here, so every asset was probed)` };
    }
    return { ok: true, detail: `${live.length} committed assets 200${tail}` };
  });

/* ------------------------------------------------------------------ */
/* summary                                                             */
/* ------------------------------------------------------------------ */
const pass = results.filter(r => r.status === 'PASS').length;
const fail = results.filter(r => r.status === 'FAIL').length;
const skip = results.filter(r => r.status === 'SKIP').length;

if (JSON_OUT) {
  console.log(JSON.stringify({ site: SITE, db: CFG.url, pass, fail, skip, results }, null, 2));
} else {
  console.log('\n' + '─'.repeat(64));
  console.log(`  \x1b[32m${pass} passed\x1b[0m` +
              (fail ? `   \x1b[31m${fail} FAILED\x1b[0m` : '   0 failed') +
              (skip ? `   \x1b[33m${skip} skipped\x1b[0m` : ''));
  if (fail) {
    console.log('\n  Failures:');
    for (const r of results.filter(r => r.status === 'FAIL')) {
      console.log(`    ✘ ${r.id}  ${r.title}`);
      console.log(`       fails when: ${r.failsWhen}`);
      console.log(`       observed  : ${r.detail}`);
    }
  }
  console.log('─'.repeat(64) + '\n');
}
process.exit(fail ? 1 : 0);
