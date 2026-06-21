import { describe, it, expect } from "vitest";
import { qualifyProspect, isChain, normalizeName } from "./lead-fit";

describe("isChain", () => {
  it("matches chains at the start / whole name", () => {
    expect(isChain("McDonald's")).toBe(true);
    expect(isChain("Starbucks Coffee")).toBe(true);
    expect(isChain("Subway #4821")).toBe(true);
  });
  it("does not false-flag embedded substrings", () => {
    expect(isChain("Discount Subway Tiles")).toBe(false);
    expect(isChain("Joe's Local Diner")).toBe(false);
  });
});

describe("normalizeName", () => {
  it("collapses punctuation/quotes/spacing for stable dedup", () => {
    expect(normalizeName("Tony's  Pizza")).toBe(normalizeName("Tonys Pizza"));
    expect(normalizeName("A&B Auto, LLC")).toBe("a b auto llc");
  });
});

describe("qualifyProspect — reachability requires a real channel", () => {
  const base = { name: "Joe's Diner", category: "restaurant", address: "123 Main St, Tampa, FL" };
  it("qualifies a no-website business with a phone", () => {
    expect(qualifyProspect({ ...base, phone: "+1 813 555 0100" }).qualified).toBe(true);
  });
  it("qualifies with email only", () => {
    expect(qualifyProspect({ ...base, email: "joe@diner.com" }).qualified).toBe(true);
  });
  it("does NOT qualify an address-only lead (a pin is not a sales channel)", () => {
    const r = qualifyProspect({ ...base });
    expect(r.qualified).toBe(false);
    expect(r.disqualifiers.some((d) => /reach/i.test(d))).toBe(true);
  });
  it("skips chains and already-have-website", () => {
    expect(qualifyProspect({ name: "Subway", category: "restaurant", phone: "x" }).qualified).toBe(false);
    expect(qualifyProspect({ ...base, phone: "x", website: "https://joe.com" }).qualified).toBe(false);
  });
});
