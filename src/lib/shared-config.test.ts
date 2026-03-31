import { describe, it, expect } from "vitest";
import { APEX_PRICING, NAV_LINKS, BRANDS, KEY_METRICS } from "./shared-config";

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
});
