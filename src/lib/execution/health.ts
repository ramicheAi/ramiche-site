/**
 * P06 M6F execution health: the few signals that decide whether Parallax can run work right now, reduced to one line
 * for the founder ("Ready", or "Blocked · Claude login required"). Details (counts, reasons) stay behind it; no secret,
 * log or path is ever part of it. Pure: the route gathers the signals on the execution host.
 */
import type { Capability } from "./contract-core";

export interface HealthSignals {
  now: number;
  dispatchEnabled: boolean;
  /** The operator's HALT file exists (rollback): shown distinctly from "not activated". */
  halted: boolean;
  ceiling: Capability;
  /** `claude auth status` from the executor's own session. */
  claude: "ok" | "logged_out" | "unknown";
  /** A credentialed read of a registered project's remote head (the stale-head check every run needs). */
  repoAccess: "ok" | "unavailable" | "unchecked";
  diskFreeBytes: number | null;
  minFreeBytes: number;
  store: "ok" | "error";
  running: number;
  /** Running rows past their own deadline (timeout + grace). */
  stuck: number;
  /** Running rows whose heartbeat is stale. */
  staleHeartbeats: number;
  failures24h: number;
  reaper: { at: string | null; ok: boolean | null; error: string | null };
}

export type HealthState = "off" | "ready" | "blocked" | "degraded";
export interface ExecutionHealth { state: HealthState; headline: string; readiness: Exclude<HealthState, "off">; reasons: string[] }

/** The reaper runs every 2 minutes; silence for 10 means it is not running. */
export const REAPER_SILENT_MS = 10 * 60_000;

export function executionHealth(s: HealthSignals): ExecutionHealth {
  const blockers: string[] = [], degraded: string[] = [];
  if (s.claude === "logged_out") blockers.push("Claude login required");
  if (s.claude === "unknown") blockers.push("Claude login could not be checked");
  if (s.repoAccess === "unavailable") blockers.push("Repository access needs attention on the execution host");
  if (s.diskFreeBytes === null || s.diskFreeBytes < s.minFreeBytes) blockers.push("Low disk on the execution host");
  if (s.store === "error") blockers.push("Execution records unavailable");
  const reaperAge = s.reaper.at ? s.now - Date.parse(s.reaper.at) : Infinity;
  if (!(reaperAge < REAPER_SILENT_MS)) degraded.push("Recovery check is not running");
  else if (s.reaper.ok === false) degraded.push(s.reaper.error ? "Recovery check failed" : "A run is still alive past its limit");
  if (s.stuck > 0) degraded.push(`${s.stuck} run${s.stuck === 1 ? "" : "s"} stuck`);
  if (s.staleHeartbeats > 0) degraded.push(`${s.staleHeartbeats} run${s.staleHeartbeats === 1 ? "" : "s"} not reporting`);
  if (s.failures24h >= 3) degraded.push(`${s.failures24h} failed runs today`);
  const readiness = blockers.length ? "blocked" : degraded.length ? "degraded" : "ready";
  const reasons = [...blockers, ...degraded];
  if (s.halted) return { state: "off", headline: "Off · halted on the execution host", readiness, reasons };
  if (!s.dispatchEnabled) return { state: "off", headline: "Off", readiness, reasons };
  const headline = readiness === "ready" ? `Ready · ${s.ceiling === "L1" ? "inspect and analyze" : `up to ${s.ceiling}`}`
    : `${readiness === "blocked" ? "Blocked" : "Degraded"} · ${reasons[0]}`;
  return { state: readiness, headline, readiness, reasons };
}
