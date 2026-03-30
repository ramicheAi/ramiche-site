import { NextRequest } from "next/server";
import { execSync } from "child_process";
import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join } from "path";
import { resolveOpenclawCronDir } from "@/lib/openclaw-paths";
import { cpus, totalmem, freemem } from "os";
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore, FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const WS = process.env.OPENCLAW_WORKSPACE ?? "/Users/admin/.openclaw/workspace";
const REPO = process.env.REPO_DIR || "/Users/admin/ramiche-site";
const CRON_DIR = resolveOpenclawCronDir();

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
    const raw = readFileSync(join(CRON_DIR, "jobs.json"), "utf-8");
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
      "ps aux | grep -i 'openclaw\\|claude\\|node.*gateway' | grep -v grep | head -20",
      { encoding: "utf-8", timeout: 3000 }
    );
    const lines = raw.trim().split("\n").filter(Boolean);
    return {
      count: lines.length,
      processes: lines.map(l => {
        const parts = l.trim().split(/\s+/);
        return { pid: parts[1], cpu: parts[2], mem: parts[3], cmd: parts.slice(10).join(" ").slice(0, 80) };
      }),
    };
  }, { count: 0, processes: [] });
}

function getGitActivity(limit = 20) {
  const logPath = join(WS, "memory", "git-activity.jsonl");
  return safe(() => {
    if (!existsSync(logPath)) return [];
    const raw = readFileSync(logPath, "utf-8");
    return raw.trim().split("\n").filter(Boolean).slice(-limit).reverse().map(l => {
      try { return JSON.parse(l); } catch { return null; }
    }).filter(Boolean);
  }, []);
}

function getCronExecutionLog() {
  return safe(() => {
    const historyPath = join(CRON_DIR, "history.json");
    if (!existsSync(historyPath)) return [];
    const raw = readFileSync(historyPath, "utf-8");
    const history = JSON.parse(raw);
    if (!Array.isArray(history)) return [];
    return history.slice(-20).reverse().map((h: Record<string, unknown>) => ({
      id: h.id, name: h.name ?? h.id, time: h.time ?? h.completedAt,
      status: h.status ?? (h.error ? "failed" : "ok"),
      duration: h.duration, error: h.error,
    }));
  }, []);
}

function getYoloBuilds() {
  const dir = join(WS, "yolo-builds");
  return safe(() => {
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter(f => {
        const p = join(dir, f);
        return statSync(p).isDirectory();
      })
      .sort().reverse()
      .map(f => {
        const p = join(dir, f);
        const metaPath = join(p, "meta.json");
        const readmePath = join(p, "README.md");
        let meta: Record<string, string> = {};
        if (existsSync(metaPath)) {
          try { meta = JSON.parse(readFileSync(metaPath, "utf-8")); } catch {}
        }
        const snippet = meta.idea || (existsSync(readmePath) ? readFileSync(readmePath, "utf-8").slice(0, 200) : "");
        const dateMatch = f.match(/^(\d{4}-\d{2}-\d{2})/);
        const agentMatch = f.match(/^\d{4}-\d{2}-\d{2}-([a-z-]+?)-/);
        return {
          name: meta.name || f.replace(/^\d{4}-\d{2}-\d{2}-[a-z-]+?-/, "").split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
          folder: f,
          snippet,
          date: dateMatch ? dateMatch[1] : statSync(p).mtime.toISOString(),
          agent: meta.agent || (agentMatch ? agentMatch[1].charAt(0).toUpperCase() + agentMatch[1].slice(1) : "Unknown"),
          status: meta.status || "working",
          files: readdirSync(p).filter((x: string) => !x.startsWith(".")),
        };
      });
  }, []);
}

function getCronLastRuns() {
  return safe(() => {
    const logPath = join(CRON_DIR, "history.json");
    if (!existsSync(logPath)) return [];
    const raw = readFileSync(logPath, "utf-8");
    const history = JSON.parse(raw);
    return Array.isArray(history) ? history.slice(-10).reverse() : [];
  }, []);
}

/* ── Firestore Auto-Sync ─────────────────────────────────────────────── */

let firestoreDb: Firestore | null = null;
let lastSyncAt = 0;

function getFirestoreDb(): Firestore | null {
  if (firestoreDb) return firestoreDb;
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!sa) return null;
  try {
    const parsed = JSON.parse(sa);
    const app: App = getApps().length > 0 ? getApps()[0] : initializeApp({ credential: cert(parsed) });
    firestoreDb = getFirestore(app);
    return firestoreDb;
  } catch {
    return null;
  }
}

async function runFirestoreSync(): Promise<boolean> {
  const db = getFirestoreDb();
  if (!db) return false;

  try {
    const agentDir = getAgentDirectory();
    const crons = getCronJobs();
    const cronHistory = getCronExecutionLog();
    const yolo = getYoloBuilds();
    const memory = getDailyMemory();
    const today = new Date().toISOString().split("T")[0];

    const batch = db.batch();

    batch.set(
      db.collection("command-center").doc("agents").collection("directory").doc("latest"),
      { ...agentDir, _syncedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );

    batch.set(
      db.collection("command-center").doc("crons").collection("config").doc("latest"),
      { jobs: crons, jobCount: Array.isArray(crons) ? crons.length : 0, _syncedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );

    batch.set(
      db.collection("command-center").doc("crons").collection("history").doc("latest"),
      { entries: cronHistory, entryCount: cronHistory.length, _syncedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );

    batch.set(
      db.collection("command-center").doc("yolo-builds").collection("manifest").doc("latest"),
      { builds: yolo, buildCount: yolo.length, _syncedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );

    if (memory.entries.length > 0) {
      batch.set(
        db.collection("command-center").doc("memory").collection(today).doc("daily"),
        { date: today, content: JSON.stringify(memory), _syncedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
    }

    await batch.commit();
    lastSyncAt = Date.now();
    return true;
  } catch {
    return false;
  }
}

/* ── Build full snapshot ─────────────────────────────────────────────── */

function buildSnapshot() {
  return {
    timestamp: new Date().toISOString(),
    commits: getGitCommits(),
    forge: getForgeFiles(),
    agents: getAgentDirectory(),
    crons: getCronJobs(),
    cronDir: CRON_DIR,
    workspace: WS,
    vitals: getSystemVitals(),
    memory: getDailyMemory(),
    sessions: getActiveSessions(),
    yoloBuilds: getYoloBuilds(),
    cronHistory: getCronLastRuns(),
    gitActivity: getGitActivity(),
    cronExecutionLog: getCronExecutionLog(),
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

          // Heartbeat with vitals + sessions (every tick = 5s)
          const vitals = getSystemVitals();
          const sessions = getActiveSessions();
          controller.enqueue(encoder.encode(
            `event: vitals\ndata: ${JSON.stringify({ timestamp: new Date().toISOString(), vitals, sessions })}\n\n`
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

          // Check cron history + execution log (every 6th tick = 30s)
          if (tickCount % 6 === 0) {
            const history = getCronLastRuns();
            if (history.length !== lastCronHistoryLen) {
              lastCronHistoryLen = history.length;
              controller.enqueue(encoder.encode(
                `event: cronHistory\ndata: ${JSON.stringify({ cronHistory: history })}\n\n`
              ));
            }
            const cronLog = getCronExecutionLog();
            controller.enqueue(encoder.encode(
              `event: cronExecLog\ndata: ${JSON.stringify({ cronExecutionLog: cronLog })}\n\n`
            ));
            const gitAct = getGitActivity();
            controller.enqueue(encoder.encode(
              `event: gitActivity\ndata: ${JSON.stringify({ gitActivity: gitAct })}\n\n`
            ));
          }

          // Full agent directory refresh (every 12th tick = 60s)
          if (tickCount % 12 === 0) {
            const agents = getAgentDirectory();
            const crons = getCronJobs();
            controller.enqueue(encoder.encode(
              `event: agents\ndata: ${JSON.stringify({ agents, crons })}\n\n`
            ));
          }

          // Firestore auto-sync (every 60th tick = 5 minutes)
          if (tickCount % 60 === 0) {
            runFirestoreSync().then(ok => {
              controller.enqueue(encoder.encode(
                `event: firestoreSync\ndata: ${JSON.stringify({ ok, syncedAt: new Date().toISOString(), lastSyncAt })}\n\n`
              ));
            }).catch(() => {});
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
