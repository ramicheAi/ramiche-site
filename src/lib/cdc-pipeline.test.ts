import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { captureChange, getCDCBufferSize } from "./cdc-pipeline";

function flush() {
  while (getCDCBufferSize() > 0) {
    for (let i = 0; i < 20; i++) {
      captureChange("f", `f-${i}`, "create", "p");
    }
  }
}

describe("cdc-pipeline", () => {
  beforeEach(() => flush());

  it("buffers until flush at 20 events", () => {
    captureChange("c", "0", "create", "p");
    expect(getCDCBufferSize()).toBe(1);
    for (let i = 0; i < 18; i++) captureChange("c", String(i + 1), "create", "p");
    expect(getCDCBufferSize()).toBe(19);
    captureChange("c", "last", "create", "p");
    expect(getCDCBufferSize()).toBe(0);
  });

  it("flushes on interval when below buffer cap", () => {
    vi.useFakeTimers();
    captureChange("c", "solo", "update", "p", {
      x: { before: 1, after: 2 },
    });
    expect(getCDCBufferSize()).toBe(1);
    vi.advanceTimersByTime(10_000);
    expect(getCDCBufferSize()).toBe(0);
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});
