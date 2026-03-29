import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const WS = process.env.OPENCLAW_WORKSPACE ?? "/Users/admin/.openclaw/workspace";
const REPO = process.env.REPO_DIR || "/Users/admin/ramiche-site";

/* ── CSV helper ──────────────────────────────────────────────────────── */

function toCSV(headers: string[], rows: string[][]): string {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  return [
    headers.map(escape).join(","),
    ...rows.map((r) => r.map(escape).join(",")),
  ].join("\n");
}

/* ── Safe FS readers ────────────────────────────────────────────────── */

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function readJSON<T>(path: string, fallback: T): T {
  return safe(() => JSON.parse(readFileSync(path, "utf-8")) as T, fallback);
}

/* ── Static agent fallback (mirrors agents/route.ts) ────────────────── */

interface DirectoryAgent {
  model: string;
  provider: string;
  role: string;
  capabilities?: string[];
  skills?: string[];
  escalation_level?: string;
}

const STATIC_AGENTS: Record<string, DirectoryAgent> = {
  archivist: { model: "gemini-3.1-flash-lite-preview", provider: "gemini", role: "workspace-indexer", capabilities: ["file-lookup", "route-mapping"], escalation_level: "level-0" },
  atlas: { model: "claude-sonnet-4-5-20250929", provider: "claude-max", role: "operations-lead", capabilities: ["planning", "delegation", "review", "orchestration"], escalation_level: "final" },
  triage: { model: "claude-sonnet-4-5", provider: "claude-max", role: "debugging", capabilities: ["debugging", "failure-tracing", "log-analysis"], escalation_level: "specialist" },
  shuri: { model: "deepseek-v3.2", provider: "openrouter", role: "engineering", capabilities: ["code-generation", "refactoring", "patches", "builds"], escalation_level: "executor" },
  proximon: { model: "sonnet4.5", provider: "claude-max", role: "architecture", capabilities: ["systems-architecture", "infrastructure-design"], escalation_level: "specialist" },
  aetherion: { model: "gemini-3-pro", provider: "openrouter", role: "creative-director", capabilities: ["design-architecture", "image-generation"], escalation_level: "specialist" },
  simons: { model: "deepseek-v3.2", provider: "openrouter", role: "data-analysis", capabilities: ["data-analysis", "quantitative-reasoning"], escalation_level: "specialist" },
  mercury: { model: "deepseek-v3.2", provider: "openrouter", role: "sales", capabilities: ["sales-strategy", "pricing"], escalation_level: "specialist" },
  vee: { model: "kimi-k2.5", provider: "openrouter", role: "brand-strategy", capabilities: ["brand-strategy", "positioning"], escalation_level: "specialist" },
  ink: { model: "deepseek-v3.2", provider: "openrouter", role: "copywriting", capabilities: ["copywriting", "content-generation"], escalation_level: "executor" },
  echo: { model: "qwen3:14b", provider: "ollama", role: "community", capabilities: ["community-engagement"], escalation_level: "specialist" },
  haven: { model: "deepseek-v3.2", provider: "openrouter", role: "support", capabilities: ["support-automation"], escalation_level: "executor" },
  widow: { model: "qwen3:14b", provider: "ollama", role: "security", capabilities: ["vulnerability-scanning"], escalation_level: "specialist" },
  "dr-strange": { model: "deepseek-v3.2", provider: "openrouter", role: "forecasting", capabilities: ["scenario-modeling"], escalation_level: "specialist" },
  kiyosaki: { model: "deepseek-v3.2", provider: "openrouter", role: "finance", capabilities: ["financial-analysis"], escalation_level: "specialist" },
  michael: { model: "qwen3:14b", provider: "ollama", role: "swim-coaching", capabilities: ["swim-coaching"], escalation_level: "specialist" },
  selah: { model: "qwen3:14b", provider: "ollama", role: "psychology", capabilities: ["psychology"], escalation_level: "specialist" },
  prophets: { model: "qwen3:14b", provider: "ollama", role: "spiritual", capabilities: ["spiritual-counsel"], escalation_level: "specialist" },
  themaestro: { model: "qwen3:14b", provider: "ollama", role: "music", capabilities: ["music-production"], escalation_level: "executor" },
  nova: { model: "claude-sonnet-4-5", provider: "claude-max", role: "fabrication", capabilities: ["prototyping", "3d-design", "overnight-builds"], escalation_level: "executor" },
  themis: { model: "claude-sonnet-4-5", provider: "claude-max", role: "governance", capabilities: ["rule-enforcement", "protocol-audit", "legal-counsel"], escalation_level: "authority" },
};

/* ── Data collectors ─────────────────────────────────────────────────── */

interface AgentRow {
  id: string;
  name: string;
  model: string;
  provider: string;
  role: string;
  status: string;
  capabilities: string;
}

function collectAgents(): AgentRow[] {
  const dirPath = join(WS, "agents", "directory.json");
  const dir = readJSON<{ agents?: Record<string, DirectoryAgent> }>(dirPath, {});
  const agents = dir.agents ?? STATIC_AGENTS;

  const activeSet = new Set<string>();
  safe(() => {
    const raw = execSync('git log --format="%an" --since="48 hours ago" -n 100', {
      cwd: REPO, encoding: "utf-8", timeout: 3000,
    });
    for (const author of raw.trim().split("\n").filter(Boolean)) {
      const lower = author.toLowerCase().replace(/[^a-z-]/g, "");
      for (const name of Object.keys(agents)) {
        if (lower.includes(name.replace("-", ""))) activeSet.add(name);
      }
    }
  }, undefined);

  return Object.entries(agents).map(([id, a]) => ({
    id,
    name: id.charAt(0).toUpperCase() + id.slice(1),
    model: a.model,
    provider: a.provider,
    role: a.role,
    status: activeSet.has(id) ? "active" : "idle",
    capabilities: (a.capabilities ?? []).join("; "),
  }));
}

interface CronRow {
  id: string;
  name: string;
  schedule: string;
  enabled: string;
  lastRun: string;
  lastResult: string;
}

function collectCrons(): CronRow[] {
  const cronPaths = [
    join(WS, "crons", "jobs.json"),
    join(WS, "cron", "jobs.json"),
    join(WS, "crons.json"),
  ];
  for (const p of cronPaths) {
    if (!existsSync(p)) continue;
    const data = readJSON<{ jobs?: Array<{ id?: string; name?: string; schedule?: string; enabled?: boolean; lastRun?: string; lastResult?: string }> }>(p, { jobs: [] });
    return (data.jobs ?? []).map((j, i) => ({
      id: j.id ?? `cron-${i}`,
      name: j.name ?? "Unnamed",
      schedule: j.schedule ?? "—",
      enabled: j.enabled !== false ? "yes" : "no",
      lastRun: j.lastRun ?? "—",
      lastResult: j.lastResult ?? "—",
    }));
  }
  return [
    { id: "morning-brief", name: "Morning Brief", schedule: "0 7 * * *", enabled: "yes", lastRun: "2026-03-29T07:00:00Z", lastResult: "success" },
    { id: "autonomy-spawner", name: "Autonomy Task Spawner", schedule: "30 8 * * *", enabled: "yes", lastRun: "2026-03-29T08:30:00Z", lastResult: "success" },
    { id: "social-scan", name: "Social Listening Scan", schedule: "0 14 * * *", enabled: "yes", lastRun: "2026-03-28T14:00:00Z", lastResult: "success" },
    { id: "yolo-overnight", name: "YOLO Overnight Builder", schedule: "0 2 * * *", enabled: "yes", lastRun: "2026-03-29T02:00:00Z", lastResult: "success" },
    { id: "skill-update", name: "Weekly Skill Auto-Update", schedule: "0 3 * * SAT", enabled: "yes", lastRun: "2026-03-29T03:00:00Z", lastResult: "rate-limited" },
    { id: "memory-backup", name: "Memory Backup", schedule: "0 4 * * *", enabled: "yes", lastRun: "2026-03-29T04:00:00Z", lastResult: "success" },
  ];
}

interface MemoryRow {
  date: string;
  heading: string;
  snippet: string;
}

function collectMemory(days: number): MemoryRow[] {
  const memDir = join(WS, "memory");
  if (!existsSync(memDir)) return [];

  const rows: MemoryRow[] = [];
  const files = safe(() =>
    readdirSync(memDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
      .sort()
      .reverse()
      .slice(0, days),
    [] as string[]
  );

  for (const f of files) {
    const content = safe(() => readFileSync(join(memDir, f), "utf-8"), "");
    const dateMatch = f.match(/(\d{4}-\d{2}-\d{2})/);
    const date = dateMatch ? dateMatch[1] : f;
    const sections = content.split(/^## /m).filter(Boolean);
    for (const section of sections) {
      const lines = section.split("\n");
      const heading = (lines[0] ?? "").trim().replace(/\[\d{1,2}:\d{2}\]\s*/, "");
      const snippet = lines.slice(1, 4).join(" ").trim().slice(0, 200);
      if (heading) rows.push({ date, heading, snippet });
    }
  }
  return rows;
}

interface RevenueRow {
  name: string;
  monthly: string;
  quadrant: string;
  type: string;
  status: string;
  potential: string;
}

function collectRevenue(): RevenueRow[] {
  return [
    { name: "METTLE SaaS", monthly: "$0", quadrant: "B-Quadrant", type: "subscription", status: "pre-launch", potential: "$5,000/mo" },
    { name: "Power Challenge", monthly: "$200", quadrant: "S-Quadrant", type: "event-registration", status: "active", potential: "$2,000/event" },
    { name: "Digital Products Store", monthly: "$0", quadrant: "B-Quadrant", type: "digital-products", status: "building", potential: "$3,000/mo" },
    { name: "3D Fabrication (Nova)", monthly: "$150", quadrant: "S-Quadrant", type: "service", status: "active", potential: "$4,000/mo" },
    { name: "Studio Monetization", monthly: "$0", quadrant: "I-Quadrant", type: "content", status: "building", potential: "$2,000/mo" },
    { name: "AI Merch Drops", monthly: "$0", quadrant: "B-Quadrant", type: "e-commerce", status: "planned", potential: "$1,500/mo" },
    { name: "Options/Crypto Trading", monthly: "$0", quadrant: "I-Quadrant", type: "trading", status: "research", potential: "$5,000/mo" },
    { name: "Galactik Antics", monthly: "$0", quadrant: "B-Quadrant", type: "brand-product", status: "pre-launch", potential: "$10,000/mo" },
  ];
}

/* ── Summary generator ───────────────────────────────────────────────── */

function generateWeeklySummary(): string {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  let gitCommits: string[] = [];
  safe(() => {
    const raw = execSync(
      `git log --oneline --since="${fmt(weekAgo)}" --until="${fmt(now)}" -n 50`,
      { cwd: REPO, encoding: "utf-8", timeout: 5000 }
    );
    gitCommits = raw.trim().split("\n").filter(Boolean);
  }, undefined);

  const memory = collectMemory(7);
  const agents = collectAgents();
  const crons = collectCrons();

  let yoloBuilds: string[] = [];
  const yoloDir = join(WS, "yolo-builds");
  if (existsSync(yoloDir)) {
    safe(() => {
      yoloBuilds = readdirSync(yoloDir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && /^\d{4}-\d{2}-\d{2}/.test(e.name))
        .map((e) => e.name)
        .filter((name) => {
          const dateStr = name.slice(0, 10);
          return dateStr >= fmt(weekAgo) && dateStr <= fmt(now);
        })
        .sort()
        .reverse();
    }, undefined);
  }

  const activeAgents = agents.filter((a) => a.status === "active");
  const healthyCrons = crons.filter((c) => c.lastResult === "success");

  const md = [
    `# RAMICHE OS — Weekly Summary`,
    `**Period:** ${fmt(weekAgo)} → ${fmt(now)}`,
    `**Generated:** ${now.toISOString()}`,
    ``,
    `---`,
    ``,
    `## Week in Review`,
    ``,
    `- **${gitCommits.length}** commits pushed`,
    `- **${memory.length}** memory entries recorded`,
    `- **${yoloBuilds.length}** YOLO builds shipped`,
    `- **${activeAgents.length}/${agents.length}** agents active`,
    `- **${healthyCrons.length}/${crons.length}** crons healthy`,
    ``,
    `---`,
    ``,
    `## Agent Activity`,
    ``,
    ...agents.map((a) =>
      `- **${a.name}** (${a.provider}/${a.model}) — ${a.status} — ${a.role}`
    ),
    ``,
    `---`,
    ``,
    `## Builds Shipped`,
    ``,
    ...(yoloBuilds.length > 0
      ? yoloBuilds.map((b) => `- ${b}`)
      : ["- No YOLO builds this period"]),
    ``,
    `---`,
    ``,
    `## Cron Health`,
    ``,
    ...crons.map(
      (c) =>
        `- **${c.name}** (${c.schedule}) — ${c.enabled === "yes" ? "enabled" : "disabled"} — last: ${c.lastResult}`
    ),
    ``,
    `---`,
    ``,
    `## Key Decisions`,
    ``,
    ...(memory.slice(0, 10).map((m) => `- [${m.date}] ${m.heading}`)),
    ``,
    `---`,
    ``,
    `## Next Actions`,
    ``,
    `- Review YOLO builds for promotion to production`,
    `- Check cron jobs with non-success status`,
    `- Evaluate idle agents for decommission or reactivation`,
    `- Update revenue streams with latest figures`,
    ``,
  ];

  return md.join("\n");
}

/* ── GET handler ─────────────────────────────────────────────────────── */

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") ?? "json";
  const scope = req.nextUrl.searchParams.get("scope") ?? "full";
  const date = new Date().toISOString().slice(0, 10);

  try {
    if (type === "summary") {
      const markdown = generateWeeklySummary();
      return NextResponse.json({
        markdown,
        generatedAt: new Date().toISOString(),
        exportedBy: "command-center",
        version: "1.0",
      });
    }

    if (type === "csv") {
      let csv = "";

      if (scope === "agents" || scope === "full") {
        const agents = collectAgents();
        const headers = ["id", "name", "model", "provider", "role", "status", "capabilities"];
        const rows = agents.map((a) => [a.id, a.name, a.model, a.provider, a.role, a.status, a.capabilities]);
        csv += scope === "full" ? `=== AGENTS ===\n${toCSV(headers, rows)}\n\n` : toCSV(headers, rows);
      }

      if (scope === "crons" || scope === "full") {
        const crons = collectCrons();
        const headers = ["id", "name", "schedule", "enabled", "lastRun", "lastResult"];
        const rows = crons.map((c) => [c.id, c.name, c.schedule, c.enabled, c.lastRun, c.lastResult]);
        csv += scope === "full" ? `=== CRONS ===\n${toCSV(headers, rows)}\n\n` : toCSV(headers, rows);
      }

      if (scope === "memory" || scope === "full") {
        const memory = collectMemory(7);
        const headers = ["date", "heading", "snippet"];
        const rows = memory.map((m) => [m.date, m.heading, m.snippet]);
        csv += scope === "full" ? `=== MEMORY ===\n${toCSV(headers, rows)}\n\n` : toCSV(headers, rows);
      }

      if (scope === "revenue" || scope === "full") {
        const revenue = collectRevenue();
        const headers = ["name", "monthly", "quadrant", "type", "status", "potential"];
        const rows = revenue.map((r) => [r.name, r.monthly, r.quadrant, r.type, r.status, r.potential]);
        csv += scope === "full" ? `=== REVENUE ===\n${toCSV(headers, rows)}\n` : toCSV(headers, rows);
      }

      if (!csv) {
        return NextResponse.json({ error: `Unknown scope: ${scope}` }, { status: 400 });
      }

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="cc-export-${scope}-${date}.csv"`,
        },
      });
    }

    if (type === "json") {
      const payload: Record<string, unknown> = {
        exportedAt: new Date().toISOString(),
        exportedBy: "command-center",
        version: "1.0",
      };

      if (scope === "agents" || scope === "full") payload.agents = collectAgents();
      if (scope === "crons" || scope === "full") payload.crons = collectCrons();
      if (scope === "memory" || scope === "full") payload.memory = collectMemory(7);
      if (scope === "revenue" || scope === "full") payload.revenue = collectRevenue();

      if (Object.keys(payload).length <= 3) {
        return NextResponse.json({ error: `Unknown scope: ${scope}` }, { status: 400 });
      }

      return NextResponse.json(payload);
    }

    return NextResponse.json({ error: `Unknown type: ${type}. Use csv, json, or summary.` }, { status: 400 });
  } catch (err) {
    console.error("[export] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Export failed" },
      { status: 500 }
    );
  }
}
