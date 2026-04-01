import { describe, it, expect, beforeEach } from "vitest";
import {
  recordRequest,
  getHealthMetrics,
  getAllHealthMetrics,
  resetMetrics,
} from "./heartbeat-metrics";

describe("heartbeat-metrics", () => {
  beforeEach(() => resetMetrics());

  it("idle when empty", () => {
    expect(getHealthMetrics("x").status).toBe("idle");
  });

  it("healthy with low error rate", () => {
    recordRequest("a", 100, false);
    recordRequest("a", 200, false);
    expect(getHealthMetrics("a").status).toBe("healthy");
  });

  it("getHealthMetrics averages response time", () => {
    recordRequest("avg", 100, false);
    recordRequest("avg", 200, false);
    expect(getHealthMetrics("avg").avgResponseMs).toBe(150);
  });

  it("healthy at exactly 10% error rate (boundary)", () => {
    recordRequest("e10", 1, true);
    for (let i = 0; i < 9; i++) recordRequest("e10", 1, false);
    expect(getHealthMetrics("e10").errorRate).toBe(10);
    expect(getHealthMetrics("e10").status).toBe("healthy");
  });

  it("warning when error rate is just above 10%", () => {
    recordRequest("e11", 1, true);
    for (let i = 0; i < 8; i++) recordRequest("e11", 1, false);
    expect(getHealthMetrics("e11").status).toBe("warning");
  });

  it("degraded when error rate > 50%", () => {
    recordRequest("d", 10, true);
    expect(getHealthMetrics("d").status).toBe("degraded");
  });

  it("warning when error rate between 10% and 50%", () => {
    for (let i = 0; i < 8; i++) recordRequest("w", 10, false);
    recordRequest("w", 10, true);
    expect(getHealthMetrics("w").status).toBe("warning");
  });

  it("getAllHealthMetrics includes recorded services", () => {
    recordRequest("s1", 1);
    recordRequest("s2", 2);
    const all = getAllHealthMetrics();
    expect(Object.keys(all).sort()).toEqual(["s1", "s2"]);
  });

  it("resetMetrics removes one service", () => {
    recordRequest("keep", 1);
    recordRequest("drop", 1);
    resetMetrics("drop");
    expect(getHealthMetrics("drop").status).toBe("idle");
    expect(getHealthMetrics("keep").status).toBe("healthy");
  });

  it("resetMetrics() with no argument clears all services", () => {
    recordRequest("z1", 1);
    recordRequest("z2", 1);
    resetMetrics();
    expect(getAllHealthMetrics()).toEqual({});
  });
});
