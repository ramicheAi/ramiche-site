import { describe, expect, it } from "vitest";
import {
  FOUNDER_SESSION_COOKIE,
  FOUNDER_SESSION_TTL_MS,
  isFounderGuardEnforced,
  mintFounderSession,
  readCookie,
  requireFounderAuthority,
  signFounderSession,
  verifyFounderAuthority,
  verifyFounderSessionToken,
} from "./founder-authority";

const SECRET = "s".repeat(40);
const OTHER_SECRET = "o".repeat(40);
const NOW = 1_800_000_000_000;

function req(cookie?: string, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/command-center/yolo-approve", {
    method: "POST",
    headers: { ...(cookie ? { cookie } : {}), ...headers },
    body: JSON.stringify({ decided_by: "Ramon", founder: true }),
  });
}

describe("verifyFounderSessionToken", () => {
  it("accepts a valid, unexpired token", () => {
    const { value, expiresAt } = mintFounderSession(SECRET, NOW);
    expect(expiresAt).toBe(NOW + FOUNDER_SESSION_TTL_MS);
    expect(verifyFounderSessionToken(value, SECRET, NOW + 1000)).toEqual({ authorized: true, expiresAt });
  });

  it("rejects a tampered signature", () => {
    const { value } = mintFounderSession(SECRET, NOW);
    const last = value.slice(-1);
    const tampered = value.slice(0, -1) + (last === "A" ? "B" : "A");
    expect(verifyFounderSessionToken(tampered, SECRET, NOW)).toEqual({ authorized: false, reason: "bad_signature" });
  });

  it("rejects a tampered expiry (extending the session)", () => {
    const { value, expiresAt } = mintFounderSession(SECRET, NOW);
    const [v, , sig] = value.split(".");
    const extended = `${v}.${expiresAt + 10 * FOUNDER_SESSION_TTL_MS}.${sig}`;
    expect(verifyFounderSessionToken(extended, SECRET, NOW)).toEqual({ authorized: false, reason: "bad_signature" });
  });

  it("rejects an expired token", () => {
    const { value, expiresAt } = mintFounderSession(SECRET, NOW);
    expect(verifyFounderSessionToken(value, SECRET, expiresAt)).toEqual({ authorized: false, reason: "expired" });
    expect(verifyFounderSessionToken(value, SECRET, expiresAt + 1)).toEqual({ authorized: false, reason: "expired" });
  });

  it("rejects a missing token", () => {
    expect(verifyFounderSessionToken(null, SECRET, NOW)).toEqual({ authorized: false, reason: "missing" });
    expect(verifyFounderSessionToken("", SECRET, NOW)).toEqual({ authorized: false, reason: "missing" });
  });

  it("rejects a token signed with a different secret", () => {
    const { value } = mintFounderSession(OTHER_SECRET, NOW);
    expect(verifyFounderSessionToken(value, SECRET, NOW)).toEqual({ authorized: false, reason: "bad_signature" });
  });

  it("rejects malformed tokens and client-made-up values", () => {
    for (const t of ["true", "ok", "v1.abc.sig", "v2.1.sig", "v1.1", `v1.${NOW + 1000}.`, '{"ok":true}']) {
      expect(verifyFounderSessionToken(t, SECRET, NOW).authorized).toBe(false);
    }
  });

  it("is not_configured when no secret is available", () => {
    const { value } = mintFounderSession(SECRET, NOW);
    expect(verifyFounderSessionToken(value, null, NOW)).toEqual({ authorized: false, reason: "not_configured" });
  });
});

describe("verifyFounderAuthority (request-level)", () => {
  const env = { COMMAND_CENTER_SESSION_SECRET: SECRET } as unknown as NodeJS.ProcessEnv;

  it("accepts only the signed cookie", () => {
    const { value } = mintFounderSession(SECRET, NOW);
    const r = verifyFounderAuthority(req(`foo=bar; ${FOUNDER_SESSION_COOKIE}=${value}`), { env, now: NOW });
    expect(r.authorized).toBe(true);
  });

  it("ignores client-asserted identity in body, headers, and the sessionStorage-shaped value", () => {
    const r = verifyFounderAuthority(
      req(`cc-pin-auth=${encodeURIComponent('{"ok":true}')}`, {
        "x-founder": "true",
        "x-decided-by": "Ramon",
        authorization: "Bearer founder",
      }),
      { env, now: NOW },
    );
    expect(r).toEqual({ authorized: false, reason: "missing" });
  });

  it("treats a short secret as not configured", () => {
    const shortEnv = { COMMAND_CENTER_SESSION_SECRET: "short" } as unknown as NodeJS.ProcessEnv;
    const value = signFounderSession("short", NOW + 1000);
    expect(verifyFounderAuthority(req(`${FOUNDER_SESSION_COOKIE}=${value}`), { env: shortEnv, now: NOW })).toEqual({
      authorized: false,
      reason: "not_configured",
    });
  });
});

describe("readCookie", () => {
  it("parses a named cookie among others", () => {
    expect(readCookie("a=1; b=2;c=3", "b")).toBe("2");
    expect(readCookie("a=1", "b")).toBeNull();
    expect(readCookie(null, "b")).toBeNull();
  });
});

describe("isFounderGuardEnforced / requireFounderAuthority", () => {
  const env = (enforce?: string, secret: string | undefined = SECRET) =>
    ({
      ...(enforce !== undefined ? { CC_FOUNDER_GUARD_ENFORCE: enforce } : {}),
      ...(secret !== undefined ? { COMMAND_CENTER_SESSION_SECRET: secret } : {}),
    }) as unknown as NodeJS.ProcessEnv;

  it("defaults to off", () => {
    expect(isFounderGuardEnforced("yolo-approve", env())).toBe(false);
    expect(isFounderGuardEnforced("yolo-approve", env(""))).toBe(false);
    expect(requireFounderAuthority(req(), "yolo-approve", { env: env() })).toBeNull();
  });

  it("honors 'all' and comma lists", () => {
    expect(isFounderGuardEnforced("yolo-approve", env("all"))).toBe(true);
    expect(isFounderGuardEnforced("yolo-approve", env("chat-gate, yolo-approve"))).toBe(true);
    expect(isFounderGuardEnforced("yolo-approve", env("chat-gate"))).toBe(false);
  });

  it("returns 401 when enforced and the cookie is missing", async () => {
    const res = requireFounderAuthority(req(), "yolo-approve", { env: env("yolo-approve"), now: NOW });
    expect(res?.status).toBe(401);
    expect(await res?.json()).toMatchObject({ code: "founder_authority_required", reason: "missing" });
  });

  it("returns 503 (fail closed) when enforced but the secret is missing", () => {
    const res = requireFounderAuthority(req(), "yolo-approve", { env: env("yolo-approve", ""), now: NOW });
    expect(res?.status).toBe(503);
  });

  it("returns null when enforced and the cookie verifies", () => {
    const { value } = mintFounderSession(SECRET, NOW);
    expect(
      requireFounderAuthority(req(`${FOUNDER_SESSION_COOKIE}=${value}`), "yolo-approve", { env: env("all"), now: NOW }),
    ).toBeNull();
  });
});
