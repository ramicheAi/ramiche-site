import { describe, expect, it } from "vitest";
import {
  CLAIMS_ENABLED,
  acquireDurableClaim,
  claimBackendStatus,
  claimsEnabled,
  validateEnvelopeShape,
} from "./durable-claim-contract";

const envelope = {
  taskId: "t1",
  taskVersion: "1",
  projectId: "p1",
  tenantId: "tenant-fixture",
  payloadSha256: "a".repeat(64),
  target: "resource:x",
  checkoutDigest: "b".repeat(64),
  checkoutId: "checkout-fixture", branch: "p03-test", headSha: "c".repeat(40),
  scope: ["gate:approve"],
  budget: { unit: "usd", limit: 0 },
  evidenceIds: ["e1"],
  evidenceVersion: "1",
  idempotencyKey: "k1",
  expiresAt: "2026-01-01T00:00:00.000Z",
  provenance: { requestedBy: "agent:x", approvedBy: "human:verified-uid" },
  actionClass: 4 as const,
};

describe("durable claim contract", () => {
  it("is disabled and stays disabled when a flag requests enablement", () => {
    expect(CLAIMS_ENABLED).toBe(false);
    expect(claimsEnabled({ PARALLAX_CLAIMS_ENABLED: "1" })).toBe(false);
    expect(claimsEnabled({ PARALLAX_CLAIMS_ENABLED: "true" })).toBe(false);
    expect(claimBackendStatus()).toMatchObject({ enabled: false, backend: "none" });
  });

  it("denies acquisition even for a fully-formed envelope", async () => {
    expect(await acquireDurableClaim(envelope)).toEqual({
      ok: false, reason: "claims_disabled", status: 503,
    });
  });

  it("validates envelope shape without authorizing anything", () => {
    expect(validateEnvelopeShape(envelope)).toEqual({ ok: true });
    expect(validateEnvelopeShape({ ...envelope, expiresAt: null })).toMatchObject({ reason: "expiry_missing" });
    expect(validateEnvelopeShape({ ...envelope, budget: null })).toMatchObject({ reason: "budget_unknown" });
    expect(validateEnvelopeShape({ ...envelope, idempotencyKey: "" })).toMatchObject({ reason: "envelope_incomplete" });
    expect(validateEnvelopeShape({ ...envelope, scope: [] })).toMatchObject({ reason: "envelope_incomplete" });
    expect(validateEnvelopeShape(null)).toMatchObject({ reason: "envelope_incomplete" });
  });
});
