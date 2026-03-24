import { NextRequest } from "next/server";
import { execSync } from "child_process";
import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join } from "path";
import { cpus, totalmem, freemem } from "os";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const WS = process.env.OPENCLAW_WORKSPACE ?? "/Users/admin/.openclaw/workspace";
const REPO = process.env.REPO_DIR || "/Users/admin/ramiche-site";

/* ── Helpers ──────────────────────────────────────────────────────────── */

function safe<T>(fn: () => T, fallback: T): T {
  try { return fn(); } catch { return fallback; }
}

function getGitCommits(since = "24 hours ago", limit = 20) {
  return safe(() => {
    const raw = execSync(
      `git log --format="%H|%aI|%an|%s" --since="${since}" -n ${limit}`,
      { cwd: REPO, encoding: "utf-8", timeout: 5000 }
    );
    return raw.trim().split("\n").filter(Boolean).map(line => {
      const [hash, date, author, ...msg] = line.split("|");
      return { hash: hash?.slice(0, 7), date, author, message: msg.join("|") };
    });
  }, []);
}

function getForgeFiles() {
  const today = new Date().toISOString().split("T")[0];
  const dir = join(WS, "memory", "forge", today);
  return safe(() => {
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter(f => f.endsWith(".md") && !f.startsWith("_"))
      .map(f => {
        const content = readFileSync(join(dir, f), "utf-8").slice(0, 300);
        const stat = statSync(join(dir, f));
        return { agent: f.replace(".md", ""), snippet: content, updated: stat.mtime.toISOString() };
      });
  }, []);
}

function getAgentDirectory() {
  return safe(() => {
    const raw = readFileSync(join(WS, "agents", "directory.json"), "utf-8");
    const dir = JSON.parse(raw);
    interface DirAgent { model: string; provider: string; role: string; capabilities?: string[]; skills?: string[]; }
    const agents = Object.entries(dir.agents as Record<string, DirAgent>).map(([id, a]) => ({
      id, model: a.model, provider: a.provider, role: a.role,
      capabilities: a.capabilities ?? [], skills: a.skills ?? [],
    }));
    return { agents, version: dir.version, updated: dir.updated };
  }, { agents: [], version: "?", updated: "" });
}

function getCronJobs() {
  return safe(() => {
    const raw = readFileSync(join("/Users/admin/.openclaw/cron", "jobs.json"), "utf-8");
    const jobs = JSON.parse(raw);
    interface CronJob { id?: string; name?: string; schedule?: string; enabled?: boolean; lastRun?: string; lastResult?: string; }
    return Array.isArray(jobs) ? jobs.map((j: CronJob) => ({
      id: j.id, name: j.name ?? j.id, schedule: j.schedule, enabled: j.enabled !== false,
      lastRun: j.lastRun, lastResult: j.lastResult,
    })) : [];
  }, []);
}

function getSystemVitals() {
  const cpuInfo = cpus();
  const totalMem = totalmem();
  const freeMem = freemem();
  const cpuUsage = safe(() => {
    const load = execSync("sysctl -n vm.loadavg", { encoding: "utf-8", timeout: 2000 }).trim();
    return load.replace(/[{}]/g, "").trim();
  }, "N/A");
  const diskUsage = safe(() => {
    const raw = execSync("df -h / | tail -1", { encoding: "utf-8", timeout: 2000 });
    const parts = raw.trim().split(/\s+/);
    return { total: parts[1], used: parts[2], available: parts[3], percent: parts[4] };
  }, { total: "?", used: "?", available: "?", percent: "?" });
  const uptime = safe(() => {
    return execSync("uptime -p 2>/dev/null || uptime", { encoding: "utf-8", timeout: 2000 }).trim();
  }, "N/A");

  return {
    cpu: { cores: cpuInfo.length, model: cpuInfo[0]?.model ?? "Unknown", load: cpuUsage },
    memory: {
      total: `${(totalMem / 1073741824).toFixed(1)} GB`,
      free: `${(freeMem / 1073741824).toFixed(1)} GB`,
      used: `${((totalMem - freeMem) / 1073741824).toFixed(1)} GB`,
      percent: `${(((totalMem - freeMem) / totalMem) * 100).toFixed(0)}%`,
    },
    disk: diskUsage,
    uptime,
  };
}

function getDailyMemory() {
  const today = new Date().toISOString().split("T")[0];
  const path = join(WS, "memory", `${today}.md`);
  return safe(() => {
    if (!existsSync(path)) return { date: today, entries: [] };
    const content = readFileSync(path, "utf-8");
    const entries = content.split(/^## /m).filter(Boolean).slice(0, 10).map(e => {
      const firstLine = e.split("\n")[0].trim();
      return { heading: firstLine, snippet: e.slice(0, 200) };
    });
    return { date: today, entries };
  }, { date: today, entries: [] });
}

function getActiveSessions() {
  return safe(() => {
    const raw = execSync(
      "ps aux | grep -i 'openclaw\\|claude\\|node.*gateway' | grep -v grep | head -10",
      { encoding: "utf-8", timeout: 3000 }
    );
    return raw.trim().split("\n").filter(Boolean).length;
  }, 0);
}

function getYoloBuilds(limit = 5) {
  const dir = join(WS, "yolo-builds");
  return safe(() => {
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter(f => statSync(join(dir, f)).isDirectory())
      .sort().reverse().slice(0, limit)
      .map(f => {
        const readmePath = join(dir, f, "README.md");
        const snippet = existsSync(readmePath)
          ? readFileSync(readmePath, "utf-8").slice(0, 200)
          : "";
        return { name: f, snippet, date: statSync(join(dir, f)).mtime.toISOString() };
      });
  }, []);
}

function getCronLastRuns() {
  return safe(() => {
    const logPath = join("/Users/admin/.openclaw/cron", "history.json");
    if (!existsSync(logPath)) return [];
    const raw = readFileSync(logPath, "utf-8");
    const history = JSON.parse(raw);
    return Array.isArray(history) ? history.slice(-10).reverse() : [];
  }, []);
}

/* ── Build full snapshot ─────────────────────────────────────────────── */

function buildSnapshot() {
  return {
    timestamp: new Date().toISOString(),
    commits: getGitCommits(),
    forge: getForgeFiles(),
    agents: getAgentDirectory(),
    crons: getCronJobs(),
    vitals: getSystemVitals(),
    memory: getDailyMemory(),
    activeSessions: getActiveSessions(),
    yoloBuilds: getYoloBuilds(),
    cronHistory: getCronLastRuns(),
  };
}

/* ── SSE Handler ─────────────────────────────────────────────────────── */

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial full snapshot
      const snapshot = buildSnapshot();
      controller.enqueue(encoder.encode(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`));

      // Send heartbeat + diff every 5 seconds
      let lastCommitHash = snapshot.commits[0]?.hash ?? "";
      let lastForgeCount = snapshot.forge.length;
      let lastMemoryCount = snapshot.memory.entries.length;
      let lastYoloCount = snapshot.yoloBuilds?.length ?? 0;
      let lastCronHistoryLen = snapshot.cronHistory?.length ?? 0;
      let tickCount = 0;

      const interval = setInterval(() => {
        try {
          tickCount++;

          // Heartbeat with vitals (every tick = 5s)
          const vitals = getSystemVitals();
          const sessions = getActiveSessions();
          controller.enqueue(encoder.encode(
            `event: vitals\ndata: ${JSON.stringify({ timestamp: new Date().toISOString(), vitals, activeSessions: sessions })}\n\n`
          ));

          // Check for new git commits
          const commits = getGitCommits("5 minutes ago", 5);
          if (commits.length > 0 && commits[0]?.hash !== lastCommitHash) {
            lastCommitHash = commits[0]?.hash ?? "";
            controller.enqueue(encoder.encode(
              `event: commits\ndata: ${JSON.stringify({ commits })}\n\n`
            ));
          }

          // Check for new forge entries
          const forge = getForgeFiles();
          if (forge.length !== lastForgeCount) {
            lastForgeCount = forge.length;
            controller.enqueue(encoder.encode(
              `event: forge\ndata: ${JSON.stringify({ forge })}\n\n`
            ));
          }

          // Check for new memory entries
          const memory = getDailyMemory();
          if (memory.entries.length !== lastMemoryCount) {
            lastMemoryCount = memory.entries.length;
            controller.enqueue(encoder.encode(
              `event: memory\ndata: ${JSON.stringify({ memory })}\n\n`
            ));
          }

          // Check for new YOLO builds (every 6th tick = 30s)
          if (tickCount % 6 === 0) {
            const yolo = getYoloBuilds();
            if (yolo.length !== lastYoloCount) {
              lastYoloCount = yolo.length;
              controller.enqueue(encoder.encode(
                `event: yolo\ndata: ${JSON.stringify({ yoloBuilds: yolo })}\n\n`
              ));
            }
          }

          // Check cron history (every 6th tick = 30s)
          if (tickCount % 6 === 0) {
            const history = getCronLastRuns();
            if (history.length !== lastCronHistoryLen) {
              lastCronHistoryLen = history.length;
              controller.enqueue(encoder.encode(
                `event: cronHistory\ndata: ${JSON.stringify({ cronHistory: history })}\n\n`
              ));
            }
          }

          // Full agent directory refresh (every 12th tick = 60s)
          if (tickCount % 12 === 0) {
            const agents = getAgentDirectory();
            const crons = getCronJobs();
            controller.enqueue(encoder.encode(
              `event: agents\ndata: ${JSON.stringify({ agents, crons })}\n\n`
            ));
          }
        } catch {
          // If anything fails, just send a heartbeat
          controller.enqueue(encoder.encode(
            `event: heartbeat\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`
          ));
        }
      }, 5000);

      // Cleanup on close
      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
