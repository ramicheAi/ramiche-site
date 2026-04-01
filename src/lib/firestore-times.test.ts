import { describe, it, expect, vi, beforeEach } from "vitest";

const { fbSet, fbGet } = vi.hoisted(() => ({
  fbSet: vi.fn().mockResolvedValue(true),
  fbGet: vi.fn(),
}));

vi.mock("@/lib/firebase", () => ({ fbSet, fbGet }));

import { saveBestTimes, getBestTimes } from "./firestore-times";
import { fbSet as fbSetRef, fbGet as fbGetRef } from "@/lib/firebase";

describe("firestore-times", () => {
  beforeEach(() => {
    fbSetRef.mockClear();
    fbGetRef.mockClear();
    fbSetRef.mockResolvedValue(true);
  });

  it("saveBestTimes writes path", async () => {
    await saveBestTimes("a1", { times: [] });
    expect(fbSetRef.mock.calls[0][0]).toBe("athletes/a1/bestTimes");
  });

  it("getBestTimes delegates", async () => {
    fbGetRef.mockResolvedValue({ times: [], savedAt: 1 });
    const out = await getBestTimes("a1");
    expect(out?.savedAt).toBe(1);
  });

  it("getBestTimes returns null when remote is missing", async () => {
    fbGetRef.mockResolvedValue(null);
    await expect(getBestTimes("a1")).resolves.toBeNull();
  });
});
