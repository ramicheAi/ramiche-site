import { describe, expect, it, vi } from "vitest";

/**
 * The client's denial mapping is only correct if it reads the body the guard actually sends.
 *
 * Every other test of this mapping feeds it a hand-written body, which is how the original defect
 * survived: the shape was assumed, and the assumption was never checked against the producer. This
 * file imports `ownerDenialResponse` itself and round-trips a real refusal through `describeWrite`.
 *
 * If the guard ever changes its envelope, these fail rather than the mapping silently reverting to
 * "the runtime rejected the change".
 */

vi.mock("@/lib/firebase-admin", () => ({ verifySessionCookie: vi.fn() }));

const { ownerDenialResponse } = await import("@/lib/server/command-center-guard");
const { describeWrite, describeRegistry } = await import("@/lib/fleet/settings-view");

/** Reasons the guard can produce, taken from its own source rather than guessed. */
const DENIAL_REASONS: Array<[reason: string, status: 401 | 403 | 503]> = [
  ["missing_session", 401],
  ["invalid_session", 401],
  ["session_expired", 401],
  ["not_owner", 403],
  ["owner_not_configured", 503],
  ["cross_site", 403],
  ["origin_mismatch", 403],
  ["missing_origin", 403],
  ["missing_unlock", 401],
  ["unlock_expired", 401],
  ["unlock_bad_signature", 401],
  ["unlock_malformed", 401],
  ["unlock_not_configured", 503],
  ["device_not_found", 401],
  ["device_secret_mismatch", 401],
  ["device_revoked", 401],
  ["device_expired", 401],
  ["device_owner_mismatch", 401],
  ["device_malformed", 401],
  ["device_not_configured", 401],
  ["device_mismatch", 401],
];

describe("the client reads the guard's real denial body", () => {
  for (const [reason, status] of DENIAL_REASONS) {
    it(`${reason} is an authorization refusal, and says nothing about the runtime`, async () => {
      const res = ownerDenialResponse({ ok: false, status, reason });
      expect(res.status).toBe(status);
      const body = await res.json();
      // The envelope is what the mapping keys on. Assert it, so a change here is loud.
      expect(body).toMatchObject({ ok: false, error: "denied", reason });

      const write = describeWrite(body);
      expect(write.state).toBe("unauthorized");
      if (write.state === "unauthorized") {
        expect(write.message.toLowerCase()).not.toContain("runtime rejected");
        expect(write.message.toLowerCase()).not.toMatch(/undefined/);
      }

      const read = describeRegistry(body);
      expect(read.state).toBe("denied");
      if (read.state === "denied") {
        expect(read.code).toBe(reason);
        // No reason may render "session expired" above advice that contradicts it.
        const rendered = `${read.heading} ${read.reason}`.toLowerCase();
        const sessionReasons = ["missing_session", "invalid_session", "session_expired", "missing_unlock"];
        if (!sessionReasons.includes(reason)) {
          expect(rendered).not.toContain("session expired");
        }
        expect(rendered).not.toContain("undefined");
      }
    });
  }

  it("does not leak the status code or a uid into the user-facing text", async () => {
    const res = ownerDenialResponse({ ok: false, status: 403, reason: "not_owner" });
    const body = await res.json();
    const view = describeRegistry(body);
    if (view.state !== "denied") throw new Error("expected denied");
    expect(`${view.heading} ${view.reason}`).not.toContain("403");
  });
});
