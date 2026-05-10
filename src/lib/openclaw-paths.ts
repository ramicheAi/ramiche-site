import { existsSync } from "fs";
import { join } from "path";

/**
 * Resolve the OpenClaw workspace directory at runtime. Returns `null` when no
 * env var is configured (typical Vercel deployment) so callers can degrade
 * gracefully instead of consulting a host-specific path. Avoiding a literal
 * absolute fallback at module init keeps NFT's static trace from pulling the
 * entire local workspace into the serverless bundle.
 */
function workspaceDir(): string | null {
  const w = process.env.OPENCLAW_WORKSPACE?.trim();
  return w && w.length > 0 ? w : null;
}

function openclawHome(): string | null {
  const h = process.env.OPENCLAW_HOME?.trim();
  return h && h.length > 0 ? h : null;
}

/** Resolve the directory containing cron jobs.json + history.json. */
export function resolveOpenclawCronDir(): string {
  const ws = workspaceDir();
  const home = openclawHome();
  const explicit = process.env.OPENCLAW_CRON_DIR?.trim();

  const candidates = [
    ws ? join(ws, "crons") : null,
    explicit && explicit.length > 0 ? explicit : null,
    home ? join(home, "cron") : null,
  ].filter((c): c is string => typeof c === "string" && c.length > 0);

  for (const dir of candidates) {
    if (existsSync(join(dir, "jobs.json"))) return dir;
  }
  return ws ?? home ?? "";
}
