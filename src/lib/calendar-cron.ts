/**
 * Parse OpenClaw / cron schedule strings for CC calendar grid placement.
 */

/** OpenClaw often stores schedule as `{ expr: "0 7 * * *" }`, `{ everyMs }`, or a plain string. */
export function flattenScheduleFromJob(o: Record<string, unknown>): string {
  const s = o.schedule;
  if (typeof s === "string") return s;
  if (s && typeof s === "object") {
    const x = s as Record<string, unknown>;
    if (typeof x.expr === "string") return x.expr;
    if (typeof x.cron === "string") return x.cron;
    if (x.kind === "at" && typeof x.at === "string") {
      const d = new Date(x.at);
      if (!isNaN(d.getTime())) {
        return `at ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      }
    }
    if (typeof x.everyMs === "number") {
      return `every ${Math.round(x.everyMs / 60000)}m`;
    }
  }
  return "";
}

export function parseCronSchedule(schedule: string): { time: string; days: string[]; frequency: string } {
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
    const h = parseInt(hour, 10) || 0;
    const m = parseInt(min, 10) || 0;
    const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

    const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    if (dow === "*") return { time, days: ALL_DAYS, frequency: "Daily" };

    const dayMap: Record<string, string> = {
      "0": "Sun", "1": "Mon", "2": "Tue", "3": "Wed", "4": "Thu", "5": "Fri", "6": "Sat", "7": "Sun",
    };
    const days = dow.split(",").map((d) => dayMap[d] || d).filter(Boolean);
    return { time, days, frequency: days.length === 7 ? "Daily" : days.join(", ") };
  }

  return { time: "00:00", days: [], frequency: schedule };
}

/** Normalized cron row from jobs.json / Firestore before building calendar events. */
export interface RawCronJob {
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

export function normalizeCronJobEntry(j: unknown): RawCronJob {
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

export function jobsPayloadShapeOk(parsed: unknown): boolean {
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

export function coerceJobs(raw: unknown): RawCronJob[] {
  let arr: unknown[] = [];
  if (Array.isArray(raw)) arr = raw;
  else if (raw && typeof raw === "object" && "jobs" in raw) {
    const j = (raw as { jobs: unknown }).jobs;
    if (Array.isArray(j)) arr = j;
  }
  return arr.map((j) => normalizeCronJobEntry(j));
}
