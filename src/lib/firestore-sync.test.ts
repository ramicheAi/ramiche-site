import { describe, it, expect, vi, beforeEach } from "vitest";

const fsMocks = vi.hoisted(() => ({
  setDoc: vi.fn().mockResolvedValue(undefined),
  getDocs: vi.fn().mockResolvedValue({
    docs: [{ id: "1", data: () => ({ athletes: [], source: "coach" as const, updatedAt: null }) }],
  }),
  onSnapshot: vi.fn((_ref: unknown, onNext: (s: unknown) => void) => {
    onNext({
      exists: () => true,
      data: () => ({ athletes: [{ id: "a" }], source: "coach", updatedAt: null }),
    });
    return () => {};
  }),
  doc: vi.fn(() => ({ path: "teams/t1/roster/current" })),
  collection: vi.fn(() => ({ path: "teams/t1/roster" })),
  serverTimestamp: vi.fn(() => ({ __: "serverTimestamp" })),
}));

vi.mock("firebase/firestore", () => ({
  doc: fsMocks.doc,
  setDoc: fsMocks.setDoc,
  getDocs: fsMocks.getDocs,
  onSnapshot: fsMocks.onSnapshot,
  collection: fsMocks.collection,
  serverTimestamp: fsMocks.serverTimestamp,
}));

vi.mock("@/lib/firebase", () => ({
  hasConfig: true,
  db: {},
}));

import {
  syncRosterToFirestore,
  subscribeToRoster,
  listRosterDocuments,
} from "./firestore-sync";

describe("firestore-sync", () => {
  beforeEach(() => {
    fsMocks.setDoc.mockClear();
    fsMocks.getDocs.mockClear();
  });

  it("syncRosterToFirestore writes merge doc", async () => {
    const ok = await syncRosterToFirestore("t1", [{ id: "1", name: "A" }], "parent");
    expect(ok).toBe(true);
    expect(fsMocks.setDoc).toHaveBeenCalled();
  });

  it("syncRosterToFirestore returns false on write error", async () => {
    fsMocks.setDoc.mockRejectedValueOnce(new Error("network"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ok = await syncRosterToFirestore("t1", [{ id: "1", name: "A" }], "parent");
    expect(ok).toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    fsMocks.setDoc.mockResolvedValue(undefined);
  });

  it("subscribeToRoster returns unsubscribe when configured", () => {
    const unsub = subscribeToRoster("t1", vi.fn());
    expect(typeof unsub).toBe("function");
    unsub?.();
  });

  it("listRosterDocuments maps documents", async () => {
    const rows = await listRosterDocuments("t1");
    expect(rows.length).toBe(1);
    expect(rows[0]?.athletes).toEqual([]);
  });

  it("listRosterDocuments returns empty array on getDocs error", async () => {
    fsMocks.getDocs.mockRejectedValueOnce(new Error("list fail"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const rows = await listRosterDocuments("t1");
    expect(rows).toEqual([]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    fsMocks.getDocs.mockResolvedValue({
      docs: [
        {
          id: "1",
          data: () => ({ athletes: [], source: "coach" as const, updatedAt: null }),
        },
      ],
    });
  });
});
