/* =====================================================================
   FALLBACK ENGINE — a Supabase Edge Function that runs the same worker.
   Owner: 04 · Dana

   This is not the engine we chose. It exists so that the choice in
   docs/DECISION-A1-ENGINE.md is reversible in one evening: if the n8n
   trial expires, or n8n breaks on Tuesday, this file runs the identical
   logic from worker/agent-run.js against the identical four functions.
   The button, the SQL, the guardrails and the demo script do not change.

   DEPLOY (no Docker, no CLI needed)
     1. Supabase dashboard -> Edge Functions -> Deploy a new function
        -> name it  mission-worker
     2. Paste this file as index.ts.
     3. Add ../agent-run.js next to it as agent-run.js (same folder) and
        fix the import below to "./agent-run.js".
     4. Settings -> uncheck "Verify JWT" (nothing signs in as a user here;
        the function is reached by the database, not by a browser).
     5. Database -> Webhooks -> new webhook on INSERT of
        public.mission_runs, pointing at this function, with a shared
        secret header.

   SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by the platform.
   Neither value appears in this repo.
   ===================================================================== */

import { analyse } from "./agent-run.js";

const URL_BASE = Deno.env.get("SUPABASE_URL")! + "/rest/v1/rpc/";
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const HOOK_SECRET = Deno.env.get("WORKER_HOOK_SECRET") ?? "";
const RUN_MAX_MS = 120000;                    // guardrail G-14

async function rpc(fn: string, body: unknown): Promise<unknown> {
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

Deno.serve(async (req: Request) => {
  // The webhook URL is public. The payload is never trusted: we claim the
  // oldest queued run ourselves and ignore whatever the caller sent.
  if (HOOK_SECRET && req.headers.get("x-worker-secret") !== HOOK_SECRET) {
    return new Response("no", { status: 401 });
  }

  const started = Date.now();
  let claim: Record<string, unknown> | undefined;

  try {
    const claimed = await rpc("agent_claim_run", {}) as Record<string, unknown>[];
    claim = Array.isArray(claimed) ? claimed[0] : undefined;
    if (!claim) return Response.json({ ok: true, claimed: 0 });

    const plan = analyse(claim) as {
      run_id: string;
      calls_common: { fn: string; body: unknown }[];
      calls_next: { fn: string; body: unknown }[];
      finish: Record<string, unknown>;
    };

    for (const call of plan.calls_common.concat(plan.calls_next)) {
      if (Date.now() - started > RUN_MAX_MS) {
        await rpc("agent_finish_run", {
          p_run_id: plan.run_id, p_status: "stalled",
          p_error: "Run exceeded 120 seconds (guardrail G-14).",
        });
        return Response.json({ ok: false, reason: "timeout" });
      }
      // No retry on a refusal: a guardrail that said no means no.
      await rpc(call.fn, call.body);
    }

    await rpc("agent_finish_run", plan.finish);
    return Response.json({ ok: true, run_id: plan.run_id });
  } catch (err) {
    // Never leave a claimed run 'running'. A run nobody closes is the
    // endless spinner the capstone SHOULD list forbids.
    const message = err instanceof Error ? err.message : String(err);
    if (claim && claim.run_id) {
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
