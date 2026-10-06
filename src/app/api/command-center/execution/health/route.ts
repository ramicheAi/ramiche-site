import { execFile } from "node:child_process";
import { readFileSync, statfsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { guardPrivateRead } from "@/lib/server/protected-mutation";
import { noStoreJson } from "@/lib/server/cockpit-chat-data";
import { GithubAuthUnavailable } from "@/lib/execution/github-app";
import { checkoutRemoteTip, executionRoots } from "@/lib/execution/http";
import { dispatchHalted } from "@/lib/execution/halt";
import { executionHealth, type HealthSignals } from "@/lib/execution/health";
import { capabilityCeiling, executionEnv } from "@/lib/execution/policy";
import { bySlug } from "@/lib/execution/projects";
import { DEADLINE_GRACE_MS, HEARTBEAT_STALE_MS } from "@/lib/execution/reaper";
import { executionAvailable } from "@/lib/execution/service";
import { EXECUTOR_SOURCE } from "@/lib/execution/store";
import { MIN_FREE_BYTES } from "@/lib/execution/executor";
import { supabaseJobsDb } from "@/lib/execution/supabase-jobs-db";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

let claudeCache: { at: number; v: HealthSignals["claude"] } | null = null;
let repoCache: { at: number; v: HealthSignals["repoAccess"] } | null = null;

/** `claude auth status` in the executor's own session; only the logged-in flag is read. Cached for a minute. */
function claudeAuth(now: number): Promise<HealthSignals["claude"]> {
  if (claudeCache && now - claudeCache.at < 60_000) return Promise.resolve(claudeCache.v);
  const bin = process.env.CC_CLAUDE_BIN ?? join(/*turbopackIgnore: true*/ homedir(), ".local", "bin", "claude");
  return new Promise((resolve) => {
    // The execution allowlist environment: the cockpit's secrets (Supabase, the GitHub App key) never reach the CLI.
    execFile(/*turbopackIgnore: true*/ bin, ["auth", "status"], { timeout: 10_000, env: executionEnv() as NodeJS.ProcessEnv }, (err, stdout) => {
      const v: HealthSignals["claude"] = /"loggedIn"\s*:\s*true/.test(stdout) ? "ok" : /"loggedIn"\s*:\s*false/.test(stdout) ? "logged_out" : "unknown";
      void err;
      claudeCache = { at: now, v };
      resolve(v);
    });
  });
}

/**
 * GET /api/command-center/execution/health[?deep=1]  (founder only, read-only)
 * One headline plus reasons. `deep=1` also reads a registered project's remote head with the executor's credentials
 * (one GitHub read with the executor's machine identity; on demand and cached for 5 minutes).
 */
export async function GET(req: Request) {
  const guard = await guardPrivateRead(req);
  if (!guard.ok) return guard.response;
  const now = Date.now();
  const execRoot = join(/*turbopackIgnore: true*/ homedir(), ".parallax", "executions");
  let diskFreeBytes: number | null = null;
  try { const s = statfsSync(/*turbopackIgnore: true*/ homedir()); diskFreeBytes = Number(s.bavail) * Number(s.bsize); } catch { /* unknown */ }
  let store: HealthSignals["store"] = "error", running = 0, stuck = 0, staleHeartbeats = 0, failures24h = 0;
  const svc = getSupabaseAdmin();
  if (svc) {
    const list = await supabaseJobsDb(svc).listRunning(EXECUTOR_SOURCE);
    const failed = await svc.from("jobs").select("id", { count: "exact", head: true }).eq("source", EXECUTOR_SOURCE).eq("status", "failed").gte("finished_at", new Date(now - 86_400_000).toISOString());
    if (!list.error && !failed.error) {
      store = "ok";
      running = list.rows.length;
      failures24h = failed.count ?? 0;
      for (const j of list.rows) {
        const timeout = Number((j.input as { limits?: { timeoutMs?: unknown } } | null)?.limits?.timeoutMs);
        if (Date.parse(j.started_at ?? "") + (Number.isFinite(timeout) ? timeout : 0) + DEADLINE_GRACE_MS < now) stuck++;
        if (now - Date.parse(j.updated_at ?? "") >= HEARTBEAT_STALE_MS) staleHeartbeats++;
      }
    }
  }
  let reaper: HealthSignals["reaper"] = { at: null, ok: null, error: null };
  try { const r = JSON.parse(readFileSync(/*turbopackIgnore: true*/ join(/*turbopackIgnore: true*/ execRoot, "reaper-status.json"), "utf8")); reaper = { at: String(r.at), ok: !!r.ok, error: r.error ? "error" : null }; } catch { /* never ran */ }
  const fresh = !!repoCache && now - repoCache.at < 5 * 60_000;
  let repoAccess: HealthSignals["repoAccess"] = fresh ? repoCache!.v : "unchecked";
  // deep=1 runs the remote read at most once per 5 minutes, whoever asks.
  if (new URL(req.url).searchParams.get("deep") === "1" && !fresh) {
    const mettle = bySlug("mettle");
    try {
      const tip = mettle.ok ? await checkoutRemoteTip(executionRoots(), 10_000)(mettle.entry, "main") : null;
      repoAccess = tip ? "ok" : "unavailable";
    } catch (e) { repoAccess = e instanceof GithubAuthUnavailable ? "auth_unavailable" : "unavailable"; }
    repoCache = { at: now, v: repoAccess };
  }
  const h = executionHealth({
    now, dispatchEnabled: executionAvailable(), halted: dispatchHalted(), ceiling: capabilityCeiling("production"), claude: await claudeAuth(now), repoAccess,
    diskFreeBytes, minFreeBytes: MIN_FREE_BYTES, store, running, stuck, staleHeartbeats, failures24h, reaper,
  });
  return noStoreJson({ data: { ...h, counts: { running, stuck, staleHeartbeats, failures24h } }, error: null }, 200);
}
