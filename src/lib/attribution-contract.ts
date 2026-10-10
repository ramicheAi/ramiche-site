/**
 * P2 attribution contract.
 *
 * This module is deliberately side-effect free. It defines and validates the
 * event boundary, privacy minimization, idempotency key, and cash-truth math.
 * It does not emit analytics, write a database row, or call a vendor.
 */

export const ATTRIBUTION_SCHEMA_VERSION = 1 as const;

export const ATTRIBUTION_EVENT_NAMES = [
  "acquisition.captured",
  "lead.created",
  "qualification.completed",
  "booking.created",
  "booking.completed",
  "booking.canceled",
  "booking.no_show",
  "checkout.created",
  "payment.succeeded",
  "payment.failed",
  "refund.succeeded",
] as const;

export type AttributionEventName = (typeof ATTRIBUTION_EVENT_NAMES)[number];
export type ConsentState = "granted" | "denied" | "unknown" | "not_applicable";
export type YouthContext = "none" | "possible" | "confirmed";
export type EventSource = "site" | "crm" | "booking" | "stripe" | "manual_reconciliation";

export interface ConsentSnapshot {
  analytics: ConsentState;
  marketing: ConsentState;
  captured_at: string | null;
  source: string;
}

export interface AttributionTouch {
  channel: string | null;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
  landing_path: string | null;
  referrer_origin: string | null;
  gclid: string | null;
  fbclid: string | null;
}

export interface RevenueFact {
  currency: string;
  gross_minor: number;
  refunded_minor: number;
  fee_minor: number | null;
  stripe_object_id: string;
  stripe_balance_transaction_id: string | null;
  livemode: boolean;
}

export interface AttributionEvent {
  schema_version: typeof ATTRIBUTION_SCHEMA_VERSION;
  event_name: AttributionEventName;
  source: EventSource;
  source_event_id: string;
  occurred_at: string;
  received_at: string;
  tenant_id: string;
  lead_id: string | null;
  booking_id: string | null;
  checkout_id: string | null;
  youth_context: YouthContext;
  consent: ConsentSnapshot;
  attribution: AttributionTouch | null;
  revenue: RevenueFact | null;
  properties: Record<string, string | number | boolean | null>;
}

export interface ContractIssue {
  field: string;
  message: string;
}

const EVENT_NAME_SET = new Set<string>(ATTRIBUTION_EVENT_NAMES);
const REVENUE_EVENTS = new Set<AttributionEventName>([
  "payment.succeeded",
  "payment.failed",
  "refund.succeeded",
]);

function isIsoTimestamp(value: string): boolean {
  return Boolean(value && Number.isFinite(Date.parse(value)));
}

function isIntegerAtLeastZero(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

export function attributionIdempotencyKey(
  event: Pick<AttributionEvent, "source" | "event_name" | "source_event_id">,
): string {
  return `${event.source}:${event.event_name}:${event.source_event_id}`;
}

export function validateAttributionEvent(event: AttributionEvent): ContractIssue[] {
  const issues: ContractIssue[] = [];

  if (event.schema_version !== ATTRIBUTION_SCHEMA_VERSION) {
    issues.push({ field: "schema_version", message: "unsupported schema version" });
  }
  if (!EVENT_NAME_SET.has(event.event_name)) {
    issues.push({ field: "event_name", message: "unknown event name" });
  }
  if (!event.source_event_id.trim()) {
    issues.push({ field: "source_event_id", message: "required for replay-safe ingestion" });
  }
  if (!event.tenant_id.trim()) {
    issues.push({ field: "tenant_id", message: "required" });
  }
  if (!isIsoTimestamp(event.occurred_at)) {
    issues.push({ field: "occurred_at", message: "must be an ISO timestamp" });
  }
  if (!isIsoTimestamp(event.received_at)) {
    issues.push({ field: "received_at", message: "must be an ISO timestamp" });
  }

  if (event.attribution && event.consent.analytics !== "granted") {
    issues.push({ field: "attribution", message: "requires analytics consent" });
  }
  if (event.youth_context !== "none" && event.attribution) {
    issues.push({ field: "attribution", message: "must be omitted for possible or confirmed youth context" });
  }

  const expectsRevenue = REVENUE_EVENTS.has(event.event_name);
  if (expectsRevenue !== Boolean(event.revenue)) {
    issues.push({
      field: "revenue",
      message: expectsRevenue ? "required for payment and refund events" : "only allowed on payment and refund events",
    });
  }

  if (event.revenue) {
    const r = event.revenue;
    if (event.source !== "stripe" && event.source !== "manual_reconciliation") {
      issues.push({ field: "source", message: "revenue facts must come from Stripe or explicit reconciliation" });
    }
    if (!/^[a-z]{3}$/.test(r.currency)) {
      issues.push({ field: "revenue.currency", message: "must be a lowercase ISO 4217 code" });
    }
    if (!isIntegerAtLeastZero(r.gross_minor)) {
      issues.push({ field: "revenue.gross_minor", message: "must be a non-negative safe integer" });
    }
    if (!isIntegerAtLeastZero(r.refunded_minor)) {
      issues.push({ field: "revenue.refunded_minor", message: "must be a non-negative safe integer" });
    }
    if (r.fee_minor !== null && !isIntegerAtLeastZero(r.fee_minor)) {
      issues.push({ field: "revenue.fee_minor", message: "must be null or a non-negative safe integer" });
    }
    if (!r.stripe_object_id.startsWith("pi_") && !r.stripe_object_id.startsWith("ch_") && !r.stripe_object_id.startsWith("re_")) {
      issues.push({ field: "revenue.stripe_object_id", message: "must be a payment intent, charge, or refund id" });
    }
  }

  return issues;
}

/**
 * Enforces storage minimization before validation/persistence. Campaign data is
 * retained only with explicit analytics consent and never in a youth context.
 */
export function minimizeAttributionEvent(event: AttributionEvent): AttributionEvent {
  if (event.consent.analytics === "granted" && event.youth_context === "none") return event;
  return { ...event, attribution: null };
}

export interface RevenueTruth {
  currency: string;
  gross_collected_minor: number;
  refunded_minor: number;
  fees_minor: number | null;
  net_cash_minor: number | null;
  unique_events: number;
  duplicate_events: number;
}

/**
 * Computes cash truth from validated Stripe facts. First write wins for the
 * same source event, matching a UNIQUE idempotency key in the future store.
 */
export function computeRevenueTruth(events: AttributionEvent[], currency: string): RevenueTruth {
  const seen = new Set<string>();
  let gross = 0;
  let refunds = 0;
  let fees = 0;
  let feesComplete = true;
  let duplicates = 0;
  let unique = 0;

  for (const event of events) {
    const key = attributionIdempotencyKey(event);
    if (seen.has(key)) {
      duplicates++;
      continue;
    }
    seen.add(key);

    if (validateAttributionEvent(event).length || !event.revenue || event.revenue.currency !== currency) continue;
    unique++;
    if (event.event_name === "payment.succeeded") gross += event.revenue.gross_minor;
    if (event.event_name === "refund.succeeded") refunds += event.revenue.refunded_minor;
    if (event.revenue.fee_minor === null) feesComplete = false;
    else fees += event.revenue.fee_minor;
  }

  return {
    currency,
    gross_collected_minor: gross,
    refunded_minor: refunds,
    fees_minor: feesComplete ? fees : null,
    net_cash_minor: feesComplete ? gross - refunds - fees : null,
    unique_events: unique,
    duplicate_events: duplicates,
  };
}
