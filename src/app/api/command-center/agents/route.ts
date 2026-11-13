import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { execSync } from "child_process";
import { directoryAgents } from "@/lib/agent-registry";
import { ownerOnly } from "@/lib/server/command-center-guard";

export const dynamic = "force-dynamic";

function inferProviderFromModel(model: string): string {
  const m = model.toLowerCase();
  if (m.includes("claude") || m.includes("opus") || m.includes("sonnet")) return "claude-max";
  if (m.includes("gemini")) return "openrouter";
  if (m.includes("kimi")) return "openrouter";
  if (m.includes("deepseek")) return "openrouter";
  if (m.includes("qwen") || m.includes("llama") || m.includes("gemma")) return "ollama";
  return "openrouter";
}

const WORKSPACE_DIR = join(
  process.env.OPENCLAW_WORKSPACE ?? "/Users/admin/.openclaw/workspace",
  "agents"
);
const DIRECTORY_PATH = join(WORKSPACE_DIR, "directory.json");
const REPO_DIR = process.env.REPO_DIR || "/Users/admin/ramiche-site";

interface DirectoryAgent {
  model: string;
  provider: string;
  role: string;
  capabilities?: string[];
  skills?: string[];
  escalation_level?: string;
  default_stance?: string;
  provider_note?: string;
}

/**
 * Detect recently active agents from the ramiche-site git log.
 *
 * SECURITY/TRUTH (RAMICHE-OS-CC-OVERNIGHT-RECOVERY-01, Phase 7 — Project & Agent
 * Truth): this is a 48h commit-authorship HEURISTIC, not a live OpenClaw gateway
 * heartbeat. It previously had an unconditional fallback that marked a fixed list
 * of 10 named agents "active" whenever the heuristic found nothing — i.e. the UI
 * showed real-looking activity with zero actual evidence, exactly the kind of
 * fabricated status this phase exists to remove. There is now no such fallback:
 * no evidence means no agent is marked active, full stop. Callers get back the
 * evidence basis (`source`) and whether the heuristic itself failed to run
 * (`gitUnavailable`) so the UI can be honest about what it actually knows.
 */
function getRecentlyActiveAgents(): { active: Set<string>; gitUnavailable: boolean } {
  const active = new Set<string>();
  let gitUnavailable = false;
  try {
    const raw = execSync(`git log --format="%an" --since="48 hours ago" -n 100`, {
      cwd: REPO_DIR, encoding: "utf-8", timeout: 3000,
    });
    const authors = raw.trim().split("\n").filter(Boolean);
    const agentNames = new Set(Object.keys(STATIC_AGENTS));
    for (const author of authors) {
      const lower = author.toLowerCase().replace(/[^a-z-]/g, "");
      for (const name of agentNames) {
        if (lower.includes(name.replace("-", ""))) {
          active.add(name);
        }
      }
    }
  } catch {
    gitUnavailable = true; // No signal available — never fabricate a fallback here.
  }
  return { active, gitUnavailable };
}

/* ── Static fallback (Vercel / no filesystem) — aligned with MEMORY.md / Atlas audit ── */
const STATIC_AGENTS: Record<string, DirectoryAgent> = directoryAgents();

function mapAgent(id: string, a: DirectoryAgent, isActive: boolean) {
  return {
    id,
    name: id.charAt(0).toUpperCase() + id.slice(1),
    model: `${a.provider}/${a.model}`,
    role: a.role,
    capabilities: a.capabilities ?? [],
    skills: a.skills ?? [],
    escalation_level: a.escalation_level ?? "executor",
    default_stance: a.default_stance ?? "",
    status: isActive ? "active" : "idle",
  };
}

async function GET_handler() {
  const { active: activeSet, gitUnavailable } = getRecentlyActiveAgents();
  // Honest evidence label for the "active" flag below — never implies a live
  // OpenClaw gateway heartbeat, which this route does not check.
  const activityEvidence = gitUnavailable ? "unavailable" : "git-commit-48h";

  // Try live filesystem first (works when self-hosted / local dev)
  try {
    const raw = await readFile(DIRECTORY_PATH, "utf-8");
    const dir = JSON.parse(raw);
    const agents = Object.entries(dir.agents as Record<string, DirectoryAgent>).map(
      ([id, a]) => mapAgent(id, a, activeSet.has(id))
    );
    return NextResponse.json({
      agents,
      count: agents.length,
      activeCount: agents.filter(a => a.status === "active").length,
      updated: dir.updated ?? new Date().toISOString(),
      source: "live",
      activityEvidence,
      version: dir.version,
    });
  } catch {
    // Fallback to embedded static data (works on Vercel)
    const agents = Object.entries(STATIC_AGENTS).map(([id, a]) => mapAgent(id, a, activeSet.has(id)));
    return NextResponse.json({
      agents,
      count: agents.length,
      activeCount: agents.filter(a => a.status === "active").length,
      updated: new Date().toISOString(),
      source: "static",
      activityEvidence,
      version: "2.1",
    });
  }
}

interface PostBody {
  agentId?: string;
  updates?: { model?: string; provider?: string };
}

/** Persist model change to `agents/directory.json` when workspace is writable (local OpenClaw). */
async function POST_handler(req: NextRequest) {
  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const agentId = body.agentId?.toLowerCase().trim();
  const model = body.updates?.model?.trim();
  if (!agentId || !model) {
    return NextResponse.json({ error: "agentId and updates.model required" }, { status: 400 });
  }

  const provider = body.updates?.provider?.trim() || inferProviderFromModel(model);
  let dir: { version?: string; updated?: string; agents: Record<string, DirectoryAgent> };
  try {
    const raw = await readFile(DIRECTORY_PATH, "utf-8");
    dir = JSON.parse(raw) as { version?: string; updated?: string; agents: Record<string, DirectoryAgent> };
  } catch {
    dir = {
      version: "2.1",
      updated: new Date().toISOString(),
      agents: { ...STATIC_AGENTS },
    };
  }

  const existing = dir.agents[agentId] ?? STATIC_AGENTS[agentId];
  if (!existing) {
    return NextResponse.json({ error: "unknown agent" }, { status: 400 });
  }

  dir.agents[agentId] = { ...existing, model, provider };
  dir.updated = new Date().toISOString();

  try {
    await writeFile(DIRECTORY_PATH, `${JSON.stringify(dir, null, 2)}\n`, "utf-8");
  } catch (e) {
    return NextResponse.json(
      { error: "cannot write directory.json (read-only or missing workspace)", detail: String(e) },
      { status: 503 }
    );
  }

  return NextResponse.json({ ok: true, agentId, model, provider });
}

// Owner-only: enforced in the handler itself (CC-SECURITY-RECONCILIATION-02).
export const GET = ownerOnly(GET_handler);
export const POST = ownerOnly(POST_handler);
