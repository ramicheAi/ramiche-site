import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  appendEvent,
  getAllEvents,
  getSessionEvents,
  getAthleteEvents,
  queryEvents,
  deriveTotalXP,
  deriveAttendanceCount,
  exportEvents,
  compactEvents,
} from "./event-store";

function makeLS() {
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

describe("event-store", () => {
  beforeEach(() => vi.stubGlobal("localStorage", makeLS()));
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("append and filter", () => {
    appendEvent("check_in", "s1", "a1", {});
    appendEvent("xp_awarded", "s1", "a1", { amount: 5 });
    expect(getSessionEvents("s1").length).toBe(2);
    expect(getAthleteEvents("a1").length).toBe(2);
    expect(queryEvents("xp_awarded", undefined, undefined, "a1").length).toBe(1);
    expect(deriveTotalXP("a1")).toBe(5);
  });

  it("exportEvents since", () => {
    const e = appendEvent("note_added", "s", "a1", {});
    expect(exportEvents(e.timestamp + 1)).toHaveLength(0);
  });

  it("exportEvents without since returns full log", () => {
    appendEvent("note_added", "s", "a1", {});
    appendEvent("check_in", "s", "a2", {});
    expect(exportEvents()).toHaveLength(2);
  });

  it("deriveAttendanceCount counts check_ins for athlete", () => {
    appendEvent("check_in", "s1", "a1", {});
    appendEvent("check_in", "s2", "a1", {});
    appendEvent("check_in", "s1", "a2", {});
    expect(deriveAttendanceCount("a1")).toBe(2);
  });

  it("deriveAttendanceCount respects since cutoff", () => {
    localStorage.setItem(
      "mettle-event-log",
      JSON.stringify([
        {
          id: "old",
          timestamp: 1000,
          type: "check_in",
          sessionId: "s",
          athleteId: "a1",
          data: {},
        },
        {
          id: "new",
          timestamp: 5000,
          type: "check_in",
          sessionId: "s",
          athleteId: "a1",
          data: {},
        },
      ])
    );
    expect(deriveAttendanceCount("a1", 2000)).toBe(1);
  });

  it("queryEvents filters by time range", () => {
    localStorage.setItem(
      "mettle-event-log",
      JSON.stringify([
        {
          id: "e1",
          timestamp: 1000,
          type: "check_in",
          sessionId: "s",
          athleteId: "a1",
          data: {},
        },
        {
          id: "e2",
          timestamp: 5000,
          type: "check_in",
          sessionId: "s",
          athleteId: "a1",
          data: {},
        },
      ])
    );
    const inRange = queryEvents("check_in", 2000, 6000, "a1");
    expect(inRange).toHaveLength(1);
    expect(inRange[0]?.id).toBe("e2");
  });

  it("getAllEvents returns empty array on invalid JSON", () => {
    localStorage.setItem("mettle-event-log", "not-json");
    expect(getAllEvents()).toEqual([]);
  });

  it("compactEvents drops old", () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);
    localStorage.setItem(
      "mettle-event-log",
      JSON.stringify([
        {
          id: "o",
          timestamp: now - 100 * 86400000,
          type: "check_in",
          sessionId: "s",
          athleteId: "a",
          data: {},
        },
      ])
    );
    compactEvents(90);
    expect(getAllEvents().length).toBe(0);
  });

  it("compactEvents returns kept count and archived slice", () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);
    const oldTs = now - 100 * 86400000;
    localStorage.setItem(
      "mettle-event-log",
      JSON.stringify([
        {
          id: "old",
          timestamp: oldTs,
          type: "check_in",
          sessionId: "s",
          athleteId: "a",
          data: {},
        },
        {
          id: "new",
          timestamp: now,
          type: "check_in",
          sessionId: "s",
          athleteId: "a",
          data: {},
        },
      ])
    );
    const { kept, archived } = compactEvents(90);
    expect(kept).toBe(1);
    expect(archived).toHaveLength(1);
    expect(archived[0]?.id).toBe("old");
    expect(getAllEvents().length).toBe(1);
    expect(getAllEvents()[0]?.id).toBe("new");
  });
});
