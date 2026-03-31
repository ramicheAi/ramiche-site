import { describe, it, expect } from "vitest";
import {
  QUALIFYING_STANDARDS,
  normalizeEvent,
  parseTimeToSeconds,
  formatSeconds,
} from "./qualifying-standards";

describe("qualifying-standards", () => {
  it("has SCY/LCM cuts", () => {
    expect(QUALIFYING_STANDARDS.SCY["50 Free"]).toBe(21.49);
    expect(QUALIFYING_STANDARDS.LCM["100 Free"]).toBe(52.49);
  });

  it("normalizeEvent combines distance and stroke", () => {
    expect(normalizeEvent("100", "Free")).toBe("100 Free");
  });

  it("normalizeEvent preserves full event when stroke already in label", () => {
    expect(normalizeEvent("100 Free", "Free")).toBe("100 Free");
  });

  it("normalizeEvent returns distance-only when stroke missing", () => {
    expect(normalizeEvent("100", "")).toBe("100");
  });

  it("parseTimeToSeconds handles SS and MM:SS", () => {
    expect(parseTimeToSeconds("21.5")).toBeCloseTo(21.5);
    expect(parseTimeToSeconds("1:05.00")).toBeCloseTo(65);
  });

  it("parseTimeToSeconds handles HH:MM:SS", () => {
    expect(parseTimeToSeconds("1:02:03.5")).toBeCloseTo(3600 + 120 + 3.5);
  });

  it("formatSeconds formats minute+ and abs", () => {
    expect(formatSeconds(65.5)).toMatch(/^1:05\./);
    expect(formatSeconds(-10)).toBe("10.00");
  });

  it("formatSeconds formats sub-minute times", () => {
    expect(formatSeconds(21.5)).toBe("21.50");
  });
});
