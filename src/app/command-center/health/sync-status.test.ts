import { describe, expect, it } from "vitest";
import { classifySyncStatus } from "./page";

/**
 * RAMICHE-OS-CC-OVERNIGHT-RECOVERY-01, Phase 7 — Project & Agent Truth.
 * This is the pure logic behind the health page's LIVE/STALE/ERROR badge.
 * Previously the page stamped "LIVE" on every completed poll, including a
 * failed (non-2xx) one, and never went stale on its own.
 */
describe("classifySyncStatus", () => {
  const POLL = 15_000;

  it("is 'unknown' before any successful sync", () => {
    expect(classifySyncStatus(null, false, Date.now(), POLL)).toBe("unknown");
  });

  it("is 'error' whenever the most recent attempt failed — even with a prior success", () => {
    expect(classifySyncStatus(Date.now(), true, Date.now(), POLL)).toBe("error");
  });

  it("is 'live' right after a successful sync", () => {
    const t = Date.now();
    expect(classifySyncStatus(t, false, t, POLL)).toBe("live");
  });

  it("stays 'live' within 2x the poll interval", () => {
    const t = Date.now();
    expect(classifySyncStatus(t, false, t + POLL * 2 - 1, POLL)).toBe("live");
  });

  it("becomes 'stale' once a successful sync is more than 2x the poll interval old, even with no new error (e.g. a hung interval)", () => {
    const t = Date.now();
    expect(classifySyncStatus(t, false, t + POLL * 2 + 1, POLL)).toBe("stale");
  });
});
