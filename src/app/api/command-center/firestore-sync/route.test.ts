/**
 * CC-SECURITY-REMEDIATION-05 item 2: `firestore-sync` GET reveals resolved local
 * filesystem paths on the host (its own comment calls this "PIN-gated UI only",
 * which was never actually enforced server-side) and POST performs a real local
 * filesystem read + Firestore write. Both had no auth check. No mocking is
 * needed here: `getAdminDb()` returns null whenever `FIREBASE_SERVICE_ACCOUNT`
 * is unset, which it is in this test environment, so the unguarded-passthrough
 * case safely 503s on its own without reaching any real Firebase call.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "./route";
import { FOUNDER_SESSION_COOKIE, signFounderSession } from "@/lib/server/founder-authority";

const SECRET = "q".repeat(48);
const HOST = "command.parallaxvinc.com";

function req(headers: Record<string, string> = {}): Request {
  return new Request(`https://${HOST}/api/command-center/firestore-sync`, {
    method: "GET",
    headers: { host: HOST, ...headers },
  });
}

function postReq(headers: Record<string, string> = {}): Request {
  return new Request(`https://${HOST}/api/command-center/firestore-sync`, {
    method: "POST",
    headers: { host: HOST, ...headers },
  });
}

function validCookie(): string {
  return `${FOUNDER_SESSION_COOKIE}=${signFounderSession(SECRET, Date.now() + 60_000)}`;
}

beforeEach(() => {
  vi.stubEnv("COMMAND_CENTER_SESSION_SECRET", SECRET);
  vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "");
  vi.stubEnv("COMMAND_CENTER_MACHINE_SECRET", "");
  vi.stubEnv("CC_MACHINE_ROUTES", "");
  vi.stubEnv("FIREBASE_SERVICE_ACCOUNT", "");
});

afterEach(() => vi.unstubAllEnvs());

describe.each([
  { name: "GET", handler: GET, make: req },
  { name: "POST", handler: POST, make: postReq },
])("$name /firestore-sync", ({ handler, make }) => {
  it("is unguarded by default (503s on its own because no Firebase service account is configured here)", async () => {
    const res = await handler(make());
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it("401s with no session when enforced", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "firestore-sync");
    const res = await handler(make());
    expect(res.status).toBe(401);
  });

  it("503s when enforced but the signing secret is missing (fail closed)", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "all");
    vi.stubEnv("COMMAND_CENTER_SESSION_SECRET", "");
    const res = await handler(make({ cookie: validCookie() }));
    expect(res.status).toBe(503);
  });
});

describe("POST /firestore-sync (mutation, so cross-origin matters)", () => {
  beforeEach(() => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "all");
  });

  it("403s a valid session used cross-origin", async () => {
    const res = await POST(postReq({ cookie: validCookie(), origin: "https://evil.example" }));
    expect(res.status).toBe(403);
  });

  it("proceeds (to its own 503, since Firebase isn't configured here) for a same-origin valid session", async () => {
    const res = await POST(postReq({ cookie: validCookie(), origin: `https://${HOST}` }));
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});

describe("GET /firestore-sync (safe method, origin does not matter)", () => {
  it("does not 403 a cross-origin request carrying a valid session", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "all");
    const res = await GET(req({ cookie: validCookie(), origin: "https://evil.example" }));
    expect(res.status).not.toBe(403);
  });
});
