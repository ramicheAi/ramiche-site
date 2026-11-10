import { describe, expect, it } from "vitest";
import { decideSessionRecovery } from "./session-recovery";

const enforced = { on: true, routes: ["gate"] };
const off = { on: false, routes: [] };

describe("decideSessionRecovery", () => {
  it("never recovers on a 200 or any non-401 status", () => {
    expect(decideSessionRecovery(200, { authenticated: true, enforcement: enforced })).toEqual({
      recover: false,
    });
    expect(decideSessionRecovery(503, { enforcement: enforced })).toEqual({ recover: false });
  });

  it("leaves the local unlock alone while the guard is off for every route", () => {
    // This is the pre-existing production state. Clearing here would re-prompt the PIN
    // forever, because the PIN route cannot mint a cookie without a signing secret.
    expect(decideSessionRecovery(401, { reason: "missing", enforcement: off })).toEqual({
      recover: false,
    });
  });

  it("does not loop when enforcement is on but the signing secret is missing", () => {
    expect(decideSessionRecovery(401, { reason: "not_configured", enforcement: enforced })).toEqual({
      recover: false,
    });
  });

  it("recovers with a specific notice for expired and revoked sessions", () => {
    expect(decideSessionRecovery(401, { reason: "expired", enforcement: enforced })).toEqual({
      recover: true,
      notice: "Your founder session expired. Enter the PIN to unlock again.",
    });
    expect(decideSessionRecovery(401, { reason: "revoked", enforcement: enforced })).toEqual({
      recover: true,
      notice: "Your founder session was revoked. Enter the PIN to unlock again.",
    });
  });

  it("recovers with a generic notice for missing, malformed or forged sessions", () => {
    for (const reason of ["missing", "malformed", "bad_signature"]) {
      expect(decideSessionRecovery(401, { reason, enforcement: enforced })).toEqual({
        recover: true,
        notice: "The server no longer recognises this session. Enter the PIN to unlock again.",
      });
    }
  });

  it("does not guess when enforcement info is absent from the response", () => {
    expect(decideSessionRecovery(401, { reason: "expired" })).toEqual({ recover: false });
    expect(decideSessionRecovery(401, null)).toEqual({ recover: false });
  });
});
