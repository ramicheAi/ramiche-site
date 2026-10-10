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
        stripe_balance_transaction_id: "txn_refund",
        livemode: true,
      },
    });

    expect(computeRevenueTruth([paid, paid, refund], "usd")).toEqual({
      currency: "usd",
      gross_collected_minor: 10_000,
      refunded_minor: 2_500,
      fees_minor: 320,
      net_cash_minor: 7_180,
      unique_events: 2,
      duplicate_events: 1,
    });
  });

  it("reports net cash as unknown when Stripe fee truth is unavailable", () => {
    expect(computeRevenueTruth([payment("evt_paid", 10_000, null)], "usd").net_cash_minor).toBeNull();
  });
});
