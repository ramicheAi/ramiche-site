import { describe, expect, it } from "vitest";

import { composeBriefing, type BriefingInput } from "./cc-briefing";

const base = {
  agents: { active: 10, total: 21, idle: ["simons"] },
  revenue: { mrr: 0, arr: 0, last30: 0 },
  events: [],
} satisfies Omit<BriefingInput, "now">;

describe("composeBriefing accepts the payload the client actually sends", () => {
  // The client sends `now` over JSON, where a Date becomes a string. The route passed the body
  // straight through, so `now.getHours()` threw and every Command Center page load got a 500 from
  // /api/command-center/briefing/compose. This is the regression test for that.
  it("does not throw when now is an ISO string", () => {
    expect(() => composeBriefing({ ...base, now: "2026-11-16T20:36:50.650Z" })).not.toThrow();
  });

  it("still greets from a Date", () => {
    const out = composeBriefing({ ...base, now: new Date("2026-11-16T08:00:00Z") });
    expect(out.greeting).toMatch(/Ramon/);
    expect(out.spoken.length).toBeGreaterThan(0);
  });

  it("uses the local hour the string represents rather than crashing", () => {
    const morning = composeBriefing({ ...base, now: "2026-11-16T13:00:00Z" });
    expect(morning.greeting).toMatch(/Ramon/);
  });

  it("falls back to now for an unparseable string instead of throwing", () => {
    expect(() => composeBriefing({ ...base, now: "not a date" })).not.toThrow();
    const out = composeBriefing({ ...base, now: "not a date" });
    expect(out.greeting).toMatch(/Ramon/);
  });

  it("falls back to now when now is absent", () => {
    expect(() => composeBriefing(base)).not.toThrow();
  });
});
