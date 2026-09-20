/* =====================================================================
   BUILD THE FILE YOU IMPORT INTO n8n.
   Owner: 04 · Automation and agents (Dana)

       node 04-agents/tools/build-workflow.js

   Reads  n8n/workflow.template.js
          agent/decision.js  agent/steps.js  agent/run.js  n8n/phases.js
   Writes n8n/workflow.json

   An n8n Code node cannot require a local file, so the agent logic has
   to travel inside the node. Generating it means the threshold is still
   written once - in agent/decision.js - instead of being typed a second
   time into a text box on somebody's laptop, where nobody can diff it.

   The builder also refuses to write a file that contains a secret, a
   table URL, or a second copy of the threshold. It is the last gate
   before something leaves this repo and goes onto the internet.
   ===================================================================== */

var fs = require('fs');
var path = require('path');

var root = path.join(__dirname, '..');
var outFile = path.join(root, 'n8n', 'workflow.json');

var PARTS = ['agent/decision.js', 'agent/steps.js', 'agent/run.js', 'n8n/phases.js'];

var bundle = [
  '/* ===================================================================',
  '   GENERATED - DO NOT EDIT THIS NODE BY HAND.',
  '   Built by 04-agents/tools/build-workflow.js from:',
  '     ' + PARTS.join('\n     '),
  '   Rebuild:  node 04-agents/tools/build-workflow.js',
  '   The threshold this node uses is IMPACT_FLOOR_C in agent/decision.js.',
  '   There is no second copy of that number anywhere.',
  '   =================================================================== */'
].join('\n') + '\n' + PARTS.map(function (rel) {
  return '\n/* ===== ' + rel + ' ===== */\n' + fs.readFileSync(path.join(root, rel), 'utf8');
}).join('\n');

var wf = require(path.join(root, 'n8n', 'workflow.template.js'));

var injected = 0;
wf.nodes.forEach(function (n) {
  if (n.parameters && typeof n.parameters.jsCode === 'string' &&
      n.parameters.jsCode.indexOf('//__AGENT_BUNDLE__') !== -1) {
    n.parameters.jsCode = n.parameters.jsCode.replace('//__AGENT_BUNDLE__', bundle);
    injected++;
  }
});

var json = JSON.stringify(wf, null, 2);

/* ------------------------------------------------------------------
   THE THREE REFUSALS. Each one is a real mistake that would otherwise
   be found by a judge reading the file, or not at all.
   ------------------------------------------------------------------ */
var problems = [];

/* 1 · a key. Supabase keys are JWTs and start with eyJ; the newer
   secret keys start with sb_secret_. Neither belongs in a repo. */
if (/eyJ[A-Za-z0-9_-]{10,}/.test(json) || /sb_secret_/.test(json)) {
  problems.push('A key is embedded in the workflow. It must live ONLY in the n8n ' +
                'credential store. Remove it, and rotate it - it is in git history now.');
}

/* 2 · a table URL on a node that actually calls one. service_role has
   no table privileges (03_grants.sql), so /rest/v1/<table> returns 401
   and the run dies halfway, which looks exactly like "the database is
   broken". Only the URL FIELDS are checked - the agent files talk about
   table URLs in their comments, on purpose, to say never to use one. */
wf.nodes.forEach(function (n) {
  var url = n.parameters && n.parameters.url;
  if (typeof url !== 'string') { return; }
  if (url.indexOf('/rest/v1/') !== -1 && url.indexOf('/rest/v1/rpc/') === -1) {
    problems.push('Node "' + n.name + '" calls a table URL: ' + url +
                  '. n8n may call /rest/v1/rpc/<function> and nothing else.');
  }
});

/* 2b · a Code node making its own HTTP call. It would work, and it
   would hide a database write from the canvas - so the failure plan for
   that call is not on the diagram, and neither is the call. */
wf.nodes.forEach(function (n) {
  var js = n.parameters && n.parameters.jsCode;
  if (typeof js !== 'string') { return; }
  var tail = js.split('/* ===== n8n/phases.js ===== */').pop();
  if (/helpers\.httpRequest|fetch\s*\(|axios/.test(tail)) {
    problems.push('Code node "' + n.name + '" makes its own HTTP call. Every ' +
                  'database call belongs on an HTTP Request node, where it is ' +
                  'visible on the canvas and has a failure plan.');
  }
});

/* 3 · the threshold, typed twice. */
var floorDefs = (bundle.match(/var IMPACT_FLOOR_C\s*=/g) || []).length;
if (floorDefs !== 1) {
  problems.push('IMPACT_FLOOR_C is defined ' + floorDefs + ' times in the bundle. ' +
                'It must be defined exactly once, in agent/decision.js.');
}

if (problems.length) {
  console.error('\nREFUSED - nothing was written:\n');
  problems.forEach(function (p, i) { console.error('  ' + (i + 1) + '. ' + p + '\n'); });
  process.exit(1);
}

fs.writeFileSync(outFile, json, 'utf8');

console.log('wrote ' + path.relative(process.cwd(), outFile));
console.log('  nodes:            ' + wf.nodes.length);
console.log('  code nodes built: ' + injected);
console.log('  size:             ' + Math.round(fs.statSync(outFile).size / 1024) + ' KB');
console.log('  checks passed:    no key, no table URL, one threshold');
console.log('\nNext: n8n -> Workflows -> Import from File -> this file.');
console.log('Then edit ONE field: supabase_url in the "Demo controls" node,');
console.log('and pick the credential in each HTTP node. See n8n/BUILD-GUIDE.md.');
