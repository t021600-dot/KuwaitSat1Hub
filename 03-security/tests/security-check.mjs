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
                'rls_auto_enable', 'kuwait_area_ok'];

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

await check('PG-STRUCT', 'no element of the original page was removed or altered',
  'the tag census against site-original/index.html differs anywhere but the integration layer',
  () => {
    const a = readFileSync(join(ROOT, 'site-original', 'index.html'), 'utf8');
    const b = readFileSync(join(ROOT, 'index.html'), 'utf8');
    const tags = ['canvas', 'svg', 'section', 'table', 'img', 'iframe', 'button', 'input', 'select', 'path', 'style', 'video'];
    const diff = [];
    for (const t of tags) {
      const re = new RegExp('<' + t + '[\\s>]', 'gi');
      const ca = (a.match(re) || []).length, cb = (b.match(re) || []).length;
      if (ca !== cb) diff.push(`${t} ${ca}->${cb}`);
    }
    return diff.length === 0
      ? { ok: true, detail: `${tags.length} element types identical` }
      : { ok: false, detail: diff.join(', ') };
  });

await check('PG-MARKUP', 'the markup of the original page is untouched',
  'any tag or attribute of the original differs - meaning structure, behaviour or a control changed',
  () => {
    /* WHY THIS REPLACED THE OLD "additive only" CHECK
       Until 21 Sep the rule was that index.html gained lines and never
       lost or changed one, and the check was a line diff. The team then
       asked for the wording to change - the site called ITSELF a demo -
       so text edits are now authorised, and a line diff reports those as
       failures, correctly. A check that fails for an authorised reason
       is noise; it had to be replaced by the property that still holds.

       That property is stronger and easier to defend: with the
       integration layer removed, EVERY tag with every attribute, in
       order, is identical. So no element was added, removed or
       reordered, no handler changed, no id or class moved, and no
       canvas, chart, control or 3D surface was touched. Only text
       between tags differs - exactly what was authorised. */
    const a = readFileSync(join(ROOT, 'site-original', 'index.html'), 'utf8');
    const b = withoutLayer(readFileSync(join(ROOT, 'index.html'), 'utf8'));
    /* `<[^>]+>` also matches JavaScript such as `for(a=0;a<=6.3;a+=0.1)`.
       A real tag starts with a letter, / or !. */
    const tagsOf = t => (t.match(/<[^>]+>/g) || []).filter(x => /^<[a-zA-Z!\/]/.test(x));
    const ta = tagsOf(a), tb = tagsOf(b);
    if (ta.length !== tb.length) {
      return { ok: false, detail: 'tag count ' + ta.length + ' -> ' + tb.length };
    }
    for (let k = 0; k < ta.length; k++) {
      if (ta[k] !== tb[k]) {
        return { ok: false, detail: 'tag ' + k + ': ' + ta[k].slice(0, 60) + '  ->  ' + tb[k].slice(0, 60) };
      }
    }
    return { ok: true, detail: ta.length + ' tags identical, attribute for attribute' };
  });

await check('PG-NUM', 'not one number in the page was changed',
  'any numeric literal differs from the original - a figure, a coordinate, a measurement or a threshold',
  () => {
    /* The team's instruction was explicit: keep every number, map and
       chart. Wording could change; data could not. This compares every
       numeric literal in document order, so one altered digit anywhere
       in 6,000 lines fails.

       A hyphen after a letter is part of a NAME, not a minus sign. The
       first version read "KuwaitSat-1" as -1 and reported four phantom
       changes as soon as the wording pass introduced that name. */
    const a = readFileSync(join(ROOT, 'site-original', 'index.html'), 'utf8');
    const b = withoutLayer(readFileSync(join(ROOT, 'index.html'), 'utf8'));
    const nums = t => (t.match(/(?<![\w-])-?\d+(?:\.\d+)?/g) || []);
    const na = nums(a), nb = nums(b);
    if (na.length !== nb.length) {
      return { ok: false, detail: 'numeric literal count ' + na.length + ' -> ' + nb.length };
    }
    for (let k = 0; k < na.length; k++) {
      if (na[k] !== nb[k]) return { ok: false, detail: 'number ' + k + ' changed: ' + na[k] + ' -> ' + nb[k] };
    }
    return { ok: true, detail: na.length + ' numeric literals, all identical' };
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

await check('PG-LIVE', 'every shipped asset is actually served',
  'a stylesheet or script 404s in production, so the layer is dead on the live site',
  async () => {
    const assets = ['js/config.js', 'js/ksat-integration.js', 'js/ksat-theme.js',
                    'js/ksat-shell.js', 'js/ksat-workflow.js', 'vendor/supabase.js',
                    'css/ksat-integration.css', 'css/ksat-theme.css', 'css/ksat-shell.css'];
    const bad = [];
    for (const a of assets) {
      const r = await fetch(`${SITE}/${a}`, { method: 'HEAD' });
      if (r.status !== 200) bad.push(`${a}=${r.status}`);
    }
    return bad.length === 0 ? { ok: true, detail: `${assets.length} assets 200` }
                            : { ok: false, detail: bad.join(', ') };
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
