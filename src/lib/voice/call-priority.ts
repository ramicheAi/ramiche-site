// /Users/admin/ramiche-site/src/lib/voice/call-priority.ts
// WHO to call, and in what order. Builds on lead-fit's pre-call scoring and the
// compliance gate to produce a ranked daily call list. See AI-CALL-AGENT-SPEC §3.1.
//
// Priority doctrine (Business Bible): warm + reachable + biggest gap, callable now,
// never twice. Consented opt-ins always float to the top (<60s response = +391%).
import { qualifyProspect, type ProspectLike } from "../lead-fit";
import type { GapId } from "../services-catalog";
import { assessCallCompliance, type CallableLead, type ComplianceOptions } from "./compliance";

export interface PriorityLead extends CallableLead, ProspectLike {
  id: string;
  company?: string | null;
  category?: string | null;
  meta?: {
    consent?: { toCall?: boolean; toRecord?: boolean };
    optOut?: boolean;
    dnc?: boolean;
    lastCallAt?: string;
    diagnose?: { gaps?: GapId[] };
    gaps?: GapId[];
    researchedAt?: string;
    intelAt?: string;
    [k: string]: unknown;
  } | null;
}

export interface CallCandidate {
  leadId: string;
  businessName: string;
  vertical: string;
  city: string;
  phone: string | null;
  score: number;          // higher = call sooner
  warm: boolean;          // consented opt-in
  callable: boolean;      // passes the compliance gate right now
  reasons: string[];      // why it ranks where it does
  blockers: string[];     // why it's not callable now (if any)
  gapCount: number;
}

function gapsOf(lead: PriorityLead): GapId[] {
  const m = lead.meta || {};
  return (Array.isArray(m.diagnose?.gaps) ? m.diagnose!.gaps : Array.isArray(m.gaps) ? m.gaps : []) as GapId[];
}

/** Score a single lead for call priority (0..~180). */
export function callPriority(lead: PriorityLead, opts: ComplianceOptions = {}): CallCandidate {
  const reasons: string[] = [];
  const businessName = (lead.company || lead.name || "Unknown business") as string;
  const vertical = (lead.category || "local business") as string;
  const city = (lead.city || "") as string;
  const meta = lead.meta || {};

  const fit = qualifyProspect({ name: businessName, category: lead.category, address: lead.address, phone: lead.phone, website: lead.website });
  let score = fit.fitScore; // 0..100 base
  if (fit.qualified) reasons.push("qualified ICP fit");

  // Warm/consented → biggest single boost (Bible: opt-ins close far higher).
  const warm = Boolean(meta.consent?.toCall);
  if (warm) { score += 60; reasons.push("opted in — call within 60s"); }

  // Opportunity size: more digital gaps = more to sell.
  const gaps = gapsOf(lead);
  if (gaps.length) { score += Math.min(30, gaps.length * 6); reasons.push(`${gaps.length} digital gap${gaps.length > 1 ? "s" : ""} to sell`); }

  // Freshness: recently researched intel is warmer to walk into.
  const researchedAt = (meta.intelAt || meta.researchedAt) as string | undefined;
  if (researchedAt) {
    const days = (Date.now() - new Date(researchedAt).getTime()) / 86_400_000;
    if (days <= 7) { score += 10; reasons.push("freshly researched"); }
  }

  const comp = assessCallCompliance(lead, opts);
  if (!comp.allowed) reasons.push("not callable right now");

  return {
    leadId: lead.id,
    businessName,
    vertical,
    city,
    phone: lead.phone ?? null,
    score: Math.round(score),
    warm,
    callable: comp.allowed,
    reasons,
    blockers: comp.blockers,
    gapCount: gaps.length,
  };
}

export interface RankOptions extends ComplianceOptions {
  limit?: number;            // top N (default 20)
  callableOnly?: boolean;    // drop leads that fail the compliance gate now
}

/** Rank a batch of leads into today's call list. Callable + highest score first. */
export function rankCallList(leads: PriorityLead[], opts: RankOptions = {}): CallCandidate[] {
  const limit = opts.limit ?? 20;
  const candidates = leads.map((l) => callPriority(l, opts));
  const filtered = opts.callableOnly ? candidates.filter((c) => c.callable) : candidates;
  filtered.sort((a, b) => {
    if (a.callable !== b.callable) return a.callable ? -1 : 1; // callable first
    if (a.warm !== b.warm) return a.warm ? -1 : 1;             // then warm
    return b.score - a.score;                                  // then score
  });
  return filtered.slice(0, limit);
}
