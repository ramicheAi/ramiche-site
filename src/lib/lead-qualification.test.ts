import { describe, it, expect } from "vitest";
import { osmLooksClosed, qualifyPostResearch } from "./lead-qualification";

describe("osmLooksClosed (OSM intake pre-filter)", () => {
  it("flags a name that says closed", () => {
    expect(osmLooksClosed("Joe's Diner (CLOSED)", {})).toBe(true);
    expect(osmLooksClosed("Old Town Bakery - Permanently Closed", {})).toBe(true);
  });
  it("flags disused/abandoned namespaced tags", () => {
    expect(osmLooksClosed("Joe's Diner", { "disused:amenity": "restaurant" })).toBe(true);
    expect(osmLooksClosed("Joe's Diner", { "abandoned:shop": "bakery" })).toBe(true);
    expect(osmLooksClosed("Joe's Diner", { "was:name": "Joe's Diner" })).toBe(true);
  });
  it("respects disused=no (still open)", () => {
    expect(osmLooksClosed("Joe's Diner", { disused: "no" })).toBe(false);
  });
  it("flags opening_hours=closed/off", () => {
    expect(osmLooksClosed("Joe's Diner", { opening_hours: "closed" })).toBe(true);
    expect(osmLooksClosed("Joe's Diner", { opening_hours: "off" })).toBe(true);
  });
  it("passes a normal open business", () => {
    expect(osmLooksClosed("Coastal Fades Barbershop", { amenity: "restaurant", phone: "+1 555" })).toBe(false);
    expect(osmLooksClosed("Sunrise Cafe", { opening_hours: "Mo-Fr 08:00-17:00" })).toBe(false);
  });
});

describe("qualifyPostResearch (the diagnose gate)", () => {
  const base = { healthScore: 10, phone: "+1 813 555 0100", email: null, researched: true };

  it("AC1/AC3: kills a permanently closed business regardless of gaps", () => {
    const r = qualifyPostResearch({ ...base, operating: "closed" });
    expect(r.qualified).toBe(false);
    expect(r.code).toBe("closed");
  });

  it("AC4: kills a ghost (no phone + no email) after research", () => {
    const r = qualifyPostResearch({ ...base, operating: "open", phone: null, email: null });
    expect(r.qualified).toBe(false);
    expect(r.code).toBe("unreachable");
  });

  it("does NOT kill on reachability before research has run", () => {
    const r = qualifyPostResearch({ healthScore: 10, phone: null, email: null, researched: false });
    expect(r.qualified).toBe(true);
  });

  it("kills a national chain", () => {
    const r = qualifyPostResearch({ ...base, operating: "open", isChain: true });
    expect(r.qualified).toBe(false);
    expect(r.code).toBe("chain");
  });

  it("kills a self-sufficient (high-health) business", () => {
    const r = qualifyPostResearch({ ...base, operating: "open", healthScore: 80 });
    expect(r.qualified).toBe(false);
    expect(r.code).toBe("self_sufficient");
  });

  it("qualifies an alive, reachable, low-health, non-chain lead", () => {
    const r = qualifyPostResearch({ ...base, operating: "open" });
    expect(r.qualified).toBe(true);
    expect(r.code).toBeNull();
  });

  it("qualifies when operating is uncertain (don't kill on doubt)", () => {
    const r = qualifyPostResearch({ ...base, operating: "uncertain" });
    expect(r.qualified).toBe(true);
  });

  it("email-only is still reachable", () => {
    const r = qualifyPostResearch({ ...base, operating: "open", phone: null, email: "owner@shop.com" });
    expect(r.qualified).toBe(true);
  });
});
