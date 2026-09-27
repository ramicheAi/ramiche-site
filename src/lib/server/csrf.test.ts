import { describe, expect, it } from "vitest";
import { issueCsrfToken, verifyCsrfToken } from "./csrf";

const env = { PARALLAX_CSRF_SECRET: "x".repeat(48) };
const otherEnv = { PARALLAX_CSRF_SECRET: "y".repeat(48) };
const sessionA = "a".repeat(64);
const sessionB = "b".repeat(64);
const now = 1_700_000_000_000;

function tokenFor(session: string, e = env, nowMs = now) {
  const r = issueCsrfToken(session, { env: e, nowMs });
  if (!r.ok) throw new Error(r.reason);
  return r.token;
}

describe("csrf", () => {
  it("round-trips for the issuing session", () => {
    expect(verifyCsrfToken(tokenFor(sessionA), sessionA, { env, nowMs: now })).toMatchObject({ ok: true });
  });

  it("denies when the secret is unset or too weak", () => {
    expect(issueCsrfToken(sessionA, { env: {} })).toMatchObject({ ok: false, reason: "csrf_not_configured" });
    expect(verifyCsrfToken("v1.1.x", sessionA, { env: {} })).toMatchObject({
      ok: false, reason: "csrf_not_configured", status: 503,
    });
    expect(issueCsrfToken(sessionA, { env: { PARALLAX_CSRF_SECRET: "short" } })).toMatchObject({ ok: false });
  });

  it("denies missing, duplicate and malformed tokens", () => {
    expect(verifyCsrfToken(null, sessionA, { env })).toMatchObject({ reason: "csrf_missing" });
    expect(verifyCsrfToken("  ", sessionA, { env })).toMatchObject({ reason: "csrf_missing" });
    expect(verifyCsrfToken(`${tokenFor(sessionA)}, ${tokenFor(sessionA)}`, sessionA, { env, nowMs: now }))
      .toMatchObject({ reason: "csrf_duplicate" });
    for (const t of ["", "v1", "v2.1.abc", "v1.notanumber.abc", "v1.-1.abc", "junk"]) {
      expect(verifyCsrfToken(t, sessionA, { env, nowMs: now }).ok).toBe(false);
    }
  });

  it("denies cross-session replay (token from session A used with session B)", () => {
    expect(verifyCsrfToken(tokenFor(sessionA), sessionB, { env, nowMs: now })).toMatchObject({
      ok: false, reason: "csrf_mismatch", status: 403,
    });
  });

  it("denies expired tokens", () => {
    const t = issueCsrfToken(sessionA, { env, nowMs: now, ttlSeconds: 60 });
    if (!t.ok) throw new Error("issue failed");
    expect(verifyCsrfToken(t.token, sessionA, { env, nowMs: now + 61_000 })).toMatchObject({
      ok: false, reason: "csrf_expired",
    });
  });

  it("denies tokens minted under a different secret and tampered macs", () => {
    expect(verifyCsrfToken(tokenFor(sessionA, otherEnv), sessionA, { env, nowMs: now }))
      .toMatchObject({ reason: "csrf_mismatch" });
    const parts = tokenFor(sessionA).split(".");
    const tampered = `${parts[0]}.${Number(parts[1]) + 1}.${parts[2]}`;
    expect(verifyCsrfToken(tampered, sessionA, { env, nowMs: now })).toMatchObject({ reason: "csrf_mismatch" });
  });

  /**
   * DOCUMENTED LIMITATION, asserted so it cannot be mistaken for a guarantee:
   * this stateless token is reusable within its own session until expiry.
   * Single-use semantics and action idempotency require the durable claim
   * ledger, which is DISABLED in P03.
   */
  it("permits same-session reuse before expiry (no idempotency guarantee)", () => {
    const t = tokenFor(sessionA);
    expect(verifyCsrfToken(t, sessionA, { env, nowMs: now }).ok).toBe(true);
    expect(verifyCsrfToken(t, sessionA, { env, nowMs: now + 1000 }).ok).toBe(true);
  });
});
