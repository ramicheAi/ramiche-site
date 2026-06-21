// /Users/admin/ramiche-site/src/lib/voice/compliance.ts
// The legal gate every outbound call passes through BEFORE it dials. Encodes the
// AI-CALL-AGENT-SPEC §15 checklist: consent, suppression/opt-out, calling hours
// (TCPA: a called party's local 8am–9pm; we use a tighter 9am–8pm), and the
// disclosure/recording lines. Pure logic — the route adapts DB rows into this.
//
// Posture (decided): Option A (consented outbound) + C (inbound). Outbound dialing
// REQUIRES consent unless explicitly overridden for a disclosed-B2B test.
import { DISCLOSURE_LINE, RECORDING_CONSENT_LINE } from "./call-script";

export { DISCLOSURE_LINE, RECORDING_CONSENT_LINE };

export interface LeadConsent {
  toCall?: boolean;       // opted in (replied "call me" / form) — Option A
  toRecord?: boolean;     // agreed to recording (all-party-consent states)
  capturedISO?: string;
  source?: string;        // "email_reply" | "web_form" | ...
}

/** The subset of a pipeline lead the compliance gate needs. */
export interface CallableLead {
  id?: string;
  phone?: string | null;
  city?: string | null;
  meta?: {
    consent?: LeadConsent;
    optOut?: boolean;       // hard opt-out — never call again
    dnc?: boolean;          // on a do-not-call list
    lastCallAt?: string;    // ISO of the last outbound call
    [k: string]: unknown;
  } | null;
}

export interface ComplianceOptions {
  /** Require explicit opt-in (Option A). True by default — the safe posture. */
  requireConsent?: boolean;
  /** Minimum hours between calls to the same number (dedup). Default 72h. */
  minHoursBetweenCalls?: number;
  /** "Now" — injectable for tests. */
  now?: Date;
}

export interface ComplianceResult {
  allowed: boolean;
  blockers: string[];   // hard stops — do NOT dial
  warnings: string[];   // proceed, but flagged
  requiresRecordingConsent: boolean;
}

// ── Calling hours (called party's LOCAL time) ───────────────────────────────
// US states that are NOT Eastern in our ICP. Default → Eastern.
const TZ_BY_STATE: Record<string, string> = {
  TX: "America/Chicago",
  // FL, GA, NC (our other ICP states) are Eastern → default.
};
// All-party (two-party) recording-consent states — must say the recording line.
const ALL_PARTY_CONSENT_STATES = new Set([
  "FL", "CA", "PA", "IL", "WA", "MA", "MD", "MI", "MT", "NH", "CT", "DE", "OR", "NV",
]);

function stateFromCity(city?: string | null): string | null {
  const m = (city || "").match(/,\s*([A-Z]{2})\b/);
  return m ? m[1] : null;
}

function timezoneForCity(city?: string | null): string {
  const st = stateFromCity(city);
  return (st && TZ_BY_STATE[st]) || "America/New_York";
}

/** Local hour (0–23) of a city right now. */
export function localHour(city: string | null | undefined, now = new Date()): number {
  try {
    const s = new Intl.DateTimeFormat("en-US", { timeZone: timezoneForCity(city), hour: "numeric", hour12: false }).format(now);
    const h = parseInt(s, 10);
    return Number.isFinite(h) ? h % 24 : 12;
  } catch {
    return 12;
  }
}

/** Conservative calling window: 9am–8pm the called party's local time. */
export function withinCallingHours(city: string | null | undefined, now = new Date()): boolean {
  const h = localHour(city, now);
  return h >= 9 && h < 20;
}

/** Does this lead's state require an all-party recording-consent line? */
export function requiresRecordingConsent(city?: string | null): boolean {
  const st = stateFromCity(city);
  return st ? ALL_PARTY_CONSENT_STATES.has(st) : true; // unknown → assume yes (safe)
}

/** THE GATE. Returns whether we may legally place an outbound call to this lead. */
export function assessCallCompliance(lead: CallableLead, opts: ComplianceOptions = {}): ComplianceResult {
  const requireConsent = opts.requireConsent ?? true;
  const minHours = opts.minHoursBetweenCalls ?? 72;
  const now = opts.now ?? new Date();
  const meta = lead.meta || {};
  const blockers: string[] = [];
  const warnings: string[] = [];

  // Hard stops.
  if (!lead.phone || lead.phone.replace(/\D/g, "").length < 10) blockers.push("no valid phone number");
  if (meta.optOut) blockers.push("lead opted out — never call");
  if (meta.dnc) blockers.push("lead is on a do-not-call list");
  if (requireConsent && !meta.consent?.toCall) blockers.push("no call consent (Option A requires opt-in)");

  // Dedup — don't call the same number twice in the window.
  if (meta.lastCallAt) {
    const hrs = (now.getTime() - new Date(meta.lastCallAt).getTime()) / 3_600_000;
    if (hrs < minHours) blockers.push(`called ${Math.round(hrs)}h ago (min ${minHours}h between calls)`);
  }

  // Calling hours — block (it'll be callable later today/tomorrow).
  if (!withinCallingHours(lead.city, now)) blockers.push(`outside calling hours (9am–8pm local in ${lead.city || "unknown tz"})`);

  // Warnings (proceed, but note).
  if (!meta.consent?.toRecord && requiresRecordingConsent(lead.city)) {
    warnings.push("all-party-consent state — Mercury must say the recording-consent line");
  }

  return {
    allowed: blockers.length === 0,
    blockers,
    warnings,
    requiresRecordingConsent: requiresRecordingConsent(lead.city),
  };
}
