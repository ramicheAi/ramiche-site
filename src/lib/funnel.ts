// /Users/admin/ramiche-site/src/lib/funnel.ts
// The leak map. You can't optimize what you can't see — this turns raw pipeline_leads
// + pipeline_events into the funnel (sourced → researched → qualified → contacted →
// proposal → won) plus the dead-lead rate, so we can watch the Qualification Engine
// shrink waste and find where money actually leaks. Pure + testable.

export interface FunnelLead {
  id?: string | null;
  stage?: string | null;
  value?: number | null;
  source?: string | null;
  meta?: { disqualifyCode?: string | null } | null;
}
export interface FunnelEvent {
  lead_id?: string | null;
  kind?: string | null;
}

// Stages that mean "passed the qualification gate" (everything but lead/lost).
const QUALIFIED_STAGES = new Set(["qualified", "proposal", "negotiation", "won"]);
// Stages at/after a proposal went out.
const PROPOSAL_STAGES = new Set(["proposal", "negotiation", "won"]);
const CONTACT_KINDS = new Set(["call_placed", "call_completed", "email_sent"]);

export interface Funnel {
  sourced: number;        // every lead in the system
  researched: number;     // ran through diagnose (left the raw 'lead' stage)
  qualified: number;      // passed the gate (alive, reachable, has-need, fit)
  contacted: number;      // got real outreach (call or email)
  proposals: number;      // a proposal went out
  won: number;            // closed
  disqualified: number;   // killed by the gate
  disqualifiedByCode: Record<string, number>; // closed / unreachable / chain / self_sufficient / other
  contactedByChannel: { call: number; email: number }; // which channel reached them
  bySource: Record<string, { sourced: number; qualified: number; won: number; wonValue: number }>; // where winners come from
  pipelineValue: number;  // $ ACV still in play (qualified..negotiation)
  wonValue: number;       // $ ACV closed
  rates: {
    qualifyRate: number;  // qualified / researched
    deadLeadRate: number; // disqualified / researched  ← the number we drive down
    contactRate: number;  // contacted / qualified
    proposalRate: number; // proposals / contacted
    winRate: number;      // won / proposals
  };
}

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);

export function computeFunnel(leads: FunnelLead[], events: FunnelEvent[] = []): Funnel {
  const contactedIds = new Set<string>();
  const proposalEventIds = new Set<string>();
  const callIds = new Set<string>();
  const emailIds = new Set<string>();
  for (const e of events) {
    if (!e.lead_id) continue;
    if (e.kind && CONTACT_KINDS.has(e.kind)) contactedIds.add(e.lead_id);
    if (e.kind === "call_placed" || e.kind === "call_completed") callIds.add(e.lead_id);
    if (e.kind === "email_sent") emailIds.add(e.lead_id);
    if (e.kind === "proposal_sent") proposalEventIds.add(e.lead_id);
  }

  let sourced = 0, researched = 0, qualified = 0, contacted = 0, proposals = 0, won = 0, disqualified = 0;
  let pipelineValue = 0, wonValue = 0;
  const byCode: Record<string, number> = {};
  const bySource: Record<string, { sourced: number; qualified: number; won: number; wonValue: number }> = {};

  for (const l of leads) {
    sourced++;
    const stage = (l.stage || "lead").toLowerCase();
    const val = typeof l.value === "number" ? l.value : 0;
    const id = l.id || "";
    const src = (l.source || "unknown").toString();
    const bs = bySource[src] || { sourced: 0, qualified: 0, won: 0, wonValue: 0 };
    bs.sourced++;

    if (stage !== "lead") researched++;
    if (stage === "lost") {
      disqualified++;
      const code = l.meta?.disqualifyCode || "other";
      byCode[code] = (byCode[code] || 0) + 1;
    }
    if (QUALIFIED_STAGES.has(stage)) {
      qualified++; bs.qualified++;
      if (stage !== "won") pipelineValue += val;
    }
    if (id && contactedIds.has(id)) contacted++;
    if (PROPOSAL_STAGES.has(stage) || (id && proposalEventIds.has(id))) proposals++;
    if (stage === "won") { won++; wonValue += val; bs.won++; bs.wonValue += val; }
    bySource[src] = bs;
  }

  return {
    sourced, researched, qualified, contacted, proposals, won, disqualified,
    disqualifiedByCode: byCode,
    contactedByChannel: { call: callIds.size, email: emailIds.size },
    bySource,
    pipelineValue, wonValue,
    rates: {
      qualifyRate: pct(qualified, researched),
      deadLeadRate: pct(disqualified, researched),
      contactRate: pct(contacted, qualified),
      proposalRate: pct(proposals, contacted),
      winRate: pct(won, proposals),
    },
  };
}
