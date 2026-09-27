import { describe, expect, it, vi } from "vitest";
import { guardPrivateRead, guardProtectedMutation } from "./protected-mutation";
import { issueCsrfToken, CSRF_HEADER } from "./csrf";

const OWNER = "owner_uid_abcdefgh1234";
const TRUSTED = "https://command.parallaxvinc.com";
const session = "s".repeat(64);
const env = {
  PARALLAX_OWNER_UID: OWNER,
  PARALLAX_TRUSTED_ORIGINS: TRUSTED,
  PARALLAX_CSRF_SECRET: "z".repeat(48),
};
const nowMs = 1_700_000_000_000;
const csrf = (() => {
  const t = issueCsrfToken(session, { env, nowMs });
  if (!t.ok) throw new Error("issue failed");
  return t.token;
})();
const verifyOwner = async () => ({ uid: OWNER });

function mutation(headers: Record<string, string>) {
  return new Request(`${TRUSTED}/api/command-center/chat/approve`, { method: "POST", headers });
}
const full = {
  origin: TRUSTED,
  cookie: `__session=${session}`,
  [CSRF_HEADER]: csrf,
};

describe("guardProtectedMutation", () => {
  it("allows the owner with exact origin and valid session-bound CSRF", async () => {
    const r = await guardProtectedMutation(mutation(full), { env, nowMs, verifySession: verifyOwner });
    expect(r).toMatchObject({ ok: true, uid: OWNER });
  });

  it("checks origin first and never verifies the session on origin failure", async () => {
    const verifySession = vi.fn();
    const r = await guardProtectedMutation(
      mutation({ ...full, origin: "https://command.parallaxvinc.com.evil.com" }),
      { env, nowMs, verifySession }
    );
    expect(r.ok).toBe(false);
    expect(verifySession).not.toHaveBeenCalled();
  });

  it("denies a valid CSRF token when the session is absent", async () => {
    const { cookie: _drop, ...noCookie } = full;
    const r = await guardProtectedMutation(mutation(noCookie), { env, nowMs, verifySession: verifyOwner });
    expect(r).toMatchObject({ ok: false, reason: "missing_session", status: 401 });
  });

  it("denies a valid session with missing or foreign CSRF", async () => {
    const { [CSRF_HEADER]: _drop, ...noCsrf } = full;
    expect(await guardProtectedMutation(mutation(noCsrf), { env, nowMs, verifySession: verifyOwner }))
      .toMatchObject({ ok: false, reason: "csrf_missing", status: 403 });

    const foreign = issueCsrfToken("other".repeat(20), { env, nowMs });
    if (!foreign.ok) throw new Error("issue failed");
    expect(
      await guardProtectedMutation(mutation({ ...full, [CSRF_HEADER]: foreign.token }), {
        env, nowMs, verifySession: verifyOwner,
      })
    ).toMatchObject({ ok: false, reason: "csrf_mismatch" });
  });

  it("denies a non-owner authenticated human", async () => {
    const r = await guardProtectedMutation(mutation(full), {
      env, nowMs, verifySession: async () => ({ uid: "other_uid_1234567" }),
    });
    expect(r).toMatchObject({ ok: false, reason: "not_owner", status: 403 });
  });

  it("denies when any required config is missing", async () => {
    for (const k of ["PARALLAX_OWNER_UID", "PARALLAX_TRUSTED_ORIGINS", "PARALLAX_CSRF_SECRET"]) {
      const partial = { ...env, [k]: undefined } as Record<string, string | undefined>;
      const r = await guardProtectedMutation(mutation(full), {
        env: partial, nowMs, verifySession: verifyOwner,
      });
      expect(r.ok, k).toBe(false);
      expect((r as { status: number }).status).toBe(503);
    }
  });

  it("denial responses are side-effect free and leak nothing", async () => {
    const r = await guardProtectedMutation(mutation({ origin: "https://evil.com" }), {
      env, nowMs, verifySession: vi.fn(),
    });
    if (r.ok) throw new Error("expected denial");
    expect(r.response.headers.get("set-cookie")).toBeNull();
    expect(r.response.headers.get("access-control-allow-origin")).toBeNull();
    const body = await r.response.json();
    expect(body).toMatchObject({ ok: false, error: "denied" });
    expect(JSON.stringify(body)).not.toContain(OWNER);
    expect(JSON.stringify(body)).not.toContain(session);
  });
});

describe("guardPrivateRead", () => {
  it("allows the owner without origin/CSRF evidence", async () => {
    const r = await guardPrivateRead(
      new Request(`${TRUSTED}/api/command-center/gate`, { headers: { cookie: `__session=${session}` } }),
      { env, verifySession: verifyOwner }
    );
    expect(r).toMatchObject({ ok: true, uid: OWNER });
  });

  it("denies unauthenticated reads (P02 observed these as public)", async () => {
    const r = await guardPrivateRead(new Request(`${TRUSTED}/api/command-center/gate`), {
      env, verifySession: vi.fn(),
    });
    expect(r).toMatchObject({ ok: false, status: 401 });
  });
});
