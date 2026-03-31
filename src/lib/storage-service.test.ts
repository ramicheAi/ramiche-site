import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Athlete } from "@/app/apex-athlete/coach/types";

const { setDoc, getDoc, doc } = vi.hoisted(() => ({
  setDoc: vi.fn().mockResolvedValue(undefined),
  getDoc: vi.fn(),
  doc: vi.fn(() => ({ id: "mock-doc-path" })),
}));

vi.mock("firebase/firestore", () => ({
  doc,
  setDoc,
  getDoc,
}));

vi.mock("./firebase", () => ({ db: {} }));

import { StorageService } from "./storage-service";

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
    clear() {
      data.clear();
    },
  } as Storage;
}

function minimalAthlete(overrides: Partial<Athlete> = {}): Athlete {
  return {
    id: "1",
    name: "A",
    age: 12,
    gender: "M",
    group: "g",
    xp: 100,
    streak: 0,
    weightStreak: 0,
    lastStreakDate: "",
    lastWeightStreakDate: "",
    totalPractices: 0,
    weekSessions: 0,
    weekWeightSessions: 0,
    weekTarget: 0,
    checkpoints: {},
    weightCheckpoints: {},
    meetCheckpoints: {},
    weightChallenges: {},
    quests: {},
    dailyXP: { date: "", pool: 0, weight: 0, meet: 0 },
    ...overrides,
  } as Athlete;
}

describe("StorageService", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", makeLocalStorage());
    setDoc.mockClear();
    getDoc.mockReset();
    doc.mockClear();
    setDoc.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("saveRoster no-ops on empty roster", async () => {
    await StorageService.saveRoster([], "org1");
    expect(setDoc).not.toHaveBeenCalled();
    expect(localStorage.getItem("apex-athlete-roster-v5")).toBeNull();
  });

  it("saveRoster writes localStorage and calls setDoc", async () => {
    const roster = [minimalAthlete({ xp: 500 })];
    await StorageService.saveRoster(roster, "org1");
    const raw = globalThis.localStorage.getItem("apex-athlete-roster-v5");
    expect(raw).toBeTruthy();
    expect(setDoc).toHaveBeenCalled();
  });

  it("saveRoster skips when new total XP is far below local (anti-reset)", async () => {
    const high = [minimalAthlete({ xp: 5000 })];
    localStorage.setItem("apex-athlete-roster-v5", JSON.stringify(high));
    const low = [minimalAthlete({ xp: 100 })];
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await StorageService.saveRoster(low);
    expect(err).toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem("apex-athlete-roster-v5")!)).toEqual(high);
    expect(setDoc).not.toHaveBeenCalled();
    err.mockRestore();
  });

  it("loadRoster returns local data when present", async () => {
    const roster = [minimalAthlete({ id: "x" })];
    localStorage.setItem("apex-athlete-roster-v5", JSON.stringify(roster));
    const out = await StorageService.loadRoster();
    expect(out).toEqual(roster);
    expect(getDoc).not.toHaveBeenCalled();
  });

  it("loadRoster falls back when local JSON is invalid", async () => {
    localStorage.setItem("apex-athlete-roster-v5", "not-json");
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    getDoc.mockResolvedValue({
      exists: () => false,
    });
    const out = await StorageService.loadRoster("org-x");
    expect(out).toBeNull();
    expect(err).toHaveBeenCalled();
    expect(getDoc).toHaveBeenCalled();
    err.mockRestore();
  });

  it("loadRoster falls back to Firestore and caches locally", async () => {
    const fromRemote = [minimalAthlete({ id: "r" })];
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ athletes: fromRemote }),
    });
    const out = await StorageService.loadRoster("org-x");
    expect(out).toEqual(fromRemote);
    expect(localStorage.getItem("apex-athlete-roster-v5")).toBeTruthy();
  });

  it("clearAll removes known keys", () => {
    localStorage.setItem("apex-athlete-roster-v5", "[]");
    localStorage.setItem("apex-coach-auth", "{}");
    StorageService.clearAll();
    expect(localStorage.getItem("apex-athlete-roster-v5")).toBeNull();
    expect(localStorage.getItem("apex-coach-auth")).toBeNull();
  });
});
