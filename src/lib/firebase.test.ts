import { describe, it, expect } from "vitest";
import {
  hasConfig,
  fbGet,
  fbSet,
  fbUpdate,
  fbListen,
  fbListCollection,
  fbBatchSaveRosters,
} from "./firebase";

describe("firebase (Node test env — no browser db)", () => {
  it("exports hasConfig as boolean", () => {
    expect(typeof hasConfig).toBe("boolean");
  });

  it("fbGet returns null when Firestore is unavailable", async () => {
    expect(await fbGet("config/foo")).toBeNull();
  });

  it("fbSet returns false when Firestore is unavailable", async () => {
    expect(await fbSet("config/foo", { x: 1 })).toBe(false);
  });

  it("fbUpdate returns false when Firestore is unavailable", async () => {
    expect(await fbUpdate("config/foo", { x: 2 })).toBe(false);
  });

  it("fbListen returns null when Firestore is unavailable", () => {
    const unsub = fbListen("config/foo", () => {});
    expect(unsub).toBeNull();
  });

  it("fbBatchSaveRosters returns false when Firestore is unavailable", async () => {
    expect(await fbBatchSaveRosters({ a: [] })).toBe(false);
  });

  it("fbListCollection returns empty array when Firestore is unavailable", async () => {
    expect(await fbListCollection("any")).toEqual([]);
  });
});
