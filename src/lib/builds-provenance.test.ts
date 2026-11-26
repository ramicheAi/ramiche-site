import { describe, expect, it } from "vitest";
import { buildProvenance, newestBuildDate, provenanceLabel } from "./builds-provenance";

const NOW = new Date("2026-11-15T12:00:00Z");

describe("builds provenance", () => {
  it("reports a verified empty only when the source answered", () => {
    const p = buildProvenance({ source: "workspace", dates: [], observedAt: NOW });
    expect(p.state).toBe("empty");
    expect(p.freshness).toBe("none");
    expect(p.latestBuildDate).toBeNull();
    expect(provenanceLabel(p)).toMatch(/source answered with zero builds/);
  });

  it("reports unavailable separately from empty", () => {
    const p = buildProvenance({ source: "workspace", dates: [], observedAt: NOW, unavailable: true });
    expect(p.state).toBe("unavailable");
    expect(provenanceLabel(p)).toMatch(/unavailable/);
    expect(provenanceLabel(p)).not.toMatch(/zero builds/);
  });

  it("marks a build inside the window fresh", () => {
    const p = buildProvenance({ source: "workspace", dates: ["2026-11-13", "2026-11-10"], observedAt: NOW });
    expect(p.latestBuildDate).toBe("2026-11-13");
    expect(p.ageDays).toBe(2);
    expect(p.freshness).toBe("fresh");
    expect(p.state).toBe("live");
  });

  it("marks an old inventory stale rather than pretending it is current", () => {
    const p = buildProvenance({ source: "firestore", dates: ["2026-07-13"], observedAt: NOW });
    expect(p.freshness).toBe("stale");
    expect(p.ageDays).toBeGreaterThan(100);
    expect(provenanceLabel(p)).toMatch(/stale/);
  });

  it("ignores malformed dates when choosing the newest", () => {
    expect(newestBuildDate(["nope", "2026-13-99", "2026-11-01"])).toBe("2026-11-01");
  });

  it("is live, not empty, when builds exist but no date parses", () => {
    const p = buildProvenance({ source: "public", dates: ["unknown"], observedAt: NOW, count: 2 });
    expect(p.state).toBe("live");
    expect(p.latestBuildDate).toBeNull();
    expect(p.freshness).toBe("none");
  });

  it("pins the 7-day boundary", () => {
    const at = (days: number) => {
      const d = new Date(NOW.getTime() - days * 86_400_000);
      return d.toISOString().slice(0, 10);
    };
    expect(buildProvenance({ source: "workspace", dates: [at(6)], observedAt: NOW }).freshness).toBe("fresh");
    expect(buildProvenance({ source: "workspace", dates: [at(7)], observedAt: NOW }).freshness).toBe("fresh");
    expect(buildProvenance({ source: "workspace", dates: [at(8)], observedAt: NOW }).freshness).toBe("stale");
  });

  it("does not let a future date look newer than today", () => {
    const p = buildProvenance({ source: "workspace", dates: ["2026-11-20"], observedAt: NOW });
    expect(p.ageDays).toBe(0);
    expect(p.freshness).toBe("fresh");
  });

  it("respects a custom window", () => {
    const p = buildProvenance({ source: "workspace", dates: ["2026-11-01"], observedAt: NOW, freshWindowDays: 30 });
    expect(p.freshness).toBe("fresh");
  });
});
