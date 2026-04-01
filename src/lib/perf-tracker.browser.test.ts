/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { initPerfTracking, trackQuery } from "./perf-tracker";

vi.mock("./firebase", () => ({ hasConfig: false }));

describe("perf-tracker (jsdom)", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("initPerfTracking registers load listener", () => {
    const add = vi.spyOn(window, "addEventListener");
    initPerfTracking();
    expect(add).toHaveBeenCalledWith("load", expect.any(Function));
  });

  it("trackQuery warns when duration exceeds 500ms", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const start = 10_000;
    vi.spyOn(Date, "now").mockReturnValue(start + 600);
    trackQuery("slowQuery", start);
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/\[METTLE Perf\] Slow query: slowQuery took 600ms/),
      undefined
    );
  });
});
