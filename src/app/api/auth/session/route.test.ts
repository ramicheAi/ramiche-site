import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({
  createSessionCookie: vi.fn(),
  verifySessionCookie: vi.fn(),
  revokeSession: vi.fn(),
}));
vi.mock("@/lib/firebase-admin", () => m);

import { GET, POST } from "./route";
import { OWNER_UID_ENV } from "@/lib/server/command-center-auth";

const getReq = (cookie?: string) =>
  new NextRequest("http://localhost/api/auth/session", { headers: cookie ? { cookie: `__session=${cookie}` } : {} });

describe("/api/auth/session — shared METTLE endpoint stays functional and never grants owner by itself", () => {
  const original = process.env[OWNER_UID_ENV];
  beforeEach(() => {
    process.env[OWNER_UID_ENV] = "the-real-owner-uid";
    Object.values(m).forEach((f) => f.mockReset());
  });
  afterEach(() => {
    process.env[OWNER_UID_ENV] = original;
  });

  it("METTLE coach/athlete session: authenticated true, isOwner false (unchanged contract + new flag)", async () => {
    m.verifySessionCookie.mockResolvedValue({ uid: "coach-uid-1", email: "c@x.com", signInProvider: "password" });
    const body = await (await GET(getReq("c"))).json();
    expect(body).toMatchObject({ authenticated: true, uid: "coach-uid-1", isOwner: false });
  });

  it("anonymous/custom athlete sessions are authenticated but never owner, even with the owner uid", async () => {
    for (const p of ["anonymous", "custom"]) {
      m.verifySessionCookie.mockResolvedValue({ uid: "the-real-owner-uid", signInProvider: p });
      expect((await (await GET(getReq("c"))).json()).isOwner).toBe(false);
    }
  });

  it("exact owner: isOwner true; with no configured owner it is false", async () => {
    m.verifySessionCookie.mockResolvedValue({ uid: "the-real-owner-uid", signInProvider: "password" });
    expect((await (await GET(getReq("c"))).json()).isOwner).toBe(true);
    delete process.env[OWNER_UID_ENV];
    expect((await (await GET(getReq("c"))).json()).isOwner).toBe(false);
  });

  it("missing / invalid cookie → 401 authenticated:false", async () => {
    expect((await GET(getReq())).status).toBe(401);
    m.verifySessionCookie.mockResolvedValue(null);
    expect((await GET(getReq("bad"))).status).toBe(401);
  });

  it("POST (METTLE exchange) still mints the 30-day cookie for any valid identity", async () => {
    m.createSessionCookie.mockResolvedValue("cookie-value");
    const res = await POST(
      new NextRequest("http://localhost/api/auth/session", { method: "POST", headers: { "sec-fetch-site": "same-origin" }, body: JSON.stringify({ idToken: "tok" }) })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("__session=cookie-value");
    expect(res.headers.get("set-cookie")).toContain(`Max-Age=${30 * 24 * 60 * 60}`);
  });

  it("POST/DELETE reject cross-site and ambiguous-origin requests (login CSRF)", async () => {
    for (const headers of [{ "sec-fetch-site": "cross-site" }, {}] as Record<string, string>[]) {
      const res = await POST(new NextRequest("http://localhost/api/auth/session", { method: "POST", headers, body: JSON.stringify({ idToken: "tok" }) }));
      expect(res.status).toBe(403);
    }
    expect(m.createSessionCookie).not.toHaveBeenCalled();
  });
});
