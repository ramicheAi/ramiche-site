import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("./firebase", () => ({
  hasConfig: false,
  fbSet: vi.fn(),
  fbGet: vi.fn(),
  fbSaveRoster: vi.fn(),
  fbGetRoster: vi.fn(),
  fbSaveConfig: vi.fn(),
  fbGetConfig: vi.fn(),
  fbSaveSchedule: vi.fn(),
  fbGetSchedule: vi.fn(),
  fbSaveAudit: vi.fn(),
  fbSaveSnapshot: vi.fn(),
  fbSaveFeedback: vi.fn(),
  fbListenRoster: vi.fn(),
  fbListenConfig: vi.fn(),
  fbBatchSaveRosters: vi.fn(),
}));

import {
  computeTeamSummary,
  syncSaveRoster,
  syncSave,
  syncListenRoster,
  syncListenConfig,
  syncPushAllToFirebase,
  syncSaveTeamSummary,
  syncLoadTeamSummary,
  syncLoad,
} from "./apex-sync";

function makeLocalStorage() {
  const data = new Map<string, string>();
  return {
    getItem(k: string) {
      return data.has(k) ? data.get(k)! : null;
    },
    setItem(k: string, v: string) {
      data.set(k, v);
    },
    removeItem(k: string) {
      data.delete(k);
    },
  } as Storage;
}

describe("apex-sync", () => {
  beforeEach(() => {
    const ls = makeLocalStorage();
    vi.stubGlobal("localStorage", ls);
    vi.stubGlobal("window", { localStorage: ls });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("computeTeamSummary aggregates athletes", () => {
    const s = computeTeamSummary([
      { name: "A", xp: 10, group: "g1", totalPractices: 1 },
      { name: "B", xp: 5, group: "g1", totalPractices: 0 },
    ]);
    expect(s.totalAthletes).toBe(2);
    expect(s.totalXP).toBe(15);
    expect(s.activeAthletes).toBe(1);
    expect(s.groupCounts.g1).toBe(2);
    expect(s.topAthletes[0]?.name).toBe("A");
  });

  it("computeTeamSummary handles empty roster", () => {
    const s = computeTeamSummary([]);
    expect(s.totalAthletes).toBe(0);
    expect(s.avgXP).toBe(0);
    expect(s.topAthletes).toEqual([]);
  });

  it("syncSave persists non-roster payload locally without fbPath", () => {
    syncSave("cfg-key", { foo: 1 }, undefined);
    expect(JSON.parse(localStorage.getItem("cfg-key")!)).toEqual({ foo: 1 });
  });

  it("syncSaveTeamSummary writes apex-team-summary", () => {
    syncSaveTeamSummary([{ name: "Only", xp: 3, group: "g" }]);
    const raw = localStorage.getItem("apex-team-summary");
    expect(raw).toBeTruthy();
    const s = JSON.parse(raw!) as { totalAthletes: number; totalXP: number };
    expect(s.totalAthletes).toBe(1);
    expect(s.totalXP).toBe(3);
  });

  it("syncSaveRoster does not write when all XP is zero", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    syncSaveRoster("k", "g", [{ xp: 0 }]);
    expect(warn).toHaveBeenCalled();
    expect(localStorage.getItem("k")).toBeNull();
  });

  it("syncSaveRoster writes local roster when XP present", () => {
    syncSaveRoster("rk", "g", [{ id: "1", xp: 10 }]);
    expect(localStorage.getItem("rk")).toBeTruthy();
  });

  it("syncSave blocks zero-XP roster array for rosters path", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    syncSave("sk", [], "rosters/platinum");
    expect(warn).toHaveBeenCalled();
    expect(localStorage.getItem("sk")).toBeNull();
  });

  it("syncListenRoster returns null without Firebase config", () => {
    expect(syncListenRoster("k", "g", vi.fn())).toBeNull();
  });

  it("syncListenConfig returns null without Firebase config", () => {
    expect(syncListenConfig("ls", "pin", vi.fn())).toBeNull();
  });

  it("syncPushAllToFirebase is a no-op without config", async () => {
    const r = await syncPushAllToFirebase();
    expect(r).toEqual({ synced: 0, errors: 0 });
  });

  it("syncLoadTeamSummary returns null when nothing cached", async () => {
    await expect(syncLoadTeamSummary()).resolves.toBeNull();
  });

  it("syncLoad returns null without local data and no Firebase", async () => {
    await expect(syncLoad("no-such-key", "config/foo")).resolves.toBeNull();
  });
});
