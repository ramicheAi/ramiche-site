import { describe, it, expect } from "vitest";
import { scoreSegments, rankSegments, learnedTargets } from "./icp-learning";

const mk = (vertical: string, city: string, stage: string, value = 0) => ({
  stage, value, meta: { category: vertical, city },
});

describe("scoreSegments", () => {
  it("aggregates outcomes per (vertical × city)", () => {
    const leads = [
      mk("Restaurants", "Miami, FL", "won", 9000),
      mk("Restaurants", "Miami, FL", "qualified"),
      mk("Restaurants", "Miami, FL", "lost"),
      mk("Gyms / Fitness", "Tampa, FL", "lost"),
      mk("Gyms / Fitness", "Tampa, FL", "lost"),
    ];
    const segs = scoreSegments(leads);
    const miami = segs.find((s) => s.vertical === "Restaurants" && s.city === "Miami, FL")!;
    expect(miami.sourced).toBe(3);
    expect(miami.won).toBe(1);
    expect(miami.wonValue).toBe(9000);
    const tampa = segs.find((s) => s.vertical === "Gyms / Fitness")!;
    expect(tampa.disqualified).toBe(2);
    expect(tampa.qualified).toBe(0);
  });

  it("ranks a winning segment above a dead one", () => {
    const leads = [
      ...Array.from({ length: 8 }, () => mk("Restaurants", "Miami, FL", "won", 8000)),
      ...Array.from({ length: 8 }, () => mk("Gyms / Fitness", "Tampa, FL", "lost")),
    ];
    const ranked = rankSegments(scoreSegments(leads));
    expect(ranked[0].vertical).toBe("Restaurants");
    expect(ranked[0].effectiveScore).toBeGreaterThan(ranked[ranked.length - 1].effectiveScore);
  });
});

describe("learnedTargets", () => {
  it("falls back to the rotation with no data (never breaks the prospector)", () => {
    const t = learnedTargets([], 14, 0);
    expect(t.length).toBe(14);
    for (const x of t) { expect(typeof x.vertical).toBe("string"); expect(typeof x.city).toBe("string"); }
  });

  it("front-loads a proven winner when data supports it", () => {
    const leads = Array.from({ length: 10 }, () => mk("Restaurants", "Miami, FL", "won", 8000));
    const t = learnedTargets(leads, 14, 0);
    // 'Restaurants' label maps to the 'restaurant' vertical id; should appear up front.
    expect(t.slice(0, 3).some((x) => x.vertical === "restaurant" && x.city === "Miami, FL")).toBe(true);
    expect(t.length).toBe(14);
  });
});
