/**
 * P06 M3: Mission cost attribution, derived read-only from existing truth (execution_events_with_shadow_cost).
 * Nothing is stored, copied or repriced; every number below is recomputed from the Packet 3 rows on each read.
 *
 * Attribution (an event belongs to a mission when either holds; each event counted once):
 *   direct  execution_events.mission_id = the mission's id
 *   link    a LIVE mission link whose target maps exactly to an execution_events correlation:
 *             job -> job, chat_message -> chat_message, pipeline_lead -> lead
 *           Nothing else attributes: tombstoned links, and urls, branches, commits, PRs, projects, builds, tasks,
 *           synthesis plans or other missions, may be linked but never establish cost.
 *
 * Truth rules (Packet 3, unchanged):
 *   actual cost   only non-null direct_cost_usd is summed. A null on a subscription (claude-max) or local
 *                 (lm-studio) row is NOT unknown and NOT $0: there is no marginal per-call cost to record. A null on any
 *                 other row is unknown. Unknown is never coerced to zero.
 *   shadow cost   taken from the view as-is: a list-price EQUIVALENT lower bound, NOT actual spend. Null = unpriced.
 *   tokens        each count summed only where present; events without it are counted as unknown. Totals are never
 *                 derived from input + output (claude-max rows have no stored total by design).
 */
import type { CorrelationType, CostEventRow } from "./store";
import type { LinkRow, TargetType } from "./types";

/** The only link -> correlation mappings that attribute cost. */
export const COST_LINK_MAP: Readonly<Partial<Record<TargetType, CorrelationType>>> = {
  job: "job",
  chat_message: "chat_message",
  pipeline_lead: "lead",
};

export type AttributionSource =
  | { kind: "direct" }
  | { kind: "link"; linkId: string; targetType: TargetType; correlationType: CorrelationType; correlationId: string };

export type AttributedEvent = CostEventRow & { sources: AttributionSource[] };

/** Exact-decimal USD as a fixed 8-place string (numeric(14,8) in the database), or null when nothing is known. */
export type Usd = string | null;

export type CountSum = { sum: number | null; knownEvents: number; unknownEvents: number };

export type BreakdownRow = {
  provider: string;
  modelRequested: string | null;
  modelReported: string | null;
  billingMode: string;
  events: number;
  inputTokens: CountSum;
  outputTokens: CountSum;
  actualKnownUsd: Usd;
  shadowUsd: Usd;
};

export type ActualCostStatus =
  | "no_events"        // nothing attributed
  | "none_recorded"    // events exist, but none can carry a marginal cost (subscription/local only)
  | "unknown"          // events that could carry a cost exist, and none recorded one
  | "partial"          // some recorded, some unknown
  | "complete";        // every event that could carry a cost recorded one

export type MissionCosts = {
  missionId: string;
  events: { total: number; direct: number; linked: number; both: number };
  usage: {
    input: CountSum;
    output: CountSum;
    total: CountSum;
    byQuality: Record<string, number>;
  };
  actualCost: {
    status: ActualCostStatus;
    knownUsd: Usd;
    knownEvents: number;
    unknownEvents: number;
    notApplicableEvents: number;
  };
  shadowCost: {
    label: "list_price_equivalent_not_actual_spend";
    basis: string | null;
    usd: Usd;
    pricedEvents: number;
    unpricedEvents: number;
  };
  breakdown: BreakdownRow[];
  /** Provenance of every attributed event: proves dedupe and which path(s) reached it. */
  attribution: { eventId: string; sources: AttributionSource[] }[];
};

/** Live links that attribute cost, grouped as correlation type -> distinct ids, with the links behind each pair. */
export function costTargets(links: LinkRow[]): Map<CorrelationType, Map<string, LinkRow[]>> {
  const out = new Map<CorrelationType, Map<string, LinkRow[]>>();
  for (const l of links) {
    if (l.removed_at) continue;
    const type = COST_LINK_MAP[l.target_type];
    if (!type) continue;
    const id = l.target_id.toLowerCase();
    const byId = out.get(type) ?? new Map<string, LinkRow[]>();
    byId.set(id, [...(byId.get(id) ?? []), l]);
    out.set(type, byId);
  }
  return out;
}

/**
 * The stored spellings to query for a set of (lower-cased) link ids. correlation_id is text and its CHECK is
 * case-insensitive, and some writers (lead intel/kit) store the id exactly as the request sent it, so an exact-string
 * match on the lower-case form alone could silently miss an upper-case row. A UUID's only letters are a-f, so its
 * canonical spellings are all-lower and all-upper; a mixed-case spelling is not matched (no writer produces one).
 */
export function correlationIdForms(ids: Iterable<string>): string[] {
  const out = new Set<string>();
  for (const id of ids) { out.add(id.toLowerCase()); out.add(id.toUpperCase()); }
  return [...out];
}

/** Merge direct and linked rows by event id; an event reached by several paths appears once with every source. */
export function mergeAttribution(
  direct: CostEventRow[],
  linked: { type: CorrelationType; rows: CostEventRow[] }[],
  targets: Map<CorrelationType, Map<string, LinkRow[]>>,
): AttributedEvent[] {
  const byId = new Map<string, AttributedEvent>();
  const add = (row: CostEventRow, source: AttributionSource) => {
    const cur = byId.get(row.id);
    if (cur) cur.sources.push(source);
    else byId.set(row.id, { ...row, sources: [source] });
  };
  for (const r of direct) add(r, { kind: "direct" });
  for (const { type, rows } of linked) {
    for (const r of rows) {
      // Defense in depth: the row must really carry this exact correlation pair.
      if (r.correlation_type !== type || !r.correlation_id) continue;
      const links = targets.get(type)?.get(r.correlation_id.toLowerCase()) ?? [];
      for (const l of links) add(r, { kind: "link", linkId: l.id, targetType: l.target_type, correlationType: type, correlationId: r.correlation_id.toLowerCase() });
    }
  }
  return [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
}

/* ── exact decimal arithmetic on numeric(14,8) values, never through a float sum ─────────────────────────────── */
const SCALE = BigInt(100000000);
function toUnits(v: number | string): bigint {
  const s = typeof v === "number" ? v.toFixed(8) : v.trim();
  const m = /^(\d+)(?:\.(\d{1,8}))?$/.exec(s);
  if (!m) throw new Error(`unexpected cost value ${s}`);
  return BigInt(m[1]) * SCALE + BigInt((m[2] ?? "").padEnd(8, "0"));
}
function fromUnits(u: bigint): string {
  return `${u / SCALE}.${(u % SCALE).toString().padStart(8, "0")}`;
}

function countSum(events: AttributedEvent[], pick: (e: AttributedEvent) => number | null): CountSum {
  let sum = 0, known = 0;
  for (const e of events) { const v = pick(e); if (v !== null && v !== undefined) { sum += v; known++; } }
  return { sum: known ? sum : null, knownEvents: known, unknownEvents: events.length - known };
}
function usd(events: AttributedEvent[], pick: (e: AttributedEvent) => number | string | null): { usd: Usd; known: number } {
  let total = BigInt(0), known = 0;
  for (const e of events) { const v = pick(e); if (v !== null && v !== undefined) { total += toUnits(v); known++; } }
  return { usd: known ? fromUnits(total) : null, known };
}
const NO_MARGINAL_COST = new Set(["subscription", "local"]);

export function summarize(missionId: string, events: AttributedEvent[]): MissionCosts {
  const direct = events.filter((e) => e.sources.some((s) => s.kind === "direct")).length;
  const linked = events.filter((e) => e.sources.some((s) => s.kind === "link")).length;
  const both = events.filter((e) => e.sources.some((s) => s.kind === "direct") && e.sources.some((s) => s.kind === "link")).length;

  const byQuality: Record<string, number> = {};
  for (const e of events) byQuality[e.usage_quality] = (byQuality[e.usage_quality] ?? 0) + 1;

  const actual = usd(events, (e) => e.direct_cost_usd);
  const notApplicable = events.filter((e) => e.direct_cost_usd === null && NO_MARGINAL_COST.has(e.billing_mode)).length;
  const unknown = events.length - actual.known - notApplicable;
  const status: ActualCostStatus =
    events.length === 0 ? "no_events"
      : actual.known === 0 ? (unknown === 0 ? "none_recorded" : "unknown")
        : unknown > 0 ? "partial" : "complete";

  const shadow = usd(events, (e) => e.shadow_cost_usd);
  const bases = [...new Set(events.map((e) => e.shadow_cost_basis).filter((b): b is string => Boolean(b)))];

  const groups = new Map<string, AttributedEvent[]>();
  for (const e of events) {
    const k = JSON.stringify([e.provider, e.model_requested, e.model_reported, e.billing_mode]);
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  const breakdown: BreakdownRow[] = [...groups.values()].map((g) => ({
    provider: g[0].provider,
    modelRequested: g[0].model_requested,
    modelReported: g[0].model_reported,
    billingMode: g[0].billing_mode,
    events: g.length,
    inputTokens: countSum(g, (e) => e.input_tokens),
    outputTokens: countSum(g, (e) => e.output_tokens),
    actualKnownUsd: usd(g, (e) => e.direct_cost_usd).usd,
    shadowUsd: usd(g, (e) => e.shadow_cost_usd).usd,
  })).sort((a, b) => b.events - a.events || a.provider.localeCompare(b.provider));

  return {
    missionId,
    events: { total: events.length, direct, linked, both },
    usage: {
      input: countSum(events, (e) => e.input_tokens),
      output: countSum(events, (e) => e.output_tokens),
      total: countSum(events, (e) => e.total_tokens),
      byQuality,
    },
    actualCost: { status, knownUsd: actual.usd, knownEvents: actual.known, unknownEvents: unknown, notApplicableEvents: notApplicable },
    shadowCost: {
      label: "list_price_equivalent_not_actual_spend",
      basis: bases.length === 1 ? bases[0] : bases.length ? bases.join("; ") : null,
      usd: shadow.usd, pricedEvents: shadow.known, unpricedEvents: events.length - shadow.known,
    },
    breakdown,
    attribution: events.map((e) => ({ eventId: e.id, sources: e.sources })),
  };
}
