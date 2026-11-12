import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({
  verifyIdTokenForOwnerLogin: vi.fn(),
  createSessionCookie: vi.fn(),
  verifySessionCookie: vi.fn(),
}));
vi.mock("@/lib/firebase-admin", () => m);

import { POST } from "./route";
import { OWNER_UID_ENV } from "@/lib/server/command-center-auth";

const OWNER = "the-real-owner-uid";
const TOKEN = "t".repeat(200);

function post(body: unknown, headers: Record<string, string> = { "sec-fetch-site": "same-origin" }, raw?: string) {
  return POST(
    new NextRequest("http://localhost/api/auth/command-session", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: raw ?? JSON.stringify(body),
    })
  );
}

describe("POST /api/auth/command-session", () => {
  const original = process.env[OWNER_UID_ENV];
  beforeEach(() => {
    process.env[OWNER_UID_ENV] = OWNER;
    Object.values(m).forEach((f) => f.mockReset());
    m.verifyIdTokenForOwnerLogin.mockResolvedValue({ uid: OWNER, signInProvider: "password" });
    m.createSessionCookie.mockResolvedValue("minted-cookie");
    m.verifySessionCookie.mockResolvedValue({ uid: OWNER, signInProvider: "password" });
  });
  afterEach(() => {
    process.env[OWNER_UID_ENV] = original;
  });

  it("owner: sets a short-lived httpOnly cookie and reports isOwner", async () => {
    const res = await post({ idToken: TOKEN });
    expect(res.status).toBe(200);
    const set = res.headers.get("set-cookie") ?? "";
    expect(set).toContain("__session=minted-cookie");
    expect(set.toLowerCase()).toContain("httponly");
    expect(set).toContain(`Max-Age=${12 * 60 * 60}`);
    expect(m.createSessionCookie).toHaveBeenCalledWith(TOKEN, 12 * 60 * 60 * 1000);
  });

  it("503 and no cookie / no verifier work when owner is not configured", async () => {
    delete process.env[OWNER_UID_ENV];
    const res = await post({ idToken: TOKEN });
    expect(res.status).toBe(503);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(m.verifyIdTokenForOwnerLogin).not.toHaveBeenCalled();
  });

  it("non-owner human: 403, NO cookie minted", async () => {
    m.verifyIdTokenForOwnerLogin.mockResolvedValue({ uid: "someone-else", signInProvider: "password" });
    const res = await post({ idToken: TOKEN });
    expect(res.status).toBe(403);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(m.createSessionCookie).not.toHaveBeenCalled();
  });

  it.each(["anonymous", "custom", undefined])("provider %s with the owner uid: 401, no cookie", async (p) => {
    m.verifyIdTokenForOwnerLogin.mockResolvedValue({ uid: OWNER, signInProvider: p });
    const res = await post({ idToken: TOKEN });
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(m.createSessionCookie).not.toHaveBeenCalled();
  });

  it("invalid / expired / revoked ID token: 401, no cookie", async () => {
    m.verifyIdTokenForOwnerLogin.mockResolvedValue(null);
    const res = await post({ idToken: TOKEN });
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("failed session exchange: 500, no cookie", async () => {
    m.createSessionCookie.mockResolvedValue(null);
    const res = await post({ idToken: TOKEN });
    expect(res.status).toBe(500);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("minted cookie that does not re-verify as owner is NOT set (success never declared on the token alone)", async () => {
    m.verifySessionCookie.mockResolvedValue(null);
    expect((await post({ idToken: TOKEN })).headers.get("set-cookie")).toBeNull();
    m.verifySessionCookie.mockResolvedValue({ uid: "someone-else", signInProvider: "password" });
    expect((await post({ idToken: TOKEN })).headers.get("set-cookie")).toBeNull();
  });

  it("bad bodies: missing / non-string / too short / too long / not JSON → 400", async () => {
    for (const body of [{}, { idToken: 5 }, { idToken: "short" }, { idToken: "x".repeat(9000) }]) {
      expect((await post(body)).status).toBe(400);
    }
    expect((await post(null, undefined, "not json")).status).toBe(400);
  });

  it("login CSRF: cross-site and ambiguous-origin requests are rejected before any token work", async () => {
    expect((await post({ idToken: TOKEN }, { "sec-fetch-site": "cross-site" })).status).toBe(403);
    expect((await post({ idToken: TOKEN }, {})).status).toBe(403);
    expect((await post({ idToken: TOKEN }, { origin: "https://evil.example.com", host: "localhost" })).status).toBe(403);
    expect(m.verifyIdTokenForOwnerLogin).not.toHaveBeenCalled();
  });

  it("a forged identity header cannot substitute for the verified token", async () => {
    m.verifyIdTokenForOwnerLogin.mockResolvedValue({ uid: "someone-else", signInProvider: "password" });
    const res = await post({ idToken: TOKEN }, { "sec-fetch-site": "same-origin", "x-user-id": OWNER, "x-forwarded-host": "command.parallaxvinc.com" });
    expect(res.status).toBe(403);
  });

  it("denial bodies never echo uid/email/config", async () => {
    m.verifyIdTokenForOwnerLogin.mockResolvedValue({ uid: "leaky-uid-123456", email: "leak@example.com", signInProvider: "password" });
    const text = await (await post({ idToken: TOKEN })).text();
    expect(text).not.toContain("leaky-uid");
    expect(text).not.toContain("leak@example.com");
    expect(text).not.toContain(OWNER);
  });
});
