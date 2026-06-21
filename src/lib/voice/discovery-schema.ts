// /Users/admin/ramiche-site/src/lib/voice/discovery-schema.ts
// The structured "what the client needs" object the AI call agent fills before it
// hangs up. This is the keystone of the closed loop: because `servicesWanted` is
// typed to the existing GapId union, the brief drops straight into
// recommendBundle() and the `web-client-delivery` skill with zero re-keying.
//
// Written to pipeline_leads.meta.discovery (same meta pattern as lead-gen.ts).
// See AI-CALL-AGENT-SPEC.md §6.
import type { GapId } from "@/lib/services-catalog";

/** Languages the agent runs natively in Phase 1 (matches the FL ICP — see spec §8). */
export type CallLanguage = "en" | "es" | "ht" | "pt" | string;

export type CallOutcome =
  | "booked"          // booked a review call with Ramon
  | "deposit_taken"   // card-on-file / deposit captured on the call
  | "callback"        // wants a call back later
  | "not_interested"
  | "no_answer"
  | "voicemail";

export interface CallDiscovery {
  // ── identity & contact ──────────────────────────────────────────────────
  business: { name: string; vertical: string; city: string; ownerName?: string };
  bestContact: {
    phone?: string;
    email?: string;
    preferredChannel: "phone" | "sms" | "email";
    bestTime?: string;
  };
  /** Detected primary language of the call. Transcript stored in this + English. */
  language: CallLanguage;

  // ── what they need (drives the build) ───────────────────────────────────
  /** Mapped to services-catalog GapIds so recommendBundle() consumes it directly. */
  servicesWanted: GapId[];
  /** Service ids the agent actually pitched (from recommendBundle output). */
  recommendedBundle: string[];
  budgetSignal: "low" | "mid" | "high" | "unknown";
  timeline: "asap" | "weeks" | "exploring" | "unknown";
  /** Are we talking to the person who can decide? */
  decisionMaker: boolean;

  // ── brand & assets (so design isn't guesswork) ──────────────────────────
  brand: {
    vibe?: string;
    colorsLiked?: string;
    competitorsAdmired?: string[];
    competitorsToBeat?: string[];
  };
  existingAssets: {
    logo?: boolean;
    photos?: boolean;
    menu?: boolean;
    domain?: string;
    socials?: string[];
  };
  /** Concrete must-haves: booking, online ordering, payments, multilingual site… */
  mustHaves: string[];

  // ── close state ─────────────────────────────────────────────────────────
  outcome: CallOutcome;
  depositTaken?: { amount: number; stripeRef?: string };
  nextStep: {
    type: "review_call" | "send_proposal" | "start_build" | "followup";
    whenISO?: string;
  };
  objections: string[];

  // ── compliance & provenance (spec §15) ──────────────────────────────────
  consent: { toCall: boolean; toRecord: boolean; capturedISO: string };
  callId: string;
  recordingUrl?: string;
  transcriptUrl?: string;
  durationSec: number;
  /** Post-call QA scorecard 0..100 (call-scorecard.ts). */
  agentScore?: number;
}

/** A call discovery is "ready to build" only when these are present. */
export function isBriefComplete(d: Partial<CallDiscovery>): boolean {
  return Boolean(
    d.business?.name &&
      d.business?.vertical &&
      d.servicesWanted?.length &&
      d.bestContact?.preferredChannel &&
      d.consent?.toCall &&
      d.outcome,
  );
}
