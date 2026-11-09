import { describe, expect, it } from "vitest";
import {
  CLOCK_SKEW_MS,
  FOUNDER_GUARD_ENFORCE_ENV,
  FOUNDER_REVOKE_BEFORE_ENV,
  FOUNDER_SESSION_COOKIE,
  FOUNDER_SESSION_TTL_MS,
  MACHINE_ROUTES_ENV,
  MACHINE_SECRET_ENV,
  getFounderRevokeBefore,
  isFounderGuardEnforced,
  isSameOriginRequest,
  mintFounderSession,
  readCookie,
  requireFounderAuthority,
  signFounderSession,
  verifyFounderSessionToken,
  verifyMachineCredential,
} from "./founder-authority";

const SECRET = "s".repeat(48);
const MACHINE = "m".repeat(48);

function env(over: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    COMMAND_CENTER_SESSION_SECRET: SECRET,
    [FOUNDER_GUARD_ENFORCE_ENV]: "all",
    ...over,
  } as unknown as NodeJS.ProcessEnv;
}

function req(
  opts: {
    method?: string;
    cookie?: string;
    host?: string;
    origin?: string;
    referer?: string;
    authorization?: string;
    body?: string;
    headers?: Record<string, string>;
  } = {},
): Request {
  const headers: Record<string, string> = {
    host: opts.host ?? "command.parallaxvinc.com",
    ...(opts.cookie ? { cookie: opts.cookie } : {}),
    ...(opts.origin ? { origin: opts.origin } : {}),
    ...(opts.referer ? { referer: opts.referer } : {}),
    ...(opts.authorization ? { authorization: opts.authorization } : {}),
    ...(opts.headers ?? {}),
  };
  return new Request("https://command.parallaxvinc.com/api/command-center/yolo-approve", {
    method: opts.method ?? "POST",
    headers,
    ...(opts.body ? { body: opts.body } : {}),
  });
}

function sessionCookie(expiresIn = 60_000, issuedAt = Date.now()): string {
  return `${FOUNDER_SESSION_COOKIE}=${signFounderSession(SECRET, Date.now() + expiresIn, issuedAt)}`;
}

describe("session token", () => {
  it("accepts a token the server signed, and returns its lifetime", () => {
    const expiresAt = Date.now() + 60_000;
    const result = verifyFounderSessionToken(signFounderSession(SECRET, expiresAt), SECRET);
    expect(result.authorized).toBe(true);
    if (result.authorized) {
      expect(result.expiresAt).toBe(expiresAt);
      expect(result.issuedAt).toBeLessThanOrEqual(Date.now());
    }
  });

  it("rejects a tampered expiry and a tampered signature", () => {
    const token = signFounderSession(SECRET, Date.now() + 60_000);
    const parts = token.split(".");
    const laterExpiry = [parts[0], parts[1], String(Number(parts[2]) + 86_400_000), parts[3]].join(".");
    const flipped = [parts[0], parts[1], parts[2], parts[3].slice(0, -2) + "aa"].join(".");
    for (const bad of [laterExpiry, flipped]) {
      expect(verifyFounderSessionToken(bad, SECRET)).toEqual({
        authorized: false,
        reason: "bad_signature",
      });
    }
  });

  it("rejects a token signed with a different secret", () => {
    const token = signFounderSession("z".repeat(48), Date.now() + 60_000);
    expect(verifyFounderSessionToken(token, SECRET)).toEqual({
      authorized: false,
      reason: "bad_signature",
    });
  });

  it("rejects an expired session", () => {
    const token = signFounderSession(SECRET, Date.now() - 1, Date.now() - 60_000);
    expect(verifyFounderSessionToken(token, SECRET)).toEqual({ authorized: false, reason: "expired" });
  });

  it("rejects a session that claims an issue time after its expiry", () => {
    const now = Date.now();
    const token = signFounderSession(SECRET, now + 1000, now + 2000);
    expect(verifyFounderSessionToken(token, SECRET)).toEqual({ authorized: false, reason: "malformed" });
  });

  it("rejects a session issued far in the future", () => {
    const now = Date.now();
    const token = signFounderSession(SECRET, now + 60_000, now + CLOCK_SKEW_MS + 60_000);
    expect(verifyFounderSessionToken(token, SECRET)).toEqual({ authorized: false, reason: "malformed" });
  });

  it("rejects a session older than the absolute TTL even if its expiry is in the future", () => {
    const now = Date.now();
    const token = signFounderSession(SECRET, now + 60_000, now - FOUNDER_SESSION_TTL_MS - 120_000);
    expect(verifyFounderSessionToken(token, SECRET)).toEqual({ authorized: false, reason: "expired" });
  });

  it("rejects v1-era and invented values as malformed", () => {
    for (const bad of ["ccf.v1.123.456.abc", "true", "1", "", "ccf2.123", "ccf2.x.y.z"]) {
      expect(verifyFounderSessionToken(bad, SECRET)).toEqual({ authorized: false, reason: "malformed" });
    }
  });

  it("treats a missing or too-short secret as not configured, never as authorized", () => {
    expect(verifyFounderSessionToken(signFounderSession(SECRET, Date.now() + 1000), null)).toEqual({
      authorized: false,
      reason: "not_configured",
    });
    expect(getFounderRevokeBefore({ [FOUNDER_REVOKE_BEFORE_ENV]: "short" } as unknown as NodeJS.ProcessEnv)).toBe(0);
  });

  it("mints a token carrying the 8h absolute lifetime", () => {
    const now = 1_700_000_000_000;
    const minted = mintFounderSession(SECRET, now);
    expect(minted.expiresAt - minted.issuedAt).toBe(FOUNDER_SESSION_TTL_MS);
    expect(verifyFounderSessionToken(minted.value, SECRET, now + 1000).authorized).toBe(true);
  });
});

describe("revocation cut-off", () => {
  it("rejects every session issued at or before the cut-off, with reason revoked", () => {
    const now = Date.now();
    const cutOff = now - 1000;
    const token = signFounderSession(SECRET, now + 60_000, cutOff);
    expect(verifyFounderSessionToken(token, SECRET, now, cutOff)).toEqual({
      authorized: false,
      reason: "revoked",
    });
  });

  it("keeps sessions issued after the cut-off", () => {
    const now = Date.now();
    const cutOff = now - 60_000;
    const token = signFounderSession(SECRET, now + 60_000, now - 1000);
    expect(verifyFounderSessionToken(token, SECRET, now, cutOff).authorized).toBe(true);
  });

  it("parses epoch ms and ISO timestamps, and ignores a value it cannot parse", () => {
    expect(getFounderRevokeBefore({ [FOUNDER_REVOKE_BEFORE_ENV]: "1700000000000" } as unknown as NodeJS.ProcessEnv)).toBe(
      1_700_000_000_000,
    );
    expect(
      getFounderRevokeBefore(
        { [FOUNDER_REVOKE_BEFORE_ENV]: "2026-11-08T00:00:00Z" } as unknown as NodeJS.ProcessEnv,
      ),
    ).toBe(Date.parse("2026-11-08T00:00:00Z"));
    expect(getFounderRevokeBefore({ [FOUNDER_REVOKE_BEFORE_ENV]: "not-a-date" } as unknown as NodeJS.ProcessEnv)).toBe(0);
  });
});

describe("cookie parsing", () => {
  it("finds the named cookie among others and survives encoded values", () => {
    expect(readCookie("a=1; cc_founder_session=v.1.2.3; b=2", FOUNDER_SESSION_COOKIE)).toBe("v.1.2.3");
    expect(readCookie("x=%E0%A4%A", "x")).toBe("%E0%A4%A");
    expect(readCookie(null, "x")).toBeNull();
    expect(readCookie("nope=1", "x")).toBeNull();
  });
});

describe("request-level authority", () => {
  it("accepts a valid signed cookie and ignores client-asserted identity", () => {
    const request = req({
      cookie: `${sessionCookie()}; cc-pin-auth=${encodeURIComponent('{"ok":true}')}`,
      headers: { "x-founder": "1", "x-decided-by": "Ramon", origin: "https://command.parallaxvinc.com" },
      body: JSON.stringify({ decided_by: "Ramon" }),
    });
    expect(requireFounderAuthority(request, "yolo-approve", { env: env() })).toBeNull();
  });

  it("401s a missing, malformed or expired cookie and never looks at the body", async () => {
    const cases = [
      req({}),
      req({ cookie: `${FOUNDER_SESSION_COOKIE}=true` }),
      req({ cookie: sessionCookie(-1000) }),
      req({ cookie: `${FOUNDER_SESSION_COOKIE}=${signFounderSession("z".repeat(48), Date.now() + 60_000)}` }),
    ];
    for (const request of cases) {
      const res = requireFounderAuthority(request, "yolo-approve", { env: env() });
      expect(res?.status).toBe(401);
      const body = await res!.json();
      expect(body.code).toBe("founder_authority_required");
    }
  });

  it("fails closed with 503 when enforcement is on but the secret is unset", () => {
    const res = requireFounderAuthority(req({ cookie: "x=y" }), "yolo-approve", {
      env: env({ COMMAND_CENTER_SESSION_SECRET: "" }),
    });
    expect(res?.status).toBe(503);
    expect(env()[FOUNDER_REVOKE_BEFORE_ENV]).toBeUndefined();
  });

  it("is a no-op when enforcement is off or names another route", () => {
    for (const flag of ["", "chat-gate", "gate,settings"]) {
      const res = requireFounderAuthority(req({}), "yolo-approve", {
        env: env({ [FOUNDER_GUARD_ENFORCE_ENV]: flag }),
      });
      expect(res).toBeNull();
    }
  });

  it("accepts any route key when the flag is all, and matches keys case-insensitively", () => {
    expect(isFounderGuardEnforced("settings", env({ [FOUNDER_GUARD_ENFORCE_ENV]: "all" }))).toBe(true);
    expect(isFounderGuardEnforced("settings", env({ [FOUNDER_GUARD_ENFORCE_ENV]: "SETTINGS" }))).toBe(true);
    expect(isFounderGuardEnforced("settings", env({ [FOUNDER_GUARD_ENFORCE_ENV]: "gate" }))).toBe(false);
  });
});

describe("origin and CSRF", () => {
  it("accepts a same-origin mutation from Origin and from Referer", () => {
    expect(isSameOriginRequest(req({ origin: "https://command.parallaxvinc.com" }))).toBe(true);
    expect(
      isSameOriginRequest(req({ referer: "https://command.parallaxvinc.com/command-center/yolo" })),
    ).toBe(true);
  });

  it("rejects a cross-origin mutation and a mutation with no origin evidence", () => {
    expect(isSameOriginRequest(req({ origin: "https://evil.example" }))).toBe(false);
    expect(isSameOriginRequest(req({ origin: "http://command.parallaxvinc.com.evil.example" }))).toBe(false);
    expect(isSameOriginRequest(req({}))).toBe(false);
  });

  it("does not require an origin on safe methods", () => {
    expect(isSameOriginRequest(req({ method: "GET" }))).toBe(true);
    expect(isSameOriginRequest(req({ method: "HEAD" }))).toBe(true);
  });

  it("honours the proxy host header and ignores a spoofed origin that only matches the suffix", () => {
    expect(
      isSameOriginRequest(
        req({
          host: "internal:3000",
          headers: { "x-forwarded-host": "command.parallaxvinc.com" },
          origin: "https://command.parallaxvinc.com",
        }),
      ),
    ).toBe(true);
    expect(
      isSameOriginRequest(req({ origin: "https://notcommand.parallaxvinc.com" })),
    ).toBe(false);
  });

  it("403s a valid cookie used from a cross-origin mutation", () => {
    const res = requireFounderAuthority(
      req({ cookie: sessionCookie(), origin: "https://evil.example" }),
      "yolo-approve",
      { env: env() },
    );
    expect(res?.status).toBe(403);
  });
});

describe("machine-to-machine credential", () => {
  const base = {
    [FOUNDER_GUARD_ENFORCE_ENV]: "all",
    [MACHINE_SECRET_ENV]: MACHINE,
    [MACHINE_ROUTES_ENV]: "agents,settings",
  };

  it("accepts a matching bearer on a listed route, without any cookie or origin", () => {
    const request = req({ authorization: `Bearer ${MACHINE}` });
    expect(verifyMachineCredential(request, "agents", env(base))).toBe(true);
    expect(requireFounderAuthority(request, "agents", { env: env(base) })).toBeNull();
  });

  it("refuses the same bearer on a route that is not listed", () => {
    const request = req({ authorization: `Bearer ${MACHINE}` });
    expect(verifyMachineCredential(request, "voice-call", env(base))).toBe(false);
    expect(requireFounderAuthority(request, "voice-call", { env: env(base) })?.status).toBe(401);
  });

  it("refuses a wrong or short machine secret, and an unlisted-route wildcard cannot be guessed", () => {
    const wrong = req({ authorization: `Bearer ${"n".repeat(48)}` });
    expect(verifyMachineCredential(wrong, "agents", env(base))).toBe(false);
    const shortEnv = { ...base, [MACHINE_SECRET_ENV]: "short" };
    expect(verifyMachineCredential(req({ authorization: "Bearer short" }), "agents", env(shortEnv))).toBe(false);
    expect(verifyMachineCredential(req({ authorization: "Bearer " }), "agents", env(base))).toBe(false);
  });

  it("allows a bearer on every route only when the operator says all", () => {
    const allEnv = { ...base, [MACHINE_ROUTES_ENV]: "all" };
    expect(verifyMachineCredential(req({ authorization: `Bearer ${MACHINE}` }), "voice-call", env(allEnv))).toBe(true);
  });
});
