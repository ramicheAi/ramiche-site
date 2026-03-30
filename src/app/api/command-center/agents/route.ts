import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { execSync } from "child_process";

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

/* ── Detect recently active agents from git log ── */
function getRecentlyActiveAgents(): Set<string> {
  const active = new Set<string>();
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
  } catch { /* git unavailable — use static fallback */ }
  // Always mark core ops agents as active
  if (active.size === 0) {
    for (const a of ["atlas", "proximon", "shuri", "triage", "nova", "aetherion", "vee", "ink", "echo", "prophets"]) {
      active.add(a);
    }
  }
  return active;
}

/* ── Static fallback (Vercel / no filesystem) — aligned with MEMORY.md / Atlas audit ── */
const STATIC_AGENTS: Record<string, DirectoryAgent> = {
  archivist: { model: "claude-sonnet-4-5-20250929", provider: "claude-max", role: "workspace-indexer", capabilities: ["file-lookup", "route-mapping", "codebase-queries"], escalation_level: "level-0" },
  atlas: { model: "claude-opus-4-6", provider: "claude-max", role: "operations-lead", capabilities: ["planning", "delegation", "review", "orchestration"], escalation_level: "final" },
  triage: { model: "claude-sonnet-4-5-20250929", provider: "claude-max", role: "debugging", capabilities: ["debugging", "failure-tracing", "log-analysis", "system-health"], skills: ["app-log-analyzer", "log-analyzer", "coding-agent"], escalation_level: "specialist" },
  shuri: { model: "claude-sonnet-4-5-20250929", provider: "claude-max", role: "engineering", capabilities: ["code-generation", "refactoring", "patches", "builds", "ui-design"], skills: ["ui-ux-pro-max", "nano-banana-pro", "coding-agent"], escalation_level: "executor" },
  proximon: { model: "claude-sonnet-4-5-20250929", provider: "claude-max", role: "architecture", capabilities: ["systems-architecture", "infrastructure-design", "escalation-target"], skills: ["contextplus", "dns-networking"], escalation_level: "specialist" },
  aetherion: { model: "gemini-3.1-pro-preview", provider: "openrouter", role: "creative-director", capabilities: ["conceptual-frameworks", "design-architecture", "image-generation", "visual-identity"], skills: ["ui-ux-pro-max", "nano-banana-pro", "brand-cog"], escalation_level: "specialist" },
  simons: { model: "claude-sonnet-4-5-20250929", provider: "claude-max", role: "data-analysis", capabilities: ["data-analysis", "quantitative-reasoning"], skills: ["data-visualization", "ga4-analytics"], escalation_level: "specialist" },
  mercury: { model: "claude-sonnet-4-5-20250929", provider: "claude-max", role: "sales", capabilities: ["sales-strategy", "pricing", "revenue-modeling"], skills: ["marketing-mode", "competitive-analysis"], escalation_level: "specialist" },
  vee: { model: "kimi-k2.5", provider: "openrouter", role: "brand-strategy", capabilities: ["brand-strategy", "positioning", "visual-direction"], skills: ["ui-ux-pro-max", "nano-banana-pro", "brand-analyzer"], escalation_level: "specialist" },
  ink: { model: "claude-sonnet-4-5-20250929", provider: "claude-max", role: "copywriting", capabilities: ["copywriting", "content-generation", "social-content"], skills: ["nano-banana-pro", "marketing-mode"], escalation_level: "executor" },
  echo: { model: "qwen3:14b", provider: "ollama", role: "community", capabilities: ["community-engagement", "social-interaction"], skills: ["marketing-mode"], escalation_level: "specialist", provider_note: "Local M5 MacBook" },
  haven: { model: "claude-sonnet-4-5-20250929", provider: "claude-max", role: "support", capabilities: ["support-automation", "onboarding", "client-experience"], skills: ["ui-ux-pro-max"], escalation_level: "executor" },
  widow: { model: "qwen3:14b", provider: "ollama", role: "security", capabilities: ["vulnerability-scanning", "security-checks"], skills: ["healthcheck", "dns-networking"], escalation_level: "specialist", provider_note: "Local M5 MacBook" },
  "dr-strange": { model: "claude-sonnet-4-5-20250929", provider: "claude-max", role: "forecasting", capabilities: ["scenario-modeling", "strategic-forecasting"], skills: ["competitive-analysis", "business-plan"], escalation_level: "specialist" },
  kiyosaki: { model: "claude-sonnet-4-5-20250929", provider: "claude-max", role: "finance", capabilities: ["financial-analysis", "capital-strategy"], skills: ["intellectia-stock-forecast", "invoice-generator"], escalation_level: "specialist" },
  michael: { model: "qwen3:14b", provider: "ollama", role: "swim-coaching", capabilities: ["swim-coaching", "race-strategy"], skills: ["data-visualization"], escalation_level: "specialist", provider_note: "Local M5 MacBook" },
  selah: { model: "qwen3:14b", provider: "ollama", role: "psychology", capabilities: ["psychology", "mental-performance"], skills: ["focus-deep-work", "habit-tracker"], escalation_level: "specialist", provider_note: "Local M5 MacBook" },
  prophets: { model: "qwen3:14b", provider: "ollama", role: "spiritual", capabilities: ["spiritual-counsel", "wisdom"], skills: ["oracle"], escalation_level: "specialist", provider_note: "Local M5 MacBook" },
  themaestro: { model: "qwen3:14b", provider: "ollama", role: "music", capabilities: ["music-production"], skills: ["ai-music-generation", "songsee", "clawtunes"], escalation_level: "executor", provider_note: "Local M5 MacBook" },
  nova: { model: "claude-sonnet-4-5-20250929", provider: "claude-max", role: "fabrication", capabilities: ["prototyping", "3d-design", "overnight-builds", "ui-prototyping"], skills: ["ui-ux-pro-max", "nano-banana-pro", "coding-agent"], escalation_level: "executor" },
  themis: { model: "claude-sonnet-4-5-20250929", provider: "claude-max", role: "governance", capabilities: ["rule-enforcement", "token-discipline", "protocol-audit", "security-auditing", "legal-counsel"], skills: ["cron-health", "agent-dashboard", "healthcheck", "github"], escalation_level: "authority" },
};

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

export async function GET() {
  const activeSet = getRecentlyActiveAgents();

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
      version: "2.1",
    });
  }
}

interface PostBody {
  agentId?: string;
  updates?: { model?: string; provider?: string };
}

/** Persist model change to `agents/directory.json` when workspace is writable (local OpenClaw). */
export async function POST(req: NextRequest) {
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
