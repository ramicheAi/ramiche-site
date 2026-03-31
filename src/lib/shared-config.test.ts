import { describe, it, expect } from "vitest";
import {
  APEX_PRICING,
  APEX_PROJECTIONS,
  NAV_LINKS,
  BRANDS,
  KEY_METRICS,
} from "./shared-config";

describe("shared-config", () => {
  it("APEX_PRICING has four tiers with stable ids", () => {
    expect(APEX_PRICING.tiers).toHaveLength(4);
    expect(APEX_PRICING.tiers.map((t) => t.id)).toEqual([
      "starter",
      "club",
      "program",
      "enterprise",
    ]);
  });

  it("NAV_LINKS point to app routes", () => {
    expect(NAV_LINKS.some((l) => l.href === "/command-center")).toBe(true);
    expect(NAV_LINKS.some((l) => l.href === "/apex-athlete")).toBe(true);
  });

  it("BRANDS and KEY_METRICS are non-empty", () => {
    expect(BRANDS.length).toBeGreaterThan(0);
    expect(KEY_METRICS.gaProducts).toBeGreaterThan(0);
  });

  it("enterprise tier uses custom pricing sentinel", () => {
    const ent = APEX_PRICING.tiers.find((t) => t.id === "enterprise");
    expect(ent?.price).toBeNull();
    expect(ent?.priceLabel).toBe("Custom");
  });

  it("APEX_PROJECTIONS lists Y1 and Y3 scenarios", () => {
    expect(APEX_PROJECTIONS.length).toBe(4);
    expect(APEX_PROJECTIONS.some((p) => p.year.includes("Y1"))).toBe(true);
    expect(APEX_PROJECTIONS.some((p) => p.year.includes("Y3"))).toBe(true);
  });
});
