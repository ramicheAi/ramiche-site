// /Users/admin/ramiche-site/src/lib/lead-qualification.ts
// The gate that keeps the pipeline free of dead / junk leads. ONE source of truth
// for "is this lead worth spending prep + outreach effort on?" Used in two places:
//   1. OSM intake (prospector)  — a FREE pre-filter before any research cost.
//   2. Post-research (diagnose) — the REAL gate, grounded in live web research.
//
// Why this exists: the prospector sources from OpenStreetMap, which lags reality by
// years — closed businesses linger. A dead business with no website otherwise scores
// as a PERFECT lead (max gaps, high ACV), so it sailed through and got prepped/called.
// We sell to businesses that are ALIVE, REACHABLE, have a real NEED, and are a FIT.

export type OperatingStatus = "open" | "closed" | "uncertain";

export type DisqualifyCode =
  | "closed" //         permanently closed / dissolved — never sell to a dead business
  | "unreachable" //    no phone AND no email after research — can't sell to a ghost
  | "self_sufficient" // strong digital presence — our impact would be marginal
  | "chain" //          national chain / franchise — corporate handles marketing
  | "no_name"; //       unusable record (no business name)

export interface QualificationResult {
  qualified: boolean;
  code: DisqualifyCode | null;
  reason: string; // human-facing, shown on the lead so Ramon sees WHY it was killed
}

// ── 1) OSM intake pre-filter (free; runs before any research spend) ──────────
// OSM closure conventions: the live tag is moved under a `disused:`/`was:`/
// `abandoned:` namespace, OR mappers leave a flag / rename to "… (CLOSED)".
const OSM_CLOSED_PREFIXES = ["disused", "abandoned", "demolished", "razed", "removed", "was", "construction"];
const CLOSED_NAME_RE = /\b(permanently )?closed\b|\(closed\)|out of business|cerrado|fermé|går ej|geschlossen/i;

/** True when OSM tags/name indicate the business is no longer operating. */
export function osmLooksClosed(name: string | undefined, tags: Record<string, string> = {}): boolean {
  if (name && CLOSED_NAME_RE.test(name)) return true;
  for (const [k, vRaw] of Object.entries(tags)) {
    const key = k.toLowerCase();
    const v = (vRaw || "").toLowerCase();
    if (OSM_CLOSED_PREFIXES.some((p) => key === p || key.startsWith(p + ":"))) {
      if (v !== "no" && v !== "false") return true; // disused=no means "not closed"
    }
  }
  const oh = (tags["opening_hours"] || "").toLowerCase();
  if (oh === "closed" || oh === "off") return true;
  return false;
}

// ── 2) Post-research qualification (the real gate, in diagnose) ──────────────
export interface PostResearchInput {
  /** From intel web research. Undefined when research hasn't run yet. */
  operating?: OperatingStatus | string | null;
  /** Best-available contact AFTER research enrichment. */
  phone?: string | null;
  email?: string | null;
  /** Digital-health score from auditLead (+ intel refinement), 0..100. */
  healthScore: number;
  isChain?: boolean;
  /** True once web research (intel) has run — gates checks that need research. */
  researched?: boolean;
}

/** Health at/above this = "they've got it handled", skip. */
export const HEALTH_DISQUALIFY = 65;

const has = (v?: string | null) => !!(v && String(v).trim());

/**
 * The single decision: should we work this lead? Order matters — a dead business is
 * killed before we ever look at its gaps. Each kill returns a reason for the UI.
 */
export function qualifyPostResearch(input: PostResearchInput): QualificationResult {
  const op = String(input.operating ?? "").toLowerCase();

  // 1) ALIVE — a closed/dissolved business is an automatic kill, regardless of gaps.
  if (op === "closed") {
    return { qualified: false, code: "closed", reason: "Permanently closed / dissolved — not an active business. Auto-skipped." };
  }

  // 2) REACHABLE — once we've researched and STILL found no contact, it's a ghost.
  //    (Skip this gate pre-research: intel often enriches the contact.)
  if (input.researched && !has(input.phone) && !has(input.email)) {
    return { qualified: false, code: "unreachable", reason: "No phone or email found after research — unreachable. Find a contact before spending on it." };
  }

  // 3) FIT — national chain / franchise handled by corporate.
  if (input.isChain) {
    return { qualified: false, code: "chain", reason: "National chain / franchise — corporate handles their marketing. Not a fit." };
  }

  // 4) NEED — already strong online; our impact would be marginal.
  if (input.healthScore >= HEALTH_DISQUALIFY) {
    return { qualified: false, code: "self_sufficient", reason: "Strong digital presence — they've got it handled. Our impact would be marginal." };
  }

  return { qualified: true, code: null, reason: "Active, reachable, and has fixable gaps — worth pursuing." };
}
