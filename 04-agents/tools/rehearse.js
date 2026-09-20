/* =====================================================================
   REHEARSE THE RUN WITH NO SCREEN, NO n8n, NO DATABASE.
   Owner: 04 · Automation and agents (Dana)

     node 04-agents/tools/rehearse.js            the demo run: one refusal
     node 04-agents/tools/rehearse.js --pass     nothing refused
     node 04-agents/tools/rehearse.js --stall    every zone refused

   It prints the run the way you draw it: steps down the left, and the
   decision arrow where the gate fires. Read it out loud until the words
   in ../docs/AU-M3-PROCESS.md come without looking.
   ===================================================================== */

var D = require('../agent/decision.js');
var R = require('../agent/run.js');

var mode = process.argv[2] || '--demo';
var topCooling = mode === '--pass' ? 1.8 : 0.6;

var zones = [
  { id: 'z_a', name: 'Zone A - North corridor', score: 88, projectedCoolingC: topCooling,
    note: 'Low existing canopy, road access on two sides.' },
  { id: 'z_b', name: 'Zone B - Central basin',  score: 81, projectedCoolingC: mode === '--stall' ? 0.5 : 1.9,
    note: 'Shallow depression retains runoff.' },
  { id: 'z_c', name: 'Zone C - South flats',    score: 67, projectedCoolingC: mode === '--stall' ? 0.4 : 1.4,
    note: 'Workable, higher soil salinity.' },
  { id: 'z_d', name: 'Zone D - East margin',    score: 59, projectedCoolingC: mode === '--stall' ? 0.2 : 0.9,
    note: 'Wind exposure needs a shelter belt.' }
];

var plan = R.planRun({
  runId: 'run_rehearsal',
  objective: 'Identify areas in Kuwait where increasing vegetation could improve environmental conditions.',
  zones: zones
});

console.log('');
console.log('  THE FLOOR: ' + D.IMPACT_FLOOR_C.toFixed(1) + ' °C projected cooling at 24 months');
console.log('  agent/decision.js  ->  var IMPACT_FLOOR_C = ' + D.IMPACT_FLOOR_C.toFixed(1) + ';');
console.log('');

var n = 0;
var dIdx = 0;
var stalled = plan.outcome === 'stalled';

plan.calls.forEach(function (c, i) {
  if (c.rpc === 'agent_log_step') {
    if (c.args.p_allowed === false) {
      var isLastRefusal = stalled && !plan.calls.slice(i + 1).some(function (later) {
        return later.rpc === 'agent_log_step';
      });
      console.log('        |');
      console.log('      < > DECISION   is it >= ' + D.IMPACT_FLOOR_C.toFixed(1) + ' °C ?   NO');
      console.log('        |   ' + c.args.p_refused_reason);
      console.log('        |   -> ' + (isLastRefusal ? 'stop the run' : 'back to Recommendation'));
    } else {
      n++;
      console.log('  [' + n + '] ' + c.label + '   (' + c.args.p_tool + ')');
      if (c.args.p_step === 'impact_prediction') {
        var v = plan.decisions[dIdx++];
        if (v && v.verdict === 'forward') {
          console.log('        |');
          console.log('      < > DECISION   is it >= ' + D.IMPACT_FLOOR_C.toFixed(1) + ' °C ?   YES');
          console.log('        |   ' + v.reason);
          console.log('        |   -> on to Visualization');
        }
      }
    }
  } else if (c.rpc === 'agent_write_result') {
    console.log('        .  wrote ' + c.args.p_kind + ': ' + c.args.p_title);
  } else if (c.rpc === 'agent_finish_run') {
    console.log('');
    console.log('  RUN ' + c.args.p_status.toUpperCase() +
                (c.args.p_error ? ' - ' + c.args.p_error : ''));
  }
});

var accepted = plan.decisions[plan.decisions.length - 1];
if (accepted && accepted.verdict === 'forward') {
  console.log('  ACCEPTED: ' + accepted.zone.name + ' at ' +
              D.round1(accepted.zone.projectedCoolingC).toFixed(1) + ' °C');
}

console.log('');
console.log('  steps logged: ' + plan.calls.filter(function (c) { return c.rpc === 'agent_log_step'; }).length +
            ' of ' + R.STEP_BUDGET + ' budget   ·   re-ranks: ' + plan.reranks +
            ' of ' + D.MAX_RERANKS);
console.log('');
