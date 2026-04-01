import { describe, it, expect, afterEach, vi } from "vitest";
import { buildIndex, searchAthletes, needsRebuild, getIndexStats } from "./athlete-search";

describe("athlete-search", () => {
  afterEach(() => vi.useRealTimers());

  it("search ranks by query", () => {
    buildIndex([
      { id: "1", name: "Alice", group: "A" },
      { id: "2", name: "Bob", group: "B" },
    ]);
    const r = searchAthletes("Alice", 10);
    expect(r[0]?.id).toBe("1");
  });

  it("needsRebuild after 6 minutes", () => {
    vi.useFakeTimers();
    const t0 = Date.now();
    vi.setSystemTime(t0);
    buildIndex([{ id: "1", name: "A", group: "A" }]);
    vi.setSystemTime(t0 + 6 * 60 * 1000);
    expect(needsRebuild()).toBe(true);
  });

  it("needsRebuild is false within five minute window", () => {
    vi.useFakeTimers();
    const t0 = Date.now();
    vi.setSystemTime(t0);
    buildIndex([{ id: "1", name: "A", group: "A" }]);
    vi.setSystemTime(t0 + 4 * 60 * 1000);
    expect(needsRebuild()).toBe(false);
  });

  it("getIndexStats", () => {
    buildIndex([{ id: "1", name: "A", group: "A" }]);
    expect(getIndexStats()?.athletes).toBe(1);
  });

  it("empty query returns roster slice up to limit", () => {
    buildIndex([
      { id: "1", name: "A", group: "G" },
      { id: "2", name: "B", group: "G" },
      { id: "3", name: "C", group: "G" },
    ]);
    expect(searchAthletes("   ", 2)).toHaveLength(2);
  });

  it("short query with no trigrams returns empty", () => {
    buildIndex([{ id: "1", name: "Alice", group: "G" }]);
    expect(searchAthletes("x", 10)).toEqual([]);
  });
});
