/* =====================================================================
   BUILD THE ONE FILE YOU PASTE INTO n8n.
   Owner: 04 · Automation and agents (Dana)

     node 04-agents/tools/bundle.js

   Writes 04-agents/n8n/agent-code-node.js from agent/decision.js,
   agent/steps.js and agent/run.js, in that order, plus the tail that
   turns the plan into n8n items.

   THIS IS THE FALLBACK, NOT THE BUILD. The workflow we are building is
   n8n/workflow.json (22 nodes, built by tools/build-workflow.js, written
   up in n8n/BUILD-GUIDE.md), where the run is broken at the decision so
   the gate is a node you can point at. This bundle plans a whole run in
   ONE Code node instead. Keep it for the evening the import fails and
   you have to paste something into a fresh canvas - it is the same
   decision code either way.

   WHY. An n8n Code node cannot require a local file. Without this, the
   threshold would be typed a second time inside n8n, the two copies
   would drift, and "where does the number live" would have two answers.
   NEVER edit n8n/agent-code-node.js by hand. Edit agent/decision.js and
   run this.
   ===================================================================== */

var fs = require('fs');
var path = require('path');

var root = path.join(__dirname, '..');
var out = path.join(root, 'n8n', 'agent-code-node.js');

var parts = ['agent/decision.js', 'agent/steps.js', 'agent/run.js'];

var header = [
  '/* ===================================================================',
  '   GENERATED FILE - DO NOT EDIT.',
  '   Built by 04-agents/tools/bundle.js from:',
  '     ' + parts.join('\n     '),
  '   Rebuild:  node 04-agents/tools/bundle.js',
  '',
  '   Paste the whole file into the n8n Code node named "Plan the run".',
  '   The threshold it uses is the one in agent/decision.js. There is no',
  '   second copy of that number anywhere.',
  '   =================================================================== */',
  ''
].join('\n');

var tail = [
  '',
  '/* ---- n8n tail -------------------------------------------------------',
  '   Input item:  { run_id, objective, zones }',
  '   Output:      one item per database call, in order, each shaped',
  '                { rpc: "agent_log_step" | "agent_write_result" |',
  '                       "agent_finish_run", args: { ... } }',
  '',
  '   The next node POSTs each item to',
  '     {{$env.SUPABASE_URL}}/rest/v1/rpc/{{ $json.rpc }}',
  '   with {{ $json.args }} as the body. Three function names, no table',
  '   URL, ever. See n8n/BUILD-GUIDE.md.',
  '   ------------------------------------------------------------------ */',
  'const __g = globalThis;',
  'const __in = $json;',
  'const __plan = __g.AgentRun.planRun({',
  '  runId: __in.run_id,',
  '  objective: __in.objective,',
  '  zones: __in.zones || []',
  '});',
  'return __plan.calls.map(function (c) { return { json: c }; });',
  ''
].join('\n');

var body = parts.map(function (rel) {
  return '\n/* ===== ' + rel + ' ===== */\n' + fs.readFileSync(path.join(root, rel), 'utf8');
}).join('\n');

fs.writeFileSync(out, header + body + tail, 'utf8');
console.log('wrote ' + path.relative(process.cwd(), out) + '  (' +
            fs.statSync(out).size + ' bytes)');
