/* =====================================================================
   THE WORKFLOW, AS A FILE.
   Owner: 04 · Automation and agents (Dana)

   This is the source of n8n/workflow.json, the file you import into n8n.
   Build it with:

       node 04-agents/tools/build-workflow.js

   The builder replaces the line //__AGENT_BUNDLE__ inside every Code
   node with agent/decision.js + agent/steps.js + agent/run.js +
   n8n/phases.js, concatenated. An n8n Code node cannot require a local
   file, so the logic has to travel inside the node - but it is generated
   from the repo files, never typed into n8n by hand, so the threshold
   still lives in exactly one place (agent/decision.js).

   NEVER EDIT n8n/workflow.json. Edit this file, or the agent files, and
   rebuild. If you edit the JSON, the number exists twice and "where does
   the threshold live" stops having one answer.

   WHAT IS NOT IN HERE, ON PURPOSE:
     · no key, no token, no Authorization header value  (credential store)
     · no webhook, no URL that starts a run              (DECISIONS D-1)
     · no /rest/v1/<table> URL                           (03_grants.sql)
   The Supabase project URL IS in here, as a placeholder, because it is
   public - it is already in the front end's config. The KEY is the
   secret, and it never leaves the n8n credential store.
   ===================================================================== */

var BUNDLE = '//__AGENT_BUNDLE__';

/* The one credential, by name. After importing, open each HTTP node once
   and pick it from the dropdown - n8n matches on the id it stored, and
   your id will not be this one. */
var CRED = { httpCustomAuth: { id: 'supabase-service-role', name: 'Supabase service role' } };

/* Every HTTP node has the same two fields. One shape, six nodes, so
   there is one thing to get right instead of six. */
function rpcUrl(fn) {
  return "={{ $('Demo controls').first().json.supabase_url }}/rest/v1/rpc/" + fn;
}
var RPC_FROM_ITEM = rpcUrl("{{ $json.rpc }}");

function http(name, url, jsonBody, pos, extra) {
  var node = {
    parameters: {
      method: 'POST',
      url: url,
      authentication: 'genericCredentialType',
      genericAuthType: 'httpCustomAuth',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: jsonBody,
      options: {}
    },
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name: name,
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: pos,
    credentials: CRED
  };
  Object.keys(extra || {}).forEach(function (k) { node[k] = extra[k]; });
  return node;
}

function code(name, jsCode, pos) {
  return {
    parameters: { jsCode: jsCode },
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name: name,
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: pos
  };
}

function ifNode(name, condition, pos) {
  return {
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [condition],
        combinator: 'and'
      },
      looseTypeValidation: true,
      options: {}
    },
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name: name,
    type: 'n8n-nodes-base.if',
    typeVersion: 2.2,
    position: pos,
    executeOnce: true
  };
}

function sticky(content, pos, size, color) {
  return {
    parameters: { content: content, height: size[1], width: size[0], color: color },
    id: 'sticky-' + pos[0] + '-' + pos[1],
    name: 'Sticky Note ' + pos[0] + ',' + pos[1],
    type: 'n8n-nodes-base.stickyNote',
    typeVersion: 1,
    position: pos
  };
}

/* ------------------------------------------------------------------
   THE CODE NODE TAILS.

   Each one is three lines of glue: read the context, call one pure
   function from n8n/phases.js, hand n8n one item per database call.
   Every item carries the same ctx, so the next node can still reach the
   run id after an HTTP node has replaced the item with a database
   response.
   ------------------------------------------------------------------ */

var TAIL_PREPARE = [
  BUNDLE, '',
  "/* ---- node 7 · Prepare the run ------------------------------------",
  "   In:  the claimed run.        Out: two agent_log_step calls.",
  "   ----------------------------------------------------------------- */",
  "const claim = $('Claim a queued run').first().json;",
  "const out = AgentPhases.phaseObserve({",
  "  run_id:       claim.run_id,",
  "  objective:    claim.objective,",
  "  area_geojson: claim.area_geojson",
  "});",
  "return out.calls.map(c => ({ json: { rpc: c.rpc, args: c.args, ctx: out.ctx } }));"
].join('\n');

var TAIL_RANK = [
  BUNDLE, '',
  "/* ---- node 9 · Rank and project -----------------------------------",
  "   THE NODE THE BACKWARDS ARROW RETURNS TO.",
  "   The rejected list is read back off the LAST run of 'Reject the",
  "   zone'. On the first pass that node has never run, $() throws, and",
  "   the catch gives us an empty list. That is the whole of the loop's",
  "   memory - there is no other state anywhere in the workflow.",
  "   ----------------------------------------------------------------- */",
  "const prep = $('Prepare the run').first().json.ctx;",
  "if (prep.stop) { return []; }   // the area was refused; the run is already closed",
  "",
  "let rejected = [];",
  "try { rejected = $('Reject the zone').first().json.ctx.rejected_ids || []; }",
  "catch (e) { rejected = []; }",
  "",
  "const out = AgentPhases.phaseRankAndProject({",
  "  run_id: prep.run_id, zones: prep.zones, rejected_ids: rejected",
  "});",
  "return out.calls.map(c => ({ json: { rpc: c.rpc, args: c.args, ctx: out.ctx } }));"
].join('\n');

var TAIL_DELIVER = [
  BUNDLE, '',
  "/* ---- node 12 · Deliver findings · THE TRUE BRANCH -----------------",
  "   Writes the zones that cleared the floor, then logs steps 5 and 6.",
  "   break_visualization comes from the Demo controls node, never from",
  "   this code, so the deliberate failure cannot be left behind in a",
  "   file after Thursday.",
  "   ----------------------------------------------------------------- */",
  "const gate = $('Rank and project').first().json.ctx;",
  "const prep = $('Prepare the run').first().json.ctx;",
  "const ctl  = $('Demo controls').first().json;",
  "const out = AgentPhases.phaseDeliver({",
  "  run_id: gate.run_id, zones: gate.zones, rejected_ids: gate.rejected_ids,",
  "  // carried from node 7. When the objective contained an instruction",
  "  // the DRAFT leads with what was refused, because the person pressing",
  "  // Approve has to read it before the finding, not after it.",
  "  refusalNotice: prep.refusal_notice,",
  "  breakVisualization: ctl.break_visualization === true",
  "});",
  "return out.calls.map(c => ({ json: { rpc: c.rpc, args: c.args, ctx: out.ctx } }));"
].join('\n');

var TAIL_REJECT = [
  BUNDLE, '',
  "/* ---- node 16 · Reject the zone · THE FALSE BRANCH -----------------",
  "   decide() is asked for the verdict AND for the sentence the",
  "   researcher reads. It goes into agent_steps.refused_reason, which",
  "   the my_agent_steps view exposes - unlike mission_runs.error_note,",
  "   which the browser has no grant on.",
  "   ----------------------------------------------------------------- */",
  "const gate = $('Rank and project').first().json.ctx;",
  "const out = AgentPhases.phaseReject({",
  "  run_id: gate.run_id, zones: gate.zones, rejected_ids: gate.rejected_ids",
  "});",
  "return out.calls.map(c => ({ json: { rpc: c.rpc, args: c.args, ctx: out.ctx } }));"
].join('\n');

/* No bundle in this one: it counts items, it does not decide anything. */
var TAIL_LANDED = [
  "/* ---- node 14 · All writes landed? --------------------------------",
  "   A run says 'complete' only if EVERY write it planned came back",
  "   with a 2xx. If one was refused, its item went out of the error",
  "   output and the failure branch is already closing the run - so this",
  "   node returns nothing and the complete path simply stops.",
  "",
  "   This is the opposite of 'continue on fail'. We do look at the",
  "   error, and we refuse to call a half-written run a finished one.",
  "   ----------------------------------------------------------------- */",
  "const planned = $('Deliver findings').all().length;",
  "const landed  = $input.all().length;",
  "const ctx     = $('Deliver findings').first().json.ctx;",
  "",
  "if (landed < planned) { return []; }",
  "",
  "return [{ json: {",
  "  rpc: 'agent_finish_run',",
  "  args: { p_run_id: ctx.run_id, p_status: 'complete', p_error: null },",
  "  ctx: ctx",
  "} }];"
].join('\n');

var TAIL_EXPLAIN = [
  "/* ---- node 20 · Explain the failure --------------------------------",
  "   Every error output on the canvas lands here. It turns whatever the",
  "   database or the network said into ONE sentence a researcher can",
  "   read, and writes it as a REFUSED STEP - because",
  "   mission_runs.error_note is not granted to the browser, so a reason",
  "   stored only there is a reason nobody ever sees.",
  "   ----------------------------------------------------------------- */",
  "const item = $input.first().json || {};",
  "const err  = item.error || item;",
  "let msg = err.message || err.description ||",
  "          (err.response && (err.response.message || err.response.body &&",
  "           err.response.body.message)) || 'the step did not complete';",
  "if (typeof msg !== 'string') { msg = JSON.stringify(msg); }",
  "const where = (err.node && err.node.name) ? err.node.name : 'the workflow';",
  "const reason = ('The run stopped at ' + where + ': ' + msg).slice(0, 300);",
  "",
  "let ctx = null;",
  "for (const name of ['Deliver findings', 'Reject the zone', 'Rank and project', 'Prepare the run']) {",
  "  try {",
  "    const c = $(name).first().json.ctx;",
  "    if (c && c.run_id) { ctx = c; break; }",
  "  } catch (e) { /* that node never ran in this execution */ }",
  "}",
  "if (!ctx) { return []; }   // nothing was ever claimed; there is no run to close",
  "",
  "return [{ json: {",
  "  rpc: 'agent_log_step',",
  "  args: {",
  "    p_run_id: ctx.run_id,",
  "    p_step: 'reporting',",
  "    p_tool: 'workflow.error',",
  "    p_args: { stopped_at: where },",
  "    p_allowed: false,",
  "    p_refused_reason: reason,",
  "    p_injection: false",
  "  },",
  "  ctx: { run_id: ctx.run_id, reason: reason }",
  "} }];"
].join('\n');

/* ------------------------------------------------------------------
   THE CANVAS
   ------------------------------------------------------------------ */

var X = function (n) { return -260 + n * 220; };
var ROW_MAIN = 300, ROW_FALSE = 560, ROW_ERROR = 820;

var nodes = [

  /* --- 1 · THE TRIGGER --------------------------------------------- */
  {
    parameters: { rule: { interval: [{ field: 'seconds', secondsInterval: 15 }] } },
    id: 'every-15-seconds',
    name: 'Every 15 seconds',
    type: 'n8n-nodes-base.scheduleTrigger',
    typeVersion: 1.2,
    position: [X(0), ROW_MAIN]
  },

  /* --- 2 · THE TWO THINGS YOU EDIT --------------------------------- */
  {
    parameters: {
      assignments: {
        assignments: [
          { id: 'url', name: 'supabase_url', type: 'string',
            value: 'https://YOUR-PROJECT-REF.supabase.co' },
          { id: 'brk', name: 'break_visualization', type: 'boolean', value: false }
        ]
      },
      options: {}
    },
    id: 'demo-controls',
    name: 'Demo controls',
    type: 'n8n-nodes-base.set',
    typeVersion: 3.4,
    position: [X(1), ROW_MAIN],
    notes: 'The project URL is public. The KEY is not, and it is only in the credential.'
  },

  /* --- 3 · SWEEP FIRST ----------------------------------------------
     Option A in 03-security/db/08_agent_claim.sql: the worker sweeps at
     the top of every poll, before it claims. A worker that died mid-run
     cannot call agent_finish_run to say so, and only the database can
     correct that row. Body {} takes the function's own default of three
     minutes - the same number as STALL_MS in app/js/automation.js. */
  http('Sweep stalled runs', rpcUrl('sweep_stalled_runs'), '{}', [X(2), ROW_MAIN], {
    notes: 'Returns how many dead runs it marked stalled. Usually 0.'
  }),

  /* --- 4 · CLAIM ---------------------------------------------------- */
  http('Claim a queued run', rpcUrl('claim_next_run'), '{}', [X(3), ROW_MAIN], {
    alwaysOutputData: true,
    notes: 'Takes no arguments. It claims the oldest queued run with FOR UPDATE SKIP LOCKED.'
  }),

  /* --- 4 · ANYTHING TO DO ------------------------------------------ */
  ifNode('Anything queued?', {
    id: 'has-run',
    leftValue: '={{ $json.run_id }}',
    rightValue: '',
    operator: { type: 'string', operation: 'exists', singleValue: true }
  }, [X(4), ROW_MAIN]),

  /* --- 5 · NOTHING TO DO ------------------------------------------- */
  {
    parameters: {},
    id: 'nothing-to-do',
    name: 'Nothing to do',
    type: 'n8n-nodes-base.noOp',
    typeVersion: 1,
    position: [X(5), ROW_MAIN - 200],
    notes: 'Not an error. Most polls land here.'
  },

  /* --- 6 · STEPS 1 AND 2 ------------------------------------------- */
  code('Prepare the run', TAIL_PREPARE, [X(5), ROW_MAIN]),

  /* --- 7 --------------------------------------------------------- */
  http('Log steps 1-2', RPC_FROM_ITEM, '={{ JSON.stringify($json.args) }}',
    [X(6), ROW_MAIN], { onError: 'continueErrorOutput' }),

  /* --- 8 · STEPS 3 AND 4 · THE LOOP TARGET ------------------------- */
  code('Rank and project', TAIL_RANK, [X(7), ROW_MAIN]),

  /* --- 9 --------------------------------------------------------- */
  http('Log steps 3-4', RPC_FROM_ITEM, '={{ JSON.stringify($json.args) }}',
    [X(8), ROW_MAIN], { onError: 'continueErrorOutput' }),

  /* --- 10 · THE DECISION POINT ------------------------------------- */
  ifNode('Impact gate', {
    id: 'impact-gate',
    leftValue: "={{ $('Rank and project').first().json.ctx.cooling_c }}",
    rightValue: "={{ $('Rank and project').first().json.ctx.floor_c }}",
    operator: { type: 'number', operation: 'gte' }
  }, [X(9), ROW_MAIN]),

  /* --- 11, 12, 13, 14 · THE TRUE BRANCH ---------------------------- */
  code('Deliver findings', TAIL_DELIVER, [X(10), ROW_MAIN]),
  http('Write findings', RPC_FROM_ITEM, '={{ JSON.stringify($json.args) }}',
    [X(11), ROW_MAIN], { onError: 'continueErrorOutput' }),
  code('All writes landed?', TAIL_LANDED, [X(12), ROW_MAIN]),
  http('Finish: complete', RPC_FROM_ITEM, '={{ JSON.stringify($json.args) }}',
    [X(13), ROW_MAIN], { retryOnFail: true, maxTries: 2, waitBetweenTries: 5000 }),

  /* --- 15, 16, 17, 18 · THE FALSE BRANCH --------------------------- */
  code('Reject the zone', TAIL_REJECT, [X(10), ROW_FALSE]),
  http('Log the refusal', RPC_FROM_ITEM, '={{ JSON.stringify($json.args) }}',
    [X(11), ROW_FALSE], { onError: 'continueErrorOutput' }),
  ifNode('Re-ranks left?', {
    id: 'can-rerank',
    leftValue: "={{ $('Reject the zone').first().json.ctx.can_rerank }}",
    rightValue: '',
    operator: { type: 'boolean', operation: 'true', singleValue: true }
  }, [X(12), ROW_FALSE]),
  http('Finish: stalled',
    rpcUrl('agent_finish_run'),
    "={{ JSON.stringify($('Reject the zone').first().json.ctx.stall_args) }}",
    [X(13), ROW_FALSE],
    { executeOnce: true, retryOnFail: true, maxTries: 2, waitBetweenTries: 5000 }),

  /* --- 19, 20, 21 · THE FAILURE BRANCH ----------------------------- */
  code('Explain the failure', TAIL_EXPLAIN, [X(10), ROW_ERROR]),
  http('Log the failure', RPC_FROM_ITEM, '={{ JSON.stringify($json.args) }}',
    [X(11), ROW_ERROR], {
      onError: 'continueErrorOutput',
      notes: 'Both outputs go to Finish: failed. The run gets closed whether or not the reason row landed.'
    }),
  http('Finish: failed',
    rpcUrl('agent_finish_run'),
    "={{ JSON.stringify({ p_run_id: $('Explain the failure').first().json.ctx.run_id, p_status: 'failed', p_error: $('Explain the failure').first().json.ctx.reason }) }}",
    [X(12), ROW_ERROR],
    { executeOnce: true, retryOnFail: true, maxTries: 2, waitBetweenTries: 5000 }),

  /* --- THE THREE THINGS A JUDGE SHOULD BE ABLE TO READ OFF THE CANVAS */
  sticky([
    '## The browser never calls this workflow',
    '',
    'There is no webhook here. n8n asks our database "is there a queued run?"',
    'every 15 seconds and works what it finds.',
    '',
    'The button in our app calls launch_mission() and writes one queued row.',
    'Close n8n completely and the button still works - the row waits.',
    '',
    'DECISIONS.md D-1'
  ].join('\n'), [X(0) - 20, ROW_MAIN - 300], [640, 240], 4),

  sticky([
    '## THE DECISION POINT',
    '',
    'Is the top zone\'s projected 24-month cooling at least 1.0 °C?',
    '',
    'YES -> the map.   NO -> reject that zone and rank again without it.',
    '',
    'Both numbers on this node come from IMPACT_FLOOR_C in',
    'agent/decision.js. Neither is typed into n8n.',
    '',
    'Two re-ranks maximum, then the run stops and says why.'
  ].join('\n'), [X(9) - 20, ROW_MAIN - 320], [520, 260], 3),

  sticky([
    '## Never set a node to "Continue (using regular output)"',
    '',
    'A refused write is the guardrail working. Swallowing it makes a run',
    'that wrote nothing look finished and tells nobody.',
    '',
    'Error outputs come here instead: the reason is written as a refused',
    'step the researcher can read, then the run is closed as failed.'
  ].join('\n'), [X(9) - 20, ROW_ERROR - 220], [560, 200], 2)
];

var connections = {
  'Every 15 seconds':   { main: [[{ node: 'Demo controls',       type: 'main', index: 0 }]] },
  'Demo controls':      { main: [[{ node: 'Sweep stalled runs',  type: 'main', index: 0 }]] },
  'Sweep stalled runs': { main: [[{ node: 'Claim a queued run',  type: 'main', index: 0 }]] },
  'Claim a queued run': { main: [[{ node: 'Anything queued?',    type: 'main', index: 0 }]] },
  'Anything queued?':   { main: [
                            [{ node: 'Prepare the run',          type: 'main', index: 0 }],
                            [{ node: 'Nothing to do',            type: 'main', index: 0 }]
                          ] },
  'Prepare the run':    { main: [[{ node: 'Log steps 1-2',       type: 'main', index: 0 }]] },
  'Log steps 1-2':      { main: [
                            [{ node: 'Rank and project',         type: 'main', index: 0 }],
                            [{ node: 'Explain the failure',      type: 'main', index: 0 }]
                          ] },
  'Rank and project':   { main: [[{ node: 'Log steps 3-4',       type: 'main', index: 0 }]] },
  'Log steps 3-4':      { main: [
                            [{ node: 'Impact gate',              type: 'main', index: 0 }],
                            [{ node: 'Explain the failure',      type: 'main', index: 0 }]
                          ] },
  'Impact gate':        { main: [
                            [{ node: 'Deliver findings',         type: 'main', index: 0 }],
                            [{ node: 'Reject the zone',          type: 'main', index: 0 }]
                          ] },
  'Deliver findings':   { main: [[{ node: 'Write findings',      type: 'main', index: 0 }]] },
  'Write findings':     { main: [
                            [{ node: 'All writes landed?',       type: 'main', index: 0 }],
                            [{ node: 'Explain the failure',      type: 'main', index: 0 }]
                          ] },
  'All writes landed?': { main: [[{ node: 'Finish: complete',    type: 'main', index: 0 }]] },
  'Reject the zone':    { main: [[{ node: 'Log the refusal',     type: 'main', index: 0 }]] },
  'Log the refusal':    { main: [
                            [{ node: 'Re-ranks left?',           type: 'main', index: 0 }],
                            [{ node: 'Explain the failure',      type: 'main', index: 0 }]
                          ] },
  /* THE ONE BACKWARDS ARROW ON THE BOARD */
  'Re-ranks left?':     { main: [
                            [{ node: 'Rank and project',         type: 'main', index: 0 }],
                            [{ node: 'Finish: stalled',          type: 'main', index: 0 }]
                          ] },
  'Explain the failure': { main: [[{ node: 'Log the failure',    type: 'main', index: 0 }]] },
  'Log the failure':    { main: [
                            [{ node: 'Finish: failed',           type: 'main', index: 0 }],
                            [{ node: 'Finish: failed',           type: 'main', index: 0 }]
                          ] }
};

module.exports = {
  name: 'KuwaitSat-1 · mission run worker',
  nodes: nodes,
  connections: connections,
  settings: {
    executionOrder: 'v1',
    /* Keep every execution, including the ones that did nothing. On
       demo night the execution list is the evidence that the run was
       started by our app and not by a person pressing Execute. */
    saveDataSuccessExecution: 'all',
    saveDataErrorExecution: 'all',
    saveManualExecutions: true,
    executionTimeout: 120
  },
  pinData: {}
};
