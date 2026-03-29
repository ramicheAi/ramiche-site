import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { fetchCommandCenterCronJobsFromFirestore } from "@/lib/firebase-admin";
import { resolveOpenclawCronDir } from "@/lib/openclaw-paths";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RawCronJob {
  id?: string;
  name?: string;
  schedule?: string;
  enabled?: boolean;
  agent?: string;
  prompt?: string;
  lastRun?: string;
  lastResult?: string;
  model?: string;
  description?: string;
}

function parseCronSchedule(schedule: string): { time: string; days: string[]; frequency: string } {
  if (!schedule) return { time: "00:00", days: [], frequency: "Unknown" };

  const atMatch = schedule.match(/^at\s+(\d{1,2}):(\d{2})/i);
  if (atMatch) {
    const time = `${atMatch[1].padStart(2, "0")}:${atMatch[2]}`;
    const daysMatch = schedule.match(/on\s+([\w,\s]+)/i);
    if (daysMatch) {
      const days = daysMatch[1].split(/[,\s]+/).filter(Boolean);
      return { time, days, frequency: days.length === 7 ? "Daily" : days.join(", ") };
    }
    if (schedule.toLowerCase().includes("daily") || !schedule.match(/on\s/i)) {
      return { time, days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], frequency: "Daily" };
    }
  }

  const parts = schedule.trim().split(/\s+/);
  if (parts.length >= 5) {
    const [min, hour, , , dow] = parts;
    const h = parseInt(hour) || 0;
    const m = parseInt(min) || 0;
    const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

    const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    if (dow === "*") return { time, days: ALL_DAYS, frequency: "Daily" };

    const dayMap: Record<string, string> = { "0": "Sun", "1": "Mon", "2": "Tue", "3": "Wed", "4": "Thu", "5": "Fri", "6": "Sat", "7": "Sun" };
    const days = dow.split(",").map(d => dayMap[d] || d).filter(Boolean);
    return { time, days, frequency: days.length === 7 ? "Daily" : days.join(", ") };
  }

  return { time: "00:00", days: [], frequency: schedule };
}

const AGENT_COLORS: Record<string, string> = {
  atlas: "#C9A84C", triage: "#22c55e", shuri: "#10b981", nova: "#f97316",
  simons: "#22d3ee", mercury: "#34d399", vee: "#f472b6", ink: "#a78bfa",
  echo: "#fb923c", haven: "#38bdf8", widow: "#ef4444", "dr-strange": "#a855f7",
  kiyosaki: "#fbbf24", michael: "#3b82f6", selah: "#c4b5fd", prophets: "#fbbf24",
  themaestro: "#ec4899", themis: "#818cf8", aetherion: "#8b5cf6", proximon: "#06b6d4",
  archivist: "#9ca3af",
};

function coerceJobs(raw: unknown): RawCronJob[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((j) => (typeof j === "object" && j !== null ? (j as RawCronJob) : {}));
}

function buildEvents(jobs: RawCronJob[], history: Record<string, unknown>[]) {
  return jobs.map((job, i) => {
    const parsed = parseCronSchedule(job.schedule || "");
    const agentKey = (job.agent || "").toLowerCase().replace(/\s+/g, "-");
    const accent = AGENT_COLORS[agentKey] || "#818cf8";

    const lastExec = history.filter((h: Record<string, unknown>) =>
      (h.id === job.id || h.name === job.name)
    ).pop();

    return {
      id: job.id || String(i + 1),
      time: parsed.time,
      label: job.name || job.id || `Cron ${i + 1}`,
      agent: job.agent || "System",
      accent,
      frequency: parsed.frequency,
      days: parsed.days,
      enabled: job.enabled !== false,
      schedule: job.schedule || "",
      description: job.description || job.prompt?.slice(0, 80) || "",
      lastRun: (lastExec as Record<string, unknown>)?.time as string || job.lastRun || null,
      lastResult: (lastExec as Record<string, unknown>)?.status as string || job.lastResult || null,
    };
  });
}

const emptyStats = { total: 0, enabled: 0, disabled: 0 };

function respond(
  events: ReturnType<typeof buildEvents>,
  source: "live" | "firestore" | "empty" | "error",
  paths: { cronDir: string; cronJobs: string; cronHistory: string },
  extra?: { error?: string }
) {
  return NextResponse.json(
    {
      events,
      total: events.length,
      enabled: events.filter(e => e.enabled).length,
      disabled: events.filter(e => !e.enabled).length,
      source,
      paths,
      ...extra,
    },
    { headers: { "X-CC-Calendar-Source": source } }
  );
}

export async function GET() {
  const cronDir = resolveOpenclawCronDir();
  const cronPath = join(cronDir, "jobs.json");
  const historyPath = join(cronDir, "history.json");
  const paths = { cronDir, cronJobs: cronPath, cronHistory: historyPath };

  try {
    if (existsSync(cronPath)) {
      const raw = readFileSync(cronPath, "utf-8");
      const parsed = JSON.parse(raw) as unknown;
      const jobs = coerceJobs(parsed);
      if (jobs.length === 0 && !Array.isArray(parsed)) {
        return respond([], "empty", paths, { error: "jobs.json not an array" });
      }

      let history: Record<string, unknown>[] = [];
      if (existsSync(historyPath)) {
        try {
          const histRaw = readFileSync(historyPath, "utf-8");
          const h = JSON.parse(histRaw) as unknown;
          history = Array.isArray(h) ? (h as Record<string, unknown>[]) : [];
        } catch { /* ignore */ }
      }

      const events = buildEvents(jobs, history);
      return respond(events, "live", paths);
    }

    const fs = await fetchCommandCenterCronJobsFromFirestore();
    if (fs && fs.jobs.length > 0) {
      const jobs = coerceJobs(fs.jobs);
      const events = buildEvents(jobs, fs.history);
      return respond(events, "firestore", paths);
    }

    return respond([], "empty", paths, {
      error:
        "jobs.json not on host; sync via POST /api/command-center/firestore-sync or set OPENCLAW_CRON_DIR / OPENCLAW_HOME",
    });
  } catch (e) {
    return NextResponse.json(
      {
        events: [],
        error: String(e),
        source: "error",
        paths,
        ...emptyStats,
      },
      { status: 500, headers: { "X-CC-Calendar-Source": "error" } }
    );
  }
}
