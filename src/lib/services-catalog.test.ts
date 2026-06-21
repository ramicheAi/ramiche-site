import { describe, it, expect } from "vitest";
import { recommendBundle } from "./services-catalog";

describe("recommendBundle — right-sized anchor (anti price-shock)", () => {
  // The exact gap set that produced the $5,340 + $3,350/mo cookie-shop quote.
  const cookieShopGaps = [
    "no_website", "not_mobile", "no_ssl", "no_email_capture",
    "no_ai_visibility", "few_reviews", "no_online_ordering",
  ] as const;

  it("does NOT price-shock a small local business", () => {
    const r = recommendBundle([...cookieShopGaps], 0.35);
    expect(r.oneTimeTotal).toBeLessThanOrEqual(2500);
    expect(r.monthlyTotal).toBeLessThanOrEqual(500);
    expect(r.items.length).toBeLessThanOrEqual(4); // a sane anchor, not 11 items
    const acv = r.oneTimeTotal + r.monthlyTotal * 12;
    expect(acv).toBeLessThan(15000); // was $45,540
  });

  it("keeps the rest as an upsell menu (expansion), not the cold anchor", () => {
    const r = recommendBundle([...cookieShopGaps], 0.35);
    expect(r.expansion.length).toBeGreaterThan(0);
    const anchorIds = new Set(r.items.map((i) => i.id));
    const expIds = new Set(r.expansion.map((i) => i.id));
    // no overlap between anchor and expansion
    for (const id of anchorIds) expect(expIds.has(id)).toBe(false);
  });

  it("always includes the website build as the foundation", () => {
    const r = recommendBundle(["no_website"], 0.35);
    expect(r.items.some((i) => i.id === "web_build")).toBe(true);
  });

  it("never puts heavy services (social ads, AI receptionist) in the cold anchor", () => {
    const r = recommendBundle(["no_social", "no_email_capture", "no_online_ordering"], 0.35);
    expect(r.items.some((i) => i.id === "social_content")).toBe(false);
    expect(r.items.some((i) => i.id === "ai_receptionist")).toBe(false);
    // they remain available as upsells
    expect(r.expansion.some((i) => i.id === "social_content")).toBe(true);
  });

  it("scales price within the band by business size, still capped", () => {
    const small = recommendBundle(["no_website"], 0.2);
    const large = recommendBundle(["no_website"], 0.9);
    expect(large.oneTimeTotal).toBeGreaterThanOrEqual(small.oneTimeTotal);
    expect(large.monthlyTotal).toBeLessThanOrEqual(500);
  });

  it("never blows the one-time cap even at max sizeFactor (anti price-shock guarantee)", () => {
    for (const sf of [0.1, 0.35, 0.7, 1.0]) {
      const r = recommendBundle(["no_website", "no_online_ordering", "no_email_capture", "no_ai_visibility"], sf);
      expect(r.oneTimeTotal).toBeLessThanOrEqual(2500);
      expect(r.monthlyTotal).toBeLessThanOrEqual(500);
    }
  });
});
