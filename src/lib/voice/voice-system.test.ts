// Unit tests for the call-system wrapper (compliance gate, call priority, scorecard).
// Pure logic — no network/DB — so these run in the normal `npm test` suite.
import { describe, it, expect } from "vitest";
import { assessCallCompliance, withinCallingHours, requiresRecordingConsent } from "./compliance";
import { callPriority, rankCallList, type PriorityLead } from "./call-priority";
import { scoreCall, aggregateCallMetrics } from "./call-scorecard";
import type { CallDiscovery } from "./discovery-schema";

const MIDDAY_ET = new Date("2026-06-15T15:00:00-04:00"); // 3pm Miami
const DAWN_ET = new Date("2026-06-15T05:00:00-04:00"); // 5am Miami

describe("compliance gate", () => {
  const base = { id: "1", phone: "9548828523", city: "Miami, FL", meta: { consent: { toCall: true } } };

  it("allows a consented, reachable lead during calling hours", () => {
    const r = assessCallCompliance(base, { now: MIDDAY_ET });
    expect(r.allowed).toBe(true);
    expect(r.blockers).toHaveLength(0);
    expect(r.requiresRecordingConsent).toBe(true); // FL is all-party
  });

  it("blocks on opt-out, missing phone, missing consent, and off-hours", () => {
    expect(assessCallCompliance({ ...base, meta: { ...base.meta, optOut: true } }, { now: MIDDAY_ET }).allowed).toBe(false);
    expect(assessCallCompliance({ ...base, phone: null }, { now: MIDDAY_ET }).allowed).toBe(false);
    expect(assessCallCompliance({ ...base, meta: {} }, { now: MIDDAY_ET }).allowed).toBe(false); // no consent
    expect(assessCallCompliance(base, { now: DAWN_ET }).allowed).toBe(false); // off-hours
  });

  it("dedups calls inside the min window", () => {
    const recent = { ...base, meta: { ...base.meta, lastCallAt: new Date(MIDDAY_ET.getTime() - 3600_000).toISOString() } };
    expect(assessCallCompliance(recent, { now: MIDDAY_ET, minHoursBetweenCalls: 72 }).allowed).toBe(false);
  });

  it("knows calling hours + recording-consent states", () => {
    expect(withinCallingHours("Miami, FL", MIDDAY_ET)).toBe(true);
    expect(withinCallingHours("Miami, FL", DAWN_ET)).toBe(false);
    expect(requiresRecordingConsent("Miami, FL")).toBe(true);
    expect(requiresRecordingConsent("Austin, TX")).toBe(false);
  });
});

describe("call priority", () => {
  const warm: PriorityLead = { id: "w", name: "Warm Cafe", category: "cafe", city: "Miami, FL", phone: "9540000001", meta: { consent: { toCall: true }, gaps: ["no_website", "no_gbp"] } };
  const cold: PriorityLead = { id: "c", name: "Cold Gym", category: "gym", city: "Miami, FL", phone: "9540000002", meta: { gaps: ["no_website"] } };

  it("scores a warm opted-in lead above a cold one", () => {
    const w = callPriority(warm, { now: MIDDAY_ET, requireConsent: false });
    const c = callPriority(cold, { now: MIDDAY_ET, requireConsent: false });
    expect(w.warm).toBe(true);
    expect(w.score).toBeGreaterThan(c.score);
  });

  it("ranks callable + warm first", () => {
    const ranked = rankCallList([cold, warm], { now: MIDDAY_ET, requireConsent: false });
    expect(ranked[0].leadId).toBe("w");
  });
});

describe("scorecard", () => {
  const fullDiscovery: Partial<CallDiscovery> = {
    business: { name: "Mama Lucia's", vertical: "restaurant", city: "Fort Lauderdale, FL" },
    bestContact: { preferredChannel: "phone" },
    servicesWanted: ["no_website"],
    consent: { toCall: true, toRecord: false, capturedISO: "2026-06-15" },
    outcome: "booked",
    objections: ["how much"],
  };

  it("rewards a disclosed, booked, fully-captured call", () => {
    const s = scoreCall({ transcript: "AI: Hey, this is Mercury with Parallax. User: cool.", discovery: fullDiscovery });
    expect(s.disclosed).toBe(true);
    expect(s.booked).toBe(true);
    expect(s.briefComplete).toBe(true);
    expect(s.score).toBeGreaterThanOrEqual(85);
  });

  it("flags a spoken digit price and missing disclosure", () => {
    const s = scoreCall({ transcript: "User: how much? Assistant said it's $3,200.", discovery: { outcome: "callback" } });
    expect(s.flags.some((f) => /digit price/.test(f))).toBe(true);
  });

  it("rolls call records into leading indicators", () => {
    const m = aggregateCallMetrics([
      { placed: true, connected: true, outcome: "booked", briefComplete: true, disclosed: true, score: 90, cost: 0.8 },
      { placed: true, connected: true, outcome: "callback", briefComplete: false, disclosed: true, score: 60, cost: 0.5 },
      { placed: true, connected: false, outcome: "no_answer", cost: 0.05 },
    ]);
    expect(m.placed).toBe(3);
    expect(m.connected).toBe(2);
    expect(m.booked).toBe(1);
    expect(m.connectRate).toBeCloseTo(0.667, 2);
    expect(m.costPerBooked).toBeGreaterThan(0);
  });
});
