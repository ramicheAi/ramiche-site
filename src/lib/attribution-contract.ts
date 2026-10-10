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
  stripe_payment_id: string;
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
const EVENT_SOURCE_SET = new Set<string>(["site", "crm", "booking", "stripe", "manual_reconciliation"]);
const CONSENT_STATE_SET = new Set<string>(["granted", "denied", "unknown", "not_applicable"]);
const YOUTH_CONTEXT_SET = new Set<string>(["none", "possible", "confirmed"]);
const PROPERTY_KEY_SET = new Set<string>([
  "outcome", "reason_code", "qualification_version", "booking_status",
  "product_id", "plan_id", "failure_code", "reconciliation_reason",
]);
const EVENT_FIELD_SET = new Set<string>([
  "schema_version", "event_name", "source", "source_event_id", "occurred_at", "received_at",
  "tenant_id", "lead_id", "booking_id", "checkout_id", "youth_context", "consent",
  "attribution", "revenue", "properties",
]);
const ATTRIBUTION_FIELD_SET = new Set<string>([
  "channel", "source", "medium", "campaign", "content", "term", "landing_path",
  "referrer_origin", "gclid", "fbclid",
]);
const CONSENT_FIELD_SET = new Set<string>(["analytics", "marketing", "captured_at", "source"]);
const REVENUE_FIELD_SET = new Set<string>([
  "currency", "gross_minor", "refunded_minor", "fee_minor", "stripe_object_id",
  "stripe_payment_id", "stripe_balance_transaction_id", "livemode",
]);
const REVENUE_EVENTS = new Set<AttributionEventName>([
  "payment.succeeded",
  "payment.failed",
  "refund.succeeded",
]);
const REVENUE_REQUIRED_EVENTS = new Set<AttributionEventName>([
  "payment.succeeded",
  "refund.succeeded",
]);

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)
    && Number.isFinite(Date.parse(value));
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
  const runtime = event as unknown as Record<string, unknown>;

  for (const key of Object.keys(runtime)) {
    if (!EVENT_FIELD_SET.has(key)) issues.push({ field: key, message: "unknown top-level field" });
  }

  if (event.schema_version !== ATTRIBUTION_SCHEMA_VERSION) {
    issues.push({ field: "schema_version", message: "unsupported schema version" });
  }
  if (!EVENT_NAME_SET.has(event.event_name)) {
    issues.push({ field: "event_name", message: "unknown event name" });
  }
  if (!EVENT_SOURCE_SET.has(event.source)) {
    issues.push({ field: "source", message: "unknown event source" });
  }
  if (!YOUTH_CONTEXT_SET.has(event.youth_context)) {
    issues.push({ field: "youth_context", message: "unknown youth context" });
  }
  if (!event.consent || typeof event.consent !== "object") {
    issues.push({ field: "consent", message: "required object" });
  } else {
    for (const key of Object.keys(event.consent)) {
      if (!CONSENT_FIELD_SET.has(key)) issues.push({ field: `consent.${key}`, message: "unknown consent field" });
    }
    if (!CONSENT_STATE_SET.has(event.consent.analytics)) issues.push({ field: "consent.analytics", message: "unknown consent state" });
    if (!CONSENT_STATE_SET.has(event.consent.marketing)) issues.push({ field: "consent.marketing", message: "unknown consent state" });
    if (event.consent.captured_at !== null && !isIsoTimestamp(event.consent.captured_at)) {
      issues.push({ field: "consent.captured_at", message: "must be null or an ISO timestamp" });
    }
    if (typeof event.consent.source !== "string" || !event.consent.source.trim()) {
      issues.push({ field: "consent.source", message: "required" });
    }
  }
  if (typeof event.source_event_id !== "string" || !event.source_event_id.trim()) {
    issues.push({ field: "source_event_id", message: "required for replay-safe ingestion" });
  }
  if (typeof event.tenant_id !== "string" || !event.tenant_id.trim()) {
    issues.push({ field: "tenant_id", message: "required" });
  }
  if (!isIsoTimestamp(event.occurred_at)) {
    issues.push({ field: "occurred_at", message: "must be an ISO timestamp" });
  }
  if (!isIsoTimestamp(event.received_at)) {
    issues.push({ field: "received_at", message: "must be an ISO timestamp" });
  }
  for (const field of ["lead_id", "booking_id", "checkout_id"] as const) {
    const value = event[field];
    if (value !== null && (typeof value !== "string" || !value.trim())) {
      issues.push({ field, message: "must be null or a non-empty identifier" });
    }
  }

  if (event.attribution && event.consent?.analytics !== "granted") {
    issues.push({ field: "attribution", message: "requires analytics consent" });
  }
  if (event.youth_context !== "none" && event.attribution) {
    issues.push({ field: "attribution", message: "must be omitted for possible or confirmed youth context" });
  }

  const requiresRevenue = REVENUE_REQUIRED_EVENTS.has(event.event_name);
  const permitsRevenue = REVENUE_EVENTS.has(event.event_name);
  if (requiresRevenue && !event.revenue) {
    issues.push({
      field: "revenue",
      message: "required for successful payment and refund events",
    });
  } else if (!permitsRevenue && event.revenue) {
    issues.push({ field: "revenue", message: "only allowed on payment and refund events" });
  }

  if (!event.properties || typeof event.properties !== "object" || Array.isArray(event.properties)) {
    issues.push({ field: "properties", message: "must be a flat object" });
  } else {
    for (const [key, value] of Object.entries(event.properties)) {
      if (!PROPERTY_KEY_SET.has(key)) issues.push({ field: `properties.${key}`, message: "key is not approved for storage" });
      if (value !== null && !["string", "number", "boolean"].includes(typeof value)) {
        issues.push({ field: `properties.${key}`, message: "must be a scalar value" });
      }
    }
  }

  if (runtime.attribution !== null && (typeof runtime.attribution !== "object" || Array.isArray(runtime.attribution))) {
    issues.push({ field: "attribution", message: "must be null or an object" });
  } else if (event.attribution) {
    for (const [key, value] of Object.entries(event.attribution)) {
      if (!ATTRIBUTION_FIELD_SET.has(key)) issues.push({ field: `attribution.${key}`, message: "unknown attribution field" });
      if (value !== null && typeof value !== "string") issues.push({ field: `attribution.${key}`, message: "must be null or a string" });
    }
  }

  if (event.revenue) {
    const r = event.revenue;
    for (const key of Object.keys(r)) {
      if (!REVENUE_FIELD_SET.has(key)) issues.push({ field: `revenue.${key}`, message: "unknown revenue field" });
    }
    if (event.source !== "stripe" && event.source !== "manual_reconciliation") {
      issues.push({ field: "source", message: "revenue facts must come from Stripe or explicit reconciliation" });
    }
    if (typeof r.currency !== "string" || !/^[a-z]{3}$/.test(r.currency)) {
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
    const validStripeId = typeof r.stripe_object_id === "string"
      && (event.event_name === "refund.succeeded" ? /^re_/.test(r.stripe_object_id) : /^(pi|ch)_/.test(r.stripe_object_id));
    const validReconciliationId = event.source === "manual_reconciliation"
      && typeof r.stripe_object_id === "string" && /^recon_/.test(r.stripe_object_id);
    if (!validStripeId && !validReconciliationId) {
      issues.push({ field: "revenue.stripe_object_id", message: "must match the payment/refund event or be an explicit recon_ reference" });
    }
    if (typeof r.stripe_payment_id !== "string" || !r.stripe_payment_id.startsWith("pi_")) {
      issues.push({ field: "revenue.stripe_payment_id", message: "must link to the original Stripe payment intent" });
    }
    if (r.stripe_balance_transaction_id !== null
      && (typeof r.stripe_balance_transaction_id !== "string" || !r.stripe_balance_transaction_id.startsWith("txn_"))) {
      issues.push({ field: "revenue.stripe_balance_transaction_id", message: "must be null or a Stripe balance transaction id" });
    }
    if (typeof r.livemode !== "boolean") {
      issues.push({ field: "revenue.livemode", message: "must be a boolean" });
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
  idempotency_conflicts: number;
  orphan_or_excess_refunds: number;
  duplicate_or_conflicting_payments: number;
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * Computes cash truth from validated Stripe facts. First write wins for the
 * same source event, matching a UNIQUE idempotency key in the future store.
 */
export function computeRevenueTruth(events: AttributionEvent[], currency: string, livemode: boolean): RevenueTruth {
  const seen = new Map<string, string>();
  let gross = 0;
  let refunds = 0;
  let fees = 0;
  let feesComplete = true;
  let duplicates = 0;
  let unique = 0;
  let conflicts = 0;
  let orphanRefunds = 0;
  let paymentFactConflicts = 0;
  const applicable: AttributionEvent[] = [];

  for (const event of events) {
    if (validateAttributionEvent(event).length || !event.revenue) continue;

    const key = attributionIdempotencyKey(event);
    const canonical = stableSerialize(event);
    const prior = seen.get(key);
    if (prior) {
      if (prior === canonical) duplicates++;
      else conflicts++;
      continue;
    }
    seen.set(key, canonical);
    if (event.revenue.currency === currency && event.revenue.livemode === livemode
      && event.event_name !== "payment.failed") applicable.push(event);
  }

  const collectedByPayment = new Map<string, number>();
  const paymentFacts = new Map<string, string>();
  const refundedByPayment = new Map<string, number>();
  for (const event of applicable) {
    if (event.event_name !== "payment.succeeded" || !event.revenue) continue;
    const paymentFact = stableSerialize({
      currency: event.revenue.currency,
      gross_minor: event.revenue.gross_minor,
      fee_minor: event.revenue.fee_minor,
      livemode: event.revenue.livemode,
    });
    if (paymentFacts.has(event.revenue.stripe_payment_id)) {
      paymentFactConflicts++;
      continue;
    }
    paymentFacts.set(event.revenue.stripe_payment_id, paymentFact);
    collectedByPayment.set(event.revenue.stripe_payment_id,
      (collectedByPayment.get(event.revenue.stripe_payment_id) ?? 0) + event.revenue.gross_minor);
    unique++;
    gross += event.revenue.gross_minor;
    if (event.revenue.fee_minor === null) feesComplete = false;
    else fees += event.revenue.fee_minor;
  }
  for (const event of applicable) {
    if (event.event_name !== "refund.succeeded" || !event.revenue) continue;
    const paymentId = event.revenue.stripe_payment_id;
    const collected = collectedByPayment.get(paymentId) ?? 0;
    const nextRefunded = (refundedByPayment.get(paymentId) ?? 0) + event.revenue.refunded_minor;
    if (collected === 0 || nextRefunded > collected) {
      orphanRefunds++;
      continue;
    }
    refundedByPayment.set(paymentId, nextRefunded);
    unique++;
    refunds += event.revenue.refunded_minor;
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
    idempotency_conflicts: conflicts,
    orphan_or_excess_refunds: orphanRefunds,
    duplicate_or_conflicting_payments: paymentFactConflicts,
  };
}
