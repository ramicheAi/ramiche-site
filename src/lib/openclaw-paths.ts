import { existsSync } from "fs";
import { join } from "path";

const WS = process.env.OPENCLAW_WORKSPACE ?? "/Users/admin/.openclaw/workspace";

/** Resolve the directory containing cron jobs.json + history.json */
export function resolveOpenclawCronDir(): string {
  const candidates = [
    join(WS, "crons"),
    process.env.OPENCLAW_CRON_DIR ?? "",
    "/Users/admin/.openclaw/cron",
    join(process.env.OPENCLAW_HOME ?? "/Users/admin/.openclaw", "cron"),
  ].filter(Boolean);
  for (const dir of candidates) {
    if (existsSync(join(dir, "jobs.json"))) return dir;
  }
  return WS;
}
