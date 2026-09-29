// The AI Acquisition Engine — Stage 3 nurture sequence (email).
// A consented funnel lead is walked through these touches automatically. Each step
// is drafted to the approval gate (Ramon approves → it sends), or auto-sends once a
// channel is trusted. Value-first, proof-led, low-pressure (Business Bible). SMS
// touches come later (after A2P 10DLC registration + consent infra).

export interface NurtureLead {
  business: string;
  name?: string | null;
  gaps?: string[]; // from the audit (meta.audit.gaps), if available
  healthScore?: number; // from the audit (meta.audit.healthScore), if available
  bookingUrl?: string; // Cal.com link, once Stage 4 is wired
}

export interface NurtureStep {
  /** day offset from opt-in when this touch fires */
  day: number;
  key: string;
  subject: (l: NurtureLead) => string;
  body: (l: NurtureLead) => string;
  isBookingAsk?: boolean;
  /** The touch delivers audit findings; the engine holds it until findings exist. */
  requiresAudit?: boolean;
}

const greet = (l: NurtureLead) => (l.name ? `Hi ${l.name},` : `Hi there,`);
const gapsLine = (l: NurtureLead) =>
  l.gaps && l.gaps.length ? `the biggest one: ${l.gaps[0]}` : "a few quick wins most local businesses are leaving on the table";

export const NURTURE_SEQUENCE: NurtureStep[] = [
  {
    day: 0,
    key: "deliver-audit",
    requiresAudit: true,
    subject: (l) => `Your free audit for ${l.business}`,
    // P05-B2.1: the email itself carries the findings on file. Nothing is "attached".
    body: (l) =>
      `${greet(l)}\n\nHere's the free audit you asked for. We looked at what a customer sees when they find ${l.business} online.${typeof l.healthScore === "number" ? ` Overall score: ${Math.round(l.healthScore)} out of 100.` : ""}\n\nWhat we found:\n${(l.gaps || []).slice(0, 8).map((g) => `- ${g}`).join("\n")}\n\nNo charge, no catch. Use it, fix what you want. If one thing jumps out and you'd like a hand, just reply to this email.\n\nRamon\nParallax Ventures`,
  },
  {
    day: 2,
    key: "value-followup",
    subject: (l) => `The #1 fix for ${l.business} (takes an afternoon)`,
    body: (l) =>
      `${greet(l)}\n\nDid the audit land okay? If you only do one thing from it, do this: ${gapsLine(l)}.\n\nMost owners we send this to are surprised how much business that one gap quietly costs them every month. Happy to point you in the right direction — no pitch, just reply and ask.\n\nRamon`,
  },
  {
    day: 5,
    key: "proof",
    // P05-B4 preflight: no case study, location or customer result exists in the system,
    // so this touch claims none. It only refers to this lead's own audit findings.
    subject: (l) => `What fixing ${l.business}'s gaps would take`,
    body: (l) =>
      `${greet(l)}\n\nQuick one. ${l.gaps && l.gaps.length ? `From your audit, the first thing I would fix is this: ${l.gaps[0]}.` : `Your audit is still yours to use whenever you are ready.`}\n\nNo magic, just the unglamorous fixes done right, one at a time. If you want those handled for ${l.business}, I can walk you through exactly what it would take.\n\nRamon`,
  },
  {
    day: 9,
    key: "booking-ask",
    isBookingAsk: true,
    subject: (l) => `Want me to walk you through ${l.business}'s audit? (15 min)`,
    body: (l) =>
      `${greet(l)}\n\nIf the audit's been sitting in your inbox, no worries. Want to hop on a quick 15-minute call and I'll walk you through it live — what to fix first, what it's worth, and whether we're even a fit. No hard sell; if it's not for you, you'll still leave with a clear plan.\n\n${l.bookingUrl ? `Grab any time that works: ${l.bookingUrl}` : `Just reply with a couple times that work and I'll lock it in.`}\n\nRamon`,
  },
  {
    day: 14,
    key: "final",
    subject: (l) => `Last note on ${l.business} — keeping the audit either way`,
    body: (l) =>
      `${greet(l)}\n\nI'll stop filling your inbox after this. The audit's yours to keep and use whenever — no expiry.\n\nIf the timing's just off, reply "later" and I'll check back down the road. If you ever want the gaps handled for you, you know where I am.\n\nWishing ${l.business} a great rest of the year.\n\nRamon\nParallax Ventures`,
  },
];

/** ms between opt-in and a given step */
export function stepDueMs(stepIndex: number): number {
  const s = NURTURE_SEQUENCE[stepIndex];
  return s ? s.day * 24 * 60 * 60 * 1000 : 0;
}
