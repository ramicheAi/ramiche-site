import { describe, expect, it } from "vitest";

import {
  attributionIdempotencyKey,
  computeRevenueTruth,
  minimizeAttributionEvent,
  validateAttributionEvent,
  type AttributionEvent,
} from "./attribution-contract";

const base = (overrides: Partial<AttributionEvent> = {}): AttributionEvent => ({
  schema_version: 1,
  event_name: "lead.created",
  source: "crm",
  source_event_id: "lead_123:created",
  occurred_at: "2026-10-10T12:00:00.000Z",
  received_at: "2026-10-10T12:00:01.000Z",
  tenant_id: "11111111-1111-1111-1111-111111111111",
  lead_id: "11111111-2222-4333-8444-555555555555",
  booking_id: null,
  checkout_id: null,
  youth_context: "none",
  consent: { analytics: "denied", marketing: "unknown", captured_at: null, source: "server-default" },
  attribution: null,
  revenue: null,
  properties: {},
  ...overrides,
});

const payment = (id: string, gross: number, fee: number | null): AttributionEvent =>
  base({
    event_name: "payment.succeeded",
    source: "stripe",
    source_event_id: id,
    revenue: {
      currency: "usd",
      gross_minor: gross,
      refunded_minor: 0,
      fee_minor: fee,
      stripe_object_id: "pi_123",
      stripe_payment_id: "pi_123",
      stripe_balance_transaction_id: fee === null ? null : "txn_123",
      livemode: true,
    },
  });

describe("P2 attribution contract", () => {
  it("builds a deterministic source-scoped idempotency key", () => {
    expect(attributionIdempotencyKey(base())).toBe("crm:lead.created:lead_123:created");
  });

  it("rejects attribution without explicit analytics consent", () => {
    const event = base({
      attribution: {
        channel: "paid_search", source: "google", medium: "cpc", campaign: "fall",
        content: null, term: null, landing_path: "/mettle", referrer_origin: "https://google.com",
        gclid: "secret-click-id", fbclid: null,
      },
    });
    expect(validateAttributionEvent(event)).toContainEqual({
      field: "attribution",
      message: "requires analytics consent",
    });
  });

  it("removes all campaign and click identifiers for youth context", () => {
    const event = base({
      youth_context: "possible",
      consent: { analytics: "granted", marketing: "granted", captured_at: "2026-10-10T12:00:00.000Z", source: "form" },
      attribution: {
        channel: "paid_social", source: "meta", medium: "cpc", campaign: "youth",
        content: "creative-a", term: null, landing_path: "/mettle", referrer_origin: "https://facebook.com",
        gclid: null, fbclid: "click-id",
      },
    });
    expect(minimizeAttributionEvent(event).attribution).toBeNull();
  });

  it("requires payment and refund truth to come from Stripe or reconciliation", () => {
    const event = payment("evt_1", 10_000, 320);
    expect(validateAttributionEvent({ ...event, source: "site" })).toContainEqual({
      field: "source",
      message: "revenue facts must come from Stripe or explicit reconciliation",
    });
  });

  it("deduplicates webhook retries and subtracts refunds and fees", () => {
    const paid = payment("evt_paid", 10_000, 320);
    const refund = base({
      event_name: "refund.succeeded",
      source: "stripe",
      source_event_id: "evt_refund",
      revenue: {
        currency: "usd",
        gross_minor: 0,
        refunded_minor: 2_500,
        fee_minor: 0,
        stripe_object_id: "re_123",
        stripe_payment_id: "pi_123",
        stripe_balance_transaction_id: "txn_refund",
        livemode: true,
      },
    });

    expect(computeRevenueTruth([paid, paid, refund], "usd", true)).toEqual({
      currency: "usd",
      gross_collected_minor: 10_000,
      refunded_minor: 2_500,
      fees_minor: 320,
      net_cash_minor: 7_180,
      unique_events: 2,
      duplicate_events: 1,
      idempotency_conflicts: 0,
      orphan_or_excess_refunds: 0,
    });
  });

  it("reports net cash as unknown when Stripe fee truth is unavailable", () => {
    expect(computeRevenueTruth([payment("evt_paid", 10_000, null)], "usd", true).net_cash_minor).toBeNull();
  });

  it("rejects unapproved or nested properties so PII cannot cross the boundary", () => {
    const event = base({ properties: { email: "minor@example.com", nested: { dob: "2012-01-01" } } as never });
    expect(validateAttributionEvent(event).map((issue) => issue.field)).toEqual([
      "properties.email", "properties.nested", "properties.nested",
    ]);
  });

  it("does not let an invalid first delivery suppress a later valid retry", () => {
    const valid = payment("evt_retry", 10_000, 320);
    const invalid = { ...valid, revenue: { ...valid.revenue!, currency: "USD" } };
    expect(computeRevenueTruth([invalid, valid], "usd", true).gross_collected_minor).toBe(10_000);
  });

  it("flags payload conflicts without double counting", () => {
    const first = payment("evt_conflict", 10_000, 320);
    const changed = { ...first, revenue: { ...first.revenue!, gross_minor: 20_000 } };
    expect(computeRevenueTruth([first, changed], "usd", true)).toMatchObject({
      gross_collected_minor: 10_000, idempotency_conflicts: 1,
    });
  });

  it("ignores failed payments and keeps live and test cash separate", () => {
    const failed = { ...payment("evt_failed", 50_000, null), event_name: "payment.failed" as const, revenue: null };
    const test = { ...payment("evt_test", 20_000, 100), revenue: { ...payment("evt_test", 20_000, 100).revenue!, livemode: false } };
    expect(computeRevenueTruth([failed, test, payment("evt_live", 10_000, 320)], "usd", true)).toMatchObject({
      gross_collected_minor: 10_000, fees_minor: 320, net_cash_minor: 9_680,
    });
  });

  it("allows an explicit manual reconciliation reference", () => {
    const event = { ...payment("manual_1", 10_000, 320), source: "manual_reconciliation" as const,
      revenue: { ...payment("manual_1", 10_000, 320).revenue!, stripe_object_id: "recon_case_42" } };
    expect(validateAttributionEvent(event)).toEqual([]);
  });

  it("rejects unknown nested consent and revenue fields", () => {
    const event = payment("evt_pii", 10_000, 320) as AttributionEvent & {
      consent: AttributionEvent["consent"] & { email: string };
      revenue: NonNullable<AttributionEvent["revenue"]> & { customer_email: string };
    };
    event.consent.email = "minor@example.com";
    event.revenue.customer_email = "minor@example.com";
    expect(validateAttributionEvent(event).map((issue) => issue.field)).toEqual([
      "consent.email", "revenue.customer_email",
    ]);
  });

  it("detects cross-currency payload changes and ignores key ordering", () => {
    const usd = payment("evt_global_conflict", 10_000, 320);
    const eur = { ...usd, revenue: { ...usd.revenue!, currency: "eur" } };
    expect(computeRevenueTruth([usd, eur], "usd", true).idempotency_conflicts).toBe(1);

    const reordered = { ...usd, consent: { source: usd.consent.source, captured_at: null,
      marketing: usd.consent.marketing, analytics: usd.consent.analytics } };
    expect(computeRevenueTruth([usd, reordered], "usd", true)).toMatchObject({
      duplicate_events: 1, idempotency_conflicts: 0,
    });
  });

  it("requires every refund fact to link to its original payment intent", () => {
    const refund = payment("evt_refund_link", 0, 0);
    refund.event_name = "refund.succeeded";
    refund.revenue = { ...refund.revenue!, stripe_object_id: "re_123", stripe_payment_id: "" };
    expect(validateAttributionEvent(refund).map((issue) => issue.field)).toContain("revenue.stripe_payment_id");
  });

  it("rejects nested data and invalid types in approved revenue fields", () => {
    const event = payment("evt_bad_runtime", 10_000, 320) as AttributionEvent;
    event.revenue!.livemode = "true" as never;
    event.revenue!.stripe_balance_transaction_id = { email: "minor@example.com" } as never;
    expect(validateAttributionEvent(event).map((issue) => issue.field)).toEqual([
      "revenue.stripe_balance_transaction_id", "revenue.livemode",
    ]);
  });

  it("quarantines orphan and excess refunds from cash truth", () => {
    const paid = payment("evt_paid_cap", 10_000, 320);
    const refund = (id: string, amount: number, paymentId: string): AttributionEvent => base({
      event_name: "refund.succeeded", source: "stripe", source_event_id: id,
      revenue: { currency: "usd", gross_minor: 0, refunded_minor: amount, fee_minor: 0,
        stripe_object_id: `re_${id}`, stripe_payment_id: paymentId,
        stripe_balance_transaction_id: "txn_refund", livemode: true },
    });
    expect(computeRevenueTruth([
      paid, refund("orphan", 2_500, "pi_missing"),
      refund("valid", 8_000, "pi_123"), refund("excess", 3_000, "pi_123"),
    ], "usd", true)).toMatchObject({
      gross_collected_minor: 10_000, refunded_minor: 8_000,
      net_cash_minor: 1_680, orphan_or_excess_refunds: 2,
    });
  });

  it("rejects date-only values as timestamps", () => {
    expect(validateAttributionEvent(base({ occurred_at: "2026-10-10" })).map((issue) => issue.field)).toContain("occurred_at");
  });
});
