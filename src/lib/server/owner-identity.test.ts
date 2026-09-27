import { describe, expect, it, vi } from "vitest";
import { configuredOwnerUid, requireOwnerIdentity } from "./owner-identity";

const OWNER = "owner_uid_abcdefgh1234";
const okEnv = { PARALLAX_OWNER_UID: OWNER };

function req(cookie?: string, headers: Record<string, string> = {}) {
  return new Request("https://command.example.com/api/x", {
    method: "POST",
    headers: { ...(cookie ? { cookie } : {}), ...headers },
  });
}
const session = "s".repeat(64);

describe("configuredOwnerUid", () => {
  it("denies when missing, blank, or malformed", () => {
    expect(configuredOwnerUid({})).toBeNull();
    expect(configuredOwnerUid({ PARALLAX_OWNER_UID: "   " })).toBeNull();
    expect(configuredOwnerUid({ PARALLAX_OWNER_UID: "a b" })).toBeNull();
    expect(configuredOwnerUid({ PARALLAX_OWNER_UID: "short" })).toBeNull();
    expect(configuredOwnerUid(okEnv)).toBe(OWNER);
  });
});

describe("requireOwnerIdentity", () => {
  it("allows the configured owner with a verified session", async () => {
    const verifySession = vi.fn().mockResolvedValue({ uid: OWNER, email: "x@y.z" });
    const r = await requireOwnerIdentity(req(`__session=${session}`), { env: okEnv, verifySession });
    expect(r).toMatchObject({ ok: true, uid: OWNER });
  });

  it("denies and never verifies when owner config is missing", async () => {
    const verifySession = vi.fn();
    const r = await requireOwnerIdentity(req(`__session=${session}`), { env: {}, verifySession });
    expect(r).toMatchObject({ ok: false, reason: "owner_not_configured", status: 503 });
    expect(verifySession).not.toHaveBeenCalled();
  });

  it("denies with no session cookie", async () => {
    const r = await requireOwnerIdentity(req(), { env: okEnv, verifySession: vi.fn() });
    expect(r).toMatchObject({ ok: false, reason: "missing_session", status: 401 });
  });

  it("denies a too-short session cookie without calling the verifier", async () => {
    const verifySession = vi.fn();
    const r = await requireOwnerIdentity(req("__session=abc"), { env: okEnv, verifySession });
    expect(r).toMatchObject({ ok: false, reason: "invalid_session" });
    expect(verifySession).not.toHaveBeenCalled();
  });

  it("denies duplicate __session cookies (ambiguous)", async () => {
    const verifySession = vi.fn();
    const r = await requireOwnerIdentity(
      req(`__session=${session}; __session=${"t".repeat(64)}`),
      { env: okEnv, verifySession }
    );
    expect(r).toMatchObject({ ok: false, reason: "invalid_session" });
    expect(verifySession).not.toHaveBeenCalled();
  });

  it("denies malformed/expired/revoked sessions (verifier returns null)", async () => {
    const r = await requireOwnerIdentity(req(`__session=${session}`), {
      env: okEnv,
      verifySession: async () => null,
    });
    expect(r).toMatchObject({ ok: false, reason: "invalid_session", status: 401 });
  });

  it("denies when the verifier throws (admin SDK unavailable)", async () => {
    const r = await requireOwnerIdentity(req(`__session=${session}`), {
      env: okEnv,
      verifySession: async () => {
        throw new Error("FIREBASE_SERVICE_ACCOUNT not set");
      },
    });
    expect(r).toMatchObject({ ok: false, reason: "invalid_session" });
  });

  it("denies when the decoded token has no string uid", async () => {
    for (const decoded of [{}, { uid: 1 }, { uid: "" }, { uid: null }]) {
      const r = await requireOwnerIdentity(req(`__session=${session}`), {
        env: okEnv,
        verifySession: async () => decoded as { uid?: unknown },
      });
      expect(r).toMatchObject({ ok: false, reason: "invalid_session" });
    }
  });

  it("denies a different authenticated human (uid mismatch)", async () => {
    const r = await requireOwnerIdentity(req(`__session=${session}`), {
      env: okEnv,
      verifySession: async () => ({ uid: "someone_else_uid_99" }),
    });
    expect(r).toMatchObject({ ok: false, reason: "not_owner", status: 403 });
  });

  it("does NOT accept a matching email as identity", async () => {
    const r = await requireOwnerIdentity(req(`__session=${session}`), {
      env: okEnv,
      verifySession: async () => ({ uid: "impostor_uid_1234", email: "ramon@example.com" }),
    });
    expect(r).toMatchObject({ ok: false, reason: "not_owner" });
  });

  it("ignores request-supplied identity, role, host and auth headers", async () => {
    const verifySession = vi.fn().mockResolvedValue({ uid: OWNER });
    const r = await requireOwnerIdentity(
      req(undefined, {
        "x-ramon-uid": OWNER,
        "x-owner-uid": OWNER,
        "x-user-role": "owner",
        "x-parallax-principal": JSON.stringify({ uid: OWNER, role: "owner" }),
        authorization: "Bearer forged",
        "x-forwarded-host": "command.parallaxvinc.com",
        "x-forwarded-for": "127.0.0.1",
        host: "localhost",
      }),
      { env: okEnv, verifySession }
    );
    expect(r).toMatchObject({ ok: false, reason: "missing_session" });
    expect(verifySession).not.toHaveBeenCalled();
  });

  it("ignores a PIN-style body/header signal entirely", async () => {
    const r = await requireOwnerIdentity(req(undefined, { "x-cc-pin": "1234" }), {
      env: okEnv,
      verifySession: vi.fn(),
    });
    expect(r).toMatchObject({ ok: false, reason: "missing_session" });
  });
});
