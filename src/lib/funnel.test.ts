import { describe, it, expect } from "vitest";
import { computeFunnel } from "./funnel";

describe("computeFunnel", () => {
  const leads = [
    { id: "a", stage: "lead", value: 0 },
    { id: "b", stage: "qualified", value: 7490 },
    { id: "c", stage: "proposal", value: 9000 },
    { id: "d", stage: "won", value: 8000 },
    { id: "e", stage: "lost", value: 0, meta: { disqualifyCode: "closed" } },
    { id: "f", stage: "lost", value: 0, meta: { disqualifyCode: "unreachable" } },
    { id: "g", stage: "lost", value: 0, meta: { disqualifyCode: null } },
  ];
  const events = [
    { lead_id: "b", kind: "call_placed" },
    { lead_id: "c", kind: "email_sent" },
    { lead_id: "c", kind: "proposal_sent" },
    { lead_id: "d", kind: "call_completed" },
  ];

  it("counts the funnel stages", () => {
    const f = computeFunnel(leads, events);
    expect(f.sourced).toBe(7);
    expect(f.researched).toBe(6); // everything but the raw 'lead'
    expect(f.qualified).toBe(3); // qualified + proposal + won
    expect(f.disqualified).toBe(3);
    expect(f.contacted).toBe(3); // b, c, d
    expect(f.proposals).toBe(2); // proposal stage (c) + won (d)
    expect(f.won).toBe(1);
  });

  it("breaks down disqualifications by code (other for missing)", () => {
    const f = computeFunnel(leads, events);
    expect(f.disqualifiedByCode.closed).toBe(1);
    expect(f.disqualifiedByCode.unreachable).toBe(1);
    expect(f.disqualifiedByCode.other).toBe(1);
  });

  it("sums pipeline vs won value separately", () => {
    const f = computeFunnel(leads, events);
    expect(f.pipelineValue).toBe(7490 + 9000); // active, excludes won
    expect(f.wonValue).toBe(8000);
  });

  it("computes the dead-lead rate", () => {
    const f = computeFunnel(leads, events);
    expect(f.rates.deadLeadRate).toBe(50); // 3 lost / 6 researched
  });

  it("is safe on empty input", () => {
    const f = computeFunnel([], []);
    expect(f.sourced).toBe(0);
    expect(f.rates.deadLeadRate).toBe(0);
  });

  it("breaks down by source and contact channel", () => {
    const srcLeads = [
      { id: "1", stage: "won", value: 8000, source: "auto-prospect" },
      { id: "2", stage: "qualified", value: 7000, source: "auto-prospect" },
      { id: "3", stage: "lead", value: 0, source: "prospector" },
    ];
    const f = computeFunnel(srcLeads, [
      { lead_id: "1", kind: "call_placed" },
      { lead_id: "2", kind: "email_sent" },
    ]);
    expect(f.bySource["auto-prospect"].sourced).toBe(2);
    expect(f.bySource["auto-prospect"].won).toBe(1);
    expect(f.bySource["auto-prospect"].wonValue).toBe(8000);
    expect(f.contactedByChannel.call).toBe(1);
    expect(f.contactedByChannel.email).toBe(1);
  });
});
