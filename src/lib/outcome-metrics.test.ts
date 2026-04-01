import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  calculateOutcomes,
  getOutcomeSummary,
  saveSnapshot,
  getHistory,
} from "./outcome-metrics";

function makeStorage(): Storage {
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
    clear() {
      data.clear();
    },
    get length() {
      return data.size;
    },
    key() {
      return null;
    },
  } as Storage;
}

describe("outcome-metrics", () => {
  it("calculateOutcomes derives rates and totals", () => {
    const roster = [
      { name: "A", xp: 10, streak: 4, questsCompleted: 1, questsAssigned: 2 },
      { name: "B", xp: 0, streak: 0, questsCompleted: 0, questsAssigned: 2 },
    ];
    const snap = calculateOutcomes(roster, ["A"], [{ date: "2026-03-01", count: 3 }]);
    expect(snap.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(snap.teamId).toBe("default");
    expect(snap.attendanceRate).toBe(50);
    expect(snap.totalPractices).toBe(3);
    expect(snap.coachTimeSavedMin).toBe(5);
  });

  it("getOutcomeSummary joins fields", () => {
    const s = getOutcomeSummary({
      date: "2026-03-01",
      teamId: "t",
      attendanceRate: 80,
      activeAthleteRate: 70,
      avgXPPerAthlete: 12,
      questCompletionRate: 90,
      streakCount: 2,
      totalPractices: 10,
      coachTimeSavedMin: 15,
    });
    expect(s).toContain("80% attendance");
    expect(s).toContain("15 min saved");
  });

  describe("localStorage", () => {
    beforeEach(() => {
      vi.stubGlobal("localStorage", makeStorage());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("saveSnapshot and getHistory round-trip", () => {
      const snap = calculateOutcomes([{ name: "A" }], [], []);
      saveSnapshot(snap);
      const h = getHistory();
      expect(h).toHaveLength(1);
      expect(h[0]?.teamId).toBe("default");
    });

    it("getHistory returns empty array on invalid JSON", () => {
      localStorage.setItem("mettle_outcome_metrics", "not-json");
      expect(getHistory()).toEqual([]);
    });
  });
});
