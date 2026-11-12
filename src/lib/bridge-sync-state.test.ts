import { describe, it, expect } from "vitest";
import { deriveSyncState, isLiveStatus, type CollectionSyncResult } from "./bridge-sync-state";

const NOW = 1_700_000_000_000;
const BUDGET = 2 * 60_000;

function cols(accepted: number, total: number): CollectionSyncResult[] {
  return Array.from({ length: total }, (_, i) => ({
    name: `col-${i}`,
    accepted: i < accepted,
    required: true,
  }));
}

describe("deriveSyncState", () => {
  // NT-1: the headline test — a process that ticks every cycle but accepts
  // nothing must never be classified LIVE, regardless of how fresh the tick is.
  it("NT-1: 0/11 accepted is never LIVE even on a perfectly fresh tick", () => {
    const result = deriveSyncState({
      lastCycle: cols(0, 11),
      lastAttemptedAtMs: NOW,
      nowMs: NOW,
      freshnessBudgetMs: BUDGET,
    });
    expect(result.status).not.toBe("live");
    expect(result.status).toBe("failed");
    expect(result.accepted).toBe(0);
    expect(result.required).toBe(11);
  });

  it("NT-2: an auth-rejected cycle (0 accepted) is FAILED, not UNKNOWN or LIVE", () => {
    const result = deriveSyncState({
      lastCycle: cols(0, 11),
      lastAttemptedAtMs: NOW - 1_000,
      nowMs: NOW,
      freshnessBudgetMs: BUDGET,
    });
    expect(result.status).toBe("failed");
  });

  it("NT-4: partial acceptance missing a required collection is not LIVE", () => {
    const partial: CollectionSyncResult[] = [
      ...cols(10, 10).map((c) => ({ ...c, required: true })),
      { name: "projects", accepted: false, required: true },
    ];
    const result = deriveSyncState({
      lastCycle: partial,
      lastAttemptedAtMs: NOW,
      nowMs: NOW,
      freshnessBudgetMs: BUDGET,
    });
    expect(result.status).toBe("failed");
  });

  it("NT-4b: full acceptance of all required collections IS live within budget", () => {
    const result = deriveSyncState({
      lastCycle: cols(11, 11),
      lastAttemptedAtMs: NOW,
      nowMs: NOW,
      freshnessBudgetMs: BUDGET,
    });
    expect(result.status).toBe("live");
    expect(isLiveStatus(result)).toBe(true);
  });

  it("goes STALE once a fully-accepted cycle ages past the freshness budget", () => {
    const result = deriveSyncState({
      lastCycle: cols(11, 11),
      lastAttemptedAtMs: NOW - BUDGET - 1,
      nowMs: NOW,
      freshnessBudgetMs: BUDGET,
    });
    expect(result.status).toBe("stale");
  });

  it("NT-10: process liveness with no acceptance evidence is never mistaken for sync — UNKNOWN before any cycle completes", () => {
    const result = deriveSyncState({
      lastCycle: null,
      lastAttemptedAtMs: null,
      nowMs: NOW,
      freshnessBudgetMs: BUDGET,
    });
    expect(result.status).not.toBe("live");
    expect(result.status).toBe("unknown");
  });

  it("an in-flight attempt with no prior cycle is PENDING, not LIVE or UNKNOWN-silent", () => {
    const result = deriveSyncState({
      lastCycle: null,
      lastAttemptedAtMs: null,
      nowMs: NOW,
      freshnessBudgetMs: BUDGET,
      pending: true,
    });
    expect(result.status).toBe("pending");
  });

  it("NT-11: a collection marked not-required never forces FAILED on its own, and is excluded from the required count", () => {
    const mixed: CollectionSyncResult[] = [
      { name: "agents", accepted: true, required: true },
      { name: "links", accepted: false, required: false }, // static/hardcoded, by design
    ];
    const result = deriveSyncState({
      lastCycle: mixed,
      lastAttemptedAtMs: NOW,
      nowMs: NOW,
      freshnessBudgetMs: BUDGET,
    });
    expect(result.status).toBe("live");
    expect(result.required).toBe(1);
  });

  it("future-dated attempt (clock skew) is UNKNOWN, never LIVE", () => {
    const result = deriveSyncState({
      lastCycle: cols(11, 11),
      lastAttemptedAtMs: NOW + 10_000,
      nowMs: NOW,
      freshnessBudgetMs: BUDGET,
    });
    expect(result.status).toBe("unknown");
  });

  it("zero required collections never claims LIVE from an empty set", () => {
    const result = deriveSyncState({
      lastCycle: [{ name: "links", accepted: false, required: false }],
      lastAttemptedAtMs: NOW,
      nowMs: NOW,
      freshnessBudgetMs: BUDGET,
    });
    expect(result.status).toBe("failed");
    expect(result.required).toBe(0);
  });
});
