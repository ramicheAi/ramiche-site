/**
 * P06 M3: the pure attribution and truth rules. The same rules are proven end to end against the real Packet 3 table and
 * shadow view in missions-db.test.ts; these pin each rule in isolation.
 */
import { describe, expect, it } from "vitest";
import { correlationIdForms, COST_LINK_MAP, costTargets, mergeAttribution, summarize } from "./costs";
import type { CostEventRow } from "./store";
import type { LinkRow, TargetType } from "./types";

const J = "00000000-0000-4000-8000-00000000000a";
const link = (id: string, target_type: TargetType, target_id: string, removed = false): LinkRow => ({
  id, mission_id: "m", target_type, target_id, target_index: null, relation: "context", criterion_id: null, created_by: "ramon",
  created_by_kind: "human", created_at: "2026-10-01T00:00:00Z", removed_at: removed ? "2026-10-02T00:00:00Z" : null,
  removed_by: removed ? "ramon" : null, removed_by_kind: removed ? "human" : null,
});
const row = (id: string, over: Partial<CostEventRow> = {}): CostEventRow => ({
  id, mission_id: null, correlation_type: null, correlation_id: null, provider: "openrouter", model_requested: "m-a", model_reported: null,
  outcome: "ok", usage_quality: "not_reported", input_tokens: null, output_tokens: null, total_tokens: null, direct_cost_usd: null,
  billing_mode: "unknown", shadow_cost_usd: null, shadow_cost_basis: null, ...over,
});

describe("cost link mapping", () => {
  it("only job, chat_message and pipeline_lead (-> lead) attribute cost", () => {
    expect(COST_LINK_MAP).toEqual({ job: "job", chat_message: "chat_message", pipeline_lead: "lead" });
    const all: TargetType[] = ["url", "job", "synthesis", "synthesis_action", "pipeline_gate", "pipeline_lead", "chat_channel", "chat_message",
      "mission", "project", "pull_request", "git_branch", "git_commit"];
    const t = costTargets(all.map((type, i) => link(`l${i}`, type, J)));
    expect([...t.keys()].sort()).toEqual(["chat_message", "job", "lead"]);
  });

  it("tombstoned links never attribute; several live links to one target are all kept as provenance", () => {
    const t = costTargets([link("a", "job", J, true), link("b", "job", J.toUpperCase()), link("c", "job", J)]);
    expect(t.get("job")?.get(J)?.map((l) => l.id)).toEqual(["b", "c"]);
    expect(costTargets([link("a", "job", J, true)]).size).toBe(0);
  });
});

describe("mergeAttribution", () => {
  const targets = costTargets([link("lj", "job", J), link("lj2", "job", J), link("ll", "pipeline_lead", J)]);
  it("dedupes direct + link and multi-link paths by event id, keeping every source", () => {
    const e = row("e1", { mission_id: "m", correlation_type: "job", correlation_id: J });
    const out = mergeAttribution([e], [{ type: "job", rows: [e] }], targets);
    expect(out).toHaveLength(1);
    expect(out[0].sources.map((s) => (s.kind === "link" ? s.linkId : s.kind))).toEqual(["direct", "lj", "lj2"]);
    expect(summarize("m", out).events).toEqual({ total: 1, direct: 1, linked: 1, both: 1 });
  });
  it("a linked row must carry exactly the mapped correlation pair", () => {
    const wrongType = row("e2", { correlation_type: "chat_message", correlation_id: J });
    const unlinked = row("e3", { correlation_type: "job", correlation_id: "00000000-0000-4000-8000-0000000000ff" });
    const viaLead = row("e4", { correlation_type: "lead", correlation_id: J });
    const out = mergeAttribution([], [{ type: "job", rows: [wrongType, unlinked] }, { type: "lead", rows: [viaLead] }], targets);
    expect(out.map((e) => e.id)).toEqual(["e4"]);
    expect(out[0].sources).toEqual([{ kind: "link", linkId: "ll", targetType: "pipeline_lead", correlationType: "lead", correlationId: J }]);
  });
});

describe("summarize: truth rules", () => {
  const sum = (rows: CostEventRow[]) => summarize("m", mergeAttribution(rows, [], new Map()));
  it("zero events is an honest zero, not $0", () => {
    const s = sum([]);
    expect(s.events.total).toBe(0);
    expect(s.actualCost).toEqual({ status: "no_events", knownUsd: null, knownEvents: 0, unknownEvents: 0, notApplicableEvents: 0 });
    expect(s.usage.total.sum).toBeNull();
    expect(s.shadowCost.usd).toBeNull();
  });
  it("null cost on subscription/local is not-applicable, never $0 and never unknown", () => {
    const s = sum([row("a", { provider: "claude-max", billing_mode: "subscription" }), row("b", { provider: "lm-studio", billing_mode: "local" })]);
    expect(s.actualCost).toEqual({ status: "none_recorded", knownUsd: null, knownEvents: 0, unknownEvents: 0, notApplicableEvents: 2 });
  });
  it("null cost on an unknown billing mode stays unknown", () => {
    expect(sum([row("a")]).actualCost).toEqual({ status: "unknown", knownUsd: null, knownEvents: 0, unknownEvents: 1, notApplicableEvents: 0 });
  });
  it("known costs sum exactly; mixed with unknown is partial", () => {
    const parts = [row("a", { direct_cost_usd: "0.10000000" }), row("b", { direct_cost_usd: 0.2 }), row("c", { direct_cost_usd: "0.00000001" })];
    expect(sum(parts).actualCost).toEqual({ status: "complete", knownUsd: "0.30000001", knownEvents: 3, unknownEvents: 0, notApplicableEvents: 0 });
    expect(sum([...parts, row("d")]).actualCost).toMatchObject({ status: "partial", knownUsd: "0.30000001", unknownEvents: 1 });
    expect(sum([row("z", { direct_cost_usd: "0" })]).actualCost).toMatchObject({ status: "complete", knownUsd: "0.00000000" }); // a recorded zero is real
  });
  it("shadow cost comes from the view as-is and is labelled not actual spend", () => {
    const s = sum([row("a", { provider: "claude-max", billing_mode: "subscription", shadow_cost_usd: 0.0105, shadow_cost_basis: "list_price_equivalent_lower_bound_excludes_cache_tokens" }), row("b")]);
    expect(s.shadowCost).toEqual({ label: "list_price_equivalent_not_actual_spend", basis: "list_price_equivalent_lower_bound_excludes_cache_tokens", usd: "0.01050000", pricedEvents: 1, unpricedEvents: 1 });
    expect(s.actualCost.knownUsd).toBeNull();                         // shadow never leaks into actual
  });
  it("token sums count only reported values; total is never derived from input + output", () => {
    const s = sum([row("a", { input_tokens: 10, output_tokens: 5, usage_quality: "partial" }), row("b", { input_tokens: 1, output_tokens: 2, total_tokens: 3, usage_quality: "provider_reported" }), row("c")]);
    expect(s.usage.input).toEqual({ sum: 11, knownEvents: 2, unknownEvents: 1 });
    expect(s.usage.total).toEqual({ sum: 3, knownEvents: 1, unknownEvents: 2 });
    expect(s.usage.byQuality).toEqual({ partial: 1, provider_reported: 1, not_reported: 1 });
  });
  it("breaks down by provider, requested model, reported model and billing mode", () => {
    const s = sum([row("a", { direct_cost_usd: "1" }), row("b", { direct_cost_usd: "2" }), row("c", { model_reported: "m-a-2024" }), row("d", { provider: "gemini" })]);
    expect(s.breakdown.map((b) => [b.provider, b.modelRequested, b.modelReported, b.billingMode, b.events, b.actualKnownUsd])).toEqual([
      ["openrouter", "m-a", null, "unknown", 2, "3.00000000"],
      ["gemini", "m-a", null, "unknown", 1, null],
      ["openrouter", "m-a", "m-a-2024", "unknown", 1, null],
    ]);
  });
});

describe("correlation id spellings", () => {
  it("queries both canonical spellings so an upper-case stored id is not silently missed", () => {
    expect(correlationIdForms([J])).toEqual([J, J.toUpperCase()]);
    const t = costTargets([link("l", "pipeline_lead", J.toUpperCase())]);
    const upperRow = row("e", { correlation_type: "lead", correlation_id: J.toUpperCase() });
    const out = mergeAttribution([], [{ type: "lead", rows: [upperRow] }], t);
    expect(out.map((e) => e.id)).toEqual(["e"]);
  });
});
