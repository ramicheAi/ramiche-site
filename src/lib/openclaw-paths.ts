import { existsSync } from "fs";
import { join } from "path";

const WS = process.env.OPENCLAW_WORKSPACE ?? "/Users/admin/.openclaw/workspace";

/** Resolve the directory containing cron jobs.json + history.json */
export function resolveOpenclawCronDir(): string {
  const primary = join(WS, "crons");
  if (existsSync(primary)) return primary;
  // fallback: workspace root
  return WS;
}
