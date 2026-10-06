#!/usr/bin/env node
/**
 * P06 M6F: one reaper pass on the execution host (the cockpit host, where runs execute): stop runs orphaned by a
 * cockpit restart, then fail executions abandoned by a dead process. Scheduled by a LaunchAgent in the founder's GUI
 * session (ops/execution/com.parallax.m6-reaper.plist, prepared and NOT loaded until activation).
 *
 *   node --experimental-strip-types scripts/m6-reap.mjs --env-file .env.production.local [--dry-run] [--status <file>]
 *
 * --dry-run reads only: it lists and judges, writes nothing, signals nothing, and prints what it would do.
 * The status file (default ~/.parallax/executions/reaper-status.json) is what execution health reads. Exit 0 when the
 * pass was clean, 1 when it failed or a run is still alive past its deadline, 2 on bad configuration.
 * Prints no secrets.
 */
import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { homedir, hostname } from "node:os";
import { dirname, join, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "..");
registerHooks({
  resolve(specifier, context, next) {
    let target = null;
    if (specifier.startsWith("@/")) target = join(ROOT, "src", specifier.slice(2));
    else if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.endsWith(".ts")) target = resolvePath(dirname(fileURLToPath(context.parentURL)), specifier);
    if (target) for (const c of [target, `${target}.ts`, join(target, "index.ts")]) {
      if (existsSync(c) && !c.endsWith("/")) { try { if (readFileSync(c)) return { url: pathToFileURL(c).href, format: c.endsWith(".ts") ? "module-typescript" : undefined, shortCircuit: true }; } catch { /* dir */ } }
    }
    return next(specifier, context);
  },
});

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const DRY = process.argv.includes("--dry-run");
const envFile = arg("--env-file", null);
const env = { ...process.env };
if (envFile) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && env[m[1]] === undefined) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}
const url = env.NEXT_PUBLIC_SUPABASE_URL, key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("m6-reap: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (names only; values never printed)"); process.exit(2); }

const { createClient } = await import("@supabase/supabase-js");
const { supabaseJobsDb } = await import("@/lib/execution/supabase-jobs-db");
const { inspectProcess, processAlive, reaperPass } = await import("@/lib/execution/reaper");

const real = supabaseJobsDb(createClient(url, key, { auth: { persistSession: false } }));
const intended = [];
// Dry run: every read is real; every write and signal is recorded and NOT performed.
const db = DRY ? {
  ...real,
  insertJob: async (row) => { intended.push({ insertJob: row.id }); return { conflict: false, error: null }; },
  updateJob: async (id, patch) => { intended.push({ updateJob: id, status: patch.status }); return { error: null }; },
  insertEvent: async (row) => { intended.push({ insertEvent: row.kind, job: row.job_id }); return { error: null }; },
  updateJobIf: async (id, _e, patch) => { intended.push({ updateJobIf: id, status: patch.status }); return { updated: false, error: null }; },
} : real;
const execRootRaw = arg("--exec-root", join(homedir(), ".parallax", "executions"));
const execRoot = existsSync(execRootRaw) ? realpathSync(execRootRaw) : execRootRaw;
const status = await reaperPass({
  db, host: hostname(), isAlive: processAlive, inspect: inspectProcess, execRoot, now: Date.now(),
  claudeBin: env.CC_CLAUDE_BIN ?? join(homedir(), ".local", "bin", "claude"),
  kill: DRY ? (pid, sig) => { intended.push({ signal: sig, group: -pid }); } : (pid, sig) => process.kill(pid, sig),
});
const report = { ...status, dryRun: DRY, ...(DRY ? { intended } : {}) };
if (DRY) console.log(JSON.stringify(report, null, 2));
else {
  const file = arg("--status", join(homedir(), ".parallax", "executions", "reaper-status.json"));
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(`${file}.tmp`, JSON.stringify(report, null, 2));
  renameSync(`${file}.tmp`, file);   // atomic: health never reads a half-written status
  console.log(`${report.at} reaper ok=${report.ok} stopped=${report.stopped} reaped=${report.reaped} stuck=${report.stuck}${report.error ? ` error=${report.error}` : ""}`);
}
process.exit(status.ok ? 0 : 1);
