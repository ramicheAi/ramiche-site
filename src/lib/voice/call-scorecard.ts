// /Users/admin/ramiche-site/src/lib/voice/call-scorecard.ts
// Per-call QA scoring + the leading-indicator rollup that drives the "continuously
// improve" loop. Manage the inputs, not revenue (Business Bible §7 / SPEC §13).
//
// scoreCall() runs on a finished call's transcript + captured brief. aggregate()
// rolls many calls into the dashboard metrics.
import { isBriefComplete, type CallDiscovery, type CallOutcome } from "./discovery-schema";

export interface ScoreInput {
  transcript?: string;
  discovery?: Partial<CallDiscovery> | null;
  durationSec?: number;
  cost?: number;
}

export interface CallScore {
  disclosed: boolean;        // did Mercury disclose it's an AI?
  booked: boolean;           // booked or deposit
  briefComplete: boolean;    // captured enough to build
  objectionsHandled: number;
  outcome: CallOutcome | "unknown";
  score: number;             // 0..100 composite
  flags: string[];           // things to fix / review
}

const BOOKED_OUTCOMES: CallOutcome[] = ["booked", "deposit_taken"];

export function scoreCall(input: ScoreInput): CallScore {
  const t = (input.transcript || "").toLowerCase();
  const d = input.discovery || {};
  const flags: string[] = [];

  // Disclosure — look at the opening third of the transcript (where it belongs).
  const head = t.slice(0, Math.max(200, Math.floor(t.length / 3)));
  const disclosed = /\bai\b|a\.i\.|assistant|mercury|parallax/.test(head);
  if (!disclosed) flags.push("no AI disclosure detected");

  const outcome = (d.outcome as CallOutcome) || "unknown";
  const booked = BOOKED_OUTCOMES.includes(outcome as CallOutcome);
  const briefComplete = isBriefComplete(d);
  if (!briefComplete) flags.push("brief incomplete — delivery would stall");

  const objectionsHandled = Array.isArray(d.objections) ? d.objections.length : 0;

  // Hallucination smell-test: a raw "$1,234"/"3,200" in the transcript means the
  // agent spoke digits (TTS-manglable) instead of words.
  if (/\$\s?\d|\b\d{3,}\b/.test(input.transcript || "")) flags.push("spoke a digit price (should be words)");

  // Composite (compliance-weighted).
  let score = 0;
  if (disclosed) score += 25; // non-negotiable
  if (booked) score += 35;
  else if (outcome === "callback") score += 15;
  if (briefComplete) score += 25;
  if (objectionsHandled > 0) score += 10;
  if (flags.length === 0) score += 5;

  return { disclosed, booked, briefComplete, objectionsHandled, outcome, score: Math.min(100, score), flags };
}

// ── Leading-indicator rollup (the dashboard) ────────────────────────────────
export interface CallRecord {
  placed: boolean;
  connected: boolean;        // someone answered
  disclosed?: boolean;
  outcome?: CallOutcome | "unknown";
  briefComplete?: boolean;
  score?: number;
  durationSec?: number;
  cost?: number;
}

export interface CallMetrics {
  placed: number;
  connected: number;
  connectRate: number;       // connected / placed
  booked: number;
  bookRate: number;          // booked / connected
  callbacks: number;
  captureCompleteness: number; // % of connected calls with a complete brief
  disclosureRate: number;    // compliance health
  avgScore: number;
  totalCost: number;
  costPerBooked: number | null;
  costPerCall: number | null;
}

function rate(n: number, d: number): number {
  return d > 0 ? Math.round((n / d) * 1000) / 1000 : 0;
}

export function aggregateCallMetrics(calls: CallRecord[]): CallMetrics {
  const placed = calls.filter((c) => c.placed).length;
  const connectedCalls = calls.filter((c) => c.connected);
  const connected = connectedCalls.length;
  const booked = calls.filter((c) => c.outcome === "booked" || c.outcome === "deposit_taken").length;
  const callbacks = calls.filter((c) => c.outcome === "callback").length;
  const disclosed = connectedCalls.filter((c) => c.disclosed).length;
  const complete = connectedCalls.filter((c) => c.briefComplete).length;
  const scored = calls.filter((c) => typeof c.score === "number");
  const totalCost = calls.reduce((n, c) => n + (c.cost || 0), 0);

  return {
    placed,
    connected,
    connectRate: rate(connected, placed),
    booked,
    bookRate: rate(booked, connected),
    callbacks,
    captureCompleteness: rate(complete, connected),
    disclosureRate: rate(disclosed, connected),
    avgScore: scored.length ? Math.round(scored.reduce((n, c) => n + (c.score || 0), 0) / scored.length) : 0,
    totalCost: Math.round(totalCost * 100) / 100,
    costPerBooked: booked > 0 ? Math.round((totalCost / booked) * 100) / 100 : null,
    costPerCall: placed > 0 ? Math.round((totalCost / placed) * 100) / 100 : null,
  };
}
