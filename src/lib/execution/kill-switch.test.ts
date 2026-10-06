/**
 * P06 M6F kill switch: with PRODUCTION_DISPATCH_ENABLED false, the production surface refuses before any job record,
 * approval check, remote read, CLI or provider call, and no environment variable can turn it on.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { approve, approvalKey } from "./approval";
import type { ExecutionRequest } from "./contract";
import { runExecution } from "./executor";
import { PRODUCTION_DISPATCH_ENABLED, PRODUCTION_MAX_CAPABILITY, surfaceAllowed, withinCeiling } from "./policy";
import { executionAvailable } from "./service";
import type { ExecutionStore } from "./store";

const KEY = approvalKey("q".repeat(48))!;
const req: ExecutionRequest = {
  executionId: "00000000-0000-4000-8000-0000000000e1", commandId: null, missionId: null, founder: { uid: "owner" }, executor: "claude_code",
  project: { slug: "mettle" }, repository: { origin: "ramicheAi/mettle", branch: "main", head: "a".repeat(40) },
  task: { instruction: "Inspect METTLE.", contextRefs: [] }, capability: "L1", limits: { timeoutMs: 60_000, maxTurns: 5, maxBudgetUsd: null },
  idempotencyKey: "kill-switch-1", createdAt: new Date().toISOString(),
};
afterEach(() => vi.unstubAllEnvs());

describe("kill switch: production dispatch off", () => {
  it("is a compile-time constant and the production ceiling is read-only", () => {
    expect(PRODUCTION_DISPATCH_ENABLED).toBe(false);
    expect(PRODUCTION_MAX_CAPABILITY).toBe("L1");
    expect(["L0", "L1"].every((c) => withinCeiling("production", c as "L0"))).toBe(true);
    expect(["L2", "L3", "L4"].some((c) => withinCeiling("production", c as "L2"))).toBe(false);
  });

  it("refuses before the job store, the approval, the remote, the CLI and telemetry are touched", async () => {
    const store = { begin: vi.fn(), finish: vi.fn(), heartbeat: vi.fn(), recordProcess: vi.fn(), cancelRequested: vi.fn() } as unknown as ExecutionStore;
    const remoteTip = vi.fn(), telemetry = vi.fn(), freeBytes = vi.fn(() => 1e12);
    // With no approval at all: had the approval been checked first, this would say approval_missing.
    const out = await runExecution(req, null, {
      surface: "production", ownerUid: "owner", approvalKey: KEY, roots: ["/nonexistent"], execRoot: "/nonexistent/exec", store,
      claudeBin: "/nonexistent/claude", remoteTip, telemetry, freeBytes,
    });
    expect(out).toMatchObject({ status: "rejected", failure: { code: "production_dispatch_disabled" } });
    for (const f of [store.begin, store.heartbeat, store.recordProcess, remoteTip, telemetry, freeBytes]) expect(f).not.toHaveBeenCalled();
    const signed = await runExecution(req, approve(req, "owner", KEY), { surface: "production", ownerUid: "owner", approvalKey: KEY, roots: [], execRoot: "/nonexistent", store, claudeBin: "/nonexistent" });
    expect(signed.failure?.code).toBe("production_dispatch_disabled");
  });

  it("no environment variable enables it; the live cockpit build refuses even the harness surface", () => {
    for (const [k, v] of [["PRODUCTION_DISPATCH_ENABLED", "true"], ["EXECUTION_ENABLED", "1"], ["NODE_ENV", "development"], ["NEXT_DIST_DIR", ".next"]]) vi.stubEnv(k, v);
    expect(executionAvailable()).toBe(false);
    expect(surfaceAllowed("production").ok).toBe(false);
    vi.stubEnv("NEXT_DIST_DIR", ".next-cc");
    expect(surfaceAllowed("harness")).toMatchObject({ ok: false, code: "production_dispatch_disabled" });
  });

  it("every app route reaches the executor only as the production surface (no route can select the harness)", () => {
    const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
    const files = walk(join(process.cwd(), "src/app")).filter((f) => /\.(ts|tsx)$/.test(f));
    const offenders = files.filter((f) => /surface:\s*["']harness["']/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
    const approveRoute = readFileSync(join(process.cwd(), "src/app/api/command-center/execution/approve/route.ts"), "utf8");
    expect(approveRoute).toMatch(/surface:\s*"production"/);
  });
});
