/** P06 M6F: execution health reduces to one founder line; reasons stay behind it and carry no secrets or paths. */
import { describe, expect, it } from "vitest";
import { executionHealth, REAPER_SILENT_MS, type HealthSignals } from "./health";

const NOW = Date.parse("2026-10-06T18:00:00Z");
const good = (over: Partial<HealthSignals> = {}): HealthSignals => ({
  now: NOW, dispatchEnabled: true, ceiling: "L1", claude: "ok", repoAccess: "ok", diskFreeBytes: 30 * 1024 ** 3, minFreeBytes: 4 * 1024 ** 3,
  store: "ok", running: 0, stuck: 0, staleHeartbeats: 0, failures24h: 0, reaper: { at: new Date(NOW - 60_000).toISOString(), ok: true, error: null }, ...over,
});

describe("execution health", () => {
  it("ready names what is allowed", () => {
    expect(executionHealth(good())).toEqual({ state: "ready", headline: "Ready · inspect and analyze", readiness: "ready", reasons: [] });
  });
  it("dispatch off says Off, but still reports what would block activation", () => {
    expect(executionHealth(good({ dispatchEnabled: false, claude: "logged_out" }))).toMatchObject({ state: "off", headline: "Off", readiness: "blocked", reasons: ["Claude login required"] });
  });
  it("blockers win over degradations, in a fixed order", () => {
    expect(executionHealth(good({ claude: "logged_out", stuck: 2 })).headline).toBe("Blocked · Claude login required");
    expect(executionHealth(good({ repoAccess: "unavailable" })).headline).toBe("Blocked · Repository access needs attention on the execution host");
    expect(executionHealth(good({ diskFreeBytes: 1024 ** 3 })).headline).toBe("Blocked · Low disk on the execution host");
    expect(executionHealth(good({ diskFreeBytes: null })).state).toBe("blocked");
    expect(executionHealth(good({ store: "error" })).headline).toBe("Blocked · Execution records unavailable");
    expect(executionHealth(good({ claude: "unknown" })).state).toBe("blocked");
  });
  it("a silent or failing reaper, stuck runs and silent heartbeats degrade", () => {
    expect(executionHealth(good({ reaper: { at: null, ok: null, error: null } })).headline).toBe("Degraded · Recovery check is not running");
    expect(executionHealth(good({ reaper: { at: new Date(NOW - REAPER_SILENT_MS).toISOString(), ok: true, error: null } })).state).toBe("degraded");
    expect(executionHealth(good({ reaper: { at: new Date(NOW - 1000).toISOString(), ok: false, error: "error" } })).headline).toBe("Degraded · Recovery check failed");
    expect(executionHealth(good({ stuck: 1 })).headline).toBe("Degraded · 1 run stuck");
    expect(executionHealth(good({ staleHeartbeats: 2 })).headline).toBe("Degraded · 2 runs not reporting");
    expect(executionHealth(good({ failures24h: 3 })).state).toBe("degraded");
    expect(executionHealth(good({ repoAccess: "unchecked" })).state).toBe("ready");   // only a failed check blocks
  });
});
