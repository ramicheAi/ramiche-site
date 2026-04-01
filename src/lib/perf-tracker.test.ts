import { describe, it, expect } from "vitest";
import { trackQuery, trackRender, trackInteraction } from "./perf-tracker";

describe("perf-tracker", () => {
  it("no-ops without window", () => {
    expect(() => {
      const t = Date.now();
      trackQuery("q", t);
      trackRender("r", t);
      trackInteraction("i", 1);
    }).not.toThrow();
  });
});
