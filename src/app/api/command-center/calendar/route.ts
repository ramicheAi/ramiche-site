import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { fetchCommandCenterCronJobsFromFirestore } from "@/lib/firebase-admin";
import { resolveOpenclawCronDir } from "@/lib/openclaw-paths";
import { parseCronSchedule } from "@/lib/calendar-cron";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RawCronJob {
  id?: string;
  name?: string;
  schedule?: string;
  enabled?: boolean;
  agent?: string;
  agentId?: string;
  prompt?: string;
  lastRun?: string;
  lastResult?: string;
  model?: string;
  description?: string;
}

/** OpenClaw often stores schedule as `{ expr: "0 7 * * *" }`, `{ everyMs }`, and agent as `agentId`. */
function flattenScheduleFromJob(o: Record<string, unknown>): string {
  const s = o.schedule;
  if (typeof s === "string") return s;
  if (s && typeof s === "object") {
    const x = s as Record<string, unknown>;
    if (typeof x.expr === "string") return x.expr;
    if (typeof x.cron === "string") return x.cron;
    if (typeof x.everyMs === "number") {
      return `every ${Math.round(x.everyMs / 60000)}m`;
    }
  }
  return "";
}

function normalizeCronJobEntry(j: unknown): RawCronJob {
  if (typeof j !== "object" || j === null) return {};
  const o = j as Record<string, unknown>;
  const schedule = flattenScheduleFromJob(o);
  const agentRaw = o.agent ?? o.agentId;
  const agent = typeof agentRaw === "string" ? agentRaw : undefined;
  const base = j as RawCronJob;
  return {
    ...base,
    schedule: schedule || base.schedule,
    agent: agent ?? base.agent,
  };
}

function jobsPayloadShapeOk(parsed: unknown): boolean {
  if (Array.isArray(parsed)) return true;
  if (
    parsed &&
    typeof parsed === "object" &&
    "jobs" in parsed &&
    Array.isArray((parsed as { jobs: unknown }).jobs)
  ) {
    return true;
  }
  return false;
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
  let arr: unknown[] = [];
  if (Array.isArray(raw)) arr = raw;
  else if (raw && typeof raw === "object" && "jobs" in raw) {
    const j = (raw as { jobs: unknown }).jobs;
    if (Array.isArray(j)) arr = j;
  }
  return arr.map((j) => normalizeCronJobEntry(j));
}

function buildEvents(jobs: RawCronJob[], history: Record<string, unknown>[]) {
  return jobs.map((job, i) => {
    const schedStr = job.schedule || "";
    const parsed = parseCronSchedule(schedStr);
    const agentLabel = job.agent || job.agentId || "";
    const agentKey = agentLabel.toLowerCase().replace(/\s+/g, "-");
    const accent = AGENT_COLORS[agentKey] || "#818cf8";

    const lastExec = history.filter((h: Record<string, unknown>) =>
      (h.id === job.id || h.name === job.name)
    ).pop();

    return {
      id: job.id || String(i + 1),
      time: parsed.time,
      label: job.name || job.id || `Cron ${i + 1}`,
      agent: agentLabel || "System",
      accent,
      frequency: parsed.frequency,
      days: parsed.days,
      enabled: job.enabled !== false,
      schedule: schedStr,
      description: job.description || job.prompt?.slice(0, 80) || "",
      lastRun: (lastExec as Record<string, unknown>)?.time as string || job.lastRun || null,
      lastResult: (lastExec as Record<string, unknown>)?.status as string || job.lastResult || null,
    };
  });
}

const emptyStats = { total: 0, enabled: 0, disabled: 0 };

type CalendarPaths = {
  workspace: string;
  cronDir: string;
  cronJobs: string;
  cronHistory: string;
};

function respond(
  events: ReturnType<typeof buildEvents>,
  source: "live" | "firestore" | "empty" | "error",
  paths: CalendarPaths,
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
  const workspace = process.env.OPENCLAW_WORKSPACE ?? "/Users/admin/.openclaw/workspace";
  const cronDir = resolveOpenclawCronDir();
  const cronPath = join(cronDir, "jobs.json");
  const historyPath = join(cronDir, "history.json");
  const paths: CalendarPaths = {
    workspace,
    cronDir,
    cronJobs: cronPath,
    cronHistory: historyPath,
  };

  try {
    if (existsSync(cronPath)) {
      const raw = readFileSync(cronPath, "utf-8");
      const parsed = JSON.parse(raw) as unknown;
      const jobs = coerceJobs(parsed);
      if (jobs.length === 0 && !jobsPayloadShapeOk(parsed)) {
        return respond([], "empty", paths, {
          error: "jobs.json must be a JSON array or { \"jobs\": [ ... ] }",
        });
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
