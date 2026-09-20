/* =====================================================================
   FALLBACK ENGINE — a Supabase Edge Function that runs the same worker.
   Owner: 04 · Dana

   This is not the engine we chose. It exists so the choice in
   docs/DECISION-A1-ENGINE.md is reversible in one evening: if the n8n
   trial expires, or n8n breaks on Tuesday, this file runs the SAME
   decision code against the SAME functions. The button, the SQL, the
   guardrails and the demo script do not change.

   >>> IT RUNS THE SAME FILES AS n8n. IT DOES NOT REIMPLEMENT THEM. <<<
   agent/decision.js, agent/steps.js, agent/run.js and n8n/phases.js are
   the only places a run is decided. This file is plumbing: claim, post,
   finish. If you find yourself writing a RULE in here, it belongs in one
   of those four files — the whole point of the split is that the
   fallback engine cannot drift away from the real one. (It did once:
   there was a second copy of the worker logic in worker/agent-run.js
   that stopped the run on an injection instead of flagging it and
   carrying on, which is the opposite of guardrail rule 13. It is gone.)

   DEPLOY (no Docker, no CLI needed)
     1. Supabase dashboard -> Edge Functions -> Deploy a new function
        -> name it  mission-worker
     2. Paste this file as index.ts.
     3. Copy these four files into the same folder, unchanged:
          04-agents/agent/decision.js
          04-agents/agent/steps.js
          04-agents/agent/run.js
          04-agents/n8n/phases.js
        Each one defines a global when it is imported (AgentDecision,
        AgentSteps, AgentRun, AgentPhases) — that is what the four
        side-effect imports below are for. IMPORT ORDER MATTERS:
        phases.js reads the other three.
     4. Settings -> uncheck "Verify JWT" (nothing signs in as a user
        here; the function is reached by the database, not by a browser).
     5. Database -> Webhooks -> new webhook on INSERT of
        public.mission_runs, pointing at this function, with a shared
        secret header. A Cron schedule also works and is closer to how
        the n8n build polls — see n8n/BUILD-GUIDE.md §1.

   SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by the
   platform. Neither value appears in this repo.
   ===================================================================== */

import "./decision.js";
import "./steps.js";
import "./run.js";
import "./phases.js";

// deno-lint-ignore no-explicit-any
const g = globalThis as any;
const Decision = g.AgentDecision;
const Phases = g.AgentPhases;

const URL_BASE = Deno.env.get("SUPABASE_URL")! + "/rest/v1/rpc/";
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const HOOK_SECRET = Deno.env.get("WORKER_HOOK_SECRET") ?? "";

/* A live worker gives up a minute before sweep_stalled_runs() would (its
   default is 3 minutes — 03-security/db/08_agent_claim.sql). A run this
   worker knows is dead should be closed by this worker, with a reason,
   rather than swept later by a function that can only infer one. */
const RUN_MAX_MS = 120000;

/* The only five function names this file may ever post to. There is no
   sixth, because service_role has EXECUTE on exactly these and `all`
   revoked on every table (03-security/db/03_grants.sql). A
   /rest/v1/<table> URL anywhere in here would be a 401 mid-run and a
   security finding. */
type Rpc =
  | "sweep_stalled_runs"
  | "claim_next_run"
  | "agent_log_step"
  | "agent_write_result"
  | "agent_finish_run";

interface Claim {
  run_id: string;
  mission_id: string;
  title: string;
  objective: string;
  area_geojson: unknown;
}

interface Call {
  rpc: Rpc;
  args: Record<string, unknown>;
}

async function rpc(fn: Rpc, body: unknown): Promise<unknown> {
  const res = await fetch(URL_BASE + fn, {
    method: "POST",
    headers: {
      "apikey": KEY,
      "Authorization": "Bearer " + KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) {
    // The database's refusals are already sentences ("Step budget
    // exhausted.", "Run is not active."). Carry them, do not rewrite them.
    throw new Error(fn + ": " + (await res.text()).slice(0, 300));
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/* Post planned calls in order. No retry on a refusal: a guardrail that
   said no will say no again, and retrying an agent_log_step that
   succeeded before its response was lost writes the step twice. */
async function post(calls: Call[], startedAt: number, runId: string): Promise<void> {
  for (const c of calls) {
    if (Date.now() - startedAt > RUN_MAX_MS) {
      await rpc("agent_finish_run", {
        p_run_id: runId,
        p_status: "stalled",
        p_error: "Run exceeded " + (RUN_MAX_MS / 1000) +
                 " seconds and was stopped by the worker.",
      });
      throw new Error("timeout");
    }
    await rpc(c.rpc, c.args);
  }
}

Deno.serve(async (req: Request) => {
  // The webhook URL is public. The payload is never trusted: we claim the
  // oldest queued run ourselves and ignore whatever the caller sent. Same
  // reason claim_next_run() takes no arguments.
  if (HOOK_SECRET && req.headers.get("x-worker-secret") !== HOOK_SECRET) {
    return new Response("no", { status: 401 });
  }

  const startedAt = Date.now();
  let claim: Claim | undefined;

  try {
    // Sweep first, claim second — Option A in 08_agent_claim.sql. A worker
    // that died mid-run cannot close its own run; this is a live worker
    // asking the database to close it.
    await rpc("sweep_stalled_runs", {});

    const claimed = await rpc("claim_next_run", {}) as Claim[];
    claim = Array.isArray(claimed) ? claimed[0] : undefined;
    if (!claim || !claim.run_id) {
      // Zero rows means "nothing queued". That is not an error.
      return Response.json({ ok: true, claimed: 0 });
    }

    const runId = claim.run_id;

    /* PHASE A · steps 1 and 2. Screens the objective for instructions and
       checks the drawn area is inside Kuwait. */
    const observe = Phases.phaseObserve({
      run_id: runId,
      objective: claim.objective,
      area_geojson: claim.area_geojson,
    });
    await post(observe.calls, startedAt, runId);
    if (observe.ctx.stop) {
      // phaseObserve already emitted its own agent_finish_run call.
      return Response.json({ ok: true, run_id: runId, outcome: "refused" });
    }

    /* PHASES B/C/D · rank, project, and THE DECISION. This loop is the
       canvas: the IF node comparing cooling_c with floor_c, and the
       backwards arrow to "Rank and project". Both numbers come out of
       agent/decision.js; nothing here invents one.

       It terminates because phaseReject drops the rejected zone and
       refuses to re-rank more than MAX_RERANKS times. The +1 is the final
       pass, the one that stalls. */
    let rejected: string[] = observe.ctx.rejected_ids || [];
    const zones = observe.ctx.zones;

    for (let pass = 0; pass <= Decision.MAX_RERANKS + 1; pass++) {
      const ranked = Phases.phaseRankAndProject({
        run_id: runId, zones: zones, rejected_ids: rejected,
      });
      await post(ranked.calls, startedAt, runId);

      if (ranked.ctx.cooling_c >= ranked.ctx.floor_c) {
        const deliver = Phases.phaseDeliver({
          run_id: runId,
          zones: zones,
          rejected_ids: rejected,
          // carried from phase A so the draft LEADS with the refusal
          refusalNotice: observe.ctx.refusal_notice,
        });
        await post(deliver.calls, startedAt, runId);
        await rpc("agent_finish_run", {
          p_run_id: runId, p_status: "complete", p_error: null,
        });
        return Response.json({ ok: true, run_id: runId, outcome: "complete" });
      }

      const reject = Phases.phaseReject({
        run_id: runId, zones: zones, rejected_ids: rejected,
      });
      await post(reject.calls, startedAt, runId);

      if (!reject.ctx.can_rerank) {
        await rpc("agent_finish_run", reject.ctx.stall_args);
        return Response.json({ ok: true, run_id: runId, outcome: "stalled" });
      }
      rejected = reject.ctx.rejected_ids;
    }

    // Only reachable if phaseReject stops removing zones. Say so rather
    // than looping: a worker that spins produces the spinner SHOULD 9
    // exists to forbid.
    await rpc("agent_finish_run", {
      p_run_id: runId, p_status: "stalled",
      p_error: "The re-rank loop did not settle, so the run stopped instead " +
               "of ranking the same zones again.",
    });
    return Response.json({ ok: false, run_id: runId, outcome: "stalled" });
  } catch (err) {
    // Never leave a claimed run 'running'. A run nobody closes is the
    // endless spinner the capstone SHOULD list forbids. "timeout" already
    // closed the run inside post().
    const message = err instanceof Error ? err.message : String(err);
    if (claim && claim.run_id && message !== "timeout") {
      try {
        await rpc("agent_finish_run", {
          p_run_id: claim.run_id, p_status: "failed",
          p_error: message.slice(0, 300),
        });
      } catch { /* the app's 3-minute stall message is the backstop */ }
    }
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
});
