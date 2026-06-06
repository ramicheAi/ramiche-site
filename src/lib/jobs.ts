// /Users/admin/ramiche-site/src/lib/jobs.ts
// Jobs backbone: dispatch a tracked job to a tool-enabled Claude Code instance
// via the local Claude Max proxy (the reliable path the builder uses).
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const PROXY_URL = process.env.CLAUDE_MAX_PROXY_URL || "http://127.0.0.1:3456/v1/chat/completions";
const DEFAULT_MODEL = process.env.CC_JOBS_MODEL || "claude-sonnet-4-5";
const JOB_TIMEOUT_MS = 15 * 60 * 1000; // 15 min ceiling

export type JobKind = "generic" | "dev" | "design" | "prospect" | "outreach" | "content" | "analysis";

// Per-kind system framing. Each agent persona maps onto a job kind so the
// cockpit's "click a button -> agent does it" reads naturally.
const FRAMING: Record<JobKind, string> = {
  generic: "You are an autonomous operator for the Parallax fleet. Complete the task precisely and report the result.",
  dev: "You are Claude Code acting as an autonomous build engineer for the Parallax fleet. Implement the task end to end with production-quality code that matches the surrounding conventions. Use your file and bash tools with absolute paths under the given working directory only.",
  design: "You are Claude Code acting as an autonomous design engineer for the Parallax fleet. Produce polished, on-brand visual/front-end work. Match any existing design system in the working directory.",
  prospect: "You are a business prospecting analyst for the Parallax fleet. Find real businesses matching the criteria and return structured lead data (name, category, location, website status, contact if known).",
  outreach: "You are a sales outreach writer for the Parallax fleet. Draft personalized, proof-led outreach following the Business Bible (hook -> proof -> offer, clear not clever).",
  content: "You are a content producer for the Parallax fleet. Create on-brand content matched to the channel and audience.",
  analysis: "You are a quantitative analyst for the Parallax fleet. Analyze the inputs and return clear, decision-ready findings.",
};

function buildPrompt(kind: JobKind, title: string, input: Record<string, unknown>): string {
  const framing = FRAMING[kind] ?? FRAMING.generic;
  const lines = [framing, ""];
  const wd = typeof input.workingDir === "string" ? input.workingDir : "";
  if (wd) {
    lines.push(`WORKING DIRECTORY (operate only here, absolute paths): ${wd}`, "");
  }
  lines.push("TASK:", title);
  if (typeof input.detail === "string" && input.detail.trim()) {
    lines.push("", "DETAILS:", input.detail);
  }
  // Pass any remaining structured input as context.
  const ctx = { ...input };
  delete ctx.workingDir;
  delete ctx.detail;
  if (Object.keys(ctx).length > 0) {
    lines.push("", "CONTEXT_JSON:", JSON.stringify(ctx, null, 2));
  }
  lines.push("", "End with a concise SUMMARY of exactly what you did / found.");
  return lines.join("\n");
}

function extractContent(json: unknown): string {
  const choices = (json as { choices?: Array<{ message?: { content?: unknown } }> })?.choices;
  const c = choices?.[0]?.message?.content;
  if (typeof c === "string") return c.trim();
  if (Array.isArray(c)) return c.map((p) => (typeof p === "string" ? p : (p as { text?: string })?.text ?? "")).join("").trim();
  return "";
}

async function logEvent(jobId: string, kind: string, detail: Record<string, unknown>) {
  const db = getSupabaseAdmin();
  if (!db) return;
  try {
    await db.from("job_events").insert({ job_id: jobId, kind, detail });
  } catch {
    /* non-critical */
  }
}

/**
 * Run a queued job: mark running, dispatch to the proxy, persist result.
 * Designed to be fire-and-forget from the API route (this server is long-lived).
 */
export async function runJob(jobId: string): Promise<void> {
  const db = getSupabaseAdmin();
  if (!db) return;

  const { data: job, error } = await db.from("jobs").select("*").eq("id", jobId).single();
  if (error || !job) return;
  if (job.status !== "queued") return; // already handled

  await db.from("jobs").update({ status: "running", started_at: new Date().toISOString(), progress: "dispatched to agent" }).eq("id", jobId);
  await logEvent(jobId, "status", { status: "running" });

  const kind = (job.kind as JobKind) || "generic";
  const model = (job.input?.model as string) || DEFAULT_MODEL;
  const prompt = buildPrompt(kind, job.title, (job.input ?? {}) as Record<string, unknown>);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), JOB_TIMEOUT_MS);
  try {
    const res = await fetch(PROXY_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model, stream: false, messages: [{ role: "user", content: prompt }] }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`proxy HTTP ${res.status}: ${body.slice(0, 300)}`);
    }
    const text = extractContent(await res.json());
    if (!text) throw new Error("empty result from agent");

    await db.from("jobs").update({
      status: "done",
      result: text,
      progress: "complete",
      finished_at: new Date().toISOString(),
    }).eq("id", jobId);
    await logEvent(jobId, "status", { status: "done" });
  } catch (err) {
    const msg = err instanceof Error && err.name === "AbortError" ? `timed out after ${JOB_TIMEOUT_MS}ms` : err instanceof Error ? err.message : String(err);
    await db.from("jobs").update({
      status: "failed",
      error: msg,
      progress: "failed",
      finished_at: new Date().toISOString(),
    }).eq("id", jobId);
    await logEvent(jobId, "status", { status: "failed", error: msg });
  } finally {
    clearTimeout(timer);
  }
}
